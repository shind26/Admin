import Link from "next/link";
import { Suspense } from "react";
import { DoorOpen, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import { getDashboardStats } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import styles from "./dashboard.module.css";

async function DashboardContent() {
  const { account, scope } = await requireScope();
  const stats = await getDashboardStats(null, new ScopeQuery(scope));
  const displayName = account.ho_ten || account.ten_dang_nhap || "Quản trị viên";

  return (
    <AdminShell active="home">
      <section className={styles.statsGrid}>
        <article className={styles.statCard}>
          <div className={styles.statHead}>
            <span className={styles.statLabel}>Tổng số phòng</span>
            <span className={styles.statIcon}>
              <DoorOpen size={18} />
            </span>
          </div>
          <div className={styles.statValue}>{stats.tongPhong} phòng</div>
          <div className={styles.statFoot}>
            <span className={styles.ok}>Quy mô cơ sở</span> |{" "}
            <span>Hệ thống ổn định</span>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statHead}>
            <span className={styles.statLabel}>Tỷ lệ lấp đầy</span>
            <span className={styles.statIcon}>
              <KeyRound size={18} />
            </span>
          </div>
          <div className={styles.statValue}>
            {stats.tyLeLapDay}%{" "}
            <span className={styles.statInline}>
              {stats.dangThue} đang thuê
            </span>
          </div>
          <div className={styles.statFoot}>
            Còn trống{" "}
            <span className={styles.danger}>{stats.phongTrong} phòng</span>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statHead}>
            <span className={styles.statLabel}>Sự cố kỹ thuật</span>
            <span className={`${styles.statIcon} ${styles.warnIcon}`}>
              <TriangleAlert size={18} />
            </span>
          </div>
          <div className={styles.statValue}>{stats.suCo} yêu cầu</div>
          <div className={styles.statFoot}>Cần xử lý bảo trì</div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statHead}>
            <span className={styles.statLabel}>Bảo mật tài khoản</span>
            <span className={`${styles.statIcon} ${styles.safeIcon}`}>
              <ShieldCheck size={18} />
            </span>
          </div>
          <div className={`${styles.statValue} ${styles.ok}`}>Đã bảo vệ</div>
          <div className={styles.statFoot}>Mật khẩu riêng đã kích hoạt</div>
        </article>
      </section>

      <section className={styles.readyCard}>
        <ShieldCheck size={44} className={styles.readyIcon} />
        <h2>Hệ thống Quản lý Nhà trọ Kiêu Giang đã sẵn sàng!</h2>
        <p>
          Bạn đã đăng nhập thành công với tài khoản{" "}
          <strong>{displayName}</strong> tại cơ sở{" "}
          <strong>{account.co_so_van_hanh}</strong>. Bạn có thể bắt đầu quản lý
          phòng, khách thuê, hợp đồng và các nghiệp vụ vận hành tiếp theo.
        </p>
        <div className={styles.readyActions}>
          <Link href="/phong" className={styles.primaryButton}>
            Quản lý phòng &amp; hợp đồng
          </Link>
          <Link href="/doi-mat-khau" className={styles.secondaryButton}>
            Đổi mật khẩu
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
