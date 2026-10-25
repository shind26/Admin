import "server-only";

/**
 * Tiện ích dùng chung cho Supabase Storage (ảnh phòng).
 *
 * Yêu cầu biến môi trường:
 * - SUPABASE_URL              (ví dụ https://xxxx.supabase.co)
 * - SUPABASE_SERVICE_ROLE_KEY (khóa service role, chỉ dùng phía server)
 * - SUPABASE_STORAGE_BUCKET   (tùy chọn, mặc định "room-photos", phải là bucket public)
 */

export type StorageConfig = {
  baseUrl: string;
  key: string;
  bucket: string;
};

/** Đọc cấu hình Storage; trả về null khi thiếu biến môi trường. */
export function getStorageConfig(): StorageConfig | null {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) return null;
  return {
    baseUrl,
    key,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "room-photos",
  };
}

/** Đường dẫn công khai của một object trong bucket. */
export function publicUrlFor(config: StorageConfig, objectPath: string) {
  return `${config.baseUrl}/storage/v1/object/public/${config.bucket}/${objectPath}`;
}

/**
 * Lấy đường dẫn object từ URL công khai.
 * Trả về null nếu URL không thuộc bucket của hệ thống
 * (ví dụ người dùng dán URL ảnh từ nơi khác thì ta không được xóa).
 */
export function objectPathFromPublicUrl(
  config: StorageConfig,
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const prefix = `${config.baseUrl}/storage/v1/object/public/${config.bucket}/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  if (!path || path.includes("..")) return null;
  return decodeURIComponent(path);
}

/** Xóa nhiều object trong một lần gọi. Trả về danh sách đường dẫn đã xóa được. */
export async function removeObjects(
  config: StorageConfig,
  objectPaths: string[],
): Promise<string[]> {
  const paths = [...new Set(objectPaths.filter((p) => p.length > 0))];
  if (paths.length === 0) return [];

  const res = await fetch(
    `${config.baseUrl}/storage/v1/object/${config.bucket}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: paths }),
    },
  );

  if (!res.ok) return [];
  return paths;
}

/** Xóa tất cả ảnh của một phòng (theo thư mục mã phòng). */
export async function removeRoomFolder(
  config: StorageConfig,
  maPhong: string,
): Promise<boolean> {
  const safeRoom = safeRoomFolder(maPhong);
  if (!safeRoom) return false;

  // Liệt kê object trong thư mục rồi xóa; bucket không tự xóa thư mục rỗng.
  const list = await fetch(
    `${config.baseUrl}/storage/v1/object/list/${config.bucket}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: `${safeRoom}/`, limit: 1000 }),
    },
  );

  if (!list.ok) return false;
  const items = (await list.json()) as { name?: string }[];
  const paths = items
    .map((item) => (item.name ? `${safeRoom}/${item.name}` : null))
    .filter((p): p is string => p !== null);

  if (paths.length === 0) return true;
  const removed = await removeObjects(config, paths);
  return removed.length === paths.length;
}

/** Chuẩn hóa mã phòng thành tên thư mục an toàn, dùng chung với route upload. */
export function safeRoomFolder(maPhong: string): string {
  return maPhong.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
}
