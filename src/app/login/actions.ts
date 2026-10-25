"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDbPool } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from "@/lib/rate-limit";
import {
  createSessionToken,
  getCurrentAccount,
  setSessionCookie,
} from "@/lib/session";

export type LoginState = { error: string | null };

type LoginRow = {
  ma_tai_khoan: string;
  mat_khau: string | null;
  vai_tro: string | null;
  da_doi_mat_khau: boolean | null;
};

/**
 * Đăng nhập an toàn theo quy chuẩn OWASP & SupabaseApp:
 * 1. Chống Brute-force & Password spraying qua Rate Limiter (IP + Username).
 * 2. Chống User Enumeration: dùng thông điệp đồng nhất khi sai tài khoản hoặc mật khẩu.
 * 3. Tự động nâng cấp hash mật khẩu cũ sang BCrypt (Transparent Rehash).
 * 4. Cấp token phiên kèm Security Stamp chống rò rỉ phiên sau đổi mật khẩu.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawUsername = formData.get("username");
  const password = formData.get("password");

  if (
    typeof rawUsername !== "string" || typeof password !== "string" ||
    !rawUsername.trim() || !password || rawUsername.length > 150 || password.length > 1024
  ) {
    return { error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!" };
  }

  const username = rawUsername.trim();

  // Đọc IP máy khách để giới hạn tần suất
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const realIp = headerList.get("x-real-ip");
  const clientIp = (forwarded ? forwarded.split(",")[0].trim() : realIp) || "127.0.0.1";

  const ipKey = `ip:${clientIp}`;
  const userKey = `user:${username.toLowerCase()}`;

  // Kiểm tra khóa tạm thời do nhập sai quá số lần
  const ipCheck = checkLoginRateLimit(ipKey);
  if (!ipCheck.allowed) {
    const minutes = Math.ceil(ipCheck.retryAfterSeconds / 60);
    return {
      error: `Thiết bị này đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút!`,
    };
  }

  const userCheck = checkLoginRateLimit(userKey);
  if (!userCheck.allowed) {
    const minutes = Math.ceil(userCheck.retryAfterSeconds / 60);
    return {
      error: `Tài khoản này đang tạm khóa đăng nhập do thử sai nhiều lần. Vui lòng thử lại sau ${minutes} phút!`,
    };
  }

  let mustChangePassword = true;

  try {
    const { rows } = await getDbPool().query<LoginRow>(
      `SELECT ma_tai_khoan, mat_khau, vai_tro, da_doi_mat_khau
       FROM public.tai_khoan
       WHERE (ten_dang_nhap = $1 OR ma_tai_khoan = $1) AND trang_thai = 'HoatDong'
       LIMIT 1`,
      [username],
    );
    const account = rows[0];

    // Không phân biệt tài khoản không tồn tại vs sai mật khẩu để chống User Enumeration
    if (!account) {
      recordFailedLogin(ipKey, 30);
      const fail = recordFailedLogin(userKey, 5);
      if (fail.blocked) {
        return {
          error: "Bạn đã thử sai quá 5 lần. Tài khoản tạm khóa đăng nhập trong 5 phút!",
        };
      }
      return { error: "Tên đăng nhập hoặc mật khẩu không chính xác!" };
    }

    const isMatch = await verifyPassword(password, account.mat_khau);
    if (!isMatch) {
      recordFailedLogin(ipKey, 30);
      const fail = recordFailedLogin(userKey, 5);
      if (fail.blocked) {
        return {
          error: "Bạn đã nhập sai mật khẩu quá 5 lần. Tài khoản tạm khóa đăng nhập trong 5 phút!",
        };
      }
      const attemptsMsg = fail.attemptsLeft > 0 ? ` (còn ${fail.attemptsLeft} lần thử)` : "";
      return { error: `Tên đăng nhập hoặc mật khẩu không chính xác!${attemptsMsg}` };
    }

    if (account.vai_tro !== "Admin" && account.vai_tro !== "QuanLy") {
      return { error: "Tài khoản của bạn không có quyền truy cập Cổng quản trị!" };
    }

    // Đăng nhập thành công -> Reset bộ đếm thử sai
    resetLoginRateLimit(ipKey);
    resetLoginRateLimit(userKey);

    // Transparent Rehash: Tự động nâng cấp mật khẩu cũ (PBKDF2 hoặc plain text) sang BCrypt
    if (account.mat_khau && !account.mat_khau.startsWith("$2")) {
      try {
        const upgradedHash = await hashPassword(password);
        await getDbPool().query(
          "UPDATE public.tai_khoan SET mat_khau = $1 WHERE ma_tai_khoan = $2",
          [upgradedHash, account.ma_tai_khoan],
        );
        account.mat_khau = upgradedHash;
      } catch {
        // Rehash thất bại không chặn luồng đăng nhập của người dùng
      }
    }

    // Cấp token có kèm Security Stamp của mật khẩu hiện tại
    const token = createSessionToken(account.ma_tai_khoan, account.mat_khau);
    if (!token) {
      return { error: "Hệ thống chưa được cấu hình khóa phiên. Vui lòng liên hệ quản trị viên!" };
    }
    await setSessionCookie(token);
    mustChangePassword = !account.da_doi_mat_khau;
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    return { error: "Không thể kết nối đến cơ sở dữ liệu Supabase. Vui lòng thử lại sau!" };
  }

  // Chuyển hướng theo trạng thái đổi mật khẩu
  redirect(mustChangePassword ? "/doi-mat-khau-lan-dau" : "/");
}

/** Đăng xuất: xóa phiên và quay về trang đăng nhập. */
export async function logout() {
  const { clearSessionCookie } = await import("@/lib/session");
  await clearSessionCookie();
  redirect("/login");
}
