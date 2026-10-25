import { NextResponse } from "next/server";
import { getCurrentAccount, getAccessScope } from "@/lib/session";
import {
  getStorageConfig,
  objectPathFromPublicUrl,
  removeObjects,
} from "@/lib/storage";

/**
 * Xóa một ảnh phòng khỏi Supabase Storage.
 *
 * Chỉ xóa được ảnh nằm trong bucket của hệ thống — URL dán từ nơi khác sẽ bị bỏ qua,
 * để tránh xóa nhầm tài nguyên bên ngoài.
 */
export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json(
      { error: "Phiên đăng nhập đã hết hạn." },
      { status: 401 },
    );
  }

  const config = getStorageConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Chưa cấu hình Supabase Storage." },
      { status: 501 },
    );
  }

  let payload: { url?: string; maPhong?: string };
  try {
    payload = (await request.json()) as { url?: string; maPhong?: string };
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const objectPath = objectPathFromPublicUrl(config, payload.url);
  if (!objectPath) {
    // URL ngoài hệ thống hoặc rỗng: không có gì để xóa, coi như thành công.
    return NextResponse.json({ removed: 0, skipped: true });
  }

  // Quản lý tòa chỉ được xóa ảnh của phòng thuộc tòa mình.
  const scope = getAccessScope(account);
  const maPhong = (payload.maPhong ?? "").trim();
  if (!scope.allBuildings && maPhong) {
    const { getDbPool } = await import("@/lib/db");
    const { rows } = await getDbPool().query<{ ok: number }>(
      `SELECT 1 AS ok FROM public.phong WHERE ma_phong = $1 AND toa_nha = $2 LIMIT 1`,
      [maPhong, scope.building],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa ảnh của phòng thuộc cơ sở khác." },
        { status: 403 },
      );
    }
  }

  const removed = await removeObjects(config, [objectPath]);
  if (removed.length === 0) {
    return NextResponse.json(
      { error: "Không xóa được ảnh trên Supabase Storage." },
      { status: 502 },
    );
  }

  return NextResponse.json({ removed: removed.length });
}
