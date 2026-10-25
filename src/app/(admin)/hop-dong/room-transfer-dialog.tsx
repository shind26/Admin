"use client";

import { useActionState, useState } from "react";
import {
  ArrowRightLeft,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  LoaderCircle,
  X,
  FileCheck,
  Building,
  Ban,
  Clock,
  Zap,
  Droplets,
  DollarSign,
  Calendar,
} from "lucide-react";
import {
  approveRoomTransfer,
  rejectRoomTransfer,
  type RoomTransferState,
} from "./actions";

const initialTransferState: RoomTransferState = { error: null, success: null };

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
  triggerButtonVariant?: "primary" | "warning" | "compact";
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
    if (triggerButtonVariant === "compact") {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: isFromMobileRequest ? "#F6E6B4" : "#EFF8FC",
            color: isFromMobileRequest ? "#92400E" : "#4A90C2",
            border: `1px solid ${isFromMobileRequest ? "#FDE68A" : "#DCEFF8"}`,
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
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
          background: isFromMobileRequest ? "#F6E6B4" : "#4A90C2",
          color: isFromMobileRequest ? "#92400E" : "#ffffff",
          border: isFromMobileRequest ? "1px solid #FDE68A" : "none",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(74, 144, 194, 0.2)",
        }}
      >
        <ArrowRightLeft size={16} />
        {triggerButtonText || (isFromMobileRequest ? "⚡ Nghiệm thu & Duyệt đổi phòng" : "Đổi phòng (Lập phụ lục)")}
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
            {/* Header with Sky Blue gradient */}
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
                  <ArrowRightLeft size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#ffffff" }}>
                    Chuyển đổi phòng & Lập Phụ lục Hợp đồng
                  </h2>
                  <p style={{ fontSize: 12, margin: "2px 0 0", color: "#EFF8FC" }}>
                    Khách: {tenKhach} • Phòng hiện tại: {tenPhongCu || maPhongCu} • HĐ: {maHopDong}
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

            {/* Banner nếu có đơn yêu cầu từ Mobile */}
            {isFromMobileRequest && (
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
                    <strong>Yêu cầu chuyển phòng từ Mobile:</strong> Chuyển sang{" "}
                    <strong>{maPhongMoiDuKien}</strong> (Hẹn ngày: <strong>{ngayHenDuKien || ngayChuyen}</strong>)
                    {lyDoChuyen ? ` • Lý do: "${lyDoChuyen}"` : ""}
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

            {/* Form từ chối nếu bật */}
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
                <input type="hidden" name="maYeuCau" value={maYeuCau || ""} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>
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
                    background: "#EFF8FC",
                    border: "1px solid #DCEFF8",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4A90C2", marginBottom: 6, textTransform: "uppercase" }}>
                    Phòng hiện tại (Phòng cũ)
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
                    {tenPhongCu || maPhongCu}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#425B6B" }}>
                    Giá thuê: <strong>{money(giaThueCu)}</strong> / tháng
                  </div>
                  <div style={{ fontSize: 12.5, color: "#425B6B", marginTop: 2 }}>
                    Tiền cọc đang giữ: <strong>{money(tienDatCocCu)}</strong>
                  </div>
                </div>

                {/* Phòng mới */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #DCEFF8",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#059669", marginBottom: 6, textTransform: "uppercase" }}>
                    Phòng mới chuyển đến *
                  </div>
                  <select
                    value={selectedRoomCode}
                    onChange={(e) => setSelectedRoomCode(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0F172A",
                      background: "#ffffff",
                      marginBottom: 6,
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
                  <div style={{ fontSize: 12.5, color: "#425B6B" }}>
                    Giá thuê mới: <strong>{money(giaThueMoi)}</strong> / tháng
                  </div>
                  <div style={{ fontSize: 12.5, color: "#425B6B", marginTop: 2 }}>
                    Tiền cọc định mức mới: <strong>{money(tienCocPhongMoi)}</strong>
                  </div>
                </div>
              </div>

              {/* Ngày chuyển phòng */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#425B6B", marginBottom: 5 }}>
                  Ngày hẹn dọn sang phòng mới *
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="date"
                    value={ngayChuyen}
                    onChange={(e) => setNgayChuyen(e.target.value)}
                    required
                    style={{
                      width: 220,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      fontSize: 13,
                      color: "#0F172A",
                      background: "#ffffff",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    (Quy chuẩn Mobile: Ưu tiên ngày 01 đầu tháng để đồng bộ kỳ tính phí điện nước)
                  </span>
                </div>
              </div>

              {/* Nghiệm thu & Chốt số phòng cũ */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #DCEFF8",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#4A90C2", marginBottom: 10 }}>
                  Nghiệm thu điện nước & cơ sở vật chất phòng cũ (nếu có)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#425B6B", marginBottom: 4 }}>
                      Tiền điện nước phòng cũ phát sinh
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={tienDienNuocCu}
                      onChange={(e) => setTienDienNuocCu(Number(e.target.value) || 0)}
                      placeholder="0"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #CBD5E1" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#425B6B", marginBottom: 4 }}>
                      Khấu trừ hư hại tài sản phòng cũ
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      value={tienHuHaiCu}
                      onChange={(e) => setTienHuHaiCu(Number(e.target.value) || 0)}
                      placeholder="0"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #CBD5E1" }}
                    />
                  </div>
                </div>
              </div>

              {/* Bảng tính toán cọc chuyển tiếp & Chênh lệch */}
              <div
                style={{
                  background: "#EFF8FC",
                  border: "1px solid #DCEFF8",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#4A90C2", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Calculator size={16} /> QUYẾT TOÁN CỌC & BẢO LƯU CHUYỂN PHÒNG
                </div>
                <div style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Tiền cọc phòng cũ được bảo lưu 100%:</span>
                    <strong>{money(tienDatCocCu)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Tiền cọc định mức của phòng mới:</span>
                    <strong>{money(tienCocPhongMoi)}</strong>
                  </div>
                  <div
                    style={{
                      borderTop: "1px dashed #CBD5E1",
                      paddingTop: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      color: chenhLechTienCoc > 0 ? "#C2410C" : chenhLechTienCoc < 0 ? "#15803D" : "#425B6B",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {chenhLechTienCoc > 0
                        ? "👉 Cư dân cần đóng bổ sung tiền cọc:"
                        : chenhLechTienCoc < 0
                        ? "👉 BQL hoàn trả lại tiền cọc chênh lệch:"
                        : "👉 Tiền cọc được giữ nguyên (không chênh lệch):"}
                    </span>
                    <span>{money(Math.abs(chenhLechTienCoc))}</span>
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#425B6B", marginBottom: 4 }}>
                  Ghi chú nội dung điều chỉnh Phụ lục
                </label>
                <input
                  type="text"
                  value={ghiChu}
                  onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="Khách chuyển sang phòng thoáng hơn, giữ nguyên thời hạn kết thúc hợp đồng..."
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #CBD5E1" }}
                />
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
                  disabled={pending || !selectedRoomCode}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#4A90C2",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: pending || !selectedRoomCode ? "not-allowed" : "pointer",
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
                      <FileCheck size={16} /> Xác nhận chuyển phòng & Lập Phụ lục
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

