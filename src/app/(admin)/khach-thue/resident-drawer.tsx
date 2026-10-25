"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  X,
  ShieldCheck,
  Smartphone,
  Car,
  FileText,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Plus,
  Trash2,
  Calendar,
  ExternalLink,
  PhoneCall,
  LoaderCircle,
  Eye,
} from "lucide-react";
import type { TenantRow, VehicleRow, TenantContractHistoryRow } from "@/lib/queries";
import {
  verifyTenantEkyc,
  resetTenantPassword,
  addTenantVehicle,
  updateVehicleStatus,
  deleteTenantVehicle,
  getResidentCccdImages,
} from "./actions";
import styles from "./resident.module.css";

export function ResidentDrawer({
  tenant,
  vehicles: initialVehicles,
  contracts,
  onClose,
}: {
  tenant: TenantRow;
  vehicles: VehicleRow[];
  contracts: TenantContractHistoryRow[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"info" | "vehicles" | "account" | "contracts">("info");
  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles);
  const [ekycStatus, setEkycStatus] = useState(tenant.trang_thai_ekyc || "ChuaXacThuc");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [cccdImages, setCccdImages] = useState<{
    truoc: string | null;
    sau: string | null;
  } | null>(() => {
    if (tenant.anh_cccd_mat_truoc || tenant.anh_cccd_mat_sau) {
      return {
        truoc: tenant.anh_cccd_mat_truoc,
        sau: tenant.anh_cccd_mat_sau,
      };
    }
    return null;
  });
  const [loadingCccd, setLoadingCccd] = useState(false);

  useEffect(() => {
    // Tải ảnh CCCD theo nhu cầu khi mở Drawer mà chưa có ảnh
    const hasPhotos =
      tenant.co_anh_cccd_truoc ||
      tenant.co_anh_cccd_sau ||
      Boolean(tenant.anh_cccd_mat_truoc) ||
      Boolean(tenant.anh_cccd_mat_sau);

    if (!hasPhotos) {
      setCccdImages({ truoc: null, sau: null });
      return;
    }
    if (cccdImages) return;

    let active = true;
    setLoadingCccd(true);
    getResidentCccdImages(tenant.ma_khach)
      .then((res) => {
        if (active) {
          setCccdImages({
            truoc: res.anh_cccd_mat_truoc,
            sau: res.anh_cccd_mat_sau,
          });
          setLoadingCccd(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadingCccd(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    tenant.ma_khach,
    tenant.co_anh_cccd_truoc,
    tenant.co_anh_cccd_sau,
    tenant.anh_cccd_mat_truoc,
    tenant.anh_cccd_mat_sau,
    cccdImages,
  ]);
  const [resetAccount, setResetAccount] = useState<{
    username: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Form thêm xe
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [loaiXe, setLoaiXe] = useState("Xe máy");
  const [bienSoXe, setBienSoXe] = useState("");
  const [maTheXe, setMaTheXe] = useState("");

  const emergency = tenant.nguoi_lien_he_khan_cap;

  const handleVerifyEkyc = (newStatus: "DaXacThuc" | "TuChoi") => {
    startTransition(async () => {
      const res = await verifyTenantEkyc(tenant.ma_khach, newStatus);
      if (res.error) {
        setActionMessage({ text: res.error, ok: false });
      } else {
        setEkycStatus(newStatus);
        setActionMessage({ text: res.success || "Cập nhật thành công", ok: true });
      }
    });
  };

  const handleResetPassword = () => {
    if (!window.confirm(`Bạn có chắc muốn cấp lại mật khẩu Mobile App cho khách ${tenant.ho_ten_khach}?`)) {
      return;
    }
    startTransition(async () => {
      const res = await resetTenantPassword(tenant.ma_khach);
      if (res.error) {
        setActionMessage({ text: res.error, ok: false });
      } else if (res.success && res.tempPassword && res.username) {
        setResetAccount({
          username: res.username,
          tempPassword: res.tempPassword,
        });
        setActionMessage({ text: "Đã cấp mật khẩu mặc định thành công!", ok: true });
      }
    });
  };

  const handleCopyCredentials = () => {
    if (!resetAccount) return;
    const msg = `[Nhà trọ Kiều Giang] Xin chào ${tenant.ho_ten_khach}, tài khoản Mobile App cư dân của bạn là: SĐT: ${resetAccount.username} | Mật khẩu mặc định: ${resetAccount.tempPassword}. Vui lòng đăng nhập và đổi mật khẩu mới.`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bienSoXe.trim()) return;

    const fd = new FormData();
    fd.append("maKhach", tenant.ma_khach);
    fd.append("loaiXe", loaiXe);
    fd.append("bienSoXe", bienSoXe.trim());
    fd.append("maTheXe", maTheXe.trim());
    if (tenant.ma_phong_hien_tai) {
      fd.append("maPhong", tenant.ma_phong_hien_tai);
    }

    startTransition(async () => {
      const res = await addTenantVehicle(fd);
      if (res.error) {
        setActionMessage({ text: res.error, ok: false });
      } else {
        setActionMessage({ text: res.success || "Đã thêm xe", ok: true });
        setVehicles([
          {
            ma_phuong_tien: "PT" + Date.now().toString().slice(-6),
            ma_khach: tenant.ma_khach,
            ma_phong: tenant.ma_phong_hien_tai,
            loai_xe: loaiXe,
            bien_so_xe: bienSoXe.toUpperCase().trim(),
            ma_the_xe: maTheXe.trim() || null,
            trang_thai: "DaDuyet",
            ngay_dang_ky: new Date().toISOString(),
          },
          ...vehicles,
        ]);
        setBienSoXe("");
        setMaTheXe("");
        setShowAddVehicle(false);
      }
    });
  };

  const handleApproveVehicle = (maPhuongTien: string) => {
    startTransition(async () => {
      const res = await updateVehicleStatus(maPhuongTien, "DaDuyet");
      if (res.error) {
        setActionMessage({ text: res.error, ok: false });
      } else {
        setVehicles(
          vehicles.map((v) =>
            v.ma_phuong_tien === maPhuongTien ? { ...v, trang_thai: "DaDuyet" } : v,
          ),
        );
        setActionMessage({ text: "Đã duyệt phương tiện thành công", ok: true });
      }
    });
  };

  const handleDeleteVehicle = (maPhuongTien: string, bienSo: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa xe biển số ${bienSo}?`)) return;
    startTransition(async () => {
      const res = await deleteTenantVehicle(maPhuongTien);
      if (res.error) {
        setActionMessage({ text: res.error, ok: false });
      } else {
        setVehicles(vehicles.filter((v) => v.ma_phuong_tien !== maPhuongTien));
        setActionMessage({ text: "Đã xóa phương tiện", ok: true });
      }
    });
  };

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.residentCardHead}>
            <div className={styles.residentAvatar}>
              {(tenant.ho_ten_khach || "K")[0].toUpperCase()}
            </div>
            <div>
              <h2 className={styles.residentName}>
                {tenant.ho_ten_khach}
                <span className={styles.residentCode}>#{tenant.ma_khach}</span>
              </h2>
              <div className={styles.residentBadges}>
                {tenant.trang_thai_cu_dan === "DangO" ? (
                  <span className={`${styles.badgePill} ${styles.badgeGreen}`}>
                    ● Đang ở {tenant.ma_phong_hien_tai} ({tenant.toa_nha_hien_tai || "Tòa"})
                  </span>
                ) : tenant.trang_thai_cu_dan === "CuuCuDan" ? (
                  <span className={`${styles.badgePill} ${styles.badgeGray}`}>
                    Cựu cư dân (Đã rời đi)
                  </span>
                ) : (
                  <span className={`${styles.badgePill} ${styles.badgeYellow}`}>
                    Chưa thuê phòng
                  </span>
                )}
                {tenant.vai_tro_phong && (
                  <span className={`${styles.badgePill} ${styles.badgeBlue}`}>
                    {tenant.vai_tro_phong}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Action message banner */}
        {actionMessage && (
          <div
            style={{
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: actionMessage.ok ? "#ecfdf5" : "#fef2f2",
              color: actionMessage.ok ? "#065f46" : "#991b1b",
              borderBottom: "1px solid",
              borderColor: actionMessage.ok ? "#a7f3d0" : "#fecaca",
            }}
          >
            {actionMessage.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {actionMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div className={styles.drawerTabs}>
          <button
            className={`${styles.drawerTab} ${tab === "info" ? styles.drawerTabActive : ""}`}
            onClick={() => setTab("info")}
          >
            <User size={15} /> Hồ sơ &amp; eKYC
          </button>
          <button
            className={`${styles.drawerTab} ${tab === "vehicles" ? styles.drawerTabActive : ""}`}
            onClick={() => setTab("vehicles")}
          >
            <Car size={15} /> Phương tiện ({vehicles.length})
          </button>
          <button
            className={`${styles.drawerTab} ${tab === "account" ? styles.drawerTabActive : ""}`}
            onClick={() => setTab("account")}
          >
            <Smartphone size={15} /> Mobile App
          </button>
          <button
            className={`${styles.drawerTab} ${tab === "contracts" ? styles.drawerTabActive : ""}`}
            onClick={() => setTab("contracts")}
          >
            <FileText size={15} /> Lịch sử HĐ ({contracts.length})
          </button>
        </div>

        {/* Body */}
        <div className={styles.drawerBody}>
          {/* TAB 1: THÔNG TIN & eKYC */}
          {tab === "info" && (
            <>
              {/* Định danh CCCD */}
              <div className={styles.sectionBox}>
                <h3 className={styles.sectionTitle}>
                  <ShieldCheck size={16} color="#4f46e5" /> Thông tin Định danh &amp; CCCD
                </h3>
                <div className={styles.infoGrid}>
                  <div className={styles.infoField}>
                    <span className={styles.infoLabel}>Số CCCD / CMND</span>
                    <span className={styles.infoValue}>{tenant.cccd || "—"}</span>
                  </div>
                  <div className={styles.infoField}>
                    <span className={styles.infoLabel}>Số điện thoại</span>
                    <span className={styles.infoValue}>
                      <a
                        href={`tel:${tenant.so_dt}`}
                        style={{ color: "#4f46e5", textDecoration: "none" }}
                      >
                        {tenant.so_dt || "—"}
                      </a>
                    </span>
                  </div>
                  <div className={styles.infoField}>
                    <span className={styles.infoLabel}>Ngày sinh</span>
                    <span className={styles.infoValue}>
                      {tenant.ngay_sinh
                        ? new Date(tenant.ngay_sinh).toLocaleDateString("vi-VN")
                        : "—"}
                    </span>
                  </div>
                  <div className={styles.infoField}>
                    <span className={styles.infoLabel}>Giới tính</span>
                    <span className={styles.infoValue}>{tenant.gioi_tinh || "—"}</span>
                  </div>
                  <div className={styles.infoField}>
                    <span className={styles.infoLabel}>Ngày cấp</span>
                    <span className={styles.infoValue}>
                      {tenant.ngay_cap_cccd
                        ? new Date(tenant.ngay_cap_cccd).toLocaleDateString("vi-VN")
                        : "—"}
                    </span>
                  </div>
                  <div className={styles.infoField}>
                    <span className={styles.infoLabel}>Nơi cấp</span>
                    <span className={styles.infoValue}>{tenant.noi_cap_cccd || "—"}</span>
                  </div>
                  <div className={`${styles.infoField} ${styles.fullWidth}`}>
                    <span className={styles.infoLabel}>Địa chỉ thường trú</span>
                    <span className={styles.infoValue}>{tenant.dia_chi_thuong_tru || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Ảnh eKYC CCCD 2 mặt */}
              <div className={styles.sectionBox}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                    <Eye size={16} color="#4f46e5" /> Xác thực eKYC CCCD (Mobile App)
                  </h3>
                  <div>
                    {ekycStatus === "DaXacThuc" ? (
                      <span className={`${styles.badgePill} ${styles.badgeGreen}`}>
                        <CheckCircle2 size={12} /> Đã xác thực
                      </span>
                    ) : ekycStatus === "ChoDuyet" ? (
                      <span className={`${styles.badgePill} ${styles.badgeYellow}`}>
                        ● Chờ Admin duyệt
                      </span>
                    ) : ekycStatus === "TuChoi" ? (
                      <span className={`${styles.badgePill} ${styles.badgeRed}`}>
                        Đã từ chối (Chụp lại)
                      </span>
                    ) : (
                      <span className={`${styles.badgePill} ${styles.badgeGray}`}>
                        Chưa nộp ảnh
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.ekycGrid}>
                  <div className={styles.ekycCard}>
                    <span className={styles.ekycCardLabel}>CCCD Mặt Trước</span>
                    {loadingCccd ? (
                      <div className={styles.ekycPlaceholder}>
                        <LoaderCircle
                          size={24}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                        <span style={{ fontSize: 12 }}>Đang tải ảnh...</span>
                      </div>
                    ) : cccdImages?.truoc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cccdImages.truoc}
                        alt="CCCD mặt trước"
                        className={styles.ekycImage}
                        onClick={() => setLightboxUrl(cccdImages.truoc)}
                      />
                    ) : (
                      <div className={styles.ekycPlaceholder}>
                        <ShieldCheck size={28} />
                        <span>Chưa có ảnh mặt trước</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.ekycCard}>
                    <span className={styles.ekycCardLabel}>CCCD Mặt Sau</span>
                    {loadingCccd ? (
                      <div className={styles.ekycPlaceholder}>
                        <LoaderCircle
                          size={24}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                        <span style={{ fontSize: 12 }}>Đang tải ảnh...</span>
                      </div>
                    ) : cccdImages?.sau ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cccdImages.sau}
                        alt="CCCD mặt sau"
                        className={styles.ekycImage}
                        onClick={() => setLightboxUrl(cccdImages.sau)}
                      />
                    ) : (
                      <div className={styles.ekycPlaceholder}>
                        <ShieldCheck size={28} />
                        <span>Chưa có ảnh mặt sau</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.ekycActions}>
                  <button
                    className={styles.btnVerifyReject}
                    onClick={() => handleVerifyEkyc("TuChoi")}
                    disabled={isPending}
                  >
                    Yêu cầu chụp lại
                  </button>
                  <button
                    className={styles.btnVerifyOk}
                    onClick={() => handleVerifyEkyc("DaXacThuc")}
                    disabled={isPending}
                  >
                    <Check size={14} /> Xác nhận hợp lệ (Duyệt)
                  </button>
                </div>
              </div>

              {/* Người liên hệ khẩn cấp */}
              <div className={styles.sectionBox}>
                <h3 className={styles.sectionTitle}>
                  <PhoneCall size={16} color="#e11d48" /> Người liên hệ khẩn cấp
                </h3>
                {emergency?.ho_ten || emergency?.so_dt ? (
                  <div className={styles.infoGrid}>
                    <div className={styles.infoField}>
                      <span className={styles.infoLabel}>Họ tên người thân</span>
                      <span className={styles.infoValue}>{emergency.ho_ten || "—"}</span>
                    </div>
                    <div className={styles.infoField}>
                      <span className={styles.infoLabel}>Mối quan hệ</span>
                      <span className={styles.infoValue}>{emergency.moi_quan_he || "—"}</span>
                    </div>
                    <div className={`${styles.infoField} ${styles.fullWidth}`}>
                      <span className={styles.infoLabel}>Số điện thoại khẩn cấp</span>
                      <span className={styles.infoValue}>
                        <a
                          href={`tel:${emergency.so_dt}`}
                          style={{ color: "#e11d48", fontWeight: 700 }}
                        >
                          {emergency.so_dt}
                        </a>
                      </span>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                    Khách chưa khai báo người liên hệ khẩn cấp.
                  </p>
                )}
              </div>

              {/* Ghi chú nội bộ */}
              {tenant.ghi_chu_noi_bo && (
                <div className={styles.sectionBox}>
                  <h3 className={styles.sectionTitle}>Ghi chú nội bộ của Quản lý</h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#334155",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {tenant.ghi_chu_noi_bo}
                  </p>
                </div>
              )}
            </>
          )}

          {/* TAB 2: PHƯƠNG TIỆN & THẺ XE */}
          {tab === "vehicles" && (
            <div className={styles.sectionBox}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                  <Car size={16} color="#4f46e5" /> Danh sách xe gửi tại tòa nhà ({vehicles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(!showAddVehicle)}
                  style={{
                    background: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus size={14} /> Thêm xe
                </button>
              </div>

              {/* Form thêm xe */}
              {showAddVehicle && (
                <form
                  onSubmit={handleAddVehicle}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#1e293b" }}>
                    Đăng ký phương tiện mới
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#64748b" }}>
                        Loại xe
                      </label>
                      <select
                        value={loaiXe}
                        onChange={(e) => setLoaiXe(e.target.value)}
                        style={{
                          width: "100%",
                          height: 36,
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          padding: "0 8px",
                        }}
                      >
                        <option value="Xe máy">Xe máy</option>
                        <option value="Xe ga">Xe ga</option>
                        <option value="Xe số">Xe số</option>
                        <option value="Xe điện">Xe điện</option>
                        <option value="Ô tô">Ô tô</option>
                        <option value="Xe đạp">Xe đạp</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#64748b" }}>
                        Biển số xe *
                      </label>
                      <input
                        type="text"
                        placeholder="29B1-123.45"
                        value={bienSoXe}
                        onChange={(e) => setBienSoXe(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          height: 36,
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          padding: "0 8px",
                        }}
                      >
                      </input>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 11.5, color: "#64748b" }}>
                      Mã thẻ từ thang máy / gửi xe (nếu có)
                    </label>
                    <input
                      type="text"
                      placeholder="TX-0099"
                      value={maTheXe}
                      onChange={(e) => setMaTheXe(e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        padding: "0 8px",
                      }}
                    >
                    </input>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowAddVehicle(false)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#f1f5f9",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "none",
                        background: "#4f46e5",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Lưu xe
                    </button>
                  </div>
                </form>
              )}

              {vehicles.length === 0 ? (
                <div className={styles.emptyBox}>
                  <Car size={32} />
                  <span>Cư dân chưa đăng ký phương tiện nào.</span>
                </div>
              ) : (
                <table className={styles.vehicleTable}>
                  <thead>
                    <tr>
                      <th>Loại xe</th>
                      <th>Biển số xe</th>
                      <th>Mã thẻ từ</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.ma_phuong_tien}>
                        <td style={{ fontWeight: 600 }}>{v.loai_xe}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>
                          {v.bien_so_xe}
                        </td>
                        <td>{v.ma_the_xe || <span style={{ color: "#94a3b8" }}>Chưa gán</span>}</td>
                        <td>
                          {v.trang_thai === "DaDuyet" ? (
                            <span className={`${styles.badgePill} ${styles.badgeGreen}`}>
                              Đã duyệt
                            </span>
                          ) : (
                            <span className={`${styles.badgePill} ${styles.badgeYellow}`}>
                              Chờ duyệt
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            {v.trang_thai === "ChoDuyet" && (
                              <button
                                type="button"
                                onClick={() => handleApproveVehicle(v.ma_phuong_tien)}
                                style={{
                                  background: "#ecfdf5",
                                  border: "1px solid #a7f3d0",
                                  color: "#065f46",
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  fontSize: 11.5,
                                  cursor: "pointer",
                                }}
                              >
                                Duyệt
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteVehicle(v.ma_phuong_tien, v.bien_so_xe)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                padding: 4,
                              }}
                              title="Xóa xe"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: TÀI KHOẢN MOBILE APP */}
          {tab === "account" && (
            <div className={styles.sectionBox}>
              <h3 className={styles.sectionTitle}>
                <Smartphone size={16} color="#4f46e5" /> Trạng thái Tài khoản Mobile App Cư dân
              </h3>
              <div className={styles.infoGrid} style={{ marginBottom: 16 }}>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Tên đăng nhập (Username)</span>
                  <span
                    className={styles.infoValue}
                    style={{ fontFamily: "monospace", fontSize: 15 }}
                  >
                    {tenant.ten_dang_nhap || tenant.so_dt || "Chưa tạo"}
                  </span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Trạng thái tài khoản</span>
                  <span className={styles.infoValue}>
                    {tenant.ma_tai_khoan ? (
                      <span className={`${styles.badgePill} ${styles.badgeGreen}`}>
                        ● Đang hoạt động
                      </span>
                    ) : (
                      <span className={`${styles.badgePill} ${styles.badgeGray}`}>
                        Chưa cấp tài khoản
                      </span>
                    )}
                  </span>
                </div>
                <div className={`${styles.infoField} ${styles.fullWidth}`}>
                  <span className={styles.infoLabel}>Tình trạng mật khẩu</span>
                  <span className={styles.infoValue}>
                    {!tenant.da_doi_mat_khau ? (
                      <span style={{ color: "#d97706" }}>
                        ⚠️ Chưa đổi mật khẩu lần đầu (Đang dùng mật khẩu mặc định 123456)
                      </span>
                    ) : (
                      <span style={{ color: "#059669" }}>
                        ✓ Khách đã tự đổi mật khẩu riêng an toàn
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Nút cấp lại mật khẩu */}
              <div style={{ marginTop: 20 }}>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isPending}
                  style={{
                    background: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isPending ? (
                    <LoaderCircle size={15} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <KeyRound size={16} />
                  )}
                  {tenant.ma_tai_khoan
                    ? "Cấp lại Mật khẩu Mobile App (Reset Password)"
                    : "Tạo tài khoản Mobile App ngay"}
                </button>
              </div>

              {/* Hộp thông tin tài khoản vừa sinh */}
              {resetAccount && (
                <div className={styles.credentialBox}>
                  <h4 className={styles.credentialTitle}>
                    🎉 Tài khoản Mobile App đã sẵn sàng!
                  </h4>
                  <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#475569" }}>
                    Gửi thông tin bên dưới cho khách thuê để họ tải App và đăng nhập lần đầu:
                  </p>
                  <div className={styles.credentialRow}>
                    <span>Tên đăng nhập (SĐT):</span>
                    <span className={styles.credentialCode}>{resetAccount.username}</span>
                  </div>
                  <div className={styles.credentialRow}>
                    <span>Mật khẩu mặc định:</span>
                    <span
                      className={styles.credentialCode}
                      style={{ color: "#dc2626", letterSpacing: 2 }}
                    >
                      {resetAccount.tempPassword}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={handleCopyCredentials}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Đã sao chép vào bộ nhớ tạm!" : "Sao chép tin nhắn Zalo/SMS gửi khách"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LỊCH SỬ THUÊ PHÒNG */}
          {tab === "contracts" && (
            <div className={styles.sectionBox}>
              <h3 className={styles.sectionTitle}>
                <FileText size={16} color="#4f46e5" /> Lịch sử Hợp đồng thuê phòng ({contracts.length})
              </h3>
              {contracts.length === 0 ? (
                <div className={styles.emptyBox}>
                  <Calendar size={32} />
                  <span>Khách chưa từng ký kết hợp đồng nào trong hệ thống.</span>
                </div>
              ) : (
                <table className={styles.vehicleTable}>
                  <thead>
                    <tr>
                      <th>Mã HĐ</th>
                      <th>Phòng</th>
                      <th>Vai trò</th>
                      <th>Thời hạn thuê</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c, idx) => (
                      <tr key={`${c.ma_hop_dong}-${idx}`}>
                        <td>
                          <Link
                            href={`/hop-dong/${c.ma_hop_dong}`}
                            style={{
                              color: "#4f46e5",
                              fontWeight: 700,
                              textDecoration: "underline",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {c.ma_hop_dong} <ExternalLink size={11} />
                          </Link>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {c.ma_phong} ({c.toa_nha || "Tòa"})
                        </td>
                        <td>{c.vai_tro}</td>
                        <td style={{ fontSize: 12 }}>
                          {c.ngay_bd?.slice(0, 10)} → {c.ngay_kt?.slice(0, 10)}
                        </td>
                        <td>
                          {c.trang_thai === "Còn hạn" || c.trang_thai === "Đang thuê" ? (
                            <span className={`${styles.badgePill} ${styles.badgeGreen}`}>
                              {c.trang_thai}
                            </span>
                          ) : (
                            <span className={`${styles.badgePill} ${styles.badgeGray}`}>
                              {c.trang_thai}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Lightbox zoom ảnh CCCD */}
        {lightboxUrl && (
          <div className={styles.lightboxOverlay} onClick={() => setLightboxUrl(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxUrl} alt="Phóng to ảnh CCCD" className={styles.lightboxImg} />
          </div>
        )}
      </div>
    </div>
  );
}

