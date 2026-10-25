"use server";

import { redirect } from "next/navigation";
import { getDbPool } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  clearSessionCookie,
  createSessionToken,
  getCurrentAccount,
  setSessionCookie,
} from "@/lib/session";

export type PasswordState = { error: string | null; success: string | null };

type ChangeResult = {
  error: string | null;
  newHash: string | null;
};

/**
 * Xác thực và lưu mật khẩu mới, dùng chung quy tắc của SupabaseApp/AccountController.
 * Trả về lỗi dạng chuỗi, hoặc hash mật khẩu mới khi đã lưu thành công.
 */
async function applyPasswordChange(
  maTaiKhoan: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ChangeResult> {
  if (newPassword.length < 6) {
    return { error: "Mật khẩu mới phải có ít nhất 6 ký tự!", newHash: null };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Mật khẩu xác nhận không khớp!", newHash: null };
  }

  try {
    const { rows } = await getDbPool().query<{ mat_khau: string | null }>(
      "SELECT mat_khau FROM public.tai_khoan WHERE ma_tai_khoan = $1 LIMIT 1",
      [maTaiKhoan],
    );
    if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].mat_khau))) {
      return { error: "Mật khẩu hiện tại không chính xác!", newHash: null };
    }
    if (currentPassword === newPassword) {
      return { error: "Mật khẩu mới phải khác mật khẩu hiện tại!", newHash: null };
    }

    const newHash = await hashPassword(newPassword);
    await getDbPool().query(
      `UPDATE public.tai_khoan
       SET mat_khau = $1, da_doi_mat_khau = true
       WHERE ma_tai_khoan = $2`,
      [newHash, maTaiKhoan],
    );
    return { error: null, newHash };
  } catch {
    return { error: "Không thể lưu mật khẩu mới. Vui lòng thử lại sau!", newHash: null };
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
 * Nằm trong khung quản trị. Sau khi đổi thành công, hủy cookie và buộc đăng nhập lại
 * (mọi phiên cũ trên các thiết bị khác cũng lập tức bị vô hiệu hóa do Security Stamp thay đổi).
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

  const { error: problem } = await applyPasswordChange(
    account.ma_tai_khoan,
    passwords.currentPassword,
    passwords.newPassword,
    passwords.confirmPassword,
  );
  if (problem) return { error: problem, success: null };

  // Xóa cookie phiên hiện tại và buộc đăng nhập lại bằng mật khẩu mới
  await clearSessionCookie();
  redirect("/login");
}

/**
 * Đổi mật khẩu bắt buộc lần đầu (AccountController.ForceChangePassword):
 * Chưa đổi xong thì không được vào hệ thống. Đổi xong lập tức cấp Security Stamp mới và vào trang chủ.
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

  const { error: problem, newHash } = await applyPasswordChange(
    account.ma_tai_khoan,
    passwords.currentPassword,
    passwords.newPassword,
    passwords.confirmPassword,
  );
  if (problem || !newHash) return { error: problem, success: null };

  // Cập nhật cookie phiên mới với Security Stamp tương ứng mật khẩu mới
  const token = createSessionToken(account.ma_tai_khoan, newHash);
  if (token) {
    await setSessionCookie(token);
  }

  redirect("/");
}

/** Đăng xuất khỏi hệ thống. */
export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
