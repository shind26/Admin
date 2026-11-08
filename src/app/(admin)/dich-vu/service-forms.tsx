"use client";

import { useActionState, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { createService, deleteService, updateService, toggleServiceStatus, type ServiceFormState } from "./actions";
import styles from "@/components/business.module.css";

const initialState: ServiceFormState = { error: null, success: null };

export type ServiceFormData = {
  maDichVu: string;
  tenDichVu: string;
  donViTinh: string;
  donGia: string;
  ghiChu: string;
  dangApDung?: boolean;
};

export function ServiceForm({
  mode,
  service,
  readOnly,
  onSuccess,
  onCancel,
}: {
  mode: "create" | "edit";
  service?: ServiceFormData;
  readOnly?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const action = mode === "create" ? createService : updateService;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success && onSuccess) {
      const timer = setTimeout(() => {
        onSuccess();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [state.success, onSuccess]);

  const [tenDichVu, setTenDichVu] = useState(service?.tenDichVu ?? "");
  const [donViTinh, setDonViTinh] = useState(service?.donViTinh ?? "");

  const isDien =
    service?.maDichVu === "DV_DIEN" ||
    tenDichVu.toLowerCase().includes("điện") ||
    donViTinh.toLowerCase().includes("kwh");
  const step = isDien ? "100" : "1000";

  return (
    <form
      action={formAction}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      {mode === "edit" && (
        <input type="hidden" name="maDichVu" value={service?.maDichVu ?? ""} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor={`tenDichVu-${mode}`}
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}
        >
          Tên dịch vụ *
        </label>
        <input
          id={`tenDichVu-${mode}`}
          name="tenDichVu"
          defaultValue={service?.tenDichVu ?? ""}
          onChange={(e) => setTenDichVu(e.target.value)}
          placeholder="Rác, Wifi, Gửi xe, Dọn dẹp..."
          required
          maxLength={150}
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border-strong)",
            fontSize: 13,
            color: "var(--text-main)",
            background: "var(--bg-surface)",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor={`donGia-${mode}`}
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}
        >
          Đơn giá (đ) *
        </label>
        <input
          id={`donGia-${mode}`}
          name="donGia"
          type="number"
          min={0}
          step={step}
          placeholder={isDien ? "3500, 3600..." : "50000, 100000..."}
          defaultValue={service?.donGia ? Math.round(Number(service.donGia)) : ""}
          required
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border-strong)",
            fontSize: 13,
            color: "var(--text-main)",
            background: "var(--bg-surface)",
          }}
        />
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {isDien
            ? "Mỗi nấc tăng / giảm: 100 đ (3.500, 3.600, 3.700...)"
            : "Mỗi nấc tăng / giảm: 1.000 đ"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor={`donViTinh-${mode}`}
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}
        >
          Đơn vị tính *
        </label>
        <input
          id={`donViTinh-${mode}`}
          name="donViTinh"
          defaultValue={service?.donViTinh ?? ""}
          onChange={(e) => setDonViTinh(e.target.value)}
          placeholder="tháng, người, xe, phòng, kWh, m³"
          required
          maxLength={50}
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border-strong)",
            fontSize: 13,
            color: "var(--text-main)",
            background: "var(--bg-surface)",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor={`dangApDung-${mode}`}
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}
        >
          Trạng thái áp dụng *
        </label>
        <select
          id={`dangApDung-${mode}`}
          name="dangApDung"
          defaultValue={service?.dangApDung === false ? "false" : "true"}
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border-strong)",
            fontSize: 13,
            color: "var(--text-main)",
            background: "var(--bg-surface)",
          }}
        >
          <option value="true">Đang áp dụng</option>
          <option value="false">Tạm ngưng (Không áp dụng)</option>
        </select>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor={`ghiChu-${mode}`}
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}
        >
          Ghi chú
        </label>
        <input
          id={`ghiChu-${mode}`}
          name="ghiChu"
          defaultValue={service?.ghiChu ?? ""}
          placeholder="Ghi chú áp dụng theo đầu người hay theo phòng..."
          maxLength={250}
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border-strong)",
            fontSize: 13,
            color: "var(--text-main)",
            background: "var(--bg-surface)",
          }}
        />
      </div>

      {state.error && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "var(--status-danger-bg)",
            border: "1px solid var(--status-danger-border)",
            color: "var(--status-danger-text)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12.5,
          }}
          role="alert"
        >
          {state.error}
        </div>
      )}
      {state.success && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "var(--status-success-bg)",
            border: "1px solid var(--status-success-border)",
            color: "var(--status-success-text)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12.5,
            fontWeight: 600,
          }}
          role="status"
        >
          {state.success}
        </div>
      )}

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 8,
        }}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "1px solid var(--border-strong)",
              background: "var(--bg-surface)",
              color: "var(--text-muted)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Hủy
          </button>
        )}
        <button
          type="submit"
          disabled={pending || readOnly}
          style={{
            padding: "9px 22px",
            borderRadius: 8,
            border: "none",
            background: "var(--primary)",
            color: "var(--bg-surface)",
            fontWeight: 700,
            fontSize: 13,
            cursor: pending || readOnly ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 6px rgba(24, 119, 242, 0.35)",
          }}
          title={readOnly ? "Bạn không có quyền sửa bảng giá dịch vụ" : undefined}
        >
          {pending ? (
            <>
              <LoaderCircle size={15} className="animate-spin" /> Đang lưu...
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
          if (
            !confirm(
              `Bạn có chắc chắn muốn xóa dịch vụ "${tenDichVu}"?\nThao tác này không thể hoàn tác.`
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="maDichVu" value={maDichVu} />
        <button
          type="submit"
          className={styles.dangerSmall}
          disabled={pending || readOnly}
          title={readOnly ? "Bạn không có quyền xóa dịch vụ" : "Xóa dịch vụ"}
        >
          {pending ? "Xóa..." : "Xóa"}
        </button>
      </form>
      {state.error && (
        <span className={styles.rowError} role="alert">
          {state.error}
        </span>
      )}
    </span>
  );
}

/** Hộp thoại Modal chỉnh sửa dịch vụ rộng rãi, không bị gò bó trong ô bảng */
export function ServiceEditorToggle({
  service,
  readOnly,
}: {
  service: ServiceFormData;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        className={styles.linkButton}
        type="button"
        onClick={() => setOpen(true)}
      >
        Sửa
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 18,
              maxWidth: 580,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--bg-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--primary)",
                color: "var(--bg-surface)",
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--bg-surface)" }}>
                  Chỉnh sửa dịch vụ
                </h3>
                <p style={{ fontSize: 12, margin: "2px 0 0", color: "var(--primary-subtle)", display: "flex", gap: 14 }}>
                  <span>Mã: {service.maDichVu}</span>
                  <span>{service.tenDichVu}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--bg-surface)",
                  opacity: 0.85,
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Body */}
            <div style={{ padding: 22 }}>
              <ServiceForm
                mode="edit"
                service={service}
                readOnly={readOnly}
                onSuccess={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Nút bấm 1-click chuyển đổi trạng thái Áp dụng / Không áp dụng */
export function ServiceStatusToggle({
  maDichVu,
  dangApDung,
  readOnly,
}: {
  maDichVu: string;
  dangApDung: boolean;
  readOnly?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(dangApDung);

  const handleToggle = async () => {
    if (readOnly || pending) return;
    setPending(true);
    try {
      const res = await toggleServiceStatus(maDichVu);
      if (!res.error) {
        setActive(!active);
      } else {
        alert(res.error);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={readOnly || pending}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        cursor: readOnly || pending ? "default" : "pointer",
        background: active ? "var(--status-success-bg)" : "var(--bg-subtle)",
        color: active ? "var(--status-success-text)" : "var(--text-muted)",
        border: `1px solid ${active ? "var(--status-success-border)" : "var(--border)"}`,
        transition: "all 0.2s ease",
      }}
      title={readOnly ? "Bạn không có quyền đổi trạng thái" : "Bấm để bật / tắt áp dụng dịch vụ này"}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "var(--status-success-text)" : "var(--text-muted)",
        }}
      />
      {pending ? "Đang đổi..." : active ? "Đang áp dụng" : "Không áp dụng"}
    </button>
  );
}
