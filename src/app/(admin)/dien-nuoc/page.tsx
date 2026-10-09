import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getActiveContracts, getMeterReadings } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { DeleteMeterButton, MeterEditorToggle, MeterForm } from "./meter-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; keyword?: string }>;

const STATUS_OPTIONS = ["All", "Chờ duyệt", "Đã duyệt", "Từ chối"];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusClass(status: string | null) {
  if (status === "Đã duyệt") return styles.badgeOk;
  if (status === "Từ chối") return styles.badgeMuted;
  return styles.badgeWarn;
}

async function MeterContent({ searchParams }: { searchParams: SearchParams }) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  const status = params.status || "All";
  const keyword = params.keyword || "";

  const [readings, contracts] = await Promise.all([
    getMeterReadings({ status, keyword }, scopeQuery),
    getActiveContracts(scopeQuery),
  ]);

  const pending = readings.filter(
    (reading) => reading.trang_thai_duyet === "Chờ duyệt",
  ).length;
  const approved = readings.filter(
    (reading) => reading.trang_thai_duyet === "Đã duyệt",
  ).length;

  return (
    <AdminShell active="meter">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Điện nước &amp; Công tơ</h1>
          <p className={styles.subtitle}>
            Ghi chỉ số theo kỳ, duyệt ảnh công tơ, tính tiêu thụ từng phòng
          </p>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Kỳ ghi chỉ số</div>
          <div className={styles.miniValue}>{readings.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Chờ duyệt</div>
          <div className={styles.miniValue}>{pending}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đã duyệt</div>
          <div className={styles.miniValue}>{approved}</div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Ghi chỉ số mới</summary>
        <MeterForm mode="create" contracts={contracts} />
      </details>

      <form className={styles.filterCard} action="/dien-nuoc">
        <div className={styles.filterField}>
          <label htmlFor="keyword">Tìm theo kỳ, mã phòng hoặc tên khách</label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="2026-10, P402, Nguyễn Văn A"
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="status">Trạng thái duyệt</label>
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
          <Link href="/dien-nuoc" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kỳ</th>
                <th>Phòng / Khách</th>
                <th>Điện cũ → mới</th>
                <th>Điện tiêu thụ</th>
                <th>Nước cũ → mới</th>
                <th>Nước tiêu thụ</th>
                <th>Ngày ghi</th>
                <th>Duyệt</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    Không có kỳ ghi chỉ số phù hợp.
                  </td>
                </tr>
              ) : (
                readings.map((reading) => (
                  <tr key={reading.ma_ky}>
                    <td>
                      <div className={styles.strong}>{reading.thang_nam}</div>
                      <div className={styles.muted}>{reading.ma_ky}</div>
                    </td>
                    <td>
                      <div>{reading.ma_phong}</div>
                      <div className={styles.muted}>{reading.ten_khach}</div>
                    </td>
                    <td>
                      {reading.chi_so_dien_cu ?? "-"} →{" "}
                      {reading.chi_so_dien_moi ?? "-"}
                    </td>
                    <td className={styles.strong}>
                      {reading.dien_tieu_thu} kWh
                    </td>
                    <td>
                      {reading.chi_so_nuoc_cu ?? "-"} →{" "}
                      {reading.chi_so_nuoc_moi ?? "-"}
                    </td>
                    <td className={styles.strong}>
                      {reading.nuoc_tieu_thu} m³
                    </td>
                    <td>{formatDate(reading.ngay_ghi_nhan)}</td>
                    <td>
                      <span className={statusClass(reading.trang_thai_duyet)}>
                        {reading.trang_thai_duyet}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <MeterEditorToggle
                          reading={reading}
                          contracts={contracts}
                        />
                        <DeleteMeterButton maKy={reading.ma_ky} />
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

export default function MeterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <MeterContent searchParams={searchParams} />
    </Suspense>
  );
}
