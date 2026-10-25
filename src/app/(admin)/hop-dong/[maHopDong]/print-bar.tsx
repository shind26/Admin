"use client";

import { useEffect, useState } from "react";
import { Eye, Printer, Download, Loader2, Check, X } from "lucide-react";
import { exportElementToPdf } from "@/lib/export-pdf";
import styles from "./contract-detail.module.css";

/**
 * Thanh công cụ xuất hợp đồng:
 * - "Xem bản in": Bật/tắt bản xem trước A4 trực quan ngay trên trang.
 * - "In hợp đồng": Gọi hộp thoại in của hệ thống (chỉ in nội dung hợp đồng, ẩn toàn bộ admin shell).
 * - "Tải PDF (Miễn phí)": Tự động kết xuất và tải về tệp PDF chuẩn nét cao hoàn toàn miễn phí.
 */
export function ContractPrintBar({
  children,
  maHopDong,
}: {
  children: React.ReactNode;
  maHopDong?: string;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Chỉ in sau khi state đã commit và trình duyệt đã layout xong
  useEffect(() => {
    if (!pendingPrint) return;
    const timer = setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [pendingPrint]);

  const handlePrint = () => {
    // Nếu chưa mở preview, mở preview để DOM layout chuẩn rồi in
    setShowPreview(true);
    setPendingPrint(true);
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      // Mở preview nếu đang đóng để DOM được render vào layout cho html2canvas
      if (!showPreview) {
        setShowPreview(true);
        await new Promise((r) => setTimeout(r, 200));
      }

      const fileName = `HopDong_${maHopDong || "thue_phong"}`;
      await exportElementToPdf("contract-print-doc", fileName);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Lỗi khi tạo PDF:", err);
      // Thông báo người dùng cách thay thế bằng In của trình duyệt nếu cần
      alert(
        "Không thể tự động xuất PDF trên trình duyệt này. Vui lòng bấm nút 'In hợp đồng' và chọn 'Lưu dưới dạng PDF' (Save as PDF)."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className={`${styles.printBar} noPrint`}>
        <button
          type="button"
          className={styles.printButton}
          onClick={() => setShowPreview((value) => !value)}
        >
          <Eye size={14} /> {showPreview ? "Thu gọn bản in" : "Xem bản in trước"}
        </button>

        <button
          type="button"
          className={`${styles.printButton} ${styles.printButtonPrimary}`}
          onClick={handlePrint}
          title="In tài liệu hợp đồng hoặc chọn Save as PDF của trình duyệt"
        >
          <Printer size={14} /> In hợp đồng
        </button>

        <button
          type="button"
          className={`${styles.printButton} ${styles.printButtonPdf}`}
          onClick={handleDownloadPdf}
          disabled={isExporting}
          title="Tải trực tiếp tệp PDF về máy (100% miễn phí)"
        >
          {isExporting ? (
            <>
              <Loader2 size={14} className={styles.spin} /> Đang tạo PDF...
            </>
          ) : exportSuccess ? (
            <>
              <Check size={14} color="#16a34a" /> Đã tải xong PDF
            </>
          ) : (
            <>
              <Download size={14} /> Tải PDF (Miễn phí)
            </>
          )}
        </button>
      </div>

      <div
        id="contract-print-container"
        className={`${styles.previewContainer} ${
          showPreview ? styles.previewOpen : styles.previewClosed
        }`}
      >
        <div className="noPrint" style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className={styles.printButton}
            onClick={() => setShowPreview(false)}
          >
            <X size={14} /> Đóng bản in
          </button>
        </div>
        <div className={styles.previewCard}>{children}</div>
      </div>
    </>
  );
}
