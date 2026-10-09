"use server";

import { redirect } from "next/navigation";
import { getDbPool } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getCurrentAccount } from "@/lib/session";

export type PasswordState = { error: string | null; success: string | null };

/**
 * Xác thực và lưu mật khẩu mới, dùng chung quy tắc của SupabaseApp/AccountController.
 * Trả về lỗi dạng chuỗi, hoặc null khi đã lưu thành công.
 */
async function applyPasswordChange(
  maTaiKhoan: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<string | null> {
  if (newPassword.length < 6) return "Mật khẩu mới phải có ít nhất 6 ký tự!";
  if (newPassword !== confirmPassword) return "Mật khẩu xác nhận không khớp!";

  try {
    const { rows } = await getDbPool().query<{ mat_khau: string | null }>(
      "SELECT mat_khau FROM public.tai_khoan WHERE ma_tai_khoan = $1 LIMIT 1",
      [maTaiKhoan],
    );
    if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].mat_khau))) {
      return "Mật khẩu hiện tại không chính xác!";
    }
    if (currentPassword === newPassword) {
      return "Mật khẩu mới phải khác mật khẩu hiện tại!";
    }

    await getDbPool().query(
      `UPDATE public.tai_khoan
       SET mat_khau = $1, phai_doi_mat_khau = false
       WHERE ma_tai_khoan = $2`,
      [await hashPassword(newPassword), maTaiKhoan],
    );
    return null;
  } catch {
    return "Không thể lưu mật khẩu mới. Vui lòng thử lại sau!";
  }
}

function readPasswords(formData: FormData) {
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string" ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    return null;
  }
  return { currentPassword, newPassword, confirmPassword };
}

/**
 * Đổi mật khẩu tự nguyện (AccountController.ChangePassword):
 * nằm trong khung quản trị, sau khi đổi thành công phải đăng nhập lại.
 */
export async function changePassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const passwords = readPasswords(formData);
  if (!passwords) {
    return { error: "Vui lòng nhập đầy đủ các trường thông tin!", success: null };
  }

  const problem = await applyPasswordChange(
    account.ma_tai_khoan,
    passwords.currentPassword,
    passwords.newPassword,
    passwords.confirmPassword,
  );
  if (problem) return { error: problem, success: null };

  // Bản gốc chuyển sang Logout để buộc đăng nhập lại bằng mật khẩu mới.
  const { clearSessionCookie } = await import("@/lib/session");
  await clearSessionCookie();
  redirect("/login");
}

/**
 * Đổi mật khẩu bắt buộc lần đầu (AccountController.ForceChangePassword):
 * chưa đổi xong thì không được vào hệ thống.
 */
export async function forceChangePassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const passwords = readPasswords(formData);
  if (!passwords) {
    return { error: "Vui lòng nhập đầy đủ các trường thông tin!", success: null };
  }

  const problem = await applyPasswordChange(
    account.ma_tai_khoan,
    passwords.currentPassword,
    passwords.newPassword,
    passwords.confirmPassword,
  );
  if (problem) return { error: problem, success: null };

  redirect("/");
}

/** Đăng xuất khỏi hệ thống. */
export async function logout() {
  const { clearSessionCookie } = await import("@/lib/session");
  await clearSessionCookie();
  redirect("/login");
}
