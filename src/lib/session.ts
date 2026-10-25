import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDbPool } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken as makeToken,
  verifySessionToken,
  computePasswordStamp,
} from "@/lib/session-token";

export { SESSION_COOKIE, SESSION_MAX_AGE };

export type AccountRow = {
  ma_tai_khoan: string;
  ten_dang_nhap: string | null;
  vai_tro: string | null;
  co_so_van_hanh: string | null;
  ho_ten: string | null;
  da_doi_mat_khau: boolean | null;
};

type DbAccountRow = AccountRow & {
  mat_khau: string | null;
};

/**
 * Tạo token phiên dạng `maTaiKhoan.stamp.hethan.chuky` đã ký HMAC.
 * `passwordHash` được dùng để tạo Security Stamp: nếu mật khẩu trong DB đổi, token cũ sẽ mất hiệu lực.
 */
export function createSessionToken(
  accountId: string,
  passwordHash?: string | null,
): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return makeToken(accountId, secret, passwordHash);
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

/**
 * Đọc cookie phiên, xác thực chữ ký HMAC và kiểm tra Security Stamp so với DB:
 * 1. Chữ ký HMAC phải hợp lệ và chưa hết hạn.
 * 2. Tài khoản phải ở trạng thái HoatDong và có vai trò Admin / QuanLy.
 * 3. Nếu token có stamp, mật khẩu hiện tại trong DB phải khớp stamp (thu hồi tức thì nếu đổi mật khẩu).
 */
export async function getCurrentAccount(): Promise<AccountRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const parsed = verifySessionToken(token, secret);
  if (!parsed) return null;

  const { rows } = await getDbPool().query<DbAccountRow>(
    `SELECT ma_tai_khoan, ten_dang_nhap, vai_tro, co_so_van_hanh, ho_ten, da_doi_mat_khau, mat_khau
     FROM public.tai_khoan
     WHERE ma_tai_khoan = $1 AND vai_tro IN ('Admin', 'QuanLy') AND trang_thai = 'HoatDong'
     LIMIT 1`,
    [parsed.accountId],
  );
  const account = rows[0];
  if (!account) return null;

  // Kiểm tra Security Stamp để vô hiệu hóa phiên cũ nếu người dùng đã đổi mật khẩu
  if (parsed.stamp && parsed.stamp !== "none") {
    const currentStamp = computePasswordStamp(account.mat_khau);
    if (parsed.stamp !== currentStamp) {
      return null;
    }
  }

  return {
    ma_tai_khoan: account.ma_tai_khoan,
    ten_dang_nhap: account.ten_dang_nhap,
    vai_tro: account.vai_tro,
    co_so_van_hanh: account.co_so_van_hanh,
    ho_ten: account.ho_ten,
    da_doi_mat_khau: account.da_doi_mat_khau,
  };
}

/** Dùng trong Server Component: chưa đăng nhập thì về /login, chưa đổi mật khẩu lần đầu thì sang trang bắt buộc. */
export async function requireAccount(): Promise<AccountRow> {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.da_doi_mat_khau) redirect("/doi-mat-khau-lan-dau");
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
