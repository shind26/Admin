"use client";

import Link from "next/link";
import { Clock, FileText } from "lucide-react";
import type { PendingLiquidationRequest } from "@/lib/queries";
import { LiquidationDialog } from "./[maHopDong]/liquidation-dialog";
import styles from "@/components/business.module.css";

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
            <Clock size={15} />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
            Yêu cầu trả phòng & Thanh lý hợp đồng
          </h2>
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
          {requests.length} yêu cầu cần duyệt
        </span>
      </div>

      {/* Bảng danh sách yêu cầu trả phòng & thanh lý */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Khách thuê</th>
              <th>Phòng / Cơ sở</th>
              <th>Hình thức</th>
              <th>Dự kiến dọn đi</th>
              <th>Tài chính</th>
              <th>Ghi chú</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const isDungHan = req.hinh_thuc === "Đúng hạn";
              return (
                <tr key={req.ma_thanh_ly}>
                  <td>
                    <div>
                      <strong style={{ color: "var(--text-main)" }}>
                        {req.ten_khach || "Cư dân"}
                      </strong>
                      {req.so_dt && (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
                          {req.so_dt}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong style={{ color: "var(--text-main)" }}>
                        {req.ten_phong || req.ma_phong}
                      </strong>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        {req.toa_nha || "Nhà trọ"}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: isDungHan ? "var(--primary-subtle)" : "var(--status-warning-bg)",
                        color: isDungHan ? "var(--primary)" : "var(--status-warning-text)",
                        border: `1px solid ${isDungHan ? "var(--border-strong)" : "var(--status-warning-border)"}`,
                        display: "inline-block",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {req.hinh_thuc}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong style={{ color: "var(--text-main)" }}>
                        {date(req.ngay_tra_phong)}
                      </strong>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        Hạn HĐ: {date(req.ngay_kt_hop_dong)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      Cọc: <strong>{money(req.tien_dat_coc)}</strong>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      Nợ cũ: <strong>{money(req.unpaid_total)}</strong>
                    </div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    {req.ghi_chu || "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                      <Link
                        href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 11px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-surface)",
                          color: "var(--text-main)",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <FileText size={13} /> Chi tiết HĐ
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
                        triggerButtonVariant="table"
                        triggerButtonText="Nghiệm thu & Thanh lý"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
