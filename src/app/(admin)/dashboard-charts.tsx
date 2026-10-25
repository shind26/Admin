"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";

function formatMoney(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
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
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const barGroupWidth = innerWidth / data.length;
  const barWidth = Math.min(22, (barGroupWidth - 14) / 2);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Doanh thu &amp; Công nợ 6 tháng gần nhất</h3>
          <p className={styles.chartSub}>
            So sánh thực tế số tiền Đã thu vs. Còn nợ theo từng tháng
          </p>
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
          <defs>
            <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a90c2" />
              <stop offset="100%" stopColor="#76b5d8" />
            </linearGradient>
            <linearGradient id="gradDebt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

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
                  stroke="#e2e8f0"
                  strokeDasharray={stepIdx === 0 ? "none" : "3,3"}
                  strokeWidth={stepIdx === 0 ? "1.5" : "1"}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                  fontFamily="system-ui, sans-serif"
                >
                  {formatCompactMoney(val)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((item, idx) => {
            const groupX = paddingLeft + idx * barGroupWidth;
            const center = groupX + barGroupWidth / 2;

            const collectedHeight = Math.max(
              item.daThu > 0 ? 4 : 0,
              (item.daThu / ceiling) * innerHeight,
            );
            const collectedY = paddingTop + innerHeight - collectedHeight;
            const collectedX = center - barWidth - 2;

            const debtHeight = Math.max(
              item.conNo > 0 ? 4 : 0,
              (item.conNo / ceiling) * innerHeight,
            );
            const debtY = paddingTop + innerHeight - debtHeight;
            const debtX = center + 2;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.monthKey}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Background hover highlight */}
                {isHovered && (
                  <rect
                    x={groupX + 4}
                    y={paddingTop}
                    width={barGroupWidth - 8}
                    height={innerHeight}
                    fill="#f1f5f9"
                    opacity="0.6"
                    rx="6"
                  />
                )}

                {/* Bar: Đã thu */}
                <rect
                  x={collectedX}
                  y={collectedY}
                  width={barWidth}
                  height={collectedHeight}
                  fill="url(#gradCollected)"
                  rx="4"
                  opacity={hoveredIdx !== null && !isHovered ? 0.6 : 1}
                  className={styles.barTransition}
                />

                {/* Bar: Còn nợ */}
                <rect
                  x={debtX}
                  y={debtY}
                  width={barWidth}
                  height={debtHeight}
                  fill="url(#gradDebt)"
                  rx="4"
                  opacity={hoveredIdx !== null && !isHovered ? 0.6 : 1}
                  className={styles.barTransition}
                />

                {/* X-axis Month Label */}
                <text
                  x={center}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={isHovered ? 700 : 500}
                  fill={isHovered ? "#0f172a" : "#64748b"}
                  fontFamily="system-ui, sans-serif"
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
            }}
          >
            <div className={styles.tooltipTitle}>{data[hoveredIdx].label}</div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipDotOk} />
              <span>Đã thu:</span>
              <strong>{formatMoney(data[hoveredIdx].daThu)}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipDotWarn} />
              <span>Còn nợ:</span>
              <strong style={{ color: "#d97706" }}>
                {formatMoney(data[hoveredIdx].conNo)}
              </strong>
            </div>
            <div className={styles.tooltipDivider} />
            <div className={styles.tooltipRow}>
              <span>Tổng phát hành:</span>
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

  // Tính toán stroke-dasharray và stroke-dashoffset cho vòng tròn SVG (bán kính R = 64)
  const r = 64;
  const c = 2 * Math.PI * r; // Chu vi ~ 402.12

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
          <h3 className={styles.chartTitle}>Cơ cấu nguồn thu</h3>
          <p className={styles.chartSub}>Tỷ trọng các khoản thu theo hóa đơn phát hành</p>
        </div>
      </div>

      <div className={styles.donutLayout}>
        {/* SVG Donut */}
        <div className={styles.donutSvgContainer}>
          <svg viewBox="0 0 180 180" className={styles.donutSvg}>
            {/* Background Circle */}
            <circle
              cx="90"
              cy="90"
              r={r}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="24"
            />

            {/* Segment: Tiền phòng (Xanh da trời đậm #4A90C2) */}
            {pctPhong > 0 && (
              <circle
                cx="90"
                cy="90"
                r={r}
                fill="transparent"
                stroke="#4a90c2"
                strokeWidth="24"
                strokeDasharray={`${dashPhong} ${c - dashPhong}`}
                strokeDashoffset={offsetPhong}
                transform="rotate(-90 90 90)"
                strokeLinecap="round"
                className={styles.donutSegment}
              />
            )}

            {/* Segment: Điện nước (Xanh da trời vừa #76B5D8) */}
            {pctDienNuoc > 0 && (
              <circle
                cx="90"
                cy="90"
                r={r}
                fill="transparent"
                stroke="#76b5d8"
                strokeWidth="24"
                strokeDasharray={`${dashDienNuoc} ${c - dashDienNuoc}`}
                strokeDashoffset={offsetDienNuoc}
                transform="rotate(-90 90 90)"
                strokeLinecap="round"
                className={styles.donutSegment}
              />
            )}

            {/* Segment: Dịch vụ khác (Điểm nhấn cam vàng) */}
            {pctDichVu > 0 && (
              <circle
                cx="90"
                cy="90"
                r={r}
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="24"
                strokeDasharray={`${dashDichVu} ${c - dashDichVu}`}
                strokeDashoffset={offsetDichVu}
                transform="rotate(-90 90 90)"
                strokeLinecap="round"
                className={styles.donutSegment}
              />
            )}
          </svg>

          {/* Donut Center Info */}
          <div className={styles.donutCenter}>
            <span className={styles.donutCenterLabel}>Tổng tiền</span>
            <span className={styles.donutCenterVal}>{formatCompactMoney(tong)}</span>
          </div>
        </div>

        {/* Legend List */}
        <div className={styles.donutLegendList}>
          <div className={styles.donutLegendRow}>
            <div className={styles.legendColorBox} style={{ background: "#4a90c2" }} />
            <div className={styles.legendTextCol}>
              <div className={styles.legendCategory}>Tiền phòng</div>
              <div className={styles.legendAmount}>{formatMoney(tienPhong)}</div>
            </div>
            <div className={styles.legendPercentBadge} style={{ color: "#26597d", background: "#dceff8" }}>
              {pctPhong}%
            </div>
          </div>

          <div className={styles.donutLegendRow}>
            <div className={styles.legendColorBox} style={{ background: "#76b5d8" }} />
            <div className={styles.legendTextCol}>
              <div className={styles.legendCategory}>Điện &amp; Nước</div>
              <div className={styles.legendAmount}>{formatMoney(tienDienNuoc)}</div>
            </div>
            <div className={styles.legendPercentBadge} style={{ color: "#26597d", background: "#eff8fc" }}>
              {pctDienNuoc}%
            </div>
          </div>

          <div className={styles.donutLegendRow}>
            <div className={styles.legendColorBox} style={{ background: "#f59e0b" }} />
            <div className={styles.legendTextCol}>
              <div className={styles.legendCategory}>Dịch vụ khác (xe, wifi, rác)</div>
              <div className={styles.legendAmount}>{formatMoney(tienDichVu)}</div>
            </div>
            <div className={styles.legendPercentBadge} style={{ color: "#854d0e", background: "#f6e6b4" }}>
              {pctDichVu}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

