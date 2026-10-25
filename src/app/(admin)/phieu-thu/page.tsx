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
  QuickApproveReceiptButton,
  QuickRejectReceiptButton,
} from "./receipt-forms";
import { ReceiptDetailTrigger } from "./receipt-detail-modal";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{
  status?: string;
  invoiceId?: string;
  keyword?: string;
}>;

const STATUS_OPTIONS = [
  "All",
  "Đã xác nhận",
  "Đã khớp lệnh",
  "Chờ xác nhận",
  "Từ chối",
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
  if (status === "Đã xác nhận" || status === "Đã khớp lệnh") return styles.badgeOk;
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
  const keyword = params.keyword;

  const [receipts, invoices] = await Promise.all([
    getReceipts({ status, invoiceId, keyword }, scopeQuery),
    getInvoices({ status: "All" }, scopeQuery),
  ]);

  const unpaidInvoices = invoices.filter(
    (invoice) => Number(invoice.tong_tien ?? 0) > Number(invoice.da_thu ?? 0),
  );
  const confirmed = receipts.filter(
    (receipt) =>
      receipt.trang_thai === "Đã xác nhận" ||
      receipt.trang_thai === "Đã khớp lệnh",
  );
  const pending = receipts.filter(
    (receipt) => receipt.trang_thai === "Chờ xác nhận",
  );
  const totalCollected = confirmed.reduce(
    (sum, receipt) => sum + Number(receipt.so_tien_thu ?? 0),
    0,
  );

  return (
    <AdminShell active="receipt">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Phiếu thu</h1>
          <p className={styles.subtitle}>
            {invoiceId
              ? `Đang lọc theo hóa đơn ${invoiceId}`
              : "Phiếu thu tiền phòng & dịch vụ — Tự động đồng bộ công nợ hóa đơn"}
          </p>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Phiếu thu hiển thị</div>
          <div className={styles.miniValue}>{receipts.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đã xác nhận / Khớp lệnh</div>
          <div className={styles.miniValue}>{confirmed.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Chờ xác nhận</div>
          <div className={styles.miniValue}>{pending.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng tiền đã thu</div>
          <div className={styles.miniValue}>
            {formatMoney(String(totalCollected))}
          </div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Ghi nhận phiếu thu mới</summary>
        <ReceiptForm
          mode="create"
          invoices={unpaidInvoices}
          presetInvoiceId={invoiceId}
        />
      </details>

      <form className={styles.filterCard} action="/phieu-thu">
        <div className={styles.filterField}>
          <label htmlFor="keyword">Tìm kiếm nhanh</label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword ?? ""}
            placeholder="Mã phiếu, HĐ, phòng, khách, tra cứu..."
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="invoiceId">Mã hóa đơn</label>
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
                <th>Khách thuê &amp; Phòng</th>
                <th>Hóa đơn</th>
                <th>Số tiền</th>
                <th>Ngày thu</th>
                <th>Hình thức &amp; Tra cứu</th>
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
                      <div>
                        <ReceiptDetailTrigger receipt={receipt} />
                      </div>
                      {receipt.ma_tra_cuu && (
                        <div
                          className={styles.muted}
                          style={{ fontSize: "11px", marginTop: "2px" }}
                        >
                          TC: {receipt.ma_tra_cuu}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.strong}>
                        {receipt.ten_khach || "—"}
                      </div>
                      <div className={styles.muted}>
                        Phòng {receipt.ma_phong || "—"}{" "}
                        {receipt.toa_nha ? `(${receipt.toa_nha})` : ""}
                      </div>
                    </td>
                    <td>
                      <div className={styles.strong}>
                        {receipt.ma_hoa_don || "—"}
                      </div>
                      {receipt.tong_tien_hoa_don && (
                        <div className={styles.muted} style={{ fontSize: "11px" }}>
                          Tổng: {formatMoney(receipt.tong_tien_hoa_don)}
                        </div>
                      )}
                    </td>
                    <td className={styles.strong} style={{ color: "#0f766e" }}>
                      {formatMoney(receipt.so_tien_thu)}
                    </td>
                    <td>{formatDate(receipt.ngay_thu)}</td>
                    <td>
                      <div>{receipt.hinh_thuc || "—"}</div>
                    </td>
                    <td>
                      <span className={statusClass(receipt.trang_thai)}>
                        {receipt.trang_thai}
                      </span>
                    </td>
                    <td>
                      <div
                        className={styles.actionCell}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          alignItems: "center",
                        }}
                      >
                        <ReceiptDetailTrigger receipt={receipt} asButton={true} />

                        {receipt.trang_thai === "Chờ xác nhận" && (
                          <>
                            <QuickApproveReceiptButton
                              maPhieuThu={receipt.ma_phieu_thu}
                            />
                            <QuickRejectReceiptButton
                              maPhieuThu={receipt.ma_phieu_thu}
                            />
                          </>
                        )}

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
