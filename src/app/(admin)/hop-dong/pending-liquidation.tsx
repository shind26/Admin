"use client";

import Link from "next/link";
import {
  Clock,
  Building,
  User,
  Phone,
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
  Receipt,
  FileCheck,
} from "lucide-react";
import type { PendingLiquidationRequest } from "@/lib/queries";
import { LiquidationDialog } from "./[maHopDong]/liquidation-dialog";

function money(num: number | string | null | undefined) {
  if (!num) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
}

function date(str: string | null | undefined) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("vi-VN");
}

export function PendingLiquidationQueue({
  requests,
}: {
  requests: PendingLiquidationRequest[];
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
            <Clock size={18} />
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
              Yêu cầu trả phòng / Thanh lý hợp đồng từ Mobile
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
              Cư dân đã gửi đơn check-out qua app. BQL cần nghiệm thu tài sản, chốt điện nước và quyết toán hợp đồng.
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
        {requests.map((req) => {
          const isDungHan = req.hinh_thuc === "Đúng hạn";
          return (
            <div
              key={req.ma_thanh_ly}
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
                {/* Top Info */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                      Phòng {req.ten_phong || req.ma_phong}
                    </div>
                    <div style={{ fontSize: 12, color: "#425B6B", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Building size={13} /> {req.toa_nha || "Nhà trọ"} • HĐ:{" "}
                      <Link
                        href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                        style={{ color: "#4A90C2", fontWeight: 700, textDecoration: "underline" }}
                      >
                        {req.ma_hop_dong}
                      </Link>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: isDungHan ? "#E6F4EA" : "#F6E6B4",
                      color: isDungHan ? "#166534" : "#92400E",
                      border: `1px solid ${isDungHan ? "#BBF7D0" : "#FDE68A"}`,
                    }}
                  >
                    {req.hinh_thuc}
                  </span>
                </div>

                {/* Tenant and Dates */}
                <div
                  style={{
                    background: "#EFF8FC",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
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
                      Dự kiến dọn đi: <strong style={{ color: "#0F172A" }}>{date(req.ngay_tra_phong)}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>
                    Hạn hợp đồng: {date(req.ngay_kt_hop_dong)} ({req.so_ngay_con_lai} ngày nữa)
                  </div>
                </div>

                {/* Money & Debts */}
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
                    <div style={{ color: "#64748B", fontSize: 11 }}>Tiền cọc ban đầu</div>
                    <div style={{ fontWeight: 700, color: "#0F172A" }}>{money(req.tien_dat_coc)}</div>
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

                {/* Tenant note */}
                {req.ghi_chu && (
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
                    &ldquo;{req.ghi_chu}&rdquo;
                  </div>
                )}
              </div>

              {/* Action Buttons */}
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

                <LiquidationDialog
                  maHopDong={req.ma_hop_dong}
                  maPhong={req.ten_phong || req.ma_phong}
                  tenKhach={req.ten_khach || "Cư dân"}
                  tienDatCoc={Number(req.tien_dat_coc) || 0}
                  chiSoDienCu={req.chi_so_dien_gan_nhat || 0}
                  chiSoNuocCu={req.chi_so_nuoc_gan_nhat || 0}
                  unpaidTotal={req.unpaid_total}
                  ngayKtHopDong={req.ngay_kt_hop_dong}
                  maThanhLy={req.ma_thanh_ly}
                  ngayTraPhongDuKien={req.ngay_tra_phong}
                  ghiChuYeuCau={req.ghi_chu}
                  isPendingRequest={true}
                  triggerButtonText="Nghiệm thu & Duyệt"
                  triggerButtonVariant="warning"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

