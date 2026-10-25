"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, Download, Loader2, Check } from "lucide-react";
import type { InvoiceDetail } from "@/lib/queries";
import { exportElementToPdf } from "@/lib/export-pdf";
import styles from "./invoice-detail.module.css";
import busStyles from "@/components/business.module.css";

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusBadgeClass(status: string | null) {
  if (status === "Đã thanh toán" || status === "Đã xác nhận" || status === "Đã khớp lệnh")
    return busStyles.badgeOk;
  if (status === "Thanh toán một phần") return busStyles.badgeInfo;
  return busStyles.badgeWarn;
}

export function InvoiceDetailView({
  invoice,
}: {
  invoice: InvoiceDetail;
}) {
  const isPhatSinh = invoice.loai_giao_dich?.toLowerCase().includes("phát sinh");
  const conLai = Number(invoice.con_lai || 0);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      await exportElementToPdf(
        `invoice-print-${invoice.ma_hoa_don}`,
        `HoaDon_${invoice.ma_hoa_don}`
      );
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Lỗi tải PDF hóa đơn:", err);
      alert("Không thể tạo file PDF. Vui lòng bấm 'In hóa đơn' và chọn 'Save as PDF'.");
    } finally {
      setIsExporting(false);
    }
  };

  // Determine line items
  const hasLineItems = invoice.chi_tiet && invoice.chi_tiet.length > 0;

  return (
    <div>
      {/* Top action toolbar (hidden on print) */}
      <div
        className={styles.noPrint}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={statusBadgeClass(invoice.trang_thai)}>
            {invoice.trang_thai}
          </span>
          <span className={isPhatSinh ? busStyles.badgeWarn : busStyles.badgeMuted}>
            {isPhatSinh ? "⚡ Hóa đơn phát sinh" : "📅 Hóa đơn định kỳ"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handlePrint}
            className={`${styles.btnIcon} ${styles.btnPrint}`}
            title="In hóa đơn hoặc lưu PDF qua trình duyệt"
          >
            <Printer size={14} /> In hóa đơn
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className={`${styles.btnIcon} ${styles.btnPdf}`}
            title="Tải trực tiếp file PDF hóa đơn miễn phí"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className={styles.spin} /> Đang tải PDF...
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
      </div>

      {/* Printable Invoice Document */}
      <div className={styles.billPaper} id={`invoice-print-${invoice.ma_hoa_don}`}>
        {/* Document Header */}
        <div className={styles.billHeader}>
          <div>
            <div className={styles.brandName}>HỆ THỐNG CĂN HỘ KIỀU GIANG</div>
            <div className={styles.brandSub}>
              Cơ sở vận hành: {invoice.toa_nha || "Toàn hệ thống"}
            </div>
            <div className={styles.brandSub}>Hotline hỗ trợ: 0903 111 222</div>
          </div>
          <div className={styles.billTitleBlock}>
            <h2 className={styles.billTitle}>HÓA ĐƠN THANH TOÁN</h2>
            <div className={styles.billCode}>Mã: {invoice.ma_hoa_don}</div>
            <div className={styles.billMetaRow}>
              <span className={statusBadgeClass(invoice.trang_thai)}>
                {invoice.trang_thai}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className={styles.billInfoGrid}>
          <div className={styles.infoCol}>
            <h4>Thông tin khách thuê</h4>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Khách đại diện:</span>
              <span className={styles.infoValue}>{invoice.ten_khach || "—"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Số điện thoại:</span>
              <span className={styles.infoValue}>{invoice.so_dt || "—"}</span>
            </div>
            {invoice.cccd && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Số CCCD:</span>
                <span className={styles.infoValue}>{invoice.cccd}</span>
              </div>
            )}
            {invoice.dia_chi_thuong_tru && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Thường trú:</span>
                <span className={styles.infoValue}>{invoice.dia_chi_thuong_tru}</span>
              </div>
            )}
          </div>

          <div className={styles.infoCol}>
            <h4>Thông tin phòng &amp; Kỳ thu</h4>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Phòng thuê:</span>
              <span className={styles.infoValue}>
                {invoice.ma_phong || "—"} {invoice.toa_nha ? `(${invoice.toa_nha})` : ""}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Hợp đồng:</span>
              <span className={styles.infoValue}>
                {invoice.ma_hop_dong ? (
                  <Link
                    href={`/hop-dong/${encodeURIComponent(invoice.ma_hop_dong)}`}
                    style={{ color: "#1e40af", textDecoration: "underline" }}
                  >
                    {invoice.ma_hop_dong}
                  </Link>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Ngày lập:</span>
              <span className={styles.infoValue}>{formatDate(invoice.ngay_lap)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Hạn thanh toán:</span>
              <span className={styles.infoValue} style={{ color: "#b91c1c" }}>
                {formatDate(invoice.han_dong_tien)}
              </span>
            </div>
          </div>
        </div>

        {/* Utility meter reading block if linked */}
        {invoice.chi_so_dien_nuoc && (
          <div className={styles.meterBox}>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              ⚡ Chi số tiêu thụ Điện Nước kỳ {invoice.chi_so_dien_nuoc.thang_nam}
            </div>
            <div className={styles.meterGrid}>
              <div className={styles.meterItem}>
                <div className={styles.meterLabel}>Điện sinh hoạt</div>
                <div>
                  Chỉ số cũ: <strong>{Number(invoice.chi_so_dien_nuoc.chi_so_dien_cu).toLocaleString("vi-VN")}</strong> → Mới: <strong>{Number(invoice.chi_so_dien_nuoc.chi_so_dien_moi).toLocaleString("vi-VN")}</strong>
                </div>
                <div style={{ marginTop: 2, color: "#15803d", fontWeight: 600 }}>
                  Tiêu thụ: {invoice.chi_so_dien_nuoc.tieu_thu_dien} kWh
                </div>
              </div>

              <div className={styles.meterItem}>
                <div className={styles.meterLabel}>Nước sinh hoạt</div>
                <div>
                  Chỉ số cũ: <strong>{Number(invoice.chi_so_dien_nuoc.chi_so_nuoc_cu).toLocaleString("vi-VN")}</strong> → Mới: <strong>{Number(invoice.chi_so_dien_nuoc.chi_so_nuoc_moi).toLocaleString("vi-VN")}</strong>
                </div>
                <div style={{ marginTop: 2, color: "#15803d", fontWeight: 600 }}>
                  Tiêu thụ: {invoice.chi_so_dien_nuoc.tieu_thu_nuoc} m³
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <div className={styles.sectionTitle}>📋 Chi tiết các khoản thanh toán</div>
        <table className={styles.billTable}>
          <thead>
            <tr>
              <th style={{ width: 45 }} className={styles.textCenter}>STT</th>
              <th>Khoản thu / Dịch vụ</th>
              <th style={{ width: 80 }} className={styles.textCenter}>Số lượng</th>
              <th style={{ width: 130 }} className={styles.textRight}>Đơn giá</th>
              <th style={{ width: 140 }} className={styles.textRight}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {hasLineItems ? (
              invoice.chi_tiet.map((item, idx) => (
                <tr key={item.ma_cthd || idx}>
                  <td className={styles.textCenter}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.ten_khoan_thu}</td>
                  <td className={styles.textCenter}>{Number(item.so_luong || 1).toLocaleString("vi-VN")}</td>
                  <td className={styles.textRight}>{formatMoney(item.don_gia)}</td>
                  <td className={`${styles.textRight} ${styles.infoValue}`}>
                    {formatMoney(item.thanh_tien)}
                  </td>
                </tr>
              ))
            ) : (
              /* Fallback for periodic invoices without individual line items */
              <>
                {Number(invoice.tien_phong || 0) > 0 && (
                  <tr>
                    <td className={styles.textCenter}>1</td>
                    <td style={{ fontWeight: 600 }}>Tiền thuê phòng tháng</td>
                    <td className={styles.textCenter}>1</td>
                    <td className={styles.textRight}>{formatMoney(invoice.tien_phong)}</td>
                    <td className={`${styles.textRight} ${styles.infoValue}`}>
                      {formatMoney(invoice.tien_phong)}
                    </td>
                  </tr>
                )}
                {Number(invoice.tien_dien_nuoc || 0) > 0 && (
                  <tr>
                    <td className={styles.textCenter}>2</td>
                    <td style={{ fontWeight: 600 }}>Tiền điện &amp; nước sinh hoạt</td>
                    <td className={styles.textCenter}>1</td>
                    <td className={styles.textRight}>{formatMoney(invoice.tien_dien_nuoc)}</td>
                    <td className={`${styles.textRight} ${styles.infoValue}`}>
                      {formatMoney(invoice.tien_dien_nuoc)}
                    </td>
                  </tr>
                )}
                {Number(invoice.tien_dich_vu_khac || 0) > 0 && (
                  <tr>
                    <td className={styles.textCenter}>3</td>
                    <td style={{ fontWeight: 600 }}>Dịch vụ trọn gói &amp; phụ phí</td>
                    <td className={styles.textCenter}>1</td>
                    <td className={styles.textRight}>{formatMoney(invoice.tien_dich_vu_khac)}</td>
                    <td className={`${styles.textRight} ${styles.infoValue}`}>
                      {formatMoney(invoice.tien_dich_vu_khac)}
                    </td>
                  </tr>
                )}
                {Number(invoice.no_cu || 0) > 0 && (
                  <tr>
                    <td className={styles.textCenter}>4</td>
                    <td style={{ fontWeight: 600, color: "#b91c1c" }}>Nợ cũ chuyển sang</td>
                    <td className={styles.textCenter}>1</td>
                    <td className={styles.textRight}>{formatMoney(invoice.no_cu)}</td>
                    <td className={`${styles.textRight} ${styles.infoValue}`} style={{ color: "#b91c1c" }}>
                      {formatMoney(invoice.no_cu)}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {/* Financial Summary */}
        <div className={styles.summaryContainer}>
          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span>Tổng tiền dịch vụ:</span>
              <span>{formatMoney(invoice.tong_tien)}</span>
            </div>
            <div className={styles.summaryPaidRow}>
              <span>Đã thanh toán:</span>
              <span>- {formatMoney(invoice.da_thu)}</span>
            </div>
            <div className={styles.summaryTotalRow}>
              <span>TỔNG PHẢI THU:</span>
              <span>{formatMoney(invoice.tong_tien)}</span>
            </div>
            <div className={styles.summaryDueRow}>
              <span>CÒN LẠI CẦN THU:</span>
              <span>{formatMoney(conLai)}</span>
            </div>
          </div>
        </div>

        {/* Payment History / Receipts */}
        <div className={styles.receiptsBox}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", marginBottom: 8 }}>
            💳 Lịch sử phiếu thu đã ghi nhận ({invoice.phieu_thu.length} giao dịch)
          </div>
          {invoice.phieu_thu.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#64748b", fontStyle: "italic" }}>
              Chưa có phiếu thu nào được xác nhận cho hóa đơn này.
            </div>
          ) : (
            <table className={styles.billTable} style={{ margin: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Mã phiếu thu</th>
                  <th>Ngày thu</th>
                  <th>Hình thức</th>
                  <th>Trạng thái</th>
                  <th className={styles.textRight}>Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {invoice.phieu_thu.map((pt) => (
                  <tr key={pt.ma_phieu_thu}>
                    <td style={{ fontWeight: 600 }}>{pt.ma_phieu_thu}</td>
                    <td>{formatDate(pt.ngay_thu)}</td>
                    <td>{pt.hinh_thuc || "Chuyển khoản"}</td>
                    <td>
                      <span className={statusBadgeClass(pt.trang_thai)}>
                        {pt.trang_thai}
                      </span>
                    </td>
                    <td className={`${styles.textRight} ${styles.infoValue}`}>
                      {formatMoney(pt.so_tien_thu)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer notes */}
        <div style={{ marginTop: 28, paddingTop: 14, borderTop: "1px dashed #cbd5e1", fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
          <div>
            * Quý khách vui lòng thanh toán đúng hạn quy định trên hóa đơn.
          </div>
          <div>Ngày in: {new Date().toLocaleDateString("vi-VN")}</div>
        </div>
      </div>
    </div>
  );
}

