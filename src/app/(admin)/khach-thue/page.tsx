import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getTenants } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { TenantForm } from "./tenant-forms";
import { ResidentTableView } from "./resident-table-view";
import styles from "@/components/business.module.css";

export const metadata = {
  title: "Khách thuê & Cư dân | Kiêu Giang Boarding",
};

type SearchParams = Promise<{ status?: string; keyword?: string }>;

const STATUS_OPTIONS = [
  { value: "All", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang cư trú" },
  { value: "pending", label: "Chờ duyệt eKYC & Xe" },
  { value: "past", label: "Cựu cư dân (Đã rời đi)" },
  { value: "unassigned", label: "Chưa thuê phòng" },
];

async function TenantsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  const status = params.status || "All";
  const keyword = params.keyword || "";

  // Nếu xem mặc định (Tất cả & không tìm kiếm), chỉ truy vấn 1 lần duy nhất để tối ưu tốc độ
  const isDefaultView = status === "All" && !keyword.trim();
  let allTenants: Awaited<ReturnType<typeof getTenants>>;
  let filteredTenants: Awaited<ReturnType<typeof getTenants>>;

  if (isDefaultView) {
    allTenants = await getTenants("", scopeQuery);
    filteredTenants = allTenants;
  } else {
    [allTenants, filteredTenants] = await Promise.all([
      getTenants("", scopeQuery),
      getTenants({ status, keyword }, scopeQuery),
    ]);
  }

  const activeCount = allTenants.filter(
    (t) => t.trang_thai_cu_dan === "DangO",
  ).length;

  const pendingCount = allTenants.filter(
    (t) =>
      t.trang_thai_ekyc === "ChoDuyet" ||
      t.so_xe_cho_duyet > 0,
  ).length;

  const pastCount = allTenants.filter(
    (t) => t.trang_thai_cu_dan === "CuuCuDan",
  ).length;

  return (
    <AdminShell active="tenant">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Quản lý Khách thuê &amp; Cư dân</h1>
          <p className={styles.subtitle}>
            Hồ sơ số cư dân, eKYC ảnh CCCD, phương tiện và tài khoản Mobile App
          </p>
        </div>
        <div className={styles.navTabs}>
          <Link href="/khach-thue" className={styles.navTabActive}>
            Cư dân &amp; Khách thuê
          </Link>
          <Link href="/khach-thue/tam-tru" className={styles.navTab}>
            Khách qua đêm (Tạm trú)
          </Link>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <section
        className={styles.miniStats}
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng cư dân</div>
          <div className={styles.miniValue}>{allTenants.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đang cư trú</div>
          <div className={styles.miniValue} style={{ color: "#059669" }}>
            {activeCount}
          </div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Chờ duyệt eKYC / Xe</div>
          <div
            className={styles.miniValue}
            style={{ color: pendingCount > 0 ? "#d97706" : "#2b3674" }}
          >
            {pendingCount}
          </div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Cựu cư dân</div>
          <div className={styles.miniValue} style={{ color: "#64748b" }}>
            {pastCount}
          </div>
        </div>
      </section>

      {/* Form tạo mới khách thuê */}
      <details className={styles.createBox}>
        <summary className={styles.createSummary}>
          + Thêm hồ sơ khách thuê mới
        </summary>
        <TenantForm mode="create" />
      </details>

      {/* Bộ lọc tìm kiếm */}
      <form className={styles.filterCard} action="/khach-thue">
        <div className={styles.filterField}>
          <label htmlFor="keyword">Tìm kiếm cư dân</label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="Tên, số điện thoại, CCCD, phòng, biển số xe..."
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="status">Trạng thái cư dân</label>
          <select id="status" name="status" defaultValue={status}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Lọc
          </button>
          <Link href="/khach-thue" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      {/* Bảng danh sách cư dân & Drawer xem chi tiết */}
      <ResidentTableView tenants={filteredTenants} />
    </AdminShell>
  );
}

export default function TenantsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <TenantsContent searchParams={searchParams} />
    </Suspense>
  );
}
