import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getActiveContracts, getInvoices } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import {
  DeleteInvoiceButton,
  InvoiceEditorToggle,
  InvoiceForm,
} from "./invoice-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; keyword?: string }>;

const STATUS_OPTIONS = [
  "All",
  "Chưa thanh toán",
  "Thanh toán một phần",
  "Đã thanh toán",
];

function formatMoney(value: string | null) {
  if (value === null) return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusClass(status: string | null) {
  if (status === "Đã thanh toán") return styles.badgeOk;
  if (status === "Thanh toán một phần") return styles.badgeInfo;
  return styles.badgeWarn;
}

async function InvoicesContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  const status = params.status || "All";
  const keyword = params.keyword || "";

  const [invoices, contracts] = await Promise.all([
    getInvoices({ status, keyword }, scopeQuery),
    getActiveContracts(scopeQuery),
  ]);

  const total = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.tong_tien ?? 0),
    0,
  );
  const collected = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.da_thu ?? 0),
    0,
  );
  const outstanding = invoices.filter(
    (invoice) => Number(invoice.tong_tien ?? 0) > Number(invoice.da_thu ?? 0),
  ).length;

  return (
    <AdminShell active="invoice">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Hóa đơn &amp; Thu chi</h1>
          <p className={styles.subtitle}>
            Trạng thái thanh toán tự tính theo phiếu thu đã xác nhận
          </p>
        </div>
        <div className={styles.navTabs}>
          <Link href="/hop-dong" className={styles.navTab}>
            Hợp đồng
          </Link>
          <Link href="/hoa-don" className={styles.navTabActive}>
            Hóa đơn
          </Link>
          <Link href="/phieu-thu" className={styles.navTab}>
            Phiếu thu
          </Link>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Số hóa đơn hiển thị</div>
          <div className={styles.miniValue}>{invoices.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng phải thu</div>
          <div className={styles.miniValue}>{formatMoney(String(total))}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Còn nợ ({outstanding} hóa đơn)</div>
          <div className={styles.miniValue}>
            {formatMoney(String(total - collected))}
          </div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Tạo hóa đơn</summary>
        <InvoiceForm mode="create" contracts={contracts} />
      </details>

      <form className={styles.filterCard} action="/hoa-don">
        <div className={styles.filterField}>
          <label htmlFor="keyword">
            Tìm theo mã hóa đơn, hợp đồng hoặc tên khách
          </label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="HD..., HĐ..., Nguyễn Văn A"
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="status">Trạng thái</label>
          <select id="status" name="status" defaultValue={status}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "All" ? "Tất cả" : option}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Lọc
          </button>
          <Link href="/hoa-don" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã hóa đơn</th>
                <th>Phòng / Khách</th>
                <th>Tổng tiền</th>
                <th>Đã thu</th>
                <th>Ngày lập</th>
                <th>Hạn đóng</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    Không có hóa đơn phù hợp.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.ma_hoa_don}>
                    <td>
                      <div className={styles.strong}>{invoice.ma_hoa_don}</div>
                      <div className={styles.muted}>{invoice.ma_hop_dong}</div>
                    </td>
                    <td>
                      <div>{invoice.ma_phong}</div>
                      <div className={styles.muted}>{invoice.ten_khach}</div>
                    </td>
                    <td className={styles.strong}>
                      {formatMoney(invoice.tong_tien)}
                    </td>
                    <td>{formatMoney(invoice.da_thu)}</td>
                    <td>{formatDate(invoice.ngay_lap)}</td>
                    <td>{formatDate(invoice.han_dong_tien)}</td>
                    <td>
                      <span className={statusClass(invoice.trang_thai)}>
                        {invoice.trang_thai}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <InvoiceEditorToggle
                          invoice={invoice}
                          contracts={contracts}
                        />
                        <DeleteInvoiceButton maHoaDon={invoice.ma_hoa_don} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

export default function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <InvoicesContent searchParams={searchParams} />
    </Suspense>
  );
}
