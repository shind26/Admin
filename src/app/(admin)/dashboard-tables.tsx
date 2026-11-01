import Link from "next/link";
import { AlertTriangle, CheckCircle2, ArrowRight, CreditCard, ReceiptText } from "lucide-react";
import type { FinancialDashboardData } from "@/lib/queries";
import styles from "./dashboard.module.css";

function formatMoney(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0\u00A0đ";
  return `${Number(num).toLocaleString("vi-VN")}\u00A0đ`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

export function UnpaidInvoicesTable({
  invoices,
}: {
  invoices: FinancialDashboardData["unpaidInvoices"];
}) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeadRow}>
        <div className={styles.tableTitleGroup}>
          <div className={styles.iconBadgeWarn}>
            <AlertTriangle size={17} />
          </div>
          <div>
            <h3 className={styles.tableTitle}>Hóa đơn chưa thanh toán</h3>
          </div>
        </div>
        <Link href="/hoa-don?status=ChuaThanhToan" className={styles.viewAllLink}>
          Xem tất cả <ArrowRight size={13} />
        </Link>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.dashTable}>
          <thead>
            <tr>
              <th style={{ whiteSpace: "nowrap" }}>Phòng &amp; Khách</th>
              <th style={{ whiteSpace: "nowrap" }}>Mã hóa đơn</th>
              <th style={{ whiteSpace: "nowrap" }}>Tổng tiền</th>
              <th style={{ whiteSpace: "nowrap" }}>Đã thu</th>
              <th style={{ whiteSpace: "nowrap" }}>Còn nợ</th>
              <th style={{ whiteSpace: "nowrap" }}>Hạn nộp</th>
              <th style={{ whiteSpace: "nowrap" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <div className={styles.emptyBanner}>
                    <CheckCircle2 size={22} color="#16a34a" />
                    <span>Hiện tại không có hóa đơn nào nợ tiền.</span>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.ma_hoa_don}>
                  <td>
                    <div className={styles.strongText} style={{ whiteSpace: "nowrap" }}>
                      Phòng {inv.ma_phong || "—"}{" "}
                      {inv.toa_nha ? `(${inv.toa_nha})` : ""}
                    </div>
                    <div className={styles.mutedText}>{inv.ten_khach || "—"}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={styles.invoiceBadge}>#{inv.ma_hoa_don}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                    {formatMoney(inv.tong_tien)}
                  </td>
                  <td style={{ color: "#166534", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {formatMoney(inv.da_thu)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={styles.debtHighlight}>
                      {formatMoney(inv.con_lai)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={styles.dateCell}>{formatDate(inv.han_dong_tien)}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className={styles.actionRow} style={{ flexWrap: "nowrap" }}>
                      <Link
                        href={`/phieu-thu?invoiceId=${inv.ma_hoa_don}`}
                        className={styles.btnQuickPay}
                        title="Tạo phiếu thu tiền"
                      >
                        <CreditCard size={12} /> Thu tiền
                      </Link>
                      <Link
                        href={`/hoa-don?keyword=${inv.ma_hoa_don}`}
                        className={styles.btnViewInv}
                        title="Xem chi tiết hóa đơn"
                      >
                        <ReceiptText size={12} /> Xem
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecentReceiptsTable({
  receipts,
}: {
  receipts: FinancialDashboardData["recentReceipts"];
}) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeadRow}>
        <div className={styles.tableTitleGroup}>
          <div className={styles.iconBadgeOk}>
            <CheckCircle2 size={17} />
          </div>
          <div>
            <h3 className={styles.tableTitle}>Phiếu thu gần đây</h3>
          </div>
        </div>
        <Link href="/phieu-thu" className={styles.viewAllLink}>
          Xem tất cả <ArrowRight size={13} />
        </Link>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.dashTable}>
          <thead>
            <tr>
              <th style={{ whiteSpace: "nowrap" }}>Mã phiếu</th>
              <th style={{ whiteSpace: "nowrap" }}>Phòng</th>
              <th style={{ whiteSpace: "nowrap" }}>Người nộp</th>
              <th style={{ whiteSpace: "nowrap" }}>Số tiền</th>
              <th style={{ whiteSpace: "nowrap" }}>Hình thức</th>
              <th style={{ whiteSpace: "nowrap" }}>Ngày thu</th>
              <th style={{ whiteSpace: "nowrap" }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  Chưa có phiếu thu nào gần đây.
                </td>
              </tr>
            ) : (
              receipts.map((rc) => (
                <tr key={rc.ma_phieu_thu}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <strong style={{ color: "#1877f2" }}>#{rc.ma_phieu_thu}</strong>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className={styles.strongText}>
                      Phòng {rc.ma_phong || "—"}{" "}
                      {rc.toa_nha ? `(${rc.toa_nha})` : ""}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{rc.ten_khach || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={styles.collectedHighlight}>
                      {formatMoney(rc.so_tien_thu)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={styles.methodBadge}>{rc.hinh_thuc || "Tiền mặt"}</span>
                  </td>
                  <td className={styles.dateCell} style={{ whiteSpace: "nowrap" }}>
                    {formatDate(rc.ngay_thu)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span
                      className={
                        rc.trang_thai === "Đã xác nhận" || rc.trang_thai === "Đã khớp lệnh"
                          ? styles.statusOk
                          : styles.statusWarn
                      }
                    >
                      {rc.trang_thai}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
