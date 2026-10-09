"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type RoomFormState = { error: string | null; success: string | null };

const ROOM_STATUSES = ["Trống", "Đang thuê", "Sửa chữa"];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function number(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Thêm phòng theo RoomController.Create (mã phòng phải là duy nhất). */
export async function createRoom(
  _previous: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  if (!maPhong) return { error: "Vui lòng nhập mã phòng.", success: null };

  const trangThai = text(formData, "trangThai") || "Trống";
  if (!ROOM_STATUSES.includes(trangThai)) {
    return { error: "Trạng thái phòng không hợp lệ.", success: null };
  }

  const tenHienThi = text(formData, "tenHienThi") || maPhong;
  // Quản lý tòa chỉ được tạo phòng trong tòa của mình.
  const toaNha = scope.allBuildings ? text(formData, "toaNha") : scope.building;
  if (!toaNha) return { error: "Vui lòng chọn cơ sở cho phòng.", success: null };

  try {
    const { rows } = await getDbPool().query<{ exists: number }>(
      "SELECT 1 AS exists FROM public.phong WHERE ma_phong = $1 LIMIT 1",
      [maPhong],
    );
    if (rows.length > 0) {
      return {
        error: "Mã phòng này đã tồn tại trong hệ thống!",
        success: null,
      };
    }

    await getDbPool().query(
      `INSERT INTO public.phong
         (ma_phong, ten_hien_thi, tang, dien_tich, gia_thue, trang_thai, toa_nha, ma_loai_phong, mo_ta_ngan, tien_dat_coc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        maPhong,
        tenHienThi,
        number(formData, "tang"),
        number(formData, "dienTich"),
        number(formData, "giaThue"),
        trangThai,
        toaNha || "Tòa A",
        text(formData, "maLoaiPhong") || null,
        text(formData, "moTaNgan") || null,
        number(formData, "tienDatCoc"),
      ],
    );
  } catch {
    return {
      error: "Không thể lưu phòng. Hãy kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  }

  revalidatePath("/phong");
  return { error: null, success: "Thêm phòng thành công!" };
}

/** Cập nhật phòng theo RoomController.Edit. */
export async function updateRoom(
  _previous: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  if (!maPhong) return { error: "Thiếu mã phòng.", success: null };

  const trangThai = text(formData, "trangThai") || "Trống";
  if (!ROOM_STATUSES.includes(trangThai)) {
    return { error: "Trạng thái phòng không hợp lệ.", success: null };
  }

  const toaNha = scope.allBuildings ? text(formData, "toaNha") : scope.building;
  if (!toaNha) return { error: "Vui lòng chọn cơ sở cho phòng.", success: null };

  try {
    // Quản lý tòa chỉ được sửa phòng trong tòa của mình.
    const { rowCount } = await getDbPool().query(
      `UPDATE public.phong
       SET ten_hien_thi = $2, tang = $3, dien_tich = $4, gia_thue = $5,
           trang_thai = $6, toa_nha = $7, ma_loai_phong = $8,
           mo_ta_ngan = $9, tien_dat_coc = $10
       WHERE ma_phong = $1
         AND ($11::text IS NULL OR toa_nha = $11)`,
      [
        maPhong,
        text(formData, "tenHienThi") || maPhong,
        number(formData, "tang"),
        number(formData, "dienTich"),
        number(formData, "giaThue"),
        trangThai,
        toaNha,
        text(formData, "maLoaiPhong") || null,
        text(formData, "moTaNgan") || null,
        number(formData, "tienDatCoc"),
        scope.allBuildings ? null : scope.building,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy phòng cần cập nhật.", success: null };
  } catch {
    return { error: "Không thể cập nhật phòng. Hãy thử lại.", success: null };
  }

  revalidatePath("/phong");
  return { error: null, success: "Cập nhật phòng thành công!" };
}

/** Xóa phòng theo RoomController.Delete (chặn khi còn hợp đồng). */
export async function deleteRoom(
  _previous: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  if (!maPhong) return { error: "Thiếu mã phòng.", success: null };

  try {
    const { rows } = await getDbPool().query<{ exists: number }>(
      "SELECT 1 AS exists FROM public.hop_dong WHERE ma_phong = $1 LIMIT 1",
      [maPhong],
    );
    if (rows.length > 0) {
      return {
        error: "Không thể xóa phòng này vì đang có Hợp đồng liên quan!",
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      `DELETE FROM public.phong
       WHERE ma_phong = $1 AND ($2::text IS NULL OR toa_nha = $2)`,
      [maPhong, scope.allBuildings ? null : scope.building],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy phòng cần xóa!", success: null };
  } catch {
    return { error: "Lỗi khi xóa phòng. Vui lòng thử lại.", success: null };
  }

  revalidatePath("/phong");
  return { error: null, success: "Đã xóa phòng thành công!" };
}
