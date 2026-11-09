import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getFinancialDashboardData } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { RevenueTrendBarChart, RevenueBreakdownDonut } from "./dashboard-charts";
import { RecentReceiptsTable } from "./dashboard-tables";
import styles from "./dashboard.module.css";

type SearchParams = Promise<{
  building?: string;
}>;

function formatMoney(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0\u00A0đ";
  return `${Number(num).toLocaleString("vi-VN")}\u00A0đ`;
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { account, scope } = await requireScope();
  const params = await searchParams;
  const buildingFilter = params.building ?? null;

  const data = await getFinancialDashboardData(
    buildingFilter,
    new ScopeQuery(scope),
  );
  const displayName = account.ho_ten || account.ten_dang_nhap || "Quản trị viên";
  const { kpi, monthlyTrend, revenueBreakdown, recentReceipts } = data;

  return (
    <AdminShell active="home">
      <div className={styles.dashboardContainer}>
        {/* ── 1. HEADER & THAO TÁC NHANH ── */}
        <section className={styles.dashHeader}>
          <div className={styles.dashTitleCol}>
            <h1>Xin chào, {displayName}!</h1>
            <p className={styles.dashSub}>
              Tổng quan hoạt động kinh doanh nhà trọ Kiều Giang
              {buildingFilter && `    Cơ sở: ${buildingFilter}`}
            </p>
          </div>

          <div className={styles.dashQuickActions}>
            <Link href="/phieu-thu" className={styles.btnActionPrimary}>
              Ghi phiếu thu
            </Link>
            <Link href="/dien-nuoc" className={styles.btnActionSecondary}>
              Chốt điện nước
            </Link>
            <Link href="/hop-dong" className={styles.btnActionSecondary}>
              Lập hợp đồng
            </Link>
            <Link href="/phong" className={styles.btnActionSecondary}>
              Quản lý phòng
            </Link>
          </div>
        </section>

        {/* ── 2. CẢNH BÁO CỌC GIỮ CHỖ (NẾU CÓ) ── */}
        {kpi.pendingHoldCount > 0 && (
          <section className={styles.pendingQueueAlert}>
            <div className={styles.pendingAlertLeft}>
              <div className={styles.pendingAlertText}>
                <h4>Có {kpi.pendingHoldCount} yêu cầu cọc giữ chỗ mới cần lập hợp đồng</h4>
              </div>
            </div>
            <Link href="/hop-dong" className={styles.btnAlertAction}>
              Xem danh sách cọc
            </Link>
          </section>
        )}

        {/* ── 3. THỐNG KÊ TÀI CHÍNH (3 THẺ) ── */}
        <section className={styles.financialGrid}>
          {/* Card 1: Tiền đã thu */}
          <article className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Tiền đã thu tháng này</span>
            </div>
            <div className={styles.kpiValue} style={{ whiteSpace: "nowrap" }}>
              {formatMoney(kpi.doanhThuThang)}
            </div>
            <div className={styles.kpiFoot}>
              <span style={{ whiteSpace: "nowrap" }}>
                Tổng đã thu: <strong>{formatMoney(kpi.tongThucThu)}</strong>
              </span>
              {kpi.doanhThuThangTruoc > 0 && (
                <span>
                  {kpi.chenhLechDoanhThuPct >= 0 ? (
                    <span className={styles.kpiBadgeUp}>
                      +{kpi.chenhLechDoanhThuPct}% so với tháng trước
                    </span>
                  ) : (
                    <span className={styles.kpiBadgeDown}>
                      {kpi.chenhLechDoanhThuPct}% so với tháng trước
                    </span>
                  )}
                </span>
              )}
            </div>
          </article>

          {/* Card 2: Tiền nợ chưa thu */}
          <article className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Tiền nợ chưa thu</span>
            </div>
            <div className={styles.kpiValue} style={{ whiteSpace: "nowrap" }}>
              {formatMoney(kpi.tongNoTonDong)}
            </div>
            <div className={styles.kpiFoot}>
              <span style={{ whiteSpace: "nowrap" }}>
                {kpi.tongNoTonDong <= 0 ? (
                  <span style={{ color: "var(--status-success-text)", fontWeight: 600 }}>Tất cả đã thanh toán</span>
                ) : (
                  <>
                    Tổng từ <strong>{kpi.soHoaDonNo || 1} hóa đơn</strong> chưa thanh toán
                  </>
                )}
              </span>
            </div>
          </article>

          {/* Card 3: Tiền cọc đang giữ */}
          <article className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Tiền cọc đang giữ</span>
            </div>
            <div className={styles.kpiValue} style={{ whiteSpace: "nowrap" }}>
              {formatMoney(kpi.tongTienCoc)}
            </div>
            <div
              className={styles.kpiFoot}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                alignItems: "flex-start",
                width: "100%",
              }}
            >
              <div style={{ whiteSpace: "nowrap", fontSize: 11.5 }}>
                Cọc hợp đồng: <strong>{formatMoney(kpi.tienCocHopDong)}</strong>
              </div>
              <div style={{ whiteSpace: "nowrap", fontSize: 11.5 }}>
                Cọc giữ chỗ: <strong>{formatMoney(kpi.tienCocGiuCho)}</strong>
              </div>
            </div>
          </article>
        </section>

        {/* ── 4. BIỂU ĐỒ DOANH THU & CÁC KHOẢN THU ── */}
        <section className={styles.chartsGrid}>
          <RevenueTrendBarChart data={monthlyTrend} />
          <RevenueBreakdownDonut data={revenueBreakdown} />
        </section>

        {/* ── 5. BẢNG PHIẾU THU & TÌNH TRẠNG VẬN HÀNH ── */}
        <section className={styles.bottomGrid}>
          <RecentReceiptsTable receipts={recentReceipts} />

          <div className={styles.opPanelCard}>
            <div className={styles.tableHeadRow}>
              <div className={styles.tableTitleGroup}>
                <div>
                  <h3 className={styles.tableTitle}>Tình trạng vận hành</h3>
                </div>
              </div>
              <Link href="/phong" className={styles.viewAllLink}>
                Xem tất cả phòng
              </Link>
            </div>

            <div className={styles.opMiniGrid}>
              <Link href="/phong" className={styles.opMiniCard}>
                <div className={styles.opMiniText}>
                  <span className={styles.opMiniLabel}>Phòng đang thuê</span>
                  <strong className={styles.opMiniValue}>{kpi.dangThue}/{kpi.tongPhong} phòng</strong>
                </div>
              </Link>

              <Link href="/phong?status=Trong" className={styles.opMiniCard}>
                <div className={styles.opMiniText}>
                  <span className={styles.opMiniLabel}>Phòng còn trống</span>
                  <strong className={styles.opMiniValue}>{kpi.phongTrong} phòng</strong>
                </div>
              </Link>

              <Link href="/khach-thue" className={styles.opMiniCard}>
                <div className={styles.opMiniText}>
                  <span className={styles.opMiniLabel}>Khách đang ở</span>
                  <strong className={styles.opMiniValue}>{kpi.soCuDan} người</strong>
                </div>
              </Link>

              <Link href="/su-co" className={styles.opMiniCard}>
                <div className={styles.opMiniText}>
                  <span className={styles.opMiniLabel}>Báo hỏng / Sự cố</span>
                  <strong className={styles.opMiniValue} style={{ color: kpi.suCo > 0 ? "var(--status-danger-text)" : "var(--text-main)" }}>
                    {kpi.suCo} yêu cầu
                  </strong>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
