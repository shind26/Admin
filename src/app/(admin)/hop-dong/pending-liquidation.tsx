"use client";

import Link from "next/link";
import { Clock, FileText } from "lucide-react";
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
            <Clock size={15} />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Yêu cầu trả phòng & Thanh lý hợp đồng
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
        {requests.map((req, idx) => {
          const isDungHan = req.hinh_thuc === "Đúng hạn";
          return (
            <div
              key={req.ma_thanh_ly}
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
              {/* Cột 1: Thông tin cư dân, phòng và ngày dọn */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 300 }}>
                {/* Dòng 1: Tên khách + SĐT + Phòng + HĐ */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                  <strong style={{ color: "#0f172a", fontSize: 14 }}>
                    {req.ten_khach || "Cư dân"}
                  </strong>
                  {req.so_dt && (
                    <span style={{ color: "#64748b" }}>• {req.so_dt}</span>
                  )}
                  <span style={{ color: "#0f172a", fontWeight: 600 }}>
                    • Phòng {req.ten_phong || req.ma_phong} ({req.toa_nha || "Nhà trọ"})
                  </span>
                  <span style={{ color: "#64748b" }}>
                    • HĐ:{" "}
                    <Link
                      href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                      style={{ color: "#1877f2", fontWeight: 600, textDecoration: "underline" }}
                    >
                      {req.ma_hop_dong}
                    </Link>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: isDungHan ? "#f0fdf4" : "#fffbeb",
                      color: isDungHan ? "#166534" : "#92400e",
                      border: `1px solid ${isDungHan ? "#bbf7d0" : "#fef3c7"}`,
                    }}
                  >
                    {req.hinh_thuc}
                  </span>
                </div>

                {/* Dòng 2: Ngày trả phòng & Tiền cọc & Nợ */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#475569", flexWrap: "wrap" }}>
                  <span>
                    Dự kiến dọn đi: <strong style={{ color: "#0f172a" }}>{date(req.ngay_tra_phong)}</strong>
                  </span>
                  <span style={{ color: "#64748b" }}>
                    • Hạn HĐ: {date(req.ngay_kt_hop_dong)}
                  </span>
                  <span>
                    • Tiền cọc: <strong style={{ color: "#0f172a" }}>{money(req.tien_dat_coc)}</strong>
                  </span>
                  {req.unpaid_total > 0 ? (
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>
                      • Còn nợ: {money(req.unpaid_total)}
                    </span>
                  ) : (
                    <span style={{ color: "#16a34a" }}>• Nợ cũ: 0 đ</span>
                  )}
                </div>

                {/* Dòng 3: Ghi chú nếu có */}
                {req.ghi_chu && (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Ghi chú: <span style={{ color: "#334155" }}>&ldquo;{req.ghi_chu}&rdquo;</span>
                  </div>
                )}
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
                  triggerButtonVariant="warning"
                  triggerButtonText="Nghiệm thu & Thanh lý"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
