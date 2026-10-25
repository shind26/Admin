"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createService,
  deleteService,
  updateService,
  type ServiceFormState,
} from "./actions";
import styles from "@/components/business.module.css";

const initialState: ServiceFormState = { error: null, success: null };

export type ServiceFormData = {
  maDichVu: string;
  tenDichVu: string;
  donViTinh: string;
  donGia: string;
  ghiChu: string;
};

export function ServiceForm({
  mode,
  service,
  readOnly,
}: {
  mode: "create" | "edit";
  service?: ServiceFormData;
  readOnly?: boolean;
}) {
  const action = mode === "create" ? createService : updateService;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input type="hidden" name="maDichVu" value={service?.maDichVu ?? ""} />
      )}

      <div className={styles.formField}>
        <label htmlFor={`tenDichVu-${mode}`}>Tên dịch vụ *</label>
        <input
          id={`tenDichVu-${mode}`}
          name="tenDichVu"
          defaultValue={service?.tenDichVu ?? ""}
          placeholder="Rác, Wifi, Gửi xe, Dọn dẹp..."
          required
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`donGia-${mode}`}>Đơn giá (đ) *</label>
        <input
          id={`donGia-${mode}`}
          name="donGia"
          type="number"
          min={0}
          step="1000"
          defaultValue={service?.donGia ?? ""}
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`donViTinh-${mode}`}>Đơn vị tính *</label>
        <input
          id={`donViTinh-${mode}`}
          name="donViTinh"
          defaultValue={service?.donViTinh ?? ""}
          placeholder="tháng, người, xe, phòng"
          required
          maxLength={50}
        />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`ghiChu-${mode}`}>Ghi chú</label>
        <input
          id={`ghiChu-${mode}`}
          name="ghiChu"
          defaultValue={service?.ghiChu ?? ""}
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
          disabled={pending || readOnly}
          title={readOnly ? "Chỉ Admin được sửa bảng giá dịch vụ" : undefined}
        >
          {pending ? (
            <>
              <LoaderCircle size={15} className={styles.spinner} /> Đang lưu...
            </>
          ) : mode === "create" ? (
            "Thêm dịch vụ"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteServiceButton({
  maDichVu,
  tenDichVu,
  readOnly,
}: {
  maDichVu: string;
  tenDichVu: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    deleteService,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Xóa dịch vụ "${tenDichVu}" khỏi bảng giá?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maDichVu" value={maDichVu} />
        <button
          className={styles.dangerSmall}
          type="submit"
          disabled={pending || readOnly}
          title={readOnly ? "Chỉ Admin được sửa bảng giá dịch vụ" : undefined}
        >
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function ServiceEditorToggle({
  service,
  readOnly,
}: {
  service: ServiceFormData;
  readOnly?: boolean;
}) {
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
          <ServiceForm mode="edit" service={service} readOnly={readOnly} />
        </div>
      )}
    </>
  );
}
