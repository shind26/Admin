import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getActiveContracts, getOvernightStays } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { DeleteStayButton, StayEditorToggle, StayForm } from "./stay-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; keyword?: string }>;

const STATUS_OPTIONS = [
  "All",
  "Chờ xác nhận",
  "Đã duyệt",
  "Hoàn tất",
  "Từ chối",
];

function statusClass(status: string | null) {
  if (status === "Đã duyệt" || status === "Hoàn tất") return styles.badgeOk;
  if (status === "Từ chối") return styles.badgeMuted;
  return styles.badgeWarn;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

async function StaysContent({ searchParams }: { searchParams: SearchParams }) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  const status = params.status || "All";
  const keyword = params.keyword || "";

  const [stays, contracts] = await Promise.all([
    getOvernightStays({ status, keyword }, scopeQuery),
    getActiveContracts(scopeQuery),
  ]);

  const pending = stays.filter(
    (stay) => stay.trang_thai === "Chờ xác nhận",
  ).length;
  const approved = stays.filter(
    (stay) => stay.trang_thai === "Đã duyệt",
  ).length;

  return (
    <AdminShell active="tenant">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Khách qua đêm (Tạm trú)</h1>
          <p className={styles.subtitle}>
            Đăng ký lưu trú của khách ngoài theo hợp đồng
          </p>
        </div>
        <div className={styles.navTabs}>
          <a href="/khach-thue" className={styles.navTab}>
            Khách thuê
          </a>
          <a href="/khach-thue/tam-tru" className={styles.navTabActive}>
            Khách qua đêm
          </a>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng đăng ký</div>
          <div className={styles.miniValue}>{stays.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Chờ xác nhận</div>
          <div className={styles.miniValue}>{pending}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đã duyệt</div>
          <div className={styles.miniValue}>{approved}</div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>
          + Đăng ký khách qua đêm
        </summary>
        <StayForm mode="create" contracts={contracts} />
      </details>

      <form className={styles.filterCard} action="/khach-thue/tam-tru">
        <div className={styles.filterField}>
          <label htmlFor="keyword">
            Tìm theo tên khách, CCCD hoặc mã phòng
          </label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="Tên khách ngoài, CCCD, P402"
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
          <a href="/khach-thue/tam-tru" className={styles.resetButton}>
            Xóa lọc
          </a>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Khách ngoài</th>
                <th>CCCD</th>
                <th>Phòng</th>
                <th>Người đăng ký</th>
                <th>Thời gian</th>
                <th>Cam kết</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {stays.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    Không có đăng ký phù hợp.
                  </td>
                </tr>
              ) : (
                stays.map((stay) => {
                  const matched = contracts.find(
                    (contract) =>
                      contract.ma_phong === stay.ma_phong &&
                      contract.ten_khach === stay.ten_nguoi_dang_ky,
                  );
                  return (
                    <tr key={stay.ma_dang_ky}>
                      <td>
                        <div className={styles.strong}>
                          {stay.ho_ten_khach_ngoai}
                        </div>
                        <div className={styles.muted}>{stay.ma_dang_ky}</div>
                      </td>
                      <td>{stay.cccd_khach_ngoai}</td>
                      <td>{stay.ma_phong}</td>
                      <td>{stay.ten_nguoi_dang_ky}</td>
                      <td>
                        {formatDate(stay.tu_ngay)} → {formatDate(stay.den_ngay)}
                      </td>
                      <td>
                        {stay.cam_ket_an_ninh ? (
                          <span className={styles.badgeOk}>Đã cam kết</span>
                        ) : (
                          <span className={styles.badgeMuted}>Chưa</span>
                        )}
                      </td>
                      <td>
                        <span className={statusClass(stay.trang_thai)}>
                          {stay.trang_thai}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionCell}>
                          <StayEditorToggle
                            stay={stay}
                            contracts={contracts}
                            matchedContractId={matched?.ma_hop_dong}
                          />
                          <DeleteStayButton
                            maDangKy={stay.ma_dang_ky}
                            hoTen={stay.ho_ten_khach_ngoai ?? stay.ma_dang_ky}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

export default function StaysPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <StaysContent searchParams={searchParams} />
    </Suspense>
  );
}
