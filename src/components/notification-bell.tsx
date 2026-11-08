"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { NotificationItem } from "@/app/api/notifications/route";
import styles from "./notification-bell.module.css";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 330;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) left = 16;

      setPos({
        top: rect.bottom + 8,
        left,
      });
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/notifications", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) setItems(data.items || []); })
      .catch(() => {});
    const interval = setInterval(fetchNotifications, 60000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (open) {
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const total = items.length;

  const popoverContent = open ? (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
      }}
      role="dialog"
      aria-label="Danh sách thông báo"
    >
      <div className={styles.popoverHeader}>
        <h4 className={styles.headerTitle}>Thông báo</h4>
      </div>

      <div className={styles.itemList}>
        {items.length === 0 ? (
          <div className={styles.emptyBox}>Không có thông báo mới</div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.link}
              className={styles.itemRow}
              onClick={() => setOpen(false)}
            >
              <div className={styles.itemTop}>
                <span className={styles.itemTitle}>{item.title}</span>
                {item.time && (
                  <span className={styles.itemTime}>
                    {formatRelativeTime(item.time)}
                  </span>
                )}
              </div>
              <div className={styles.itemDesc}>{item.description}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.bellContainer}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.bellButton} ${open ? styles.bellActive : ""}`}
        onClick={() => {
          if (!open) updatePosition();
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        title="Thông báo"
        aria-label="Thông báo"
        aria-expanded={open}
      >
        <Bell size={17} />
        {total > 0 && <span className={styles.badge}>{total > 99 ? "99+" : total}</span>}
      </button>

      {popoverContent && typeof document !== "undefined" ? createPortal(popoverContent, document.body) : null}
    </div>
  );
}
