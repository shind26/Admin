import { getDbPool } from "./db";
import type { PoolClient } from "pg";

export type NotificationType =
  | "TaiKhoan"
  | "HoaDon"
  | "SuCo"
  | "HopDong"
  | "ToaNha"
  | "Xe"
  | "BanGiao";

export type CreateNotificationParams = {
  maTaiKhoan?: string | null;
  maPhong?: string | null;
  toaNha?: string | null;
  tieuDe: string;
  noiDung: string;
  loaiThongBao: NotificationType;
  duLieuDinhKem?: Record<string, unknown> | null;
};

export type NotificationRow = {
  ma_thong_bao: string;
  ma_tai_khoan: string | null;
  ma_phong: string | null;
  toa_nha: string | null;
  tieu_de: string;
  noi_dung: string;
  loai_thong_bao: string;
  du_lieu_dinh_kem: Record<string, unknown> | null;
  da_doc: boolean;
  ngay_tao: string;
};

function newId(prefix: string = "TB") {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

/**
 * Ghi thông báo mới vào bảng public.thong_bao để hệ thống Mobile App đọc và hiển thị cho cư dân.
 * Hỗ trợ truyền client nếu đang chạy trong database transaction.
 */
export async function createNotification(
  params: CreateNotificationParams,
  client?: PoolClient,
): Promise<string> {
  const runner = client || (await getDbPool());
  const maThongBao = newId();

  await runner.query(
    `INSERT INTO public.thong_bao (
       ma_thong_bao, ma_tai_khoan, ma_phong, toa_nha, tieu_de, noi_dung, loai_thong_bao, du_lieu_dinh_kem
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      maThongBao,
      params.maTaiKhoan ?? null,
      params.maPhong ?? null,
      params.toaNha ?? null,
      params.tieuDe,
      params.noiDung,
      params.loaiThongBao,
      params.duLieuDinhKem ? JSON.stringify(params.duLieuDinhKem) : null,
    ],
  );

  return maThongBao;
}

