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
import { DeleteRoomDetailButton } from "./detail-actions";
import { RoomDetailTabs } from "./room-detail-tabs";
import styles from "./room-detail.module.css";

type Params = Promise<{ maPhong: string }>;
type SearchParams = Promise<{ tab?: string }>;

function text(value: string | number | null) {
  if (value === null || value === "") return "—";
  return String(value);
}

function badgeTone(status: string | null, hasIssue: boolean) {
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
  moTaNgan?: string | null;
  mo_ta_ngan?: string | null;
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

async function RoomDetailContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const { maPhong } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const tabParam = resolvedSearchParams?.tab;
  const initialTab =
    tabParam === "edit" || tabParam === "tenants" || tabParam === "utilities"
      ? tabParam
      : "info";

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

  const badgeText = room.su_co_dang_mo
    ? `Sự cố: ${room.su_co_dang_mo}`
    : room.trang_thai === "Đã đặt cọc" && room.giu_cho_trang_thai === "ChoThanhToan"
      ? "Chờ thanh toán cọc"
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
        </div>

        {/* ── Cột thông tin ── */}
        <div className={styles.infoPanel}>
          <div className={styles.headCard}>
            <div>
              <h1 className={styles.roomCode}>
                {(room.ten_hien_thi || room.ma_phong).replace(/\s*•\s*/g, "  ")}
              </h1>
              <div className={styles.roomSub}>
                <span>Mã phòng: {room.ma_phong}</span>
                <span>Cơ sở: {text(room.toa_nha)}</span>
                {room.tang !== null && <span>Tầng {room.tang}</span>}
                <span>Loại: {text(room.ten_loai_phong)}</span>
              </div>
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

          {room.su_co_dang_mo && (
            <p className={styles.warning}>
              Phòng đang có sự cố cần xử lý: {room.su_co_dang_mo}
            </p>
          )}

          {/* ── Các Tab Chi Tiết & Chỉnh Sửa Phòng ── */}
          <RoomDetailTabs
            room={room}
            rentalHistory={rentalHistory}
            utilitySummary={utilitySummary}
            reservation={reservation}
            tenants={tenants}
            buildings={buildings}
            roomTypes={roomTypes}
            editableBuilding={scope.allBuildings}
            formData={toForm(room)}
            initialTab={initialTab}
          />
        </div>
      </div>
    </AdminShell>
  );
}

export default function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <RoomDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
