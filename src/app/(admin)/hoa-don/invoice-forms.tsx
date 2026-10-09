"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createInvoice,
  deleteInvoice,
  updateInvoice,
  type InvoiceFormState,
} from "./actions";
import type { ContractOption, InvoiceRow } from "@/lib/queries";
import styles from "@/components/business.module.css";

const initialState: InvoiceFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function InvoiceForm({
  mode,
  invoice,
  contracts,
}: {
  mode: "create" | "edit";
  invoice?: InvoiceRow;
  contracts: ContractOption[];
}) {
  const action = mode === "create" ? createInvoice : updateInvoice;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input
          type="hidden"
          name="maHoaDon"
          value={invoice?.ma_hoa_don ?? ""}
        />
      )}

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`maHopDong-${mode}`}>Hợp đồng *</label>
        <select
          id={`maHopDong-${mode}`}
          name="maHopDong"
          defaultValue={invoice?.ma_hop_dong ?? ""}
          required
        >
          <option value="">-- Chọn hợp đồng --</option>
          {contracts.map((contract) => (
            <option key={contract.ma_hop_dong} value={contract.ma_hop_dong}>
              {contract.ma_hop_dong} - {contract.ma_phong} -{" "}
              {contract.ten_khach}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayLap-${mode}`}>Ngày lập</label>
        <input
          id={`ngayLap-${mode}`}
          name="ngayLap"
          type="date"
          defaultValue={invoice?.ngay_lap?.slice(0, 10) ?? today()}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hanDongTien-${mode}`}>Hạn đóng tiền</label>
        <input
          id={`hanDongTien-${mode}`}
          name="hanDongTien"
          type="date"
          defaultValue={invoice?.han_dong_tien?.slice(0, 10) ?? inDays(7)}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`tienPhong-${mode}`}>Tiền phòng (đ)</label>
        <input
          id={`tienPhong-${mode}`}
          name="tienPhong"
          type="number"
          step="1000"
          defaultValue={invoice?.tong_tien ? "" : ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`tienDienNuoc-${mode}`}>Tiền điện nước (đ)</label>
        <input
          id={`tienDienNuoc-${mode}`}
          name="tienDienNuoc"
          type="number"
          step="1000"
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`tienDichVuKhac-${mode}`}>Tiền dịch vụ khác (đ)</label>
        <input
          id={`tienDichVuKhac-${mode}`}
          name="tienDichVuKhac"
          type="number"
          step="1000"
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`noCu-${mode}`}>Nợ cũ (đ)</label>
        <input id={`noCu-${mode}`} name="noCu" type="number" step="1000" />
      </div>

      <p className={`${styles.formMessage} ${styles.formHint}`}>
        Tổng tiền = tiền phòng + điện nước + dịch vụ khác + nợ cũ. Trạng thái
        thanh toán được tính tự động theo phiếu thu đã xác nhận.
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
            "Tạo hóa đơn"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteInvoiceButton({ maHoaDon }: { maHoaDon: string }) {
  const [state, formAction, pending] = useActionState(
    deleteInvoice,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Bạn có chắc muốn xóa hóa đơn ${maHoaDon}?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maHoaDon" value={maHoaDon} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function InvoiceEditorToggle({
  invoice,
  contracts,
}: {
  invoice: InvoiceRow;
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
          <InvoiceForm mode="edit" invoice={invoice} contracts={contracts} />
        </div>
      )}
    </>
  );
}
