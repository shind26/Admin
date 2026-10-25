"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, PackageCheck } from "lucide-react";

export type HandoverItem = {
  id: string;
  tenTaiSan: string;
  soLuong: number;
  tinhTrang: string;
  ghiChu: string;
};

export const HANDOVER_STATUS_OPTIONS = [
  "Hoạt động tốt",
  "Bình thường",
  "Mới 100%",
  "Cũ / Trầy xước nhẹ",
  "Cần bảo dưỡng",
  "Hỏng / Cần thay thế",
];

export function HandoverItemsEditor({
  furnitureList,
  name = "handoverItemsJson",
  title = "Biên bản bàn giao tài sản lúc nhận phòng",
  hint = "Kiểm tra và chỉnh sửa số lượng, tình trạng từng món hoặc thêm đồ khách thuê trước khi tạo hợp đồng.",
}: {
  furnitureList?: string[] | null;
  name?: string;
  title?: string;
  hint?: string;
}) {
  const [items, setItems] = useState<HandoverItem[]>(() => {
    if (!furnitureList || furnitureList.length === 0) return [];
    return furnitureList
      .filter((s) => s && s.trim())
      .map((item, idx) => ({
        id: `init-${idx}-${item}`,
        tenTaiSan: item.trim(),
        soLuong: 1,
        tinhTrang: "Hoạt động tốt",
        ghiChu: "",
      }));
  });

  // Khi danh sách nội thất sẵn có thay đổi (chẳng hạn khi đổi phòng)
  const [prevFurnitureList, setPrevFurnitureList] = useState(furnitureList);
  if (furnitureList !== prevFurnitureList) {
    setPrevFurnitureList(furnitureList);
    if (!furnitureList || furnitureList.length === 0) {
      setItems([]);
    } else {
      setItems(
        furnitureList
          .filter((s) => s && s.trim())
          .map((item, idx) => ({
            id: `init-${Date.now()}-${idx}`,
            tenTaiSan: item.trim(),
            soLuong: 1,
            tinhTrang: "Hoạt động tốt",
            ghiChu: "",
          })),
      );
    }
  }

  const updateItem = (id: string, patch: Partial<HandoverItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const addItem = () => {
    const newItem: HandoverItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenTaiSan: "",
      soLuong: 1,
      tinhTrang: "Hoạt động tốt",
      ghiChu: "",
    };
    setItems((prev) => [...prev, newItem]);
  };

  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        padding: "14px 16px",
        background: "#ffffff",
        marginBottom: 16,
      }}
    >
      <input type="hidden" name={name} value={JSON.stringify(items)} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <PackageCheck size={18} style={{ color: "#059669" }} />
            <span>{title}</span>
            <span
              style={{
                fontSize: 11,
                background: "#ecfdf5",
                color: "#065f46",
                padding: "1px 8px",
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              {items.length} món
            </span>
          </div>
          {hint && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
              {hint}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={addItem}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 11px",
            borderRadius: 6,
            background: "#f0fdf4",
            color: "#166534",
            border: "1px solid #bbf7d0",
            cursor: "pointer",
          }}
          title="Thêm một món đồ bàn giao mới hoặc đồ khách thuê thêm"
        >
          <Plus size={14} /> Thêm món bàn giao / Đồ thuê thêm
        </button>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "18px 10px",
            color: "#94a3b8",
            fontSize: 12.5,
            background: "#f8fafc",
            borderRadius: 8,
            border: "1px dashed #e2e8f0",
          }}
        >
          Chưa có danh mục nội thất nào được chọn cho phòng này. Bấm &quot;Thêm món bàn giao&quot; nếu cần.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "6px 8px", width: 35, textAlign: "center" }}>#</th>
                <th style={{ padding: "6px 8px" }}>Tên thiết bị / Nội thất *</th>
                <th style={{ padding: "6px 8px", width: 70 }}>SL *</th>
                <th style={{ padding: "6px 8px", width: 170 }}>Tình trạng nhận phòng *</th>
                <th style={{ padding: "6px 8px" }}>Ghi chú / Nhãn hiệu / Thuê thêm</th>
                <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr
                  key={it.id}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: idx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                  }}
                >
                  <td style={{ padding: "6px 8px", textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="text"
                      value={it.tenTaiSan}
                      onChange={(e) => updateItem(it.id, { tenTaiSan: e.target.value })}
                      placeholder="VD: Giường ngủ 1m6"
                      required
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="number"
                      min={1}
                      value={it.soLuong}
                      onChange={(e) => updateItem(it.id, { soLuong: Math.max(1, Number(e.target.value) || 1) })}
                      required
                      style={{
                        width: "100%",
                        padding: "5px 6px",
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        textAlign: "center",
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <select
                      value={it.tinhTrang}
                      onChange={(e) => updateItem(it.id, { tinhTrang: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background:
                          it.tinhTrang === "Hoạt động tốt" || it.tinhTrang === "Mới 100%"
                            ? "#f0fdf4"
                            : it.tinhTrang.includes("Hỏng")
                              ? "#fef2f2"
                              : "#ffffff",
                        color:
                          it.tinhTrang === "Hoạt động tốt" || it.tinhTrang === "Mới 100%"
                            ? "#15803d"
                            : it.tinhTrang.includes("Hỏng")
                              ? "#b91c1c"
                              : "#334155",
                        fontWeight: 500,
                      }}
                    >
                      {HANDOVER_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="text"
                      value={it.ghiChu}
                      onChange={(e) => updateItem(it.id, { ghiChu: e.target.value })}
                      placeholder="VD: Trầy nhẹ ở góc, Daikin, Đồ thuê thêm..."
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Bỏ món này khỏi biên bản bàn giao"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

