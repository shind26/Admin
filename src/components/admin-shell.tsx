import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Zap,
  Wrench,
  LogOut,
  DoorOpen,
  KeyRound,
} from "lucide-react";
import { requireAccount } from "@/lib/session";
import { logout } from "@/app/login/actions";
import styles from "./admin-shell.module.css";

const menuGroups = [
  {
    label: "VẬN HÀNH CHÍNH",
    items: [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard, match: "home" },
      {
        href: "/phong",
        label: "Phòng",
        icon: DoorOpen,
        match: "room",
      },
      {
        href: "/hop-dong",
        label: "Hợp đồng",
        icon: Building2,
        match: "invoice",
      },
      {
        href: "/hoa-don",
        label: "Hóa đơn",
        icon: FileText,
        match: "invoice",
      },
      {
        href: "/phieu-thu",
        label: "Phiếu thu",
        icon: FileText,
        match: "invoice",
      },
      {
        href: "/khach-thue",
        label: "Khách thuê & Tạm trú",
        icon: Users,
        match: "tenant",
      },
    ],
  },
  {
    label: "TIỆN ÍCH & KỸ THUẬT",
    items: [
      {
        href: "/dien-nuoc",
        label: "Điện nước & Công tơ",
        icon: Zap,
        match: "meter",
      },
      {
        href: "/su-co",
        label: "Sự cố & Sửa chữa",
        icon: Wrench,
        match: "maintenance",
      },
      {
        href: "/doi-mat-khau",
        label: "Đổi mật khẩu",
        icon: KeyRound,
        match: "account",
      },
    ],
  },
];

async function SidebarUser() {
  const account = await requireAccount();
  const displayName =
    account.ho_ten || account.ten_dang_nhap || account.ma_tai_khoan;
  return (
    <div className={styles.userBox}>
      <span className={styles.userAvatar}>
        {displayName.slice(0, 1).toUpperCase()}
        <i className={styles.userDot} aria-hidden="true" />
      </span>
      <div className={styles.userMeta}>
        <div className={styles.userName}>{displayName}</div>
        <div className={styles.userRole}>
          Chủ cơ sở • {account.co_so_van_hanh}
        </div>
      </div>
    </div>
  );
}

async function TopBanner() {
  const account = await requireAccount();
  const displayName =
    account.ho_ten || account.ten_dang_nhap || account.ma_tai_khoan;
  return (
    <div className={styles.topBanner}>
      <div>
        <span className={styles.connectionPill}>
          Tòa Kiêu Giang • Supabase Connected
        </span>
        <h1 className={styles.bannerTitle}>
          Bảng điều khiển Quản trị Vận hành
        </h1>
        <p className={styles.bannerText}>
          Chào mừng trở lại, <strong>{displayName}</strong> — Chúc bạn một ngày
          làm việc hiệu quả.
        </p>
      </div>
      <form action={logout}>
        <button type="submit" className={styles.logoutButton}>
          <LogOut size={14} /> Đăng xuất
        </button>
      </form>
    </div>
  );
}

export function AdminShell({
  active,
  children,
}: {
  active: ActiveKey;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>KG</span>
          <div>
            <div className={styles.brandName}>Kiêu Giang</div>
            <div className={styles.brandSub}>Boarding Management</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {menuGroups.map((group) => (
            <div key={group.label}>
              <span className={styles.menuLabel}>{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.match === active ? styles.navActive : styles.navLink
                  }
                >
                  <item.icon size={16} /> {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <Suspense fallback={null}>
          <SidebarUser />
        </Suspense>
      </aside>

      <div className={styles.main}>
        <Suspense
          fallback={<div className={styles.bannerSkeleton} aria-busy="true" />}
        >
          <TopBanner />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

export type ActiveKey =
  | "home"
  | "room"
  | "invoice"
  | "tenant"
  | "meter"
  | "maintenance"
  | "account";
