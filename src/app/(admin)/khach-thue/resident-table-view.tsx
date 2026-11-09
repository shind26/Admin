"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type {
  TenantRow,
  VehicleRow,
  TenantContractHistoryRow,
} from "@/lib/queries";
import { getResidentDetails } from "./actions";
import { ResidentDrawer } from "./resident-drawer";
import { TenantEditorToggle, DeleteTenantButton } from "./tenant-forms";
import styles from "@/components/business.module.css";

export function ResidentTableView({ tenants }: { tenants: TenantRow[] }) {
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);
  const [residentVehicles, setResidentVehicles] = useState<VehicleRow[]>([]);
  const [residentContracts, setResidentContracts] = useState<
    TenantContractHistoryRow[]
  >([]);
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
                <th>Khách thuê &amp; Vai trò</th>
                <th>Liên hệ</th>
                <th>CCCD</th>
                <th>Phòng hiện tại</th>
                <th>Tài khoản App</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Không tìm thấy hồ sơ khách thuê phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.ma_khach}>
                    {/* Cư dân & Vai trò */}
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background:
                              t.trang_thai_cu_dan === "DangO"
                                ? "linear-gradient(135deg, var(--primary), var(--primary))"
                                : t.trang_thai_cu_dan === "CuuCuDan"
                                  ? "var(--text-muted)"
                                  : "var(--border)",
                            color:
                              t.trang_thai_cu_dan === "ChuaThue"
                                ? "var(--text-muted)"
                                : "var(--bg-surface)",
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
                              color: "var(--text-main)",
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
                            {t.vai_tro_phong && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background:
                                    t.vai_tro_phong === "Đại diện HĐ"
                                      ? "var(--primary-subtle)"
                                      : t.vai_tro_phong === "Người ở cùng"
                                        ? "var(--status-success-bg)"
                                        : "var(--bg-subtle)",
                                  color:
                                    t.vai_tro_phong === "Đại diện HĐ"
                                      ? "var(--primary)"
                                      : t.vai_tro_phong === "Người ở cùng"
                                        ? "var(--status-success-text)"
                                        : "var(--text-muted)",
                                }}
                              >
                                {t.vai_tro_phong}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Liên hệ */}
                    <td>
                      <div
                        style={{ fontWeight: 600, color: "var(--text-main)" }}
                      >
                        {t.so_dt}
                      </div>
                    </td>

                    {/* CCCD */}
                    <td style={{ color: "var(--text-main)", fontWeight: 600 }}>
                      {t.cccd || ""}
                    </td>

                    {/* Phòng hiện tại */}
                    <td style={{ color: "var(--text-main)" }}>
                      {t.ma_phong_hien_tai ? (
                        <Link
                          href={`/phong/${t.ma_phong_hien_tai}`}
                          style={{
                            color: "inherit",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {t.ma_phong_hien_tai}
                        </Link>
                      ) : t.trang_thai_cu_dan === "CuuCuDan" ? (
                        "Cựu cư dân"
                      ) : (
                        "Chưa có phòng"
                      )}
                    </td>

                    {/* Tài khoản Mobile App */}
                    <td style={{ color: "var(--text-main)" }}>
                      {t.ma_tai_khoan && (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            background: t.da_doi_mat_khau
                              ? "var(--primary-subtle)"
                              : "var(--status-warning-bg)",
                            color: t.da_doi_mat_khau
                              ? "var(--primary)"
                              : "var(--status-warning-text)",
                            border: `1px solid ${t.da_doi_mat_khau
                              ? "var(--border-strong)"
                              : "var(--status-warning-border)"}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.da_doi_mat_khau ? "Đã kích hoạt" : "Chờ đổi mật khẩu"}
                        </span>
                      )}
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
                            border: "1px solid var(--primary-subtle)",
                            background: "var(--primary-subtle)",
                            color: "var(--primary)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {loadingDetails === t.ma_khach && (
                            <LoaderCircle
                              size={13}
                              style={{ animation: "spin 1s linear infinite" }}
                            />
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
                            tenNguoiThan:
                              t.nguoi_lien_he_khan_cap?.ho_ten ?? "",
                            sdtNguoiThan: t.nguoi_lien_he_khan_cap?.so_dt ?? "",
                            moiQuanHe:
                              t.nguoi_lien_he_khan_cap?.moi_quan_he ?? "",
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
          key={selectedTenant.ma_khach}
          tenant={selectedTenant}
          vehicles={residentVehicles}
          contracts={residentContracts}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </>
  );
}
