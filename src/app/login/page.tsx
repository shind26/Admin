import Link from "next/link";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata = { title: "Đăng nhập quản trị | Kiêu Giang Boarding" };

const features = [
  {
    title: "Đối soát VietQR & gạch nợ tự động",
    detail: "Tự động đồng bộ tài khoản ngân hàng, thông báo phiếu thu tức thì.",
  },
  {
    title: "Chốt chỉ số điện nước & duyệt ảnh",
    detail:
      "Minh bạch công tơ theo phòng, tự tính biểu phí lũy tiến chính xác.",
  },
  {
    title: "Quản lý sự cố, hợp đồng & cư dân",
    detail:
      "Bảo mật thông tin khách thuê, tự động cảnh báo hợp đồng sắp hết hạn.",
  },
];

export default function LoginPage() {
  return (
    <main className={styles.screen}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandBadge}>KG</span>
          <span className={styles.brandName}>KIÊU GIANG</span>
          <span className={styles.brandDivider}>|</span>
          <span className={styles.brandRole}>
            CỔNG QUẢN TRỊ VIÊN &amp; CHỦ CƠ SỞ
          </span>
        </div>
        <div className={styles.topMeta}>
          <span>
            Hỗ trợ kỹ thuật: <strong>1900 6868</strong>
          </span>
          <span className={styles.statusPill}>
            Hệ thống Supabase v2.4 sẵn sàng
          </span>
        </div>
      </header>

      <div className={styles.pageBody}>
        <div className={styles.loginCard}>
          <section className={styles.leftSide}>
            <div>
              <span className={styles.cardIcon}>KG</span>
              <span className={styles.audienceTag}>
                DÀNH CHO CHỦ TRỌ &amp; BAN QUẢN LÝ
              </span>
              <h1 className={styles.leftTitle}>Cổng Quản Trị Vận Hành</h1>
              <p className={styles.leftText}>
                Hệ thống quản lý nhà trọ hiện đại, kết nối trực tiếp cơ sở dữ
                liệu Supabase đám mây.
              </p>
              {features.map((feature) => (
                <div className={styles.featureBox} key={feature.title}>
                  <h2>{feature.title}</h2>
                  <p>{feature.detail}</p>
                </div>
              ))}
            </div>
            <div className={styles.leftFoot}>
              Mã hóa mật khẩu chuẩn BCrypt • Bảo mật đám mây Supabase
            </div>
          </section>

          <section className={styles.rightSide}>
            <div>
              <h2 className={styles.formTitle}>Đăng nhập Quản trị</h2>
              <p className={styles.formText}>
                Nhập tài khoản được cấp quyền để truy cập hệ thống quản lý cơ sở
              </p>
              <LoginForm />
            </div>
            <footer className={styles.cardFoot}>
              <span>© Kiêu Giang Boarding House Management.</span>
              <span className={styles.cardFootLinks}>
                <Link href="/login">Bảo mật</Link>
                <Link href="/login">Điều khoản</Link>
                <Link href="/login">Hỗ trợ</Link>
              </span>
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
