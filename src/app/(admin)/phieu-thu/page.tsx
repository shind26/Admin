import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getInvoices, getReceipts } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import {
  DeleteReceiptButton,
  ReceiptEditorToggle,
  ReceiptForm,
} from "./receipt-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; invoiceId?: string }>;

const STATUS_OPTIONS = ["All", "Đã xác nhận", "Chờ xác nhận", "Từ chối"];

function formatMoney(value: string | null) {
  if (value === null) return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusClass(status: string | null) {
  if (status === "Đã xác nhận") return styles.badgeOk;
  if (status === "Từ chối") return styles.badgeMuted;
  return styles.badgeWarn;
}

async function ReceiptsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  const status = params.status || "All";
  const invoiceId = params.invoiceId;

  const [receipts, invoices] = await Promise.all([
    getReceipts({ status, invoiceId }, scopeQuery),
    getInvoices({ status: "All" }, scopeQuery),
  ]);

  const unpaidInvoices = invoices.filter(
    (invoice) => Number(invoice.tong_tien ?? 0) > Number(invoice.da_thu ?? 0),
  );
  const confirmed = receipts.filter(
    (receipt) => receipt.trang_thai === "Đã xác nhận",
  );
  const totalCollected = confirmed.reduce(
    (sum, receipt) => sum + Number(receipt.so_tien_thu ?? 0),
    0,
  );

  return (
    <AdminShell active="invoice">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Phiếu thu</h1>
          <p className={styles.subtitle}>
            {invoiceId
              ? `Đang lọc theo hóa đơn ${invoiceId}`
              : "Phiếu thu sẽ tự cập nhật trạng thái hóa đơn"}
          </p>
        </div>
        <div className={styles.navTabs}>
          <Link href="/hop-dong" className={styles.navTab}>
            Hợp đồng
          </Link>
          <Link href="/hoa-don" className={styles.navTab}>
            Hóa đơn
          </Link>
          <Link href="/phieu-thu" className={styles.navTabActive}>
            Phiếu thu
          </Link>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Phiếu thu hiển thị</div>
          <div className={styles.miniValue}>{receipts.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đã xác nhận</div>
          <div className={styles.miniValue}>{confirmed.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng tiền đã thu</div>
          <div className={styles.miniValue}>
            {formatMoney(String(totalCollected))}
          </div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Ghi nhận phiếu thu</summary>
        <ReceiptForm
          mode="create"
          invoices={unpaidInvoices}
          presetInvoiceId={invoiceId}
        />
      </details>

      <form className={styles.filterCard} action="/phieu-thu">
        <div className={styles.filterField}>
          <label htmlFor="invoiceId">Mã hóa đơn (để trống xem tất cả)</label>
          <input
            id="invoiceId"
            name="invoiceId"
            defaultValue={invoiceId ?? ""}
            placeholder="HD..."
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
          <Link href="/phieu-thu" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã phiếu thu</th>
                <th>Hóa đơn</th>
                <th>Phòng</th>
                <th>Số tiền</th>
                <th>Ngày thu</th>
                <th>Hình thức</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    Không có phiếu thu phù hợp.
                  </td>
                </tr>
              ) : (
                receipts.map((receipt) => (
                  <tr key={receipt.ma_phieu_thu}>
                    <td>
                      <div className={styles.strong}>
                        {receipt.ma_phieu_thu}
                      </div>
                      <div className={styles.muted}>{receipt.ma_tra_cuu}</div>
                    </td>
                    <td>{receipt.ma_hoa_don}</td>
                    <td>{receipt.ma_phong}</td>
                    <td className={styles.strong}>
                      {formatMoney(receipt.so_tien_thu)}
                    </td>
                    <td>{formatDate(receipt.ngay_thu)}</td>
                    <td>{receipt.hinh_thuc}</td>
                    <td>
                      <span className={statusClass(receipt.trang_thai)}>
                        {receipt.trang_thai}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <ReceiptEditorToggle
                          receipt={receipt}
                          invoices={invoices}
                        />
                        <DeleteReceiptButton
                          maPhieuThu={receipt.ma_phieu_thu}
                        />
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

export default function ReceiptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ReceiptsContent searchParams={searchParams} />
    </Suspense>
  );
}
