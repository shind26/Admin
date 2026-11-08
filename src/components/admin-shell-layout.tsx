"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import styles from "./admin-shell.module.css";

type AdminShellLayoutProps = {
  sidebarContent: ReactNode;
  userContent: ReactNode;
  bellContent: ReactNode;
  children: ReactNode;
};

export function AdminShellLayout({
  sidebarContent,
  userContent,
  bellContent,
  children,
}: AdminShellLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Tự động đóng menu khi chuyển trang
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  // Khóa scroll màn hình khi mở menu mobile
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Đóng khi nhấn phím Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={styles.shell}>
      {/* ── THANH ĐIỀU HƯỚNG TRÊN CÙNG CHO MOBILE / TABLET (<1024px) ── */}
      <header className={`${styles.mobileHeader} noPrint`} data-no-print="true">
        <button
          type="button"
          className={styles.hamburgerBtn}
          onClick={() => setDrawerOpen((prev) => !prev)}
          aria-label={drawerOpen ? "Đóng danh mục" : "Mở danh mục quản trị"}
          aria-expanded={drawerOpen}
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className={styles.mobileBrand}>
          <span className={styles.brandMark}>KG</span>
          <span className={styles.mobileBrandText}>Kiêu Giang</span>
        </div>

        <div className={styles.mobileHeaderActions}>
          <ThemeToggle compact />
          {bellContent}
        </div>
      </header>

      {/* ── LỚP MÀN PHỦ CHO MOBILE DRAWER ── */}
      {drawerOpen && (
        <div
          className={`${styles.drawerBackdrop} noPrint`}
          data-no-print="true"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR (DESKTOP) & DRAWER (MOBILE) ── */}
      <aside
        className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""} noPrint`}
        data-no-print="true"
      >
        <div className={styles.brand}>
          <div className={styles.brandInfo}>
            <span className={styles.brandMark}>KG</span>
            <div className={styles.brandTitles}>
              <div className={styles.brandName}>Kiêu Giang</div>
              <div className={styles.brandSub}>Quản lý nhà trọ</div>
            </div>
          </div>
          <div className={styles.brandActions}>
            <ThemeToggle compact />
          </div>
        </div>

        <div className={styles.navContainer} onClick={() => setDrawerOpen(false)}>
          {sidebarContent}
        </div>

        <div className={styles.userSection}>
          {userContent}
        </div>
      </aside>

      {/* ── NỘI DUNG CHÍNH CỦA TRANG ── */}
      <main className={styles.main}>
        <div className={styles.mainContentInner}>
          {children}
        </div>
      </main>
    </div>
  );
}
