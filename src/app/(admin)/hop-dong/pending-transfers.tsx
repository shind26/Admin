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
        background: "#ffffff",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
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
              background: "#1877f2",
              color: "#ffffff",
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
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Yêu cầu đổi phòng
          </h2>
          <span
            style={{
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid #bfdbfe",
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
              borderTop: idx > 0 ? "1px solid #f1f5f9" : "none",
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
                <strong style={{ color: "#0f172a", fontSize: 14 }}>
                  {req.ten_khach || "Cư dân"}
                </strong>
                {req.so_dt && (
                  <span style={{ color: "#64748b" }}>• {req.so_dt}</span>
                )}
                <span style={{ color: "#64748b" }}>
                  • HĐ:{" "}
                  <Link
                    href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                    style={{ color: "#1877f2", fontWeight: 600, textDecoration: "underline" }}
                  >
                    {req.ma_hop_dong}
                  </Link>{" "}
                  ({req.toa_nha || "Nhà trọ"})
                </span>
              </div>

              {/* Dòng 2: Lộ trình phòng */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
                <span style={{ color: "#475569" }}>
                  Phòng cũ: <strong>{req.ten_phong_cu || req.ma_phong_cu}</strong> ({money(req.gia_phong_cu)}/th)
                </span>
                <span style={{ color: "#1877f2", fontWeight: 700 }}>➔</span>
                <span style={{ color: "#059669" }}>
                  Phòng mới: <strong>{req.ten_phong_moi || req.ma_phong_moi}</strong> ({money(req.gia_phong_moi)}/th)
                </span>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  • Ngày hẹn dọn: <strong>{date(req.thoi_gian_hen)}</strong>
                </span>
              </div>

              {/* Dòng 3: Lý do & Tiền cọc */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                {req.ly_do_chuyen && (
                  <span>
                    Lý do: <span style={{ color: "#334155" }}>&ldquo;{req.ly_do_chuyen}&rdquo;</span>
                  </span>
                )}
                <span>• Cọc bảo lưu: <strong style={{ color: "#0f172a" }}>{money(req.tien_coc_bao_luu)}</strong></span>
                {req.unpaid_total > 0 ? (
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>• Còn nợ: {money(req.unpaid_total)}</span>
                ) : (
                  <span style={{ color: "#16a34a" }}>• Nợ cũ: 0 đ</span>
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
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
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
                tenPhongCu={req.ten_phong_cu}
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
