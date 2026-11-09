"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createReceipt,
  deleteReceipt,
  quickApproveReceipt,
  quickRejectReceipt,
  type ReceiptFormState,
} from "./actions";
import type { InvoiceRow } from "@/lib/queries";
import styles from "@/components/business.module.css";
import receiptStyles from "./receipt-detail.module.css";

const RECEIPT_STATUSES = ["Đã xác nhận", "Chờ xác nhận", "Đã hủy"];
const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "VietQR"];
const initialState: ReceiptFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function remaining(invoice: InvoiceRow) {
  let total = Number(invoice.tong_tien ?? 0);
  if (total <= 0) {
    total =
      Number(invoice.tien_phong || 0) +
      Number(invoice.tien_dien_nuoc || 0) +
      Number(invoice.tien_dich_vu_khac || 0) +
      Number(invoice.no_cu || 0);
  }
  return Math.max(0, total - Number(invoice.da_thu ?? 0));
}

export function ReceiptForm({
  invoices,
  presetInvoiceId,
}: {
  invoices: InvoiceRow[];
  presetInvoiceId?: string;
}) {
  const mode = "create";
  const [state, formAction, pending] = useActionState(createReceipt, initialState);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    presetInvoiceId ?? ""
  );

  const [soTienThu, setSoTienThu] = useState("");

  const handleInvoiceChange = (id: string) => {
    setSelectedInvoiceId(id);
    const inv = invoices.find((i) => i.ma_hoa_don === id);
    if (inv) {
      const rem = remaining(inv);
      if (rem > 0) setSoTienThu(String(rem));
    }
  };

  return (
    <form action={formAction} className={styles.formGrid}>
      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`maHoaDon-${mode}`}>Hóa đơn thanh toán</label>
          <select
            id={`maHoaDon-${mode}`}
            name="maHoaDon"
            value={selectedInvoiceId}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            required
          >
            <option value="">-- Chọn hóa đơn cần thu tiền --</option>
            {invoices.map((invoice) => {
              const rem = remaining(invoice);
              return (
                <option key={invoice.ma_hoa_don} value={invoice.ma_hoa_don}>
                  {invoice.ma_hoa_don} — Phòng {invoice.ma_phong} ({invoice.ten_khach || "Chưa có tên"}) — Còn nợ: {rem.toLocaleString("vi-VN")} đ
                </option>
              );
            })}
          </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`soTienThu-${mode}`}>Số tiền thu (đ)</label>
        <input
          id={`soTienThu-${mode}`}
          name="soTienThu"
          type="number"
          step="1000"
          min="1000"
          value={soTienThu}
          onChange={(e) => setSoTienThu(e.target.value)}
          placeholder="Nhập số tiền..."
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayThu-${mode}`}>Ngày thu</label>
        <input
          id={`ngayThu-${mode}`}
          name="ngayThu"
          type="date"
          defaultValue={today()}
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hinhThuc-${mode}`}>Hình thức thanh toán</label>
        <select
          id={`hinhThuc-${mode}`}
          name="hinhThuc"
          defaultValue="Chuyển khoản"
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
          defaultValue="Đã xác nhận"
        >
          {RECEIPT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`ghiChu-${mode}`}>Ghi chú phiếu thu</label>
        <input
          id={`ghiChu-${mode}`}
          name="ghiChu"
          defaultValue=""
          placeholder="Ví dụ: Đóng tiền phòng đợt 1, thanh toán qua ngân hàng..."
          maxLength={255}
        />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`maTraCuu-${mode}`}>Mã tra cứu giao dịch (nếu có)</label>
        <input
          id={`maTraCuu-${mode}`}
          name="maTraCuu"
          defaultValue=""
          placeholder="Mã giao dịch VietQR, số UNC..."
          maxLength={50}
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
            ) : (
              "Ghi nhận phiếu thu"
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

export function QuickApproveReceiptButton({ maPhieuThu }: { maPhieuThu: string }) {
  const [state, formAction, pending] = useActionState(
    quickApproveReceipt,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form action={formAction}>
        <input type="hidden" name="maPhieuThu" value={maPhieuThu} />
        <button
          type="submit"
          disabled={pending}
          className={receiptStyles.btnApprove}
          style={{
            padding: "4px 9px",
            fontSize: "11.5px",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid var(--status-success-border)",
          }}
          title="Duyệt xác nhận thanh toán phiếu thu này"
        >
          {pending ? "..." : "✓ Duyệt"}
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function QuickRejectReceiptButton({ maPhieuThu }: { maPhieuThu: string }) {
  const [state, formAction, pending] = useActionState(
    quickRejectReceipt,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!window.confirm(`Bạn có chắc muốn từ chối phiếu thu ${maPhieuThu}?`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="maPhieuThu" value={maPhieuThu} />
        <button
          type="submit"
          disabled={pending}
          className={receiptStyles.btnReject}
          style={{
            padding: "4px 9px",
            fontSize: "11.5px",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid var(--status-danger-border)",
          }}
          title="Từ chối phiếu thu này"
        >
          {pending ? "..." : "✕ Từ chối"}
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}
