"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type AssetFormState = { error: string | null; success: string | null };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function number(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Kiểm tra quyền truy cập vào phòng theo tòa nhà được gán */
async function verifyRoomAccess(maPhong: string): Promise<boolean> {
  const { scope } = await requireScope();
  if (scope.allBuildings) return true;

  const { rows } = await getDbPool().query<{ toa_nha: string }>(
    `SELECT toa_nha FROM public.phong WHERE ma_phong = $1 LIMIT 1`,
    [maPhong],
  );
  if (rows.length === 0) return false;
  return rows[0].toa_nha === scope.building;
}

/** Sinh mã tài sản tự động nếu để trống */
function generateAssetCode(maPhong: string, tenTaiSan: string): string {
  const prefix = tenTaiSan
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TS_${prefix || "TB"}_${maPhong}_${rand}`;
}

/** Thêm mới tài sản / thiết bị vào phòng */
export async function createAsset(
  _previous: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  const maPhong = text(formData, "maPhong");
  if (!maPhong) return { error: "Thiếu mã phòng.", success: null };

  const hasAccess = await verifyRoomAccess(maPhong);
  if (!hasAccess) {
    return {
      error: "Bạn không có quyền thao tác trên phòng thuộc cơ sở này.",
      success: null,
    };
  }

  const tenTaiSan = text(formData, "tenTaiSan");
  if (!tenTaiSan) return { error: "Vui lòng nhập tên tài sản/thiết bị.", success: null };

  let maTaiSan = text(formData, "maTaiSan").toUpperCase();
  if (!maTaiSan) {
    maTaiSan = generateAssetCode(maPhong, tenTaiSan);
  }

  const soLuong = Math.max(1, number(formData, "soLuong") ?? 1);
  const tinhTrang = text(formData, "tinhTrang") || "Hoạt động tốt";
  const thuongHieu = text(formData, "thuongHieu") || null;
  const soSerial = text(formData, "soSerial") || null;
  const giaTri = Math.max(0, number(formData, "giaTri") ?? 0);
  const ghiChu = text(formData, "ghiChu") || null;

  try {
    const existing = await getDbPool().query<{ ma_tai_san: string }>(
      `SELECT ma_tai_san FROM public.tai_san WHERE ma_tai_san = $1 LIMIT 1`,
      [maTaiSan],
    );
    if (existing.rows.length > 0) {
      return {
        error: `Mã tài sản "${maTaiSan}" đã tồn tại. Vui lòng nhập mã khác hoặc để trống để tạo tự động.`,
        success: null,
      };
    }

    await getDbPool().query(
      `INSERT INTO public.tai_san (
        ma_tai_san, ten_tai_san, tinh_trang, ma_phong,
        so_luong, thuong_hieu, so_serial, gia_tri, ghi_chu, ngay_trang_bi
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)`,
      [
        maTaiSan,
        tenTaiSan,
        tinhTrang,
        maPhong,
        soLuong,
        thuongHieu,
        soSerial,
        giaTri,
        ghiChu,
      ],
    );
  } catch (err) {
    console.error("Lỗi khi thêm tài sản:", err);
    return {
      error: "Không thể thêm tài sản. Vui lòng kiểm tra lại thông tin.",
      success: null,
    };
  }

  revalidatePath(`/phong/${encodeURIComponent(maPhong)}`);
  return { error: null, success: `Đã thêm tài sản "${tenTaiSan}" thành công!` };
}

/** Cập nhật thông tin tài sản / thiết bị */
export async function updateAsset(
  _previous: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  const maPhong = text(formData, "maPhong");
  const maTaiSan = text(formData, "maTaiSan");
  if (!maPhong || !maTaiSan) {
    return { error: "Thiếu thông tin nhận diện tài sản.", success: null };
  }

  const hasAccess = await verifyRoomAccess(maPhong);
  if (!hasAccess) {
    return {
      error: "Bạn không có quyền thao tác trên phòng thuộc cơ sở này.",
      success: null,
    };
  }

  const tenTaiSan = text(formData, "tenTaiSan");
  if (!tenTaiSan) return { error: "Tên tài sản không được để trống.", success: null };

  const soLuong = Math.max(1, number(formData, "soLuong") ?? 1);
  const tinhTrang = text(formData, "tinhTrang") || "Hoạt động tốt";
  const thuongHieu = text(formData, "thuongHieu") || null;
  const soSerial = text(formData, "soSerial") || null;
  const giaTri = Math.max(0, number(formData, "giaTri") ?? 0);
  const ghiChu = text(formData, "ghiChu") || null;

  try {
    const { rowCount } = await getDbPool().query(
      `UPDATE public.tai_san
       SET ten_tai_san = $1,
           so_luong = $2,
           tinh_trang = $3,
           thuong_hieu = $4,
           so_serial = $5,
           gia_tri = $6,
           ghi_chu = $7
       WHERE ma_tai_san = $8 AND ma_phong = $9`,
      [
        tenTaiSan,
        soLuong,
        tinhTrang,
        thuongHieu,
        soSerial,
        giaTri,
        ghiChu,
        maTaiSan,
        maPhong,
      ],
    );

    if (rowCount === 0) {
      return { error: "Không tìm thấy tài sản cần cập nhật.", success: null };
    }
  } catch (err) {
    console.error("Lỗi khi cập nhật tài sản:", err);
    return { error: "Không thể lưu thay đổi tài sản. Thử lại sau.", success: null };
  }

  revalidatePath(`/phong/${encodeURIComponent(maPhong)}`);
  return { error: null, success: `Đã cập nhật tài sản "${tenTaiSan}" thành công!` };
}

/** Xóa tài sản khỏi phòng */
export async function deleteAsset(
  _previous: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  const maPhong = text(formData, "maPhong");
  const maTaiSan = text(formData, "maTaiSan");
  if (!maPhong || !maTaiSan) {
    return { error: "Thiếu thông tin tài sản cần xóa.", success: null };
  }

  const hasAccess = await verifyRoomAccess(maPhong);
  if (!hasAccess) {
    return {
      error: "Bạn không có quyền thao tác trên phòng thuộc cơ sở này.",
      success: null,
    };
  }

  try {
    const { rowCount } = await getDbPool().query(
      `DELETE FROM public.tai_san WHERE ma_tai_san = $1 AND ma_phong = $2`,
      [maTaiSan, maPhong],
    );
    if (rowCount === 0) {
      return { error: "Không tìm thấy tài sản cần xóa.", success: null };
    }
  } catch (err) {
    console.error("Lỗi khi xóa tài sản:", err);
    return { error: "Không thể xóa tài sản. Vui lòng thử lại.", success: null };
  }

  revalidatePath(`/phong/${encodeURIComponent(maPhong)}`);
  return { error: null, success: "Đã xóa tài sản khỏi phòng thành công!" };
}
