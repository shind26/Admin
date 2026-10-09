"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createStay,
  deleteStay,
  updateStay,
  type StayFormState,
} from "./actions";
import type { ContractOption, StayRow } from "@/lib/queries";
import styles from "@/components/business.module.css";

const STAY_STATUSES = ["Chờ xác nhận", "Đã duyệt", "Hoàn tất", "Từ chối"];
const initialState: StayFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function StayForm({
  mode,
  stay,
  contracts,
  matchedContractId,
}: {
  mode: "create" | "edit";
  stay?: StayRow;
  contracts: ContractOption[];
  matchedContractId?: string;
}) {
  const action = mode === "create" ? createStay : updateStay;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input type="hidden" name="maDangKy" value={stay?.ma_dang_ky ?? ""} />
      )}

      <div className={styles.formField}>
        <label htmlFor={`maHopDong-${mode}`}>Hợp đồng *</label>
        <select
          id={`maHopDong-${mode}`}
          name="maHopDong"
          defaultValue={matchedContractId ?? ""}
          required
        >
          <option value="">-- Chọn hợp đồng --</option>
          {contracts.map((contract) => (
            <option key={contract.ma_hop_dong} value={contract.ma_hop_dong}>
              {contract.ma_phong} - {contract.ten_khach}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hoTenKhachNgoai-${mode}`}>Tên khách ngoài *</label>
        <input
          id={`hoTenKhachNgoai-${mode}`}
          name="hoTenKhachNgoai"
          defaultValue={stay?.ho_ten_khach_ngoai ?? ""}
          required
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`cccdKhachNgoai-${mode}`}>CCCD khách ngoài *</label>
        <input
          id={`cccdKhachNgoai-${mode}`}
          name="cccdKhachNgoai"
          defaultValue={stay?.cccd_khach_ngoai ?? ""}
          required
          maxLength={20}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`tuNgay-${mode}`}>Từ ngày *</label>
        <input
          id={`tuNgay-${mode}`}
          name="tuNgay"
          type="date"
          defaultValue={stay?.tu_ngay?.slice(0, 10) ?? today()}
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`denNgay-${mode}`}>Đến ngày *</label>
        <input
          id={`denNgay-${mode}`}
          name="denNgay"
          type="date"
          defaultValue={stay?.den_ngay?.slice(0, 10) ?? today()}
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`trangThai-${mode}`}>Trạng thái</label>
        <select
          id={`trangThai-${mode}`}
          name="trangThai"
          defaultValue={stay?.trang_thai ?? "Chờ xác nhận"}
        >
          {STAY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <label className={styles.checkboxField} htmlFor={`camKetAnNinh-${mode}`}>
        <input
          id={`camKetAnNinh-${mode}`}
          name="camKetAnNinh"
          type="checkbox"
          defaultChecked={stay?.cam_ket_an_ninh ?? false}
        />
        Khách đã cam kết an ninh
      </label>

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
            "Đăng ký khách qua đêm"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteStayButton({
  maDangKy,
  hoTen,
}: {
  maDangKy: string;
  hoTen: string;
}) {
  const [state, formAction, pending] = useActionState(deleteStay, initialState);

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Bạn có chắc muốn xóa đăng ký của ${hoTen}?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maDangKy" value={maDangKy} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function StayEditorToggle({
  stay,
  contracts,
  matchedContractId,
}: {
  stay: StayRow;
  contracts: ContractOption[];
  matchedContractId?: string;
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
          <StayForm
            mode="edit"
            stay={stay}
            contracts={contracts}
            matchedContractId={matchedContractId}
          />
        </div>
      )}
    </>
  );
}
