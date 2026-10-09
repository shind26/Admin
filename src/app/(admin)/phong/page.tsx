import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import {
  ALL_BUILDINGS,
  getBuildings,
  getExpiringContractCount,
  getDashboardStats,
  getRooms,
  getRoomTypes,
  type RoomRow,
} from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { DeleteRoomButton, RoomEditorToggle, RoomForm, type RoomFormData } from "./room-forms";
import styles from "@/components/business.module.css";
import roomStyles from "./rooms.module.css";

type SearchParams = Promise<{
  status?: string;
  keyword?: string;
  building?: string;
}>;

const STATUS_OPTIONS = [
  { value: "All", label: "Tất cả" },
  { value: "DangThue", label: "Đang thuê" },
  { value: "Trong", label: "Trống" },
  { value: "SuaChua", label: "Sửa chữa" },
];

function formatMoney(value: string | null) {
  if (value === null) return "Chưa cập nhật";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function toFormData(room: RoomRow): RoomFormData {
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
  };
}

async function RoomsContent({ searchParams }: { searchParams: SearchParams }) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  // Quản lý tòa luôn bị khóa theo tòa được gán; quản trị viên có thể chọn tòa.
  const building = scope.allBuildings
    ? params.building || ALL_BUILDINGS
    : (scope.building ?? "");
  const status = params.status || "All";
  const keyword = params.keyword || "";

  const [rooms, buildings, roomTypes, stats, sapHetHan] = await Promise.all([
    getRooms({ building, status, keyword, scope: scopeQuery }),
    getBuildings(scopeQuery),
    getRoomTypes(),
    getDashboardStats(building, scopeQuery),
    getExpiringContractCount(building, scopeQuery),
  ]);

  return (
    <AdminShell active="room">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Phòng &amp; hợp đồng</h1>
          <p className={styles.subtitle}>
            {scope.allBuildings
              ? `Quản lý phòng tại ${building || "tất cả cơ sở"}`
              : `Quản lý phòng tại cơ sở ${scope.building}`}
          </p>
        </div>
        <Link href="/hop-dong" className={styles.resetButton}>
          Hợp đồng
        </Link>
      </div>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>+ Thêm phòng mới</summary>
        <RoomForm
          mode="create"
          buildings={buildings}
          roomTypes={roomTypes}
          defaultBuilding={building}
        />
      </details>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng số phòng</div>
          <div className={styles.miniValue}>{stats.tongPhong}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đang thuê</div>
          <div className={`${styles.miniValue} ${styles.ok}`}>
            {stats.dangThue}
          </div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Còn trống</div>
          <div className={`${styles.miniValue} ${styles.info}`}>
            {stats.phongTrong}
          </div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Sắp hết hạn</div>
          <div className={`${styles.miniValue} ${styles.warn}`}>
            {sapHetHan}
          </div>
        </div>
      </section>

      <form className={styles.filterCard} action="/phong">
        <div className={styles.filterField}>
          <label htmlFor="keyword">Tìm phòng hoặc khách thuê</label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="Mã phòng, tên phòng, tên khách"
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="status">Trạng thái</label>
          <select id="status" name="status" defaultValue={status}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="building">Cơ sở</label>
          {scope.allBuildings ? (
            <select id="building" name="building" defaultValue={building}>
              <option value="all">Tất cả cơ sở</option>
              {buildings.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <input id="building" value={scope.building ?? ""} readOnly />
          )}
        </div>
        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Lọc
          </button>
          <Link href="/phong" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Phòng</th>
                <th>Tầng / Loại</th>
                <th>Diện tích</th>
                <th>Giá thuê</th>
                <th>Trạng thái</th>
                <th>Khách thuê</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Không có phòng phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.ma_phong}>
                    <td>
                      <div className={roomStyles.roomName}>
                        {room.ten_hien_thi || room.ma_phong}
                      </div>
                      <div className={roomStyles.roomCode}>{room.ma_phong}</div>
                    </td>
                    <td>
                      <div>
                        {room.tang !== null
                          ? `Tầng ${room.tang}`
                          : "Chưa xếp tầng"}
                      </div>
                      <div className={roomStyles.roomCode}>
                        {room.ten_loai_phong || "Chưa phân loại"}
                      </div>
                    </td>
                    <td>
                      {room.dien_tich !== null ? `${room.dien_tich} m²` : "-"}
                    </td>
                    <td className={roomStyles.money}>
                      {formatMoney(room.gia_thue)}
                    </td>
                    <td>
                      <span
                        className={
                          room.trang_thai === "Đang thuê"
                            ? styles.badgeOk
                            : room.trang_thai === "Sửa chữa"
                              ? styles.badgeWarn
                              : styles.badgeMuted
                        }
                      >
                        {room.trang_thai}
                      </span>
                    </td>
                    <td>{room.khach_thue || "Chưa có hợp đồng"}</td>
                    <td>
                      <div className={styles.actionCell}>
                        <RoomEditorToggle
                          room={toFormData(room)}
                          buildings={buildings}
                          roomTypes={roomTypes}
                          defaultBuilding={building}
                        />
                        <DeleteRoomButton
                          maPhong={room.ma_phong}
                          tenPhong={room.ten_hien_thi || room.ma_phong}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

export default function RoomsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <RoomsContent searchParams={searchParams} />
    </Suspense>
  );
}
