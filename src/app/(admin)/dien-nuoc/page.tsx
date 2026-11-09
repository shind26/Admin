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

type SearchParams = Promise<{
  status?: string;
  keyword?: string;
  period?: string;
}>;

const STATUS_OPTIONS = [
  "All",
  "Chờ duyệt",
  "Đã duyệt",
  "Từ chối",
  "Bất thường",
];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
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

  return (
    <AdminShell active="meter">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Điện nước &amp; Công tơ</h1>
          <p className={styles.subtitle}>
            Duyệt ảnh đồng hồ công tơ khách gửi từ phòng, cảnh báo bất thường,
            theo dõi tiến độ chốt số và tự động kết chuyển Hóa đơn.
          </p>
        </div>
        <div className={styles.pageActions}>
          <CreateMeterModal contracts={contracts} />
        </div>
      </div>

      {/* ── TÍNH NĂNG 2: THEO DÕI TIẾN ĐỘ CHỐT SỐ THEO KỲ ── */}
      <ClosingProgressCard progress={progress} />

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
                    ? "Chỉ số bất thường"
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
                <th>Kỳ ghi</th>
                <th>Phòng / Khách</th>
                <th>Ảnh đồng hồ</th>
                <th>Điện (kWh)</th>
                <th>Nước (m³)</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Không có kỳ ghi chỉ số phù hợp.
                  </td>
                </tr>
              ) : (
                readings.map((reading) => (
                  <tr key={reading.ma_ky}>
                    <td>
                      <div className={styles.strong}>{reading.thang_nam}</div>
                      <div
                        className={styles.muted}
                        style={{ fontSize: 11.5, marginTop: 2 }}
                      >
                        {formatDate(reading.ngay_ghi_nhan)}
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
                      <div
                        style={{ fontSize: 12.5, color: "var(--text-main)" }}
                      >
                        {reading.chi_so_dien_cu ?? "-"} →{" "}
                        <strong>{reading.chi_so_dien_moi ?? "-"}</strong>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--primary)",
                          marginTop: 2,
                        }}
                      >
                        +{reading.dien_tieu_thu} kWh
                      </div>
                    </td>
                    <td>
                      <div
                        style={{ fontSize: 12.5, color: "var(--text-main)" }}
                      >
                        {reading.chi_so_nuoc_cu ?? "-"} →{" "}
                        <strong>{reading.chi_so_nuoc_moi ?? "-"}</strong>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--primary)",
                          marginTop: 2,
                        }}
                      >
                        +{reading.nuoc_tieu_thu} m³
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "var(--primary-subtle)",
                          color: "var(--primary)",
                          border: "1px solid var(--border-strong)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {reading.trang_thai_duyet}
                      </span>
                      {/* ── TÍNH NĂNG 3: LIÊN KẾT HÓA ĐƠN ĐÃ TỰ ĐỘNG KẾT CHUYỂN ── */}
                      <MeterInvoiceLink maHoaDon={reading.ma_hoa_don} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        className={styles.actionCell}
                        style={{
                          display: "inline-flex",
                          gap: 6,
                          alignItems: "center",
                          justifyContent: "flex-end",
                        }}
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
