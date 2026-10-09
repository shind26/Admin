import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getTenants } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import {
  DeleteTenantButton,
  TenantEditorToggle,
  TenantForm,
  type TenantFormData,
} from "./tenant-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ keyword?: string }>;

async function TenantsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { scope } = await requireScope();
  const params = await searchParams;
  const keyword = params.keyword || "";
  const tenants = await getTenants(keyword, new ScopeQuery(scope));
  const staying = tenants.filter(
    (tenant) => tenant.ma_phong_hien_tai !== null,
  ).length;

  return (
    <AdminShell active="tenant">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Khách thuê &amp; Tạm trú</h1>
          <p className={styles.subtitle}>
            Hồ sơ khách thuê và đăng ký khách qua đêm
          </p>
        </div>
        <div className={styles.navTabs}>
          <Link href="/khach-thue" className={styles.navTabActive}>
            Khách thuê
          </Link>
          <Link href="/khach-thue/tam-tru" className={styles.navTab}>
            Khách qua đêm
          </Link>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng hồ sơ khách</div>
          <div className={styles.miniValue}>{tenants.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đang có phòng</div>
          <div className={styles.miniValue}>{staying}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Chưa thuê</div>
          <div className={styles.miniValue}>{tenants.length - staying}</div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Thêm khách thuê</summary>
        <TenantForm mode="create" />
      </details>

      <form className={styles.filterCard} action="/khach-thue">
        <div className={styles.filterField}>
          <label htmlFor="keyword">Tìm theo tên, CCCD hoặc số điện thoại</label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="Nguyễn Văn A, 012345678901, 0901..."
          />
        </div>
        <div className={styles.filterField} />
        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Tìm
          </button>
          <Link href="/khach-thue" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Số điện thoại</th>
                <th>CCCD</th>
                <th>Địa chỉ thường trú</th>
                <th>Phòng hiện tại</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Không có khách thuê phù hợp.
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.ma_khach}>
                    <td>
                      <div className={styles.strong}>{tenant.ho_ten_khach}</div>
                      <div className={styles.muted}>{tenant.ma_khach}</div>
                    </td>
                    <td>{tenant.so_dt}</td>
                    <td>{tenant.cccd}</td>
                    <td>{tenant.dia_chi_thuong_tru}</td>
                    <td>
                      {tenant.ma_phong_hien_tai ? (
                        <span className={styles.badgeOk}>
                          {tenant.ma_phong_hien_tai}
                        </span>
                      ) : (
                        <span className={styles.badgeMuted}>Chưa có phòng</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <TenantEditorToggle
                          tenant={
                            {
                              maKhach: tenant.ma_khach,
                              hoTenKhach: tenant.ho_ten_khach ?? "",
                              soDt: tenant.so_dt ?? "",
                              cccd: tenant.cccd ?? "",
                              diaChiThuongTru: tenant.dia_chi_thuong_tru ?? "",
                            } satisfies TenantFormData
                          }
                        />
                        <DeleteTenantButton
                          maKhach={tenant.ma_khach}
                          hoTen={tenant.ho_ten_khach ?? tenant.ma_khach}
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
