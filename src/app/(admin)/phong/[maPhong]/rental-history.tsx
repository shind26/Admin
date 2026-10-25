"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  History,
  Phone,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
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

function getInitials(name: string | null): string {
  if (!name) return "K";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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
    <section className={styles.container}>
      {/* ── Tiêu đề & Thống kê ── */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>
            <History size={16} /> Lịch sử thuê phòng (Rental History)
            <span className={styles.countBadge}>
              {history.length} lượt thuê
            </span>
          </h2>
          <p className={styles.subTitle}>
            Dòng thời gian các hợp đồng, khách thuê đại diện và giá thuê qua từng thời kỳ của phòng{" "}
            <strong>{maPhong}</strong>.
          </p>
        </div>

        {/* ── Bộ lọc theo trạng thái ── */}
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
      </div>

      {/* ── Dòng thời gian Timeline ── */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Clock size={28} style={{ opacity: 0.5 }} />
          <p>
            {tab === "active"
              ? "Phòng hiện tại không có hợp đồng nào đang hiệu lực."
              : tab === "ended"
                ? "Chưa có hợp đồng cũ nào đã thanh lý hoặc hết hạn."
                : `Phòng ${maPhong} chưa từng có lịch sử hợp đồng nào được lưu trong hệ thống.`}
          </p>
          <Link href="/hop-dong" className={styles.btnNewContract}>
            <FileText size={13} /> Tạo hợp đồng thuê cho phòng này
          </Link>
        </div>
      ) : (
        <div className={styles.timeline}>
          {filtered.map((item) => {
            const active = isContractActive(item);
            const duration = calculateDuration(item.ngay_bd, item.ngay_kt);

            return (
              <div key={item.ma_hop_dong} className={styles.timelineItem}>
                {/* Node biểu tượng trên trục timeline */}
                <div
                  className={`${styles.timelineDot} ${
                    active
                      ? styles.timelineDotActive
                      : item.trang_thai === "Đã đặt cọc"
                        ? styles.timelineDotPending
                        : styles.timelineDotEnded
                  }`}
                  title={active ? "Hợp đồng đang hiệu lực" : "Hợp đồng đã kết thúc"}
                >
                  {active ? (
                    <CheckCircle2 size={14} />
                  ) : item.trang_thai === "Đã đặt cọc" ? (
                    <Clock size={14} />
                  ) : (
                    <History size={13} />
                  )}
                </div>

                {/* Card thông tin hợp đồng */}
                <div className={`${styles.card} ${active ? styles.cardActive : ""}`}>
                  <header className={styles.cardHeader}>
                    <div className={styles.tenantInfo}>
                      <div
                        className={`${styles.tenantAvatar} ${
                          active ? styles.tenantAvatarActive : ""
                        }`}
                      >
                        {getInitials(item.ho_ten_khach)}
                      </div>
                      <div className={styles.tenantNameGroup}>
                        <div className={styles.tenantName}>
                          {item.ho_ten_khach || "Khách thuê chưa cập nhật"}
                        </div>
                        <div className={styles.tenantRole}>
                          Bên B (Đại diện thuê) {item.so_dt ? `• ${item.so_dt}` : ""}
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
                        {active ? "Đang ở (Hiện tại)" : item.trang_thai || "Đã kết thúc"}
                      </span>
                      <Link
                        href={`/hop-dong/${encodeURIComponent(item.ma_hop_dong)}`}
                        className={styles.contractCode}
                        title="Xem hợp đồng chi tiết"
                      >
                        #{item.ma_hop_dong}
                      </Link>
                    </div>
                  </header>

                  {/* Lưới chi tiết thời gian & tài chính */}
                  <div className={styles.infoGrid}>
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        <Calendar size={12} /> Thời hạn thuê
                      </span>
                      <span className={styles.fieldValue}>
                        {formatDate(item.ngay_bd)} – {formatDate(item.ngay_kt)}
                        {duration && <span className={styles.durationTag}>{duration}</span>}
                      </span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Giá thuê lúc ký</span>
                      <span className={`${styles.fieldValue} ${styles.priceCol}`}>
                        {formatMoney(item.gia_thue)} / tháng
                      </span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Tiền đặt cọc</span>
                      <span className={styles.fieldValue}>{formatMoney(item.tien_dat_coc)}</span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        <Users size={12} /> Số người lưu trú
                      </span>
                      <span className={styles.fieldValue}>
                        {item.so_nguoi_o > 0 ? `${item.so_nguoi_o} người` : "1 người"}
                      </span>
                    </div>

                    {item.so_dt && (
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>
                          <Phone size={12} /> Số điện thoại
                        </span>
                        <span className={styles.fieldValue}>
                          <a
                            href={`tel:${item.so_dt}`}
                            style={{ color: "inherit", textDecoration: "none" }}
                          >
                            {item.so_dt}
                          </a>
                        </span>
                      </div>
                    )}

                    {item.cccd && (
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>
                          <ShieldCheck size={12} /> CCCD / Định danh
                        </span>
                        <span className={styles.fieldValue}>{item.cccd}</span>
                      </div>
                    )}
                  </div>

                  {/* Chân card với link chi tiết */}
                  <footer className={styles.cardFooter}>
                    <span style={{ color: "#64748b", fontSize: 11.5 }}>
                      {item.ngay_ky ? `Ký ngày ${formatDate(item.ngay_ky)}` : "Hợp đồng chuẩn"}
                      {item.chu_ky_thu_tien ? ` • Chu kỳ thu: ${item.chu_ky_thu_tien} tháng/lần` : ""}
                    </span>
                    <Link
                      href={`/hop-dong/${encodeURIComponent(item.ma_hop_dong)}`}
                      className={styles.linkDetail}
                    >
                      Xem chi tiết hợp đồng <ExternalLink size={12} />
                    </Link>
                  </footer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

