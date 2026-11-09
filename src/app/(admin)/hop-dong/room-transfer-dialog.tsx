"use client";

import { useActionState, useState } from "react";
import {
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  X,
  FileCheck,
  Ban,
  Clock,
  Calculator,
} from "lucide-react";
import {
  approveRoomTransfer,
  rejectRoomTransfer,
  type RoomTransferState,
} from "./actions";

const initialTransferState: RoomTransferState = { error: null, success: null };

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return String(d);
    return dateObj.toLocaleDateString("vi-VN");
  } catch {
    return String(d);
  }
}

function money(num: number | string | null | undefined) {
  if (!num) return "0 đ";
  return `${Math.round(Number(num)).toLocaleString("vi-VN")} đ`;
}

export type RoomOptionSimple = {
  ma_phong: string;
  ten_hien_thi: string | null;
  gia_thue: string | null;
  tien_dat_coc: string | null;
  toa_nha: string | null;
};

export type RoomTransferDialogProps = {
  maHopDong: string;
  maPhongCu: string;
  tenPhongCu?: string;
  tenKhach: string;
  giaThueCu: number;
  tienDatCocCu: number;
  emptyRooms: RoomOptionSimple[];
  maYeuCau?: string;
  maPhongMoiDuKien?: string;
  ngayHenDuKien?: string;
  lyDoChuyen?: string | null;
  isFromMobileRequest?: boolean;
  triggerButtonText?: string;
  triggerButtonVariant?: "primary" | "warning" | "compact" | "table";
  openInitially?: boolean;
};

export function RoomTransferDialog({
  maHopDong,
  maPhongCu,
  tenPhongCu,
  tenKhach,
  giaThueCu,
  tienDatCocCu,
  emptyRooms,
  maYeuCau,
  maPhongMoiDuKien,
  ngayHenDuKien,
  lyDoChuyen,
  isFromMobileRequest = false,
  triggerButtonText,
  triggerButtonVariant = "primary",
  openInitially = false,
}: RoomTransferDialogProps) {
  const [open, setOpen] = useState(openInitially);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [state, formAction, pending] = useActionState(approveRoomTransfer, initialTransferState);
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRoomTransfer,
    initialTransferState,
  );

  // Mặc định ngày chuyển: Ngày hẹn từ Mobile hoặc ngày 01 tháng sau
  const [ngayChuyen, setNgayChuyen] = useState<string>(() => {
    if (ngayHenDuKien) return ngayHenDuKien.slice(0, 10);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString().slice(0, 10);
  });

  // Chọn phòng mới
  const [selectedRoomCode, setSelectedRoomCode] = useState<string>(
    maPhongMoiDuKien || (emptyRooms.length > 0 ? emptyRooms[0].ma_phong : ""),
  );

  const targetRoom = emptyRooms.find((r) => r.ma_phong === selectedRoomCode);
  const giaThueMoi = targetRoom ? Number(targetRoom.gia_thue) || 0 : 0;
  const tienCocPhongMoi = targetRoom ? (Number(targetRoom.tien_dat_coc) || giaThueMoi) : 0;

  // Chênh lệch cọc = Cọc phòng mới - Cọc phòng cũ đang giữ
  const chenhLechTienCoc = tienCocPhongMoi - tienDatCocCu;

  // Nghiệm thu số cũ (nếu có)
  const [tienDienNuocCu, setTienDienNuocCu] = useState<number>(0);
  const [tienHuHaiCu, setTienHuHaiCu] = useState<number>(0);
  const [ghiChu, setGhiChu] = useState<string>("");

  const renderTriggerButton = () => {
    if (triggerButtonVariant === "table") {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "var(--primary)",
            color: "var(--bg-surface)",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s ease",
          }}
        >
          <ArrowRightLeft size={13} />
          {triggerButtonText || (isFromMobileRequest ? "Nghiệm thu & Duyệt" : "Đổi phòng")}
        </button>
      );
    }

    if (triggerButtonVariant === "compact") {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            border: "1px solid var(--primary-subtle)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <ArrowRightLeft size={13} />
          {triggerButtonText || (isFromMobileRequest ? "Duyệt đổi phòng" : "Đổi phòng")}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--primary)",
          color: "var(--bg-surface)",
          border: "none",
          borderRadius: 6,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(24, 119, 242, 0.25)",
          transition: "background 0.15s ease",
        }}
      >
        <ArrowRightLeft size={15} />
        {triggerButtonText || (isFromMobileRequest ? "Nghiệm thu & Duyệt" : "Đổi phòng (Lập phụ lục)")}
      </button>
    );
  };

  return (
    <>
      {renderTriggerButton()}

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending && !rejectPending) setOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 12,
              maxWidth: 680,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 12px 28px 0 rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Header: Facebook Blue Solid */}
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--primary)",
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                color: "var(--bg-surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    color: "var(--bg-surface)",
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--bg-surface)", letterSpacing: "-0.2px" }}>
                    Chuyển đổi phòng & Lập Phụ lục Hợp đồng
                  </h2>
                  <p style={{ fontSize: 12.5, margin: "2px 0 0", color: "var(--primary-subtle)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>Khách: {tenKhach}</span>
                    <span>Phòng hiện tại: {tenPhongCu || maPhongCu}</span>
                    <span>HĐ: {maHopDong}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending || rejectPending}
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
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Banner nếu có đơn yêu cầu từ Mobile */}
            {isFromMobileRequest && (
              <div
                style={{
                  background: "var(--primary-subtle)",
                  borderBottom: "1px solid var(--primary-subtle)",
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--primary)" }}>
                  <Clock size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ color: "var(--text-main)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--primary)" }}>Yêu cầu từ Mobile:</strong> Chuyển sang{" "}
                    <strong>{maPhongMoiDuKien}</strong> (Hẹn ngày: <strong>{formatDate(ngayHenDuKien || ngayChuyen)}</strong>)
                    {lyDoChuyen ? `    Lý do: "${lyDoChuyen}"` : ""}
                  </span>
                </div>
                {!showRejectForm && (
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    style={{
                      background: "var(--status-danger-bg)",
                      color: "var(--status-danger-text)",
                      border: "1px solid var(--status-danger-border)",
                      borderRadius: 6,
                      padding: "5px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <Ban size={13} /> Từ chối yêu cầu
                  </button>
                )}
              </div>
            )}

            {/* Form từ chối nếu bật */}
            {showRejectForm && (
              <form
                action={rejectAction}
                style={{
                  padding: "16px 20px",
                  background: "var(--status-danger-bg)",
                  borderBottom: "1px solid var(--status-danger-border)",
                }}
              >
                <input type="hidden" name="maHopDong" value={maHopDong} />
                <input type="hidden" name="maYeuCau" value={maYeuCau || ""} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--status-danger-text)", marginBottom: 6 }}>
                  Xác nhận Từ chối yêu cầu chuyển phòng của cư dân
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input
                    type="text"
                    name="lyDo"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập lý do từ chối (VD: Phòng mới đã có người đặt cọc, chưa thanh toán hết nợ cũ...)"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--status-danger-border)",
                      fontSize: 13,
                      background: "var(--bg-surface)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 6,
                      padding: "6px 14px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={rejectPending}
                    style={{
                      background: "var(--status-danger-text)",
                      color: "var(--bg-surface)",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 16px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: rejectPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {rejectPending ? "Đang xử lý..." : "Xác nhận từ chối"}
                  </button>
                </div>
              </form>
            )}

            {rejectState.error && (
              <div
                style={{
                  margin: "16px 20px 0",
                  background: "var(--status-danger-bg)",
                  border: "1px solid var(--status-danger-border)",
                  color: "var(--status-danger-text)",
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertTriangle size={16} /> {rejectState.error}
              </div>
            )}
            {rejectState.success && (
              <div
                style={{
                  margin: "16px 20px 0",
                  background: "var(--status-success-bg)",
                  border: "1px solid var(--status-success-border)",
                  color: "var(--status-success-text)",
                  padding: "12px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CheckCircle2 size={18} /> {rejectState.success}
              </div>
            )}

            {/* Form Phê duyệt chuyển phòng */}
            <form action={formAction} style={{ padding: 20 }}>
              <input type="hidden" name="maHopDong" value={maHopDong} />
              <input type="hidden" name="maPhongCu" value={maPhongCu} />
              <input type="hidden" name="maPhongMoi" value={selectedRoomCode} />
              <input type="hidden" name="ngayChuyen" value={ngayChuyen} />
              <input type="hidden" name="giaThueMoi" value={giaThueMoi} />
              <input type="hidden" name="chenhLechTienCoc" value={chenhLechTienCoc} />
              <input type="hidden" name="tienDienNuocCu" value={tienDienNuocCu} />
              <input type="hidden" name="tienHuHaiCu" value={tienHuHaiCu} />
              <input type="hidden" name="ghiChu" value={ghiChu} />
              {maYeuCau && <input type="hidden" name="maYeuCau" value={maYeuCau} />}

              {state.error && (
                <div
                  style={{
                    background: "var(--status-danger-bg)",
                    border: "1px solid var(--status-danger-border)",
                    color: "var(--status-danger-text)",
                    padding: "10px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={16} /> {state.error}
                </div>
              )}

              {state.success && (
                <div
                  style={{
                    background: "var(--status-success-bg)",
                    border: "1px solid var(--status-success-border)",
                    color: "var(--status-success-text)",
                    padding: "12px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={18} /> {state.success}
                </div>
              )}

              {/* So sánh phòng cũ vs phòng mới */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                {/* Phòng cũ */}
                <div
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    Phòng hiện tại (Phòng cũ)
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                    {tenPhongCu || maPhongCu}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Giá thuê: <strong style={{ color: "var(--text-main)" }}>{money(giaThueCu)}</strong> / tháng
                    <br />
                    Tiền cọc đang giữ: <strong style={{ color: "var(--text-main)" }}>{money(tienDatCocCu)}</strong>
                  </div>
                </div>

                {/* Phòng mới */}
                <div
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)", marginBottom: 6, textTransform: "uppercase" }}>
                    Phòng mới chuyển đến
                  </div>
                  <select
                    value={selectedRoomCode}
                    onChange={(e) => setSelectedRoomCode(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: 38,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-strong)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-main)",
                      background: "var(--bg-surface)",
                      marginBottom: 8,
                    }}
                  >
                    {emptyRooms.length === 0 && (
                      <option value="">Không có phòng trống nào khả dụng</option>
                    )}
                    {emptyRooms.map((r) => (
                      <option key={r.ma_phong} value={r.ma_phong}>
                        {r.ten_hien_thi || r.ma_phong} ({r.toa_nha || "Nhà trọ"}) - {money(r.gia_thue)}/th
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Giá thuê mới: <strong style={{ color: "var(--text-main)" }}>{money(giaThueMoi)}</strong> / tháng
                    <br />
                    Tiền cọc định mức mới: <strong style={{ color: "var(--text-main)" }}>{money(tienCocPhongMoi)}</strong>
                  </div>
                </div>
              </div>

              {/* Ngày chuyển phòng */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-main)", marginBottom: 5 }}>
                  Ngày hẹn dọn sang phòng mới
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="date"
                    value={ngayChuyen}
                    onChange={(e) => setNgayChuyen(e.target.value)}
                    required
                    style={{
                      width: 220,
                      height: 38,
                      padding: "0 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border-strong)",
                      fontSize: 13,
                      color: "var(--text-main)",
                      background: "var(--bg-surface)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    (Ưu tiên ngày 01 đầu tháng để đồng bộ kỳ tính phí điện nước)
                  </span>
                </div>
              </div>

              {/* Nghiệm thu & Chốt số phòng cũ */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 10 }}>
                  Nghiệm thu điện nước &amp; cơ sở vật chất phòng cũ (nếu có)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                      Tiền điện nước phòng cũ phát sinh
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={tienDienNuocCu}
                      onChange={(e) => setTienDienNuocCu(Number(e.target.value) || 0)}
                      placeholder="0"
                      style={{
                        width: "100%",
                        height: 38,
                        padding: "0 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border-strong)",
                        fontSize: 13,
                        color: "var(--text-main)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                      Khấu trừ hư hại tài sản phòng cũ
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      value={tienHuHaiCu}
                      onChange={(e) => setTienHuHaiCu(Number(e.target.value) || 0)}
                      placeholder="0"
                      style={{
                        width: "100%",
                        height: 38,
                        padding: "0 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border-strong)",
                        fontSize: 13,
                        color: "var(--text-main)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Bảng tính toán cọc chuyển tiếp & Chênh lệch */}
              <div
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Calculator size={15} /> QUYẾT TOÁN CỌC &amp; BẢO LƯU CHUYỂN PHÒNG
                </div>
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6, color: "var(--text-main)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Tiền cọc phòng cũ được bảo lưu 100%:</span>
                    <strong>{money(tienDatCocCu)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Tiền cọc định mức của phòng mới:</span>
                    <strong>{money(tienCocPhongMoi)}</strong>
                  </div>
                  <div
                    style={{
                      borderTop: "1px solid var(--border-strong)",
                      paddingTop: 8,
                      marginTop: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13.5,
                      fontWeight: 700,
                    }}
                  >
                    <span>
                      {chenhLechTienCoc > 0
                        ? "Cư dân cần đóng bổ sung tiền cọc:"
                        : chenhLechTienCoc < 0
                        ? "BQL hoàn trả lại tiền cọc chênh lệch:"
                        : "Tiền cọc được giữ nguyên (không chênh lệch):"}
                    </span>
                    <span style={{ color: chenhLechTienCoc > 0 ? "var(--status-danger-text)" : chenhLechTienCoc < 0 ? "var(--status-success-text)" : "var(--text-main)" }}>
                      {money(Math.abs(chenhLechTienCoc))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
                  Ghi chú nội dung điều chỉnh Phụ lục
                </label>
                <input
                  type="text"
                  value={ghiChu}
                  onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="Khách chuyển sang phòng thoáng hơn, giữ nguyên thời hạn kết thúc hợp đồng..."
                  style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-strong)",
                    fontSize: 13,
                    color: "var(--text-main)",
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--border)",
                    color: "var(--text-main)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={pending || !selectedRoomCode}
                  style={{
                    padding: "9px 22px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--primary)",
                    color: "var(--bg-surface)",
                    fontWeight: 700,
                    cursor: pending || !selectedRoomCode ? "not-allowed" : "pointer",
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 4px rgba(24, 119, 242, 0.3)",
                  }}
                >
                  {pending ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" /> Đang xử lý...
                    </>
                  ) : (
                    <>
                      <FileCheck size={15} /> Xác nhận chuyển phòng &amp; Lập Phụ lục
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
