"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarCheck, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { PendingContractExtension } from "@/lib/queries";
import {
  approveContractExtension,
  rejectContractExtension,
  type ExtensionActionState,
} from "./actions";

const initialState: ExtensionActionState = { error: null, success: null };

function money(num: number | string | null | undefined) {
  if (!num) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
}

function date(str: string | null | undefined) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("vi-VN");
}

export function PendingExtensionsQueue({
  requests,
}: {
  requests: PendingContractExtension[];
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [approveState, approveAction, approvePending] = useActionState(
    approveContractExtension,
    initialState,
  );

  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectContractExtension,
    initialState,
  );

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: 20,
        background: "var(--bg-surface)",
        borderRadius: 10,
        border: "1px solid var(--status-success-border)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--status-success-bg)",
          borderBottom: "1px solid var(--status-success-border)",
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              background: "var(--status-success-text)",
              color: "var(--bg-surface)",
              width: 28,
              height: 28,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalendarCheck size={15} />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--status-success-text)", margin: 0 }}>
            Yêu cầu gia hạn hợp đồng từ Cư dân
          </h2>
          <span
            style={{
              background: "var(--status-success-bg)",
              color: "var(--status-success-text)",
              fontSize: 11.5,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 12,
              border: "1px solid var(--status-success-border)",
            }}
          >
            {requests.length} yêu cầu chờ duyệt
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--status-success-text)" }}>
          Cư dân gửi từ Mobile App — BQL xem xét và duyệt gia hạn
        </span>
      </div>

      {approveState.success && (
        <div style={{ padding: "8px 18px", background: "var(--status-success-bg)", color: "var(--status-success-text)", fontSize: 13, fontWeight: 600 }}>
          {approveState.success}
        </div>
      )}
      {approveState.error && (
        <div style={{ padding: "8px 18px", background: "var(--status-danger-bg)", color: "var(--status-danger-text)", fontSize: 13, fontWeight: 600 }}>
          {approveState.error}
        </div>
      )}
      {rejectState.success && (
        <div style={{ padding: "8px 18px", background: "var(--status-warning-bg)", color: "var(--status-warning-text)", fontSize: 13, fontWeight: 600 }}>
          {rejectState.success}
        </div>
      )}
      {rejectState.error && (
        <div style={{ padding: "8px 18px", background: "var(--status-danger-bg)", color: "var(--status-danger-text)", fontSize: 13, fontWeight: 600 }}>
          {rejectState.error}
        </div>
      )}

      {/* Danh sách yêu cầu */}
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map((r) => (
          <div
            key={r.ma_phu_luc}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 16px",
              background: "var(--bg-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, color: "var(--text-main)", fontSize: 14 }}>
                  Phòng {r.ten_phong || r.ma_phong}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{r.toa_nha}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                  Cư dân: <strong>{r.ten_khach || "—"}</strong> ({r.so_dt || "—"})
                </span>
                <Link
                  href={`/hop-dong/${r.ma_hop_dong}`}
                  style={{
                    fontSize: 11.5,
                    color: "var(--primary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    textDecoration: "none",
                  }}
                >
                  <FileText size={12} /> HĐ: {r.ma_hop_dong}
                </Link>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--text-main)", marginTop: 4 }}>
                Hạn cũ: <strong>{date(r.ngay_kt_hien_tai)}</strong> → Xin gia hạn đến:{" "}
                <strong style={{ color: "var(--status-success-text)", fontSize: 13 }}>{date(r.ngay_gia_han_den)}</strong>
                {"    "}
                Giá mới: <strong>{money(r.gia_thue_moi || r.gia_thue_hien_tai)}/tháng</strong>
              </div>

              {r.noi_dung_dieu_chinh && (
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>
                  &ldquo;{r.noi_dung_dieu_chinh}&rdquo;
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {rejectingId === r.ma_phu_luc ? (
                <form action={rejectAction} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="hidden" name="maPhuLuc" value={r.ma_phu_luc} />
                  <input type="hidden" name="maHopDong" value={r.ma_hop_dong} />
                  <input
                    type="text"
                    name="lyDo"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Lý do từ chối..."
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      width: 180,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={rejectPending}
                    style={{
                      background: "var(--status-danger-text)",
                      color: "var(--bg-surface)",
                      border: "none",
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {rejectPending ? <Loader2 size={13} className="animate-spin" /> : "Xác nhận từ chối"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingId(null)}
                    style={{
                      background: "var(--border)",
                      color: "var(--text-muted)",
                      border: "none",
                      padding: "5px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Hủy
                  </button>
                </form>
              ) : (
                <>
                  <form action={approveAction}>
                    <input type="hidden" name="maPhuLuc" value={r.ma_phu_luc} />
                    <input type="hidden" name="maHopDong" value={r.ma_hop_dong} />
                    <button
                      type="submit"
                      disabled={approvePending}
                      style={{
                        background: "var(--status-success-text)",
                        color: "var(--bg-surface)",
                        border: "none",
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {approvePending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={14} /> Duyệt gia hạn
                        </>
                      )}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(r.ma_phu_luc);
                      setRejectReason("");
                    }}
                    style={{
                      background: "var(--status-danger-bg)",
                      color: "var(--status-danger-text)",
                      border: "1px solid var(--status-danger-border)",
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <XCircle size={13} /> Từ chối
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

