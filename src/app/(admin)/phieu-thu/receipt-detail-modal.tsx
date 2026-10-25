"use client";

import { useState } from "react";
import { Printer, Download, Loader2, Check, Eye, X } from "lucide-react";
import type { ReceiptRow } from "@/lib/queries";
import { readVietnameseCurrency } from "@/lib/number-to-words";
import { exportElementToPdf } from "@/lib/export-pdf";
import styles from "./receipt-detail.module.css";
import busStyles from "@/components/business.module.css";

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "0 đ";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function parseDateComponents(dateStr: string | null | undefined) {
  if (!dateStr) {
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
  }
  const d = new Date(dateStr);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function statusBadgeClass(status: string | null) {
  if (status === "Đã xác nhận" || status === "Đã khớp lệnh") return busStyles.badgeOk;
  if (status === "Từ chối") return busStyles.badgeMuted;
  return busStyles.badgeWarn;
}

export function ReceiptDetailTrigger({
  receipt,
  children,
  asButton = false,
}: {
  receipt: ReceiptRow;
  children?: React.ReactNode;
  asButton?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const { day, month, year } = parseDateComponents(receipt.ngay_thu);
  const moneyInWords = readVietnameseCurrency(receipt.so_tien_thu);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      await exportElementToPdf(
        `receipt-print-${receipt.ma_phieu_thu}`,
        `PhieuThu_${receipt.ma_phieu_thu}`
      );
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Lỗi xuất PDF phiếu thu:", err);
      alert("Không thể tạo file PDF. Vui lòng bấm 'In phiếu thu' và chọn 'Save as PDF'.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {asButton ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${styles.btnAction} ${styles.btnDetail}`}
          title="Xem &amp; In phiếu thu"
        >
          <Eye size={13} /> {children || "In / Xem"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
            color: "#1e40af",
            fontWeight: 700,
            textDecoration: "underline",
          }}
          title="Bấm để xem &amp; In phiếu thu"
        >
          {children || receipt.ma_phieu_thu}
        </button>
      )}

      {open && (
        <div className={styles.modalBackdrop} onClick={() => setOpen(false)}>
          <div
            className={styles.modalContainer}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <h3 className={styles.modalTitle}>
                  Biên lai phiếu thu {receipt.ma_phieu_thu}
                </h3>
                <span className={statusBadgeClass(receipt.trang_thai)}>
                  {receipt.trang_thai}
                </span>
              </div>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  onClick={handlePrint}
                  className={`${styles.btnAction}`}
                  style={{ background: "#1e293b", color: "#ffffff" }}
                  title="In biên lai hoặc lưu PDF qua trình duyệt"
                >
                  <Printer size={13} /> In phiếu thu
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExporting}
                  className={`${styles.btnAction} ${styles.btnActionPdf}`}
                  title="Tải trực tiếp tệp PDF miễn phí"
                >
                  {isExporting ? (
                    <>
                      <Loader2 size={13} className={styles.spin} /> Đang tải...
                    </>
                  ) : exportSuccess ? (
                    <>
                      <Check size={13} color="#16a34a" /> Đã tải xong
                    </>
                  ) : (
                    <>
                      <Download size={13} /> Tải PDF (Miễn phí)
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={() => setOpen(false)}
                  aria-label="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className={styles.modalBody}>
              {/* Printable Receipt Paper */}
              <div className={styles.receiptPaper} id={`receipt-print-${receipt.ma_phieu_thu}`}>
                {/* Header */}
                <div className={styles.docHeader}>
                  <div className={styles.unitInfo}>
                    <div className={styles.unitName}>HỆ THỐNG CĂN HỘ KIỀU GIANG</div>
                    <div>Cơ sở: <strong>{receipt.toa_nha || "Toàn hệ thống"}</strong></div>
                    <div>Hotline: 0903 111 222</div>
                  </div>
                  <div className={styles.formTemplateInfo}>
                    <div style={{ fontWeight: 700 }}>Mẫu số: 01 - TT</div>
                    <div>(Ban hành theo TT số 133/2016/TT-BTC)</div>
                    <div style={{ marginTop: 4 }}>
                      Số: <strong>{receipt.ma_phieu_thu}</strong>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className={styles.docTitleBlock}>
                  <h2 className={styles.docTitle}>PHIẾU THU TIỀN</h2>
                  <div className={styles.docSubTitle}>
                    Ngày {day} tháng {month} năm {year}
                  </div>
                  <div className={styles.receiptMeta}>
                    <span>Hóa đơn: <strong>{receipt.ma_hoa_don || "—"}</strong></span>
                    <span>•</span>
                    <span>Phòng: <strong>{receipt.ma_phong || "—"}</strong></span>
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ margin: "20px 0" }}>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Họ và tên người nộp tiền:</span>
                    <span className={styles.fieldVal}>{receipt.ten_khach || "—"}</span>
                    <span className={styles.fieldDots} />
                  </div>

                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Địa chỉ / Phòng thuê:</span>
                    <span className={styles.fieldVal}>
                      Phòng {receipt.ma_phong || "—"} {receipt.toa_nha ? `(${receipt.toa_nha})` : ""}
                    </span>
                    <span className={styles.fieldDots} />
                  </div>

                  {receipt.so_dt && (
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>Số điện thoại liên hệ:</span>
                      <span className={styles.fieldVal}>{receipt.so_dt}</span>
                      <span className={styles.fieldDots} />
                    </div>
                  )}

                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Lý do nộp:</span>
                    <span className={styles.fieldVal}>
                      Thanh toán tiền phòng &amp; dịch vụ theo hóa đơn {receipt.ma_hoa_don}{" "}
                      {receipt.ma_hop_dong ? `(Hợp đồng: ${receipt.ma_hop_dong})` : ""}
                    </span>
                    <span className={styles.fieldDots} />
                  </div>

                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Số tiền thu:</span>
                    <span className={`${styles.fieldVal} ${styles.moneyHighlight}`}>
                      {formatMoney(receipt.so_tien_thu)}
                    </span>
                    <span className={styles.fieldDots} />
                  </div>

                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Viết bằng chữ:</span>
                    <span className={`${styles.fieldVal} ${styles.wordsHighlight}`}>
                      {moneyInWords}
                    </span>
                    <span className={styles.fieldDots} />
                  </div>

                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Hình thức nộp tiền:</span>
                    <span className={styles.fieldVal}>{receipt.hinh_thuc || "Chuyển khoản"}</span>
                    {receipt.ma_tra_cuu && (
                      <span style={{ marginLeft: 8, color: "#64748b" }}>
                        (Mã tra cứu / ủy nhiệm chi: <strong>{receipt.ma_tra_cuu}</strong>)
                      </span>
                    )}
                    <span className={styles.fieldDots} />
                  </div>
                </div>

                {/* Signatures */}
                <div className={styles.signSection}>
                  <div>
                    <div className={styles.signTitle}>Người nộp tiền</div>
                    <div className={styles.signSub}>(Ký, ghi rõ họ tên)</div>
                    <div className={styles.signName}>{receipt.ten_khach || "—"}</div>
                  </div>
                  <div>
                    <div className={styles.signTitle}>Người lập phiếu</div>
                    <div className={styles.signSub}>(Ký, ghi rõ họ tên)</div>
                    <div className={styles.signName}>Ban Quản Lý</div>
                  </div>
                  <div>
                    <div className={styles.signTitle}>Thủ quỹ / Quản lý</div>
                    <div className={styles.signSub}>(Ký, ghi rõ họ tên)</div>
                    <div className={styles.signName}>Đặng Thị Kiều Giang</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 36,
                    fontSize: 11,
                    color: "#94a3b8",
                    textAlign: "right",
                    fontStyle: "italic",
                  }}
                >
                  Phiếu thu điện tử xuất ngày {new Date().toLocaleDateString("vi-VN")}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

