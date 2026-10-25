import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Printer, FileCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { getContractDetail, getTenantOptions, getRoomOptions } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { requireScope } from "@/lib/session";
import { ContractPrintBar } from "./print-bar";
import {
  AddOccupantForm,
  RemoveOccupantButton,
  ProvisionOccupantButton,
} from "../contract-forms";
import { LiquidationDialog } from "./liquidation-dialog";
import { RoomTransferDialog } from "../room-transfer-dialog";
import styles from "./contract-detail.module.css";

type Params = Promise<{ maHopDong: string }>;

/** Thông tin pháp lý Bên A (chủ trọ) — dự án nội bộ nên cố định trong hợp đồng. */
const BEN_A = {
  ten: "ĐẶNG THỊ KIỀU GIANG",
  cccd: "079190012345",
  ngayCap: "15/03/2019",
  noiCap: "Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư",
  thuongTru:
    "Số 12 đường Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
  dienThoai: "0903 111 222",
};

function money(value: string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function text(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function isRep(vaiTro: string | null) {
  return (
    vaiTro === "Đại diện hợp đồng" ||
    vaiTro === "DaiDien" ||
    vaiTro === "Khách đại diện"
  );
}

function isLiving(status: string | null) {
  return status === "Đang ở" || status === "DangO";
}

function daysLeft(ngayKt: string | null) {
  if (!ngayKt) return null;
  return Math.round(
    (new Date(ngayKt).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      86_400_000,
  );
}

function statusTone(status: string | null, remaining: number | null) {
  if (status === "Đã kết thúc") return styles.badgeMuted;
  if (remaining !== null && remaining <= 30) return styles.badgeWarn;
  if (status === "Còn hạn" || status === "Đang thuê") return styles.badgeOk;
  if (status === "Đã đặt cọc") return styles.badgeInfo;
  return styles.badgeMuted;
}

function ContractDetailContent({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ContractBody params={params} />
    </Suspense>
  );
}

async function ContractBody({ params }: { params: Params }) {
  const { scope } = await requireScope();
  const scopeQuery = new ScopeQuery(scope);
  const { maHopDong } = await params;
  const [bundle, tenantOptions, emptyRooms] = await Promise.all([
    getContractDetail(decodeURIComponent(maHopDong), scopeQuery),
    getTenantOptions(scopeQuery),
    getRoomOptions(scopeQuery, { excludeRentedOrReserved: true }),
  ]);

  if (!bundle) {
    return (
      <AdminShell active="contract">
        <div className={styles.backRow}>
          <Link href="/hop-dong" className={styles.backLink}>
            <ArrowLeft size={15} /> Quay lại danh sách hợp đồng
          </Link>
        </div>
        <section className={styles.section}>
          <p className={styles.muted}>
            Không tìm thấy hợp đồng này, hoặc hợp đồng thuộc cơ sở bạn không có
            quyền truy cập.
          </p>
        </section>
      </AdminShell>
    );
  }

  const { hopDong, nguoiO, phuLuc, hoaDon, bienBanThanhLy, chiSoGanNhat, yeuCauChuyenPhong } = bundle;
  const remaining = daysLeft(hopDong.ngay_kt);
  const trangThaiHienThi =
    remaining !== null &&
    remaining <= 30 &&
    hopDong.trang_thai !== "Đã kết thúc"
      ? remaining <= 0
        ? "Đã hết hạn"
        : `Sắp hết hạn (còn ${remaining} ngày)`
      : text(hopDong.trang_thai);

  const unpaidTotal = hoaDon
    .filter((hd) => hd.trang_thai !== "Đã thanh toán" && hd.trang_thai !== "Đã hủy")
    .reduce(
      (sum, hd) =>
        sum + Math.max(0, (Number(hd.tong_tien) || 0) - (Number(hd.da_thu) || 0)),
      0,
    );

  return (
    <AdminShell active="contract">
      <div className={styles.screenOnlyContent}>
        <div className={styles.backRow}>
          <Link href="/hop-dong" className={styles.backLink}>
            <ArrowLeft size={15} /> Quay lại danh sách hợp đồng
          </Link>
        </div>

      {/* ── Tiêu đề & Nút thanh lý / Đổi phòng ── */}
      <div className={styles.headCard}>
        <div>
          <h1 className={styles.code}>{hopDong.ma_hop_dong}</h1>
          <p className={styles.sub}>
            Phòng {text(hopDong.phong_ten)} ({text(hopDong.ma_phong)}) •{" "}
            {text(hopDong.phong_toa)}
            {hopDong.phong_tang !== null
              ? ` • Tầng ${hopDong.phong_tang}`
              : ""}{" "}
            • {text(hopDong.khach_ho_ten)}
          </p>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {hopDong.trang_thai !== "Đã kết thúc" && (
              <>
                <RoomTransferDialog
                  maHopDong={hopDong.ma_hop_dong}
                  maPhongCu={hopDong.ma_phong || ""}
                  tenPhongCu={hopDong.phong_ten || hopDong.ma_phong || ""}
                  tenKhach={hopDong.khach_ho_ten || "Khách thuê"}
                  giaThueCu={Number(hopDong.gia_thue_thoa_thuan) || 0}
                  tienDatCocCu={Number(hopDong.tien_dat_coc) || 0}
                  emptyRooms={emptyRooms}
                  maYeuCau={yeuCauChuyenPhong?.ma_yeu_cau}
                  maPhongMoiDuKien={yeuCauChuyenPhong?.ma_phong_moi}
                  ngayHenDuKien={yeuCauChuyenPhong?.thoi_gian_hen}
                  lyDoChuyen={yeuCauChuyenPhong?.ly_do_chuyen}
                  isFromMobileRequest={Boolean(yeuCauChuyenPhong && !["Đã duyệt", "Từ chối", "DA_DUYET", "TU_CHOI"].includes(yeuCauChuyenPhong.trang_thai_tien_do))}
                  triggerButtonText={
                    yeuCauChuyenPhong && !["Đã duyệt", "Từ chối", "DA_DUYET", "TU_CHOI"].includes(yeuCauChuyenPhong.trang_thai_tien_do)
                      ? "⚡ Duyệt yêu cầu đổi phòng"
                      : "Đổi phòng"
                  }
                  triggerButtonVariant={
                    yeuCauChuyenPhong && !["Đã duyệt", "Từ chối", "DA_DUYET", "TU_CHOI"].includes(yeuCauChuyenPhong.trang_thai_tien_do)
                      ? "warning"
                      : "primary"
                  }
                />
                <LiquidationDialog
                  maHopDong={hopDong.ma_hop_dong}
                  maPhong={hopDong.ma_phong || ""}
                  tenKhach={hopDong.khach_ho_ten || "Khách thuê"}
                  tienDatCoc={Number(hopDong.tien_dat_coc) || 0}
                  chiSoDienCu={chiSoGanNhat?.dien ?? 0}
                  chiSoNuocCu={chiSoGanNhat?.nuoc ?? 0}
                  unpaidTotal={unpaidTotal}
                  ngayKtHopDong={hopDong.ngay_kt}
                  maThanhLy={bienBanThanhLy?.trang_thai === "CHO_DUYET" ? bienBanThanhLy.ma_thanh_ly : undefined}
                  ngayTraPhongDuKien={bienBanThanhLy?.trang_thai === "CHO_DUYET" ? bienBanThanhLy.ngay_tra_phong : undefined}
                  ghiChuYeuCau={bienBanThanhLy?.trang_thai === "CHO_DUYET" ? bienBanThanhLy.ghi_chu : undefined}
                  isPendingRequest={bienBanThanhLy?.trang_thai === "CHO_DUYET"}
                  triggerButtonText={bienBanThanhLy?.trang_thai === "CHO_DUYET" ? "⚡ Duyệt yêu cầu trả phòng" : "Thanh lý hợp đồng & Trả phòng"}
                  triggerButtonVariant={bienBanThanhLy?.trang_thai === "CHO_DUYET" ? "warning" : "danger"}
                />
              </>
            )}
            <span
              className={`${styles.badge} ${statusTone(hopDong.trang_thai, remaining)}`}
            >
              {trangThaiHienThi}
            </span>
          </div>
          <div className={styles.days}>
            {date(hopDong.ngay_bd)} → {date(hopDong.ngay_kt)}
          </div>
        </div>
      </div>

      {/* ── Banner: Yêu cầu chuyển phòng đang chờ duyệt từ Mobile ── */}
      {yeuCauChuyenPhong && !["Đã duyệt", "Từ chối", "DA_DUYET", "TU_CHOI"].includes(yeuCauChuyenPhong.trang_thai_tien_do) && (
        <div
          style={{
            background: "#DCEFF8",
            border: "1px solid #BAE6FD",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0369A1", fontWeight: 800, fontSize: 14 }}>
              <FileCheck size={18} /> CƯ DÂN ĐÃ GỬI YÊU CẦU CHUYỂN PHÒNG (CHỜ DUYỆT)
            </div>
            <div style={{ fontSize: 12.5, color: "#0F172A", marginTop: 4 }}>
              Chuyển sang: <strong>Phòng {yeuCauChuyenPhong.ten_phong_moi || yeuCauChuyenPhong.ma_phong_moi}</strong> • Hẹn ngày dọn: <strong>{date(yeuCauChuyenPhong.thoi_gian_hen)}</strong>
              {yeuCauChuyenPhong.ly_do_chuyen ? ` • Lý do: "${yeuCauChuyenPhong.ly_do_chuyen}"` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#0369A1", marginTop: 2 }}>
              Vui lòng kiểm tra phòng trống mới, quyết toán chênh lệch tiền cọc và phê duyệt lập phụ lục hợp đồng.
            </div>
          </div>
          <RoomTransferDialog
            maHopDong={hopDong.ma_hop_dong}
            maPhongCu={hopDong.ma_phong || ""}
            tenPhongCu={hopDong.phong_ten || hopDong.ma_phong || ""}
            tenKhach={hopDong.khach_ho_ten || "Khách thuê"}
            giaThueCu={Number(hopDong.gia_thue_thoa_thuan) || 0}
            tienDatCocCu={Number(hopDong.tien_dat_coc) || 0}
            emptyRooms={emptyRooms}
            maYeuCau={yeuCauChuyenPhong.ma_yeu_cau}
            maPhongMoiDuKien={yeuCauChuyenPhong.ma_phong_moi}
            ngayHenDuKien={yeuCauChuyenPhong.thoi_gian_hen}
            lyDoChuyen={yeuCauChuyenPhong.ly_do_chuyen}
            isFromMobileRequest={true}
            triggerButtonText="Nghiệm thu & Duyệt ngay"
            triggerButtonVariant="warning"
          />
        </div>
      )}

      {/* ── Banner: Yêu cầu trả phòng đang chờ duyệt từ Mobile ── */}
      {bienBanThanhLy && bienBanThanhLy.trang_thai === "CHO_DUYET" && (
        <div
          style={{
            background: "#F6E6B4",
            border: "1px solid #FDE68A",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#92400E", fontWeight: 800, fontSize: 14 }}>
              <FileCheck size={18} /> CƯ DÂN ĐÃ GỬI YÊU CẦU TRẢ PHÒNG & THANH LÝ (CHỜ DUYỆT)
            </div>
            <div style={{ fontSize: 12.5, color: "#78350F", marginTop: 4 }}>
              Ngày dự kiến dọn đi: <strong>{date(bienBanThanhLy.ngay_tra_phong)}</strong>
              {bienBanThanhLy.ghi_chu ? ` • Lý do: "${bienBanThanhLy.ghi_chu}"` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#92400E", marginTop: 2 }}>
              Vui lòng gặp cư dân nghiệm thu cơ sở vật chất, chốt chỉ số điện nước cuối và hoàn tất thanh lý.
            </div>
          </div>
          <LiquidationDialog
            maHopDong={hopDong.ma_hop_dong}
            maPhong={hopDong.ma_phong || ""}
            tenKhach={hopDong.khach_ho_ten || "Khách thuê"}
            tienDatCoc={Number(hopDong.tien_dat_coc) || 0}
            chiSoDienCu={chiSoGanNhat?.dien ?? 0}
            chiSoNuocCu={chiSoGanNhat?.nuoc ?? 0}
            unpaidTotal={unpaidTotal}
            ngayKtHopDong={hopDong.ngay_kt}
            maThanhLy={bienBanThanhLy.ma_thanh_ly}
            ngayTraPhongDuKien={bienBanThanhLy.ngay_tra_phong}
            ghiChuYeuCau={bienBanThanhLy.ghi_chu}
            isPendingRequest={true}
            triggerButtonText="Nghiệm thu & Duyệt ngay"
            triggerButtonVariant="warning"
          />
        </div>
      )}

      {/* ── Thẻ hiển thị Biên bản thanh lý nếu hợp đồng đã kết thúc hoặc đã duyệt ── */}
      {bienBanThanhLy && (bienBanThanhLy.trang_thai === "DA_DUYET" || hopDong.trang_thai === "Đã kết thúc") && (
        <div
          style={{
            background: "#EFF8FC",
            border: "1px solid #DCEFF8",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#4A90C2",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              <FileCheck size={18} /> BIÊN BẢN THANH LÝ HỢP ĐỒNG ({bienBanThanhLy.ma_thanh_ly})
              <span
                style={{
                  background: "#E6F4EA",
                  color: "#166534",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid #BBF7D0",
                }}
              >
                ĐÃ HOÀN TẤT
              </span>
            </div>
            <span style={{ fontSize: 12, color: "#425B6B", fontWeight: 700 }}>
              Ngày trả phòng: {date(bienBanThanhLy.ngay_tra_phong)}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #DCEFF8",
              }}
            >
              <div style={{ fontSize: 11.5, color: "#64748B" }}>Số điện chốt cuối</div>
              <strong style={{ fontSize: 16, color: "#0F172A" }}>
                {Number(bienBanThanhLy.chi_so_dien_cuoi).toLocaleString()} kWh
              </strong>
            </div>

            <div
              style={{
                background: "#ffffff",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #DCEFF8",
              }}
            >
              <div style={{ fontSize: 11.5, color: "#64748B" }}>Số nước chốt cuối</div>
              <strong style={{ fontSize: 16, color: "#0F172A" }}>
                {Number(bienBanThanhLy.chi_so_nuoc_cuoi).toLocaleString()} m³
              </strong>
            </div>

            <div
              style={{
                background: "#ffffff",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #DCEFF8",
              }}
            >
              <div style={{ fontSize: 11.5, color: "#64748B" }}>Tiền cọc đã hoàn lại khách</div>
              <strong style={{ fontSize: 16, color: "#059669" }}>
                {money(bienBanThanhLy.tien_coc_hoan_lai)}
              </strong>
            </div>

            {Number(bienBanThanhLy.tien_kh_tra_them || 0) > 0 && (
              <div
                style={{
                  background: "#ffffff",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #DCEFF8",
                }}
              >
                <div style={{ fontSize: 11.5, color: "#64748B" }}>Tiền khách đã trả thêm</div>
                <strong style={{ fontSize: 16, color: "#DC2626" }}>
                  {money(bienBanThanhLy.tien_kh_tra_them)}
                </strong>
              </div>
            )}
          </div>

          {bienBanThanhLy.ghi_chu && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12.5,
                color: "#425B6B",
                background: "#ffffff",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #DCEFF8",
              }}
            >
              <strong>Nội dung nghiệm thu bàn giao:</strong> {bienBanThanhLy.ghi_chu}
            </div>
          )}
        </div>
      )}

      {/* ── Banner thông báo nếu yêu cầu từng bị từ chối ── */}
      {bienBanThanhLy && bienBanThanhLy.trang_thai === "TU_CHOI" && (
        <div
          style={{
            background: "#FDE8E8",
            border: "1px solid #FCA5A5",
            borderRadius: 14,
            padding: "12px 18px",
            marginBottom: 16,
            fontSize: 12.5,
            color: "#991B1B",
          }}
        >
          <strong>Lưu ý:</strong> Yêu cầu trả phòng gần nhất của hợp đồng này đã bị Ban Quản Lý từ chối
          {bienBanThanhLy.ghi_chu ? `: "${bienBanThanhLy.ghi_chu}"` : "."}
        </div>
      )}

            {/* ── Trạng thái bàn giao phòng từ Mobile App ── */}
      <div
        style={{
          background: hopDong.da_xac_nhan_ban_giao ? "#ecfdf5" : "#fffbeb",
          border: `1px solid ${hopDong.da_xac_nhan_ban_giao ? "#a7f3d0" : "#fde68a"}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              background: hopDong.da_xac_nhan_ban_giao ? "#d1fae5" : "#fef3c7",
              color: hopDong.da_xac_nhan_ban_giao ? "#059669" : "#d97706",
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: hopDong.da_xac_nhan_ban_giao ? "#065f46" : "#92400e" }}>
              Xác nhận bàn giao phòng & Kiểm kê tài sản
            </div>
            <div style={{ fontSize: 12, color: hopDong.da_xac_nhan_ban_giao ? "#047857" : "#b45309" }}>
              {hopDong.da_xac_nhan_ban_giao
                ? `✓ Đã xác nhận bàn giao phòng (${date(hopDong.ngay_xac_nhan_ban_giao)})`
                : "⏳ Chờ khách thuê xác nhận bàn giao phòng"}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
            background: hopDong.da_xac_nhan_ban_giao ? "#dcfce7" : "#fef3c7",
            color: hopDong.da_xac_nhan_ban_giao ? "#15803d" : "#b45309",
            border: `1px solid ${hopDong.da_xac_nhan_ban_giao ? "#86efac" : "#fde68a"}`,
          }}
        >
          {hopDong.da_xac_nhan_ban_giao ? "Đã bàn giao" : "Chờ bàn giao"}
        </span>
      </div>
      </div>

      {/* ── Các cách xuất hợp đồng (Chỉ in phần này) ── */}
      <ContractPrintBar maHopDong={hopDong.ma_hop_dong}>
        <PrintDocument bundle={bundle} />
      </ContractPrintBar>

      {/* ── Thông tin chi tiết trên giao diện admin ── */}
      <div className={styles.screenOnlyContent}>
      <div className={styles.columns} style={{ marginTop: 16 }}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Bên B — Khách thuê</h2>
          <dl className={styles.grid}>
            <div className={styles.field}>
              <dt>Họ tên</dt>
              <dd>{text(hopDong.khach_ho_ten)}</dd>
            </div>
            <div className={styles.field}>
              <dt>CCCD</dt>
              <dd>{text(hopDong.khach_cccd)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Số điện thoại</dt>
              <dd>{text(hopDong.khach_so_dt)}</dd>
            </div>
            <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <dt>Địa chỉ thường trú</dt>
              <dd>{text(hopDong.khach_dia_chi)}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Điều khoản thuê</h2>
          <dl className={styles.grid}>
            <div className={styles.field}>
              <dt>Giá thuê thỏa thuận</dt>
              <dd>{money(hopDong.gia_thue_thoa_thuan)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Tiền đặt cọc</dt>
              <dd>{money(hopDong.tien_dat_coc)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Chu kỳ thu tiền</dt>
              <dd>
                {hopDong.chu_ky_thu_tien
                  ? `${hopDong.chu_ky_thu_tien} tháng/lần`
                  : "—"}
              </dd>
            </div>
            <div className={styles.field}>
              <dt>Ngày ký</dt>
              <dd>{date(hopDong.ngay_ky)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Diện tích</dt>
              <dd>
                {hopDong.phong_dien_tich
                  ? `${hopDong.phong_dien_tich} m²`
                  : "—"}
              </dd>
            </div>
            <div className={styles.field}>
              <dt>Loại phòng</dt>
              <dd>{text(hopDong.phong_loai)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ── Người ở trong phòng ── */}
      <section className={styles.section} style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
            Người ở trong phòng ({nguoiO.length})
          </h2>
          <AddOccupantForm
            maHopDong={hopDong.ma_hop_dong}
            tenants={tenantOptions}
          />
        </div>
        {nguoiO.length === 0 ? (
          <p className={styles.empty}>Chưa ghi nhận người ở cùng.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>CCCD</th>
                <th>Số điện thoại</th>
                <th>Vai trò</th>
                <th>Ngày vào ở</th>
                <th>Trạng thái lưu trú</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {nguoiO.map((nguoi) => {
                const rep = isRep(nguoi.vai_tro);
                const living = isLiving(nguoi.trang_thai_luu_tru);
                const needsAccount =
                  !rep &&
                  (!nguoi.ma_tai_khoan ||
                    nguoi.trang_thai_luu_tru === "Chờ cấp tài khoản" ||
                    nguoi.trang_thai_luu_tru === "Chờ duyệt");
                return (
                  <tr key={nguoi.ma_khach}>
                    <td style={{ fontWeight: 600 }}>
                      {text(nguoi.ho_ten_khach)}
                    </td>
                    <td>{text(nguoi.cccd)}</td>
                    <td>{text(nguoi.so_dt)}</td>
                    <td>
                      {rep ? (
                        <span className={styles.badgeOk}>Đại diện HĐ</span>
                      ) : (
                        <span className={styles.badgeInfo}>Người ở cùng</span>
                      )}
                    </td>
                    <td>{date(nguoi.ngay_vao_o)}</td>
                    <td>
                      {needsAccount ? (
                        <span
                          style={{
                            color: "#b45309",
                            background: "#fef3c7",
                            border: "1px solid #fde68a",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11.5,
                          }}
                        >
                          Chờ cấp tài khoản
                        </span>
                      ) : living ? (
                        <span style={{ color: "#059669", fontWeight: 600 }}>
                          Đang ở
                        </span>
                      ) : (
                        <span style={{ color: "#64748b" }}>Đã rời đi</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {needsAccount && (
                          <ProvisionOccupantButton
                            maHopDong={hopDong.ma_hop_dong}
                            maKhach={nguoi.ma_khach}
                            hoTen={nguoi.ho_ten_khach ?? "Khách"}
                            soDt={nguoi.so_dt}
                          />
                        )}
                        {!rep && (living || needsAccount) && (
                          <RemoveOccupantButton
                            maHopDong={hopDong.ma_hop_dong}
                            maKhach={nguoi.ma_khach}
                            hoTen={nguoi.ho_ten_khach ?? nguoi.ma_khach}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Phụ lục ── */}
      <section className={styles.section} style={{ marginTop: 16 }}>
        <h2 className={styles.sectionTitle}>
          Phụ lục hợp đồng ({phuLuc.length})
        </h2>
        {phuLuc.length === 0 ? (
          <p className={styles.empty}>Chưa có phụ lục nào.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã phụ lục</th>
                <th>Ngày lập</th>
                <th>Gia hạn đến</th>
                <th>Giá thuê mới</th>
                <th>Chênh lệch cọc</th>
                <th>Nội dung điều chỉnh</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {phuLuc.map((pl) => (
                <tr key={pl.ma_phu_luc}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span>{pl.ma_phu_luc}</span>
                      {pl.ma_phong_moi && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            background: "#E6F4EA",
                            color: "#166534",
                            border: "1px solid #BBF7D0",
                            borderRadius: 4,
                            padding: "1px 6px",
                            fontSize: 11,
                            fontWeight: 700,
                            width: "fit-content",
                          }}
                        >
                          Đổi sang phòng {pl.ma_phong_moi}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{date(pl.ngay_lap)}</td>
                  <td>{date(pl.ngay_gia_han_den)}</td>
                  <td>{money(pl.gia_thue_moi)}</td>
                  <td>{money(pl.chenh_lech_tien_coc)}</td>
                  <td>{text(pl.noi_dung_dieu_chinh)}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: pl.trang_thai === "Đã duyệt" ? "#15803d" : "#425b6b" }}>
                      {text(pl.trang_thai)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Hóa đơn ── */}
      <section className={styles.section} style={{ marginTop: 16 }}>
        <h2 className={styles.sectionTitle}>
          Hóa đơn của hợp đồng ({hoaDon.length})
        </h2>
        {hoaDon.length === 0 ? (
          <p className={styles.empty}>Chưa có hóa đơn nào.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã hóa đơn</th>
                <th>Tổng tiền</th>
                <th>Đã thu</th>
                <th>Ngày lập</th>
                <th>Hạn đóng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {hoaDon.map((hd) => (
                <tr key={hd.ma_hoa_don}>
                  <td style={{ fontWeight: 600 }}>{hd.ma_hoa_don}</td>
                  <td>{money(hd.tong_tien)}</td>
                  <td>{money(hd.da_thu)}</td>
                  <td>{date(hd.ngay_lap)}</td>
                  <td>{date(hd.han_dong_tien)}</td>
                  <td>{text(hd.trang_thai)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Chữ ký ── */}
      <section className={styles.section} style={{ marginTop: 16 }}>
        <h2 className={styles.sectionTitle}>Chữ ký</h2>
        <div className={styles.signGrid}>
          <div className={styles.signBox}>
            <div className={styles.signLabel}>Bên A — {BEN_A.ten}</div>
            {hopDong.chu_ky_ben_a ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hopDong.chu_ky_ben_a}
                alt="Chữ ký Bên A"
                className={styles.signImage}
              />
            ) : (
              <div className={styles.signEmpty}>Chưa có chữ ký</div>
            )}
          </div>
          <div className={styles.signBox}>
            <div className={styles.signLabel}>
              Bên B — {text(hopDong.khach_ho_ten)}
            </div>
            {hopDong.chu_ky_ben_b ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hopDong.chu_ky_ben_b}
                alt="Chữ ký Bên B"
                className={styles.signImage}
              />
            ) : (
              <div className={styles.signEmpty}>Chưa có chữ ký</div>
            )}
          </div>
        </div>
      </section>
      </div>
    </AdminShell>
  );
}

/** Bản in A4 theo mẫu hợp đồng thuê phòng. */
function PrintDocument({
  bundle,
}: {
  bundle: NonNullable<Awaited<ReturnType<typeof getContractDetail>>>;
}) {
  const { hopDong, nguoiO, phuLuc } = bundle;

  return (
    <div className={styles.printDoc} id="contract-print-doc">
      <div className={styles.printHeader}>
        <div className={styles.printNation}>
          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
        </div>
        <div className={styles.printMotto}>Độc lập — Tự do — Hạnh phúc</div>
        <div className={styles.printRule} />
      </div>

      <div className={styles.printTitle}>HỢP ĐỒNG THUÊ PHÒNG TRỌ</div>
      <div className={styles.printMeta}>
        Số: {hopDong.ma_hop_dong} &nbsp;•&nbsp; Ngày {date(hopDong.ngay_ky)}
      </div>

      <p style={{ textAlign: "center", fontStyle: "italic", marginBottom: 14 }}>
        Hôm nay, ngày {date(hopDong.ngay_ky)}, tại địa chỉ {BEN_A.thuongTru},
        chúng tôi gồm:
      </p>

      <div className={styles.printSection}>
        <div className={styles.printSectionTitle}>BÊN CHO THUÊ (BÊN A)</div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Ông/Bà:</span>
          <span>{BEN_A.ten}</span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>CMND/CCCD số:</span>
          <span>
            {BEN_A.cccd} — Ngày cấp: {BEN_A.ngayCap} — Nơi cấp: {BEN_A.noiCap}
          </span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Địa chỉ thường trú:</span>
          <span>{BEN_A.thuongTru}</span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Số điện thoại:</span>
          <span>{BEN_A.dienThoai}</span>
        </div>
      </div>

      <div className={styles.printSection}>
        <div className={styles.printSectionTitle}>BÊN THUÊ (BÊN B)</div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Ông/Bà:</span>
          <span>{text(hopDong.khach_ho_ten)}</span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>CMND/CCCD số:</span>
          <span>{text(hopDong.khach_cccd)}</span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Địa chỉ thường trú:</span>
          <span>{text(hopDong.khach_dia_chi)}</span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Số điện thoại:</span>
          <span>{text(hopDong.khach_so_dt)}</span>
        </div>
      </div>

      <div className={styles.printSection}>
        <div className={styles.printSectionTitle}>ĐIỀU 1 — NỘI DUNG THUÊ</div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Phòng thuê:</span>
          <span>
            {text(hopDong.phong_ten)} ({text(hopDong.ma_phong)}) —{" "}
            {text(hopDong.phong_toa)}
            {hopDong.phong_tang !== null ? `, tầng ${hopDong.phong_tang}` : ""}
            {hopDong.phong_dien_tich
              ? `, diện tích ${hopDong.phong_dien_tich} m²`
              : ""}
          </span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Thời hạn thuê:</span>
          <span>
            Từ ngày {date(hopDong.ngay_bd)} đến ngày {date(hopDong.ngay_kt)}
          </span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Giá thuê:</span>
          <span>{money(hopDong.gia_thue_thoa_thuan)}/tháng</span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Chu kỳ thanh toán:</span>
          <span>
            {hopDong.chu_ky_thu_tien
              ? `${hopDong.chu_ky_thu_tien} tháng/lần`
              : "Theo thỏa thuận"}
          </span>
        </div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Số người ở tối đa:</span>
          <span>04 người</span>
        </div>
      </div>

      <div className={styles.printSection}>
        <div className={styles.printSectionTitle}>ĐIỀU 2 — ĐẶT CỌC</div>
        <div className={styles.printRow}>
          <span className={styles.printRowLabel}>Tiền đặt cọc:</span>
          <span>
            {money(hopDong.tien_dat_coc)} (Bên B thanh toán ngay khi ký hợp
            đồng)
          </span>
        </div>
      </div>

      {nguoiO.length > 0 && (
        <div className={styles.printSection}>
          <div className={styles.printSectionTitle}>
            ĐIỀU 3 — DANH SÁCH NGƯỜI Ở CÙNG
          </div>
          <table className={styles.table} style={{ fontFamily: "inherit" }}>
            <thead>
              <tr>
                <th>STT</th>
                <th>Họ tên</th>
                <th>CCCD</th>
                <th>Vai trò</th>
              </tr>
            </thead>
            <tbody>
              {nguoiO.map((nguoi, index) => (
                <tr key={nguoi.ma_khach}>
                  <td>{index + 1}</td>
                  <td>{text(nguoi.ho_ten_khach)}</td>
                  <td>{text(nguoi.cccd)}</td>
                  <td>{isRep(nguoi.vai_tro) ? "Đại diện hợp đồng" : "Thành viên ở cùng"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {phuLuc.length > 0 && (
        <div className={styles.printSection}>
          <div className={styles.printSectionTitle}>
            ĐIỀU 4 — GIA HẠN HỢP ĐỒNG
          </div>
          <table className={styles.table} style={{ fontFamily: "inherit" }}>
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã phụ lục</th>
                <th>Ngày lập</th>
                <th>Gia hạn đến</th>
                <th>Giá thuê mới</th>
                <th>Nội dung điều chỉnh</th>
              </tr>
            </thead>
            <tbody>
              {phuLuc.map((pl, index) => (
                <tr key={pl.ma_phu_luc}>
                  <td>{index + 1}</td>
                  <td>{pl.ma_phu_luc}</td>
                  <td>{date(pl.ngay_lap)}</td>
                  <td>{date(pl.ngay_gia_han_den)}</td>
                  <td>{money(pl.gia_thue_moi)}</td>
                  <td>{text(pl.noi_dung_dieu_chinh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.printSection}>
        <div className={styles.printSectionTitle}>ĐIỀU 5 — CAM KẾT CHUNG</div>
        <p style={{ margin: 0 }}>
          Hai bên cam kết thực hiện đúng các điều khoản đã ghi trong hợp đồng.
          Hợp đồng được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý
          như nhau.
        </p>
      </div>

      <div className={styles.printSigns}>
        <div className={styles.printSignCol}>
          <div className={styles.printSignTitle}>BÊN CHO THUÊ (BÊN A)</div>
          <div className={styles.printSignHint}>(Ký, ghi rõ họ tên)</div>
          {hopDong.chu_ky_ben_a ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hopDong.chu_ky_ben_a}
              alt="Chữ ký Bên A"
              className={styles.printSignImage}
            />
          ) : (
            <div style={{ height: 70 }} />
          )}
          <div style={{ marginTop: 6 }}>{BEN_A.ten}</div>
        </div>
        <div className={styles.printSignCol}>
          <div className={styles.printSignTitle}>BÊN THUÊ (BÊN B)</div>
          <div className={styles.printSignHint}>(Ký, ghi rõ họ tên)</div>
          {hopDong.chu_ky_ben_b ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hopDong.chu_ky_ben_b}
              alt="Chữ ký Bên B"
              className={styles.printSignImage}
            />
          ) : (
            <div style={{ height: 70 }} />
          )}
          <div style={{ marginTop: 6 }}>{text(hopDong.khach_ho_ten)}</div>
        </div>
      </div>

      <div
        className="noPrint"
        style={{ marginTop: 20, fontSize: 11, color: "#64748b" }}
      >
        <Printer size={12} /> Bản in xem trước — dùng nút “In / Lưu PDF” để xuất
        tệp.
      </div>
    </div>
  );
}

export default function ContractDetailPage({ params }: { params: Params }) {
  return <ContractDetailContent params={params} />;
}
