"use client";

import { useState } from "react";
import { Droplets, Home, Pencil, Users, Zap } from "lucide-react";
import type {
  RoomRentalHistoryRow,
  RoomReservationDetail,
  RoomUtilitySummary,
  TenantOption,
} from "@/lib/queries";
import { RoomForm, type RoomFormData } from "../room-forms";
import { RoomRentalHistory } from "./rental-history";
import { RoomUtilitySummaryCard } from "./room-utility-summary";
import { RoomReservationManager } from "./room-reservation";
import styles from "./room-detail.module.css";

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || Number(value) === 0) return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

type RoomDetailTabsProps = {
  room: {
    ma_phong: string;
    ten_hien_thi: string | null;
    tang: number | null;
    dien_tich: number | null;
    gia_thue: string | null;
    tien_dat_coc: string | null;
    trang_thai: string | null;
    toa_nha: string | null;
    ma_loai_phong: string | null;
    ten_loai_phong: string | null;
    mo_ta_ngan: string | null;
    noi_that_san_co: string[] | null;
    loai_phong_tien_ich?: string[] | null;
    chi_so_dien?: string | null;
    chi_so_nuoc?: string | null;
    khach_thue?: string | null;
    ngay_kt?: string | null;
    giu_cho_trang_thai?: string | null;
  };
  rentalHistory: RoomRentalHistoryRow[];
  utilitySummary: RoomUtilitySummary;
  reservation: RoomReservationDetail | null;
  tenants: TenantOption[];
  buildings: string[];
  roomTypes: {
    ma_loai_phong: string;
    ten_loai_phong: string;
    don_gia_co_ban?: string;
    tien_ich?: string[] | null;
  }[];
  editableBuilding: boolean;
  formData: RoomFormData;
  initialTab?: "info" | "tenants" | "utilities" | "edit";
};

export function RoomDetailTabs({
  room,
  rentalHistory,
  utilitySummary,
  reservation,
  tenants,
  buildings,
  roomTypes,
  editableBuilding,
  formData,
  initialTab = "info",
}: RoomDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"info" | "tenants" | "utilities" | "edit">(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);

  if (prevInitialTab !== initialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  return (
    <div className={styles.tabsContainer}>
      {/* ── THANH ĐIỀU HƯỚNG TAB ── */}
      <nav className={styles.tabsNav} aria-label="Các tab chi tiết phòng">
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`${styles.tabBtn} ${activeTab === "info" ? styles.tabBtnActive : ""}`}
        >
          <Home size={15} />
          Thông tin phòng
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tenants")}
          className={`${styles.tabBtn} ${activeTab === "tenants" ? styles.tabBtnActive : ""}`}
        >
          <Users size={15} />
          Khách thuê &amp; Hợp đồng
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("utilities")}
          className={`${styles.tabBtn} ${activeTab === "utilities" ? styles.tabBtnActive : ""}`}
        >
          <Zap size={15} />
          Điện &amp; Nước
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`${styles.tabBtn} ${activeTab === "edit" ? styles.tabBtnActive : ""}`}
        >
          <Pencil size={15} />
          Sửa thông tin phòng
        </button>
      </nav>

      {/* ── TAB 1: THÔNG TIN PHÒNG ── */}
      {activeTab === "info" && (
        <div className={styles.tabContent}>
          {/* Lưới thông số cốt lõi */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Giá thuê niêm yết</div>
              <div className={styles.metricValuePrimary}>{money(room.gia_thue)}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Tiền đặt cọc</div>
              <div className={styles.metricValue}>{money(room.tien_dat_coc)}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Diện tích sử dụng</div>
              <div className={styles.metricValue}>
                {room.dien_tich ? `${room.dien_tich} m²` : "—"}
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Loại phòng</div>
              <div className={styles.metricValueSmall}>
                {room.ten_loai_phong || "Tiêu chuẩn"}
              </div>
            </div>
          </div>

          {/* Nội thất sẵn có (Bàn giao) */}
          <div className={styles.detailCard}>
            <div className={styles.metricLabel}>Nội thất sẵn có (Bàn giao)</div>
            {room.noi_that_san_co && room.noi_that_san_co.length > 0 ? (
              <div className={styles.chipsGrid}>
                {room.noi_that_san_co.map((item) => (
                  <span key={item} className={styles.chipItem}>
                    <span className={styles.chipDot} />
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.chipEmpty}>
                Chưa thiết lập danh mục nội thất sẵn có cho phòng này.
              </p>
            )}
          </div>

          {/* Tiện ích chung kế thừa */}
          <div className={styles.detailCard}>
            <div className={styles.metricLabel}>Tiện ích tòa nhà</div>
            {room.loai_phong_tien_ich && room.loai_phong_tien_ich.length > 0 ? (
              <div className={styles.chipsGrid}>
                {room.loai_phong_tien_ich.map((item) => (
                  <span key={item} className={styles.chipItemAccent}>
                    <span className={styles.chipDotUtility} />
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.chipEmpty}>Loại phòng chưa ghi nhận tiện ích chung.</p>
            )}
          </div>

          {/* Mô tả phòng nếu có */}
          <div className={styles.detailCard}>
            <div className={styles.metricLabel}>Mô tả chi tiết</div>
            <p className={room.mo_ta_ngan ? styles.descriptionText : styles.chipEmpty}>
              {room.mo_ta_ngan || "Chưa có mô tả chi tiết cho phòng này."}
            </p>
          </div>
        </div>
      )}

      {/* ── TAB 2: KHÁCH THUÊ & HỢP ĐỒNG ── */}
      {activeTab === "tenants" && (
        <div className={styles.tabContent}>
          {/* Lịch sử thuê phòng (Đang ở & Quá khứ) */}
          <section className={styles.section}>
            <RoomRentalHistory maPhong={room.ma_phong} history={rentalHistory} />
          </section>

          {/* Quản lý Đặt cọc giữ chỗ & Khóa tạm phòng */}
          {room.trang_thai !== "Đang thuê" && (
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
          )}
        </div>
      )}

      {/* ── TAB 3: ĐIỆN & NƯỚC ── */}
      {activeTab === "utilities" && (
        <div className={styles.tabContent}>
          {/* Chỉ số công tơ hiện tại */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricWithIcon}>
                <div className={styles.iconBoxElectric}>
                  <Zap size={18} />
                </div>
                <div>
                  <div className={styles.metricLabel}>Chỉ số điện hiện tại</div>
                  <div className={styles.metricValuePrimary}>
                    {room.chi_so_dien
                      ? `${Number(room.chi_so_dien).toLocaleString("vi-VN")} kWh`
                      : "0 kWh"}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricWithIcon}>
                <div className={styles.iconBoxWater}>
                  <Droplets size={18} />
                </div>
                <div>
                  <div className={styles.metricLabel}>Chỉ số nước hiện tại</div>
                  <div className={styles.metricValuePrimary}>
                    {room.chi_so_nuoc
                      ? `${Number(room.chi_so_nuoc).toLocaleString("vi-VN")} m³`
                      : "0 m³"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bảng tổng hợp hóa đơn & tiêu thụ điện nước các tháng */}
          <section className={styles.section}>
            <RoomUtilitySummaryCard maPhong={room.ma_phong} summary={utilitySummary} />
          </section>
        </div>
      )}

      {/* ── TAB 4: SỬA THÔNG TIN PHÒNG ── */}
      {activeTab === "edit" && (
        <div className={styles.tabContent}>
          <section className={styles.section} style={{ padding: "18px 22px" }}>
            <div style={{ marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <h2 className={styles.sectionTitle} style={{ margin: 0, fontSize: 16 }}>
                Chỉnh sửa phòng {room.ten_hien_thi || room.ma_phong}
              </h2>
            </div>
            <RoomForm
              mode="edit"
              room={formData}
              buildings={buildings}
              roomTypes={roomTypes}
              defaultBuilding={room.toa_nha ?? ""}
              editableBuilding={editableBuilding}
            />
          </section>
        </div>
      )}
    </div>
  );
}
