import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/session";
import { ForcePasswordForm } from "./password-form";
import styles from "./doi-mat-khau-lan-dau.module.css";

export const metadata = {
  title: "Đổi mật khẩu lần đầu | Kiêu Giang Boarding",
};

/**
 * Trang bắt buộc đổi mật khẩu lần đầu — tương ứng ForceChangePassword của SupabaseApp.
 * Nằm ngoài khung quản trị; tài khoản đã đổi mật khẩu rồi thì được đưa về trang chủ.
 */
async function ForcePasswordContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.phai_doi_mat_khau) redirect("/");

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.cardHeader}>
          <span className={styles.shieldIcon} aria-hidden="true">
            ✓
          </span>
          <h1>Kích Hoạt Bảo Mật Tài Khoản</h1>
          <p>Yêu cầu bắt buộc cho lần đăng nhập đầu tiên của Chủ cơ sở</p>
        </header>
        <div className={styles.cardBody}>
          <div className={styles.warning} role="status">
            Đây là lần đầu bạn đăng nhập vào hệ thống. Vui lòng đổi mật khẩu để
            bảo vệ cơ sở của bạn!
          </div>
          <ForcePasswordForm
            username={account.ten_dang_nhap || account.ma_tai_khoan}
          />
        </div>
      </div>
    </main>
  );
}

export default function ForceChangePasswordPage() {
  return (
    <Suspense fallback={<main className={styles.screen} />}>
      <ForcePasswordContent />
    </Suspense>
  );
}
