"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Check, X, Pencil, Zap, Droplets, AlertTriangle, ExternalLink, CheckCircle2, Lock, Image as ImageIcon, Clock, Bell, Send, FileText, Plus } from "lucide-react";
import { createMeterReading, deleteMeterReading, updateMeterReading, approveMeterReading, rejectMeterReading, remindTenantToSubmitMeter, type MeterFormState } from "./actions";
import type { ContractOption, MeterProgressData, MeterRow } from "@/lib/queries";
import { detectMeterAnomaly } from "@/lib/meter-utils";
import styles from "@/components/business.module.css";

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
  const pctSubmitted = progress.percentSubmitted;
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "var(--primary-subtle)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={19} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Tiến Độ Chốt Số Kỳ {progress.selectedPeriod}
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
              Theo dõi tình trạng khách chụp ảnh công tơ gửi qua Mobile App
            </p>
          </div>
        </div>

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
            {progress.submitted} / {progress.totalRooms}{" "}
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>({pctSubmitted}%)</span>
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
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-main)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                <Bell size={12} /> Nhắc nộp
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
          {progress.unsubmittedRooms.length === 0 ? (
            <span style={{ color: "var(--status-success-text)", fontWeight: 600 }}>
              🎉 Tất cả các phòng có khách ở đều đã nộp ảnh chỉ số kỳ này!
            </span>
          ) : (
            <span>
              Còn <strong>{progress.unsubmittedRooms.length}</strong> phòng chưa chụp gửi ảnh đồng hồ.
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
                <X size={20} />
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
                <Check size={15} /> {remindFeedback}
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
                {remindingId === "ALL" ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {remindedAll ? "Đã gửi thông báo tất cả" : "Gửi thông báo nhắc tất cả phòng"}
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
                        {remindingId === r.ma_phong ? (
                          <LoaderCircle size={12} className="animate-spin" />
                        ) : (
                          <Bell size={12} />
                        )}
                        Nhắc App
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
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
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
        <ImageIcon size={13} />
        <span>Xem ảnh</span>
        <span
          style={{
            fontSize: 10.5,
            padding: "1px 5px",
            background: "#dbeafe",
            borderRadius: 999,
            color: "var(--primary)",
            fontWeight: 700,
          }}
        >
          {[reading.anh_dien && "Điện", reading.anh_nuoc && "Nước"]
            .filter(Boolean)
            .join("+")}
        </span>
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
                  <Zap size={15} color="var(--status-warning-text)" /> Ảnh đồng hồ Điện
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
                  <Droplets size={15} color="var(--status-info-text)" /> Ảnh đồng hồ Nước
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

/**
 * MODAL HIỆU CHỈNH CHỈ SỐ ĐIỆN NƯỚC (RỘNG RÃI, TIỆN LỢI, ĐỐI SOÁT ẢNH TRỰC TIẾP)
 * - Chỉ cho sửa CHỈ SỐ MỚI (chỉ số cũ khóa cố định từ DB).
 * - Xét tính hợp lý trạng thái: Nếu đã "Đã duyệt" hoặc "Từ chối" thì KHÔNG cho đổi trạng thái nữa.
 *   Nếu đang "Chờ duyệt" thì cho phép chuyển sang Đã duyệt hoặc Từ chối.
 */
export function MeterEditorToggle({
  reading,
}: {
  reading: MeterRow;
  contracts: ContractOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState<"dien" | "nuoc">(
    reading.anh_dien ? "dien" : "nuoc",
  );

  const isFinalized =
    reading.trang_thai_duyet === "Đã duyệt" ||
    reading.trang_thai_duyet === "Từ chối";

  const chiSoDienCuNum = Number(reading.chi_so_dien_cu) || 0;
  const chiSoNuocCuNum = Number(reading.chi_so_nuoc_cu) || 0;

  const [chiSoDienMoi, setChiSoDienMoi] = useState<string>(
    reading.chi_so_dien_moi ?? "",
  );
  const [chiSoNuocMoi, setChiSoNuocMoi] = useState<string>(
    reading.chi_so_nuoc_moi ?? "",
  );
  const [trangThai, setTrangThai] = useState<string>(
    reading.trang_thai_duyet ?? "Chờ duyệt",
  );
  const [ngayGhiNhan, setNgayGhiNhan] = useState<string>(
    reading.ngay_ghi_nhan?.slice(0, 10) ?? today(),
  );

  const [state, formAction, pending] = useActionState(
    updateMeterReading,
    initialState,
  );

  // Tính tiêu thụ realtime
  const dMoi = Number(chiSoDienMoi) || 0;
  const dienTieuThu = Math.max(0, dMoi - chiSoDienCuNum);
  const dienLoi = dMoi < chiSoDienCuNum && chiSoDienMoi !== "";

  const nMoi = Number(chiSoNuocMoi) || 0;
  const nuocTieuThu = Math.max(0, nMoi - chiSoNuocCuNum);
  const nuocLoi = nMoi < chiSoNuocCuNum && chiSoNuocMoi !== "";

  const anomaly = detectMeterAnomaly({
    dien_tieu_thu: dienTieuThu,
    nuoc_tieu_thu: nuocTieuThu,
    dien_ky_truoc: reading.dien_ky_truoc,
    nuoc_ky_truoc: reading.nuoc_ky_truoc,
    trang_thai_phong: reading.trang_thai_phong,
  });

  const currentImg =
    activePhoto === "dien" ? reading.anh_dien : reading.anh_nuoc;

  const handleOpen = () => {
    setChiSoDienMoi(reading.chi_so_dien_moi ?? "");
    setChiSoNuocMoi(reading.chi_so_nuoc_moi ?? "");
    setTrangThai(reading.trang_thai_duyet ?? "Chờ duyệt");
    setNgayGhiNhan(reading.ngay_ghi_nhan?.slice(0, 10) ?? today());
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="Hiệu chỉnh chỉ số & đối soát ảnh"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "var(--bg-surface)",
          color: "var(--primary)",
          border: "1px solid var(--primary-subtle)",
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Pencil size={13} /> Sửa chỉ số
      </button>

      {open && (
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
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 16,
              maxWidth: 960,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-subtle)",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "#dbeafe",
                    color: "var(--primary)",
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Pencil size={18} />
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "var(--text-main)",
                      margin: 0,
                    }}
                  >
                    Hiệu Chỉnh Chỉ Số Điện Nước &amp; Đối Soát Ảnh
                  </h2>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      margin: "3px 0 0",
                      display: "flex",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>Phòng <strong>{reading.ma_phong}</strong></span>
                    <span>Khách thuê: <strong>{reading.ten_khach || "—"}</strong></span>
                    <span>Kỳ: <strong>{reading.thang_nam}</strong> ({reading.ma_ky})</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form body */}
            <form
              action={async (formData) => {
                await formAction(formData);
                router.refresh();
              }}
              style={{ padding: 22 }}
            >
              <input type="hidden" name="maKy" value={reading.ma_ky} />
              <input
                type="hidden"
                name="maHopDong"
                value={reading.ma_hop_dong ?? ""}
              />
              <input
                type="hidden"
                name="thangNam"
                value={reading.thang_nam ?? ""}
              />
              <input
                type="hidden"
                name="anhDien"
                value={reading.anh_dien ?? ""}
              />
              <input
                type="hidden"
                name="anhNuoc"
                value={reading.anh_nuoc ?? ""}
              />

              {state.error && (
                <div
                  style={{
                    background: "var(--status-danger-bg)",
                    border: "1px solid var(--status-danger-border)",
                    color: "var(--status-danger-text)",
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
                    background: "var(--status-success-bg)",
                    border: "1px solid var(--status-success-border)",
                    color: "var(--status-success-text)",
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

              {/* 2 Cột lớn: Cột Trái (Ảnh) - Cột Phải (Form) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(320px, 1fr) minmax(360px, 1fr)",
                  gap: 20,
                  marginBottom: 20,
                }}
              >
                {/* ── CỘT TRÁI: ẢNH ĐỒNG HỒ KHÁCH GỬI ── */}
                <div
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--text-main)",
                      }}
                    >
                      📸 Ảnh công tơ từ phòng
                    </span>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setActivePhoto("dien")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border:
                            activePhoto === "dien"
                              ? "2px solid var(--status-warning-text)"
                              : "1px solid var(--border)",
                          background:
                            activePhoto === "dien" ? "var(--status-warning-bg)" : "var(--bg-surface)",
                          color: activePhoto === "dien" ? "var(--status-warning-text)" : "var(--text-muted)",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ⚡ Điện
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePhoto("nuoc")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border:
                            activePhoto === "nuoc"
                              ? "2px solid var(--status-info-text)"
                              : "1px solid var(--border)",
                          background:
                            activePhoto === "nuoc" ? "var(--status-info-bg)" : "var(--bg-surface)",
                          color: activePhoto === "nuoc" ? "var(--status-info-text)" : "var(--text-muted)",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        💧 Nước
                      </button>
                    </div>
                  </div>

                  {/* Ảnh hiển thị to rõ */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 280,
                      maxHeight: 380,
                      background: "var(--text-main)",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 10,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {currentImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentImg}
                        alt={`Ảnh đồng hồ ${activePhoto}`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                          borderRadius: 6,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          color: "var(--text-muted)",
                          fontSize: 12.5,
                          textAlign: "center",
                        }}
                      >
                        Khách không đính kèm ảnh cho đồng hồ {activePhoto}.
                      </div>
                    )}
                  </div>

                  {currentImg && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <a
                        href={currentImg}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 11.5,
                          color: "var(--primary)",
                          textDecoration: "underline",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        Mở ảnh gốc trong tab mới <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>

                {/* ── CỘT PHẢI: FORM HIỆU CHỈNH CHỈ SỐ ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Cảnh báo tiêu thụ bất thường */}
                  {anomaly.hasAnomaly && (
                    <div
                      style={{
                        background: "var(--status-danger-bg)",
                        border: "1px solid var(--status-danger-border)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        color: "var(--status-danger-text)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 700,
                          fontSize: 13,
                          marginBottom: 6,
                        }}
                      >
                        <AlertTriangle size={16} color="var(--status-danger-text)" />
                        Phát hiện tiêu thụ bất thường:
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {anomaly.details.map((d, idx) => (
                          <li key={idx} style={{ marginBottom: 2 }}>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Thông tin hóa đơn đã kết chuyển */}
                  {reading.ma_hoa_don && (
                    <div
                      style={{
                        background: "var(--status-success-bg)",
                        border: "1px solid var(--status-success-border)",
                        borderRadius: 12,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12.5,
                          color: "var(--status-success-text)",
                        }}
                      >
                        <FileText size={15} color="var(--status-success-text)" />
                        <span>
                          Đã kết chuyển Hóa đơn:{" "}
                          <strong>{reading.ma_hoa_don}</strong>
                        </span>
                      </div>
                      <Link
                        href={`/hoa-don?keyword=${encodeURIComponent(
                          reading.ma_hoa_don,
                        )}`}
                        target="_blank"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--status-success-text)",
                          textDecoration: "underline",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        Xem hóa đơn <ExternalLink size={12} />
                      </Link>
                    </div>
                  )}

                  {/* Khối Điện */}
                  <div
                    style={{
                      background: "var(--status-warning-bg)",
                      border: "1px solid var(--status-warning-border)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 13.5,
                          color: "var(--status-warning-text)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Zap size={16} color="var(--status-warning-text)" /> CHỈ SỐ ĐIỆN (kWh)
                      </strong>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--status-warning-bg)",
                          color: "var(--status-warning-text)",
                          border: "1px solid var(--status-warning-border)",
                        }}
                      >
                        Tiêu thụ: {dienTieuThu} kWh
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      {/* Số điện cũ: KHÔNG CHO SỬA (Cố định từ kỳ trước) */}
                      <div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            color: "var(--status-warning-text)",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          <Lock size={11} color="var(--status-warning-text)" /> Số điện cũ (Kỳ trước)
                        </label>
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--status-warning-border)",
                            background: "var(--status-warning-bg)",
                            color: "var(--status-warning-text)",
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{chiSoDienCuNum}</span>
                          <span style={{ fontSize: 11, color: "var(--status-warning-text)" }}>
                            kWh
                          </span>
                        </div>
                      </div>

                      {/* Số điện mới: CHO PHÉP HIỆU CHỈNH */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: 11.5,
                            color: "var(--status-warning-text)",
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          Số điện mới (Hiệu chỉnh) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          name="chiSoDienMoi"
                          value={chiSoDienMoi}
                          onChange={(e) => setChiSoDienMoi(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: dienLoi
                              ? "2px solid var(--status-danger-text)"
                              : "2px solid var(--status-warning-text)",
                            fontSize: 16,
                            fontWeight: 800,
                            color: "var(--text-main)",
                            background: "var(--bg-surface)",
                          }}
                        />
                      </div>
                    </div>

                    {dienLoi && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--status-danger-text)",
                          marginTop: 6,
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ Số điện mới ({dMoi}) không được nhỏ hơn số cũ (
                        {chiSoDienCuNum})!
                      </div>
                    )}
                  </div>

                  {/* Khối Nước */}
                  <div
                    style={{
                      background: "var(--status-info-bg)",
                      border: "1px solid var(--status-info-border)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 13.5,
                          color: "var(--status-info-text)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Droplets size={16} color="var(--status-info-text)" /> CHỈ SỐ NƯỚC (m³)
                      </strong>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--status-info-bg)",
                          color: "var(--status-info-text)",
                          border: "1px solid var(--status-info-border)",
                        }}
                      >
                        Tiêu thụ: {nuocTieuThu} m³
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      {/* Số nước cũ: KHÔNG CHO SỬA (Cố định từ kỳ trước) */}
                      <div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            color: "var(--status-info-text)",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          <Lock size={11} color="var(--status-info-text)" /> Số nước cũ (Kỳ trước)
                        </label>
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--status-info-border)",
                            background: "var(--status-info-bg)",
                            color: "var(--status-info-text)",
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{chiSoNuocCuNum}</span>
                          <span style={{ fontSize: 11, color: "var(--status-info-text)" }}>
                            m³
                          </span>
                        </div>
                      </div>

                      {/* Số nước mới: CHO PHÉP HIỆU CHỈNH */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: 11.5,
                            color: "var(--status-info-text)",
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          Số nước mới (Hiệu chỉnh) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          name="chiSoNuocMoi"
                          value={chiSoNuocMoi}
                          onChange={(e) => setChiSoNuocMoi(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: nuocLoi
                              ? "2px solid var(--status-danger-text)"
                              : "2px solid var(--status-info-text)",
                            fontSize: 16,
                            fontWeight: 800,
                            color: "var(--text-main)",
                            background: "var(--bg-surface)",
                          }}
                        />
                      </div>
                    </div>

                    {nuocLoi && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--status-danger-text)",
                          marginTop: 6,
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ Số nước mới ({nMoi}) không được nhỏ hơn số cũ (
                        {chiSoNuocCuNum})!
                      </div>
                    )}
                  </div>

                  {/* Trạng thái duyệt & Ngày ghi nhận */}
                  <div
                    style={{
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ marginBottom: 10 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--text-main)",
                          marginBottom: 6,
                        }}
                      >
                        Trạng thái duyệt kỳ này
                      </label>

                      {isFinalized ? (
                        // Đã duyệt hoặc Từ chối: KHÓA TRẠNG THÁI (Không cho đổi nữa)
                        <div
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            background:
                              reading.trang_thai_duyet === "Đã duyệt"
                                ? "var(--status-success-bg)"
                                : "var(--status-danger-bg)",
                            border: `1px solid ${
                              reading.trang_thai_duyet === "Đã duyệt"
                                ? "var(--status-success-border)"
                                : "var(--status-danger-border)"
                            }`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {reading.trang_thai_duyet === "Đã duyệt" ? (
                              <CheckCircle2 size={16} color="var(--status-success-text)" />
                            ) : (
                              <X size={16} color="var(--status-danger-text)" />
                            )}
                            <strong
                              style={{
                                fontSize: 13,
                                color:
                                  reading.trang_thai_duyet === "Đã duyệt"
                                    ? "var(--status-success-text)"
                                    : "var(--status-danger-text)",
                              }}
                            >
                              Trạng thái: {reading.trang_thai_duyet}
                            </strong>
                          </div>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: "var(--text-muted)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Lock size={12} /> Đã chốt, không thể đổi trạng thái
                          </span>
                          <input
                            type="hidden"
                            name="trangThai"
                            value={reading.trang_thai_duyet ?? ""}
                          />
                        </div>
                      ) : (
                        // Đang "Chờ duyệt": CHO PHÉP ĐỔI TRẠNG THÁI
                        <div style={{ display: "flex", gap: 8 }}>
                          {METER_STATUSES.map((status) => {
                            const isSel = trangThai === status;
                            const bg =
                              status === "Đã duyệt"
                                ? isSel
                                  ? "var(--status-success-bg)"
                                  : "var(--bg-surface)"
                                : status === "Từ chối"
                                  ? isSel
                                    ? "var(--status-danger-bg)"
                                    : "var(--bg-surface)"
                                  : isSel
                                    ? "var(--status-warning-bg)"
                                    : "var(--bg-surface)";
                            const border =
                              status === "Đã duyệt"
                                ? isSel
                                  ? "2px solid var(--status-success-text)"
                                  : "1px solid var(--border)"
                                : status === "Từ chối"
                                  ? isSel
                                    ? "2px solid var(--status-danger-text)"
                                    : "1px solid var(--border)"
                                  : isSel
                                    ? "2px solid var(--status-warning-text)"
                                    : "1px solid var(--border)";
                            const color =
                              status === "Đã duyệt"
                                ? "var(--status-success-text)"
                                : status === "Từ chối"
                                  ? "var(--status-danger-text)"
                                  : "var(--status-warning-text)";

                            return (
                              <label
                                key={status}
                                style={{
                                  flex: 1,
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  border,
                                  background: bg,
                                  cursor: "pointer",
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  color,
                                  textAlign: "center",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                }}
                              >
                                <input
                                  type="radio"
                                  name="trangThai"
                                  value={status}
                                  checked={isSel}
                                  onChange={() => setTrangThai(status)}
                                  style={{ display: "none" }}
                                />
                                {isSel && <Check size={14} />} {status}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        Ngày ghi nhận
                      </label>
                      <input
                        type="date"
                        name="ngayGhiNhan"
                        value={ngayGhiNhan}
                        onChange={(e) => setNgayGhiNhan(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          fontSize: 12.5,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderTop: "1px solid var(--border)",
                  paddingTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={pending || dienLoi || nuocLoi}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--primary)",
                    color: "var(--bg-surface)",
                    fontWeight: 700,
                    cursor:
                      pending || dienLoi || nuocLoi ? "not-allowed" : "pointer",
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {pending ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" /> Đang
                      lưu...
                    </>
                  ) : isFinalized ? (
                    "Lưu số mới đã hiệu chỉnh"
                  ) : (
                    "Lưu thay đổi"
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

/**
 * Modal cho phép Chủ trọ/Quản lý tự chủ động ghi chỉ số điện nước mới cho phòng
 * (Tự động kế thừa chỉ số cũ từ phòng, khi duyệt sẽ cập nhật ngược lại phòng).
 */
export function CreateMeterModal({
  contracts,
}: {
  contracts: ContractOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createMeterReading,
    initialState,
  );

  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const [selectedContractId, setSelectedContractId] = useState(
    contracts[0]?.ma_hop_dong ?? "",
  );

  const currentContract = contracts.find((c) => c.ma_hop_dong === selectedContractId);
  const [dienCu, setDienCu] = useState<string>(
    currentContract?.chi_so_dien ? String(Number(currentContract.chi_so_dien)) : "0",
  );
  const [nuocCu, setNuocCu] = useState<string>(
    currentContract?.chi_so_nuoc ? String(Number(currentContract.chi_so_nuoc)) : "0",
  );
  const [dienMoi, setDienMoi] = useState<string>("");
  const [nuocMoi, setNuocMoi] = useState<string>("");
  const [trangThai, setTrangThai] = useState<string>("Đã duyệt");
  const [thangNam, setThangNam] = useState<string>(currentMonthStr);
  const [ngayGhiNhan, setNgayGhiNhan] = useState<string>(today());

  const handleContractChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedContractId(val);
    const found = contracts.find((c) => c.ma_hop_dong === val);
    if (found) {
      setDienCu(found.chi_so_dien ? String(Number(found.chi_so_dien)) : "0");
      setNuocCu(found.chi_so_nuoc ? String(Number(found.chi_so_nuoc)) : "0");
    }
  };

  const dienCuNum = Number(dienCu) || 0;
  const nuocCuNum = Number(nuocCu) || 0;
  const dienMoiNum = Number(dienMoi) || 0;
  const nuocMoiNum = Number(nuocMoi) || 0;

  const dienTieuThu = dienMoi !== "" ? Math.max(0, dienMoiNum - dienCuNum) : 0;
  const nuocTieuThu = nuocMoi !== "" ? Math.max(0, nuocMoiNum - nuocCuNum) : 0;

  const dienLoi = dienMoi !== "" && dienMoiNum < dienCuNum;
  const nuocLoi = nuocMoi !== "" && nuocMoiNum < nuocCuNum;

  const [prevSuccess, setPrevSuccess] = useState(state.success);
  if (state.success && state.success !== prevSuccess) {
    setPrevSuccess(state.success);
    if (open) {
      setOpen(false);
      setDienMoi("");
      setNuocMoi("");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.primary}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 700,
        }}
      >
        <Plus size={16} /> Ghi chỉ số mới
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 640,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "var(--primary-subtle)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Zap size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "var(--text-main)",
                      margin: 0,
                    }}
                  >
                    Ghi Nhận Chỉ Số Điện Nước
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Chủ trọ ghi số đo — Tự động kế thừa chỉ số phòng &amp; cập nhật lại phòng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{
                  border: "none",
                  background: "var(--bg-subtle)",
                  color: "var(--text-muted)",
                  borderRadius: 8,
                  padding: 6,
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form action={formAction} style={{ padding: "20px 24px" }}>
              {state.error && (
                <div
                  style={{
                    background: "var(--status-danger-bg)",
                    border: "1px solid var(--status-danger-bg)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: "var(--status-danger-text)",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {state.error}
                </div>
              )}

              {/* Chọn phòng / hợp đồng */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--text-main)",
                    marginBottom: 6,
                  }}
                >
                  Chọn Hợp đồng / Phòng thuê *
                </label>
                <select
                  name="maHopDong"
                  value={selectedContractId}
                  onChange={handleContractChange}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--text-main)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  {contracts.map((c) => (
                    <option key={c.ma_hop_dong} value={c.ma_hop_dong}>
                      {c.ma_phong}   {c.ten_khach || "Khách thuê"} (HĐ: {c.ma_hop_dong})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                  Chỉ số hiện tại lưu ở phòng: Điện <strong>{dienCu} kWh</strong> | Nước <strong>{nuocCu} m³</strong>
                </div>
              </div>

              {/* Kỳ chốt số & Ngày ghi nhận */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--text-main)",
                      marginBottom: 6,
                    }}
                  >
                    Kỳ tháng/năm (MM/YYYY) *
                  </label>
                  <input
                    name="thangNam"
                    value={thangNam}
                    onChange={(e) => setThangNam(e.target.value)}
                    required
                    placeholder="10/2026"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 13.5,
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--text-main)",
                      marginBottom: 6,
                    }}
                  >
                    Ngày ghi nhận
                  </label>
                  <input
                    name="ngayGhiNhan"
                    type="date"
                    value={ngayGhiNhan}
                    onChange={(e) => setNgayGhiNhan(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 13.5,
                    }}
                  />
                </div>
              </div>

              {/* Nhập chỉ số điện */}
              <div
                style={{
                  background: "var(--primary-subtle)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 14,
                  border: "1px solid #dbeafe",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <Zap size={16} color="var(--primary)" />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--primary)" }}>
                    Chỉ số Công tơ Điện (kWh)
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      Số cũ (từ phòng)
                    </label>
                    <input
                      name="chiSoDienCu"
                      type="number"
                      step="0.01"
                      value={dienCu}
                      onChange={(e) => setDienCu(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--primary)", display: "block", marginBottom: 3, fontWeight: 700 }}>
                      Số mới *
                    </label>
                    <input
                      name="chiSoDienMoi"
                      type="number"
                      step="0.01"
                      min={dienCuNum}
                      required
                      placeholder="Nhập số mới"
                      value={dienMoi}
                      onChange={(e) => setDienMoi(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: dienLoi ? "2px solid var(--status-danger-text)" : "1px solid var(--primary)",
                        background: "var(--bg-surface)",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      Tiêu thụ
                    </label>
                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 6,
                        background: "#dbeafe",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--primary)",
                        textAlign: "center",
                      }}
                    >
                      {dienTieuThu.toLocaleString("vi-VN")} kWh
                    </div>
                  </div>
                </div>
                {dienLoi && (
                  <div style={{ color: "var(--status-danger-text)", fontSize: 11.5, marginTop: 4 }}>
                    ⚠️ Số mới phải lớn hơn hoặc bằng số cũ ({dienCu} kWh)!
                  </div>
                )}
              </div>

              {/* Nhập chỉ số nước */}
              <div
                style={{
                  background: "var(--status-success-bg)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 16,
                  border: "1px solid var(--status-success-bg)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <Droplets size={16} color="var(--status-success-text)" />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--status-success-text)" }}>
                    Chỉ số Đồng hồ Nước (m³)
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      Số cũ (từ phòng)
                    </label>
                    <input
                      name="chiSoNuocCu"
                      type="number"
                      step="0.01"
                      value={nuocCu}
                      onChange={(e) => setNuocCu(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--status-success-text)", display: "block", marginBottom: 3, fontWeight: 700 }}>
                      Số mới *
                    </label>
                    <input
                      name="chiSoNuocMoi"
                      type="number"
                      step="0.01"
                      min={nuocCuNum}
                      required
                      placeholder="Nhập số mới"
                      value={nuocMoi}
                      onChange={(e) => setNuocMoi(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: nuocLoi ? "2px solid var(--status-danger-text)" : "1px solid var(--status-success-text)",
                        background: "var(--bg-surface)",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      Tiêu thụ
                    </label>
                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 6,
                        background: "var(--status-success-bg)",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--status-success-text)",
                        textAlign: "center",
                      }}
                    >
                      {nuocTieuThu.toLocaleString("vi-VN")} m³
                    </div>
                  </div>
                </div>
                {nuocLoi && (
                  <div style={{ color: "var(--status-danger-text)", fontSize: 11.5, marginTop: 4 }}>
                    ⚠️ Số mới phải lớn hơn hoặc bằng số cũ ({nuocCu} m³)!
                  </div>
                )}
              </div>

              {/* Trạng thái duyệt */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--text-main)",
                    marginBottom: 6,
                  }}
                >
                  Trạng thái duyệt
                </label>
                <select
                  name="trangThai"
                  value={trangThai}
                  onChange={(e) => setTrangThai(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    background: "var(--bg-surface)",
                    fontWeight: 600,
                  }}
                >
                  <option value="Đã duyệt">
                    Đã duyệt
                  </option>
                  <option value="Chờ duyệt">
                    Chờ duyệt
                  </option>
                </select>
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderTop: "1px solid var(--border)",
                  paddingTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={pending || dienLoi || nuocLoi}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--primary)",
                    color: "var(--bg-surface)",
                    fontWeight: 700,
                    cursor: pending || dienLoi || nuocLoi ? "not-allowed" : "pointer",
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {pending ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    "Lưu chỉ số"
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
