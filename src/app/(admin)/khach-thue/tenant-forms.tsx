"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createTenant,
  deleteTenant,
  updateTenant,
  type TenantFormState,
} from "./actions";
import styles from "@/components/business.module.css";

export type TenantFormData = {
  maKhach: string;
  hoTenKhach: string;
  soDt: string;
  cccd: string;
  diaChiThuongTru: string;
};

const initialState: TenantFormState = { error: null, success: null };

export function TenantForm({
  mode,
  tenant,
}: {
  mode: "create" | "edit";
  tenant?: TenantFormData;
}) {
  const action = mode === "create" ? createTenant : updateTenant;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input type="hidden" name="maKhach" value={tenant?.maKhach ?? ""} />
      )}

      <div className={styles.formField}>
        <label htmlFor={`hoTenKhach-${mode}`}>Họ tên khách *</label>
        <input
          id={`hoTenKhach-${mode}`}
          name="hoTenKhach"
          defaultValue={tenant?.hoTenKhach ?? ""}
          required
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`soDt-${mode}`}>Số điện thoại *</label>
        <input
          id={`soDt-${mode}`}
          name="soDt"
          defaultValue={tenant?.soDt ?? ""}
          required
          maxLength={20}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`cccd-${mode}`}>CCCD *</label>
        <input
          id={`cccd-${mode}`}
          name="cccd"
          defaultValue={tenant?.cccd ?? ""}
          required
          maxLength={20}
        />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`diaChiThuongTru-${mode}`}>Địa chỉ thường trú *</label>
        <input
          id={`diaChiThuongTru-${mode}`}
          name="diaChiThuongTru"
          defaultValue={tenant?.diaChiThuongTru ?? ""}
          required
          maxLength={250}
        />
      </div>

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
          ) : mode === "create" ? (
            "Thêm khách thuê"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteTenantButton({
  maKhach,
  hoTen,
}: {
  maKhach: string;
  hoTen: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteTenant,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Bạn có chắc muốn xóa hồ sơ khách ${hoTen}?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maKhach" value={maKhach} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function TenantEditorToggle({ tenant }: { tenant: TenantFormData }) {
  const [open, setOpen] = useState(false);

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
          <TenantForm mode="edit" tenant={tenant} />
        </div>
      )}
    </>
  );
}
