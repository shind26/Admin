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
} from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import {
  CreateRoomModal,
  DeleteRoomButton,
  RoomEditorToggle,
  RoomForm,
  type RoomFormData,
} from "./room-forms";
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

function roomStatusClass(status: string | null) {
  if (status === "Đang thuê") return styles.badgeInfo;
  if (status === "Trống") return styles.badgeOk;
  if (status === "Đã đặt cọc" || status === "Đã cọc") return styles.badgeWarn;
  return styles.badgeMuted;
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

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                                <th style={{ whiteSpace: "nowrap" }}>Phòng</th>
                <th style={{ whiteSpace: "nowrap" }}>Cơ sở / Tầng</th>
                <th style={{ whiteSpace: "nowrap" }}>Loại phòng</th>
                <th style={{ whiteSpace: "nowrap" }}>Diện tích</th>
                <th style={{ whiteSpace: "nowrap" }}>Khách thuê</th>
                <th style={{ whiteSpace: "nowrap" }}>Giá niêm yết</th>
                <th style={{ whiteSpace: "nowrap" }}>Tiền cọc</th>
                <th style={{ whiteSpace: "nowrap" }}>Trạng thái</th>
                <th style={{ whiteSpace: "nowrap" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    Không có phòng phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                rooms.map((room) => {
                  const roomFormData: RoomFormData = {
                    maPhong: room.ma_phong,
                    tenHienThi: room.ten_hien_thi ?? room.ma_phong,
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
                    chiSoDien: room.chi_so_dien,
                    chiSoNuoc: room.chi_so_nuoc,
                  };

                  return (
                    <tr key={room.ma_phong}>
                      <td>
                        <Link
                          href={`/phong/${encodeURIComponent(room.ma_phong)}`}
                          className={styles.strong}
                          style={{ color: "#1877f2", textDecoration: "none", fontWeight: 700 }}
                        >
                          {room.ten_hien_thi || room.ma_phong}
                        </Link>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {room.toa_nha || "—"}
                        {room.tang !== null ? ` • Tầng ${room.tang}` : ""}
                      </td>
                      <td>{room.ten_loai_phong || "Tiêu chuẩn"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{room.dien_tich ? `${room.dien_tich} m²` : "—"}</td>
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
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{formatMoney(room.gia_thue)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatMoney(room.tien_dat_coc)}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          <span className={roomStatusClass(room.trang_thai)}>
                            {room.trang_thai ?? "—"}
                          </span>
                          {room.su_co_dang_mo && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                background: "#fee2e2",
                                color: "#991b1b",
                                border: "1px solid #fecaca",
                                borderRadius: 4,
                                padding: "2px 6px",
                                fontSize: 11,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Sự cố: {room.su_co_dang_mo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div className={styles.actionCell} style={{ flexWrap: "nowrap" }}>
                          <Link
                            href={`/phong/${encodeURIComponent(room.ma_phong)}`}
                            className={styles.linkButton}
                          >
                            Chi tiết
                          </Link>
                          <RoomEditorToggle
                            room={roomFormData}
                            buildings={buildings}
                            roomTypes={roomTypes}
                            defaultBuilding={room.toa_nha || defaultBuildingName}
                            editableBuilding={scope.allBuildings}
                          />
                          {isAdmin && (
                            <DeleteRoomButton
                              maPhong={room.ma_phong}
                              tenPhong={room.ten_hien_thi || room.ma_phong}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
