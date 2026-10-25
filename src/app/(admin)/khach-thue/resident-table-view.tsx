"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Eye,
  Smartphone,
  ShieldCheck,
  Car,
  DoorOpen,
  UserCheck,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import type { TenantRow, VehicleRow, TenantContractHistoryRow } from "@/lib/queries";
import { getResidentDetails } from "./actions";
import { ResidentDrawer } from "./resident-drawer";
import { TenantEditorToggle, DeleteTenantButton, type TenantFormData } from "./tenant-forms";
import styles from "@/components/business.module.css";

export function ResidentTableView({ tenants }: { tenants: TenantRow[] }) {
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);
  const [residentVehicles, setResidentVehicles] = useState<VehicleRow[]>([]);
  const [residentContracts, setResidentContracts] = useState<TenantContractHistoryRow[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleOpenResident = (tenant: TenantRow) => {
    setLoadingDetails(tenant.ma_khach);
    startTransition(async () => {
      const details = await getResidentDetails(tenant.ma_khach);
      setResidentVehicles(details.vehicles);
      setResidentContracts(details.contracts);
      setSelectedTenant(tenant);
      setLoadingDetails(null);
    });
  };

  return (
    <>
      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cư dân &amp; Vai trò</th>
                <th>Liên hệ &amp; CCCD</th>
                <th>Phòng hiện tại</th>
                <th>Tài khoản App</th>
                <th>eKYC &amp; Xe</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Không tìm thấy hồ sơ cư dân phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.ma_khach}>
                    {/* Cư dân & Vai trò */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background:
                              t.trang_thai_cu_dan === "DangO"
                                ? "linear-gradient(135deg, #4f46e5, #4338ca)"
                                : t.trang_thai_cu_dan === "CuuCuDan"
                                ? "#64748b"
                                : "#e2e8f0",
                            color: t.trang_thai_cu_dan === "ChuaThue" ? "#475569" : "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 15,
                            flexShrink: 0,
                          }}
                        >
                          {(t.ho_ten_khach || "K")[0].toUpperCase()}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#1e293b",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                            onClick={() => handleOpenResident(t)}
                            title="Bấm để xem hồ sơ chi tiết"
                          >
                            <span>{t.ho_ten_khach}</span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                              marginTop: 2,
                            }}
                          >
                            <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                              {t.ma_khach}
                            </span>
                            {t.vai_tro_phong && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background:
                                    t.vai_tro_phong === "Đại diện HĐ"
                                      ? "#e0e7ff"
                                      : t.vai_tro_phong === "Người ở cùng"
                                      ? "#f0fdf4"
                                      : "#f1f5f9",
                                  color:
                                    t.vai_tro_phong === "Đại diện HĐ"
                                      ? "#3730a3"
                                      : t.vai_tro_phong === "Người ở cùng"
                                      ? "#166534"
                                      : "#475569",
                                }}
                              >
                                {t.vai_tro_phong}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Liên hệ & CCCD */}
                    <td>
                      <div style={{ fontWeight: 600, color: "#1e293b" }}>{t.so_dt}</div>
                      <div style={{ fontSize: 11.5, color: "#64748b" }}>CCCD: {t.cccd}</div>
                    </td>

                    {/* Phòng hiện tại */}
                    <td>
                      {t.ma_phong_hien_tai ? (
                        <Link
                          href={`/phong/${t.ma_phong_hien_tai}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#ecfdf5",
                            color: "#065f46",
                            border: "1px solid #a7f3d0",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          <DoorOpen size={13} /> {t.ma_phong_hien_tai}
                        </Link>
                      ) : t.trang_thai_cu_dan === "CuuCuDan" ? (
                        <span style={{ fontSize: 12, color: "#64748b" }}>Cựu cư dân</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có phòng</span>
                      )}
                    </td>

                    {/* Tài khoản Mobile App */}
                    <td>
                      {t.ma_tai_khoan ? (
                        <div>
                          {!t.da_doi_mat_khau ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: "#fffbeb",
                                color: "#92400e",
                                border: "1px solid #fde68a",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              <Smartphone size={11} /> Chờ đổi MK
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: "#ecfdf5",
                                color: "#065f46",
                                border: "1px solid #a7f3d0",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              <UserCheck size={11} /> Đã kích hoạt
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Chưa cấp App</span>
                      )}
                    </td>

                    {/* eKYC & Xe */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div>
                          {t.trang_thai_ekyc === "DaXacThuc" ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#059669",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <ShieldCheck size={12} /> eKYC duyệt
                            </span>
                          ) : t.trang_thai_ekyc === "ChoDuyet" ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#d97706",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <AlertCircle size={12} /> Chờ duyệt ảnh
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>Chưa eKYC</span>
                          )}
                        </div>
                        {t.so_phuong_tien > 0 && (
                          <div
                            style={{
                              fontSize: 11,
                              color: t.so_xe_cho_duyet > 0 ? "#d97706" : "#4f46e5",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontWeight: 600,
                            }}
                          >
                            <Car size={11} /> {t.so_phuong_tien} xe
                            {t.so_xe_cho_duyet > 0 && (
                              <span
                                style={{
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  padding: "0 4px",
                                  borderRadius: 4,
                                  fontSize: 10,
                                }}
                              >
                                ({t.so_xe_cho_duyet} chờ duyệt)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Thao tác */}
                    <td>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenResident(t)}
                          disabled={loadingDetails === t.ma_khach}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "5px 10px",
                            borderRadius: 6,
                            border: "1px solid #c7d2fe",
                            background: "#eef2ff",
                            color: "#4338ca",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {loadingDetails === t.ma_khach ? (
                            <LoaderCircle
                              size={13}
                              style={{ animation: "spin 1s linear infinite" }}
                            />
                          ) : (
                            <Eye size={13} />
                          )}
                          Hồ sơ
                        </button>

                        <TenantEditorToggle
                          tenant={{
                            maKhach: t.ma_khach,
                            hoTenKhach: t.ho_ten_khach ?? "",
                            soDt: t.so_dt ?? "",
                            cccd: t.cccd ?? "",
                            diaChiThuongTru: t.dia_chi_thuong_tru ?? "",
                            ngaySinh: t.ngay_sinh,
                            gioiTinh: t.gioi_tinh,
                            ngayCapCccd: t.ngay_cap_cccd,
                            noiCapCccd: t.noi_cap_cccd,
                            tenNguoiThan: t.nguoi_lien_he_khan_cap?.ho_ten ?? "",
                            sdtNguoiThan: t.nguoi_lien_he_khan_cap?.so_dt ?? "",
                            moiQuanHe: t.nguoi_lien_he_khan_cap?.moi_quan_he ?? "",
                            ghiChuNoiBo: t.ghi_chu_noi_bo ?? "",
                          }}
                        />

                        <DeleteTenantButton
                          maKhach={t.ma_khach}
                          hoTen={t.ho_ten_khach ?? t.ma_khach}
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

      {/* Drawer hồ sơ chi tiết */}
      {selectedTenant && (
        <ResidentDrawer
          tenant={selectedTenant}
          vehicles={residentVehicles}
          contracts={residentContracts}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </>
  );
}

