import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import {
  getActiveContracts,
  getMeterClosingProgress,
  getMeterReadings,
} from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { detectMeterAnomaly } from "@/lib/meter-utils";
import {
  ClosingProgressCard,
  CreateMeterModal,
  DeleteMeterButton,
  MeterAnomalyBadge,
  MeterEditorToggle,
  MeterInvoiceLink,
  MeterPhotoViewer,
  QuickApproveButton,
  QuickRejectButton,
} from "./meter-forms";
import styles from "@/components/business.module.css";

type SearchParams = Promise<{ status?: string; keyword?: string; period?: string }>;

const STATUS_OPTIONS = ["All", "Chờ duyệt", "Đã duyệt", "Từ chối", "Bất thường"];

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
  const period = params.period;

  const [readingsRaw, contracts, progress] = await Promise.all([
    getMeterReadings(
      { status: status === "Bất thường" ? undefined : status, keyword },
      scopeQuery,
    ),
    getActiveContracts(scopeQuery),
    getMeterClosingProgress(period, scopeQuery),
  ]);

  const readings =
    status === "Bất thường"
      ? readingsRaw.filter((reading) => detectMeterAnomaly(reading).hasAnomaly)
      : readingsRaw;

  const pending = readingsRaw.filter(
    (reading) => reading.trang_thai_duyet === "Chờ duyệt",
  ).length;
  const approved = readingsRaw.filter(
    (reading) => reading.trang_thai_duyet === "Đã duyệt",
  ).length;
  const anomalyCount = readingsRaw.filter(
    (reading) => detectMeterAnomaly(reading).hasAnomaly,
  ).length;

  return (
    <AdminShell active="meter">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Điện nước &amp; Công tơ</h1>
          <p className={styles.subtitle}>
            Duyệt ảnh đồng hồ công tơ khách gửi từ phòng, cảnh báo bất thường, theo dõi tiến độ chốt số và tự động kết chuyển Hóa đơn.
          </p>
        </div>
        <div className={styles.pageActions}>
          <CreateMeterModal contracts={contracts} />
        </div>
      </div>

      {/* ── TÍNH NĂNG 2: THEO DÕI TIẾN ĐỘ CHỐT SỐ THEO KỲ ── */}
      <ClosingProgressCard progress={progress} />

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Kỳ ghi chỉ số</div>
          <div className={styles.miniValue}>{readings.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Chờ duyệt</div>
          <div
            className={styles.miniValue}
            style={{ color: pending > 0 ? "#d97706" : undefined }}
          >
            {pending}
          </div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đã duyệt</div>
          <div className={styles.miniValue} style={{ color: "#059669" }}>
            {approved}
          </div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Cảnh báo bất thường</div>
          <div
            className={styles.miniValue}
            style={{ color: anomalyCount > 0 ? "#dc2626" : "#64748b" }}
          >
            {anomalyCount}
          </div>
        </div>
      </section>

      <form className={styles.filterCard} action="/dien-nuoc">
        {period && <input type="hidden" name="period" value={period} />}
        <div className={styles.filterField}>
          <label htmlFor="keyword">Tìm theo kỳ, mã phòng hoặc tên khách</label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="09/2026, P402, Nguyễn Văn A"
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="status">Trạng thái duyệt / Cảnh báo</label>
          <select id="status" name="status" defaultValue={status}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "All"
                  ? "Tất cả"
                  : option === "Bất thường"
                    ? "⚠️ Bất thường (Đột biến / = 0)"
                    : option}
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
                <th>Ảnh đồng hồ</th>
                <th>Điện (Cũ → Mới)</th>
                <th>Điện tiêu thụ</th>
                <th>Nước (Cũ → Mới)</th>
                <th>Nước tiêu thụ</th>
                <th>Ngày gửi</th>
                <th>Trạng thái &amp; Hóa đơn</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.empty}>
                    Không có kỳ ghi chỉ số phù hợp.
                  </td>
                </tr>
              ) : (
                readings.map((reading) => (
                  <tr key={reading.ma_ky}>
                    <td>
                      <div className={styles.strong}>{reading.thang_nam}</div>
                      <div className={styles.muted} style={{ fontSize: 11 }}>
                        {reading.ma_ky}
                      </div>
                    </td>
                    <td>
                      <div className={styles.strong}>{reading.ma_phong}</div>
                      <div className={styles.muted}>
                        {reading.ten_khach || "—"}
                      </div>
                      {/* ── TÍNH NĂNG 1: CẢNH BÁO BẤT THƯỜNG TRÊN BẢNG ── */}
                      <MeterAnomalyBadge reading={reading} />
                    </td>
                    <td>
                      <MeterPhotoViewer reading={reading} />
                    </td>
                    <td>
                      {reading.chi_so_dien_cu ?? "-"} →{" "}
                      <strong>{reading.chi_so_dien_moi ?? "-"}</strong>
                    </td>
                    <td>
                      <div className={styles.strong} style={{ color: "#d97706" }}>
                        {reading.dien_tieu_thu} kWh
                      </div>
                      {reading.dien_ky_truoc !== null &&
                        reading.dien_ky_truoc !== undefined && (
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            Kỳ trước: {reading.dien_ky_truoc} kWh
                          </div>
                        )}
                    </td>
                    <td>
                      {reading.chi_so_nuoc_cu ?? "-"} →{" "}
                      <strong>{reading.chi_so_nuoc_moi ?? "-"}</strong>
                    </td>
                    <td>
                      <div className={styles.strong} style={{ color: "#0284c7" }}>
                        {reading.nuoc_tieu_thu} m³
                      </div>
                      {reading.nuoc_ky_truoc !== null &&
                        reading.nuoc_ky_truoc !== undefined && (
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            Kỳ trước: {reading.nuoc_ky_truoc} m³
                          </div>
                        )}
                    </td>
                    <td>{formatDate(reading.ngay_ghi_nhan)}</td>
                    <td>
                      <span className={statusClass(reading.trang_thai_duyet)}>
                        {reading.trang_thai_duyet}
                      </span>
                      {/* ── TÍNH NĂNG 3: LIÊN KẾT HÓA ĐƠN ĐÃ TỰ ĐỘNG KẾT CHUYỂN ── */}
                      <MeterInvoiceLink maHoaDon={reading.ma_hoa_don} />
                    </td>
                    <td>
                      <div
                        className={styles.actionCell}
                        style={{ display: "flex", gap: 6, alignItems: "center" }}
                      >
                        {reading.trang_thai_duyet === "Chờ duyệt" && (
                          <>
                            <QuickApproveButton maKy={reading.ma_ky} />
                            <QuickRejectButton maKy={reading.ma_ky} />
                          </>
                        )}
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

