import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import {
  getContracts,
  getRoomOptions,
  getTenantOptions,
  getPaidReservationsPendingContract,
  getPendingLiquidationRequests,
  getPendingRoomTransferRequests,
} from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import {
  ContractEditorToggle,
  ContractForm,
  DeleteContractButton,
} from "./contract-forms";
import { PendingReservationsQueue } from "./pending-reservations";
import { PendingLiquidationQueue } from "./pending-liquidation";
import { PendingTransfersQueue } from "./pending-transfers";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; keyword?: string }>;

const STATUS_OPTIONS = [
  "All",
  "Còn hạn",
  "Đã đặt cọc",
  "Đã kết thúc",
];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatMoney(value: string | null) {
  if (value === null) return "-";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function statusClass(status: string | null) {
  if (status === "Còn hạn" || status === "Đang thuê") return styles.badgeOk;
  if (status === "Đã đặt cọc") return styles.badgeInfo;
  return styles.badgeMuted;
}

async function ContractsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  const status = params.status || "All";
  const keyword = params.keyword || "";

  const [{ contracts, stats }, rooms, tenants, pendingReservations, pendingLiquidations, pendingTransfers] =
    await Promise.all([
      getContracts({ status, keyword }, scopeQuery),
      getRoomOptions(scopeQuery),
      getTenantOptions(scopeQuery),
      getPaidReservationsPendingContract(scopeQuery),
      getPendingLiquidationRequests(scopeQuery),
      getPendingRoomTransferRequests(scopeQuery),
    ]);

  const emptyRooms = rooms.filter(
    (r) => r.trang_thai !== "Đang thuê" && r.trang_thai !== "Đã đặt cọc" && r.trang_thai !== "Đã cọc",
  );

  return (
    <AdminShell active="contract">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Hợp đồng thuê phòng</h1>
        </div>
      </div>

      {/* Hàng đợi các yêu cầu đặt cọc thành công từ Mobile App cần lập hợp đồng ngay */}
      <PendingReservationsQueue reservations={pendingReservations} />

      {/* Hàng đợi các yêu cầu đổi / chuyển phòng từ Mobile App chờ duyệt */}
      <PendingTransfersQueue requests={pendingTransfers} emptyRooms={emptyRooms} />

      {/* Hàng đợi các yêu cầu trả phòng / thanh lý hợp đồng từ Mobile App chờ duyệt */}
      <PendingLiquidationQueue requests={pendingLiquidations} />

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng hợp đồng</div>
          <div className={styles.miniValue}>{stats.total}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đang hiệu lực</div>
          <div className={styles.miniValue}>{stats.active}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Sắp hết hạn (30 ngày)</div>
          <div className={styles.miniValue}>{stats.expiring}</div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Tạo hợp đồng</summary>
        <ContractForm mode="create" rooms={rooms} tenants={tenants} />
      </details>

      <form className={styles.filterCard} action="/hop-dong">
        <div className={styles.filterField}>
          <label htmlFor="keyword">
            Tìm theo mã hợp đồng, mã phòng hoặc tên khách
          </label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="HD..., P402, Nguyễn Văn A"
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
          <Link href="/hop-dong" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã hợp đồng</th>
                <th>Phòng</th>
                <th>Khách đại diện</th>
                <th>Thời hạn</th>
                <th>Giá thuê</th>
                <th>Tiền cọc</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    Không có hợp đồng phù hợp.
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.ma_hop_dong}>
                    <td>
                      <Link
                        href={`/hop-dong/${encodeURIComponent(contract.ma_hop_dong)}`}
                        className={styles.strong}
                        style={{ color: "#1e40af", textDecoration: "underline" }}
                      >
                        {contract.ma_hop_dong}
                      </Link>
                    </td>
                    <td>{contract.ma_phong}</td>
                    <td>{contract.ten_khach}</td>
                    <td>
                      {formatDate(contract.ngay_bd)} →{" "}
                      {formatDate(contract.ngay_kt)}
                    </td>
                    <td>{formatMoney(contract.gia_thue_thoa_thuan)}</td>
                    <td>{formatMoney(contract.tien_dat_coc)}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <span className={statusClass(contract.trang_thai)}>
                          {contract.trang_thai}
                        </span>
                        {contract.co_yeu_cau_thanh_ly && (
                          <Link
                            href={`/hop-dong/${encodeURIComponent(contract.ma_hop_dong)}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              background: "#F6E6B4",
                              color: "#92400E",
                              border: "1px solid #FDE68A",
                              borderRadius: 4,
                              padding: "2px 6px",
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ⚡ Yêu cầu trả phòng
                          </Link>
                        )}
                        {contract.co_yeu_cau_doi_phong && (
                          <Link
                            href={`/hop-dong/${encodeURIComponent(contract.ma_hop_dong)}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              background: "#DCEFF8",
                              color: "#0369A1",
                              border: "1px solid #BAE6FD",
                              borderRadius: 4,
                              padding: "2px 6px",
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ⚡ Yêu cầu đổi phòng
                          </Link>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <ContractEditorToggle
                          contract={contract}
                          rooms={rooms}
                          tenants={tenants}
                        />
                        <DeleteContractButton
                          maHopDong={contract.ma_hop_dong}
                          tenPhong={contract.ma_phong ?? ""}
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

export default function ContractsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ContractsContent searchParams={searchParams} />
    </Suspense>
  );
}
