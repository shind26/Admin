"use server";

import type { PoolClient } from "pg";
import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { getCurrentAccount, requireScope, type AccessScope } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { receiptStatus } from "@/lib/business-status";

export type ReceiptFormState = { error: string | null; success: string | null };
const PAID = ["Đã xác nhận", "Đã khớp lệnh", "Đã thanh toán"];
const STATUSES = [...PAID, "Chờ xác nhận", "Đã hủy"];
const METHODS = ["Tiền mặt", "Chuyển khoản", "VietQR", "Cổng VNPAY", "VNPAY"];
class ReceiptInputError extends Error {}
type Invoice = { ma_hoa_don: string; tong_tien: string; tien_phong: string; tien_dien_nuoc: string; tien_dich_vu_khac: string; no_cu: string };
type Receipt = { ma_phieu_thu: string; ma_hoa_don: string; so_tien_thu: string; hinh_thuc: string; trang_thai: string; ngay_thu: string; ma_tra_cuu: string };

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function payment(form: FormData) {
  const raw = text(form, "soTienThu");
  const amount = raw ? Number(raw.replace(/,/g, ".")) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) throw new ReceiptInputError("Số tiền thu phải lớn hơn 0.");
  const method = text(form, "hinhThuc") || "Chuyển khoản";
  const status = receiptStatus(text(form, "trangThai") || "Đã xác nhận");
  if (!METHODS.includes(method) || !STATUSES.includes(status)) throw new ReceiptInputError("Hình thức hoặc trạng thái thanh toán không hợp lệ.");
  return { amount, method, status };
}

async function lockInvoice(client: PoolClient, id: string, scope: AccessScope): Promise<Invoice> {
  const { rows } = await client.query<Invoice>(
    `SELECT hd.* FROM public.hoa_don hd LEFT JOIN public.hop_dong c ON c.ma_hop_dong=hd.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong=c.ma_phong
     WHERE hd.ma_hoa_don=$1 AND ($2::boolean OR p.toa_nha=$3) FOR UPDATE OF hd`, [id, scope.allBuildings, scope.building],
  );
  if (!rows[0]) throw new ReceiptInputError("Không tìm thấy hóa đơn trong cơ sở được phép.");
  return rows[0];
}

async function lockReceipt(client: PoolClient, id: string, scope: AccessScope): Promise<Receipt> {
  const { rows } = await client.query<Receipt>(
    `SELECT pt.* FROM public.phieu_thu pt JOIN public.hoa_don hd ON hd.ma_hoa_don=pt.ma_hoa_don
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong=hd.ma_hop_dong LEFT JOIN public.phong p ON p.ma_phong=c.ma_phong
     WHERE pt.ma_phieu_thu=$1 AND ($2::boolean OR p.toa_nha=$3) FOR UPDATE OF pt`, [id, scope.allBuildings, scope.building],
  );
  if (!rows[0]) throw new ReceiptInputError("Không tìm thấy phiếu thu trong cơ sở được phép.");
  return rows[0];
}

function invoiceTotal(invoice: Invoice): number {
  return Number(invoice.tong_tien) || Number(invoice.tien_phong || 0) + Number(invoice.tien_dien_nuoc || 0) + Number(invoice.tien_dich_vu_khac || 0) + Number(invoice.no_cu || 0);
}

async function confirmedTotal(client: PoolClient, id: string, except?: string): Promise<number> {
  const { rows } = await client.query<{ paid: string }>(
    `SELECT COALESCE(SUM(so_tien_thu),0)::text AS paid FROM public.phieu_thu
     WHERE ma_hoa_don=$1 AND trang_thai IN ('Đã xác nhận','Đã khớp lệnh','Đã thanh toán')
     AND ($2::text IS NULL OR ma_phieu_thu<>$2)`, [id, except ?? null],
  );
  return Number(rows[0].paid);
}

async function checkBalance(client: PoolClient, invoice: Invoice, amount: number, status: string, except?: string) {
  if (!PAID.includes(status)) return;
  const remaining = invoiceTotal(invoice) - await confirmedTotal(client, invoice.ma_hoa_don, except);
  if (amount > remaining) throw new ReceiptInputError(`Số tiền thu vượt quá số còn nợ (${remaining.toLocaleString("vi-VN")} đ).`);
}

async function refreshInvoice(client: PoolClient, invoice: Invoice) {
  const paid = await confirmedTotal(client, invoice.ma_hoa_don);
  const status = paid <= 0 ? "Chưa thanh toán" : paid >= invoiceTotal(invoice) ? "Đã thanh toán" : "Thanh toán một phần";
  await client.query("UPDATE public.hoa_don SET trang_thai=$2 WHERE ma_hoa_don=$1", [invoice.ma_hoa_don, status]);
}

async function notifyPayment(client: PoolClient, invoiceId: string, receiptId: string, amount: number, method: string) {
  const { rows } = await client.query<{ ma_tai_khoan: string | null; ma_phong: string; toa_nha: string | null }>(
    `SELECT k.ma_tai_khoan,c.ma_phong,p.toa_nha FROM public.hoa_don hd JOIN public.hop_dong c ON c.ma_hop_dong=hd.ma_hop_dong
     JOIN public.phong p ON p.ma_phong=c.ma_phong JOIN public.khach_thue k ON k.ma_khach=c.ma_khach_dai_dien WHERE hd.ma_hoa_don=$1`, [invoiceId],
  );
  if (!rows[0]?.ma_tai_khoan) return;
  await createNotification({ maTaiKhoan: rows[0].ma_tai_khoan, maPhong: rows[0].ma_phong, toaNha: rows[0].toa_nha,
    tieuDe: "Xác nhận thanh toán thành công", noiDung: `Ban quản lý đã xác nhận phiếu thu ${receiptId}: ${amount.toLocaleString("vi-VN")} đ (${method}).`,
    loaiThongBao: "HoaDon", duLieuDinhKem: { ma_phieu_thu: receiptId, ma_hoa_don: invoiceId, so_tien_thu: amount },
  }, client);
}

async function transaction(operation: (client: PoolClient, scope: AccessScope) => Promise<string>): Promise<ReceiptFormState> {
  if (!await getCurrentAccount()) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();
  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");
    const success = await operation(client, scope);
    await client.query("COMMIT");
    revalidatePath("/phieu-thu"); revalidatePath("/hoa-don"); revalidatePath("/");
    return { error: null, success };
  } catch (error) {
    await client.query("ROLLBACK");
    if (!(error instanceof ReceiptInputError)) console.error("Receipt transaction:", error);
    return { error: error instanceof ReceiptInputError ? error.message : "Không thể lưu phiếu thu. Vui lòng thử lại.", success: null };
  } finally { client.release(); }
}

export async function createReceipt(_previous: ReceiptFormState, form: FormData): Promise<ReceiptFormState> {
  return transaction(async (client, scope) => {
    const { amount, method, status } = payment(form);
    const invoice = await lockInvoice(client, text(form,"maHoaDon"), scope);
    await checkBalance(client, invoice, amount, status);
    const id = "PT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await client.query(
      `INSERT INTO public.phieu_thu (ma_phieu_thu,ma_hoa_don,so_tien_thu,ngay_thu,hinh_thuc,ma_tra_cuu,trang_thai) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, invoice.ma_hoa_don, amount, text(form,"ngayThu") || new Date().toISOString(), method, text(form,"maTraCuu") || id, status],
    );
    await refreshInvoice(client, invoice);
    if (PAID.includes(status)) await notifyPayment(client, invoice.ma_hoa_don, id, amount, method);
    return "Ghi nhận phiếu thu thành công.";
  });
}

export async function updateReceipt(_previous: ReceiptFormState, form: FormData): Promise<ReceiptFormState> {
  return transaction(async (client, scope) => {
    const receipt = await lockReceipt(client, text(form,"maPhieuThu"), scope);
    if (PAID.includes(receipt.trang_thai)) throw new ReceiptInputError("Phiếu thu đã được xác nhận không thể chỉnh sửa. Hãy xóa và tạo lại nếu có sai sót.");
    const { amount, method, status } = payment(form);
    const invoice = await lockInvoice(client, receipt.ma_hoa_don, scope);
    await checkBalance(client, invoice, amount, status, receipt.ma_phieu_thu);
    await client.query("UPDATE public.phieu_thu SET so_tien_thu=$2,ngay_thu=$3,hinh_thuc=$4,ma_tra_cuu=$5,trang_thai=$6 WHERE ma_phieu_thu=$1",
      [receipt.ma_phieu_thu, amount, text(form,"ngayThu") || receipt.ngay_thu, method, text(form,"maTraCuu") || receipt.ma_tra_cuu || receipt.ma_phieu_thu, status]);
    await refreshInvoice(client, invoice);
    if (PAID.includes(status)) await notifyPayment(client, invoice.ma_hoa_don, receipt.ma_phieu_thu, amount, method);
    return "Cập nhật phiếu thu thành công.";
  });
}

export async function quickApproveReceipt(_previous: ReceiptFormState, form: FormData): Promise<ReceiptFormState> {
  return transaction(async (client, scope) => {
    const receipt = await lockReceipt(client, text(form,"maPhieuThu"), scope);
    if (PAID.includes(receipt.trang_thai)) return "Phiếu thu đã được xác nhận trước đó.";
    if (receipt.trang_thai !== "Chờ xác nhận") throw new ReceiptInputError("Chỉ được duyệt phiếu đang chờ xác nhận.");
    const invoice = await lockInvoice(client, receipt.ma_hoa_don, scope);
    await checkBalance(client, invoice, Number(receipt.so_tien_thu), "Đã xác nhận", receipt.ma_phieu_thu);
    await client.query("UPDATE public.phieu_thu SET trang_thai='Đã xác nhận' WHERE ma_phieu_thu=$1", [receipt.ma_phieu_thu]);
    await refreshInvoice(client, invoice);
    await notifyPayment(client, invoice.ma_hoa_don, receipt.ma_phieu_thu, Number(receipt.so_tien_thu), receipt.hinh_thuc);
    return "Đã duyệt xác nhận phiếu thu.";
  });
}

export async function quickRejectReceipt(_previous: ReceiptFormState, form: FormData): Promise<ReceiptFormState> {
  return transaction(async (client, scope) => {
    const receipt = await lockReceipt(client, text(form,"maPhieuThu"), scope);
    if (receipt.trang_thai !== "Chờ xác nhận") throw new ReceiptInputError("Chỉ được từ chối phiếu đang chờ xác nhận.");
    const invoice = await lockInvoice(client, receipt.ma_hoa_don, scope);
    await client.query("UPDATE public.phieu_thu SET trang_thai='Đã hủy' WHERE ma_phieu_thu=$1", [receipt.ma_phieu_thu]);
    await refreshInvoice(client, invoice);
    return "Đã từ chối phiếu thu.";
  });
}

export async function deleteReceipt(_previous: ReceiptFormState, form: FormData): Promise<ReceiptFormState> {
  return transaction(async (client, scope) => {
    const receipt = await lockReceipt(client, text(form,"maPhieuThu"), scope);
    const invoice = await lockInvoice(client, receipt.ma_hoa_don, scope);
    await client.query("DELETE FROM public.phieu_thu WHERE ma_phieu_thu=$1", [receipt.ma_phieu_thu]);
    await refreshInvoice(client, invoice);
    return "Đã xóa phiếu thu.";
  });
}
