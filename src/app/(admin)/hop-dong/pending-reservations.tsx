"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileCheck, UserX, X, AlertTriangle, LoaderCircle, Copy, Check, Unlock } from "lucide-react";
import type { PaidReservationRow } from "@/lib/queries";
import { convertReservationToContract, cancelReservation, type ReservationFormState } from "@/app/(admin)/phong/actions";
import type { ContractFormState } from "./actions";

const initialContractState: ContractFormState = { error: null, success: null };
const initialResState: ReservationFormState = { error: null, success: null };

function money(num: number | string | null | undefined) {
  if (!num) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
}

function date(str: string | null | undefined) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("vi-VN");
}

export function PendingReservationsQueue({
  reservations,
}: {
  reservations: PaidReservationRow[];
}) {
  const router = useRouter();
  const [selectedRes, setSelectedRes] = useState<PaidReservationRow | null>(null);
  const [cancelRes, setCancelRes] = useState<PaidReservationRow | null>(null);

  // Convert to contract state
  const [contractState, contractAction, contractPending] = useActionState(
    convertReservationToContract,
    initialContractState,
  );

  // Form dates for modal
  const initialMoveIn = selectedRes?.ngay_du_kien_o
    ? selectedRes.ngay_du_kien_o.slice(0, 10)
    : selectedRes?.ngay_het_han
      ? selectedRes.ngay_het_han.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const [ngayBd, setNgayBd] = useState<string>(initialMoveIn);
  const [ngayKt, setNgayKt] = useState<string>(() => {
    const d = new Date(initialMoveIn);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [copied, setCopied] = useState(false);

  // Cancel reservation states
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelReservation,
    initialResState,
  );
  const [xuLyTienCoc, setXuLyTienCoc] = useState<"TichThu" | "HoanLai">("TichThu");
  const [soTienHoanLai, setSoTienHoanLai] = useState<number>(0);

  if (!reservations || reservations.length === 0) {
    return null;
  }

  const handleOpenConvert = (res: PaidReservationRow) => {
    setSelectedRes(res);
    const moveIn = res.ngay_du_kien_o
      ? res.ngay_du_kien_o.slice(0, 10)
      : res.ngay_het_han
        ? res.ngay_het_han.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    setNgayBd(moveIn);
    const d = new Date(moveIn);
    d.setFullYear(d.getFullYear() + 1);
    setNgayKt(d.toISOString().slice(0, 10));
  };

  const handleCopyCredentials = () => {
    if (!contractState.tempPassword || !contractState.username) return;
    const nameStr = contractState.tenantName ? ` ${contractState.tenantName}` : "";
    const msg = `[Nhà trọ Kiều Giang] Xin chào${nameStr}, hợp đồng thuê phòng ${selectedRes?.ma_phong} của bạn đã được kích hoạt. Tài khoản ứng dụng cư dân: SĐT: ${contractState.username} | Mật khẩu mặc định: ${contractState.tempPassword}. Vui lòng đăng nhập và xác nhận bàn giao nhận phòng.`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const selectedCocGiu = selectedRes ? Number(selectedRes.so_tien_the_chan || 0) : 0;
  const selectedTongCoc = selectedRes?.tien_dat_coc ? Number(selectedRes.tien_dat_coc) : 0;
  const selectedCocConLai = Math.max(0, selectedTongCoc - selectedCocGiu);

  return (
    <>
      <section
        style={{
          marginBottom: 24,
          background: "var(--bg-surface)",
          borderRadius: 14,
          border: "1px solid var(--primary-subtle)",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(74, 144, 194, 0.08)",
        }}
      >
        {/* Header section with light sky blue theme */}
        <div
          style={{
            background: "var(--bg-subtle)",
            borderBottom: "1px solid var(--primary-subtle)",
            padding: "14px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                background: "var(--primary)",
                color: "var(--bg-surface)",
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileCheck size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                Khách đặt cọc giữ chỗ chờ lập hợp đồng ({reservations.length})
              </h2>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "3px 0 0" }}>
                Danh sách khách đã đặt cọc giữ phòng — bấm &quot;Tạo hợp đồng&quot; để bàn giao và kích hoạt phòng
              </p>
            </div>
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--primary-subtle)",
              color: "var(--primary)",
              border: "1px solid var(--border-strong)",
            }}
          >
            {reservations.length} phòng cần xử lý
          </span>
        </div>

        {/* Danh sách các phiếu cọc chờ lập HĐ */}
        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {reservations.map((res) => {
            const cocGiu = Number(res.so_tien_the_chan || 0);
            const tongCoc = res.tien_dat_coc ? Number(res.tien_dat_coc) : 0;
            const conLai = Math.max(0, tongCoc - cocGiu);

            const rawName = (res.ten_phong || res.ma_phong || "").trim();
            const roomTitle = rawName.toLowerCase().startsWith("phòng") ? rawName : `Phòng ${rawName}`;

            return (
              <div
                key={res.ma_giu_cho}
                style={{
                  background: "var(--bg-surface)",
                  borderRadius: 12,
                  padding: "16px",
                  border: "1px solid var(--border)",
                  boxShadow: "0 1px 4px rgba(66, 91, 107, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
                        {roomTitle}
                      </strong>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {res.toa_nha || "Cơ sở"} {res.tang !== null ? `  Tầng ${res.tang}` : ""}   Mã: {res.ma_giu_cho}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "var(--status-success-bg)",
                        color: "var(--status-success-text)",
                        border: "1px solid var(--status-success-border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Đã cọc: {money(res.so_tien_the_chan)}
                    </span>
                  </div>

                  <div
                    style={{
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      color: "var(--text-muted)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Khách thuê:</span>
                      <strong style={{ color: "var(--text-main)" }}>
                        {res.ho_ten_khach || "—"} {res.so_dt ? `(${res.so_dt})` : ""}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Hẹn nhận phòng:</span>
                      <strong style={{ color: "var(--text-main)" }}>
                        {date(res.ngay_du_kien_o || res.ngay_het_han)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Số người ở:</span>
                      <strong>{res.so_nguoi_o || 1} người</strong>
                    </div>
                    {conLai > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4, borderTop: "1px dashed var(--border)" }}>
                        <span>Cần thu thêm:</span>
                        <strong style={{ color: "var(--primary)" }}>{money(conLai)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button
                    type="button"
                    onClick={() => handleOpenConvert(res)}
                    style={{
                      flex: 1,
                      background: "var(--primary)",
                      color: "var(--bg-surface)",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 14px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <FileCheck size={14} /> Tạo hợp đồng
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCancelRes(res);
                      setSoTienHoanLai(0);
                    }}
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--status-danger-text)",
                      border: "1px solid var(--status-danger-border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Hủy cọc
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── MODAL: TẠO HỢP ĐỒNG TỪ CỌC GIỮ CHỖ ── */}
      {selectedRes && (
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
            if (e.target === e.currentTarget && !contractPending) setSelectedRes(null);
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
                borderBottom: "1px solid var(--primary-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "var(--primary)",
                    color: "var(--bg-surface)",
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileCheck size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Lập hợp đồng thuê phòng
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>{selectedRes.ten_phong?.toLowerCase().startsWith("phòng") ? selectedRes.ten_phong : `Phòng ${selectedRes.ten_phong || selectedRes.ma_phong}`}</span>
                    <span>Khách thuê: {selectedRes.ho_ten_khach}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRes(null)}
                disabled={contractPending}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              action={async (formData) => {
                await contractAction(formData);
                router.refresh();
              }}
              style={{ padding: 20 }}
            >
              <input type="hidden" name="maGiuCho" value={selectedRes.ma_giu_cho} />
              <input type="hidden" name="maPhong" value={selectedRes.ma_phong} />

              {contractState.error && (
                <div style={{ background: "var(--status-danger-bg)", border: "1px solid var(--status-danger-border)", color: "var(--status-danger-text)", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                  <AlertTriangle size={16} /> {contractState.error}
                </div>
              )}

              {/* Thông tin kế thừa từ mobile */}
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
                  Khách đại diện: <strong>{selectedRes.ho_ten_khach}</strong>
                </div>
                <div>
                  Số điện thoại: <strong>{selectedRes.so_dt}</strong>
                </div>
                <div>
                  Số người đăng ký ở: <strong>{selectedRes.so_nguoi_o || 1} người</strong>
                </div>
                <div>
                  Ngày hẹn vào ở: <strong>{date(selectedRes.ngay_du_kien_o || selectedRes.ngay_het_han)}</strong>
                </div>
              </div>

              {/* Bảng đối trừ cọc tự động */}
              <div
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--primary-subtle)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Đối trừ tiền đặt cọc
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Tổng tiền cọc quy định:</span>
                  <strong>{money(selectedTongCoc)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--status-success-text)", marginBottom: 4 }}>
                  <span>Đã thanh toán (Cọc giữ chỗ):</span>
                  <strong>- {money(selectedCocGiu)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px dashed var(--border-strong)",
                    paddingTop: 6,
                    fontSize: 13.5,
                    color: "var(--text-main)",
                    fontWeight: 700,
                  }}
                >
                  <span>Khách cần đóng thêm khi nhận phòng:</span>
                  <span style={{ color: "var(--primary)" }}>{money(selectedCocConLai)}</span>
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
                    defaultValue={selectedRes.gia_thue ? Number(selectedRes.gia_thue) : 0}
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
                    defaultValue={selectedTongCoc}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Ngày bắt đầu ở (Tự động điền ngày hẹn) *
                  </label>
                  <input
                    type="date"
                    name="ngayBd"
                    value={ngayBd}
                    onChange={(e) => setNgayBd(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Ngày kết thúc hợp đồng *
                  </label>
                  <input
                    type="date"
                    name="ngayKt"
                    value={ngayKt}
                    onChange={(e) => setNgayKt(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>
              </div>

              {/* Hộp tài khoản cấp cho cư dân */}
              {contractState.tempPassword && contractState.username && (
                <div
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--primary-subtle)",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: 13, marginBottom: 6 }}>
                    ✓ Đã lập hợp đồng &amp; cấp tài khoản ứng dụng cư dân:
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
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Đã sao chép!" : "Sao chép SMS/Zalo"}
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
                  onClick={() => setSelectedRes(null)}
                  disabled={contractPending}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--bg-surface)", cursor: "pointer", color: "var(--text-muted)" }}
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
                    background: "var(--primary)",
                    color: "var(--bg-surface)",
                    fontWeight: 600,
                    cursor: contractPending ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {contractPending ? <LoaderCircle size={16} className="animate-spin" /> : <FileCheck size={16} />}
                  Xác nhận tạo hợp đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: HỦY GIỮ CHỖ / XỬ LÝ KHÁCH BỎ CỌC ── */}
      {cancelRes && (
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
            if (e.target === e.currentTarget && !cancelPending) setCancelRes(null);
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
                    <span>Phòng {cancelRes.ten_phong} ({cancelRes.ma_phong})</span>
                    <span>Khách: {cancelRes.ho_ten_khach}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelRes(null)}
                disabled={cancelPending}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              action={async (formData) => {
                await cancelAction(formData);
                setCancelRes(null);
                router.refresh();
              }}
              style={{ padding: 20 }}
            >
              <input type="hidden" name="maGiuCho" value={cancelRes.ma_giu_cho} />
              <input type="hidden" name="maPhong" value={cancelRes.ma_phong} />

              {cancelState.error && (
                <div style={{ background: "var(--status-danger-bg)", border: "1px solid var(--status-danger-border)", color: "var(--status-danger-text)", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                  <AlertTriangle size={16} /> {cancelState.error}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Phương án xử lý tiền cọc ({money(cancelRes.so_tien_the_chan)}) *
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
                    max={Number(cancelRes.so_tien_the_chan)}
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
                <Unlock size={16} /> Khi xác nhận: Phòng <strong>{cancelRes.ten_phong}</strong> sẽ được <strong>MỞ KHÓA</strong> và tự động chuyển về trạng thái <strong>Trống</strong> để đón khách mới.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCancelRes(null)}
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
    </>
  );
}

