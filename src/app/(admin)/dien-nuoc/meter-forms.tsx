"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Check, X, Zap, Droplets, AlertTriangle, FileText } from "lucide-react";
import { createMeterReading, deleteMeterReading, updateMeterReading, approveMeterReading, rejectMeterReading, remindTenantToSubmitMeter, type MeterFormState } from "./actions";
import type { ContractOption, MeterProgressData, MeterRow } from "@/lib/queries";
import { detectMeterAnomaly } from "@/lib/meter-utils";
import styles from "@/components/business.module.css";
import editorStyles from "./meter-editor.module.css";

const METER_STATUSES = ["Chờ duyệt", "Đã duyệt", "Từ chối"];
const initialState: MeterFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Huy hiệu cảnh báo mức tiêu thụ bất thường (Spike & Leak Detection) */
export function MeterAnomalyBadge({ reading }: { reading: MeterRow }) {
  const anomaly = detectMeterAnomaly({
    dien_tieu_thu: reading.dien_tieu_thu,
    nuoc_tieu_thu: reading.nuoc_tieu_thu,
    dien_ky_truoc: reading.dien_ky_truoc,
    nuoc_ky_truoc: reading.nuoc_ky_truoc,
    trang_thai_phong: reading.trang_thai_phong,
  });

  if (!anomaly.hasAnomaly) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
      {anomaly.spikeDien && (
        <span
          title={anomaly.details.find((d) => d.includes("Điện"))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            fontWeight: 700,
            background: "var(--status-danger-bg)",
            color: "var(--status-danger-text)",
            border: "1px solid var(--status-danger-border)",
            borderRadius: 5,
            padding: "2px 6px",
            width: "fit-content",
          }}
        >
          <Zap size={11} color="var(--status-danger-text)" /> Điện tăng &gt;80%
        </span>
      )}

      {anomaly.spikeNuoc && (
        <span
          title={anomaly.details.find((d) => d.includes("Nước"))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            fontWeight: 700,
            background: "var(--status-danger-bg)",
            color: "var(--status-danger-text)",
            border: "1px solid var(--status-danger-border)",
            borderRadius: 5,
            padding: "2px 6px",
            width: "fit-content",
          }}
        >
          <Droplets size={11} color="var(--status-danger-text)" /> Rò rỉ nước (+80%)
        </span>
      )}

      {anomaly.zeroUsage && (
        <span
          title={anomaly.details.find((d) => d.includes("= 0"))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            fontWeight: 700,
            background: "var(--status-warning-bg)",
            color: "var(--status-warning-text)",
            border: "1px solid var(--status-warning-border)",
            borderRadius: 5,
            padding: "2px 6px",
            width: "fit-content",
          }}
        >
          <AlertTriangle size={11} color="var(--status-warning-text)" /> Không thay đổi (0)
        </span>
      )}
    </div>
  );
}

/** Liên kết xem Hóa đơn đã kết chuyển tiền điện nước */
export function MeterInvoiceLink({ maHoaDon }: { maHoaDon?: string | null }) {
  if (!maHoaDon) return null;

  return (
    <Link
      href={`/hoa-don?keyword=${encodeURIComponent(maHoaDon)}`}
      title="Đã kết chuyển Hóa đơn tiền phòng & dịch vụ (Bấm để xem chi tiết)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--status-success-bg)",
        color: "var(--status-success-text)",
        border: "1px solid var(--status-success-border)",
        borderRadius: 6,
        padding: "3px 7px",
        fontSize: 11.5,
        fontWeight: 700,
        textDecoration: "none",
        marginTop: 4,
      }}
    >
      <FileText size={12} /> HĐ: {maHoaDon}
    </Link>
  );
}

/**
 * Thẻ theo dõi tiến độ chốt số theo kỳ (Closing Progress)
 * Có thanh tiến độ và danh sách các phòng chưa gửi ảnh để gửi thông báo nhắc nhở qua App mobile.
 */
export function ClosingProgressCard({
  progress,
}: {
  progress: MeterProgressData;
}) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState(progress.selectedPeriod);
  const [showUnsubmittedModal, setShowUnsubmittedModal] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindedAll, setRemindedAll] = useState(false);
  const [remindFeedback, setRemindFeedback] = useState<string | null>(null);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    setSelectedPeriod(p);
    router.push(`/dien-nuoc?period=${encodeURIComponent(p)}`);
  };

  const handleRemindSingle = async (room: { ma_hop_dong: string; ma_phong: string }) => {
    setRemindingId(room.ma_phong);
    setRemindFeedback(null);
    try {
      const res = await remindTenantToSubmitMeter(
        room.ma_hop_dong,
        room.ma_phong,
        progress.selectedPeriod,
      );
      setRemindFeedback(res.message);
    } catch {
      setRemindFeedback("Không thể gửi thông báo lúc này.");
    } finally {
      setRemindingId(null);
    }
  };

  const handleRemindAll = async () => {
    setRemindingId("ALL");
    setRemindFeedback(null);
    try {
      for (const r of progress.unsubmittedRooms) {
        await remindTenantToSubmitMeter(r.ma_hop_dong, r.ma_phong, progress.selectedPeriod);
      }
      setRemindedAll(true);
      setRemindFeedback(
        `Đã gửi thông báo nhắc tất cả ${progress.unsubmittedRooms.length} phòng nộp chỉ số qua App mobile!`,
      );
    } catch {
      setRemindFeedback("Gửi nhắc nhở thất bại.");
    } finally {
      setRemindingId(null);
    }
  };

  const total = progress.totalRooms;
  const pctApproved = total > 0 ? Math.round((progress.approved / total) * 100) : 0;
  const pctPending = total > 0 ? Math.round((progress.pending / total) * 100) : 0;
  const pctUnsubmitted = total > 0 ? 100 - (pctApproved + pctPending) : 0;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {/* Dropdown chọn kỳ */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Chọn kỳ theo dõi:
          </label>
          <select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text-main)",
              background: "var(--bg-subtle)",
              cursor: "pointer",
            }}
          >
            {progress.availablePeriods.map((p) => (
              <option key={p} value={p}>
                Kỳ {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Đã nộp</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-main)", marginTop: 2 }}>
            {progress.submitted} / {progress.totalRooms}
          </div>
        </div>

        <div style={{ padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Đã duyệt</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-main)", marginTop: 2 }}>
            {progress.approved} phòng
          </div>
        </div>

        <div style={{ padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Chờ duyệt</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-main)", marginTop: 2 }}>
            {progress.pending} phòng
          </div>
        </div>

        <div style={{ padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Chưa gửi ảnh</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-main)", marginTop: 2 }}>
                {progress.unsubmittedRooms.length} phòng
              </div>
            </div>
            {progress.unsubmittedRooms.length > 0 && (
              <button
                type="button"
                onClick={() => setShowUnsubmittedModal(true)}
                title="Xem danh sách & Nhắc nhở qua Mobile App"
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid var(--border-strong)",
                  background: "var(--primary-subtle)",
                  color: "var(--primary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                Nhắc nộp
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "var(--bg-subtle)",
            overflow: "hidden",
            display: "flex",
            border: "1px solid var(--border)",
          }}
        >
          {pctApproved > 0 && (
            <div
              style={{
                width: `${pctApproved}%`,
                background: "var(--status-success-text)",
                transition: "width 0.4s ease",
              }}
              title={`Đã duyệt: ${progress.approved} phòng (${pctApproved}%)`}
            />
          )}
          {pctPending > 0 && (
            <div
              style={{
                width: `${pctPending}%`,
                background: "var(--status-warning-text)",
                transition: "width 0.4s ease",
              }}
              title={`Chờ duyệt: ${progress.pending} phòng (${pctPending}%)`}
            />
          )}
          {pctUnsubmitted > 0 && (
            <div
              style={{
                width: `${pctUnsubmitted}%`,
                background: "var(--border)",
                transition: "width 0.4s ease",
              }}
              title={`Chưa nộp: ${progress.unsubmittedRooms.length} phòng (${pctUnsubmitted}%)`}
            />
          )}
        </div>
      </div>

      {/* Button xem phòng chưa nộp */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {progress.unsubmittedRooms.length === 0 && (
            <span style={{ color: "var(--status-success-text)", fontWeight: 600 }}>
              Tất cả các phòng có khách ở đều đã nộp ảnh chỉ số kỳ này!
            </span>
          )}
        </div>

        
      </div>

      {/* Modal phòng chưa nộp */}
      {showUnsubmittedModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnsubmittedModal(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 14,
              maxWidth: 680,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--border)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Danh Sách Phòng Chưa Nộp Chỉ Số Kỳ {progress.selectedPeriod}
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  Tổng cộng: {progress.unsubmittedRooms.length} phòng
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnsubmittedModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                Đóng
              </button>
            </div>

            {remindFeedback && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "var(--status-success-bg)",
                  border: "1px solid var(--status-success-border)",
                  color: "var(--status-success-text)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {remindFeedback}
              </div>
            )}

            <div style={{ marginBottom: 14, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleRemindAll}
                disabled={remindingId === "ALL" || remindedAll}
                style={{
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: remindedAll ? "var(--status-success-text)" : "var(--primary)",
                  color: "var(--bg-surface)",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: remindingId === "ALL" || remindedAll ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {remindingId === "ALL" ? "Đang gửi..." : remindedAll ? "Đã gửi thông báo tất cả" : "Gửi thông báo nhắc tất cả phòng"}
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)" }}>Phòng</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)" }}>Khách thuê</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)" }}>Số điện thoại</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "var(--text-muted)" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {progress.unsubmittedRooms.map((r) => (
                  <tr key={r.ma_hop_dong} style={{ borderBottom: "1px solid var(--bg-subtle)" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "var(--text-main)" }}>
                      {r.ma_phong} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>({r.toa_nha || "Chưa gán tòa"})</span>
                    </td>
                    <td style={{ padding: "10px", color: "var(--text-main)" }}>{r.ten_khach || "—"}</td>
                    <td style={{ padding: "10px", color: "var(--text-muted)" }}>{r.so_dt || "—"}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleRemindSingle(r)}
                        disabled={remindingId === r.ma_phong}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-surface)",
                          color: "var(--primary)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: remindingId === r.ma_phong ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {remindingId === r.ma_phong ? "Đang gửi..." : "Nhắc App"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nút duyệt nhanh 1-Click trên dòng bảng (chỉ hiện khi Chờ duyệt) */
export function QuickApproveButton({ maKy }: { maKy: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleApprove = async () => {
    setIsPending(true);
    await approveMeterReading(maKy);
    setIsPending(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleApprove}
      disabled={isPending}
      title="Duyệt chỉ số này"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--status-success-text)",
        color: "var(--bg-surface)",
        border: "none",
        borderRadius: 6,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 700,
        cursor: isPending ? "not-allowed" : "pointer",
        boxShadow: "0 1px 2px rgba(5, 150, 105, 0.2)",
      }}
    >
      {isPending ? (
        <LoaderCircle size={13} className="animate-spin" />
      ) : (
        <Check size={13} />
      )}
      Duyệt
    </button>
  );
}

/** Nút từ chối nhanh 1-Click trên dòng bảng (chỉ hiện khi Chờ duyệt) */
export function QuickRejectButton({ maKy }: { maKy: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleReject = async () => {
    if (!window.confirm(`Bạn có chắc muốn từ chối kỳ ghi chỉ số ${maKy}?`)) return;
    setIsPending(true);
    await rejectMeterReading(maKy);
    setIsPending(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleReject}
      disabled={isPending}
      title="Từ chối chỉ số này"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--bg-surface)",
        color: "var(--status-danger-text)",
        border: "1px solid var(--status-danger-border)",
        borderRadius: 6,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: isPending ? "not-allowed" : "pointer",
      }}
    >
      {isPending ? (
        <LoaderCircle size={13} className="animate-spin" />
      ) : (
        <X size={13} />
      )}
      Từ chối
    </button>
  );
}

/** Nút xem ảnh công tơ nhanh */
export function MeterPhotoViewer({ reading }: { reading: MeterRow }) {
  const [open, setOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState<"dien" | "nuoc">(
    reading.anh_dien ? "dien" : "nuoc",
  );

  const hasPhotos = Boolean(reading.anh_dien || reading.anh_nuoc);

  if (!hasPhotos) {
    return (
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Chưa có ảnh
      </span>
    );
  }

  const currentImg = activePhoto === "dien" ? reading.anh_dien : reading.anh_nuoc;

  return (
    <>
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
          padding: "4px 9px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <span>Xem ảnh</span>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
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
              borderRadius: 16,
              maxWidth: 720,
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-subtle)",
              }}
            >
              <div>
                <strong style={{ fontSize: 15, color: "var(--text-main)", display: "flex", gap: 14 }}>
                  <span>Ảnh đồng hồ: Phòng {reading.ma_phong}</span>
                  <span>Kỳ {reading.thang_nam}</span>
                </strong>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Khách thuê: {reading.ten_khach || "—"} ({reading.ma_ky})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Toggle Điện / Nước */}
            <div
              style={{
                padding: "10px 18px",
                borderBottom: "1px solid var(--bg-subtle)",
                display: "flex",
                gap: 10,
              }}
            >
              {reading.anh_dien && (
                <button
                  type="button"
                  onClick={() => setActivePhoto("dien")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border:
                      activePhoto === "dien"
                        ? "2px solid var(--status-warning-text)"
                        : "1px solid var(--border)",
                    background: activePhoto === "dien" ? "var(--status-warning-bg)" : "var(--bg-surface)",
                    color: activePhoto === "dien" ? "var(--status-warning-text)" : "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Ảnh đồng hồ Điện
                </button>
              )}

              {reading.anh_nuoc && (
                <button
                  type="button"
                  onClick={() => setActivePhoto("nuoc")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border:
                      activePhoto === "nuoc"
                        ? "2px solid var(--status-info-text)"
                        : "1px solid var(--border)",
                    background: activePhoto === "nuoc" ? "var(--status-info-bg)" : "var(--bg-surface)",
                    color: activePhoto === "nuoc" ? "var(--status-info-text)" : "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Ảnh đồng hồ Nước
                </button>
              )}
            </div>

            {/* Khung ảnh */}
            <div
              style={{
                padding: 18,
                background: "var(--text-main)",
                textAlign: "center",
                minHeight: 340,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {currentImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImg}
                  alt={`Công tơ ${activePhoto}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: 460,
                    borderRadius: 8,
                    objectFit: "contain",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  }}
                />
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Không tìm thấy hình ảnh cho đồng hồ {activePhoto}.
                </div>
              )}
            </div>

            {/* Thanh thông tin dưới ảnh */}
            <div
              style={{
                padding: "12px 18px",
                background: "var(--bg-subtle)",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12.5,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                {activePhoto === "dien" ? (
                  <span>
                    Số điện khách gửi: <strong>{reading.chi_so_dien_cu}</strong>{" "}
                    →{" "}
                    <strong style={{ color: "var(--status-warning-text)" }}>
                      {reading.chi_so_dien_moi}
                    </strong>{" "}
                    (Tiêu thụ: <strong>{reading.dien_tieu_thu} kWh</strong>)
                  </span>
                ) : (
                  <span>
                    Số nước khách gửi: <strong>{reading.chi_so_nuoc_cu}</strong>{" "}
                    →{" "}
                    <strong style={{ color: "var(--status-info-text)" }}>
                      {reading.chi_so_nuoc_moi}
                    </strong>{" "}
                    (Tiêu thụ: <strong>{reading.nuoc_tieu_thu} m³</strong>)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Hiệu chỉnh chỉ số mới; giữ nguyên chỉ số cũ và khóa trạng thái đã chốt. */
export function MeterEditorToggle({ reading }: { reading: MeterRow; contracts: ContractOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chiSoDienMoi, setChiSoDienMoi] = useState(reading.chi_so_dien_moi ?? "");
  const [chiSoNuocMoi, setChiSoNuocMoi] = useState(reading.chi_so_nuoc_moi ?? "");
  const [trangThai, setTrangThai] = useState(reading.trang_thai_duyet ?? "Chờ duyệt");
  const [ngayGhiNhan, setNgayGhiNhan] = useState(reading.ngay_ghi_nhan?.slice(0, 10) ?? today());
  const [state, formAction, pending] = useActionState(updateMeterReading, initialState);
  const isFinalized = reading.trang_thai_duyet === "Đã duyệt" || reading.trang_thai_duyet === "Từ chối";
  const dienCu = Number(reading.chi_so_dien_cu) || 0;
  const nuocCu = Number(reading.chi_so_nuoc_cu) || 0;
  const dienLoi = chiSoDienMoi !== "" && Number(chiSoDienMoi) < dienCu;
  const nuocLoi = chiSoNuocMoi !== "" && Number(chiSoNuocMoi) < nuocCu;
  const dienTieuThu = Math.max(0, Number(chiSoDienMoi) - dienCu);
  const nuocTieuThu = Math.max(0, Number(chiSoNuocMoi) - nuocCu);
  const anomaly = detectMeterAnomaly({
    dien_tieu_thu: dienTieuThu, nuoc_tieu_thu: nuocTieuThu,
    dien_ky_truoc: reading.dien_ky_truoc, nuoc_ky_truoc: reading.nuoc_ky_truoc,
    trang_thai_phong: reading.trang_thai_phong,
  });
  const handleOpen = () => {
    setChiSoDienMoi(reading.chi_so_dien_moi ?? "");
    setChiSoNuocMoi(reading.chi_so_nuoc_moi ?? "");
    setTrangThai(reading.trang_thai_duyet ?? "Chờ duyệt");
    setNgayGhiNhan(reading.ngay_ghi_nhan?.slice(0, 10) ?? today());
    setOpen(true);
  };
  return (
    <>
      <button type="button" onClick={handleOpen} className={styles.linkButton}>Sửa chỉ số</button>
      {open && (
        <div className={editorStyles.backdrop} onClick={(event) => {
          if (event.target === event.currentTarget && !pending) setOpen(false);
        }}>
          <section className={editorStyles.panel} role="dialog" aria-modal="true" aria-labelledby={`meter-editor-${reading.ma_ky}`}>
            <header className={editorStyles.header}>
              <div>
                <h2 id={`meter-editor-${reading.ma_ky}`}>Sửa chỉ số điện nước</h2>
                <p>Phòng {reading.ma_phong} · {reading.ten_khach || "—"} · Kỳ {reading.thang_nam}</p>
              </div>
              <button type="button" className={styles.linkButton} onClick={() => setOpen(false)} disabled={pending}>Đóng</button>
            </header>
            <form action={async (formData) => { await formAction(formData); router.refresh(); }} className={editorStyles.form}>
              <input type="hidden" name="maKy" value={reading.ma_ky} />
              <input type="hidden" name="maHopDong" value={reading.ma_hop_dong ?? ""} />
              <input type="hidden" name="thangNam" value={reading.thang_nam ?? ""} />
              <input type="hidden" name="anhDien" value={reading.anh_dien ?? ""} />
              <input type="hidden" name="anhNuoc" value={reading.anh_nuoc ?? ""} />
              {state.error && <p className={editorStyles.error} role="alert">{state.error}</p>}
              {state.success && <p className={editorStyles.success} role="status">{state.success}</p>}
              {anomaly.hasAnomaly && (
                <div className={editorStyles.notice}>
                  <strong>Tiêu thụ bất thường</strong>
                  <ul>{anomaly.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
                </div>
              )}
              {reading.ma_hoa_don && (
                <p className={editorStyles.invoice}>Hóa đơn: <Link href={`/hoa-don?keyword=${encodeURIComponent(reading.ma_hoa_don)}`} target="_blank">{reading.ma_hoa_don}</Link></p>
              )}
              <fieldset className={editorStyles.group}>
                <legend>Điện (kWh)</legend>
                <div className={editorStyles.grid}>
                  <div className={styles.formField}>
                    <label htmlFor={`dien-cu-${reading.ma_ky}`}>Chỉ số cũ</label>
                    <input id={`dien-cu-${reading.ma_ky}`} value={dienCu} readOnly />
                  </div>
                  <div className={styles.formField}>
                    <label htmlFor={`dien-moi-${reading.ma_ky}`}>Chỉ số mới</label>
                    <input id={`dien-moi-${reading.ma_ky}`} type="number" step="any" min={dienCu} name="chiSoDienMoi" value={chiSoDienMoi} onChange={(event) => setChiSoDienMoi(event.target.value)} required aria-invalid={dienLoi} />
                  </div>
                </div>
                {dienLoi && <p className={editorStyles.error}>Chỉ số mới không được nhỏ hơn {dienCu} kWh.</p>}
                <p className={editorStyles.consumption}>Tiêu thụ: {dienTieuThu} kWh</p>
              </fieldset>
              <fieldset className={editorStyles.group}>
                <legend>Nước (m³)</legend>
                <div className={editorStyles.grid}>
                  <div className={styles.formField}>
                    <label htmlFor={`nuoc-cu-${reading.ma_ky}`}>Chỉ số cũ</label>
                    <input id={`nuoc-cu-${reading.ma_ky}`} value={nuocCu} readOnly />
                  </div>
                  <div className={styles.formField}>
                    <label htmlFor={`nuoc-moi-${reading.ma_ky}`}>Chỉ số mới</label>
                    <input id={`nuoc-moi-${reading.ma_ky}`} type="number" step="any" min={nuocCu} name="chiSoNuocMoi" value={chiSoNuocMoi} onChange={(event) => setChiSoNuocMoi(event.target.value)} required aria-invalid={nuocLoi} />
                  </div>
                </div>
                {nuocLoi && <p className={editorStyles.error}>Chỉ số mới không được nhỏ hơn {nuocCu} m³.</p>}
                <p className={editorStyles.consumption}>Tiêu thụ: {nuocTieuThu} m³</p>
              </fieldset>
              <div className={editorStyles.grid}>
                <div className={styles.formField}>
                  <label htmlFor={`trang-thai-${reading.ma_ky}`}>Trạng thái</label>
                  {isFinalized ? (
                    <>
                      <input id={`trang-thai-${reading.ma_ky}`} value={reading.trang_thai_duyet ?? ""} readOnly />
                      <input type="hidden" name="trangThai" value={reading.trang_thai_duyet ?? ""} />
                    </>
                  ) : (
                    <select id={`trang-thai-${reading.ma_ky}`} name="trangThai" value={trangThai} onChange={(event) => setTrangThai(event.target.value)}>
                      {METER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  )}
                </div>
                <div className={styles.formField}>
                  <label htmlFor={`ngay-ghi-${reading.ma_ky}`}>Ngày ghi nhận</label>
                  <input id={`ngay-ghi-${reading.ma_ky}`} type="date" name="ngayGhiNhan" value={ngayGhiNhan} onChange={(event) => setNgayGhiNhan(event.target.value)} />
                </div>
              </div>
              <footer className={editorStyles.footer}>
                <button type="button" className={styles.resetButton} onClick={() => setOpen(false)} disabled={pending}>Hủy bỏ</button>
                <button type="submit" className={styles.primaryButton} disabled={pending || dienLoi || nuocLoi}>{pending ? "Đang lưu..." : "Lưu thay đổi"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export function DeleteMeterButton({ maKy }: { maKy: string }) {
  const [state, formAction, pending] = useActionState(
    deleteMeterReading,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Bạn có chắc muốn xóa kỳ ${maKy}?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maKy" value={maKy} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

/** Ghi chỉ số tại quầy; trạng thái và kỳ được xác định phía máy chủ. */
export function CreateMeterModal({ contracts }: { contracts: ContractOption[] }) {
  const [open, setOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState(contracts[0]?.ma_hop_dong ?? "");
  const currentContract = contracts.find((contract) => contract.ma_hop_dong === selectedContractId);
  const [dienCu, setDienCu] = useState(String(Number(currentContract?.chi_so_dien) || 0));
  const [nuocCu, setNuocCu] = useState(String(Number(currentContract?.chi_so_nuoc) || 0));
  const [dienMoi, setDienMoi] = useState("");
  const [nuocMoi, setNuocMoi] = useState("");
  const [ngayGhiNhan, setNgayGhiNhan] = useState(today());
  const [state, formAction, pending] = useActionState(async (previous: MeterFormState, formData: FormData) => {
    const result = await createMeterReading(previous, formData);
    if (result.success) {
      setOpen(false);
      setDienMoi("");
      setNuocMoi("");
    }
    return result;
  }, initialState);
  const dienLoi = dienMoi !== "" && Number(dienMoi) < Number(dienCu);
  const nuocLoi = nuocMoi !== "" && Number(nuocMoi) < Number(nuocCu);
  const handleContractChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    setSelectedContractId(id);
    const contract = contracts.find((item) => item.ma_hop_dong === id);
    setDienCu(String(Number(contract?.chi_so_dien) || 0));
    setNuocCu(String(Number(contract?.chi_so_nuoc) || 0));
    setDienMoi("");
    setNuocMoi("");
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={styles.primary}>Ghi chỉ số mới</button>
      {open && (
        <div className={editorStyles.backdrop} onClick={(event) => {
          if (event.target === event.currentTarget && !pending) setOpen(false);
        }}>
          <section className={editorStyles.panel} role="dialog" aria-modal="true" aria-labelledby="create-meter-title">
            <header className={editorStyles.header}>
              <h2 id="create-meter-title">Ghi chỉ số điện nước</h2>
              <button type="button" className={styles.linkButton} onClick={() => setOpen(false)} disabled={pending}>Đóng</button>
            </header>
            <form action={formAction} className={editorStyles.form}>
              {state.error && <p className={editorStyles.error} role="alert">{state.error}</p>}
              <div className={editorStyles.grid}>
                <div className={styles.formField}>
                  <label htmlFor="create-meter-contract">Hợp đồng / Phòng thuê</label>
                  <select id="create-meter-contract" name="maHopDong" value={selectedContractId} onChange={handleContractChange} required>
                    <option value="" disabled>Chọn phòng thuê</option>
                    {contracts.map((contract) => (
                      <option key={contract.ma_hop_dong} value={contract.ma_hop_dong}>
                        {contract.ma_phong} — {contract.ten_khach || "Khách thuê"} ({contract.ma_hop_dong})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formField}>
                  <label htmlFor="create-meter-date">Ngày ghi nhận</label>
                  <input id="create-meter-date" name="ngayGhiNhan" type="date" value={ngayGhiNhan} onChange={(event) => setNgayGhiNhan(event.target.value)} required />
                </div>
              </div>
              {[
                { key: "dien", title: "Điện (kWh)", unit: "kWh", oldName: "chiSoDienCu", newName: "chiSoDienMoi", oldValue: dienCu, newValue: dienMoi, setOld: setDienCu, setNew: setDienMoi, invalid: dienLoi },
                { key: "nuoc", title: "Nước (m³)", unit: "m³", oldName: "chiSoNuocCu", newName: "chiSoNuocMoi", oldValue: nuocCu, newValue: nuocMoi, setOld: setNuocCu, setNew: setNuocMoi, invalid: nuocLoi },
              ].map((meter) => (
                <fieldset key={meter.key} className={editorStyles.group}>
                  <legend>{meter.title}</legend>
                  <div className={editorStyles.grid}>
                    <div className={styles.formField}>
                      <label htmlFor={`create-${meter.key}-old`}>Chỉ số cũ</label>
                      <input id={`create-${meter.key}-old`} name={meter.oldName} type="number" step="0.01" min={0} value={meter.oldValue} onChange={(event) => meter.setOld(event.target.value)} required />
                    </div>
                    <div className={styles.formField}>
                      <label htmlFor={`create-${meter.key}-new`}>Chỉ số mới</label>
                      <input id={`create-${meter.key}-new`} name={meter.newName} type="number" step="0.01" min={Number(meter.oldValue)} value={meter.newValue} onChange={(event) => meter.setNew(event.target.value)} required aria-invalid={meter.invalid} />
                    </div>
                  </div>
                  {meter.invalid && <p className={editorStyles.error}>Chỉ số mới không được nhỏ hơn chỉ số cũ.</p>}
                  <p className={editorStyles.consumption}>Tiêu thụ: {Math.max(0, Number(meter.newValue) - Number(meter.oldValue)).toLocaleString("vi-VN")} {meter.unit}</p>
                </fieldset>
              ))}
              <footer className={editorStyles.footer}>
                <button type="button" className={styles.resetButton} onClick={() => setOpen(false)} disabled={pending}>Hủy bỏ</button>
                <button type="submit" className={styles.primaryButton} disabled={pending || dienLoi || nuocLoi}>{pending ? "Đang lưu..." : "Lưu chỉ số"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
