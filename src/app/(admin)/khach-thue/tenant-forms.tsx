"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Copy, Check, Smartphone, ShieldCheck } from "lucide-react";
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
  ngaySinh?: string | null;
  gioiTinh?: string | null;
  ngayCapCccd?: string | null;
  noiCapCccd?: string | null;
  tenNguoiThan?: string | null;
  sdtNguoiThan?: string | null;
  moiQuanHe?: string | null;
  ghiChuNoiBo?: string | null;
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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!state.tempPassword || !state.username) return;
    const msg = `[Nhà trọ Kiều Giang] Xin chào ${tenant?.hoTenKhach || "bạn"}, tài khoản Mobile App cư dân của bạn là: SĐT: ${state.username} | Mật khẩu mặc định: ${state.tempPassword}. Vui lòng đăng nhập và đổi mật khẩu mới.`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // CHẾ ĐỘ SỬA: Chỉ quản lý ghi chú nội bộ (Thông tin cá nhân do khách tự cập nhật qua Mobile App)
  if (mode === "edit") {
    return (
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="hidden" name="maKhach" value={tenant?.maKhach ?? ""} />

        {/* Thông tin tóm tắt của khách (Read-only) */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "#334155",
          }}
        >
          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>
            {tenant?.hoTenKhach}{" "}
            <span style={{ fontWeight: 400, color: "#64748b" }}>
              ({tenant?.soDt || "Chưa có SĐT"} — CCCD: {tenant?.cccd || "—"})
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b" }}>
            * Thông tin cá nhân (CCCD, địa chỉ, số điện thoại...) do cư dân quản lý và cập nhật qua Mobile App. Quản lý chỉ lưu Ghi chú nội bộ bên dưới.
          </div>
        </div>

        {/* Ghi chú nội bộ của Quản lý */}
        <div className={styles.formField}>
          <label htmlFor={`ghiChuNoiBo-${mode}`}>Ghi chú nội bộ của Quản lý</label>
          <textarea
            id={`ghiChuNoiBo-${mode}`}
            name="ghiChuNoiBo"
            defaultValue={tenant?.ghiChuNoiBo ?? ""}
            placeholder="Ví dụ: Khách giữ gìn phòng tốt, thanh toán đúng hạn..."
            rows={3}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              lineHeight: 1.5,
              resize: "vertical",
            }}
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

        <div className={styles.formActions} style={{ marginTop: 0 }}>
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
              "Lưu ghi chú nội bộ"
            )}
          </button>
        </div>
      </form>
    );
  }

  // CHẾ ĐỘ THÊM MỚI (Bỏ phần Ghi chú nội bộ vì khách mới vào)
  return (
    <form action={formAction} className={styles.formGrid}>
      {/* Thông tin cơ bản */}
      <div className={styles.formField}>
        <label htmlFor={`hoTenKhach-${mode}`}>Họ tên khách *</label>
        <input
          id={`hoTenKhach-${mode}`}
          name="hoTenKhach"
          placeholder="Nguyễn Văn A"
          required
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`soDt-${mode}`}>Số điện thoại (dùng đăng nhập App) *</label>
        <input
          id={`soDt-${mode}`}
          name="soDt"
          placeholder="0912345678"
          required
          maxLength={20}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`cccd-${mode}`}>Số CCCD / CMND *</label>
        <input
          id={`cccd-${mode}`}
          name="cccd"
          placeholder="001201009988"
          required
          maxLength={20}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`gioiTinh-${mode}`}>Giới tính</label>
        <select id={`gioiTinh-${mode}`} name="gioiTinh" defaultValue="Nam">
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
          <option value="Khác">Khác</option>
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngaySinh-${mode}`}>Ngày sinh</label>
        <input id={`ngaySinh-${mode}`} name="ngaySinh" type="date" />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayCapCccd-${mode}`}>Ngày cấp CCCD</label>
        <input id={`ngayCapCccd-${mode}`} name="ngayCapCccd" type="date" />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`noiCapCccd-${mode}`}>Nơi cấp CCCD</label>
        <input
          id={`noiCapCccd-${mode}`}
          name="noiCapCccd"
          defaultValue="Cục CSQLHC về TTXH"
          placeholder="Cục CSQLHC về TTXH"
          maxLength={150}
        />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`diaChiThuongTru-${mode}`}>Địa chỉ thường trú *</label>
        <input
          id={`diaChiThuongTru-${mode}`}
          name="diaChiThuongTru"
          placeholder="Số nhà, Phường/Xã, Quận/Huyện, Tỉnh/TP"
          required
          maxLength={250}
        />
      </div>

      {/* Người liên hệ khẩn cấp */}
      <div className={styles.formField}>
        <label htmlFor={`tenNguoiThan-${mode}`}>Người liên hệ khẩn cấp (Họ tên)</label>
        <input
          id={`tenNguoiThan-${mode}`}
          name="tenNguoiThan"
          placeholder="Bố/Mẹ/Người thân"
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`sdtNguoiThan-${mode}`}>SĐT Người thân</label>
        <input
          id={`sdtNguoiThan-${mode}`}
          name="sdtNguoiThan"
          placeholder="0988776655"
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`moiQuanHe-${mode}`}>Mối quan hệ</label>
        <input
          id={`moiQuanHe-${mode}`}
          name="moiQuanHe"
          placeholder="Bố / Mẹ / Vợ / Chồng / Anh chị"
        />
      </div>

      {/* Tùy chọn cấp tài khoản Mobile App */}
      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontWeight: 600,
            color: "#3730a3",
          }}
        >
          <input
            type="checkbox"
            name="capTaiKhoanApp"
            defaultChecked
            style={{ width: 18, height: 18, accentColor: "#4f46e5" }}
          />
          <Smartphone size={16} /> Tự động cấp tài khoản Mobile App ngay khi tạo (Username = SĐT, Mật khẩu tạm 6 số)
        </label>
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

      {/* Hiển thị tài khoản vừa cấp nếu có */}
      {state.tempPassword && state.username && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: 14,
            marginTop: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>
            <ShieldCheck size={18} /> Đã cấp tài khoản Mobile App cho khách:
          </div>
          <div style={{ fontSize: 13, color: "#334155", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span>Tên đăng nhập: <strong style={{ fontFamily: "monospace" }}>{state.username}</strong></span>
            <span>Mật khẩu mặc định: <strong style={{ fontFamily: "monospace", color: "#dc2626" }}>{state.tempPassword}</strong></span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Đã sao chép!" : "Sao chép SMS/Zalo"}
            </button>
          </div>
        </div>
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
            "Thêm hồ sơ khách thuê"
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
        title="Ghi chú nội bộ quản lý cho khách này"
      >
        {open ? "Đóng" : "Ghi chú"}
      </button>
      {open && (
        <div className={styles.inlineEditor}>
          <TenantForm mode="edit" tenant={tenant} />
        </div>
      )}
    </>
  );
}
