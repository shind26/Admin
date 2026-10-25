"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  Building,
  User,
  Phone,
  Calendar,
  Clock,
  FileText,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
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
        marginBottom: 24,
        background: "#ffffff",
        borderRadius: 14,
        border: "1px solid #DCEFF8",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(74, 144, 194, 0.08)",
      }}
    >
      {/* Header section with light sky blue theme */}
      <div
        style={{
          background: "#EFF8FC",
          borderBottom: "1px solid #DCEFF8",
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
              background: "#4A90C2",
              color: "#ffffff",
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowRightLeft size={18} />
          </div>
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#4A90C2",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Yêu cầu đổi / chuyển phòng từ Mobile App
              <span
                style={{
                  background: "#F6E6B4",
                  color: "#92400E",
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid #FDE68A",
                }}
              >
                {requests.length} yêu cầu chờ duyệt
              </span>
            </h2>
            <p style={{ fontSize: 12, color: "#425B6B", margin: "2px 0 0" }}>
              Cư dân đề xuất đổi sang phòng mới. BQL cần kiểm tra phòng trống, lập Phụ lục hợp đồng và bảo lưu tiền cọc.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Pending Requests */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 16,
          padding: 16,
        }}
      >
        {requests.map((req) => (
          <div
            key={req.ma_yeu_cau}
            style={{
              background: "#ffffff",
              border: "1px solid #DCEFF8",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 12,
              transition: "all 0.2s ease",
            }}
          >
            <div>
              {/* Room transition banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#EFF8FC",
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Phòng cũ</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>
                    {req.ten_phong_cu || req.ma_phong_cu}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#425B6B" }}>{money(req.gia_phong_cu)}/th</div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    color: "#4A90C2",
                  }}
                >
                  <ArrowRightLeft size={18} />
                  <span style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>CHUYỂN SANG</span>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#059669" }}>Phòng mới</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>
                    {req.ten_phong_moi || req.ma_phong_moi}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#059669" }}>{money(req.gia_phong_moi)}/th</div>
                </div>
              </div>

              {/* Building & Tenant */}
              <div style={{ fontSize: 12, color: "#425B6B", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                <Building size={13} /> {req.toa_nha || "Nhà trọ"} • HĐ:{" "}
                <Link
                  href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                  style={{ color: "#4A90C2", fontWeight: 700, textDecoration: "underline" }}
                >
                  {req.ma_hop_dong}
                </Link>
              </div>

              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  color: "#425B6B",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#0F172A" }}>
                  <User size={14} color="#4A90C2" /> {req.ten_khach || "Chưa có tên"}
                  {req.so_dt && (
                    <span style={{ fontWeight: 500, color: "#64748B", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Phone size={12} /> {req.so_dt}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={14} color="#4A90C2" />
                  <span>
                    Hẹn ngày dọn: <strong style={{ color: "#0F172A" }}>{date(req.thoi_gian_hen)}</strong>
                  </span>
                </div>
              </div>

              {/* Cọc & Chênh lệch */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ background: "#F1F4F8", padding: "6px 10px", borderRadius: 6 }}>
                  <div style={{ color: "#64748B", fontSize: 11 }}>Cọc bảo lưu</div>
                  <div style={{ fontWeight: 700, color: "#0F172A" }}>{money(req.tien_coc_bao_luu)}</div>
                </div>
                <div
                  style={{
                    background: req.unpaid_total > 0 ? "#FDE8E8" : "#F1F4F8",
                    padding: "6px 10px",
                    borderRadius: 6,
                  }}
                >
                  <div style={{ color: req.unpaid_total > 0 ? "#991B1B" : "#64748B", fontSize: 11 }}>
                    Nợ hóa đơn cũ
                  </div>
                  <div style={{ fontWeight: 700, color: req.unpaid_total > 0 ? "#DC2626" : "#059669" }}>
                    {money(req.unpaid_total)}
                  </div>
                </div>
              </div>

              {/* Reason note */}
              {req.ly_do_chuyen && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#425B6B",
                    fontStyle: "italic",
                    background: "#F8FAFC",
                    padding: "6px 10px",
                    borderRadius: 6,
                    borderLeft: "3px solid #76B5D8",
                  }}
                >
                  &ldquo;{req.ly_do_chuyen}&rdquo;
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                gap: 8,
                borderTop: "1px solid #F1F4F8",
                paddingTop: 12,
              }}
            >
              <Link
                href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  color: "#425B6B",
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "none",
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <FileText size={14} /> Chi tiết HĐ
              </Link>

              <RoomTransferDialog
                maHopDong={req.ma_hop_dong}
                maPhongCu={req.ma_phong_cu}
                tenPhongCu={req.ten_phong_cu || req.ma_phong_cu}
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
                triggerButtonVariant="warning"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

