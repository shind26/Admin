"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createAccount,
  resetAccountPassword,
  updateAccount,
  type AccountFormState,
} from "./actions";
import { ACCOUNT_STATUSES, DEFAULT_PASSWORD } from "./constants";
import styles from "@/components/business.module.css";
const initialState: AccountFormState = { error: null, success: null };

export function AccountForm({ buildings }: { buildings: string[] }) {
  const [state, formAction, pending] = useActionState(
    createAccount,
    initialState,
  );

  return (
    <form action={formAction} className={styles.formGrid}>
      <div className={styles.formField}>
        <label htmlFor="tenDangNhap">Tên đăng nhập *</label>
        <input
          id="tenDangNhap"
          name="tenDangNhap"
          placeholder="nhanvien.toaa"
          required
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="hoTen">Họ tên nhân viên *</label>
        <input
          id="hoTen"
          name="hoTen"
          placeholder="Nguyễn Văn A"
          required
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="vaiTro">Vai trò</label>
        <select id="vaiTro" name="vaiTro" defaultValue="QuanLy">
          <option value="QuanLy">QuanLy — quản lý tòa được gán</option>
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor="toaNha">Tòa nhà quản lý *</label>
        <select id="toaNha" name="toaNha" defaultValue="" required>
          <option value="">-- Chọn tòa nhà --</option>
          {buildings.map((building) => (
            <option key={building} value={building}>
              {building}
            </option>
          ))}
        </select>
      </div>

      <p className={`${styles.formMessage} ${styles.formHint}`}>
        Tài khoản mới dùng mật khẩu mặc định <strong>{DEFAULT_PASSWORD}</strong> và bắt buộc đổi ở lần đăng nhập đầu tiên. Nhân viên chỉ thấy dữ liệu thuộc tòa được gán.
      </p>

      {state.error && (
        <p className={`${styles.formMessage} ${styles.formError}`} role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          className={`${styles.formMessage} ${styles.formSuccess}`}
          role="status"
        >
          {state.success}
        </p>
      )}

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
            "Tạo tài khoản"
          )}
        </button>
      </div>
    </form>
  );
}

export function EditAccountToggle({
  account,
  buildings,
}: {
  account: {
    maTaiKhoan: string;
    hoTen: string;
    coSo: string;
    trangThai: string;
    vaiTro: string;
  };
  buildings: string[];
}) {
  const [state, formAction, pending] = useActionState(
    updateAccount,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const isAdmin = account.vaiTro === "Admin";

  return (
    <>
      <button
        className={styles.linkButton}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Đóng" : "Sửa"}
      </button>
      {open && (
        <div className={styles.inlineEditor}>
          <form action={formAction} className={styles.formGrid}>
            <input type="hidden" name="maTaiKhoan" value={account.maTaiKhoan} />

            <div className={styles.formField}>
              <label htmlFor={`hoTen-${account.maTaiKhoan}`}>Họ tên *</label>
              <input
                id={`hoTen-${account.maTaiKhoan}`}
                name="hoTen"
                defaultValue={account.hoTen}
                required
                maxLength={150}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor={`toaNha-${account.maTaiKhoan}`}>
                Tòa nhà quản lý
              </label>
              {isAdmin ? (
                <input value="Toàn hệ thống (Admin)" readOnly />
              ) : (
                <select
                  id={`toaNha-${account.maTaiKhoan}`}
                  name="toaNha"
                  defaultValue={account.coSo}
                  required
                >
                  <option value="">-- Chọn tòa nhà --</option>
                  {buildings.map((building) => (
                    <option key={building} value={building}>
                      {building}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={styles.formField}>
              <label htmlFor={`trangThai-${account.maTaiKhoan}`}>
                Trạng thái
              </label>
              <select
                id={`trangThai-${account.maTaiKhoan}`}
                name="trangThai"
                defaultValue={account.trangThai}
              >
                {ACCOUNT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "HoatDong"
                      ? "HoatDong — đang hoạt động"
                      : "Khoa — bị khóa"}
                  </option>
                ))}
              </select>
            </div>

            {state.error && (
              <p
                className={`${styles.formMessage} ${styles.formError}`}
                role="alert"
              >
                {state.error}
              </p>
            )}
            {state.success && (
              <p
                className={`${styles.formMessage} ${styles.formSuccess}`}
                role="status"
              >
                {state.success}
              </p>
            )}

            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <LoaderCircle size={15} className={styles.spinner} /> Đang
                    lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function ResetPasswordButton({
  maTaiKhoan,
  tenDangNhap,
}: {
  maTaiKhoan: string;
  tenDangNhap: string;
}) {
  const [state, formAction, pending] = useActionState(
    resetAccountPassword,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Đặt lại mật khẩu của ${tenDangNhap} về mặc định 123456? Nhân viên sẽ phải đổi mật khẩu khi đăng nhập lại.`,
            )
          )
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maTaiKhoan" value={maTaiKhoan} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Reset MK
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
      {state.success && (
        <span className={styles.rowError}>{state.success}</span>
      )}
    </span>
  );
}
