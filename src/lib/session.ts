import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDbPool } from "@/lib/db";
export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE = 4 * 60 * 60; // 4 giờ, tương ứng IdleTimeout của SupabaseApp.

export type AccountRow = {
  ma_tai_khoan: string;
  ten_dang_nhap: string | null;
  vai_tro: string | null;
  co_so_van_hanh: string | null;
  ho_ten: string | null;
  phai_doi_mat_khau: boolean | null;
};

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Tạo token phiên dạng `maTaiKhoan.hethan.chuky` đã ký HMAC. */
export function createSessionToken(accountId: string): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const payload = `${accountId}.${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${sign(payload, secret)}`;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Đọc cookie phiên, xác thực chữ ký rồi nạp lại tài khoản đang hoạt động từ Supabase. */
export async function getCurrentAccount(): Promise<AccountRow | null> {
  // Session data depends on the incoming request, so render it at request time.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return null;

  const signatureAt = token.lastIndexOf(".");
  if (signatureAt < 0) return null;
  const payload = token.slice(0, signatureAt);
  const signature = token.slice(signatureAt + 1);
  const expected = sign(payload, secret);
  if (
    !/^[a-f0-9]{64}$/.test(signature) ||
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    )
  ) {
    return null;
  }

  const expiresAt = payload.lastIndexOf(".");
  if (expiresAt < 0) return null;
  const accountId = payload.slice(0, expiresAt);
  const expires = Number(payload.slice(expiresAt + 1));
  if (!accountId || !Number.isSafeInteger(expires) || expires < Date.now())
    return null;

  const { rows } = await getDbPool().query<AccountRow>(
    `SELECT ma_tai_khoan, ten_dang_nhap, vai_tro, co_so_van_hanh, ho_ten, phai_doi_mat_khau
     FROM public.tai_khoan
     WHERE ma_tai_khoan = $1 AND vai_tro IN ('Admin', 'QuanLy') AND trang_thai = 'HoatDong'
     LIMIT 1`,
    [accountId],
  );
  return rows[0] ?? null;
}

/** Dùng trong Server Component: chưa đăng nhập thì về /login, chưa đổi mật khẩu lần đầu thì sang trang bắt buộc. */
export async function requireAccount(): Promise<AccountRow> {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.phai_doi_mat_khau ?? true) redirect("/doi-mat-khau-lan-dau");
  return account;
}

export type AccessScope = {
  /** true = toàn quyền (quản trị viên), false = chỉ trong một tòa. */
  allBuildings: boolean;
  /** Tên tòa được gán; null khi toàn quyền. */
  building: string | null;
};

/**
 * Phạm vi dữ liệu theo quy ước `co_so_van_hanh`:
 * vai trò Admin hoặc giá trị NULL = toàn quyền, ngược lại là quản lý đúng một tòa.
 */
export function getAccessScope(account: AccountRow): AccessScope {
  const building = account.co_so_van_hanh?.trim() || null;
  const allBuildings = account.vai_tro === "Admin" || building === null;
  return { allBuildings, building: allBuildings ? null : building };
}

/** Phạm vi của tài khoản đang đăng nhập, kèm chặn truy cập. */
export async function requireScope(): Promise<{ account: AccountRow; scope: AccessScope }> {
  const account = await requireAccount();
  return { account, scope: getAccessScope(account) };
}
