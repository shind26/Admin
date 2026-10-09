"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createReceipt,
  deleteReceipt,
  updateReceipt,
  type ReceiptFormState,
} from "./actions";
import type { InvoiceRow, ReceiptRow } from "@/lib/queries";
import styles from "@/components/business.module.css";

const RECEIPT_STATUSES = ["Đã xác nhận", "Chờ xác nhận", "Từ chối"];
const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "VietQR"];
const initialState: ReceiptFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function remaining(invoice: InvoiceRow) {
  return Number(invoice.tong_tien ?? 0) - Number(invoice.da_thu ?? 0);
}

export function ReceiptForm({
  mode,
  receipt,
  invoices,
  presetInvoiceId,
}: {
  mode: "create" | "edit";
  receipt?: ReceiptRow;
  invoices: InvoiceRow[];
  presetInvoiceId?: string;
}) {
  const action = mode === "create" ? createReceipt : updateReceipt;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input
          type="hidden"
          name="maPhieuThu"
          value={receipt?.ma_phieu_thu ?? ""}
        />
      )}

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`maHoaDon-${mode}`}>Hóa đơn *</label>
        <select
          id={`maHoaDon-${mode}`}
          name="maHoaDon"
          defaultValue={presetInvoiceId ?? receipt?.ma_hoa_don ?? ""}
          required
          disabled={mode === "edit"}
        >
          <option value="">-- Chọn hóa đơn --</option>
          {invoices.map((invoice) => (
            <option key={invoice.ma_hoa_don} value={invoice.ma_hoa_don}>
              {invoice.ma_hoa_don} - {invoice.ma_phong} - còn{" "}
              {remaining(invoice).toLocaleString("vi-VN")} đ
            </option>
          ))}
        </select>
        {mode === "edit" && (
          <input
            type="hidden"
            name="maHoaDon"
            value={receipt?.ma_hoa_don ?? ""}
          />
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor={`soTienThu-${mode}`}>Số tiền thu (đ) *</label>
        <input
          id={`soTienThu-${mode}`}
          name="soTienThu"
          type="number"
          step="1000"
          defaultValue={receipt?.so_tien_thu ?? ""}
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayThu-${mode}`}>Ngày thu</label>
        <input
          id={`ngayThu-${mode}`}
          name="ngayThu"
          type="date"
          defaultValue={receipt?.ngay_thu?.slice(0, 10) ?? today()}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hinhThuc-${mode}`}>Hình thức</label>
        <select
          id={`hinhThuc-${mode}`}
          name="hinhThuc"
          defaultValue={receipt?.hinh_thuc ?? "Chuyển khoản"}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`trangThai-${mode}`}>Trạng thái</label>
        <select
          id={`trangThai-${mode}`}
          name="trangThai"
          defaultValue={receipt?.trang_thai ?? "Đã xác nhận"}
        >
          {RECEIPT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`maTraCuu-${mode}`}>Mã tra cứu</label>
        <input
          id={`maTraCuu-${mode}`}
          name="maTraCuu"
          defaultValue={receipt?.ma_tra_cuu ?? ""}
          maxLength={50}
        />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`anhBienLai-${mode}`}>Ảnh biên lai (đường dẫn)</label>
        <input id={`anhBienLai-${mode}`} name="anhBienLai" maxLength={300} />
      </div>

      <p className={`${styles.formMessage} ${styles.formHint}`}>
        Chỉ phiếu thu ở trạng thái &quot;Đã xác nhận&quot; mới được tính vào số
        đã thu và trạng thái hóa đơn.
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
            "Ghi nhận phiếu thu"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteReceiptButton({ maPhieuThu }: { maPhieuThu: string }) {
  const [state, formAction, pending] = useActionState(
    deleteReceipt,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Bạn có chắc muốn xóa phiếu thu ${maPhieuThu}?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maPhieuThu" value={maPhieuThu} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function ReceiptEditorToggle({
  receipt,
  invoices,
}: {
  receipt: ReceiptRow;
  invoices: InvoiceRow[];
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
          <ReceiptForm mode="edit" receipt={receipt} invoices={invoices} />
        </div>
      )}
    </>
  );
}
