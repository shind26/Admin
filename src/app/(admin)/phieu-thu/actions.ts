"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertInvoiceInScope, assertReceiptInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type ReceiptFormState = { error: string | null; success: string | null };

const RECEIPT_STATUSES = ["Đã xác nhận", "Chờ xác nhận", "Từ chối"];
const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "VietQR"];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Cập nhật trạng thái hóa đơn theo ReceiptController.RefreshInvoiceStatus:
 * chỉ tính các phiếu thu "Đã xác nhận", có thể loại trừ một phiếu cụ thể.
 */
async function refreshInvoiceStatusByReceipt(
  maHoaDon: string,
  exceptReceiptId?: string,
) {
  const { rows: invoiceRows } = await getDbPool().query<{
    tong_tien: string | null;
  }>(
    "SELECT tong_tien::text AS tong_tien FROM public.hoa_don WHERE ma_hoa_don = $1 LIMIT 1",
    [maHoaDon],
  );
  if (invoiceRows.length === 0) return;

  const { rows: paidRows } = await getDbPool().query<{ paid: string }>(
    `SELECT COALESCE(SUM(so_tien_thu), 0)::text AS paid
     FROM public.phieu_thu
     WHERE ma_hoa_don = $1 AND trang_thai = 'Đã xác nhận'
       AND ($2::text IS NULL OR ma_phieu_thu <> $2)`,
    [maHoaDon, exceptReceiptId ?? null],
  );

  const paid = Number(paidRows[0]?.paid ?? 0);
  const total = Number(invoiceRows[0].tong_tien ?? 0);
  const trangThai =
    paid <= 0
      ? "Chưa thanh toán"
      : paid >= total
        ? "Đã thanh toán"
        : "Thanh toán một phần";

  await getDbPool().query(
    "UPDATE public.hoa_don SET trang_thai = $2 WHERE ma_hoa_don = $1",
    [maHoaDon, trangThai],
  );
}

async function confirmedTotal(maHoaDon: string, exceptReceiptId?: string) {
  const { rows } = await getDbPool().query<{ paid: string }>(
    `SELECT COALESCE(SUM(so_tien_thu), 0)::text AS paid
     FROM public.phieu_thu
     WHERE ma_hoa_don = $1 AND trang_thai = 'Đã xác nhận'
       AND ($2::text IS NULL OR ma_phieu_thu <> $2)`,
    [maHoaDon, exceptReceiptId ?? null],
  );
  return Number(rows[0]?.paid ?? 0);
}

/** Ghi nhận phiếu thu theo ReceiptController.Create. */
export async function createReceipt(
  _previous: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHoaDon = text(formData, "maHoaDon");
  const soTienThu = money(formData, "soTienThu");
  const hinhThuc = text(formData, "hinhThuc") || "Chuyển khoản";
  const trangThai = text(formData, "trangThai") || "Đã xác nhận";

  if (!maHoaDon) return { error: "Vui lòng chọn hóa đơn.", success: null };

  const invoiceGuard = await assertInvoiceInScope(maHoaDon, scope);
  if (invoiceGuard) return { error: invoiceGuard, success: null };
  if (soTienThu === null || soTienThu <= 0)
    return { error: "Số tiền thu phải lớn hơn 0.", success: null };
  if (!RECEIPT_STATUSES.includes(trangThai))
    return { error: "Trạng thái phiếu thu không hợp lệ.", success: null };
  if (!PAYMENT_METHODS.includes(hinhThuc))
    return { error: "Hình thức thanh toán không hợp lệ.", success: null };

  try {
    const { rows } = await getDbPool().query<{ tong_tien: string | null }>(
      "SELECT tong_tien::text AS tong_tien FROM public.hoa_don WHERE ma_hoa_don = $1 LIMIT 1",
      [maHoaDon],
    );
    if (rows.length === 0)
      return { error: "Hóa đơn không tồn tại.", success: null };

    if (trangThai === "Đã xác nhận") {
      const remaining =
        Number(rows[0].tong_tien ?? 0) - (await confirmedTotal(maHoaDon));
      if (soTienThu > remaining)
        return { error: "Số tiền thu vượt quá số còn nợ.", success: null };
    }

    const maPhieuThu =
      "PT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await getDbPool().query(
      `INSERT INTO public.phieu_thu
         (ma_phieu_thu, ma_hoa_don, so_tien_thu, ngay_thu, hinh_thuc, ma_tra_cuu, anh_bien_lai, trang_thai)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        maPhieuThu,
        maHoaDon,
        soTienThu,
        text(formData, "ngayThu") || null,
        hinhThuc,
        text(formData, "maTraCuu") || null,
        text(formData, "anhBienLai") || null,
        trangThai,
      ],
    );

    if (trangThai === "Đã xác nhận")
      await refreshInvoiceStatusByReceipt(maHoaDon);
  } catch {
    return {
      error: "Không thể lưu phiếu thu. Hãy kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  }

  revalidatePath("/phieu-thu");
  revalidatePath("/hoa-don");
  return { error: null, success: "Ghi nhận phiếu thu thành công." };
}

/** Cập nhật phiếu thu theo ReceiptController.Edit. */
export async function updateReceipt(
  _previous: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhieuThu = text(formData, "maPhieuThu");
  const soTienThu = money(formData, "soTienThu");
  const hinhThuc = text(formData, "hinhThuc");
  const trangThai = text(formData, "trangThai");

  if (!maPhieuThu) return { error: "Thiếu mã phiếu thu.", success: null };

  const receiptGuard = await assertReceiptInScope(maPhieuThu, scope);
  if (receiptGuard) return { error: receiptGuard, success: null };
  if (soTienThu === null || soTienThu <= 0)
    return { error: "Số tiền thu phải lớn hơn 0.", success: null };
  if (!RECEIPT_STATUSES.includes(trangThai))
    return { error: "Trạng thái phiếu thu không hợp lệ.", success: null };
  if (!PAYMENT_METHODS.includes(hinhThuc))
    return { error: "Hình thức thanh toán không hợp lệ.", success: null };

  try {
    const { rows } = await getDbPool().query<{ ma_hoa_don: string | null }>(
      "SELECT ma_hoa_don FROM public.phieu_thu WHERE ma_phieu_thu = $1 LIMIT 1",
      [maPhieuThu],
    );
    if (rows.length === 0)
      return { error: "Không tìm thấy phiếu thu.", success: null };
    const maHoaDon = rows[0].ma_hoa_don;
    if (!maHoaDon)
      return { error: "Phiếu thu chưa gắn hóa đơn.", success: null };

    if (trangThai === "Đã xác nhận") {
      const { rows: invoiceRows } = await getDbPool().query<{
        tong_tien: string | null;
      }>(
        "SELECT tong_tien::text AS tong_tien FROM public.hoa_don WHERE ma_hoa_don = $1 LIMIT 1",
        [maHoaDon],
      );
      const remaining =
        Number(invoiceRows[0]?.tong_tien ?? 0) -
        (await confirmedTotal(maHoaDon, maPhieuThu));
      if (soTienThu > remaining)
        return { error: "Số tiền thu vượt quá số còn nợ.", success: null };
    }

    await getDbPool().query(
      `UPDATE public.phieu_thu
       SET so_tien_thu = $2, ngay_thu = $3, hinh_thuc = $4, ma_tra_cuu = $5,
           anh_bien_lai = $6, trang_thai = $7
       WHERE ma_phieu_thu = $1`,
      [
        maPhieuThu,
        soTienThu,
        text(formData, "ngayThu") || null,
        hinhThuc,
        text(formData, "maTraCuu") || null,
        text(formData, "anhBienLai") || null,
        trangThai,
      ],
    );

    await refreshInvoiceStatusByReceipt(maHoaDon);
  } catch {
    return {
      error: "Không thể cập nhật phiếu thu. Hãy thử lại.",
      success: null,
    };
  }

  revalidatePath("/phieu-thu");
  revalidatePath("/hoa-don");
  return { error: null, success: "Cập nhật phiếu thu thành công." };
}

/** Xóa phiếu thu theo ReceiptController.Delete (xóa hợp lệ sẽ cập nhật lại hóa đơn). */
export async function deleteReceipt(
  _previous: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhieuThu = text(formData, "maPhieuThu");
  if (!maPhieuThu) return { error: "Thiếu mã phiếu thu.", success: null };

  const receiptGuard = await assertReceiptInScope(maPhieuThu, scope);
  if (receiptGuard) return { error: receiptGuard, success: null };

  try {
    const { rows } = await getDbPool().query<{ ma_hoa_don: string | null }>(
      "SELECT ma_hoa_don FROM public.phieu_thu WHERE ma_phieu_thu = $1 LIMIT 1",
      [maPhieuThu],
    );
    if (rows.length === 0)
      return { error: "Không tìm thấy phiếu thu.", success: null };
    const maHoaDon = rows[0].ma_hoa_don;

    await getDbPool().query(
      "DELETE FROM public.phieu_thu WHERE ma_phieu_thu = $1",
      [maPhieuThu],
    );
    if (maHoaDon) await refreshInvoiceStatusByReceipt(maHoaDon);
  } catch {
    return { error: "Không thể xóa phiếu thu. Hãy thử lại.", success: null };
  }

  revalidatePath("/phieu-thu");
  revalidatePath("/hoa-don");
  return { error: null, success: "Đã xóa phiếu thu." };
}
