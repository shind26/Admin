"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertInvoiceInScope, assertReceiptInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";
import { createNotification } from "@/lib/notifications";

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
 * Tính các phiếu thu "Đã xác nhận" và "Đã khớp lệnh", có thể loại trừ một phiếu cụ thể.
 */
async function refreshInvoiceStatusByReceipt(
  maHoaDon: string,
  exceptReceiptId?: string,
) {
  const { rows: invoiceRows } = await getDbPool().query<{
    tong_tien: string | null;
    tien_phong: string | null;
    tien_dien_nuoc: string | null;
    tien_dich_vu_khac: string | null;
    no_cu: string | null;
  }>(
    `SELECT tong_tien::text AS tong_tien,
            tien_phong::text AS tien_phong,
            tien_dien_nuoc::text AS tien_dien_nuoc,
            tien_dich_vu_khac::text AS tien_dich_vu_khac,
            no_cu::text AS no_cu
     FROM public.hoa_don
     WHERE ma_hoa_don = $1 LIMIT 1`,
    [maHoaDon],
  );
  if (invoiceRows.length === 0) return;

  const { rows: paidRows } = await getDbPool().query<{ paid: string }>(
    `SELECT COALESCE(SUM(so_tien_thu), 0)::text AS paid
     FROM public.phieu_thu
     WHERE ma_hoa_don = $1 AND trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')
       AND ($2::text IS NULL OR ma_phieu_thu <> $2)`,
    [maHoaDon, exceptReceiptId ?? null],
  );

  const paid = Number(paidRows[0]?.paid ?? 0);
  let total = Number(invoiceRows[0].tong_tien ?? 0);
  if (total <= 0) {
    total =
      Number(invoiceRows[0].tien_phong || 0) +
      Number(invoiceRows[0].tien_dien_nuoc || 0) +
      Number(invoiceRows[0].tien_dich_vu_khac || 0) +
      Number(invoiceRows[0].no_cu || 0);
  }

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
     WHERE ma_hoa_don = $1 AND trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')
       AND ($2::text IS NULL OR ma_phieu_thu <> $2)`,
    [maHoaDon, exceptReceiptId ?? null],
  );
  return Number(rows[0]?.paid ?? 0);
}

async function notifyTenantPaymentConfirmed(
  maHoaDon: string,
  maPhieuThu: string,
  soTien: number,
  hinhThuc: string,
) {
  try {
    const { rows } = await getDbPool().query<{
      rep_tai_khoan: string | null;
      ma_phong: string | null;
      toa_nha: string | null;
    }>(
      `SELECT k.ma_tai_khoan AS rep_tai_khoan, c.ma_phong, p.toa_nha
       FROM public.hoa_don hd
       JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
       JOIN public.phong p ON p.ma_phong = c.ma_phong
       JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
       WHERE hd.ma_hoa_don = $1 LIMIT 1`,
      [maHoaDon],
    );
    if (rows[0]?.rep_tai_khoan) {
      await createNotification({
        maTaiKhoan: rows[0].rep_tai_khoan,
        maPhong: rows[0].ma_phong,
        toaNha: rows[0].toa_nha,
        tieuDe: "Xác nhận thanh toán thành công",
        noiDung: `Ban quản lý đã xác nhận phiếu thu ${maPhieuThu} số tiền ${Number(soTien).toLocaleString("vi-VN")} đ (${hinhThuc}) cho hóa đơn ${maHoaDon}.`,
        loaiThongBao: "HoaDon",
        duLieuDinhKem: {
          ma_phieu_thu: maPhieuThu,
          ma_hoa_don: maHoaDon,
          so_tien_thu: soTien,
        },
      });
    }
  } catch (err) {
    console.error("Failed to notify tenant of payment confirmation:", err);
  }
}

/** Ghi nhận phiếu thu mới */
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
    const { rows } = await getDbPool().query<{
      tong_tien: string | null;
      tien_phong: string | null;
      tien_dien_nuoc: string | null;
      tien_dich_vu_khac: string | null;
      no_cu: string | null;
    }>(
      `SELECT tong_tien::text AS tong_tien,
              tien_phong::text AS tien_phong,
              tien_dien_nuoc::text AS tien_dien_nuoc,
              tien_dich_vu_khac::text AS tien_dich_vu_khac,
              no_cu::text AS no_cu
       FROM public.hoa_don
       WHERE ma_hoa_don = $1 LIMIT 1`,
      [maHoaDon],
    );
    if (rows.length === 0)
      return { error: "Hóa đơn không tồn tại.", success: null };

    let total = Number(rows[0].tong_tien ?? 0);
    if (total <= 0) {
      total =
        Number(rows[0].tien_phong || 0) +
        Number(rows[0].tien_dien_nuoc || 0) +
        Number(rows[0].tien_dich_vu_khac || 0) +
        Number(rows[0].no_cu || 0);
    }

    if (trangThai === "Đã xác nhận") {
      const remaining = total - (await confirmedTotal(maHoaDon));
      if (soTienThu > remaining)
        return {
          error: `Số tiền thu (${soTienThu.toLocaleString("vi-VN")} đ) vượt quá số còn nợ (${remaining.toLocaleString("vi-VN")} đ).`,
          success: null,
        };
    }

    const maPhieuThu =
      "PT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await getDbPool().query(
      `INSERT INTO public.phieu_thu
         (ma_phieu_thu, ma_hoa_don, so_tien_thu, ngay_thu, hinh_thuc, ma_tra_cuu, trang_thai)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        maPhieuThu,
        maHoaDon,
        soTienThu,
        text(formData, "ngayThu") || null,
        hinhThuc,
        text(formData, "maTraCuu") || null,
        trangThai,
      ],
    );

    if (trangThai === "Đã xác nhận") {
      await refreshInvoiceStatusByReceipt(maHoaDon);
      await notifyTenantPaymentConfirmed(maHoaDon, maPhieuThu, soTienThu, hinhThuc);
    }
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

/** Cập nhật phiếu thu (Lựa chọn A: Khóa sửa đối với phiếu thu đã xác nhận). */
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

  try {
    const { rows } = await getDbPool().query<{
      ma_hoa_don: string | null;
      trang_thai: string;
    }>(
      "SELECT ma_hoa_don, trang_thai FROM public.phieu_thu WHERE ma_phieu_thu = $1 LIMIT 1",
      [maPhieuThu],
    );
    if (rows.length === 0)
      return { error: "Không tìm thấy phiếu thu.", success: null };

    const currentReceipt = rows[0];
    // LỰA CHỌN A: Khóa sửa phiếu thu đã xác nhận
    if (
      currentReceipt.trang_thai === "Đã xác nhận" ||
      currentReceipt.trang_thai === "Đã khớp lệnh"
    ) {
      return {
        error:
          "Phiếu thu đã được xác nhận không thể chỉnh sửa. Nếu có sai sót, vui lòng xóa và tạo lại phiếu thu mới.",
        success: null,
      };
    }

    if (soTienThu === null || soTienThu <= 0)
      return { error: "Số tiền thu phải lớn hơn 0.", success: null };
    if (!RECEIPT_STATUSES.includes(trangThai))
      return { error: "Trạng thái phiếu thu không hợp lệ.", success: null };
    if (!PAYMENT_METHODS.includes(hinhThuc))
      return { error: "Hình thức thanh toán không hợp lệ.", success: null };

    const maHoaDon = currentReceipt.ma_hoa_don;
    if (!maHoaDon)
      return { error: "Phiếu thu chưa gắn hóa đơn.", success: null };

    if (trangThai === "Đã xác nhận") {
      const { rows: invoiceRows } = await getDbPool().query<{
        tong_tien: string | null;
        tien_phong: string | null;
        tien_dien_nuoc: string | null;
        tien_dich_vu_khac: string | null;
        no_cu: string | null;
      }>(
        `SELECT tong_tien::text AS tong_tien,
                tien_phong::text AS tien_phong,
                tien_dien_nuoc::text AS tien_dien_nuoc,
                tien_dich_vu_khac::text AS tien_dich_vu_khac,
                no_cu::text AS no_cu
         FROM public.hoa_don
         WHERE ma_hoa_don = $1 LIMIT 1`,
        [maHoaDon],
      );
      let total = Number(invoiceRows[0]?.tong_tien ?? 0);
      if (total <= 0) {
        total =
          Number(invoiceRows[0]?.tien_phong || 0) +
          Number(invoiceRows[0]?.tien_dien_nuoc || 0) +
          Number(invoiceRows[0]?.tien_dich_vu_khac || 0) +
          Number(invoiceRows[0]?.no_cu || 0);
      }

      const remaining = total - (await confirmedTotal(maHoaDon, maPhieuThu));
      if (soTienThu > remaining)
        return {
          error: `Số tiền thu (${soTienThu.toLocaleString("vi-VN")} đ) vượt quá số còn nợ (${remaining.toLocaleString("vi-VN")} đ).`,
          success: null,
        };
    }

    await getDbPool().query(
      `UPDATE public.phieu_thu
       SET so_tien_thu = $2, ngay_thu = $3, hinh_thuc = $4, ma_tra_cuu = $5,
           trang_thai = $6
       WHERE ma_phieu_thu = $1`,
      [
        maPhieuThu,
        soTienThu,
        text(formData, "ngayThu") || null,
        hinhThuc,
        text(formData, "maTraCuu") || null,
        trangThai,
      ],
    );

    await refreshInvoiceStatusByReceipt(maHoaDon);

    if (trangThai === "Đã xác nhận") {
      await notifyTenantPaymentConfirmed(maHoaDon, maPhieuThu, soTienThu, hinhThuc);
    }
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

/** Duyệt nhanh phiếu thu (1-click) */
export async function quickApproveReceipt(
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
    const { rows } = await getDbPool().query<{
      ma_hoa_don: string | null;
      so_tien_thu: string;
      hinh_thuc: string;
      trang_thai: string;
    }>(
      "SELECT ma_hoa_don, so_tien_thu::text, hinh_thuc, trang_thai FROM public.phieu_thu WHERE ma_phieu_thu = $1 LIMIT 1",
      [maPhieuThu],
    );
    if (rows.length === 0)
      return { error: "Không tìm thấy phiếu thu.", success: null };

    const pt = rows[0];
    if (pt.trang_thai === "Đã xác nhận" || pt.trang_thai === "Đã khớp lệnh") {
      return { error: null, success: "Phiếu thu đã được xác nhận trước đó." };
    }
    const maHoaDon = pt.ma_hoa_don;
    if (!maHoaDon)
      return { error: "Phiếu thu chưa gắn hóa đơn.", success: null };

    const { rows: invRows } = await getDbPool().query<{
      tong_tien: string | null;
      tien_phong: string | null;
      tien_dien_nuoc: string | null;
      tien_dich_vu_khac: string | null;
      no_cu: string | null;
    }>(
      `SELECT tong_tien::text AS tong_tien,
              tien_phong::text AS tien_phong,
              tien_dien_nuoc::text AS tien_dien_nuoc,
              tien_dich_vu_khac::text AS tien_dich_vu_khac,
              no_cu::text AS no_cu
       FROM public.hoa_don
       WHERE ma_hoa_don = $1 LIMIT 1`,
      [maHoaDon],
    );
    let total = Number(invRows[0]?.tong_tien ?? 0);
    if (total <= 0) {
      total =
        Number(invRows[0]?.tien_phong || 0) +
        Number(invRows[0]?.tien_dien_nuoc || 0) +
        Number(invRows[0]?.tien_dich_vu_khac || 0) +
        Number(invRows[0]?.no_cu || 0);
    }

    const paidAlready = await confirmedTotal(maHoaDon, maPhieuThu);
    const remaining = total - paidAlready;
    const soTien = Number(pt.so_tien_thu || 0);

    if (soTien > remaining) {
      return {
        error: `Số tiền phiếu thu (${soTien.toLocaleString("vi-VN")} đ) vượt quá số còn nợ (${remaining.toLocaleString("vi-VN")} đ).`,
        success: null,
      };
    }

    await getDbPool().query(
      "UPDATE public.phieu_thu SET trang_thai = 'Đã xác nhận' WHERE ma_phieu_thu = $1",
      [maPhieuThu],
    );
    await refreshInvoiceStatusByReceipt(maHoaDon);
    await notifyTenantPaymentConfirmed(maHoaDon, maPhieuThu, soTien, pt.hinh_thuc);
  } catch (err) {
    console.error("Approve receipt error:", err);
    return { error: "Không thể duyệt phiếu thu. Hãy thử lại.", success: null };
  }

  revalidatePath("/phieu-thu");
  revalidatePath("/hoa-don");
  return { error: null, success: "Đã duyệt xác nhận phiếu thu." };
}

/** Từ chối nhanh phiếu thu (1-click) */
export async function quickRejectReceipt(
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
      "UPDATE public.phieu_thu SET trang_thai = 'Từ chối' WHERE ma_phieu_thu = $1",
      [maPhieuThu],
    );
    if (maHoaDon) await refreshInvoiceStatusByReceipt(maHoaDon);
  } catch (err) {
    console.error("Reject receipt error:", err);
    return { error: "Không thể từ chối phiếu thu. Hãy thử lại.", success: null };
  }

  revalidatePath("/phieu-thu");
  revalidatePath("/hoa-don");
  return { error: null, success: "Đã từ chối phiếu thu." };
}

/** Xóa phiếu thu */
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
