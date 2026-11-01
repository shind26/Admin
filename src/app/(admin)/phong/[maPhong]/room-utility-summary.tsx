import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { RoomUtilitySummary } from "@/lib/queries";
import styles from "./room-utility-summary.module.css";

function formatMoney(value: string | number | null | undefined): string {
  if (!value || Number(value) === 0) return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function isOverdue(hanDongTien: string | null | undefined): boolean {
  if (!hanDongTien) return false;
  return new Date(hanDongTien).getTime() < Date.now();
}

export function RoomUtilitySummaryCard({
  maPhong,
  summary,
}: {
  maPhong: string;
  summary: RoomUtilitySummary;
}) {
  const { meters, latestInvoice, totalDebt, unpaidInvoiceCount } = summary;
  const debtNum = Number(totalDebt || 0);

  return (
    <div className={styles.container}>
      <div className={styles.cardsGrid}>
        {/* ── Cột 1: Chỉ số Điện & Nước chốt gần nhất ── */}
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
                          <span className={`${styles.usagePill} ${styles.usageElectric}`}>
                            +{Number(m.dien_tieu_thu || 0)} kWh
                          </span>
                        </td>
                        <td>
                          <span className={styles.meterVal}>
                            {Number(m.chi_so_nuoc_cu || 0)} → {Number(m.chi_so_nuoc_moi || 0)}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.usagePill} ${styles.usageWater}`}>
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
            <span style={{ fontSize: 12, color: "#65676b" }}>
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

        {/* ── Cột 2: Hóa đơn & Công nợ ── */}
        <div className={styles.panel}>
          <div>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Hóa đơn &amp; Công nợ</h3>
              {debtNum > 0 ? (
                <span className={`${styles.badge} ${styles.badgeDanger}`}>
                  Còn nợ {unpaidInvoiceCount} hóa đơn
                </span>
              ) : latestInvoice ? (
                <span className={`${styles.badge} ${styles.badgeOk}`}>
                  Đã thanh toán đủ
                </span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeMuted}`}>
                  Chưa có hóa đơn
                </span>
              )}
            </div>

            {/* Thông báo công nợ */}
            {debtNum > 0 ? (
              <div className={`${styles.debtAlertBox} ${styles.debtAlertRed}`}>
                <div className={styles.debtAmountRow}>
                  <span className={styles.debtAmountLabel}>Tổng tiền nợ cần thu:</span>
                  <span className={`${styles.debtAmountValue} ${styles.debtAmountValueRed}`}>
                    {formatMoney(debtNum)}
                  </span>
                </div>
                {latestInvoice?.han_dong_tien && (
                  <div className={styles.debtMetaText}>
                    {isOverdue(latestInvoice.han_dong_tien) ? (
                      <strong>Quá hạn đóng tiền: {formatDate(latestInvoice.han_dong_tien)}</strong>
                    ) : (
                      <span>Hạn đóng: {formatDate(latestInvoice.han_dong_tien)}</span>
                    )}
                  </div>
                )}
              </div>
            ) : latestInvoice ? (
              <div className={`${styles.debtAlertBox} ${styles.debtAlertGreen}`}>
                <div className={styles.debtAmountRow}>
                  <span className={styles.debtAmountLabel}>Công nợ hiện tại:</span>
                  <span className={`${styles.debtAmountValue} ${styles.debtAmountValueGreen}`}>
                    0 đ
                  </span>
                </div>
                <div className={styles.debtMetaText}>Đã hoàn tất thanh toán tiền phòng</div>
              </div>
            ) : (
              <div className={`${styles.debtAlertBox} ${styles.debtAlertGray}`}>
                <span>Chưa có hóa đơn phát sinh nào cho phòng này.</span>
              </div>
            )}

            {/* Chi tiết kỳ hóa đơn gần nhất */}
            {latestInvoice && (
              <div className={styles.invoiceGrid}>
                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Kỳ hóa đơn</span>
                  <span className={styles.invoiceFieldValue}>
                    {latestInvoice.ky_thang_nam
                      ? `Tháng ${latestInvoice.ky_thang_nam}`
                      : formatDate(latestInvoice.ngay_lap)}
                  </span>
                </div>

                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Mã hóa đơn</span>
                  <span className={styles.invoiceFieldValue}>
                    #{latestInvoice.ma_hoa_don}
                  </span>
                </div>

                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Tiền phòng</span>
                  <span className={styles.invoiceFieldValue}>
                    {formatMoney(latestInvoice.tien_phong)}
                  </span>
                </div>

                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Tiền điện nước</span>
                  <span className={styles.invoiceFieldValue}>
                    {formatMoney(latestInvoice.tien_dien_nuoc)}
                  </span>
                </div>

                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Tổng kỳ này</span>
                  <span className={styles.invoiceFieldValue} style={{ fontWeight: 700 }}>
                    {formatMoney(latestInvoice.tong_tien)}
                  </span>
                </div>

                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Còn lại phải thu</span>
                  <span
                    className={styles.invoiceFieldValue}
                    style={{
                      color: Number(latestInvoice.con_no) > 0 ? "#e41e3f" : "#1f7a37",
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(latestInvoice.con_no)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <footer className={styles.panelFooter}>
            <span style={{ fontSize: 12, color: "#65676b" }}>
              {latestInvoice ? `Hợp đồng: #${latestInvoice.ma_hop_dong || "—"}` : "Hóa đơn phòng"}
            </span>
            <Link
              href={`/hoa-don?keyword=${encodeURIComponent(maPhong)}`}
              className={styles.linkAction}
            >
              Xem danh sách hóa đơn
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
