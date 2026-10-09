import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getIssues, getRoomOptions, getTenantOptions } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { DeleteIssueButton, IssueEditorToggle, IssueForm } from "./issue-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; keyword?: string }>;

const STATUS_OPTIONS = [
  "All",
  "Chờ xử lý",
  "Đang xử lý",
  "Đã xử lý",
  "Đã hoàn thành",
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
  if (status === "Đã xử lý" || status === "Đã hoàn thành")
    return styles.badgeOk;
  if (status === "Đang xử lý") return styles.badgeInfo;
  return styles.badgeWarn;
}

function priorityClass(priority: string | null) {
  if (priority === "Khẩn cấp" || priority === "Cao") return styles.badgeWarn;
  return styles.badgeMuted;
}

async function IssuesContent({ searchParams }: { searchParams: SearchParams }) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  const status = params.status || "All";
  const keyword = params.keyword || "";

  const [issues, rooms, tenants] = await Promise.all([
    getIssues({ status, keyword }, scopeQuery),
    getRoomOptions(scopeQuery),
    getTenantOptions(scopeQuery),
  ]);

  const open = issues.filter(
    (issue) =>
      issue.trang_thai !== "Đã xử lý" && issue.trang_thai !== "Đã hoàn thành",
  ).length;
  const totalCost = issues.reduce(
    (sum, issue) => sum + Number(issue.chi_phi_sua_chua ?? 0),
    0,
  );

  return (
    <AdminShell active="maintenance">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Sự cố &amp; Sửa chữa</h1>
          <p className={styles.subtitle}>
            Tiếp nhận sự cố theo phòng, theo dõi tiến độ và chi phí sửa chữa
          </p>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Phiếu sự cố hiển thị</div>
          <div className={styles.miniValue}>{issues.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Cần xử lý</div>
          <div className={styles.miniValue}>{open}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng chi phí</div>
          <div className={styles.miniValue}>
            {formatMoney(String(totalCost))}
          </div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Tạo phiếu sự cố</summary>
        <IssueForm mode="create" rooms={rooms} tenants={tenants} />
      </details>

      <form className={styles.filterCard} action="/su-co">
        <div className={styles.filterField}>
          <label htmlFor="keyword">
            Tìm theo mã phòng, danh mục hoặc nội dung
          </label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="P402, điều hòa, rò rỉ nước"
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
          <Link href="/su-co" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã sự cố</th>
                <th>Phòng</th>
                <th>Khách báo</th>
                <th>Danh mục</th>
                <th>Nội dung</th>
                <th>Ưu tiên</th>
                <th>Chi phí</th>
                <th>Ngày báo</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.empty}>
                    Không có phiếu sự cố phù hợp.
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.ma_su_co}>
                    <td className={styles.strong}>{issue.ma_su_co}</td>
                    <td>{issue.ma_phong}</td>
                    <td>{issue.ten_khach_bao || "Không xác định"}</td>
                    <td>{issue.danh_muc}</td>
                    <td>{issue.noi_dung}</td>
                    <td>
                      <span className={priorityClass(issue.muc_do_uu_tien)}>
                        {issue.muc_do_uu_tien}
                      </span>
                    </td>
                    <td>{formatMoney(issue.chi_phi_sua_chua)}</td>
                    <td>{formatDate(issue.ngay_bao_cao)}</td>
                    <td>
                      <span className={statusClass(issue.trang_thai)}>
                        {issue.trang_thai}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <IssueEditorToggle
                          issue={issue}
                          rooms={rooms}
                          tenants={tenants}
                        />
                        <DeleteIssueButton maSuCo={issue.ma_su_co} />
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

export default function IssuesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <IssuesContent searchParams={searchParams} />
    </Suspense>
  );
}
