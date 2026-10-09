"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  forceChangePassword,
  logout,
  type PasswordState,
} from "@/app/doi-mat-khau/actions";
import styles from "./doi-mat-khau-lan-dau.module.css";

const initialState: PasswordState = { error: null, success: null };

/**
 * Đổi mật khẩu bắt buộc lần đầu — tương ứng ForceChangePassword của SupabaseApp.
 * Không có lối vào hệ thống ngoài việc đổi mật khẩu hoặc đăng xuất.
 */
export function ForcePasswordForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(
    forceChangePassword,
    initialState,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const rules = [
    { label: "Tối thiểu 6 ký tự", ok: newPassword.length >= 6 },
    {
      label: "Mật khẩu xác nhận trùng khớp",
      ok: newPassword.length > 0 && newPassword === confirmPassword,
    },
    {
      label: "Khác mật khẩu mặc định ban đầu",
      ok: newPassword.length > 0 && newPassword !== currentPassword,
    },
  ];

  return (
    <>
      {state.error && (
        <div className={styles.alertError} role="alert">
          <span aria-hidden="true">!</span>
          <div>{state.error}</div>
        </div>
      )}

      <div className={styles.accountBox}>
        <span className={styles.accountAvatar}>
          {username.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <div className={styles.accountLabel}>Tài khoản quản trị:</div>
          <div className={styles.accountName}>{username}</div>
        </div>
      </div>

      <form action={formAction}>
        <div className={styles.field}>
          <label htmlFor="currentPassword">Mật khẩu mặc định hiện tại</label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            placeholder="Mật khẩu được cấp"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="newPassword">Mật khẩu mới</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
            required
            minLength={6}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        <div className={styles.rules}>
          <div className={styles.rulesTitle}>Quy chuẩn an toàn:</div>
          {rules.map((rule) => (
            <div
              key={rule.label}
              className={rule.ok ? styles.ruleOk : styles.ruleFail}
            >
              {rule.ok ? "✓" : "✕"} {rule.label}
            </div>
          ))}
        </div>

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle size={16} className={styles.spinner} /> Đang lưu...
            </>
          ) : (
            "Xác Nhận & Kích Hoạt Tài Khoản"
          )}
        </button>
      </form>

      <div className={styles.logoutRow}>
        <form action={logout}>
          <button type="submit" className={styles.logoutLink}>
            Đăng xuất tài khoản này
          </button>
        </form>        <Link href="/" className={styles.logoutLink}>
          Về trang chủ
        </Link>
      </div>
    </>
  );
}
