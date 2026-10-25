export type MeterAnomaly = {
  hasAnomaly: boolean;
  spikeDien: boolean;
  spikeNuoc: boolean;
  zeroUsage: boolean;
  details: string[];
  severity: "high" | "medium" | "none";
};

export type MeterAnomalyInput = {
  dien_tieu_thu: string | number | null;
  nuoc_tieu_thu: string | number | null;
  dien_ky_truoc?: string | number | null;
  nuoc_ky_truoc?: string | number | null;
  trang_thai_phong?: string | null;
};

/**
 * Phát hiện bất thường chỉ số điện nước:
 * 1. Tăng đột biến > 80% so với kỳ trước (đề phòng rò rỉ nước ngầm, chập điện).
 * 2. Tiêu thụ bằng 0 khi phòng đang có khách ở (nghi ngờ hỏng đồng hồ hoặc câu móc).
 */
export function detectMeterAnomaly(input: MeterAnomalyInput): MeterAnomaly {
  const dien = Number(input.dien_tieu_thu ?? 0);
  const nuoc = Number(input.nuoc_tieu_thu ?? 0);
  const prevDien = input.dien_ky_truoc != null ? Number(input.dien_ky_truoc) : null;
  const prevNuoc = input.nuoc_ky_truoc != null ? Number(input.nuoc_ky_truoc) : null;

  const details: string[] = [];
  let spikeDien = false;
  let spikeNuoc = false;
  let zeroUsage = false;
  let severity: "high" | "medium" | "none" = "none";

  // 1. Tăng đột biến điện > 80% so với kỳ trước
  if (prevDien !== null && prevDien > 0 && dien > 0) {
    const ratio = (dien - prevDien) / prevDien;
    if (ratio >= 0.8) {
      spikeDien = true;
      const pct = Math.round(ratio * 100);
      details.push(
        `⚡ Điện tăng đột biến +${pct}% so với tháng trước (${dien} kWh vs ${prevDien} kWh)`,
      );
      severity = "high";
    }
  }

  // 2. Tăng đột biến nước > 80% so với kỳ trước (Nguy cơ rò rỉ nước ngầm / hỏng phao bồn cầu)
  if (prevNuoc !== null && prevNuoc > 0 && nuoc > 0) {
    const ratio = (nuoc - prevNuoc) / prevNuoc;
    if (ratio >= 0.8) {
      spikeNuoc = true;
      const pct = Math.round(ratio * 100);
      details.push(
        `💧 Nước tăng đột biến +${pct}% (nguy cơ rò rỉ đường ống/bồn cầu: ${nuoc} m³ vs ${prevNuoc} m³)`,
      );
      severity = "high";
    }
  }

  // 3. Tiêu thụ = 0 khi phòng đang có khách ở
  if (dien === 0 || nuoc === 0) {
    zeroUsage = true;
    if (severity === "none") severity = "medium";

    if (dien === 0 && nuoc === 0) {
      details.push("⚠️ Cả điện và nước đều = 0 (khách vắng nhà dài ngày hoặc đồng hồ kẹt số)");
    } else if (dien === 0) {
      details.push("⚡ Điện tiêu thụ = 0 kWh trong tháng (nghi ngờ đồng hồ điện hỏng/kẹt)");
    } else {
      details.push("💧 Nước tiêu thụ = 0 m³ trong tháng (nghi ngờ van khóa hoặc đồng hồ hỏng)");
    }
  }

  return {
    hasAnomaly: spikeDien || spikeNuoc || zeroUsage,
    spikeDien,
    spikeNuoc,
    zeroUsage,
    details,
    severity,
  };
}

