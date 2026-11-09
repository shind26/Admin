"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
  hint = "",
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
            id: `init-${idx}-${item}`,
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
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 16px",
        background: "var(--bg-surface)",
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
              color: "var(--text-main)",
            }}
          >
            <span>{title}</span>
          </div>
          {hint && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
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
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            border: "1px solid var(--border-strong)",
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
            color: "var(--text-muted)",
            fontSize: 12.5,
            background: "var(--bg-subtle)",
            borderRadius: 8,
            border: "1px dashed var(--border)",
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
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                <th style={{ padding: "6px 8px", width: 35, textAlign: "center" }}>#</th>
                <th style={{ padding: "6px 8px" }}>Tên thiết bị / Nội thất</th>
                <th style={{ padding: "6px 8px", width: 70 }}>SL</th>
                <th style={{ padding: "6px 8px", width: 170 }}>Tình trạng nhận phòng</th>
                <th style={{ padding: "6px 8px" }}>Ghi chú / Nhãn hiệu / Thuê thêm</th>
                <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr
                  key={it.id}
                  style={{
                    borderBottom: "1px solid var(--bg-subtle)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <td style={{ padding: "6px 8px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
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
                        border: "1px solid var(--border)",
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
                        border: "1px solid var(--border)",
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
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        color: "var(--text-main)",
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
                        border: "1px solid var(--border)",
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
                        color: "var(--status-danger-text)",
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

