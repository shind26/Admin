import "server-only";
import type { PoolClient } from "pg";
import { DEFAULT_CUSTOMER_PASSWORD, hashPassword } from "@/lib/password";

/** Chỉ tài khoản cư dân được liên kết hoặc đặt lại qua nghiệp vụ thuê phòng. */
export async function ensureResidentAccount(
  client: PoolClient,
  tenant: { accountId?: string | null; phone: string; name: string; building: string | null },
  resetPassword = false,
): Promise<{ accountId: string; tempPassword: string | null }> {
  const { rows } = await client.query<{ ma_tai_khoan: string; vai_tro: string }>(
    `SELECT ma_tai_khoan, vai_tro FROM public.tai_khoan
     WHERE ($1::text IS NOT NULL AND ma_tai_khoan = $1) OR ten_dang_nhap = $2
     ORDER BY (ma_tai_khoan = $1) DESC NULLS LAST LIMIT 1 FOR UPDATE`,
    [tenant.accountId ?? null, tenant.phone],
  );
  const existing = rows[0];
  if (existing && existing.vai_tro !== "KhachThue") {
    throw new Error("Số điện thoại hoặc tài khoản đã được dùng cho nhân viên.");
  }
  const accountId = existing?.ma_tai_khoan ?? "TK" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const tempPassword = !existing || resetPassword ? DEFAULT_CUSTOMER_PASSWORD : null;
  if (!existing) {
    await client.query(
      `INSERT INTO public.tai_khoan
       (ma_tai_khoan, ten_dang_nhap, mat_khau, vai_tro, co_so_van_hanh, trang_thai, da_doi_mat_khau, ho_ten)
       VALUES ($1, $2, $3, 'KhachThue', $4, 'HoatDong', false, $5)`,
      [accountId, tenant.phone, await hashPassword(tempPassword!), tenant.building, tenant.name],
    );
  } else if (resetPassword) {
    await client.query(
      `UPDATE public.tai_khoan SET mat_khau = $2, da_doi_mat_khau = false,
       co_so_van_hanh = $3, trang_thai = 'HoatDong' WHERE ma_tai_khoan = $1`,
      [accountId, await hashPassword(tempPassword!), tenant.building],
    );
  } else {
    await client.query("UPDATE public.tai_khoan SET co_so_van_hanh = $2 WHERE ma_tai_khoan = $1", [accountId, tenant.building]);
  }
  return { accountId, tempPassword };
}
