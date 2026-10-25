"use client";

/**
 * Xuất một phần tử HTML thành tệp PDF chuẩn A4 (hoàn toàn miễn phí, chạy phía client).
 * Sử dụng thư viện mã nguồn mở html2pdf.js kết hợp html2canvas + jsPDF.
 */
export async function exportElementToPdf(
  elementIdOrElement: string | HTMLElement,
  filename: string,
  options?: {
    margin?: number | [number, number, number, number];
    format?: string;
    orientation?: "portrait" | "landscape";
  }
): Promise<void> {
  if (typeof window === "undefined") return;

  const element =
    typeof elementIdOrElement === "string"
      ? document.getElementById(elementIdOrElement)
      : elementIdOrElement;

  if (!element) {
    throw new Error(`Không tìm thấy phần tử để xuất PDF: ${elementIdOrElement}`);
  }

  // Dynamic import để tránh lỗi SSR (html2pdf chỉ chạy trên môi trường browser có window)
  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default || html2pdfModule;

  const pdfFilename = filename.toLowerCase().endsWith(".pdf")
    ? filename
    : `${filename}.pdf`;

  const opt = {
    margin: options?.margin ?? [12, 12, 12, 12], // mm
    filename: pdfFilename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2, // 2x DPI cho văn bản in sắc nét, chữ ký rõ ràng
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
    },
    jsPDF: {
      unit: "mm",
      format: options?.format ?? "a4",
      orientation: options?.orientation ?? "portrait",
    },
  };

  // @ts-expect-error html2pdf callable interface
  await html2pdf().set(opt).from(element).save();
}

