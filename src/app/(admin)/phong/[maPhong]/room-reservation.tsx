"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookmarkCheck, Lock, Unlock, AlertTriangle, FileCheck, CheckCircle2, LoaderCircle, X, Copy, Check, UserX, Smartphone } from "lucide-react";
import type { RoomReservationDetail, TenantOption } from "@/lib/queries";
import { HandoverItemsEditor } from "@/components/handover-items-editor";
import { reserveRoom, cancelReservation, convertReservationToContract, type ReservationFormState } from "../actions";
import type { ContractFormState } from "@/app/(admin)/hop-dong/actions";

const initialResState: ReservationFormState = { error: null, success: null };
const initialContractState: ContractFormState = { error: null, success: null };

function money(num: number | string | null | undefined) {
  if (!num) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
}

function date(str: string | null | undefined) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("vi-VN");
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayAfter(dateStr?: string | null) {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function RoomReservationManager({
  maPhong,
  tenPhong,
  trangThaiPhong,
  giaThueNiemYet,
  tienDatCocNiemYet,
  reservation,
  noiThatSanCo,
}: {
  maPhong: string;
  tenPhong: string;
  trangThaiPhong: string;
  giaThueNiemYet: string | null;
  tienDatCocNiemYet: string | null;
  reservation: RoomReservationDetail | null;
  tenants: TenantOption[];
  noiThatSanCo?: string[] | null;
}) {
  const router = useRouter();

  // Modals
  const [openConvertModal, setOpenConvertModal] = useState(false);
  const [openCancelModal, setOpenCancelModal] = useState(false);
  const [openManualReserveModal, setOpenManualReserveModal] = useState(false);

  // Convert reservation to contract states
  const [contractState, contractAction, contractPending] = useActionState(
    convertReservationToContract,
    initialContractState,
  );

  const initialMoveInDate = reservation?.ngay_du_kien_o
    ? reservation.ngay_du_kien_o.slice(0, 10)
    : reservation?.ngay_het_han
      ? reservation.ngay_het_han.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const [ngayKy, setNgayKy] = useState<string>(new Date().toISOString().slice(0, 10));
  const [ngayBd, setNgayBd] = useState<string>(initialMoveInDate);
  const [ngayKt, setNgayKt] = useState<string>(() => {
    const d = new Date(initialMoveInDate);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [copiedContract, setCopiedContract] = useState(false);

  const handleNgayBdChange = (nextBd: string) => {
    setNgayBd(nextBd);
    if (!ngayKt || ngayKt <= nextBd) {
      const d = new Date(nextBd);
      d.setFullYear(d.getFullYear() + 1);
      setNgayKt(d.toISOString().slice(0, 10));
    }
    if (ngayKy && ngayKy > nextBd) {
      setNgayKy(nextBd);
    }
  };

  // Cancel reservation states
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelReservation,
    initialResState,
  );
  const [xuLyTienCoc, setXuLyTienCoc] = useState<"TichThu" | "HoanLai">("TichThu");
  const [soTienHoanLai, setSoTienHoanLai] = useState<number>(0);

  // Manual reserve state (dự phòng tại quầy)
  const [resState, resAction, resPending] = useActionState(reserveRoom, initialResState);
  const [tenantMode] = useState<"new" | "existing">("new");
  const [soTienTheChan, setSoTienTheChan] = useState<string>("100000");
  const [ngayHetHan, setNgayHetHan] = useState<string>(addDays(5));

  // Update date when reservation changes
  const [prevResDate, setPrevResDate] = useState(reservation?.ngay_du_kien_o);
  if (reservation?.ngay_du_kien_o && reservation.ngay_du_kien_o !== prevResDate) {
    setPrevResDate(reservation.ngay_du_kien_o);
    const dStr = reservation.ngay_du_kien_o.slice(0, 10);
    setNgayBd(dStr);
    const d = new Date(dStr);
    d.setFullYear(d.getFullYear() + 1);
    setNgayKt(d.toISOString().slice(0, 10));
  }

  const tienCocGiu = reservation ? Number(reservation.so_tien_the_chan || 0) : 0;
  const tongCocHopDong = tienDatCocNiemYet ? Number(tienDatCocNiemYet) : 0;
  const tienCocConLai = Math.max(0, tongCocHopDong - tienCocGiu);

  const handleCopyCredentials = () => {
    if (!contractState.tempPassword || !contractState.username) return;
    const nameStr = contractState.tenantName ? ` ${contractState.tenantName}` : "";
    const msg = `[Nhà trọ Kiều Giang] Xin chào${nameStr}, hợp đồng thuê phòng ${maPhong} của bạn đã được kích hoạt. Tài khoản ứng dụng cư dân: SĐT: ${contractState.username} | Mật khẩu mặc định: ${contractState.tempPassword}. Vui lòng đăng nhập ứng dụng để xác nhận nhận bàn giao phòng.`;
    navigator.clipboard.writeText(msg);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2500);
  };

  return (
    <>
      {/* ── TRƯỜNG HỢP 1: PHÒNG ĐANG TRỐNG ── */}
      {trangThaiPhong === "Trống" && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px dashed var(--status-info-text)",
            borderRadius: 12,
            padding: "14px 18px",
            marginTop: 14,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--status-info-text)", fontSize: 13.5 }}>
              <Smartphone size={16} /> Sẵn sàng nhận đặt cọc qua Mobile App
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              Khách vãng lai xem phòng & đặt cọc qua Mobile App. Khi thanh toán thành công, yêu cầu tạo hợp đồng sẽ hiển thị tại đây và đầu trang Hợp đồng.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setOpenManualReserveModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--status-info-bg)",
                color: "var(--status-info-text)",
                border: "1px solid var(--status-info-border)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <BookmarkCheck size={14} /> Thu cọc trực tiếp tại quầy
            </button>
          </div>
        </div>
      )}

      {/* ── TRƯỜNG HỢP 2: PHÒNG ĐÃ CÓ KHÁCH ĐẶT CỌC (TỪ MOBILE HOẶC TẠI QUẦY) ── */}
      {(trangThaiPhong === "Đã đặt cọc" || trangThaiPhong === "Đã cọc") && reservation && (
        <div
          style={{
            background: "linear-gradient(135deg, var(--status-success-bg) 0%, var(--status-success-bg) 100%)",
            border: "2px solid var(--status-success-border)",
            borderRadius: 14,
            padding: "16px 20px",
            marginTop: 16,
            marginBottom: 16,
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Header thông báo cọc */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  background: "var(--status-success-bg)",
                  color: "var(--status-success-text)",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--status-success-text)" }}>
                  ĐÃ CÓ KHÁCH ĐẶT CỌC GIỮ PHÒNG ({reservation.ma_giu_cho})
                </div>
                <div style={{ fontSize: 11.5, color: "var(--status-success-text)" }}>
                  Khách đã hoàn tất chuyển khoản VietQR giữ chỗ từ App Mobile
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: 999,
                background: "var(--status-success-bg)",
                color: "var(--status-success-text)",
                border: "1px solid var(--status-success-border)",
              }}
            >
              ✓ Đã nhận cọc: {money(reservation.so_tien_the_chan)}
            </span>
          </div>

          {/* 4 Khối thông tin chi tiết BQL cần */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              fontSize: 13,
            }}
          >
            <div style={{ background: "var(--bg-surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--status-success-bg)" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Khách đặt cọc</div>
              <strong style={{ fontSize: 14, color: "var(--text-main)" }}>
                {reservation.ho_ten_khach || "—"}
              </strong>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>SĐT: {reservation.so_dt || "—"}</div>
            </div>

            <div style={{ background: "var(--bg-surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--status-success-bg)" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Ngày dự kiến vào ở</div>
              <strong style={{ fontSize: 14, color: "var(--status-info-text)" }}>
                {date(reservation.ngay_du_kien_o || reservation.ngay_het_han)}
              </strong>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Hạn giữ phòng</div>
            </div>

            <div style={{ background: "var(--bg-surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--status-success-bg)" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Số người dự kiến ở</div>
              <strong style={{ fontSize: 15, color: "var(--text-main)" }}>
                {reservation.so_nguoi_o || 1} người
              </strong>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Thông tin khách khai</div>
            </div>

            <div style={{ background: "var(--bg-surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--status-success-bg)" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Tiền cọc cần thu thêm</div>
              <strong style={{ fontSize: 15, color: "var(--primary)" }}>
                {money(tienCocConLai)}
              </strong>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Tổng cọc: {money(tongCocHopDong)}</div>
            </div>
          </div>

          {reservation.ghi_chu && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: "var(--status-success-text)",
                background: "var(--bg-surface)",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--status-success-bg)",
              }}
            >
              <strong>Ghi chú:</strong> {reservation.ghi_chu}
            </div>
          )}

          {/* Action buttons cho BQL */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setOpenConvertModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--status-success-text)",
                color: "var(--bg-surface)",
                border: "none",
                borderRadius: 8,
                padding: "9px 18px",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(5, 150, 105, 0.25)",
              }}
            >
              <FileCheck size={18} /> Lập hợp đồng từ cọc giữ chỗ (Tự cấp User App)
            </button>

            <button
              type="button"
              onClick={() => setOpenCancelModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--bg-surface)",
                color: "var(--status-danger-text)",
                border: "1px solid var(--status-danger-border)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <UserX size={15} /> Khách bỏ cọc / Hủy giữ chỗ
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: LẬP HỢP ĐỒNG TỪ CỌC GIỮ CHỖ & CẤP USER APP ── */}
      {openConvertModal && reservation && (
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
            if (e.target === e.currentTarget && !contractPending) setOpenConvertModal(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 16,
              maxWidth: 620,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--status-success-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "var(--status-success-bg)",
                    color: "var(--status-success-text)",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileCheck size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--status-success-text)", margin: 0 }}>
                    Lập Hợp Đồng từ Cọc Giữ Chỗ Mobile
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--status-success-text)", margin: "2px 0 0", display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>Phòng {maPhong}</span>
                    <span>Khách: {reservation.ho_ten_khach} ({reservation.so_nguoi_o || 1} người ở)</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenConvertModal(false)}
                disabled={contractPending}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form action={contractAction} style={{ padding: 20 }}>
              <input type="hidden" name="maGiuCho" value={reservation.ma_giu_cho} />
              <input type="hidden" name="maPhong" value={maPhong} />

              {contractState.error && (
                <div style={{ background: "var(--status-danger-bg)", border: "1px solid var(--status-danger-border)", color: "var(--status-danger-text)", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                  <AlertTriangle size={16} /> {contractState.error}
                </div>
              )}

              {/* Thông tin kế thừa tự động từ mobile */}
              <div
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                  fontSize: 12.5,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  Khách thuê: <strong>{reservation.ho_ten_khach}</strong>
                </div>
                <div>
                  Số điện thoại: <strong>{reservation.so_dt}</strong>
                </div>
                <div>
                  Số người đăng ký ở: <strong>{reservation.so_nguoi_o || 1} người</strong>
                </div>
                <div>
                  Hẹn vào ngày: <strong>{date(reservation.ngay_du_kien_o || reservation.ngay_het_han)}</strong>
                </div>
              </div>

              {/* Bảng đối trừ cọc tự động */}
              <div
                style={{
                  background: "var(--status-success-bg)",
                  border: "1px solid var(--status-success-border)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                  fontSize: 12.5,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--status-success-text)", marginBottom: 6 }}>
                  💰 Bảng đối trừ tiền đặt cọc
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Tổng tiền cọc quy định:</span>
                  <strong>{money(tongCocHopDong)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--status-success-text)", marginBottom: 4 }}>
                  <span>Đã thanh toán (Cọc giữ chỗ từ Mobile):</span>
                  <strong>- {money(tienCocGiu)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px dashed var(--status-success-border)",
                    paddingTop: 6,
                    fontSize: 14,
                    color: "var(--status-success-text)",
                    fontWeight: 800,
                  }}
                >
                  <span>Khách cần đóng thêm khi nhận phòng:</span>
                  <span>{money(tienCocConLai)}</span>
                </div>
              </div>

              {/* Điều khoản hợp đồng */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Giá thuê thỏa thuận (đ/tháng) *
                  </label>
                  <input
                    type="number"
                    name="giaThueThoaThuan"
                    defaultValue={giaThueNiemYet ? Number(giaThueNiemYet) : 0}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Tổng tiền cọc hợp đồng (VNĐ) *
                  </label>
                  <input
                    type="number"
                    name="tienDatCoc"
                    defaultValue={tongCocHopDong}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Ngày ký hợp đồng
                  </label>
                  <input
                    type="date"
                    name="ngayKy"
                    value={ngayKy}
                    max={ngayBd || undefined}
                    onChange={(e) => setNgayKy(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ký trước/vào ngày ở</span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Ngày bắt đầu ở *
                  </label>
                  <input
                    type="date"
                    name="ngayBd"
                    value={ngayBd}
                    min={ngayKy || undefined}
                    onChange={(e) => handleNgayBdChange(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tính tiền từ ngày này</span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Ngày kết thúc HĐ *
                  </label>
                  <input
                    type="date"
                    name="ngayKt"
                    value={ngayKt}
                    min={dayAfter(ngayBd)}
                    onChange={(e) => setNgayKt(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sau ngày bắt đầu</span>
                </div>
              </div>

              {/* Biên bản bàn giao tài sản lúc nhận phòng (cho phép kiểm tra & chỉnh sửa trước khi tạo HĐ) */}
              <HandoverItemsEditor
                furnitureList={noiThatSanCo}
                title={`Biên bản bàn giao tài sản phòng ${maPhong}`}
                hint="Kiểm tra và sửa số lượng, tình trạng từng món hoặc thêm đồ khách thuê trước khi kích hoạt hợp đồng."
              />

              {/* Hộp tài khoản cấp cho cư dân */}
              {contractState.tempPassword && contractState.username && (
                <div
                  style={{
                    background: "var(--primary-subtle)",
                    border: "1px solid var(--primary-subtle)",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: 13, marginBottom: 6 }}>
                    🎉 Đã kích hoạt Hợp đồng & Cấp User Mobile App cho cư dân:
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                    <span>
                      SĐT: <strong>{contractState.username}</strong>
                    </span>
                    <span>
                      Mật khẩu mặc định:{" "}
                      <strong style={{ color: "var(--status-danger-text)", letterSpacing: 1 }}>{contractState.tempPassword}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      style={{
                        background: "var(--primary)",
                        color: "var(--bg-surface)",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {copiedContract ? <Check size={14} /> : <Copy size={14} />}
                      {copiedContract ? "Đã sao chép!" : "Sao chép SMS/Zalo"}
                    </button>
                    {contractState.maHopDong && (
                      <Link
                        href={`/hop-dong/${contractState.maHopDong}`}
                        style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}
                      >
                        Xem chi tiết HĐ →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenConvertModal(false)}
                  disabled={contractPending}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", cursor: "pointer" }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={contractPending}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--status-success-text)",
                    color: "var(--bg-surface)",
                    fontWeight: 700,
                    cursor: contractPending ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {contractPending ? <LoaderCircle size={16} className="animate-spin" /> : <FileCheck size={16} />}
                  Kích hoạt Hợp đồng & Cấp User App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: HỦY GIỮ CHỖ / XỬ LÝ KHÁCH BỎ CỌC ── */}
      {openCancelModal && reservation && (
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
            if (e.target === e.currentTarget && !cancelPending) setOpenCancelModal(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 16,
              maxWidth: 540,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--status-danger-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "var(--status-danger-bg)",
                    color: "var(--status-danger-text)",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserX size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--status-danger-text)", margin: 0 }}>
                    Xử lý Khách bỏ cọc / Hủy giữ chỗ
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--status-danger-text)", margin: "2px 0 0", display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>Phòng {maPhong}</span>
                    <span>Khách: {reservation.ho_ten_khach}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenCancelModal(false)}
                disabled={cancelPending}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              action={async (formData) => {
                await cancelAction(formData);
                setOpenCancelModal(false);
                router.refresh();
              }}
              style={{ padding: 20 }}
            >
              <input type="hidden" name="maGiuCho" value={reservation.ma_giu_cho} />
              <input type="hidden" name="maPhong" value={maPhong} />

              {cancelState.error && (
                <div style={{ background: "var(--status-danger-bg)", border: "1px solid var(--status-danger-border)", color: "var(--status-danger-text)", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                  <AlertTriangle size={16} /> {cancelState.error}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Phương án xử lý tiền cọc ({money(reservation.so_tien_the_chan)}) *
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <label
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      border: xuLyTienCoc === "TichThu" ? "2px solid var(--status-danger-text)" : "1px solid var(--border)",
                      background: xuLyTienCoc === "TichThu" ? "var(--status-danger-bg)" : "var(--bg-surface)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="xuLyTienCoc"
                      value="TichThu"
                      checked={xuLyTienCoc === "TichThu"}
                      onChange={() => setXuLyTienCoc("TichThu")}
                      style={{ marginRight: 6 }}
                    />
                    <strong style={{ color: "var(--status-danger-text)" }}>Tịch thu tiền cọc</strong>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                      Khách bỏ cọc hoặc quá hạn hẹn. Tiền cọc sung quỹ tòa nhà.
                    </div>
                  </label>

                  <label
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      border: xuLyTienCoc === "HoanLai" ? "2px solid var(--status-success-text)" : "1px solid var(--border)",
                      background: xuLyTienCoc === "HoanLai" ? "var(--status-success-bg)" : "var(--bg-surface)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="xuLyTienCoc"
                      value="HoanLai"
                      checked={xuLyTienCoc === "HoanLai"}
                      onChange={() => setXuLyTienCoc("HoanLai")}
                      style={{ marginRight: 6 }}
                    />
                    <strong style={{ color: "var(--status-success-text)" }}>Hoàn trả lại cọc</strong>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                      Thỏa thuận hoàn trả toàn bộ hoặc một phần cho khách.
                    </div>
                  </label>
                </div>
              </div>

              {xuLyTienCoc === "HoanLai" && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                    Số tiền hoàn trả lại cho khách (VNĐ)
                  </label>
                  <input
                    type="number"
                    name="soTienHoanLai"
                    min={0}
                    max={Number(reservation.so_tien_the_chan)}
                    value={soTienHoanLai}
                    onChange={(e) => setSoTienHoanLai(Number(e.target.value) || 0)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontWeight: 700 }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                  Lý do hủy giữ chỗ / bỏ cọc
                </label>
                <textarea
                  name="lyDoHuy"
                  rows={2}
                  placeholder="Khách thay đổi kế hoạch không thuê nữa..."
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--status-danger-text)",
                  background: "var(--status-danger-bg)",
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Unlock size={16} /> Khi xác nhận: Phòng <strong>{maPhong}</strong> sẽ được <strong>MỞ KHÓA</strong> và tự động chuyển về trạng thái <strong>Trống</strong> để sẵn sàng đón khách khác trên Mobile.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenCancelModal(false)}
                  disabled={cancelPending}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", cursor: "pointer" }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={cancelPending}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--status-danger-text)",
                    color: "var(--bg-surface)",
                    fontWeight: 700,
                    cursor: cancelPending ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {cancelPending ? <LoaderCircle size={16} className="animate-spin" /> : <Unlock size={16} />}
                  Xác nhận Hủy cọc & Mở khóa phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NHẬN CỌC TRỰC TIẾP TẠI QUẦY (DỰ PHÒNG) ── */}
      {openManualReserveModal && (
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
            if (e.target === e.currentTarget && !resPending) setOpenManualReserveModal(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 16,
              maxWidth: 580,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--status-info-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "var(--status-info-bg)", color: "var(--status-info-text)", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookmarkCheck size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--status-info-text)", margin: 0 }}>
                    Nhận cọc trực tiếp tại quầy (Tiền mặt)
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--status-info-text)", margin: "2px 0 0" }}>
                    Phòng {tenPhong} ({maPhong})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenManualReserveModal(false)}
                disabled={resPending}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              action={async (formData) => {
                await resAction(formData);
                setOpenManualReserveModal(false);
                router.refresh();
              }}
              style={{ padding: 20 }}
            >
              <input type="hidden" name="maPhong" value={maPhong} />
              <input type="hidden" name="tenantMode" value={tenantMode} />
              <input type="hidden" name="hinhThucThanhToan" value="TrucTiep" />

              {resState.error && (
                <div style={{ background: "var(--status-danger-bg)", border: "1px solid var(--status-danger-border)", color: "var(--status-danger-text)", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                  <AlertTriangle size={16} /> {resState.error}
                </div>
              )}

              {/* Thông tin khách */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Họ và tên khách *
                  </label>
                  <input
                    type="text"
                    name="newHoTen"
                    placeholder="Nguyễn Văn A"
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    name="newSoDt"
                    placeholder="0912345678"
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Số tiền cọc thu (VNĐ) *
                  </label>
                  <input
                    type="number"
                    name="soTienTheChan"
                    value={soTienTheChan}
                    onChange={(e) => setSoTienTheChan(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Hạn hẹn nhận phòng *
                  </label>
                  <input
                    type="date"
                    name="ngayHetHan"
                    value={ngayHetHan}
                    onChange={(e) => setNgayHetHan(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Ghi chú
                </label>
                <input
                  type="text"
                  name="ghiChu"
                  placeholder="Khách đưa tiền mặt tại quầy..."
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenManualReserveModal(false)}
                  disabled={resPending}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", cursor: "pointer" }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={resPending}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--status-success-text)",
                    color: "var(--bg-surface)",
                    fontWeight: 700,
                    cursor: resPending ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {resPending ? <LoaderCircle size={16} className="animate-spin" /> : <Lock size={16} />}
                  Xác nhận Nhận cọc & Khóa phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
