import styles from "./admin-skeleton.module.css";

/**
 * Khung chờ cho các trang trong khu quản trị.
 * Dựng sẵn bố cục (tiêu đề, dải thẻ số liệu, bảng) để khi dữ liệu về trang
 * không nhảy layout, thay cho một dòng chữ trống giữa màn hình.
 */
export function AdminPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.wrap} aria-busy="true">
      <span className={styles.srOnly}>Đang tải dữ liệu…</span>

      <div className={styles.head}>
        <span className={`${styles.bar} ${styles.title}`} />
        <span className={`${styles.bar} ${styles.subtitle}`} />
      </div>

      <div className={styles.statRow}>
        {[0, 1, 2].map((index) => (
          <div className={styles.statCard} key={index}>
            <span className={`${styles.bar} ${styles.statLabel}`} />
            <span className={`${styles.bar} ${styles.statValue}`} />
          </div>
        ))}
      </div>

      <div className={styles.panel}>
        {Array.from({ length: rows }, (_, index) => (
          <div className={styles.row} key={index}>
            <span className={`${styles.bar} ${styles.cellWide}`} />
            <span className={`${styles.bar} ${styles.cell}`} />
            <span className={`${styles.bar} ${styles.cell}`} />
            <span className={`${styles.bar} ${styles.cellShort}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
