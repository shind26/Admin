import Link from "next/link";
import { AlertTriangle, CheckCircle2, ArrowRight, CreditCard, ReceiptText } from "lucide-react";
import type { FinancialDashboardData } from "@/lib/queries";
import styles from "./dashboard.module.css";

function formatMoney(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
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
            <h3 className={styles.tableTitle}>Phòng còn nợ tiền ({invoices.length})</h3>
            <p className={styles.tableSub}>Danh sách hóa đơn chưa thanh toán cần đôn đốc</p>
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
              <th>Phòng &amp; Khách</th>
              <th>Hóa đơn</th>
              <th>Tổng tiền</th>
              <th>Đã thu</th>
              <th>Còn nợ</th>
              <th>Hạn nộp</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <div className={styles.emptyBanner}>
                    <CheckCircle2 size={24} color="#10b981" />
                    <span>Tuyệt vời! Không có phòng nào bị nợ tiền hóa đơn.</span>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.ma_hoa_don}>
                  <td>
                    <div className={styles.strongText}>
                      Phòng {inv.ma_phong || "—"}{" "}
                      {inv.toa_nha ? `(${inv.toa_nha})` : ""}
                    </div>
                    <div className={styles.mutedText}>{inv.ten_khach || "—"}</div>
                  </td>
                  <td>
                    <span className={styles.invoiceBadge}>{inv.ma_hoa_don}</span>
                  </td>
                  <td>{formatMoney(inv.tong_tien)}</td>
                  <td style={{ color: "#059669", fontWeight: 600 }}>
                    {formatMoney(inv.da_thu)}
                  </td>
                  <td>
                    <span className={styles.debtHighlight}>
                      {formatMoney(inv.con_lai)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.dateCell}>{formatDate(inv.han_dong_tien)}</span>
                  </td>
                  <td>
                    <div className={styles.actionRow}>
                      <Link
                        href={`/phieu-thu?invoiceId=${inv.ma_hoa_don}`}
                        className={styles.btnQuickPay}
                        title="Tạo phiếu thu tiền ngay"
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
            <h3 className={styles.tableTitle}>Giao dịch thu tiền gần đây</h3>
            <p className={styles.tableSub}>Các khoản thanh toán vừa được ghi nhận</p>
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
              <th>Mã phiếu</th>
              <th>Phòng</th>
              <th>Khách nộp</th>
              <th>Số tiền thu</th>
              <th>Hình thức</th>
              <th>Ngày thu</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  Chưa có giao dịch thu tiền nào được ghi nhận.
                </td>
              </tr>
            ) : (
              receipts.map((rc) => (
                <tr key={rc.ma_phieu_thu}>
                  <td>
                    <strong style={{ color: "#0369a1" }}>{rc.ma_phieu_thu}</strong>
                  </td>
                  <td>
                    <div className={styles.strongText}>
                      Phòng {rc.ma_phong || "—"}{" "}
                      {rc.toa_nha ? `(${rc.toa_nha})` : ""}
                    </div>
                  </td>
                  <td>{rc.ten_khach || "—"}</td>
                  <td>
                    <span className={styles.collectedHighlight}>
                      {formatMoney(rc.so_tien_thu)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.methodBadge}>{rc.hinh_thuc || "—"}</span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(rc.ngay_thu)}</td>
                  <td>
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

