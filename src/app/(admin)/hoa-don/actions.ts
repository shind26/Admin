"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertContractInScope, assertInvoiceInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type InvoiceFormState = { error: string | null; success: string | null };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return 0;
  const parsed = Number(raw.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Tính trạng thái theo InvoiceController.RefreshStatus dựa trên phiếu thu đã xác nhận. */
async function refreshInvoiceStatus(maHoaDon: string, tongTien: number) {
  const { rows } = await getDbPool().query<{ paid: string }>(
    `SELECT COALESCE(SUM(so_tien_thu), 0)::text AS paid
     FROM public.phieu_thu
     WHERE ma_hoa_don = $1 AND trang_thai = 'Đã xác nhận'`,
    [maHoaDon],
  );
  const paid = Number(rows[0]?.paid ?? 0);
  const trangThai =
    paid <= 0
      ? "Chưa thanh toán"
      : paid >= tongTien
        ? "Đã thanh toán"
        : "Thanh toán một phần";
  await getDbPool().query(
    "UPDATE public.hoa_don SET trang_thai = $2 WHERE ma_hoa_don = $1",
    [maHoaDon, trangThai],
  );
}

/** Tạo hóa đơn theo InvoiceController.Create. */
export async function createInvoice(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHopDong = text(formData, "maHopDong");
  const ngayLap = text(formData, "ngayLap");
  const hanDongTien = text(formData, "hanDongTien");

  if (!maHopDong) return { error: "Vui lòng chọn hợp đồng.", success: null };

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };
  if (hanDongTien && ngayLap && hanDongTien < ngayLap) {
    return { error: "Hạn đóng tiền không được trước ngày lập.", success: null };
  }

  const tienPhong = money(formData, "tienPhong");
  const tienDienNuoc = money(formData, "tienDienNuoc");
  const tienDichVuKhac = money(formData, "tienDichVuKhac");
  const noCu = money(formData, "noCu");
  const tongTien = tienPhong + tienDienNuoc + tienDichVuKhac + noCu;

  if (tongTien <= 0)
    return { error: "Tổng tiền hóa đơn phải lớn hơn 0.", success: null };

  try {
    const { rows } = await getDbPool().query(
      "SELECT 1 FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1",
      [maHopDong],
    );
    if (rows.length === 0)
      return { error: "Hợp đồng không tồn tại.", success: null };

    const maHoaDon =
      "HD" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await getDbPool().query(
      `INSERT INTO public.hoa_don
         (ma_hoa_don, ma_hop_dong, loai_giao_dich, tien_phong, tien_dien_nuoc,
          tien_dich_vu_khac, no_cu, tong_tien, ngay_lap, han_dong_tien, trang_thai)
       VALUES ($1,$2,'Thu',$3,$4,$5,$6,$7,$8,$9,'Chưa thanh toán')`,
      [
        maHoaDon,
        maHopDong,
        tienPhong,
        tienDienNuoc,
        tienDichVuKhac,
        noCu,
        tongTien,
        ngayLap || null,
        hanDongTien || null,
      ],
    );
  } catch {
    return {
      error: "Không thể lưu hóa đơn. Hãy kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  }

  revalidatePath("/hoa-don");
  return { error: null, success: "Tạo hóa đơn thành công." };
}

/** Cập nhật hóa đơn theo InvoiceController.Edit (không cho tổng thấp hơn số đã thu). */
export async function updateInvoice(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHoaDon = text(formData, "maHoaDon");
  const maHopDong = text(formData, "maHopDong");
  if (!maHoaDon) return { error: "Thiếu mã hóa đơn.", success: null };
  if (!maHopDong) return { error: "Vui lòng chọn hợp đồng.", success: null };

  const invoiceGuard = await assertInvoiceInScope(maHoaDon, scope);
  if (invoiceGuard) return { error: invoiceGuard, success: null };
  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const tienPhong = money(formData, "tienPhong");
  const tienDienNuoc = money(formData, "tienDienNuoc");
  const tienDichVuKhac = money(formData, "tienDichVuKhac");
  const noCu = money(formData, "noCu");
  const tongTien = tienPhong + tienDienNuoc + tienDichVuKhac + noCu;

  try {
    const { rows } = await getDbPool().query<{ collected: string }>(
      `SELECT COALESCE(SUM(so_tien_thu), 0)::text AS collected
       FROM public.phieu_thu WHERE ma_hoa_don = $1 AND trang_thai = 'Đã xác nhận'`,
      [maHoaDon],
    );
    if (tongTien < Number(rows[0]?.collected ?? 0)) {
      return {
        error: "Tổng hóa đơn không thể thấp hơn số tiền đã thu.",
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      `UPDATE public.hoa_don
       SET ma_hop_dong = $2, ngay_lap = $3, han_dong_tien = $4, tien_phong = $5,
           tien_dien_nuoc = $6, tien_dich_vu_khac = $7, no_cu = $8, tong_tien = $9
       WHERE ma_hoa_don = $1`,
      [
        maHoaDon,
        maHopDong,
        text(formData, "ngayLap") || null,
        text(formData, "hanDongTien") || null,
        tienPhong,
        tienDienNuoc,
        tienDichVuKhac,
        noCu,
        tongTien,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy hóa đơn.", success: null };

    await refreshInvoiceStatus(maHoaDon, tongTien);
  } catch {
    return { error: "Không thể cập nhật hóa đơn. Hãy thử lại.", success: null };
  }

  revalidatePath("/hoa-don");
  revalidatePath("/phieu-thu");
  return { error: null, success: "Cập nhật hóa đơn thành công." };
}

/** Xóa hóa đơn theo InvoiceController.Delete (chặn khi có phiếu thu hoặc chi tiết). */
export async function deleteInvoice(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHoaDon = text(formData, "maHoaDon");
  if (!maHoaDon) return { error: "Thiếu mã hóa đơn.", success: null };

  const invoiceGuard = await assertInvoiceInScope(maHoaDon, scope);
  if (invoiceGuard) return { error: invoiceGuard, success: null };

  try {
    const { rows } = await getDbPool().query<{ used: number }>(
      `SELECT (
         EXISTS(SELECT 1 FROM public.phieu_thu WHERE ma_hoa_don = $1)
         OR EXISTS(SELECT 1 FROM public.chi_tiet_hoa_don WHERE ma_hoa_don = $1)
       )::int AS used`,
      [maHoaDon],
    );
    if ((rows[0]?.used ?? 0) === 1) {
      return {
        error: "Không thể xóa hóa đơn đã có phiếu thu hoặc chi tiết.",
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      "DELETE FROM public.hoa_don WHERE ma_hoa_don = $1",
      [maHoaDon],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy hóa đơn.", success: null };
  } catch {
    return { error: "Không thể xóa hóa đơn. Hãy thử lại.", success: null };
  }

  revalidatePath("/hoa-don");
  return { error: null, success: "Đã xóa hóa đơn." };
}
