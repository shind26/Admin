"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertContractInScope, assertInvoiceInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { ScopeQuery } from "@/lib/scope";
import { getInvoiceDetail } from "@/lib/queries";

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


/** Tạo hóa đơn phát sinh / thu đột xuất ngoài chu kỳ. */
export async function createInvoice(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHopDong = text(formData, "maHopDong");
  const loaiPhatSinh = text(formData, "loaiPhatSinh") || "Khac";
  const tenKhoanThu = text(formData, "tenKhoanThu");
  const soTien = money(formData, "soTien");
  const ngayLap = text(formData, "ngayLap") || new Date().toISOString().slice(0, 10);
  const hanDongTien = text(formData, "hanDongTien") || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

  if (!maHopDong) return { error: "Vui lòng chọn hợp đồng / phòng.", success: null };
  if (!tenKhoanThu) return { error: "Vui lòng nhập tên khoản thu / lý do phát sinh.", success: null };
  if (soTien <= 0) return { error: "Số tiền phát sinh phải lớn hơn 0 đ.", success: null };
  if (hanDongTien < ngayLap) {
    return { error: "Hạn đóng tiền không được trước ngày lập hóa đơn.", success: null };
  }

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    const { rows: contractRows } = await client.query<{
      ma_phong: string;
      toa_nha: string | null;
      rep_tai_khoan: string | null;
    }>(
      `SELECT hd.ma_phong, p.toa_nha, k.ma_tai_khoan AS rep_tai_khoan
       FROM public.hop_dong hd
       LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
       WHERE hd.ma_hop_dong = $1 LIMIT 1`,
      [maHopDong],
    );
    if (contractRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Hợp đồng không tồn tại.", success: null };
    }
    const contract = contractRows[0];

    const maHoaDon = "HDPS" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const tienPhong = loaiPhatSinh === "TienPhongLe" ? soTien : 0;
    const tienDichVuKhac = loaiPhatSinh !== "TienPhongLe" ? soTien : 0;

    await client.query(
      `INSERT INTO public.hoa_don
         (ma_hoa_don, ma_hop_dong, loai_giao_dich, tien_phong, tien_dien_nuoc,
          tien_dich_vu_khac, no_cu, tong_tien, ngay_lap, han_dong_tien, trang_thai)
       VALUES ($1, $2, 'Phát sinh', $3, 0, $4, 0, $5, $6, $7, 'Chưa thanh toán')`,
      [
        maHoaDon,
        maHopDong,
        tienPhong,
        tienDichVuKhac,
        soTien,
        ngayLap,
        hanDongTien,
      ],
    );

    const maCthd = "CTHD" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await client.query(
      `INSERT INTO public.chi_tiet_hoa_don
         (ma_cthd, ma_hoa_don, ten_khoan_thu, so_luong, don_gia, thanh_tien)
       VALUES ($1, $2, $3, 1, $4, $4)`,
      [maCthd, maHoaDon, tenKhoanThu, soTien],
    );

    // Gửi thông báo đến bảng thong_bao cho chủ phòng
    if (contract.rep_tai_khoan) {
      await createNotification(
        {
          maTaiKhoan: contract.rep_tai_khoan,
          maPhong: contract.ma_phong,
          toaNha: contract.toa_nha,
          tieuDe: "Hóa đơn phát sinh mới",
          noiDung: `Ban quản lý đã lập hóa đơn phát sinh: ${tenKhoanThu} (${Number(soTien).toLocaleString("vi-VN")} đ). Hạn đóng: ${hanDongTien}.`,
          loaiThongBao: "HoaDon",
          duLieuDinhKem: {
            ma_hoa_don: maHoaDon,
            so_tien: soTien,
            ten_khoan_thu: tenKhoanThu,
          },
        },
        client,
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create incidental invoice error:", err);
    return {
      error: "Không thể lưu hóa đơn phát sinh. Hãy kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/hoa-don");
  return { error: null, success: "Tạo hóa đơn phát sinh thành công." };
}


/** Xóa hóa đơn (chỉ cho phép khi chưa có phiếu thu). */
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

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ hasReceipt: number }>(
      `SELECT COUNT(*)::int AS hasReceipt FROM public.phieu_thu WHERE ma_hoa_don = $1`,
      [maHoaDon],
    );
    if ((rows[0]?.hasReceipt ?? 0) > 0) {
      await client.query("ROLLBACK");
      return {
        error: "Không thể xóa hóa đơn đã có phiếu thu thanh toán.",
        success: null,
      };
    }

    // Xóa chi tiết hóa đơn trước (nếu có)
    await client.query("DELETE FROM public.chi_tiet_hoa_don WHERE ma_hoa_don = $1", [maHoaDon]);

    const { rowCount } = await client.query(
      "DELETE FROM public.hoa_don WHERE ma_hoa_don = $1",
      [maHoaDon],
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy hóa đơn.", success: null };
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete invoice error:", err);
    return { error: "Không thể xóa hóa đơn. Hãy thử lại.", success: null };
  } finally {
    client.release();
  }

  revalidatePath("/hoa-don");
  return { error: null, success: "Đã xóa hóa đơn." };
}

/** Lấy chi tiết hóa đơn theo mã (có kiểm tra phạm vi quyền). */
export async function getInvoiceDetailAction(maHoaDon: string) {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", data: null };
  const { scope } = await requireScope();

  const invoiceGuard = await assertInvoiceInScope(maHoaDon, scope);
  if (invoiceGuard) return { error: invoiceGuard, data: null };

  const scopeQuery = new ScopeQuery(scope);
  const data = await getInvoiceDetail(maHoaDon, scopeQuery);
  if (!data) return { error: "Không tìm thấy hóa đơn.", data: null };

  return { error: null, data };
}
