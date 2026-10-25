"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  Check,
  X,
  Eye,
  Pencil,
  Zap,
  Droplets,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Lock,
  Image as ImageIcon,
  Clock,
  Bell,
  Send,
  FileText,
  Plus,
} from "lucide-react";
import {
  createMeterReading,
  deleteMeterReading,
  updateMeterReading,
  approveMeterReading,
  rejectMeterReading,
  remindTenantToSubmitMeter,
  type MeterFormState,
} from "./actions";
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
            background: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
            borderRadius: 5,
            padding: "2px 6px",
            width: "fit-content",
          }}
        >
          <Zap size={11} color="#dc2626" /> Điện tăng &gt;80%
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
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fca5a5",
            borderRadius: 5,
            padding: "2px 6px",
            width: "fit-content",
          }}
        >
          <Droplets size={11} color="#b91c1c" /> Rò rỉ nước (+80%)
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
            background: "#fffbeb",
            color: "#b45309",
            border: "1px solid #fde68a",
            borderRadius: 5,
            padding: "2px 6px",
            width: "fit-content",
          }}
        >
          <AlertTriangle size={11} color="#b45309" /> Tiêu thụ = 0
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
        background: "#f0fdf4",
        color: "#15803d",
        border: "1px solid #bbf7d0",
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
        background: "#ffffff",
        border: "1px solid #e2e8f0",
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
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={19} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Tiến Độ Chốt Số Kỳ {progress.selectedPeriod}
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
              Theo dõi tình trạng khách chụp ảnh công tơ gửi qua Mobile App
            </p>
          </div>
        </div>

        {/* Dropdown chọn kỳ */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            Chọn kỳ theo dõi:
          </label>
          <select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#1e293b",
              background: "#f8fafc",
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
        <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 11.5, color: "#64748b" }}>Đã nộp</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
            {progress.submitted} / {progress.totalRooms} <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>({pctSubmitted}%)</span>
          </div>
        </div>

        <div style={{ padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #dcfce7" }}>
          <div style={{ fontSize: 11.5, color: "#166534" }}>Đã duyệt</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#15803d", marginTop: 2 }}>
            {progress.approved} phòng
          </div>
        </div>

        <div style={{ padding: "10px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fef3c7" }}>
          <div style={{ fontSize: 11.5, color: "#92400e" }}>Chờ duyệt</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#b45309", marginTop: 2 }}>
            {progress.pending} phòng
          </div>
        </div>

        <div style={{ padding: "10px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fee2e2" }}>
          <div style={{ fontSize: 11.5, color: "#991b1b" }}>Chưa gửi ảnh</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#dc2626", marginTop: 2 }}>
            {progress.unsubmittedRooms.length} phòng
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "#f1f5f9",
            overflow: "hidden",
            display: "flex",
            border: "1px solid #e2e8f0",
          }}
        >
          {pctApproved > 0 && (
            <div
              style={{
                width: `${pctApproved}%`,
                background: "#10b981",
                transition: "width 0.4s ease",
              }}
              title={`Đã duyệt: ${progress.approved} phòng (${pctApproved}%)`}
            />
          )}
          {pctPending > 0 && (
            <div
              style={{
                width: `${pctPending}%`,
                background: "#f59e0b",
                transition: "width 0.4s ease",
              }}
              title={`Chờ duyệt: ${progress.pending} phòng (${pctPending}%)`}
            />
          )}
          {pctUnsubmitted > 0 && (
            <div
              style={{
                width: `${pctUnsubmitted}%`,
                background: "#e2e8f0",
                transition: "width 0.4s ease",
              }}
              title={`Chưa nộp: ${progress.unsubmittedRooms.length} phòng (${pctUnsubmitted}%)`}
            />
          )}
        </div>
      </div>

      {/* Button xem phòng chưa nộp */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {progress.unsubmittedRooms.length === 0 ? (
            <span style={{ color: "#16a34a", fontWeight: 600 }}>
              🎉 Tất cả các phòng có khách ở đều đã nộp ảnh chỉ số kỳ này!
            </span>
          ) : (
            <span>
              Còn <strong>{progress.unsubmittedRooms.length}</strong> phòng chưa chụp gửi ảnh đồng hồ.
            </span>
          )}
        </div>

        {progress.unsubmittedRooms.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUnsubmittedModal(true)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#be123c",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Bell size={13} /> Xem {progress.unsubmittedRooms.length} phòng chưa nộp &amp; Nhắc App
          </button>
        )}
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
              background: "#ffffff",
              borderRadius: 14,
              maxWidth: 680,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #e2e8f0",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Danh Sách Phòng Chưa Nộp Chỉ Số Kỳ {progress.selectedPeriod}
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                  Tổng cộng: {progress.unsubmittedRooms.length} phòng
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnsubmittedModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            {remindFeedback && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
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
                  background: remindedAll ? "#059669" : "#2563eb",
                  color: "#ffffff",
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
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569" }}>Phòng</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569" }}>Khách thuê</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569" }}>Số điện thoại</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {progress.unsubmittedRooms.map((r) => (
                  <tr key={r.ma_hop_dong} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "#1e293b" }}>
                      {r.ma_phong} <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>({r.toa_nha || "Chưa gán tòa"})</span>
                    </td>
                    <td style={{ padding: "10px", color: "#334155" }}>{r.ten_khach || "—"}</td>
                    <td style={{ padding: "10px", color: "#475569" }}>{r.so_dt || "—"}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleRemindSingle(r)}
                        disabled={remindingId === r.ma_phong}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#2563eb",
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
        background: "#059669",
        color: "#ffffff",
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
        background: "#ffffff",
        color: "#dc2626",
        border: "1px solid #fca5a5",
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
      <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
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
          background: "#eff6ff",
          color: "#2563eb",
          border: "1px solid #bfdbfe",
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
            color: "#1d4ed8",
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
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 720,
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
              }}
            >
              <div>
                <strong style={{ fontSize: 15, color: "#0f172a" }}>
                  Ảnh đồng hồ: Phòng {reading.ma_phong} • Kỳ {reading.thang_nam}
                </strong>
                <div style={{ fontSize: 12, color: "#64748b" }}>
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
                  color: "#64748b",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Toggle Điện / Nước */}
            <div
              style={{
                padding: "10px 18px",
                borderBottom: "1px solid #f1f5f9",
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
                        ? "2px solid #eab308"
                        : "1px solid #cbd5e1",
                    background: activePhoto === "dien" ? "#fefce8" : "#fff",
                    color: activePhoto === "dien" ? "#854d0e" : "#475569",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Zap size={15} color="#eab308" /> Ảnh đồng hồ Điện
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
                        ? "2px solid #0284c7"
                        : "1px solid #cbd5e1",
                    background: activePhoto === "nuoc" ? "#f0f9ff" : "#fff",
                    color: activePhoto === "nuoc" ? "#0369a1" : "#475569",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Droplets size={15} color="#0284c7" /> Ảnh đồng hồ Nước
                </button>
              )}
            </div>

            {/* Khung ảnh */}
            <div
              style={{
                padding: 18,
                background: "#0f172a",
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
                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                  Không tìm thấy hình ảnh cho đồng hồ {activePhoto}.
                </div>
              )}
            </div>

            {/* Thanh thông tin dưới ảnh */}
            <div
              style={{
                padding: "12px 18px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
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
                    <strong style={{ color: "#d97706" }}>
                      {reading.chi_so_dien_moi}
                    </strong>{" "}
                    (Tiêu thụ: <strong>{reading.dien_tieu_thu} kWh</strong>)
                  </span>
                ) : (
                  <span>
                    Số nước khách gửi: <strong>{reading.chi_so_nuoc_cu}</strong>{" "}
                    →{" "}
                    <strong style={{ color: "#0284c7" }}>
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
                  border: "1px solid #cbd5e1",
                  background: "#fff",
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
  contracts,
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
          background: "#ffffff",
          color: "#1e40af",
          border: "1px solid #bfdbfe",
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
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 960,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "#dbeafe",
                    color: "#1e40af",
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
                      color: "#0f172a",
                      margin: 0,
                    }}
                  >
                    Hiệu Chỉnh Chỉ Số Điện Nước &amp; Đối Soát Ảnh
                  </h2>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "#64748b",
                      margin: "3px 0 0",
                    }}
                  >
                    Phòng <strong>{reading.ma_phong}</strong> • Khách thuê:{" "}
                    <strong>{reading.ten_khach || "—"}</strong> • Kỳ:{" "}
                    <strong>{reading.thang_nam}</strong> ({reading.ma_ky})
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
                  color: "#94a3b8",
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
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
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
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#047857",
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
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
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
                        color: "#334155",
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
                              ? "2px solid #eab308"
                              : "1px solid #cbd5e1",
                          background:
                            activePhoto === "dien" ? "#fefce8" : "#fff",
                          color: activePhoto === "dien" ? "#854d0e" : "#475569",
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
                              ? "2px solid #0284c7"
                              : "1px solid #cbd5e1",
                          background:
                            activePhoto === "nuoc" ? "#f0f9ff" : "#fff",
                          color: activePhoto === "nuoc" ? "#0369a1" : "#475569",
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
                      background: "#0f172a",
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
                          color: "#94a3b8",
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
                          color: "#2563eb",
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
                        background: "#fef2f2",
                        border: "1px solid #fca5a5",
                        borderRadius: 12,
                        padding: "12px 14px",
                        color: "#991b1b",
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
                        <AlertTriangle size={16} color="#dc2626" />
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
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
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
                          color: "#166534",
                        }}
                      >
                        <FileText size={15} color="#15803d" />
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
                          color: "#15803d",
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
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
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
                          color: "#92400e",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Zap size={16} color="#eab308" /> CHỈ SỐ ĐIỆN (kWh)
                      </strong>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#fef3c7",
                          color: "#b45309",
                          border: "1px solid #fde68a",
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
                            color: "#78350f",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          <Lock size={11} color="#92400e" /> Số điện cũ (Kỳ trước)
                        </label>
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #fcd34d",
                            background: "#fef3c7",
                            color: "#78350f",
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{chiSoDienCuNum}</span>
                          <span style={{ fontSize: 11, color: "#92400e" }}>
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
                            color: "#78350f",
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
                              ? "2px solid #ef4444"
                              : "2px solid #eab308",
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#0f172a",
                            background: "#ffffff",
                          }}
                        />
                      </div>
                    </div>

                    {dienLoi && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "#dc2626",
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
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
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
                          color: "#0369a1",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Droplets size={16} color="#0284c7" /> CHỈ SỐ NƯỚC (m³)
                      </strong>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #bae6fd",
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
                            color: "#075985",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          <Lock size={11} color="#0369a1" /> Số nước cũ (Kỳ trước)
                        </label>
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #7dd3fc",
                            background: "#e0f2fe",
                            color: "#075985",
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{chiSoNuocCuNum}</span>
                          <span style={{ fontSize: 11, color: "#0369a1" }}>
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
                            color: "#075985",
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
                              ? "2px solid #ef4444"
                              : "2px solid #0284c7",
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#0f172a",
                            background: "#ffffff",
                          }}
                        />
                      </div>
                    </div>

                    {nuocLoi && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "#dc2626",
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
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
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
                          color: "#334155",
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
                                ? "#ecfdf5"
                                : "#fef2f2",
                            border: `1px solid ${
                              reading.trang_thai_duyet === "Đã duyệt"
                                ? "#a7f3d0"
                                : "#fecaca"
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
                              <CheckCircle2 size={16} color="#059669" />
                            ) : (
                              <X size={16} color="#dc2626" />
                            )}
                            <strong
                              style={{
                                fontSize: 13,
                                color:
                                  reading.trang_thai_duyet === "Đã duyệt"
                                    ? "#065f46"
                                    : "#991b1b",
                              }}
                            >
                              Trạng thái: {reading.trang_thai_duyet}
                            </strong>
                          </div>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: "#64748b",
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
                                  ? "#dcfce7"
                                  : "#fff"
                                : status === "Từ chối"
                                  ? isSel
                                    ? "#fee2e2"
                                    : "#fff"
                                  : isSel
                                    ? "#fef3c7"
                                    : "#fff";
                            const border =
                              status === "Đã duyệt"
                                ? isSel
                                  ? "2px solid #059669"
                                  : "1px solid #cbd5e1"
                                : status === "Từ chối"
                                  ? isSel
                                    ? "2px solid #dc2626"
                                    : "1px solid #cbd5e1"
                                  : isSel
                                    ? "2px solid #d97706"
                                    : "1px solid #cbd5e1";
                            const color =
                              status === "Đã duyệt"
                                ? "#15803d"
                                : status === "Từ chối"
                                  ? "#b91c1c"
                                  : "#b45309";

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
                          color: "#475569",
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
                          border: "1px solid #cbd5e1",
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
                  borderTop: "1px solid #e2e8f0",
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
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
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
                    background: "#2563eb",
                    color: "#ffffff",
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
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 640,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid #e2e8f0",
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
                borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(to right, #f8fafc, #ffffff)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#eff6ff",
                    color: "#2563eb",
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
                      color: "#0f172a",
                      margin: 0,
                    }}
                  >
                    Ghi Nhận Chỉ Số Điện Nước
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                    Chủ trọ ghi số đo • Tự động kế thừa chỉ số phòng &amp; cập nhật lại phòng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  color: "#64748b",
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
                    background: "#fef2f2",
                    border: "1px solid #fee2e2",
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: "#dc2626",
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
                    color: "#334155",
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
                    border: "1px solid #cbd5e1",
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                >
                  {contracts.map((c) => (
                    <option key={c.ma_hop_dong} value={c.ma_hop_dong}>
                      {c.ma_phong} • {c.ten_khach || "Khách thuê"} (HĐ: {c.ma_hop_dong})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
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
                      color: "#334155",
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
                      border: "1px solid #cbd5e1",
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
                      color: "#334155",
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
                      border: "1px solid #cbd5e1",
                      fontSize: 13.5,
                    }}
                  />
                </div>
              </div>

              {/* Nhập chỉ số điện */}
              <div
                style={{
                  background: "#eff6ff",
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
                  <Zap size={16} color="#2563eb" />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e40af" }}>
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
                    <label style={{ fontSize: 11.5, color: "#64748b", display: "block", marginBottom: 3 }}>
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
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#1e40af", display: "block", marginBottom: 3, fontWeight: 700 }}>
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
                        border: dienLoi ? "2px solid #ef4444" : "1px solid #2563eb",
                        background: "#ffffff",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#64748b", display: "block", marginBottom: 3 }}>
                      Tiêu thụ
                    </label>
                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 6,
                        background: "#dbeafe",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#1e40af",
                        textAlign: "center",
                      }}
                    >
                      {dienTieuThu.toLocaleString("vi-VN")} kWh
                    </div>
                  </div>
                </div>
                {dienLoi && (
                  <div style={{ color: "#dc2626", fontSize: 11.5, marginTop: 4 }}>
                    ⚠️ Số mới phải lớn hơn hoặc bằng số cũ ({dienCu} kWh)!
                  </div>
                )}
              </div>

              {/* Nhập chỉ số nước */}
              <div
                style={{
                  background: "#f0fdf4",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 16,
                  border: "1px solid #dcfce7",
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
                  <Droplets size={16} color="#15803d" />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#15803d" }}>
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
                    <label style={{ fontSize: 11.5, color: "#64748b", display: "block", marginBottom: 3 }}>
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
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#15803d", display: "block", marginBottom: 3, fontWeight: 700 }}>
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
                        border: nuocLoi ? "2px solid #ef4444" : "1px solid #15803d",
                        background: "#ffffff",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#64748b", display: "block", marginBottom: 3 }}>
                      Tiêu thụ
                    </label>
                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 6,
                        background: "#dcfce7",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#15803d",
                        textAlign: "center",
                      }}
                    >
                      {nuocTieuThu.toLocaleString("vi-VN")} m³
                    </div>
                  </div>
                </div>
                {nuocLoi && (
                  <div style={{ color: "#dc2626", fontSize: 11.5, marginTop: 4 }}>
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
                    color: "#334155",
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
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    background: "#ffffff",
                    fontWeight: 600,
                  }}
                >
                  <option value="Đã duyệt">
                    ✅ Đã duyệt (Cập nhật ngay vào phòng &amp; kết chuyển Hóa đơn)
                  </option>
                  <option value="Chờ duyệt">
                    ⏳ Chờ duyệt (Lưu nháp để đối soát lại sau)
                  </option>
                </select>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginTop: 8,
                    fontSize: 11.5,
                    color: "#475569",
                  }}
                >
                  💡 <strong>Cơ chế đồng bộ:</strong> Khi lưu với trạng thái <em>&quot;Đã duyệt&quot;</em>, hệ thống sẽ tự động cập nhật số điện <strong>{dienMoi || dienCu} kWh</strong> và số nước <strong>{nuocMoi || nuocCu} m³</strong> vào trực tiếp thông số phòng để sẵn sàng làm mốc cũ cho kỳ sau.
                </div>
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderTop: "1px solid #e2e8f0",
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
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
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
                    background: "#2563eb",
                    color: "#ffffff",
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
