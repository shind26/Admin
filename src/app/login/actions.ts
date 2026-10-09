"use server";

import { redirect } from "next/navigation";
import { getDbPool } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, getCurrentAccount, setSessionCookie } from "@/lib/session";

export type LoginState = { error: string | null };

type LoginRow = {
  ma_tai_khoan: string;
  mat_khau: string | null;
  vai_tro: string | null;
};

/**
 * Đăng nhập theo luồng SupabaseApp/AccountController:
 * tìm theo tên đăng nhập HOẶC mã tài khoản, tài khoản phải HoatDong,
 * chỉ vai trò Admin/QuanLy được vào cổng quản trị.
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

  try {
    const { rows } = await getDbPool().query<LoginRow>(
      `SELECT ma_tai_khoan, mat_khau, vai_tro
       FROM public.tai_khoan
       WHERE (ten_dang_nhap = $1 OR ma_tai_khoan = $1) AND trang_thai = 'HoatDong'
       LIMIT 1`,
      [username],
    );
    const account = rows[0];

    if (!account) {
      return { error: "Tên đăng nhập không tồn tại hoặc tài khoản đã bị khóa!" };
    }
    if (!(await verifyPassword(password, account.mat_khau))) {
      return { error: "Mật khẩu không chính xác!" };
    }
    if (account.vai_tro !== "Admin" && account.vai_tro !== "QuanLy") {
      return { error: "Tài khoản của bạn không có quyền truy cập Cổng quản trị!" };
    }

    const token = createSessionToken(account.ma_tai_khoan);
    if (!token) {
      return { error: "Hệ thống chưa được cấu hình khóa phiên. Vui lòng liên hệ quản trị viên!" };
    }
    await setSessionCookie(token);
  } catch {
    return { error: "Không thể kết nối đến cơ sở dữ liệu Supabase. Vui lòng thử lại sau!" };
  }

  // Lần đầu đăng nhập: bắt buộc đổi mật khẩu.
  const account = await getCurrentAccount();
  redirect(account?.phai_doi_mat_khau ?? true ? "/doi-mat-khau-lan-dau" : "/");
}

/** Đăng xuất: xóa phiên và quay về trang đăng nhập. */
export async function logout() {
  const { clearSessionCookie } = await import("@/lib/session");
  await clearSessionCookie();
  redirect("/login");
}
