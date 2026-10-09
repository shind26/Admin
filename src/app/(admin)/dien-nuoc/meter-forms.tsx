"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createMeterReading,
  deleteMeterReading,
  updateMeterReading,
  type MeterFormState,
} from "./actions";
import type { ContractOption, MeterRow } from "@/lib/queries";
import styles from "@/components/business.module.css";

const METER_STATUSES = ["Chờ duyệt", "Đã duyệt", "Từ chối"];
const initialState: MeterFormState = { error: null, success: null };

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function MeterForm({
  mode,
  reading,
  contracts,
}: {
  mode: "create" | "edit";
  reading?: MeterRow;
  contracts: ContractOption[];
}) {
  const action = mode === "create" ? createMeterReading : updateMeterReading;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input type="hidden" name="maKy" value={reading?.ma_ky ?? ""} />
      )}

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`maHopDong-${mode}`}>Hợp đồng *</label>
        <select
          id={`maHopDong-${mode}`}
          name="maHopDong"
          defaultValue={reading?.ma_hop_dong ?? ""}
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
        <label htmlFor={`thangNam-${mode}`}>Kỳ (YYYY-MM) *</label>
        <input
          id={`thangNam-${mode}`}
          name="thangNam"
          defaultValue={reading?.thang_nam ?? currentPeriod()}
          pattern="\d{4}-\d{2}"
          placeholder="2026-10"
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayGhiNhan-${mode}`}>Ngày ghi nhận</label>
        <input
          id={`ngayGhiNhan-${mode}`}
          name="ngayGhiNhan"
          type="date"
          defaultValue={reading?.ngay_ghi_nhan?.slice(0, 10) ?? today()}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`trangThai-${mode}`}>Trạng thái duyệt</label>
        <select
          id={`trangThai-${mode}`}
          name="trangThai"
          defaultValue={reading?.trang_thai_duyet ?? "Chờ duyệt"}
        >
          {METER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`chiSoDienCu-${mode}`}>Chỉ số điện cũ</label>
        <input
          id={`chiSoDienCu-${mode}`}
          name="chiSoDienCu"
          type="number"
          step="0.1"
          defaultValue={reading?.chi_so_dien_cu ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`chiSoDienMoi-${mode}`}>Chỉ số điện mới</label>
        <input
          id={`chiSoDienMoi-${mode}`}
          name="chiSoDienMoi"
          type="number"
          step="0.1"
          defaultValue={reading?.chi_so_dien_moi ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`chiSoNuocCu-${mode}`}>Chỉ số nước cũ</label>
        <input
          id={`chiSoNuocCu-${mode}`}
          name="chiSoNuocCu"
          type="number"
          step="0.1"
          defaultValue={reading?.chi_so_nuoc_cu ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`chiSoNuocMoi-${mode}`}>Chỉ số nước mới</label>
        <input
          id={`chiSoNuocMoi-${mode}`}
          name="chiSoNuocMoi"
          type="number"
          step="0.1"
          defaultValue={reading?.chi_so_nuoc_moi ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`anhCongToDien-${mode}`}>Ảnh công tơ điện</label>
        <input
          id={`anhCongToDien-${mode}`}
          name="anhCongToDien"
          maxLength={300}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`anhCongToNuoc-${mode}`}>Ảnh công tơ nước</label>
        <input
          id={`anhCongToNuoc-${mode}`}
          name="anhCongToNuoc"
          maxLength={300}
        />
      </div>

      <p className={`${styles.formMessage} ${styles.formHint}`}>
        Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ. Mỗi hợp đồng chỉ có một kỳ
        ghi chỉ số cho mỗi tháng.
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
          ) : mode === "create" ? (
            "Lưu chỉ số"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteMeterButton({ maKy }: { maKy: string }) {
  const [state, formAction, pending] = useActionState(
    deleteMeterReading,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Bạn có chắc muốn xóa kỳ ${maKy}?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maKy" value={maKy} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function MeterEditorToggle({
  reading,
  contracts,
}: {
  reading: MeterRow;
  contracts: ContractOption[];
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
          <MeterForm mode="edit" reading={reading} contracts={contracts} />
        </div>
      )}
    </>
  );
}
