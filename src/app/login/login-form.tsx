"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { login, type LoginState } from "./actions";
import styles from "./login.module.css";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction}>
      {state.error && (
        <div className={styles.alert} role="alert">
          <span aria-hidden="true">!</span>
          <div>{state.error}</div>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="username">Tên đăng nhập hoặc mã quản trị</label>
        <div className={styles.inputGroup}>
          <span className={styles.inputIcon} aria-hidden="true">@</span>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="admin hoặc mã tài khoản"
            autoComplete="username"
            required
            maxLength={150}
          />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="password">Mật khẩu bảo mật</label>
          <span className={styles.forgot}>Quên mật khẩu? Liên hệ ban quản trị</span>
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.inputIcon} aria-hidden="true">*</span>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button
            className={styles.eyeButton}
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      <div className={styles.optionRow}>
        <label className={styles.remember}>
          <input type="checkbox" name="remember" defaultChecked /> Ghi nhớ phiên làm việc
        </label>
        <span className={styles.firstLoginTag}>Bắt buộc đổi MK lần đầu</span>
      </div>

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle size={16} className={styles.spinner} /> Đang đăng nhập...
          </>
        ) : (
          "Đăng Nhập Quản Trị"
        )}
      </button>
    </form>
  );
}
