"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, User } from "lucide-react";
import type { RoomRentalHistoryRow } from "@/lib/queries";
import styles from "./rental-history.module.css";

function formatMoney(value: string | number | null | undefined): string {
  if (!value || Number(value) === 0) return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function calculateDuration(startStr: string | null, endStr: string | null): string {
  if (!startStr) return "";
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / 86400000);
  if (diffDays <= 0) return "1 ngày";

  const months = Math.round((diffDays / 30.4375) * 10) / 10;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remMonths = Math.round(months % 12);
    if (remMonths === 0) return `${years} năm`;
    return `${years} năm ${remMonths} tháng`;
  }
  if (months >= 1) {
    return `${Math.round(months)} tháng`;
  }
  return `${diffDays} ngày`;
}

function isContractActive(item: RoomRentalHistoryRow): boolean {
  if (item.trang_thai === "Còn hạn" || item.trang_thai === "Đang thuê") {
    if (!item.ngay_kt) return true;
    const end = new Date(item.ngay_kt).setHours(23, 59, 59, 999);
    return end >= Date.now();
  }
  return false;
}

type TabKey = "all" | "active" | "ended";

export function RoomRentalHistory({
  maPhong,
  history,
}: {
  maPhong: string;
  history: RoomRentalHistoryRow[];
}) {
  const [tab, setTab] = useState<TabKey>("all");

  const activeContracts = history.filter((c) => isContractActive(c));
  const endedContracts = history.filter((c) => !isContractActive(c));

  const filtered =
    tab === "active"
      ? activeContracts
      : tab === "ended"
        ? endedContracts
        : history;

  return (
    <div className={styles.container}>
      {/* ── Tiêu đề & Bộ lọc ── */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>
            Lịch sử các hợp đồng thuê
            <span className={styles.countBadge}>{history.length} hợp đồng</span>
          </h2>
        </div>

        {history.length > 1 && (
          <div className={styles.tabsRow}>
            <button
              type="button"
              className={`${styles.tabBtn} ${tab === "all" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("all")}
            >
              Tất cả ({history.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${tab === "active" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("active")}
            >
              Đang ở ({activeContracts.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${tab === "ended" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("ended")}
            >
              Đã kết thúc ({endedContracts.length})
            </button>
          </div>
        )}
      </div>

      {/* ── Danh sách hợp đồng ── */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p>
            {tab === "active"
              ? "Phòng hiện không có hợp đồng thuê nào đang hoạt động."
              : tab === "ended"
                ? "Chưa có hợp đồng nào đã kết thúc."
                : `Phòng ${maPhong} chưa có dữ liệu hợp đồng.`}
          </p>
        </div>
      ) : (
        <div className={styles.contractList}>
          {filtered.map((item) => {
            const active = isContractActive(item);
            const duration = calculateDuration(item.ngay_bd, item.ngay_kt);

            return (
              <div
                key={item.ma_hop_dong}
                className={`${styles.card} ${active ? styles.cardActive : ""}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.tenantInfo}>
                    <div className={styles.tenantAvatar}>
                      <User size={18} />
                    </div>
                    <div>
                      <div className={styles.tenantName}>
                        {item.ho_ten_khach || "Chưa cập nhật tên"}
                      </div>
                      <div className={styles.tenantMetaText}>
                        SĐT: {item.so_dt || "—"} {item.cccd ? ` • CCCD: ${item.cccd}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className={styles.headerBadges}>
                    <span
                      className={`${styles.badge} ${
                        active
                          ? styles.badgeOk
                          : item.trang_thai === "Đã đặt cọc"
                            ? styles.badgeInfo
                            : styles.badgeMuted
                      }`}
                    >
                      {active ? "Đang thuê" : item.trang_thai || "Đã kết thúc"}
                    </span>
                    <Link
                      href={`/hop-dong/${encodeURIComponent(item.ma_hop_dong)}`}
                      className={styles.contractLink}
                    >
                      <FileText size={13} /> #{item.ma_hop_dong}
                    </Link>
                  </div>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Thời hạn hợp đồng</span>
                    <span className={styles.fieldValue}>
                      {formatDate(item.ngay_bd)} – {formatDate(item.ngay_kt)}
                      {duration && <span className={styles.durationTag}>{duration}</span>}
                    </span>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Giá thuê</span>
                    <span className={styles.fieldValue}>{formatMoney(item.gia_thue)} / tháng</span>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Tiền đặt cọc</span>
                    <span className={styles.fieldValue}>{formatMoney(item.tien_dat_coc)}</span>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Số người ở</span>
                    <span className={styles.fieldValue}>
                      {item.so_nguoi_o ? `${item.so_nguoi_o} người` : "1 người"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
