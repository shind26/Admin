"use client";

import { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";
import styles from "./theme-toggle.module.css";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Hệ thống", icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const CurrentIcon =
    theme === "system"
      ? Monitor
      : resolvedTheme === "dark"
      ? Moon
      : Sun;

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={compact ? styles.buttonCompact : styles.button}
        onClick={() => setOpen((prev) => !prev)}
        title={`Giao diện: ${theme === "system" ? "Tự động" : theme === "dark" ? "Tối" : "Sáng"}`}
        aria-label="Chọn chế độ giao diện sáng hoặc tối"
        aria-expanded={open}
      >
        <CurrentIcon size={15} />
        {!compact && (
          <span className={styles.label}>
            {theme === "system" ? "Tự động" : theme === "dark" ? "Tối" : "Sáng"}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                className={active ? styles.menuItemActive : styles.menuItem}
                onClick={() => {
                  setTheme(opt.value);
                  setOpen(false);
                }}
              >
                <Icon size={14} />
                <span>{opt.label}</span>
                {active && <span className={styles.indicator} aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
