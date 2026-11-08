"use client";

import Link from "next/link";
import { ArrowRightLeft, FileText } from "lucide-react";
import type { PendingRoomTransferRequest } from "@/lib/queries";
import { RoomTransferDialog, type RoomOptionSimple } from "./room-transfer-dialog";

function money(num: number | string | null | undefined) {
  if (!num) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
}

function date(str: string | null | undefined) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("vi-VN");
}

export function PendingTransfersQueue({
  requests,
  emptyRooms,
}: {
  requests: PendingRoomTransferRequest[];
  emptyRooms: RoomOptionSimple[];
}) {
  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: 20,
        background: "var(--bg-surface)",
        borderRadius: 10,
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--bg-subtle)",
          borderBottom: "1px solid var(--border)",
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
              background: "var(--primary)",
              color: "var(--bg-surface)",
              width: 28,
              height: 28,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowRightLeft size={15} />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
            Yêu cầu đổi phòng
          </h2>
          <span
            style={{
              background: "var(--primary-subtle)",
              color: "var(--primary)",
              fontSize: 12,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid var(--primary-subtle)",
            }}
          >
            {requests.length} yêu cầu cần duyệt
          </span>
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {requests.map((req, idx) => (
          <div
            key={req.ma_yeu_cau}
            style={{
              padding: "16px 18px",
              borderTop: idx > 0 ? "1px solid var(--bg-subtle)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            {/* Cột 1: Thông tin cư dân, phòng đổi và tài chính */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 300 }}>
              {/* Dòng 1: Tên khách + HĐ + Tòa */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                <strong style={{ color: "var(--text-main)", fontSize: 14 }}>
                  {req.ten_khach || "Cư dân"}
                </strong>
                {req.so_dt && (
                  <span style={{ color: "var(--text-muted)" }}>{req.so_dt}</span>
                )}
                <span style={{ color: "var(--text-muted)" }}>
                  HĐ:{" "}
                  <Link
                    href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                    style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}
                  >
                    {req.ma_hop_dong}
                  </Link>{" "}
                  ({req.toa_nha || "Nhà trọ"})
                </span>
              </div>

              {/* Dòng 2: Lộ trình phòng */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-muted)" }}>
                  Phòng cũ: <strong>{req.ten_phong_cu || req.ma_phong_cu}</strong> ({money(req.gia_phong_cu)}/th)
                </span>
                <span style={{ color: "var(--primary)", fontWeight: 700 }}>➔</span>
                <span style={{ color: "var(--status-success-text)" }}>
                  Phòng mới: <strong>{req.ten_phong_moi || req.ma_phong_moi}</strong> ({money(req.gia_phong_moi)}/th)
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Ngày hẹn dọn: <strong>{date(req.thoi_gian_hen)}</strong>
                </span>
              </div>

              {/* Dòng 3: Lý do & Tiền cọc */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
                {req.ly_do_chuyen && (
                  <span>
                    Lý do: <span style={{ color: "var(--text-main)" }}>&ldquo;{req.ly_do_chuyen}&rdquo;</span>
                  </span>
                )}
                <span>Cọc bảo lưu: <strong style={{ color: "var(--text-main)" }}>{money(req.tien_coc_bao_luu)}</strong></span>
                {req.unpaid_total > 0 ? (
                  <span style={{ color: "var(--status-danger-text)", fontWeight: 600 }}>Còn nợ: {money(req.unpaid_total)}</span>
                ) : (
                  <span style={{ color: "var(--status-success-text)" }}>Nợ cũ: 0 đ</span>
                )}
              </div>
            </div>

            {/* Cột 2: Nút thao tác */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Link
                href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 13px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-main)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <FileText size={14} /> Chi tiết HĐ
              </Link>

              <RoomTransferDialog
                maHopDong={req.ma_hop_dong}
                maPhongCu={req.ma_phong_cu}
                tenPhongCu={req.ten_phong_cu ?? undefined}
                tenKhach={req.ten_khach || "Cư dân"}
                giaThueCu={req.gia_phong_cu}
                tienDatCocCu={req.tien_coc_bao_luu}
                emptyRooms={emptyRooms}
                maYeuCau={req.ma_yeu_cau}
                maPhongMoiDuKien={req.ma_phong_moi}
                ngayHenDuKien={req.thoi_gian_hen}
                lyDoChuyen={req.ly_do_chuyen}
                isFromMobileRequest={true}
                triggerButtonText="Nghiệm thu & Duyệt"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
