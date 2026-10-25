import { NextResponse } from "next/server";
import { getCurrentAccount, getAccessScope } from "@/lib/session";
import {
  getStorageConfig,
  objectPathFromPublicUrl,
  publicUrlFor,
  removeObjects,
  safeRoomFolder,
} from "@/lib/storage";

/** Dung lượng tối đa mỗi ảnh: 5MB. */
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/avif") return "avif";
  return "jpg";
}

/**
 * Tải ảnh phòng lên Supabase Storage và trả về URL công khai.
 *
 * Yêu cầu biến môi trường:
 * - SUPABASE_URL              (ví dụ https://xxxx.supabase.co)
 * - SUPABASE_SERVICE_ROLE_KEY (khóa service role, chỉ dùng phía server)
 * - SUPABASE_STORAGE_BUCKET   (tùy chọn, mặc định "room-photos", phải là bucket public)
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
      {
        error:
          "Chưa cấu hình Supabase Storage. Cần thêm SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY vào .env.local.",
      },
      { status: 501 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const maPhong = form.get("maPhong");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Vui lòng chọn một tệp ảnh." },
      { status: 400 },
    );
  }
  if (typeof maPhong !== "string" || !maPhong.trim()) {
    return NextResponse.json(
      { error: "Thiếu mã phòng để đặt tên ảnh." },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Chỉ nhận ảnh JPG, PNG, WEBP hoặc AVIF." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh vượt quá 5MB." }, { status: 413 });
  }

  // Chỉ cho tải ảnh cho phòng thuộc tòa được phép.
  const scope = getAccessScope(account);
  if (!scope.allBuildings) {
    const { getDbPool } = await import("@/lib/db");
    const { rows } = await getDbPool().query<{ ok: number }>(
      `SELECT 1 AS ok FROM public.phong WHERE ma_phong = $1 AND toa_nha = $2 LIMIT 1`,
      [maPhong.trim(), scope.building],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Bạn không có quyền tải ảnh cho phòng của cơ sở khác." },
        { status: 403 },
      );
    }
  }

  const safeRoom = safeRoomFolder(maPhong);
  const objectPath = `${safeRoom}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extensionFor(file.type)}`;

  // Ảnh cũ gửi kèm (nếu có) sẽ bị xóa sau khi ảnh mới lên thành công.
  const previousUrl = typeof form.get("previousUrl") === "string" ? String(form.get("previousUrl")) : null;

  try {
    const upload = await fetch(
      `${config.baseUrl}/storage/v1/object/${config.bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": file.type,
          "x-upsert": "true",
          "cache-control": "3600",
        },
        body: Buffer.from(await file.arrayBuffer()),
      },
    );

    if (!upload.ok) {
      const detail = await upload.text().catch(() => "");
      return NextResponse.json(
        {
          error:
            "Supabase Storage từ chối tải lên. Kiểm tra bucket đã tạo và là public chưa." +
            (detail ? ` (${detail.slice(0, 200)})` : ""),
        },
        { status: 502 },
      );
    }

    // Dọn ảnh cũ để tránh rác trong bucket; lỗi ở bước này không làm hỏng kết quả tải lên.
    const previousPath = objectPathFromPublicUrl(config, previousUrl);
    if (previousPath && previousPath !== objectPath) {
      await removeObjects(config, [previousPath]);
    }

    return NextResponse.json({ url: publicUrlFor(config, objectPath) });
  } catch {
    return NextResponse.json(
      { error: "Không kết nối được Supabase Storage. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
