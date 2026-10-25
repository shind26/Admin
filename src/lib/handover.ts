import type { PoolClient } from "pg";

function newId(prefix: string) {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export type HandoverItemPayload = {
  id?: string;
  tenTaiSan: string;
  soLuong: number;
  tinhTrang: string;
  ghiChu: string;
};

/**
 * Lưu danh mục tài sản bàn giao đã được nhân viên kiểm tra / chỉnh sửa vào bảng tai_san của phòng.
 * Được thực thi bên trong transaction khi tạo hợp đồng hoặc chuyển cọc thành hợp đồng.
 */
export async function saveHandoverAssets(
  client: PoolClient,
  maPhong: string,
  itemsJson: string | null | undefined,
): Promise<number> {
  if (!itemsJson) return 0;
  let items: HandoverItemPayload[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return 0;
  }
  if (!Array.isArray(items) || items.length === 0) return 0;

  let savedCount = 0;
  for (const item of items) {
    const ten = (item.tenTaiSan || "").trim();
    if (!ten) continue;
    const soLuong = Math.max(1, Number(item.soLuong) || 1);
    const tinhTrang = item.tinhTrang || "Hoạt động tốt";
    const ghiChu = item.ghiChu ? item.ghiChu.trim() : null;

    // Kiểm tra xem thiết bị đã có trong phòng chưa
    const { rows: existing } = await client.query<{ ma_tai_san: string }>(
      `SELECT ma_tai_san FROM public.tai_san
       WHERE ma_phong = $1 AND LOWER(TRIM(ten_tai_san)) = LOWER($2)
       LIMIT 1`,
      [maPhong, ten],
    );

    if (existing.length > 0) {
      await client.query(
        `UPDATE public.tai_san
         SET so_luong = $1, tinh_trang = $2, ghi_chu = COALESCE($3, ghi_chu)
         WHERE ma_tai_san = $4 AND ma_phong = $5`,
        [soLuong, tinhTrang, ghiChu, existing[0].ma_tai_san, maPhong],
      );
    } else {
      const maTaiSan = newId("TS");
      await client.query(
        `INSERT INTO public.tai_san (
           ma_tai_san, ten_tai_san, tinh_trang, ma_phong, so_luong, ghi_chu, ngay_trang_bi
         ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
        [maTaiSan, ten, tinhTrang, maPhong, soLuong, ghiChu],
      );
    }
    savedCount++;
  }
  return savedCount;
}
