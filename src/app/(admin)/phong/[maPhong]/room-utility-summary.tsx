import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  ExternalLink,
  FileText,
  Receipt,
  Zap,
} from "lucide-react";
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
    <section className={styles.container}>
      {/* ── Tiêu đề khối ── */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>
            <Zap size={16} /> Điện nước &amp; Hóa đơn gần nhất
          </h2>
          <p className={styles.subTitle}>
            Xem nhanh 3 kỳ chỉ số điện nước vừa qua và tình trạng công nợ hóa đơn của phòng{" "}
            <strong>{maPhong}</strong>.
          </p>
        </div>
      </div>

      <div className={styles.cardsGrid}>
        {/* ── Thẻ 1: Tình trạng Hóa đơn & Công nợ ── */}
        <div className={styles.panel}>
          <div>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>
                <Receipt size={16} color="#4f46e5" /> Tình trạng Hóa đơn &amp; Công nợ
              </h3>
              {debtNum > 0 ? (
                <span className={`${styles.badge} ${styles.badgeDanger}`}>
                  Còn nợ {unpaidInvoiceCount} hóa đơn
                </span>
              ) : latestInvoice ? (
                <span className={`${styles.badge} ${styles.badgeOk}`}>
                  <CheckCircle2 size={11} /> Đã thanh toán đủ
                </span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeMuted}`}>Chưa có hóa đơn</span>
              )}
            </div>

            {/* Banner tổng kết công nợ */}
            {debtNum > 0 ? (
              <div className={`${styles.debtAlertBox} ${styles.debtAlertRed}`}>
                <div className={styles.debtAmountRow}>
                  <span className={styles.debtAmountLabel}>Tổng tiền nợ tồn đọng</span>
                  <span className={`${styles.debtAmountValue} ${styles.debtAmountValueRed}`}>
                    {formatMoney(debtNum)}
                  </span>
                </div>
                <div className={styles.debtMetaText}>
                  <AlertCircle size={12} />
                  {latestInvoice?.han_dong_tien ? (
                    isOverdue(latestInvoice.han_dong_tien) ? (
                      <strong>Đã quá hạn thanh toán ({formatDate(latestInvoice.han_dong_tien)})</strong>
                    ) : (
                      <span>Hạn đóng: {formatDate(latestInvoice.han_dong_tien)}</span>
                    )
                  ) : (
                    <span>Phòng có hóa đơn chưa thu</span>
                  )}
                </div>
              </div>
            ) : latestInvoice ? (
              <div className={`${styles.debtAlertBox} ${styles.debtAlertGreen}`}>
                <div className={styles.debtAmountRow}>
                  <span className={styles.debtAmountLabel}>Công nợ phòng</span>
                  <span className={`${styles.debtAmountValue} ${styles.debtAmountValueGreen}`}>
                    0 đ
                  </span>
                </div>
                <div className={styles.debtMetaText}>
                  <CheckCircle2 size={12} /> Khách đã hoàn tất 100% nghĩa vụ thanh toán
                </div>
              </div>
            ) : (
              <div className={`${styles.debtAlertBox} ${styles.debtAlertGray}`}>
                <span style={{ fontSize: 12 }}>Chưa có hóa đơn phát sinh nào cho phòng này.</span>
              </div>
            )}

            {/* Chi tiết kỳ hóa đơn gần nhất */}
            {latestInvoice && (
              <div className={styles.invoiceGrid}>
                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Kỳ hóa đơn</span>
                  <span className={styles.invoiceFieldValue}>
                    {latestInvoice.ky_thang_nam ? `Tháng ${latestInvoice.ky_thang_nam}` : formatDate(latestInvoice.ngay_lap)}
                  </span>
                </div>

                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Mã hóa đơn</span>
                  <span className={styles.invoiceFieldValue} style={{ fontFamily: "monospace" }}>
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
                  <span className={styles.invoiceFieldValue} style={{ color: "#4338ca", fontWeight: 700 }}>
                    {formatMoney(latestInvoice.tong_tien)}
                  </span>
                </div>

                <div className={styles.invoiceField}>
                  <span className={styles.invoiceFieldLabel}>Còn lại phải thu</span>
                  <span
                    className={styles.invoiceFieldValue}
                    style={{
                      color: Number(latestInvoice.con_no) > 0 ? "#be123c" : "#15803d",
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
            <span style={{ fontSize: 11.5, color: "#64748b" }}>
              {latestInvoice ? `HĐ: #${latestInvoice.ma_hop_dong || "—"}` : "Quản lý hóa đơn"}
            </span>
            <Link
              href={`/hoa-don?keyword=${encodeURIComponent(maPhong)}`}
              className={styles.linkAction}
            >
              Xem danh sách hóa đơn <ExternalLink size={12} />
            </Link>
          </footer>
        </div>

        {/* ── Thẻ 2: 3 kỳ chỉ số Điện & Nước gần nhất ── */}
        <div className={styles.panel}>
          <div>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>
                <Droplets size={16} color="#0284c7" /> 3 kỳ Điện &amp; Nước gần nhất
              </h3>
              <Link
                href={`/dien-nuoc?keyword=${encodeURIComponent(maPhong)}`}
                className={styles.linkAction}
                style={{ fontSize: 11 }}
              >
                Ghi mới / Xem tất cả →
              </Link>
            </div>

            {meters.length === 0 ? (
              <div className={styles.emptyBox}>
                <Clock size={24} style={{ opacity: 0.4 }} />
                <span>Phòng chưa có dữ liệu ghi chỉ số điện nước nào.</span>
                <Link
                  href={`/dien-nuoc?keyword=${encodeURIComponent(maPhong)}`}
                  style={{
                    fontSize: 11.5,
                    color: "#4338ca",
                    fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  + Nhập chỉ số kỳ mới cho phòng
                </Link>
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
                      <th style={{ textAlign: "right" }}>Duyệt</th>
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
                            <Zap size={10} /> +{Number(m.dien_tieu_thu || 0)} kWh
                          </span>
                        </td>
                        <td>
                          <span className={styles.meterVal}>
                            {Number(m.chi_so_nuoc_cu || 0)} → {Number(m.chi_so_nuoc_moi || 0)}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.usagePill} ${styles.usageWater}`}>
                            <Droplets size={10} /> +{Number(m.nuoc_tieu_thu || 0)} m³
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className={`${styles.badge} ${
                              m.trang_thai_duyet === "Đã duyệt" ? styles.badgeOk : styles.badgeWarn
                            }`}
                            style={{ fontSize: 10, padding: "1px 5px" }}
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
            <span style={{ fontSize: 11.5, color: "#64748b" }}>
              {meters[0]?.ngay_ghi_nhan
                ? `Chốt gần nhất: ${formatDate(meters[0].ngay_ghi_nhan)}`
                : "Chỉ số chốt hàng tháng"}
            </span>
            <Link
              href={`/dien-nuoc?keyword=${encodeURIComponent(maPhong)}`}
              className={styles.linkAction}
            >
              Lịch sử điện nước <ExternalLink size={12} />
            </Link>
          </footer>
        </div>
      </div>
    </section>
  );
}
