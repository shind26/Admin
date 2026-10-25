"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  Printer,
  Download,
  Loader2,
  Check,
  Sparkles,
  Trash2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type { RoomAssetRow } from "@/lib/queries";
import { exportElementToPdf } from "@/lib/export-pdf";
import {
  createAsset,
  deleteAsset,
  updateAsset,
  type AssetFormState,
} from "./asset-actions";
import styles from "./room-assets.module.css";

export const ASSET_STATUSES = [
  "Hoạt động tốt",
  "Bình thường",
  "Cần bảo dưỡng",
  "Hỏng / Cần thay thế",
];

export const QUICK_ASSET_CHIPS = [
  { label: "Điều hòa Daikin 1.5 HP", ten: "Máy lạnh Inverter 1.5 HP", hang: "Daikin", gia: 9500000, sl: 1 },
  { label: "Tủ lạnh Aqua 140L", ten: "Tủ lạnh Inverter 140L", hang: "Aqua", gia: 4200000, sl: 1 },
  { label: "Bình nóng lạnh Ariston 20L", ten: "Bình nóng lạnh 20L", hang: "Ariston", gia: 2800000, sl: 1 },
  { label: "Giường gỗ & Nệm cao su", ten: "Giường ngủ gỗ sồi 1m6 & Nệm cao su", hang: "Hoàng Anh Gia Lai", gia: 5500000, sl: 1 },
  { label: "Tủ quần áo 3 cánh", ten: "Tủ quần áo 3 cánh gỗ MDF", hang: "An Cường", gia: 3200000, sl: 1 },
  { label: "Bàn làm việc & Ghế xoay", ten: "Bàn làm việc & Ghế xoay", hang: "Hòa Phát", gia: 1800000, sl: 1 },
  { label: "Máy giặt Inverter 8.5kg", ten: "Máy giặt Inverter 8.5kg", hang: "Electrolux", gia: 7200000, sl: 1 },
  { label: "Bếp điện từ đơn", ten: "Bếp điện từ đơn", hang: "Sunhouse", gia: 850000, sl: 1 },
  { label: "Quạt treo tường", ten: "Quạt treo tường có remote", hang: "Senko", gia: 450000, sl: 1 },
  { label: "Rèm cửa cản sáng", ten: "Rèm cửa cản sáng 2 lớp", hang: "Cao cấp", gia: 800000, sl: 1 },
  { label: "Remote máy lạnh", ten: "Điều khiển (Remote) máy lạnh", hang: "Daikin", gia: 350000, sl: 1 },
  { label: "Khóa thông minh vân tay", ten: "Khóa cửa thông minh vân tay", hang: "Kaadas", gia: 4500000, sl: 1 },
];

const initialState: AssetFormState = { error: null, success: null };

function formatMoney(value: string | number | null | undefined): string {
  if (!value || Number(value) === 0) return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function badgeClass(status: string): string {
  switch (status) {
    case "Hoạt động tốt":
      return styles.badgeOk;
    case "Bình thường":
      return styles.badgeInfo;
    case "Cần bảo dưỡng":
      return styles.badgeWarn;
    case "Hỏng / Cần thay thế":
    case "Hỏng":
      return styles.badgeDanger;
    default:
      return styles.badgeInfo;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "Hoạt động tốt":
    case "Bình thường":
      return <CheckCircle2 size={12} />;
    case "Cần bảo dưỡng":
      return <AlertTriangle size={12} />;
    case "Hỏng / Cần thay thế":
    case "Hỏng":
      return <XCircle size={12} />;
    default:
      return null;
  }
}

/** Form Modal Thêm mới hoặc Sửa tài sản */
function AssetModal({
  mode,
  maPhong,
  asset,
  onClose,
}: {
  mode: "create" | "edit";
  maPhong: string;
  asset?: RoomAssetRow | null;
  onClose: () => void;
}) {
  const action = mode === "create" ? createAsset : updateAsset;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [tenTaiSan, setTenTaiSan] = useState(asset?.ten_tai_san ?? "");
  const [soLuong, setSoLuong] = useState<number | string>(asset?.so_luong ?? 1);
  const [tinhTrang, setTinhTrang] = useState(asset?.tinh_trang ?? "Hoạt động tốt");
  const [thuongHieu, setThuongHieu] = useState(asset?.thuong_hieu ?? "");
  const [soSerial, setSoSerial] = useState(asset?.so_serial ?? "");
  const [giaTri, setGiaTri] = useState<number | string>(
    asset?.gia_tri ? Number(asset.gia_tri) : "",
  );
  const [ghiChu, setGhiChu] = useState(asset?.ghi_chu ?? "");

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        onClose();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  const handleQuickPick = (item: (typeof QUICK_ASSET_CHIPS)[number]) => {
    setTenTaiSan(item.ten);
    setThuongHieu(item.hang);
    setGiaTri(item.gia);
    setSoLuong(item.sl);
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <button
        type="button"
        className={styles.modalBackdrop}
        onClick={onClose}
        aria-label="Đóng"
      />
      <div className={styles.modalPanel}>
        <header className={styles.modalHead}>
          <h3 className={styles.modalTitle}>
            {mode === "create"
              ? "Thêm thiết bị / tài sản vào phòng"
              : `Sửa tài sản: ${asset?.ten_tai_san}`}
          </h3>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </header>

        <form action={formAction} className={styles.modalBody}>
          <input type="hidden" name="maPhong" value={maPhong} />
          {mode === "edit" && (
            <input type="hidden" name="maTaiSan" value={asset?.ma_tai_san ?? ""} />
          )}

          <div className={styles.formGrid}>
            {mode === "create" && (
              <div className={styles.quickChipsBox}>
                <div className={styles.quickChipsTitle}>
                  <Sparkles size={13} /> Chọn nhanh mẫu thiết bị phổ biến (bấm để tự điền thông tin):
                </div>
                <div className={styles.quickChipsList}>
                  {QUICK_ASSET_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      className={styles.quickChipBtn}
                      onClick={() => handleQuickPick(chip)}
                      title={`Tự điền: ${chip.ten} (${chip.hang}) - ${chip.gia.toLocaleString("vi-VN")} đ`}
                    >
                      + {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.formField}>
              <label htmlFor="tenTaiSan">Tên thiết bị / tài sản *</label>
              <input
                id="tenTaiSan"
                name="tenTaiSan"
                value={tenTaiSan}
                onChange={(e) => setTenTaiSan(e.target.value)}
                placeholder="VD: Điều hòa, Tủ lạnh, Giường nệm..."
                required
                maxLength={150}
                autoFocus
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="soLuong">Số lượng *</label>
              <input
                id="soLuong"
                name="soLuong"
                type="number"
                min={1}
                value={soLuong}
                onChange={(e) => setSoLuong(e.target.value)}
                required
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="tinhTrang">Tình trạng *</label>
              <select
                id="tinhTrang"
                name="tinhTrang"
                value={tinhTrang}
                onChange={(e) => setTinhTrang(e.target.value)}
                required
              >
                {ASSET_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label htmlFor="thuongHieu">Thương hiệu / Hãng sản xuất</label>
              <input
                id="thuongHieu"
                name="thuongHieu"
                value={thuongHieu}
                onChange={(e) => setThuongHieu(e.target.value)}
                placeholder="VD: Daikin, Aqua, Panasonic..."
                maxLength={100}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="soSerial">Số Serial / Model</label>
              <input
                id="soSerial"
                name="soSerial"
                value={soSerial}
                onChange={(e) => setSoSerial(e.target.value)}
                placeholder="VD: DAK-INV-9921"
                maxLength={100}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="giaTri">Giá trị ước tính / đền bù (đ)</label>
              <input
                id="giaTri"
                name="giaTri"
                type="number"
                step="1000"
                min={0}
                value={giaTri}
                onChange={(e) => setGiaTri(e.target.value)}
                placeholder="VD: 3500000"
              />
            </div>

            <div className={`${styles.formField} ${styles.formFieldFull}`}>
              <label htmlFor="ghiChu">Ghi chú thêm</label>
              <input
                id="ghiChu"
                name="ghiChu"
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="VD: Có vết xước nhỏ ở góc tủ, còn bảo hành đến 12/2026..."
                maxLength={300}
              />
            </div>

            {state.error && (
              <p className={`${styles.formMessage} ${styles.formError}`} role="alert">
                {state.error}
              </p>
            )}
            {state.success && (
              <p className={`${styles.formMessage} ${styles.formSuccess}`} role="status">
                {state.success}
              </p>
            )}

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={onClose}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={pending}
              >
                {pending ? (
                  <>
                    <LoaderCircle size={14} className={styles.spinner} /> Đang lưu...
                  </>
                ) : mode === "create" ? (
                  "Thêm thiết bị"
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Form Modal In Biên bản bàn giao & nghiệm thu tài sản */
function HandoverPrintModal({
  maPhong,
  tenPhong,
  toaNha,
  tang,
  khachThue,
  assets,
  onClose,
}: {
  maPhong: string;
  tenPhong: string;
  toaNha: string | null;
  tang: number | null;
  khachThue: string | null;
  assets: RoomAssetRow[];
  onClose: () => void;
}) {
  const [docType, setDocType] = useState<"checkin" | "checkout">("checkin");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const todayStr = new Date().toLocaleDateString("vi-VN");

  const totalQty = assets.reduce((sum, item) => sum + (item.so_luong || 1), 0);
  const totalValue = assets.reduce((sum, item) => sum + Number(item.gia_tri || 0), 0);

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      const prefix = docType === "checkin" ? "BienBanNhanPhong" : "BienBanTraPhong";
      await exportElementToPdf("handover-print-doc", `${prefix}_${maPhong}`);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Lỗi xuất PDF biên bản:", err);
      alert("Không thể tạo file PDF. Vui lòng bấm 'In biên bản' và chọn 'Save as PDF'.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <button
        type="button"
        className={styles.modalBackdrop}
        onClick={onClose}
        aria-label="Đóng"
      />
      <div className={`${styles.modalPanel} ${styles.modalPanelPrint}`}>
        <header className={`${styles.modalHead} ${styles.noPrint}`}>
          <div className={styles.handoverHeaderControls}>
            <div className={styles.handoverTypeSelect}>
              <label htmlFor="handoverType">Loại biên bản:</label>
              <select
                id="handoverType"
                value={docType}
                onChange={(e) => setDocType(e.target.value as "checkin" | "checkout")}
              >
                <option value="checkin">1. Bàn giao khi nhận phòng (Check-in)</option>
                <option value="checkout">2. Nghiệm thu thanh lý khi trả phòng (Check-out)</option>
              </select>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => window.print()}
              title="In biên bản A4 hoặc chọn Save as PDF qua trình duyệt"
            >
              <Printer size={15} /> In biên bản (A4)
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleDownloadPdf}
              disabled={isExporting}
              title="Tải trực tiếp tệp PDF miễn phí"
            >
              {isExporting ? (
                <>
                  <Loader2 size={14} className={styles.spin} /> Đang tải...
                </>
              ) : exportSuccess ? (
                <>
                  <Check size={14} color="#16a34a" /> Đã tải xong
                </>
              ) : (
                <>
                  <Download size={14} /> Tải PDF (Miễn phí)
                </>
              )}
            </button>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </header>

        <div className={styles.modalBody}>
          <article className={styles.printDoc} id="handover-print-doc">
            <div className={styles.docNation}>
              <div className={styles.docNationHeading}>
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </div>
              <div className={styles.docNationMotto}>
                Độc lập - Tự do - Hạnh phúc
              </div>
              <div className={styles.docDivider} />
            </div>

            <h2 className={styles.docTitle}>
              {docType === "checkin"
                ? "BIÊN BẢN BÀN GIAO TRANG THIẾT BỊ VÀ TÀI SẢN PHÒNG"
                : "BIÊN BẢN NGHIỆM THU TÀI SẢN & THANH LÝ PHÒNG"}
            </h2>
            <div className={styles.docSubtitle}>
              (Kèm theo Hợp đồng thuê phòng số: .......................................)
            </div>

            <div className={styles.docMetaGrid}>
              <div>
                <strong>Cơ sở / Tòa nhà:</strong> {toaNha || "—"}
              </div>
              <div>
                <strong>Phòng:</strong> {tenPhong || maPhong} {tang ? `(Tầng ${tang})` : ""}
              </div>
              <div>
                <strong>Đại diện Bên A (Cho thuê):</strong> Quản lý cơ sở {toaNha || ""}
              </div>
              <div>
                <strong>Đại diện Bên B (Khách thuê):</strong> {khachThue || "..................................................."}
              </div>
              <div>
                <strong>Thời điểm kiểm kê:</strong> {todayStr}
              </div>
              <div>
                <strong>Mục đích:</strong> {docType === "checkin" ? "Bàn giao tài sản lúc nhận phòng" : "Nghiệm thu tài sản lúc thanh lý"}
              </div>
            </div>

            <table className={styles.docTable}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>STT</th>
                  <th>Tên thiết bị / Tài sản</th>
                  <th>Nhãn hiệu / Model</th>
                  <th>Số Serial</th>
                  <th style={{ width: 60 }}>SL</th>
                  <th>Tình trạng bàn giao</th>
                  <th>Đơn giá ước tính</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 20 }}>
                      Chưa có danh mục thiết bị được ghi nhận trong phòng này.
                    </td>
                  </tr>
                ) : (
                  assets.map((item, idx) => (
                    <tr key={item.ma_tai_san}>
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td>
                        <strong>{item.ten_tai_san}</strong>
                      </td>
                      <td>{item.thuong_hieu || "—"}</td>
                      <td style={{ fontFamily: "monospace" }}>{item.so_serial || "—"}</td>
                      <td style={{ textAlign: "center" }}>{item.so_luong}</td>
                      <td>{item.tinh_trang}</td>
                      <td style={{ textAlign: "right" }}>{formatMoney(item.gia_tri)}</td>
                      <td>{item.ghi_chu || ""}</td>
                    </tr>
                  ))
                )}
                {assets.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>
                      Tổng cộng:
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{totalQty}</td>
                    <td></td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {formatMoney(totalValue)}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>

            <p className={styles.docTerms}>
              {docType === "checkin"
                ? "Hai bên đã cùng nhau kiểm tra, vận hành thử và xác nhận toàn bộ danh mục tài sản, trang thiết bị nêu trên đều đúng số lượng và hiện trạng kỹ thuật như mô tả. Bên thuê có trách nhiệm bảo quản, giữ gìn tài sản trong suốt thời hạn thuê. Mọi hư hỏng, mất mát do lỗi chủ quan sẽ được đền bù theo đơn giá đã thống nhất hoặc sửa chữa theo chi phí thực tế khi thanh lý hợp đồng."
                : "Hai bên đã đối chiếu, kiểm tra hiện trạng tài sản lúc hoàn trả phòng. Mọi hao mòn tự nhiên được chấp nhận; các hư hỏng hoặc mất mát (nếu có) sẽ được khấu trừ trực tiếp vào tiền đặt cọc theo biên bản thanh lý."}
            </p>

            <div className={styles.docSignatures}>
              <div className={styles.signatureBox}>
                <div className={styles.signatureTitle}>ĐẠI DIỆN BÊN CHO THUÊ</div>
                <div className={styles.signatureHint}>(Ký và ghi rõ họ tên)</div>
                <div className={styles.signatureSpace} />
              </div>
              <div className={styles.signatureBox}>
                <div className={styles.signatureTitle}>ĐẠI DIỆN BÊN THUÊ</div>
                <div className={styles.signatureHint}>(Ký và ghi rõ họ tên)</div>
                <div className={styles.signatureSpace} />
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/** Nút Xóa tài sản */
function DeleteAssetButton({
  maPhong,
  maTaiSan,
  tenTaiSan,
}: {
  maPhong: string;
  maTaiSan: string;
  tenTaiSan: string;
}) {
  const [state, formAction, pending] = useActionState(deleteAsset, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Bạn có chắc muốn xóa thiết bị "${tenTaiSan}" khỏi phòng?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="maPhong" value={maPhong} />
      <input type="hidden" name="maTaiSan" value={maTaiSan} />
      <button
        type="submit"
        className={styles.btnDangerSmall}
        disabled={pending}
        title="Xóa thiết bị này"
      >
        <Trash2 size={13} /> {pending ? "..." : "Xóa"}
      </button>
      {state.error && <span className={styles.formError}>{state.error}</span>}
    </form>
  );
}

/** Component Quản lý Tài sản & Thiết bị trong phòng */
export function RoomAssetManager({
  maPhong,
  tenPhong,
  toaNha,
  tang,
  khachThue,
  assets,
  canEdit = true,
}: {
  maPhong: string;
  tenPhong: string;
  toaNha: string | null;
  tang: number | null;
  khachThue: string | null;
  assets: RoomAssetRow[];
  canEdit?: boolean;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<RoomAssetRow | null>(null);
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  // Thống kê nhanh
  const totalItems = assets.reduce((sum, a) => sum + (a.so_luong || 1), 0);
  const goodCount = assets.filter(
    (a) => a.tinh_trang === "Hoạt động tốt" || a.tinh_trang === "Bình thường",
  ).length;
  const maintenanceCount = assets.filter((a) => a.tinh_trang === "Cần bảo dưỡng").length;
  const brokenCount = assets.filter(
    (a) => a.tinh_trang === "Hỏng / Cần thay thế" || a.tinh_trang === "Hỏng",
  ).length;
  const totalValue = assets.reduce((sum, a) => sum + Number(a.gia_tri || 0), 0);

  return (
    <section className={styles.container}>
      {/* ── Tiêu đề & Cụm nút hành động ── */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Danh mục Tài sản &amp; Thiết bị trong phòng</h2>
          <p className={styles.subTitle}>
            Quản lý số lượng, tình trạng, số serial phục vụ bàn giao và kiểm kê khi thanh lý.
          </p>
        </div>

        <div className={styles.actionsGroup}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setShowHandoverModal(true)}
            title="Xem và in Biên bản bàn giao thiết bị khổ A4"
          >
            <FileText size={14} /> In biên bản bàn giao
          </button>

          {canEdit && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={14} /> Thêm thiết bị
            </button>
          )}
        </div>
      </div>

      {/* ── Khung thống kê nhanh ── */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>Tổng thiết bị</span>
          <span className={styles.statValue}>
            {assets.length} loại ({totalItems} món)
          </span>
        </div>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>Hoạt động tốt</span>
          <span className={`${styles.statValue} ${styles.statValueOk}`}>{goodCount}</span>
        </div>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>Cần bảo dưỡng</span>
          <span className={`${styles.statValue} ${styles.statValueWarn}`}>
            {maintenanceCount}
          </span>
        </div>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>Hỏng / Cần thay</span>
          <span className={`${styles.statValue} ${styles.statValueDanger}`}>
            {brokenCount}
          </span>
        </div>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>Tổng giá trị ước tính</span>
          <span className={styles.statValue}>{formatMoney(totalValue)}</span>
        </div>
      </div>

      {/* ── Bảng danh sách thiết bị ── */}
      <div className={styles.tableCard}>
        {assets.length === 0 ? (
          <div className={styles.emptyState}>
            <Package size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
            <p>Phòng này chưa có danh mục thiết bị cụ thể nào.</p>
            {canEdit && (
              <p style={{ marginTop: 6, fontSize: 12 }}>
                Bấm nút <strong>&quot;+ Thêm thiết bị&quot;</strong> ở trên để bắt đầu quản lý trang thiết bị trong phòng.
              </p>
            )}
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên thiết bị</th>
                  <th>Hãng / Model</th>
                  <th>Số Serial</th>
                  <th>SL</th>
                  <th>Tình trạng</th>
                  <th>Giá trị ước tính</th>
                  <th>Ghi chú</th>
                  {canEdit && <th style={{ textAlign: "right" }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {assets.map((item) => (
                  <tr key={item.ma_tai_san}>
                    <td>
                      <div className={styles.assetName}>{item.ten_tai_san}</div>
                      <div className={styles.assetCode}>{item.ma_tai_san}</div>
                    </td>
                    <td>
                      <span className={styles.brandTag}>{item.thuong_hieu || "—"}</span>
                    </td>
                    <td>
                      <span className={styles.serialCode}>{item.so_serial || "—"}</span>
                    </td>
                    <td>
                      <strong>{item.so_luong}</strong>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass(item.tinh_trang)}`}>
                        {statusIcon(item.tinh_trang)}
                        {item.tinh_trang}
                      </span>
                    </td>
                    <td className={styles.moneyCol}>{formatMoney(item.gia_tri)}</td>
                    <td style={{ maxWidth: 220, fontSize: 12, color: "#64748b" }}>
                      {item.ghi_chu || "—"}
                    </td>
                    {canEdit && (
                      <td>
                        <div className={styles.tableActions}>
                          {(item.tinh_trang === "Cần bảo dưỡng" ||
                            item.tinh_trang === "Hỏng / Cần thay thế" ||
                            item.tinh_trang === "Hỏng") && (
                            <Link
                              href={`/su-co?room=${encodeURIComponent(maPhong)}&category=${encodeURIComponent(item.ten_tai_san)}`}
                              className={styles.btnGhost}
                              title="Tạo báo cáo sự cố bảo trì cho thiết bị này"
                            >
                              <Wrench size={13} /> Báo sự cố
                            </Link>
                          )}
                          <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => setEditingAsset(item)}
                            title="Sửa thông tin thiết bị"
                          >
                            <Pencil size={13} /> Sửa
                          </button>
                          <DeleteAssetButton
                            maPhong={maPhong}
                            maTaiSan={item.ma_tai_san}
                            tenTaiSan={item.ten_tai_san}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Thêm mới ── */}
      {showCreateModal && (
        <AssetModal
          mode="create"
          maPhong={maPhong}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* ── Modal Chỉnh sửa ── */}
      {editingAsset && (
        <AssetModal
          mode="edit"
          maPhong={maPhong}
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
        />
      )}

      {/* ── Modal In Biên bản bàn giao ── */}
      {showHandoverModal && (
        <HandoverPrintModal
          maPhong={maPhong}
          tenPhong={tenPhong}
          toaNha={toaNha}
          tang={tang}
          khachThue={khachThue}
          assets={assets}
          onClose={() => setShowHandoverModal(false)}
        />
      )}
    </section>
  );
}
