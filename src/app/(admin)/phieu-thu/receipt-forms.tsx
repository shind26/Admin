"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createReceipt,
  deleteReceipt,
  updateReceipt,
  quickApproveReceipt,
  quickRejectReceipt,
  type ReceiptFormState,
} from "./actions";
import type { InvoiceRow, ReceiptRow } from "@/lib/queries";
import styles from "@/components/business.module.css";
import receiptStyles from "./receipt-detail.module.css";

const RECEIPT_STATUSES = ["Đã xác nhận", "Chờ xác nhận", "Từ chối"];
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

  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    presetInvoiceId ?? receipt?.ma_hoa_don ?? ""
  );

  const isConfirmed =
    mode === "edit" &&
    (receipt?.trang_thai === "Đã xác nhận" || receipt?.trang_thai === "Đã khớp lệnh");

  const [soTienThu, setSoTienThu] = useState<string>(
    receipt?.so_tien_thu ? String(Number(receipt.so_tien_thu)) : ""
  );

  const handleInvoiceChange = (id: string) => {
    setSelectedInvoiceId(id);
    if (mode === "create") {
      const inv = invoices.find((i) => i.ma_hoa_don === id);
      if (inv) {
        const rem = remaining(inv);
        if (rem > 0) setSoTienThu(String(rem));
      }
    }
  };

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input
          type="hidden"
          name="maPhieuThu"
          value={receipt?.ma_phieu_thu ?? ""}
        />
      )}

      {isConfirmed && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "#ecfdf5",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #a7f3d0",
            fontSize: 12.5,
            color: "#065f46",
          }}
        >
          🔒 <strong>Phiếu thu đã xác nhận:</strong> Theo quy chuẩn chứng từ kế toán (Lựa chọn A), phiếu thu đã ghi nhận hợp lệ không thể sửa đổi số tiền. Nếu có sai sót, vui lòng xóa phiếu và lập phiếu mới.
        </div>
      )}

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`maHoaDon-${mode}`}>Hóa đơn thanh toán *</label>
        {mode === "create" ? (
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
        ) : (
          <div
            style={{
              padding: "8px 12px",
              background: "#f1f5f9",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {receipt?.ma_hoa_don} — Phòng {receipt?.ma_phong} ({receipt?.ten_khach || "—"})
            <input type="hidden" name="maHoaDon" value={receipt?.ma_hoa_don ?? ""} />
          </div>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor={`soTienThu-${mode}`}>Số tiền thu (đ) *</label>
        <input
          id={`soTienThu-${mode}`}
          name="soTienThu"
          type="number"
          step="1000"
          value={soTienThu}
          onChange={(e) => setSoTienThu(e.target.value)}
          disabled={isConfirmed}
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
          disabled={isConfirmed}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hinhThuc-${mode}`}>Hình thức thanh toán</label>
        <select
          id={`hinhThuc-${mode}`}
          name="hinhThuc"
          defaultValue={receipt?.hinh_thuc ?? "Chuyển khoản"}
          disabled={isConfirmed}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`trangThai-${mode}`}>Trạng thái phiếu *</label>
        <select
          id={`trangThai-${mode}`}
          name="trangThai"
          defaultValue={receipt?.trang_thai ?? "Đã xác nhận"}
          disabled={isConfirmed}
        >
          {RECEIPT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`maTraCuu-${mode}`}>Mã tra cứu / Mã giao dịch ngân hàng</label>
        <input
          id={`maTraCuu-${mode}`}
          name="maTraCuu"
          defaultValue={receipt?.ma_tra_cuu ?? ""}
          placeholder="Mã giao dịch VietQR, số UNC..."
          maxLength={50}
          disabled={isConfirmed}
        />
      </div>

      <p className={`${styles.formMessage} ${styles.formHint}`}>
        💡 Phiếu thu ở trạng thái <strong>&quot;Đã xác nhận&quot;</strong> sẽ tự động cập nhật số tiền đã thu vào hóa đơn và gửi thông báo xác nhận đến đại diện phòng.
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

      {!isConfirmed && (
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
      )}
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

/** Lựa chọn A: Chỉ hiển thị nút Sửa khi phiếu thu chưa được xác nhận */
export function ReceiptEditorToggle({
  receipt,
  invoices,
}: {
  receipt: ReceiptRow;
  invoices: InvoiceRow[];
}) {
  const [open, setOpen] = useState(false);

  // Nếu phiếu đã xác nhận hoặc đã khớp lệnh -> KHÓA SỬA (Lựa chọn A)
  if (receipt.trang_thai === "Đã xác nhận" || receipt.trang_thai === "Đã khớp lệnh") {
    return null;
  }

  return (
    <>
      <button
        className={styles.linkButton}
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Chỉnh sửa thông tin phiếu thu đang chờ duyệt"
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

/** Nút duyệt nhanh phiếu thu chờ xác nhận (1-click) */
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
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid #86efac",
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

/** Nút từ chối nhanh phiếu thu (1-click) */
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
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid #fca5a5",
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
