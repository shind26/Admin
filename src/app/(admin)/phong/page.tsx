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
import {
  CreateRoomModal,
  DeleteRoomButton,
  RoomForm,
} from "./room-forms";
import { RoomTableRow } from "./room-table-row";
import styles from "@/components/business.module.css";

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

function formatMoney(value: string | number | null) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("vi-VN")}\u00A0đ`;
}

function RoomStatusIndicator({
  status,
  issue,
}: {
  status: string | null;
  issue: string | null;
}) {
  let dotColor = "var(--text-muted)";
  if (status === "Đang thuê") dotColor = "var(--primary)";
  else if (status === "Trống") dotColor = "#10b981";
  else if (status === "Đã đặt cọc" || status === "Đã cọc") dotColor = "#f59e0b";
  else if (status === "Đang bảo trì" || status === "Sửa chữa") dotColor = "#ef4444";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          fontWeight: 500,
          color: "var(--text-main)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: dotColor,
            flexShrink: 0,
          }}
        />
        {status ?? "—"}
      </span>
      {issue && (
        <span
          style={{
            fontSize: 11,
            color: "var(--status-danger-text)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Sự cố: {issue}
        </span>
      )}
    </div>
  );
}

type BuildingRoomGroup = {
  building: string;
  rooms: RoomRow[];
  total: number;
  rented: number;
  empty: number;
  deposit: number;
  issues: number;
};

function groupRoomsByBuilding(rooms: RoomRow[]): BuildingRoomGroup[] {
  const map = new Map<string, RoomRow[]>();

  for (const room of rooms) {
    const key = room.toa_nha || "Chưa phân cơ sở";
    const list = map.get(key) ?? [];
    list.push(room);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .map(([building, groupRooms]) => ({
      building,
      rooms: groupRooms,
      total: groupRooms.length,
      rented: groupRooms.filter((r) => r.trang_thai === "Đang thuê").length,
      empty: groupRooms.filter((r) => r.trang_thai === "Trống").length,
      deposit: groupRooms.filter(
        (r) => r.trang_thai === "Đã đặt cọc" || r.trang_thai === "Đã cọc",
      ).length,
      issues: groupRooms.filter((r) => r.su_co_dang_mo !== null).length,
    }));
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

  const buildingGroups = groupRoomsByBuilding(rooms);

  const defaultBuildingName =
    building !== ALL_BUILDINGS && building ? building : (buildings[0] ?? "Tòa A");

  return (
    <AdminShell active="room">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Quản lý phòng</h1>
          <p className={styles.subtitle}>
            {scope.allBuildings
              ? `Danh sách phòng tại ${building === ALL_BUILDINGS ? "tất cả cơ sở" : building}`
              : `Danh sách phòng tại cơ sở ${scope.building}`}
          </p>
        </div>
        {isAdmin && (
          <CreateRoomModal
            buildings={buildings}
            roomTypes={roomTypes}
            defaultBuilding={defaultBuildingName}
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
            defaultBuilding={defaultBuildingName}
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
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Không có phòng phù hợp với bộ lọc.
          </div>
        </div>
      ) : (
        buildingGroups.map((group) => (
          <section key={group.building} style={{ marginBottom: 28 }}>
            {/* Header thông tin tòa nhà */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                padding: "11px 16px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderBottom: "none",
                borderTopLeftRadius: "var(--radius-md)",
                borderTopRightRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: "var(--text-main)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {group.building}
                </h2>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    padding: "2px 7px",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-muted)",
                  }}
                >
                  {group.total} phòng
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <span>
                  <strong style={{ color: "var(--text-main)", fontWeight: 600 }}>
                    {group.rented}
                  </strong>{" "}
                  đang thuê
                </span>
                <span>
                  <strong style={{ color: "var(--text-main)", fontWeight: 600 }}>
                    {group.empty}
                  </strong>{" "}
                  trống
                </span>
                {group.deposit > 0 && (
                  <span>
                    <strong style={{ color: "var(--text-main)", fontWeight: 600 }}>
                      {group.deposit}
                    </strong>{" "}
                    đã cọc
                  </span>
                )}
                {group.issues > 0 && (
                  <span style={{ color: "var(--status-danger-text)", fontWeight: 600 }}>
                    {group.issues} sự cố
                  </span>
                )}
              </div>
            </div>

            {/* Bảng danh sách phòng của tòa */}
            <div
              className={styles.tableCard}
              style={{
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                marginTop: 0,
              }}
            >
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: "nowrap" }}>Phòng</th>
                      <th style={{ whiteSpace: "nowrap" }}>Tầng</th>
                      <th style={{ whiteSpace: "nowrap" }}>Loại phòng</th>
                      <th style={{ whiteSpace: "nowrap" }}>Diện tích</th>
                      <th style={{ whiteSpace: "nowrap" }}>Khách thuê</th>
                      <th style={{ whiteSpace: "nowrap" }}>Giá niêm yết</th>
                      <th style={{ whiteSpace: "nowrap" }}>Tiền cọc</th>
                      <th style={{ whiteSpace: "nowrap" }}>Trạng thái</th>
                      <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rooms.map((room) => (
                      <RoomTableRow key={room.ma_phong} maPhong={room.ma_phong}>
                        <td>
                          <span
                            className={styles.strong}
                            style={{ color: "var(--primary)", fontWeight: 700 }}
                          >
                            {room.ten_hien_thi || room.ma_phong}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {room.tang !== null ? `Tầng ${room.tang}` : "—"}
                        </td>
                        <td>{room.ten_loai_phong || "Tiêu chuẩn"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {room.dien_tich ? `${room.dien_tich} m²` : "—"}
                        </td>
                        <td>
                          {room.khach_thue ? (
                            <div>
                              <div className={styles.strong}>{room.khach_thue}</div>
                              {room.ma_hop_dong && (
                                <div className={styles.muted} style={{ fontSize: 11 }}>
                                  {room.ma_hop_dong}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={styles.muted}>Trống</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                          {formatMoney(room.gia_thue)}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatMoney(room.tien_dat_coc)}
                        </td>
                        <td>
                          <RoomStatusIndicator
                            status={room.trang_thai}
                            issue={room.su_co_dang_mo}
                          />
                        </td>
                        <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                          <div
                            className={styles.actionCell}
                            style={{ justifyContent: "flex-end" }}
                          >
                            <Link
                              href={`/phong/${encodeURIComponent(room.ma_phong)}?tab=edit`}
                              className={styles.linkButton}
                            >
                              Sửa
                            </Link>
                            {isAdmin && (
                              <DeleteRoomButton
                                maPhong={room.ma_phong}
                                tenPhong={room.ten_hien_thi || room.ma_phong}
                              />
                            )}
                          </div>
                        </td>
                      </RoomTableRow>
                    ))}
                  </tbody>
                </table>
              </div>
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
