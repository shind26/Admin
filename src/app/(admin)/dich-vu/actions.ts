"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { getCurrentAccount } from "@/lib/session";

export type ServiceFormState = { error: string | null; success: string | null };

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
 * Bảng giá dịch vụ là danh mục dùng chung cho toàn hệ thống,
 * nên chỉ tài khoản toàn quyền (Admin) được sửa; quản lý tòa chỉ xem.
 */
async function requireAdmin(): Promise<string | null> {
  const account = await getCurrentAccount();
  if (!account) return "Phiên đăng nhập đã hết hạn.";
  if (account.vai_tro !== "Admin")
    return "Chỉ tài khoản Admin mới được sửa bảng giá dịch vụ.";
  return null;
}

/** Thêm dịch vụ mới vào bảng dich_vu. */
export async function createService(
  _previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied, success: null };

  const tenDichVu = text(formData, "tenDichVu");
  const donViTinh = text(formData, "donViTinh");
  const donGia = money(formData, "donGia");

  if (!tenDichVu) return { error: "Vui lòng nhập tên dịch vụ.", success: null };
  if (!donViTinh) return { error: "Vui lòng nhập đơn vị tính.", success: null };
  if (donGia === null || donGia < 0)
    return { error: "Đơn giá phải là số không âm.", success: null };

  try {
    const { rows } = await getDbPool().query<{ exists: number }>(
      `SELECT 1 AS exists FROM public.dich_vu
       WHERE LOWER(ten_dich_vu) = LOWER($1) LIMIT 1`,
      [tenDichVu],
    );
    if (rows.length > 0)
      return { error: "Dịch vụ này đã tồn tại.", success: null };

    await getDbPool().query(
      `INSERT INTO public.dich_vu (ma_dich_vu, ten_dich_vu, don_gia, don_vi_tinh, ghi_chu)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        "DV" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
        tenDichVu,
        donGia,
        donViTinh,
        text(formData, "ghiChu") || null,
      ],
    );
  } catch {
    return { error: "Không thể lưu dịch vụ. Hãy thử lại.", success: null };
  }

  revalidatePath("/dich-vu");
  return { error: null, success: "Thêm dịch vụ thành công." };
}

/** Cập nhật dịch vụ. */
export async function updateService(
  _previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied, success: null };

  const maDichVu = text(formData, "maDichVu");
  const tenDichVu = text(formData, "tenDichVu");
  const donViTinh = text(formData, "donViTinh");
  const donGia = money(formData, "donGia");

  if (!maDichVu) return { error: "Thiếu mã dịch vụ.", success: null };
  if (!tenDichVu) return { error: "Vui lòng nhập tên dịch vụ.", success: null };
  if (!donViTinh) return { error: "Vui lòng nhập đơn vị tính.", success: null };
  if (donGia === null || donGia < 0)
    return { error: "Đơn giá phải là số không âm.", success: null };

  try {
    const { rows } = await getDbPool().query<{ exists: number }>(
      `SELECT 1 AS exists FROM public.dich_vu
       WHERE LOWER(ten_dich_vu) = LOWER($1) AND ma_dich_vu <> $2 LIMIT 1`,
      [tenDichVu, maDichVu],
    );
    if (rows.length > 0)
      return { error: "Tên dịch vụ này đã được dùng.", success: null };

    const { rowCount } = await getDbPool().query(
      `UPDATE public.dich_vu
       SET ten_dich_vu = $2, don_gia = $3, don_vi_tinh = $4, ghi_chu = $5
       WHERE ma_dich_vu = $1`,
      [
        maDichVu,
        tenDichVu,
        donGia,
        donViTinh,
        text(formData, "ghiChu") || null,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy dịch vụ.", success: null };
  } catch {
    return { error: "Không thể cập nhật dịch vụ. Hãy thử lại.", success: null };
  }

  revalidatePath("/dich-vu");
  return { error: null, success: "Cập nhật dịch vụ thành công." };
}

/** Xóa dịch vụ (chặn khi đã áp dụng vào chi tiết hóa đơn/kỳ chỉ số). */
export async function deleteService(
  _previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied, success: null };

  const maDichVu = text(formData, "maDichVu");
  if (!maDichVu) return { error: "Thiếu mã dịch vụ.", success: null };

  try {
    const { rows } = await getDbPool().query<{ used: number }>(
      `SELECT EXISTS(
         SELECT 1 FROM public.chi_tiet_dich_vu WHERE ma_dich_vu = $1
       )::int AS used`,
      [maDichVu],
    );
    if ((rows[0]?.used ?? 0) === 1) {
      return {
        error: "Không thể xóa dịch vụ đã áp dụng cho kỳ chỉ số của phòng.",
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      "DELETE FROM public.dich_vu WHERE ma_dich_vu = $1",
      [maDichVu],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy dịch vụ.", success: null };
  } catch {
    return { error: "Không thể xóa dịch vụ. Hãy thử lại.", success: null };
  }

  revalidatePath("/dich-vu");
  return { error: null, success: "Đã xóa dịch vụ." };
}
