import Link from "next/link";
import type { RoomRow } from "@/lib/queries";
import styles from "./rooms.module.css";

/** Số ngày còn lại của hợp đồng, tính từ hôm nay. */
function daysLeft(ngayKt: string | null): number | null {
  if (!ngayKt) return null;
  const end = new Date(ngayKt);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

function formatMoney(value: string | null) {
  if (value === null) return "Chưa cập nhật";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

type Badge = {
  text: string;
  tone: "ok" | "warn" | "danger" | "muted" | "info";
};

const BADGE_TONE: Record<Badge["tone"], string> = {
  ok: styles.badgeToneOk,
  warn: styles.badgeToneWarn,
  danger: styles.badgeToneDanger,
  muted: styles.badgeToneMuted,
  info: styles.badgeToneInfo,
};

/**
 * Badge phản ánh chính xác trạng thái phòng trong quản lý phòng:
 * Trống | Đang thuê | Đã đặt cọc | Đang bảo trì.
 * Ưu tiên sự cố chưa xử lý nếu phòng đang gặp sự cố.
 */
function badgeFor(room: RoomRow): Badge {
  if (room.su_co_dang_mo) {
    return { text: `Sửa ${room.su_co_dang_mo.toLowerCase()}`, tone: "danger" };
  }

  switch (room.trang_thai) {
    case "Trống":
      return { text: "Trống", tone: "ok" };
    case "Đang thuê":
      return { text: "Đang thuê", tone: "info" };
    case "Đã đặt cọc":
    case "Đã cọc":
      if (
        room.giu_cho_trang_thai === "ChoThanhToan" ||
        room.giu_cho_trang_thai === "Chờ thanh toán"
      ) {
        return { text: "Khóa 15p (QR)", tone: "warn" };
      }
      return { text: "Đã đặt cọc", tone: "warn" };
    case "Đang bảo trì":
      return { text: "Đang bảo trì", tone: "muted" };
    default:
      return { text: room.trang_thai ?? "—", tone: "muted" };
  }
}

/** Thông tin chính hiển thị trên thẻ theo trạng thái phòng. */
function detailsFor(room: RoomRow): { label: string; value: string }[] {
  const remaining = daysLeft(room.ngay_kt);
  const hanHopDongText = room.ngay_kt
    ? remaining !== null && remaining <= 30
      ? remaining <= 0
        ? `${formatDate(room.ngay_kt)} (Hết hạn)`
        : `${formatDate(room.ngay_kt)} (Còn ${remaining} ngày)`
      : formatDate(room.ngay_kt)
    : "—";

  switch (room.trang_thai) {
    case "Đang thuê":
      return [
        { label: "Khách đại diện", value: room.khach_thue || "—" },
        { label: "Giá thuê", value: formatMoney(room.gia_thue) },
        { label: "Hạn hợp đồng", value: hanHopDongText },
      ];
    case "Đang bảo trì":
      return [
        { label: "Tình trạng", value: room.su_co_dang_mo || "Đang bảo trì" },
        {
          label: "Diện tích",
          value: room.dien_tich ? `${room.dien_tich} m²` : "—",
        },
        { label: "Giá niêm yết", value: formatMoney(room.gia_thue) },
      ];
    case "Đã đặt cọc":
    case "Đã cọc":
      return [
        { label: "Khách đặt cọc", value: room.khach_thue || "—" },
        { label: "Tiền cọc", value: formatMoney(room.tien_dat_coc) },
        { label: "Ngày dự kiến", value: formatDate(room.ngay_kt) },
      ];
    default:
      return [
        {
          label: "Diện tích",
          value: room.dien_tich ? `${room.dien_tich} m²` : "—",
        },
        { label: "Giá niêm yết", value: formatMoney(room.gia_thue) },
        { label: "Tiền cọc", value: formatMoney(room.tien_dat_coc) },
      ];
  }
}

export function RoomCard({ room }: { room: RoomRow }) {
  const badge = badgeFor(room);
  const details = detailsFor(room);

  return (
    <Link
      href={`/phong/${encodeURIComponent(room.ma_phong)}`}
      className={styles.roomCard}
    >
      <div className={styles.roomCardHead}>
        <div>
          <div className={styles.roomCardCode}>
            {room.ten_hien_thi || room.ma_phong}
          </div>
          <div className={styles.roomCardSub}>
            {room.ten_loai_phong || "Chưa phân loại"}
            {room.dien_tich ? ` • ${room.dien_tich}m²` : ""}
          </div>
        </div>
        <span className={`${styles.roomCardBadge} ${BADGE_TONE[badge.tone]}`}>
          {badge.text}
        </span>
      </div>

      <dl className={styles.roomCardDetails}>
        {details.map((item) => (
          <div key={item.label} className={styles.roomCardDetailRow}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div className={styles.roomCardDetailRow} style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 4, marginTop: 4 }}>
          <dt style={{ color: "#64748b" }}>Số công tơ</dt>
          <dd style={{ fontWeight: 600, color: "#1e293b", fontSize: 12 }}>
            ⚡ {room.chi_so_dien ? Number(room.chi_so_dien).toLocaleString("vi-VN") : 0} | 💧 {room.chi_so_nuoc ? Number(room.chi_so_nuoc).toLocaleString("vi-VN") : 0}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
