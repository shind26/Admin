import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ImageOff } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import {
  getBuildings,
  getRoomDetail,
  getRoomRentalHistory,
  getRoomTypes,
  getRoomUtilitySummary,
  getActiveRoomReservation,
  getTenantOptions,
} from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { requireScope } from "@/lib/session";
import type { RoomFormData } from "../room-forms";
import { DeleteRoomDetailButton, EditRoomButton } from "./detail-actions";
import { RoomRentalHistory } from "./rental-history";
import { RoomUtilitySummaryCard } from "./room-utility-summary";
import { RoomReservationManager } from "./room-reservation";
import styles from "./room-detail.module.css";

type Params = Promise<{ maPhong: string }>;

function money(value: string | null) {
  if (value === null) return "Chưa cập nhật";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function date(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function text(value: string | number | null) {
  if (value === null || value === "") return "—";
  return String(value);
}

function badgeTone(
  status: string | null,
  hasIssue: boolean,
) {
  if (hasIssue) return styles.badgeDanger;
  switch (status) {
    case "Trống":
      return styles.badgeOk;
    case "Đang thuê":
      return styles.badgeInfo;
    case "Đã đặt cọc":
    case "Đã cọc":
      return styles.badgeWarn;
    default:
      return styles.badgeMuted;
  }
}

function toForm(room: {
  ma_phong: string;
  ten_hien_thi: string | null;
  tang: number | null;
  dien_tich: number | null;
  gia_thue: string | null;
  trang_thai: string | null;
  toa_nha: string | null;
  ma_loai_phong: string | null;
  mo_ta_ngan: string | null;
  tien_dat_coc: string | null;
  noi_that_san_co: string[] | null;
  hinh_anh: string | null;
  chi_so_dien?: string | null;
  chi_so_nuoc?: string | null;
}): RoomFormData {
  return {
    maPhong: room.ma_phong,
    tenHienThi: room.ten_hien_thi ?? "",
    tang: room.tang,
    dienTich: room.dien_tich,
    giaThue: room.gia_thue,
    trangThai: room.trang_thai ?? "Trống",
    toaNha: room.toa_nha ?? "",
    maLoaiPhong: room.ma_loai_phong ?? "",
    moTaNgan: room.mo_ta_ngan ?? "",
    tienDatCoc: room.tien_dat_coc,
    noiThat: (room.noi_that_san_co ?? []).join("\n"),
    hinhAnh: room.hinh_anh ?? "",
    chiSoDien: room.chi_so_dien ?? "0",
    chiSoNuoc: room.chi_so_nuoc ?? "0",
  };
}

async function RoomDetailContent({ params }: { params: Params }) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const { maPhong } = await params;

  const [
    room,
    buildings,
    roomTypes,
    rentalHistory,
    utilitySummary,
    reservation,
    tenants,
  ] = await Promise.all([
    getRoomDetail(decodeURIComponent(maPhong), scopeQuery),
    getBuildings(scopeQuery),
    getRoomTypes(),
    getRoomRentalHistory(decodeURIComponent(maPhong), scopeQuery),
    getRoomUtilitySummary(decodeURIComponent(maPhong), scopeQuery),
    getActiveRoomReservation(decodeURIComponent(maPhong)),
    getTenantOptions(scopeQuery),
  ]);

  if (!room) {
    return (
      <AdminShell active="room">
        <div className={styles.backRow}>
          <Link href="/phong" className={styles.backLink}>
            <ArrowLeft size={15} /> Quay lại danh sách phòng
          </Link>
        </div>
        <section className={styles.section}>
          <p className={styles.warning}>
            Không tìm thấy phòng này, hoặc phòng thuộc cơ sở bạn không có quyền
            truy cập.
          </p>
        </section>
      </AdminShell>
    );
  }

  const remaining = room.ngay_kt
    ? Math.round(
        (new Date(room.ngay_kt).setHours(0, 0, 0, 0) -
          new Date().setHours(0, 0, 0, 0)) /
          86_400_000,
      )
    : null;
  const badgeText = room.su_co_dang_mo
    ? `Sửa ${room.su_co_dang_mo.toLowerCase()}`
    : room.trang_thai === "Đã đặt cọc" && room.giu_cho_trang_thai === "ChoThanhToan"
      ? "Khóa 15p (QR)"
      : (room.trang_thai ?? "—");

  return (
    <AdminShell active="room">
      <div className={styles.backRow}>
        <Link href="/phong" className={styles.backLink}>
          <ArrowLeft size={15} /> Quay lại danh sách phòng
        </Link>
      </div>

      <div className={styles.layout}>
        {/* ── Cột ảnh ── */}
        <div className={styles.photoPanel}>
          <div className={styles.photoFrame}>
            {room.hinh_anh ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={room.hinh_anh}
                alt={`Ảnh phòng ${room.ma_phong}`}
                className={styles.photo}
              />
            ) : (
              <div className={styles.photoEmpty}>
                <ImageOff size={26} />
                <span>Phòng chưa có ảnh</span>
              </div>
            )}
          </div>
          <div className={styles.photoActions}>
            <EditRoomButton
              room={toForm(room)}
              buildings={buildings}
              roomTypes={roomTypes}
              editableBuilding={scope.allBuildings}
            />
          </div>
        </div>

        {/* ── Cột thông tin ── */}
        <div className={styles.infoPanel}>
          <div className={styles.headCard}>
            <div>
              <h1 className={styles.roomCode}>
                {room.ten_hien_thi || room.ma_phong}
              </h1>
              <p className={styles.roomSub}>
                {room.ma_phong} • {text(room.toa_nha)}
                {room.tang !== null ? ` • Tầng ${room.tang}` : ""} •{" "}
                {text(room.ten_loai_phong)}
              </p>
            </div>
            <div className={styles.actions}>
              <span
                className={`${styles.badge} ${badgeTone(
                  room.trang_thai,
                  room.su_co_dang_mo !== null,
                )}`}
              >
                {badgeText}
              </span>
              <DeleteRoomDetailButton
                maPhong={room.ma_phong}
                tenPhong={room.ten_hien_thi || room.ma_phong}
              />
            </div>
          </div>

          {/* Quản lý Đặt cọc giữ chỗ & Khóa tạm phòng */}
          <RoomReservationManager
            maPhong={room.ma_phong}
            tenPhong={room.ten_hien_thi || room.ma_phong}
            trangThaiPhong={room.trang_thai ?? "Trống"}
            giaThueNiemYet={room.gia_thue}
            tienDatCocNiemYet={room.tien_dat_coc}
            reservation={reservation}
            tenants={tenants}
            noiThatSanCo={room.noi_that_san_co}
          />

          {room.su_co_dang_mo && (
            <p className={styles.warning}>
              Phòng đang có sự cố chưa xử lý: {room.su_co_dang_mo}
            </p>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Thông tin cơ bản</h2>
            <dl className={styles.grid}>
              <div className={styles.field}>
                <dt>Diện tích</dt>
                <dd>{room.dien_tich ? `${room.dien_tich} m²` : "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>Giá thuê niêm yết</dt>
                <dd>{money(room.gia_thue)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Tiền đặt cọc</dt>
                <dd>{money(room.tien_dat_coc)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Trạng thái</dt>
                <dd>{text(room.trang_thai)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Công tơ điện hiện tại</dt>
                <dd style={{ color: "#2563eb", fontWeight: 700 }}>
                  {room.chi_so_dien ? `${Number(room.chi_so_dien).toLocaleString("vi-VN")} kWh` : "0 kWh"}
                </dd>
              </div>
              <div className={styles.field}>
                <dt>Đồng hồ nước hiện tại</dt>
                <dd style={{ color: "#0284c7", fontWeight: 700 }}>
                  {room.chi_so_nuoc ? `${Number(room.chi_so_nuoc).toLocaleString("vi-VN")} m³` : "0 m³"}
                </dd>
              </div>
            </dl>
          </section>

          <section className={styles.section}>
            <RoomRentalHistory maPhong={room.ma_phong} history={rentalHistory} />
          </section>

          <section className={styles.section}>
            <RoomUtilitySummaryCard maPhong={room.ma_phong} summary={utilitySummary} />
          </section>



          <section className={styles.section}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                Nội thất sẵn có (Bàn giao)
              </h2>
              <span
                style={{
                  fontSize: 11.5,
                  color: "#0f766e",
                  fontWeight: 600,
                  background: "#ccfbf1",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                {room.noi_that_san_co?.length ?? 0} món
              </span>
            </div>
            {room.noi_that_san_co && room.noi_that_san_co.length > 0 ? (
              <div className={styles.chips}>
                {room.noi_that_san_co.map((item) => (
                  <span
                    key={item}
                    className={styles.chip}
                    style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}
                  >
                    🛋️ {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.chipEmpty}>Chưa thiết lập danh mục nội thất sẵn có cho phòng này.</p>
            )}
          </section>

          <section className={styles.section}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                Tiện ích chung
              </h2>
              <span
                style={{
                  fontSize: 11.5,
                  color: "#4f46e5",
                  fontWeight: 600,
                  background: "#eef2ff",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                Theo loại phòng {room.ten_loai_phong || ""}
              </span>
            </div>
            {room.loai_phong_tien_ich && room.loai_phong_tien_ich.length > 0 ? (
              <div className={styles.chips}>
                {room.loai_phong_tien_ich.map((item) => (
                  <span key={item} className={styles.chip}>
                    ✦ {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.chipEmpty}>Loại phòng chưa ghi nhận tiện ích chung.</p>
            )}
          </section>

          {room.mo_ta_ngan && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Mô tả</h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  color: "#334155",
                  lineHeight: 1.7,
                }}
              >
                {room.mo_ta_ngan}
              </p>
            </section>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

export default function RoomDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <RoomDetailContent params={params} />
    </Suspense>
  );
}
