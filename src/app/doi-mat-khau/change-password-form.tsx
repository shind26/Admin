"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { changePassword, type PasswordState } from "./actions";
import styles from "@/components/business.module.css";

const initialState: PasswordState = { error: null, success: null };

/**
 * Đổi mật khẩu tự nguyện — tương ứng ChangePassword của SupabaseApp.
 * Nằm trong khung quản trị; đổi thành công sẽ đăng xuất và yêu cầu đăng nhập lại.
 */
export function ChangePasswordForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(
    changePassword,
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
      label: "Khác mật khẩu hiện tại",
      ok: newPassword.length > 0 && newPassword !== currentPassword,
    },
  ];

  return (
    <form action={formAction} className={styles.formGrid}>
      {state.error && (
        <p className={`${styles.formMessage} ${styles.formError}`} role="alert">
          {state.error}
        </p>
      )}

      <p className={`${styles.formMessage} ${styles.formHint}`}>
        Đang đổi mật khẩu cho tài khoản <strong>{username}</strong>. Sau khi đổi
        thành công, bạn sẽ được đưa về trang đăng nhập để đăng nhập lại bằng mật
        khẩu mới.
      </p>

      <div className={styles.formField}>
        <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          placeholder="Nhập mật khẩu đang dùng"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>

      <div className={styles.formField}>
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

      <div className={styles.formField}>
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

      <div className={styles.formField}>
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
      </div>

      <div className={styles.formActions}>
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle size={15} className={styles.spinner} /> Đang lưu...
            </>
          ) : (
            "Cập nhật mật khẩu"
          )}
        </button>
      </div>
    </form>
  );
}
