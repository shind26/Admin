"use client";

import { useActionState, useState, useEffect } from "react";
import {
  LogOut,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  LoaderCircle,
  X,
  FileCheck,
  Zap,
  Droplets,
  Receipt,
  ShieldAlert,
  Ban,
  Clock,
  Info,
} from "lucide-react";
import {
  liquidateContract,
  rejectLiquidationRequest,
  type LiquidationFormState,
  type RejectLiquidationState,
} from "../actions";

const initialLiquidationState: LiquidationFormState = { error: null, success: null };
const initialRejectState: RejectLiquidationState = { error: null, success: null };

function money(num: number) {
  return `${Math.round(num).toLocaleString("vi-VN")} đ`;
}

export type LiquidationDialogProps = {
  maHopDong: string;
  maPhong: string;
  tenKhach: string;
  tienDatCoc: number;
  chiSoDienCu: number;
  chiSoNuocCu: number;
  unpaidTotal: number;
  ngayKtHopDong?: string | null;
  maThanhLy?: string;
  ngayTraPhongDuKien?: string;
  ghiChuYeuCau?: string | null;
  isPendingRequest?: boolean;
  triggerButtonText?: string;
  triggerButtonVariant?: "danger" | "warning" | "primary" | "compact";
  openInitially?: boolean;
};

export function LiquidationDialog({
  maHopDong,
  maPhong,
  tenKhach,
  tienDatCoc,
  chiSoDienCu,
  chiSoNuocCu,
  unpaidTotal,
  ngayKtHopDong,
  maThanhLy,
  ngayTraPhongDuKien,
  ghiChuYeuCau,
  isPendingRequest = false,
  triggerButtonText,
  triggerButtonVariant = "danger",
  openInitially = false,
}: LiquidationDialogProps) {
  const [open, setOpen] = useState(openInitially);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [state, formAction, pending] = useActionState(liquidateContract, initialLiquidationState);
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectLiquidationRequest,
    initialRejectState,
  );

  const [ngayTraPhong, setNgayTraPhong] = useState<string>(
    ngayTraPhongDuKien || new Date().toISOString().slice(0, 10),
  );
  const [chiSoDienDau, setChiSoDienDau] = useState<number>(chiSoDienCu);
  const [chiSoDienCuoi, setChiSoDienCuoi] = useState<number>(chiSoDienCu);
  const [chiSoNuocDau, setChiSoNuocDau] = useState<number>(chiSoNuocCu);
  const [chiSoNuocCuoi, setChiSoNuocCuoi] = useState<number>(chiSoNuocCu);
  const [donGiaDien, setDonGiaDien] = useState<number>(3500);
  const [donGiaNuoc, setDonGiaNuoc] = useState<number>(25000);
  const [tienKhauTru, setTienKhauTru] = useState<number>(0);
  const [lyDoKhauTru, setLyDoKhauTru] = useState<string>("");
  const [ghiChu, setGhiChu] = useState<string>("");

  // Logic nghiệp vụ di chuyển từ Mobile:
  // So sánh ngày trả phòng với ngày kết thúc hợp đồng
  // soNgayConLai = ngayKt - ngayTraPhong
  // Nếu soNgayConLai <= 30 => Đúng hạn => Hoàn cọc = tiền đặt cọc
  // Nếu soNgayConLai > 30 => Trước hạn => Mất cọc (hoàn cọc = 0)
  let diffDays = 0;
  let isDungHanAuto = true;
  if (ngayKtHopDong && ngayTraPhong) {
    const kt = new Date(ngayKtHopDong);
    const tra = new Date(ngayTraPhong);
    const dKt = new Date(kt.getFullYear(), kt.getMonth(), kt.getDate()).getTime();
    const dTra = new Date(tra.getFullYear(), tra.getMonth(), tra.getDate()).getTime();
    diffDays = Math.round((dKt - dTra) / (1000 * 60 * 60 * 24));
    isDungHanAuto = diffDays <= 30;
  }

  // Quản lý cọc hoàn trả (cho phép ghi đè nếu admin và cư dân có thỏa thuận)
  const [tienCocCoTheHoan, setTienCocCoTheHoan] = useState<number>(
    isDungHanAuto ? tienDatCoc : 0,
  );
  const [prevNgayTra, setPrevNgayTra] = useState(ngayTraPhong);

  if (ngayTraPhong !== prevNgayTra) {
    setPrevNgayTra(ngayTraPhong);
    setTienCocCoTheHoan(isDungHanAuto ? tienDatCoc : 0);
  }

  // Tính toán số liệu tiêu thụ & tiền
  const dienTieuThu = Math.max(0, chiSoDienCuoi - chiSoDienDau);
  const tienDien = dienTieuThu * donGiaDien;

  const nuocTieuThu = Math.max(0, chiSoNuocCuoi - chiSoNuocDau);
  const tienNuoc = nuocTieuThu * donGiaNuoc;

  const tienDienNuoc = tienDien + tienNuoc;
  const tongKhauTru = tienDienNuoc + unpaidTotal + tienKhauTru;
  const net = tienCocCoTheHoan - tongKhauTru;
  const tienCocHoanLai = net >= 0 ? net : 0;
  const tienKhTraThem = net < 0 ? Math.abs(net) : 0;

  const hinhThucThanhLy = isDungHanAuto ? "Đúng hạn" : "Trước hạn";

  const fullGhiChu = [
    `Hình thức: ${hinhThucThanhLy}${!isDungHanAuto ? ` (Trả sớm ${diffDays} ngày)` : ""}`,
    `Điện: ${chiSoDienDau} → ${chiSoDienCuoi} (${dienTieuThu} kWh x ${money(donGiaDien)} = ${money(tienDien)})`,
    `Nước: ${chiSoNuocDau} → ${chiSoNuocCuoi} (${nuocTieuThu} m³ x ${money(donGiaNuoc)} = ${money(tienNuoc)})`,
    lyDoKhauTru ? `Khấu trừ hư hại/dọn phòng: ${lyDoKhauTru} (${money(tienKhauTru)})` : null,
    ghiChuYeuCau ? `Ghi chú cư dân: ${ghiChuYeuCau}` : null,
    ghiChu ? `Ghi chú BQL: ${ghiChu}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  // Nút kích hoạt bên ngoài
  const renderTriggerButton = () => {
    if (triggerButtonVariant === "compact") {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: isPendingRequest ? "#F6E6B4" : "#EFF8FC",
            color: isPendingRequest ? "#92400E" : "#4A90C2",
            border: `1px solid ${isPendingRequest ? "#FDE68A" : "#DCEFF8"}`,
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {isPendingRequest ? <Clock size={13} /> : <FileCheck size={13} />}
          {triggerButtonText || (isPendingRequest ? "Duyệt thanh lý" : "Thanh lý")}
        </button>
      );
    }

    if (triggerButtonVariant === "warning") {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#4A90C2",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(74, 144, 194, 0.3)",
          }}
        >
          <FileCheck size={16} /> {triggerButtonText || "Nghiệm thu & Thanh lý phòng"}
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
          background: "#4A90C2",
          color: "#ffffff",
          border: "none",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(74, 144, 194, 0.3)",
        }}
      >
        <LogOut size={16} /> {triggerButtonText || "Thanh lý hợp đồng & Trả phòng"}
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
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
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
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 720,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #DCEFF8",
            }}
          >
            {/* Header: Sky Blue (#76B5D8 / #4A90C2) */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #DCEFF8",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(135deg, #4A90C2 0%, #76B5D8 100%)",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                color: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    color: "#ffffff",
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileCheck size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#ffffff" }}>
                    Biên bản Thanh lý Hợp đồng & Check-out
                  </h2>
                  <p style={{ fontSize: 12, margin: "2px 0 0", color: "#EFF8FC" }}>
                    Phòng {maPhong} • Khách thuê: {tenKhach} • HĐ: {maHopDong}
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
                  color: "#ffffff",
                  opacity: 0.85,
                  padding: 4,
                }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Banner yêu cầu trả phòng từ Mobile nếu có */}
            {isPendingRequest && (
              <div
                style={{
                  background: "#F6E6B4",
                  borderBottom: "1px solid #FDE68A",
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#92400E" }}>
                  <Clock size={16} />
                  <span>
                    <strong>Yêu cầu trả phòng từ Cư dân (Mobile):</strong> Ngày dự kiến:{" "}
                    <strong>{ngayTraPhongDuKien || ngayTraPhong}</strong>
                    {ghiChuYeuCau ? ` • Lý do: "${ghiChuYeuCau}"` : ""}
                  </span>
                </div>
                {!showRejectForm && (
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    style={{
                      background: "#FDE8E8",
                      color: "#991B1B",
                      border: "1px solid #FCA5A5",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ban size={13} /> Từ chối yêu cầu
                  </button>
                )}
              </div>
            )}

            {/* Form từ chối yêu cầu nếu được bật */}
            {showRejectForm && (
              <form
                action={rejectAction}
                style={{
                  padding: "16px 20px",
                  background: "#FDE8E8",
                  borderBottom: "1px solid #FCA5A5",
                }}
              >
                <input type="hidden" name="maHopDong" value={maHopDong} />
                <input type="hidden" name="maThanhLy" value={maThanhLy || ""} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>
                  Xác nhận Từ chối yêu cầu trả phòng của cư dân
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input
                    type="text"
                    name="lyDo"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập lý do từ chối (VD: Chưa thanh toán tiền điện tháng này, tài sản chưa bàn giao...)"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #F87171",
                      fontSize: 12.5,
                      background: "#ffffff",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #CBD5E1",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={rejectPending}
                    style={{
                      background: "#DC2626",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: rejectPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {rejectPending ? "Đang xử lý..." : "Xác nhận từ chối"}
                  </button>
                </div>
              </form>
            )}

            {/* Thông báo trạng thái từ chối */}
            {rejectState.error && (
              <div
                style={{
                  margin: "16px 20px 0",
                  background: "#FDE8E8",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                  padding: "10px 14px",
                  borderRadius: 8,
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
                  background: "#E6F4EA",
                  border: "1px solid #86EFAC",
                  color: "#166534",
                  padding: "12px 14px",
                  borderRadius: 8,
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

            {/* Form Thanh lý chính */}
            <form action={formAction} style={{ padding: 20 }}>
              <input type="hidden" name="maHopDong" value={maHopDong} />
              {maThanhLy && <input type="hidden" name="maThanhLy" value={maThanhLy} />}
              <input type="hidden" name="ngayTraPhong" value={ngayTraPhong} />
              <input type="hidden" name="chiSoDienCuoi" value={chiSoDienCuoi} />
              <input type="hidden" name="chiSoNuocCuoi" value={chiSoNuocCuoi} />
              <input type="hidden" name="tienCocHoanLai" value={tienCocHoanLai} />
              <input type="hidden" name="tienKhTraThem" value={tienKhTraThem} />
              <input type="hidden" name="ghiChu" value={fullGhiChu} />

              {state.error && (
                <div
                  style={{
                    background: "#FDE8E8",
                    border: "1px solid #FCA5A5",
                    color: "#991B1B",
                    padding: "10px 14px",
                    borderRadius: 8,
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
                    background: "#E6F4EA",
                    border: "1px solid #86EFAC",
                    color: "#166534",
                    padding: "12px 14px",
                    borderRadius: 8,
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

              {/* Thông tin ngày & điều kiện hoàn cọc (Theo chuẩn nghiệp vụ Mobile App) */}
              <div
                style={{
                  background: "#EFF8FC",
                  border: "1px solid #DCEFF8",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#425B6B", marginBottom: 5 }}>
                      Ngày trả phòng & bàn giao *
                    </label>
                    <input
                      type="date"
                      value={ngayTraPhong}
                      onChange={(e) => setNgayTraPhong(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        fontSize: 13,
                        color: "#0F172A",
                        background: "#ffffff",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#425B6B", marginBottom: 5 }}>
                      Tiền đặt cọc ban đầu theo HĐ
                    </label>
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #DCEFF8",
                        fontWeight: 700,
                        color: "#0F172A",
                        fontSize: 13,
                      }}
                    >
                      {money(tienDatCoc)}
                    </div>
                  </div>
                </div>

                {/* Khung đánh giá Đúng hạn / Trước hạn */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: isDungHanAuto ? "#E6F4EA" : "#F6E6B4",
                    border: `1px solid ${isDungHanAuto ? "#BBF7D0" : "#FDE68A"}`,
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: isDungHanAuto ? "#166534" : "#92400E" }}>
                      • Phân loại thanh lý: {hinhThucThanhLy}
                      {ngayKtHopDong ? ` (Còn ${diffDays} ngày đến hạn HĐ)` : ""}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: isDungHanAuto ? "#22C55E" : "#F59E0B",
                        color: "#ffffff",
                      }}
                    >
                      {isDungHanAuto ? "Đủ điều kiện hoàn cọc" : "Mất cọc theo HĐ"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#425B6B", lineHeight: 1.4 }}>
                    {isDungHanAuto ? (
                      <span>Cư dân trả phòng trong vòng 30 ngày trước khi hết hạn hoặc sau ngày hết hạn. Đủ điều kiện hoàn trả cọc.</span>
                    ) : (
                      <span>Cư dân dọn đi trước thời hạn trên 30 ngày ({diffDays} ngày). Theo quy định hợp đồng, cư dân bị mất tiền cọc ban đầu.</span>
                    )}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#425B6B" }}>
                      Số tiền cọc áp dụng để hoàn trả:
                    </label>
                    <input
                      type="number"
                      step={50000}
                      min={0}
                      max={tienDatCoc}
                      value={tienCocCoTheHoan}
                      onChange={(e) => setTienCocCoTheHoan(Number(e.target.value) || 0)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #CBD5E1",
                        fontWeight: 700,
                        fontSize: 12.5,
                        width: 140,
                        background: "#ffffff",
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#64748B" }}>
                      (Mặc định: {isDungHanAuto ? money(tienDatCoc) : "0 đ"}, admin có thể linh hoạt điều chỉnh)
                    </span>
                  </div>
                </div>
              </div>

              {/* Phần 1: Chốt chỉ số điện & nước */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #DCEFF8",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#4A90C2", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={16} /> 1. Chốt chỉ số Điện & Nước cuối phòng
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {/* Điện */}
                  <div style={{ background: "#ffffff", padding: 12, borderRadius: 8, border: "1px solid #DCEFF8" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#425B6B", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                      <Zap size={14} color="#EAB308" /> Điện tiêu thụ
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 3 }}>
                          Số đầu (kWh)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={chiSoDienDau}
                          onChange={(e) => setChiSoDienDau(Number(e.target.value) || 0)}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 3 }}>
                          Số cuối (kWh) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={chiSoDienCuoi}
                          onChange={(e) => setChiSoDienCuoi(Number(e.target.value) || 0)}
                          required
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontWeight: 700, fontSize: 12 }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 3 }}>
                        Đơn giá (đ/kWh)
                      </label>
                      <input
                        type="number"
                        step={100}
                        value={donGiaDien}
                        onChange={(e) => setDonGiaDien(Number(e.target.value) || 0)}
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, borderTop: "1px dashed #DCEFF8", paddingTop: 6, marginTop: 6 }}>
                      Dùng: {dienTieuThu} số = <strong>{money(tienDien)}</strong>
                    </div>
                  </div>

                  {/* Nước */}
                  <div style={{ background: "#ffffff", padding: 12, borderRadius: 8, border: "1px solid #DCEFF8" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#425B6B", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                      <Droplets size={14} color="#0284C7" /> Nước tiêu thụ
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 3 }}>
                          Số đầu (m³)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={chiSoNuocDau}
                          onChange={(e) => setChiSoNuocDau(Number(e.target.value) || 0)}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 3 }}>
                          Số cuối (m³) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={chiSoNuocCuoi}
                          onChange={(e) => setChiSoNuocCuoi(Number(e.target.value) || 0)}
                          required
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontWeight: 700, fontSize: 12 }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 3 }}>
                        Đơn giá (đ/m³)
                      </label>
                      <input
                        type="number"
                        step={500}
                        value={donGiaNuoc}
                        onChange={(e) => setDonGiaNuoc(Number(e.target.value) || 0)}
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, borderTop: "1px dashed #DCEFF8", paddingTop: 6, marginTop: 6 }}>
                      Dùng: {nuocTieuThu} m³ = <strong>{money(tienNuoc)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phần 2: Hóa đơn chưa thanh toán & Bồi thường */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #DCEFF8",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#4A90C2", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Receipt size={16} /> 2. Các khoản khấu trừ khác
                </div>

                {unpaidTotal > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "#FDE8E8",
                      borderRadius: 6,
                      fontSize: 12.5,
                      color: "#991B1B",
                      fontWeight: 600,
                      marginBottom: 10,
                    }}
                  >
                    <span>Tiền hóa đơn còn nợ chưa thanh toán:</span>
                    <span>- {money(unpaidTotal)}</span>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#425B6B", marginBottom: 4 }}>
                      Khấu trừ hư hao tài sản / dọn vệ sinh (nếu có)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={tienKhauTru}
                      onChange={(e) => setTienKhauTru(Number(e.target.value) || 0)}
                      placeholder="0"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#425B6B", marginBottom: 4 }}>
                      Lý do khấu trừ hư hại
                    </label>
                    <input
                      type="text"
                      value={lyDoKhauTru}
                      onChange={(e) => setLyDoKhauTru(e.target.value)}
                      placeholder="VD: Mất chìa khóa, làm trầy xước bàn ghế..."
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #CBD5E1" }}
                    />
                  </div>
                </div>
              </div>

              {/* Phần 3: Bảng Quyết toán cọc */}
              <div
                style={{
                  background: net >= 0 ? "#E6F4EA" : "#F6E6B4",
                  border: `2px solid ${net >= 0 ? "#86EFAC" : "#FDE68A"}`,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: net >= 0 ? "#166534" : "#92400E",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Calculator size={16} /> BẢNG QUYẾT TOÁN CỌC KẾT THÚC HỢP ĐỒNG
                </div>

                <div style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>(+) Tiền cọc được hoàn trả theo điều khoản:</span>
                    <strong>{money(tienCocCoTheHoan)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#DC2626" }}>
                    <span>(-) Tiền điện nước chốt ngày trả phòng:</span>
                    <span>- {money(tienDienNuoc)}</span>
                  </div>
                  {unpaidTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#DC2626" }}>
                      <span>(-) Hóa đơn tồn đọng chưa thanh toán:</span>
                      <span>- {money(unpaidTotal)}</span>
                    </div>
                  )}
                  {tienKhauTru > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#DC2626" }}>
                      <span>(-) Khấu trừ hư hại / dọn phòng:</span>
                      <span>- {money(tienKhauTru)}</span>
                    </div>
                  )}

                  <div
                    style={{
                      borderTop: "1px dashed #CBD5E1",
                      paddingTop: 8,
                      marginTop: 4,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 15,
                      fontWeight: 800,
                      color: net >= 0 ? "#15803D" : "#C2410C",
                    }}
                  >
                    <span>{net >= 0 ? "👉 SỐ TIỀN BQL HOÀN LẠI KHÁCH:" : "👉 SỐ TIỀN KHÁCH PHẢI TRẢ THÊM:"}</span>
                    <span>{money(net >= 0 ? tienCocHoanLai : tienKhTraThem)}</span>
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#425B6B", marginBottom: 4 }}>
                  Ghi chú bàn giao thêm từ BQL
                </label>
                <textarea
                  rows={2}
                  value={ghiChu}
                  onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="Khách đã bàn giao đủ chìa khóa, thẻ từ, phòng vệ sinh sạch sẽ..."
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #CBD5E1" }}
                />
              </div>

              {/* Thông báo thu hồi quyền */}
              <div
                style={{
                  fontSize: 12,
                  color: "#425B6B",
                  background: "#F1F4F8",
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ShieldAlert size={16} color="#4A90C2" />
                Khi xác nhận: Hợp đồng kết thúc, Phòng <strong>{maPhong}</strong> tự động chuyển sang <strong>Trống</strong>, cư dân chuyển sang <strong>Cựu cư dân</strong> và nhận được thông báo nghiệm thu.
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    background: "#ffffff",
                    color: "#425B6B",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#4A90C2",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: pending ? "not-allowed" : "pointer",
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {pending ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" /> Đang xử lý...
                    </>
                  ) : (
                    <>
                      <FileCheck size={16} /> Xác nhận Thanh lý & Bàn giao phòng
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
