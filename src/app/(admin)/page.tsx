import Link from "next/link";
import { Suspense } from "react";
import {
  Wallet,
  Coins,
  Receipt,
  PiggyBank,
  Sparkles,
  DoorOpen,
  Users,
  TriangleAlert,
  ArrowRight,
  PlusCircle,
  Zap,
  FileSignature,
  Building2,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getFinancialDashboardData } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { RevenueTrendBarChart, RevenueBreakdownDonut } from "./dashboard-charts";
import { UnpaidInvoicesTable, RecentReceiptsTable } from "./dashboard-tables";
import styles from "./dashboard.module.css";

type SearchParams = Promise<{
  building?: string;
}>;

function formatMoney(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
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
  const { kpi, monthlyTrend, revenueBreakdown, unpaidInvoices, recentReceipts } =
    data;

  return (
    <AdminShell active="home">
      <div className={styles.dashboardContainer}>
        {/* ── 1. HEADER & QUICK ACTIONS ── */}
        <section className={styles.dashHeader}>
          <div className={styles.dashTitleCol}>
            <h1>Xin chào, {displayName}! 👋</h1>
            <p className={styles.dashSub}>
              Trung tâm kiểm soát tài chính, doanh thu &amp; vận hành chuỗi căn hộ Kiều Giang
              {buildingFilter && ` • Đang lọc theo ${buildingFilter}`}
            </p>
          </div>

          <div className={styles.dashQuickActions}>
            <Link href="/phieu-thu" className={styles.btnActionPrimary}>
              <PlusCircle size={14} /> Ghi phiếu thu
            </Link>
            <Link href="/dien-nuoc" className={styles.btnActionSecondary}>
              <Zap size={14} /> Chốt điện nước
            </Link>
            <Link href="/hop-dong" className={styles.btnActionSecondary}>
              <FileSignature size={14} /> Lập hợp đồng
            </Link>
            <Link href="/phong" className={styles.btnActionSecondary}>
              <Building2 size={14} /> Quản lý phòng
            </Link>
          </div>
        </section>

        {/* ── 2. CẢNH BÁO YÊU CẦU CỌC TỪ MOBILE (NẾU CÓ) ── */}
        {kpi.pendingHoldCount > 0 && (
          <section className={styles.pendingQueueAlert}>
            <div className={styles.pendingAlertLeft}>
              <div
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Sparkles size={20} />
              </div>
              <div className={styles.pendingAlertText}>
                <h4>Có {kpi.pendingHoldCount} khách đặt cọc qua Mobile App đang chờ ký Hợp đồng!</h4>
                <p>
                  Khách đã chuyển cọc thành công vào tài khoản. Ban Quản Lý chỉ cần bấm xác nhận để tạo hợp đồng và cấp User App.
                </p>
              </div>
            </div>
            <Link href="/hop-dong" className={styles.btnAlertAction}>
              Xem hàng đợi cọc <ArrowRight size={13} style={{ display: "inline", verticalAlign: "middle" }} />
            </Link>
          </section>
        )}

        {/* ── 3. HÀNG THỐNG KÊ TÀI CHÍNH CỐT LÕI (4 KPI CARDS) ── */}
        <section className={styles.financialGrid}>
          {/* Card 1: Thực thu tháng */}
          <article className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Thực thu tháng này</span>
              <div className={styles.kpiIconBox} style={{ background: "#ecfdf5", color: "#059669" }}>
                <Wallet size={20} />
              </div>
            </div>
            <div className={styles.kpiValue} style={{ color: "#047857" }}>
              {formatMoney(kpi.doanhThuThang)}
            </div>
            <div className={styles.kpiFoot}>
              {kpi.doanhThuThangTruoc > 0 ? (
                kpi.chenhLechDoanhThuPct >= 0 ? (
                  <span className={styles.kpiBadgeUp}>
                    +{kpi.chenhLechDoanhThuPct}% so với tháng trước
                  </span>
                ) : (
                  <span className={styles.kpiBadgeDown}>
                    {kpi.chenhLechDoanhThuPct}% so với tháng trước
                  </span>
                )
              ) : (
                <span>Tổng lũy kế: <strong>{formatMoney(kpi.tongThucThu)}</strong></span>
              )}
            </div>
          </article>

          {/* Card 2: Công nợ tồn đọng */}
          <article className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Công nợ còn phải thu</span>
              <div className={styles.kpiIconBox} style={{ background: "#fef2f2", color: "#dc2626" }}>
                <Receipt size={20} />
              </div>
            </div>
            <div className={styles.kpiValue} style={{ color: "#b91c1c" }}>
              {formatMoney(kpi.tongNoTonDong)}
            </div>
            <div className={styles.kpiFoot}>
              <span>
                Nợ tháng này: <strong>{formatMoney(kpi.noThangNay)}</strong> ({unpaidInvoices.length} phòng nợ)
              </span>
            </div>
          </article>

          {/* Card 3: Tỷ lệ thu tiền */}
          <article className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Tỷ lệ thu tiền tháng</span>
              <div className={styles.kpiIconBox} style={{ background: "#eff6ff", color: "#2563eb" }}>
                <Coins size={20} />
              </div>
            </div>
            <div className={styles.kpiValue} style={{ color: "#1d4ed8" }}>
              {kpi.tyLeThuThang}%
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${kpi.tyLeThuThang}%`,
                  background: kpi.tyLeThuThang >= 80 ? "#10b981" : "#f59e0b",
                }}
              />
            </div>
            <div className={styles.kpiFoot}>
              <span>Phát hành: <strong>{formatMoney(kpi.phatHanhThang)}</strong></span>
            </div>
          </article>

          {/* Card 4: Tiền cọc đang giữ */}
          <article className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Tiền cọc lưu ký</span>
              <div className={styles.kpiIconBox} style={{ background: "#faf5ff", color: "#7c3aed" }}>
                <PiggyBank size={20} />
              </div>
            </div>
            <div className={styles.kpiValue} style={{ color: "#6d28d9" }}>
              {formatMoney(kpi.tongTienCoc)}
            </div>
            <div className={styles.kpiFoot}>
              <span>
                Cọc HĐ: <strong>{formatMoney(kpi.tienCocHopDong)}</strong> | Cọc giữ: <strong>{formatMoney(kpi.tienCocGiuCho)}</strong>
              </span>
            </div>
          </article>
        </section>

        {/* ── 4. BIỂU ĐỒ TRỰC QUAN (BAR & DONUT CHARTS) ── */}
        <section className={styles.chartsGrid}>
          {/* Biểu đồ cột 6 tháng */}
          <RevenueTrendBarChart data={monthlyTrend} />

          {/* Biểu đồ tròn cơ cấu thu */}
          <RevenueBreakdownDonut data={revenueBreakdown} />
        </section>

        {/* ── 5. BẢNG HÀNH ĐỘNG TÀI CHÍNH (NỢ TIỀN & GIAO DỊCH GẦN ĐÂY) ── */}
        <section className={styles.tablesGrid}>
          {/* Bảng phòng nợ tiền */}
          <UnpaidInvoicesTable invoices={unpaidInvoices} />

          {/* Bảng phiếu thu gần đây */}
          <RecentReceiptsTable receipts={recentReceipts} />
        </section>

        {/* ── 6. THỐNG KÊ VẬN HÀNH & CƠ SỞ (OPERATIONS HIGHLIGHTS) ── */}
        <section className={styles.operationsRow}>
          <Link href="/phong" className={styles.opCard}>
            <div className={styles.opLeft}>
              <div className={styles.opIcon} style={{ background: "#e0f2fe", color: "#0284c7" }}>
                <DoorOpen size={18} />
              </div>
              <div>
                <div className={styles.opLabel}>Tỷ lệ lấp đầy</div>
                <div className={styles.opValue}>{kpi.tyLeLapDay}%</div>
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: "#64748b" }}>
              {kpi.dangThue}/{kpi.tongPhong} phòng
            </span>
          </Link>

          <Link href="/phong?status=Trong" className={styles.opCard}>
            <div className={styles.opLeft}>
              <div className={styles.opIcon} style={{ background: "#dcfce7", color: "#16a34a" }}>
                <Building2 size={18} />
              </div>
              <div>
                <div className={styles.opLabel}>Phòng trống sẵn có</div>
                <div className={styles.opValue}>{kpi.phongTrong} phòng</div>
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 600 }}>
              Sẵn sàng cho thuê
            </span>
          </Link>

          <Link href="/khach-thue" className={styles.opCard}>
            <div className={styles.opLeft}>
              <div className={styles.opIcon} style={{ background: "#f3e8ff", color: "#9333ea" }}>
                <Users size={18} />
              </div>
              <div>
                <div className={styles.opLabel}>Cư dân đang cư trú</div>
                <div className={styles.opValue}>{kpi.soCuDan} người</div>
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: "#64748b" }}>
              Đại diện &amp; ở cùng
            </span>
          </Link>

          <Link href="/su-co" className={styles.opCard}>
            <div className={styles.opLeft}>
              <div className={styles.opIcon} style={{ background: "#fef3c7", color: "#d97706" }}>
                <TriangleAlert size={18} />
              </div>
              <div>
                <div className={styles.opLabel}>Sự cố kỹ thuật</div>
                <div className={styles.opValue}>{kpi.suCo} yêu cầu</div>
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: kpi.suCo > 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
              {kpi.suCo > 0 ? "Cần thợ sửa" : "Ổn định"}
            </span>
          </Link>
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
