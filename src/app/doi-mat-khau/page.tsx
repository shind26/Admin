import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";
import styles from "@/components/business.module.css";

export const metadata = { title: "Đổi mật khẩu | Kiêu Giang Boarding" };

/** Đổi mật khẩu tự nguyện, nằm trong khung quản trị — tương ứng AccountController.ChangePassword. */
async function ChangePasswordContent() {
  const { account } = await requireScope();
  if (!account) redirect("/login");

  return (
    <AdminShell active="account">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Đổi mật khẩu</h1>
          <p className={styles.subtitle}>
            Cập nhật mật khẩu đăng nhập cho tài khoản đang sử dụng
          </p>
        </div>
      </div>

      <div className={styles.createBox}>
        <ChangePasswordForm
          username={account.ten_dang_nhap || account.ma_tai_khoan}
        />
      </div>
    </AdminShell>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ChangePasswordContent />
    </Suspense>
  );
}
