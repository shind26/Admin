import Link from "next/link";

import type { RoomUtilitySummary } from "@/lib/queries";
import styles from "./room-utility-summary.module.css";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

export function RoomUtilitySummaryCard({
  maPhong,
  summary,
}: {
  maPhong: string;
  summary: RoomUtilitySummary;
}) {
  const { meters } = summary;

  return (
    <div className={styles.container}>
      <div className={styles.cardsGrid}>
        {/* ── Bảng Chỉ số Điện & Nước chốt gần nhất ── */}
        <div className={styles.panel}>
          <div>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Chỉ số chốt điện nước</h3>
              <Link
                href={`/dien-nuoc?keyword=${encodeURIComponent(maPhong)}`}
                className={styles.linkAction}
              >
                + Ghi chỉ số mới
              </Link>
            </div>

            {meters.length === 0 ? (
              <div className={styles.emptyBox}>
                <span>Phòng chưa có dữ liệu chốt số điện nước.</span>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Kỳ ghi</th>
                      <th>Điện (Cũ → Mới)</th>
                      <th>Tiêu thụ</th>
                      <th>Nước (Cũ → Mới)</th>
                      <th>Tiêu thụ</th>
                      <th style={{ textAlign: "right" }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meters.map((m) => (
                      <tr key={m.ma_ky}>
                        <td>
                          <span className={styles.cycleTag}>{m.thang_nam || "Kỳ mới"}</span>
                        </td>
                        <td>
                          <span className={styles.meterVal}>
                            {Number(m.chi_so_dien_cu || 0)} → {Number(m.chi_so_dien_moi || 0)}
                          </span>
                        </td>
                        <td>
                          <span className={styles.usageVal}>
                            +{Number(m.dien_tieu_thu || 0)} kWh
                          </span>
                        </td>
                        <td>
                          <span className={styles.meterVal}>
                            {Number(m.chi_so_nuoc_cu || 0)} → {Number(m.chi_so_nuoc_moi || 0)}
                          </span>
                        </td>
                        <td>
                          <span className={styles.usageVal}>
                            +{Number(m.nuoc_tieu_thu || 0)} m³
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className={`${styles.badge} ${
                              m.trang_thai_duyet === "Đã duyệt"
                                ? styles.badgeOk
                                : styles.badgeWarn
                            }`}
                          >
                            {m.trang_thai_duyet || "Chờ duyệt"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <footer className={styles.panelFooter}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {meters[0]?.ngay_ghi_nhan
                ? `Chốt gần nhất: ${formatDate(meters[0].ngay_ghi_nhan)}`
                : "Chỉ số hàng tháng"}
            </span>
            <Link
              href={`/dien-nuoc?keyword=${encodeURIComponent(maPhong)}`}
              className={styles.linkAction}
            >
              Lịch sử điện nước
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
