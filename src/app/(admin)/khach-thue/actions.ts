"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type TenantFormState = { error: string | null; success: string | null };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function newId(prefix: string) {
  return (
    prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
}

/** Kiểm tra CCCD trùng, tương ứng TenantController.ValidateUniqueFields. */
async function cccdTaken(cccd: string, exceptId?: string) {
  const { rows } = await getDbPool().query<{ exists: number }>(
    `SELECT 1 AS exists FROM public.khach_thue
     WHERE cccd = $1 AND ($2::text IS NULL OR ma_khach <> $2) LIMIT 1`,
    [cccd, exceptId ?? null],
  );
  return rows.length > 0;
}

/** Thêm khách thuê theo TenantController.Create. */
export async function createTenant(
  _previous: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  const hoTen = text(formData, "hoTenKhach");
  const soDt = text(formData, "soDt");
  const cccd = text(formData, "cccd");
  const diaChi = text(formData, "diaChiThuongTru");

  if (!hoTen || !soDt || !cccd || !diaChi) {
    return {
      error: "Vui lòng nhập đầy đủ họ tên, số điện thoại, CCCD và địa chỉ.",
      success: null,
    };
  }

  try {
    if (await cccdTaken(cccd)) {
      return { error: "CCCD đã được đăng ký.", success: null };
    }
    await getDbPool().query(
      `INSERT INTO public.khach_thue (ma_khach, ho_ten_khach, so_dt, cccd, dia_chi_thuong_tru, ma_tai_khoan)
       VALUES ($1,$2,$3,$4,$5,NULL)`,
      [newId("KH"), hoTen, soDt, cccd, diaChi],
    );  } catch {
    return {
      error:
        "Không thể lưu khách thuê. Kiểm tra ràng buộc dữ liệu trong Supabase.",
      success: null,
    };
  }

  revalidatePath("/khach-thue");
  return { error: null, success: "Thêm khách thuê thành công." };
}

/** Cập nhật khách thuê theo TenantController.Edit. */
export async function updateTenant(
  _previous: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maKhach = text(formData, "maKhach");
  const hoTen = text(formData, "hoTenKhach");
  const soDt = text(formData, "soDt");
  const cccd = text(formData, "cccd");
  const diaChi = text(formData, "diaChiThuongTru");

  if (!maKhach) return { error: "Thiếu mã khách thuê.", success: null };
  if (!hoTen || !soDt || !cccd || !diaChi) {
    return {
      error: "Vui lòng nhập đầy đủ họ tên, số điện thoại, CCCD và địa chỉ.",
      success: null,
    };
  }

  try {
    if (await cccdTaken(cccd, maKhach)) {
      return { error: "CCCD đã được đăng ký.", success: null };
    }
    // Quản lý tòa chỉ sửa được khách thuộc tòa mình.
    const { rowCount } = await getDbPool().query(
      `UPDATE public.khach_thue
       SET ho_ten_khach = $2, so_dt = $3, cccd = $4, dia_chi_thuong_tru = $5
       WHERE ma_khach = $1
         AND ($6::text IS NULL OR EXISTS (
           SELECT 1 FROM public.hop_dong hd
           JOIN public.phong p ON p.ma_phong = hd.ma_phong
           WHERE hd.ma_khach_dai_dien = public.khach_thue.ma_khach AND p.toa_nha = $6
         ))`,
      [maKhach, hoTen, soDt, cccd, diaChi, scope.allBuildings ? null : scope.building],
    );
    if (rowCount === 0) return { error: "Không tìm thấy khách thuê.", success: null };
  } catch {
    return {
      error: "Không thể cập nhật khách thuê. Hãy thử lại.",
      success: null,
    };
  }

  revalidatePath("/khach-thue");
  return { error: null, success: "Cập nhật khách thuê thành công." };
}

/** Xóa khách thuê theo TenantController.Delete (chặn khi có dữ liệu liên quan). */
export async function deleteTenant(
  _previous: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maKhach = text(formData, "maKhach");
  if (!maKhach) return { error: "Thiếu mã khách thuê.", success: null };

  try {
    const { rows } = await getDbPool().query<{ related: number }>(
      `SELECT (
         EXISTS(SELECT 1 FROM public.hop_dong WHERE ma_khach_dai_dien = $1)
         OR EXISTS(SELECT 1 FROM public.su_co_bao_tri WHERE ma_khach_bao = $1)
         OR EXISTS(SELECT 1 FROM public.dang_ky_khach_qua_dem WHERE ma_khach_dang_ky = $1)
         OR EXISTS(SELECT 1 FROM public.chi_tiet_hop_dong_khach_thue WHERE ma_khach = $1)
         OR EXISTS(SELECT 1 FROM public.giu_cho WHERE ma_khach = $1)
       )::int AS related`,
      [maKhach],
    );
    if ((rows[0]?.related ?? 0) === 1) {
      return {
        error:
          "Không thể xóa khách đã có hợp đồng, sự cố hoặc đăng ký lưu trú.",
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      `DELETE FROM public.khach_thue
       WHERE ma_khach = $1
         AND ($2::text IS NULL OR EXISTS (
           SELECT 1 FROM public.hop_dong hd
           JOIN public.phong p ON p.ma_phong = hd.ma_phong
           WHERE hd.ma_khach_dai_dien = public.khach_thue.ma_khach AND p.toa_nha = $2
         ))`,
      [maKhach, scope.allBuildings ? null : scope.building],
    );
    if (rowCount === 0) return { error: "Không tìm thấy khách thuê.", success: null };
  } catch {
    return { error: "Không thể xóa khách thuê. Hãy thử lại.", success: null };
  }

  revalidatePath("/khach-thue");
  return { error: null, success: "Đã xóa hồ sơ khách thuê." };
}
