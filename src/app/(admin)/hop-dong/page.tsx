import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getContracts, getRoomOptions, getTenantOptions } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import {
  ContractEditorToggle,
  ContractForm,
  DeleteContractButton,
} from "./contract-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; keyword?: string }>;

const STATUS_OPTIONS = ["All", "Đang thuê", "Còn hạn", "Đã cọc", "Đã kết thúc"];

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
  if (status === "Đã cọc") return styles.badgeInfo;
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

  const [{ contracts, stats }, rooms, tenants] = await Promise.all([
    getContracts({ status, keyword }, scopeQuery),
    getRoomOptions(scopeQuery),
    getTenantOptions(scopeQuery),
  ]);

  return (
    <AdminShell active="invoice">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Hợp đồng thuê phòng</h1>
          <p className={styles.subtitle}>
            Tạo hợp đồng sẽ tự cập nhật trạng thái phòng thành Đang thuê khi hợp
            đồng còn hiệu lực
          </p>
        </div>
        <div className={styles.navTabs}>
          <Link href="/hop-dong" className={styles.navTabActive}>
            Hợp đồng
          </Link>
          <Link href="/hoa-don" className={styles.navTab}>
            Hóa đơn
          </Link>
          <Link href="/phieu-thu" className={styles.navTab}>
            Phiếu thu
          </Link>
        </div>
      </div>

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
                    <td className={styles.strong}>{contract.ma_hop_dong}</td>
                    <td>{contract.ma_phong}</td>
                    <td>{contract.ten_khach}</td>
                    <td>
                      {formatDate(contract.ngay_bd)} →{" "}
                      {formatDate(contract.ngay_kt)}
                    </td>
                    <td>{formatMoney(contract.gia_thue_thoa_thuan)}</td>
                    <td>{formatMoney(contract.tien_dat_coc)}</td>
                    <td>
                      <span className={statusClass(contract.trang_thai)}>
                        {contract.trang_thai}
                      </span>
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
