"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";

function formatMoney(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0\u00A0đ";
  return `${Number(num).toLocaleString("vi-VN")}\u00A0đ`;
}

function formatCompactMoney(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)} tỷ`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)} tr`;
  }
  if (num >= 1_000) {
    return `${Math.round(num / 1_000)} k`;
  }
  return String(num);
}

// ─────────────────────────────────────────────────────────────
// 1. BIỂU ĐỒ CỘT DOANH THU & CÔNG NỢ 6 THÁNG GẦN NHẤT (SVG)
// ─────────────────────────────────────────────────────────────
type TrendItem = {
  monthKey: string;
  label: string;
  daThu: number;
  conNo: number;
  tongTien: number;
};

export function RevenueTrendBarChart({ data }: { data: TrendItem[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Tìm giá trị max để scale trục tung
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.daThu, d.conNo, d.tongTien)),
    1_000_000,
  );
  // Làm tròn mốc đỉnh đẹp (bội số của 1 triệu hoặc 5 triệu)
  const step = Math.ceil(maxVal / 4 / 500_000) * 500_000;
  const ceiling = Math.max(step * 4, 1_000_000);

  const chartHeight = 220;
  const chartWidth = 520;
  const paddingLeft = 56;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 32;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const barGroupWidth = innerWidth / data.length;
  const barWidth = Math.min(20, (barGroupWidth - 12) / 2);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Doanh thu &amp; Công nợ 6 tháng gần nhất</h3>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotCollected}`} />
            Đã thu
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotDebt}`} />
            Còn nợ
          </span>
        </div>
      </div>

      <div className={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className={styles.chartSvg}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines & Y-axis labels */}
          {[0, 1, 2, 3, 4].map((stepIdx) => {
            const val = (ceiling / 4) * stepIdx;
            const y = paddingTop + innerHeight - (val / ceiling) * innerHeight;
            return (
              <g key={stepIdx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray={stepIdx === 0 ? "none" : "2,2"}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10.5"
                  fill="var(--text-muted)"
                  fontFamily="inherit"
                >
                  {formatCompactMoney(val)}
                </text>
              </g>
            );
          })}

          {/* Bar Groups */}
          {data.map((item, idx) => {
            const groupCenterX = paddingLeft + (idx + 0.5) * barGroupWidth;

            // Chiều cao cột Đã thu
            const hCollected = Math.max(
              item.daThu > 0 ? 3 : 0,
              (item.daThu / ceiling) * innerHeight,
            );
            const yCollected = paddingTop + innerHeight - hCollected;
            const xCollected = groupCenterX - barWidth - 1.5;

            // Chiều cao cột Còn nợ
            const hDebt = Math.max(
              item.conNo > 0 ? 3 : 0,
              (item.conNo / ceiling) * innerHeight,
            );
            const yDebt = paddingTop + innerHeight - hDebt;
            const xDebt = groupCenterX + 1.5;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.monthKey}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Highlight background khi hover */}
                {isHovered && (
                  <rect
                    x={paddingLeft + idx * barGroupWidth + 2}
                    y={paddingTop}
                    width={barGroupWidth - 4}
                    height={innerHeight}
                    fill="var(--bg-subtle)"
                    rx="4"
                    opacity="0.8"
                  />
                )}

                {/* Cột Đã thu (Solid Primary) */}
                <rect
                  x={xCollected}
                  y={yCollected}
                  width={barWidth}
                  height={hCollected}
                  fill="var(--primary)"
                  rx="3"
                  opacity={isHovered ? 1 : 0.9}
                />

                {/* Cột Còn nợ (Solid Amber) */}
                <rect
                  x={xDebt}
                  y={yDebt}
                  width={barWidth}
                  height={hDebt}
                  fill="var(--status-warning-text)"
                  rx="3"
                  opacity={isHovered ? 1 : 0.85}
                />

                {/* Label tháng dưới đáy */}
                <text
                  x={groupCenterX}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? "600" : "500"}
                  fill={isHovered ? "var(--text-main)" : "var(--text-muted)"}
                  fontFamily="inherit"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip khi hover */}
        {hoveredIdx !== null && (
          <div
            className={styles.tooltipBox}
            style={{
              left: `${((paddingLeft + (hoveredIdx + 0.5) * barGroupWidth) / chartWidth) * 100}%`,
              transform:
                hoveredIdx === 0
                  ? "translateX(0%)"
                  : hoveredIdx >= data.length - 2
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
              top: 12,
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
              {data[hoveredIdx].label}
            </div>
            <div style={{ display: "flex", gap: 6, color: "var(--text-secondary)", marginBottom: 2 }}>
              <span>Đã thu:</span>
              <strong style={{ color: "var(--primary-text)" }}>{formatMoney(data[hoveredIdx].daThu)}</strong>
            </div>
            <div style={{ display: "flex", gap: 6, color: "var(--text-secondary)", marginBottom: 4 }}>
              <span>Còn nợ:</span>
              <strong style={{ color: "var(--status-warning-text)" }}>{formatMoney(data[hoveredIdx].conNo)}</strong>
            </div>
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 4, display: "flex", gap: 6, color: "var(--text-main)" }}>
              <span>Tổng:</span>
              <strong>{formatMoney(data[hoveredIdx].tongTien)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. BIỂU ĐỒ TRÒN / DONUT CHART CƠ CẤU NGUỒN THU (SVG)
// ─────────────────────────────────────────────────────────────
type BreakdownData = {
  tienPhong: number;
  tienDienNuoc: number;
  tienDichVu: number;
  tong: number;
};

export function RevenueBreakdownDonut({ data }: { data: BreakdownData }) {
  const { tienPhong, tienDienNuoc, tienDichVu, tong } = data;

  const total = tong > 0 ? tong : 1;
  const pctPhong = Math.round((tienPhong / total) * 1000) / 10;
  const pctDienNuoc = Math.round((tienDienNuoc / total) * 1000) / 10;
  const pctDichVu = Math.max(0, Math.round((100 - pctPhong - pctDienNuoc) * 10) / 10);

  // Bán kính R = 64
  const r = 64;
  const c = 2 * Math.PI * r;

  const dashPhong = (pctPhong / 100) * c;
  const dashDienNuoc = (pctDienNuoc / 100) * c;
  const dashDichVu = (pctDichVu / 100) * c;

  const offsetPhong = 0;
  const offsetDienNuoc = -dashPhong;
  const offsetDichVu = -(dashPhong + dashDienNuoc);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Các khoản thu</h3>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center" }}>
        {/* SVG Donut */}
        <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
          <svg viewBox="0 0 180 180" style={{ width: 140, height: 140 }}>
            {/* Background Circle */}
            <circle
              cx="90"
              cy="90"
              r={r}
              fill="transparent"
              stroke="var(--bg-subtle)"
              strokeWidth="20"
            />

            {/* Segment: Tiền phòng (Primary) */}
            {pctPhong > 0 && (
              <circle
                cx="90"
                cy="90"
                r={r}
                fill="transparent"
                stroke="var(--primary)"
                strokeWidth="20"
                strokeDasharray={`${dashPhong} ${c - dashPhong}`}
                strokeDashoffset={offsetPhong}
                transform="rotate(-90 90 90)"
              />
            )}

            {/* Segment: Điện nước (Neutral Slate) */}
            {pctDienNuoc > 0 && (
              <circle
                cx="90"
                cy="90"
                r={r}
                fill="transparent"
                stroke="var(--text-muted)"
                strokeWidth="20"
                strokeDasharray={`${dashDienNuoc} ${c - dashDienNuoc}`}
                strokeDashoffset={offsetDienNuoc}
                transform="rotate(-90 90 90)"
              />
            )}

            {/* Segment: Dịch vụ khác (Amber) */}
            {pctDichVu > 0 && (
              <circle
                cx="90"
                cy="90"
                r={r}
                fill="transparent"
                stroke="var(--status-warning-text)"
                strokeWidth="20"
                strokeDasharray={`${dashDichVu} ${c - dashDichVu}`}
                strokeDashoffset={offsetDichVu}
                transform="rotate(-90 90 90)"
              />
            )}
          </svg>

          {/* Donut Center Info */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase" }}>Tổng</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
              {formatCompactMoney(tong)}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--primary)" }} />
              <span style={{ color: "var(--text-secondary)" }}>Tiền phòng</span>
            </div>
            <strong style={{ color: "var(--text-main)" }}>{formatMoney(tienPhong)}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--text-muted)" }} />
              <span style={{ color: "var(--text-secondary)" }}>Điện &amp; Nước</span>
            </div>
            <strong style={{ color: "var(--text-main)" }}>{formatMoney(tienDienNuoc)}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--status-warning-text)" }} />
              <span style={{ color: "var(--text-secondary)" }}>Dịch vụ khác</span>
            </div>
            <strong style={{ color: "var(--text-main)" }}>{formatMoney(tienDichVu)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
