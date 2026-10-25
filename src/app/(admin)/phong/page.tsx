import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { requireScope } from "@/lib/session";
import {
  ALL_BUILDINGS,
  getBuildings,
  getDashboardStats,
  getRooms,
  getRoomTypes,
  type RoomRow,
} from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { RoomCard } from "./room-card";
import { CreateRoomModal, RoomForm } from "./room-forms";
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
  { value: "SuaChua", label: "Đang bảo trì" },
  { value: "DaCoc", label: "Đã đặt cọc" },
];

type FloorGroup = {
  key: string;
  label: string;
  /** Mô tả phụ dưới tiêu đề tầng: số phòng đang thuê và sự cố đang mở. */
  meta: string;
  summary: string;
  rooms: RoomRow[];
};

/**
 * Nhóm phòng theo tòa rồi theo tầng để hiển thị dạng phân tầng.
 * Mỗi nhóm kèm dòng thống kê "N phòng - M phòng trống".
 */
function groupByFloor(rooms: RoomRow[], multipleBuildings: boolean): FloorGroup[] {
  const groups = new Map<string, FloorGroup>();

  for (const room of rooms) {
    const building = room.toa_nha || "Chưa phân tòa";
    const floor = room.tang;
    const key = `${building}|${floor ?? "none"}`;

    if (!groups.has(key)) {
      const floorLabel =
        floor === null ? "Chưa xếp tầng" : `Tầng ${floor}`;
      groups.set(key, {
        key,
        label: multipleBuildings ? `${building} • ${floorLabel}` : floorLabel,
        meta: "",
        summary: "",
        rooms: [],
      });
    }
    groups.get(key)!.rooms.push(room);
  }

  const result = [...groups.values()];
  for (const group of result) {
    const empty = group.rooms.filter((r) => r.trang_thai === "Trống").length;
    group.summary = `${group.rooms.length} phòng • ${empty} phòng trống`;

    const rented = group.rooms.filter((r) => r.trang_thai === "Đang thuê").length;
    const issues = group.rooms.filter((r) => r.su_co_dang_mo !== null).length;
    const parts: string[] = [];
    if (rented > 0) parts.push(`${rented} đang thuê`);
    if (issues > 0) parts.push(`${issues} sự cố mở`);
    group.meta = parts.length > 0 ? parts.join(" • ") : "Không có sự cố";
  }

  return result;
}

async function RoomsContent({ searchParams }: { searchParams: SearchParams }) {
  const { account, scope } = await requireScope();
  const isAdmin = account.vai_tro === "Admin";
  const scopeQuery = new ScopeQuery(scope);
  const params = await searchParams;
  // Quản lý tòa luôn bị khóa theo tòa được gán; quản trị viên có thể chọn tòa để xem.
  const building = scope.allBuildings
    ? params.building || ALL_BUILDINGS
    : (scope.building ?? "");

  const status = params.status || "All";
  const keyword = params.keyword || "";

  const [rooms, buildings, stats, roomTypes] = await Promise.all([
    getRooms({ building, status, keyword, scope: scopeQuery }),
    getBuildings(scopeQuery),
    getDashboardStats(building, scopeQuery),
    getRoomTypes(),
  ]);
  // Khi xem nhiều tòa, tiêu đề nhóm ghi kèm tên tòa để không lẫn tầng giữa các tòa.
  const floorGroups = groupByFloor(rooms, building === ALL_BUILDINGS && buildings.length > 1);

  return (
    <AdminShell active="room">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Quản lý phòng</h1>
          <p className={styles.subtitle}>
            {scope.allBuildings
              ? `Quản lý phòng tại ${building || "tất cả cơ sở"}`
              : `Quản lý phòng tại cơ sở ${scope.building}`}
          </p>
        </div>
        {isAdmin && (
          <CreateRoomModal
            buildings={buildings}
            roomTypes={roomTypes}
            defaultBuilding={building === ALL_BUILDINGS ? buildings[0] ?? "" : building}
            editableBuilding={scope.allBuildings}
          />
        )}
      </div>

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
          <div className={styles.miniLabel}>Đã đặt cọc</div>
          <div className={`${styles.miniValue} ${styles.warn}`}>
            {stats.daDatCoc}
          </div>
        </div>
      </section>

      {isAdmin && (
        <details className={styles.createBox}>
          <summary className={styles.createSummary}>+ Thêm phòng mới</summary>
          <RoomForm
            mode="create"
            buildings={buildings}
            roomTypes={roomTypes}
            defaultBuilding={
              building !== ALL_BUILDINGS && building
                ? building
                : (buildings[0] ?? "Tòa A")
            }
            editableBuilding={true}
          />
        </details>
      )}

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

      {rooms.length === 0 ? (
        <div className={styles.tableCard}>
          <p className={styles.empty}>Không có phòng phù hợp với bộ lọc.</p>
        </div>
      ) : (
        floorGroups.map((group) => (
          <section key={group.key} className={roomStyles.floorSection}>
            <header className={roomStyles.floorHeader}>
              <div>
                <div className={roomStyles.floorTitle}>{group.label}</div>
                <div className={roomStyles.floorMeta}>{group.meta}</div>
              </div>
              <span className={roomStyles.floorSummary}>{group.summary}</span>
            </header>
            <div className={roomStyles.cardGrid}>
              {group.rooms.map((room) => (
                <RoomCard key={room.ma_phong} room={room} />
              ))}
            </div>
          </section>
        ))
      )}
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
