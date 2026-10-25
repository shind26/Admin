"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createInvoice,
  deleteInvoice,
  type InvoiceFormState,
} from "./actions";
import type { ContractOption } from "@/lib/queries";
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
  contracts,
}: {
  contracts: ContractOption[];
}) {
  const [state, formAction, pending] = useActionState(createInvoice, initialState);
  const [loaiPhatSinh, setLoaiPhatSinh] = useState("BoiThuong");

  return (
    <form action={formAction} className={styles.formGrid}>
      <div style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
        💡 <strong>Lưu ý:</strong> Hóa đơn định kỳ tháng (tiền phòng + điện nước + dịch vụ trọn gói) được hệ thống <strong>tự động sinh khi chốt số Điện Nước</strong>. Form này dùng để lập hóa đơn cho các <strong>khoản thu phát sinh / đột xuất</strong> ngoài chu kỳ (đền bù hư hại, dịch vụ thêm, tiền lẻ ngày...).
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor="maHopDong">Hợp đồng / Phòng thuê *</label>
        <select
          id="maHopDong"
          name="maHopDong"
          defaultValue=""
          required
        >
          <option value="">-- Chọn phòng / hợp đồng --</option>
          {contracts.map((contract) => (
            <option key={contract.ma_hop_dong} value={contract.ma_hop_dong}>
              Phòng {contract.ma_phong} — {contract.ten_khach} ({contract.ma_hop_dong})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor="loaiPhatSinh">Phân loại phát sinh *</label>
        <select
          id="loaiPhatSinh"
          name="loaiPhatSinh"
          value={loaiPhatSinh}
          onChange={(e) => setLoaiPhatSinh(e.target.value)}
        >
          <option value="BoiThuong">Bồi thường / Sửa chữa tài sản</option>
          <option value="DichVuThem">Dịch vụ phát sinh ngoài gói</option>
          <option value="TienPhongLe">Tiền phòng lẻ ngày</option>
          <option value="PhatViPham">Phạt vi phạm nội quy</option>
          <option value="Khac">Khoản thu phát sinh khác</option>
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor="tenKhoanThu">Tên khoản thu / Diễn giải *</label>
        <input
          id="tenKhoanThu"
          name="tenKhoanThu"
          type="text"
          placeholder="Ví dụ: Bồi thường vỡ gương, Thuê thêm nệm..."
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="soTien">Số tiền phát sinh (đ) *</label>
        <input
          id="soTien"
          name="soTien"
          type="number"
          step="1000"
          min="1000"
          placeholder="200.000"
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="ngayLap">Ngày lập</label>
        <input
          id="ngayLap"
          name="ngayLap"
          type="date"
          defaultValue={today()}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="hanDongTien">Hạn đóng tiền *</label>
        <input
          id="hanDongTien"
          name="hanDongTien"
          type="date"
          defaultValue={inDays(5)}
          required
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
            "Tạo hóa đơn phát sinh"
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
