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
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { requireAccount } from "@/lib/session";
import { logout } from "@/app/login/actions";
import styles from "./admin-shell.module.css";

const menuGroups = [
  {
    label: "VẬN HÀNH CHÍNH",
    items: [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard, match: "home" as const },
      {
        href: "/phong",
        label: "Phòng",
        icon: DoorOpen,
        match: "room" as const,
      },
      {
        href: "/hop-dong",
        label: "Hợp đồng",
        icon: Building2,
        match: "contract" as const,
      },
      {
        href: "/hoa-don",
        label: "Hóa đơn",
        icon: FileText,
        match: "invoice" as const,
      },
      {
        href: "/phieu-thu",
        label: "Phiếu thu",
        icon: FileText,
        match: "receipt" as const,
      },
      {
        href: "/khach-thue",
        label: "Khách thuê & Tạm trú",
        icon: Users,
        match: "tenant" as const,
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
        match: "meter" as const,
      },
      {
        href: "/su-co",
        label: "Sự cố & Sửa chữa",
        icon: Wrench,
        match: "maintenance" as const,
      },
      {
        href: "/dich-vu",
        label: "Cài đặt dịch vụ",
        icon: Receipt,
        match: "service" as const,
      },
      {
        href: "/doi-mat-khau",
        label: "Đổi mật khẩu",
        icon: KeyRound,
        match: "password" as const,
      },
    ],
  },
];

/** Nhóm chỉ dành cho chủ trọ (Admin): quản lý tài khoản nhân viên. */
const adminOnlyGroup = {
  label: "QUẢN TRỊ HỆ THỐNG",
  items: [
    {
      href: "/tai-khoan",
      label: "Quản lý tài khoản",
      icon: ShieldCheck,
      match: "account" as const,
    },
  ],
};

/** Menu điều hướng; nhóm quản trị hệ thống chỉ hiện với chủ trọ (Admin). */
async function SidebarNav({ active }: { active: ActiveKey }) {
  const account = await requireAccount();
  const groups =
    account.vai_tro === "Admin" ? [...menuGroups, adminOnlyGroup] : menuGroups;

  return (
    <nav className={styles.nav}>
      {groups.map((group) => (
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
  );
}

async function SidebarUser() {
  const account = await requireAccount();
  const displayName =
    account.ho_ten || account.ten_dang_nhap || account.ma_tai_khoan;
  const roleLabel = account.vai_tro === "Admin" ? "Chủ cơ sở" : "Quản lý";

  return (
    <div className={styles.userBox}>
      <span className={styles.userAvatar}>
        {displayName.slice(0, 1).toUpperCase()}
        <i className={styles.userDot} aria-hidden="true" />
      </span>
      <div className={styles.userMeta}>
        <div className={styles.userName} title={displayName}>
          {displayName}
        </div>
        <div className={styles.userRole}>
          {roleLabel} • {account.co_so_van_hanh}
        </div>
      </div>
      <form action={logout} className={styles.logoutForm}>
        <button
          type="submit"
          className={styles.sidebarLogoutBtn}
          title="Đăng xuất"
          aria-label="Đăng xuất"
        >
          <LogOut size={15} />
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
      <aside className={`${styles.sidebar} noPrint`} data-no-print="true">
        <div className={styles.brand}>
          <span className={styles.brandMark}>KG</span>
          <div>
            <div className={styles.brandName}>Kiêu Giang</div>
            <div className={styles.brandSub}>Boarding Management</div>
          </div>
        </div>

        <Suspense fallback={<div className={`${styles.navSkeleton} noPrint`} aria-busy="true" />}>
          <SidebarNav active={active} />
        </Suspense>

        <Suspense fallback={null}>
          <SidebarUser />
        </Suspense>
      </aside>

      <div className={styles.main}>{children}</div>
    </div>
  );
}

export type ActiveKey =
  | "home"
  | "room"
  | "contract"
  | "invoice"
  | "receipt"
  | "tenant"
  | "meter"
  | "maintenance"
  | "service"
  | "password"
  | "account";
