"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { getCurrentAccount, requireScope } from "@/lib/session";
import { hashPassword, DEFAULT_CUSTOMER_PASSWORD } from "@/lib/password";
import { getTenantVehicles, getTenantRentalHistory } from "@/lib/queries";

export type TenantFormState = {
  error: string | null;
  success: string | null;
  tempPassword?: string | null;
  username?: string | null;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function newId(prefix: string) {
  return (
    prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
}

/** Mật khẩu mặc định 123456 cho tài khoản khách thuê */
function generateTempPassword() {
  return DEFAULT_CUSTOMER_PASSWORD;
}

/** Kiểm tra CCCD trùng */
async function cccdTaken(cccd: string, exceptId?: string) {
  const { rows } = await getDbPool().query<{ exists: number }>(
    `SELECT 1 AS exists FROM public.khach_thue
     WHERE cccd = $1 AND ($2::text IS NULL OR ma_khach <> $2) LIMIT 1`,
    [cccd, exceptId ?? null],
  );
  return rows.length > 0;
}

/** Thêm khách thuê & tùy chọn tự cấp tài khoản Mobile App */
export async function createTenant(
  _previous: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  const hoTen = text(formData, "hoTenKhach");
  const soDt = text(formData, "soDt");
  const cccd = text(formData, "cccd");
  const diaChi = text(formData, "diaChiThuongTru");
  const ngaySinh = text(formData, "ngaySinh") || null;
  const gioiTinh = text(formData, "gioiTinh") || null;
  const ngayCapCccd = text(formData, "ngayCapCccd") || null;
  const noiCapCccd = text(formData, "noiCapCccd") || null;
  const ghiChuNoiBo = text(formData, "ghiChuNoiBo") || null;

  // Người liên hệ khẩn cấp
  const tenNguoiThan = text(formData, "tenNguoiThan");
  const sdtNguoiThan = text(formData, "sdtNguoiThan");
  const moiQuanHe = text(formData, "moiQuanHe");
  const nguoiLienHe =
    tenNguoiThan || sdtNguoiThan
      ? JSON.stringify({
          ho_ten: tenNguoiThan,
          so_dt: sdtNguoiThan,
          moi_quan_he: moiQuanHe,
        })
      : null;

  const capTaiKhoanApp = formData.get("capTaiKhoanApp") === "on";

  if (!hoTen || !soDt || !cccd || !diaChi) {
    return {
      error: "Vui lòng nhập đầy đủ họ tên, số điện thoại, CCCD và địa chỉ thường trú.",
      success: null,
    };
  }

  const client = await getDbPool().connect();
  let tempPassCreated: string | null = null;
  const maKhach = newId("KH");

  try {
    await client.query("BEGIN");

    if (await cccdTaken(cccd)) {
      await client.query("ROLLBACK");
      return { error: "CCCD này đã tồn tại trong hệ thống.", success: null };
    }

    let maTaiKhoan: string | null = null;

    if (capTaiKhoanApp) {
      // Kiểm tra xem SĐT đã có tài khoản trong tai_khoan chưa
      const { rows: existingAcc } = await client.query<{ ma_tai_khoan: string }>(
        `SELECT ma_tai_khoan FROM public.tai_khoan WHERE ten_dang_nhap = $1 LIMIT 1`,
        [soDt],
      );

      if (existingAcc.length > 0) {
        maTaiKhoan = existingAcc[0].ma_tai_khoan;
        tempPassCreated = DEFAULT_CUSTOMER_PASSWORD;
        const hashed = await hashPassword(DEFAULT_CUSTOMER_PASSWORD);
        await client.query(
          `UPDATE public.tai_khoan
           SET mat_khau = $1, da_doi_mat_khau = false, trang_thai = 'HoatDong'
           WHERE ma_tai_khoan = $2`,
          [hashed, maTaiKhoan],
        );
      } else {
        // Sinh tài khoản mới
        tempPassCreated = DEFAULT_CUSTOMER_PASSWORD;
        const hashed = await hashPassword(tempPassCreated);
        maTaiKhoan = newId("TK");
        await client.query(
          `INSERT INTO public.tai_khoan
            (ma_tai_khoan, ten_dang_nhap, mat_khau, vai_tro, trang_thai, da_doi_mat_khau, ho_ten)
           VALUES ($1, $2, $3, 'KhachThue', 'HoatDong', false, $4)`,
          [maTaiKhoan, soDt, hashed, hoTen],
        );
      }
    }

    await client.query(
      `INSERT INTO public.khach_thue
        (ma_khach, ho_ten_khach, so_dt, cccd, dia_chi_thuong_tru, ngay_sinh, gioi_tinh,
         ngay_cap_cccd, noi_cap_cccd, nguoi_lien_he_khan_cap, ghi_chu_noi_bo, ma_tai_khoan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        maKhach,
        hoTen,
        soDt,
        cccd,
        diaChi,
        ngaySinh,
        gioiTinh,
        ngayCapCccd,
        noiCapCccd,
        nguoiLienHe,
        ghiChuNoiBo,
        maTaiKhoan,
      ],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create tenant error:", err);
    return {
      error: "Không thể lưu khách thuê. Vui lòng kiểm tra lại thông tin.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/khach-thue");
  return {
    error: null,
    success: "Thêm hồ sơ khách thuê thành công.",
    tempPassword: tempPassCreated,
    username: tempPassCreated ? soDt : null,
  };
}

/** Cập nhật ghi chú nội bộ của Quản lý cho khách thuê (Thông tin cá nhân do khách tự cập nhật qua Mobile App) */
export async function updateTenant(
  _previous: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maKhach = text(formData, "maKhach");
  const ghiChuNoiBo = text(formData, "ghiChuNoiBo") || null;

  if (!maKhach) return { error: "Thiếu mã khách thuê.", success: null };

  try {
    const { rowCount } = await getDbPool().query(
      `UPDATE public.khach_thue
       SET ghi_chu_noi_bo = $2
       WHERE ma_khach = $1
         AND ($3::text IS NULL OR EXISTS (
           SELECT 1 FROM public.hop_dong hd
           JOIN public.phong p ON p.ma_phong = hd.ma_phong
           WHERE (hd.ma_khach_dai_dien = public.khach_thue.ma_khach OR EXISTS (
             SELECT 1 FROM public.chi_tiet_hop_dong_khach_thue ct WHERE ct.ma_hop_dong = hd.ma_hop_dong AND ct.ma_khach = public.khach_thue.ma_khach
           )) AND p.toa_nha = $3
         ))`,
      [maKhach, ghiChuNoiBo, scope.allBuildings ? null : scope.building],
    );
    if (rowCount === 0) return { error: "Không tìm thấy khách thuê.", success: null };
  } catch (err) {
    console.error("Update tenant note error:", err);
    return {
      error: "Không thể cập nhật ghi chú nội bộ. Hãy thử lại.",
      success: null,
    };
  }

  revalidatePath("/khach-thue");
  return { error: null, success: "Cập nhật ghi chú nội bộ thành công." };
}

/** Xóa hồ sơ khách thuê */
export async function deleteTenant(
  _previous: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maKhach = text(formData, "maKhach");
  if (!maKhach) return { error: "Thiếu mã khách thuê.", success: null };

  try {
    const { rows } = await getDbPool().query<{ related: number }>(
      `SELECT (
         EXISTS(SELECT 1 FROM public.hop_dong WHERE ma_khach_dai_dien = $1)
         OR EXISTS(SELECT 1 FROM public.su_co_bao_tri WHERE ma_khach_bao = $1)
         OR EXISTS(SELECT 1 FROM public.dang_ky_khach_qua_dem WHERE ma_khach_dang_ky = $1)
         OR EXISTS(SELECT 1 FROM public.chi_tiet_hop_dong_khach_thue WHERE ma_khach = $1)
         OR EXISTS(SELECT 1 FROM public.giu_cho WHERE ma_khach = $1)
       )::int AS related`,
      [maKhach],
    );
    if ((rows[0]?.related ?? 0) === 1) {
      return {
        error:
          "Không thể xóa khách đã có hợp đồng, sự cố, phương tiện hoặc đăng ký lưu trú.",
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      `DELETE FROM public.khach_thue
       WHERE ma_khach = $1
         AND ($2::text IS NULL OR EXISTS (
           SELECT 1 FROM public.hop_dong hd
           JOIN public.phong p ON p.ma_phong = hd.ma_phong
           WHERE hd.ma_khach_dai_dien = public.khach_thue.ma_khach AND p.toa_nha = $2
         ))`,
      [maKhach, scope.allBuildings ? null : scope.building],
    );
    if (rowCount === 0) return { error: "Không tìm thấy khách thuê.", success: null };
  } catch {
    return { error: "Không thể xóa khách thuê. Hãy thử lại.", success: null };
  }

  revalidatePath("/khach-thue");
  return { error: null, success: "Đã xóa hồ sơ khách thuê." };
}

/** Duyệt xác thực eKYC ảnh CCCD của khách */
export async function verifyTenantEkyc(
  maKhach: string,
  trangThai: "DaXacThuc" | "TuChoi" | "ChoDuyet",
  ghiChu?: string,
): Promise<{ error: string | null; success: string | null }> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  try {
    await getDbPool().query(
      `UPDATE public.khach_thue
       SET trang_thai_ekyc = $2,
           ghi_chu_noi_bo = CASE WHEN $3::text IS NOT NULL THEN COALESCE(ghi_chu_noi_bo, '') || E'\n[eKYC]: ' || $3 ELSE ghi_chu_noi_bo END
       WHERE ma_khach = $1`,
      [maKhach, trangThai, ghiChu ?? null],
    );
    revalidatePath("/khach-thue");
    return {
      error: null,
      success:
        trangThai === "DaXacThuc"
          ? "Đã xác thực hồ sơ eKYC thành công."
          : "Đã cập nhật trạng thái eKYC.",
    };
  } catch (err) {
    console.error("Verify eKYC error:", err);
    return { error: "Không thể cập nhật eKYC. Hãy thử lại.", success: null };
  }
}

/** Cấp lại mật khẩu Mobile App cho khách thuê (Reset Password) */
export async function resetTenantPassword(maKhach: string): Promise<{
  error: string | null;
  success: boolean;
  tempPassword?: string;
  username?: string;
}> {
  const account = await getCurrentAccount();
  if (!account)
    return { error: "Phiên đăng nhập đã hết hạn.", success: false };

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{
      so_dt: string;
      ho_ten_khach: string;
      ma_tai_khoan: string | null;
    }>(
      `SELECT so_dt, ho_ten_khach, ma_tai_khoan FROM public.khach_thue WHERE ma_khach = $1 LIMIT 1`,
      [maKhach],
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy khách thuê.", success: false };
    }

    const { so_dt, ho_ten_khach, ma_tai_khoan } = rows[0];
    const tempPassword = generateTempPassword();
    const hashed = await hashPassword(tempPassword);

    let finalAccId = ma_tai_khoan;

    if (!finalAccId) {
      // Kiểm tra xem SĐT đã có tài khoản chưa
      const { rows: existingAcc } = await client.query<{ ma_tai_khoan: string }>(
        `SELECT ma_tai_khoan FROM public.tai_khoan WHERE ten_dang_nhap = $1 LIMIT 1`,
        [so_dt],
      );

      if (existingAcc.length > 0) {
        finalAccId = existingAcc[0].ma_tai_khoan;
        await client.query(
          `UPDATE public.tai_khoan
           SET mat_khau = $1, da_doi_mat_khau = false, trang_thai = 'HoatDong'
           WHERE ma_tai_khoan = $2`,
          [hashed, finalAccId],
        );
      } else {
        finalAccId = newId("TK");
        await client.query(
          `INSERT INTO public.tai_khoan
            (ma_tai_khoan, ten_dang_nhap, mat_khau, vai_tro, trang_thai, da_doi_mat_khau, ho_ten)
           VALUES ($1, $2, $3, 'KhachThue', 'HoatDong', false, $4)`,
          [finalAccId, so_dt, hashed, ho_ten_khach],
        );
      }

      await client.query(
        `UPDATE public.khach_thue SET ma_tai_khoan = $1 WHERE ma_khach = $2`,
        [finalAccId, maKhach],
      );
    } else {
      await client.query(
        `UPDATE public.tai_khoan
         SET mat_khau = $1, da_doi_mat_khau = false, trang_thai = 'HoatDong'
         WHERE ma_tai_khoan = $2`,
        [hashed, finalAccId],
      );
    }

    await client.query("COMMIT");
    revalidatePath("/khach-thue");
    return {
      error: null,
      success: true,
      tempPassword,
      username: so_dt,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reset password error:", err);
    return { error: "Không thể cấp lại mật khẩu. Hãy thử lại.", success: false };
  } finally {
    client.release();
  }
}

/** Thêm phương tiện (xe) cho cư dân */
export async function addTenantVehicle(formData: FormData): Promise<{
  error: string | null;
  success: string | null;
}> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  const maKhach = text(formData, "maKhach");
  const loaiXe = text(formData, "loaiXe") || "Xe máy";
  const bienSoXe = text(formData, "bienSoXe").toUpperCase();
  const maTheXe = text(formData, "maTheXe") || null;
  const maPhong = text(formData, "maPhong") || null;

  if (!maKhach || !bienSoXe) {
    return { error: "Vui lòng nhập biển số xe.", success: null };
  }

  try {
    const maPhuongTien = newId("PT");
    await getDbPool().query(
      `INSERT INTO public.phuong_tien
        (ma_phuong_tien, ma_khach, ma_phong, loai_xe, bien_so_xe, ma_the_xe, trang_thai)
       VALUES ($1, $2, $3, $4, $5, $6, 'DaDuyet')`,
      [maPhuongTien, maKhach, maPhong, loaiXe, bienSoXe, maTheXe],
    );
    revalidatePath("/khach-thue");
    return { error: null, success: `Đã thêm xe ${bienSoXe} thành công.` };
  } catch (err) {
    console.error("Add vehicle error:", err);
    return { error: "Không thể thêm xe. Hãy thử lại.", success: null };
  }
}

/** Duyệt hoặc cập nhật thẻ xe cho phương tiện */
export async function updateVehicleStatus(
  maPhuongTien: string,
  trangThai: "DaDuyet" | "DaHuy" | "ChoDuyet",
  maTheXe?: string,
): Promise<{ error: string | null; success: string | null }> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  try {
    await getDbPool().query(
      `UPDATE public.phuong_tien
       SET trang_thai = $2,
           ma_the_xe = COALESCE($3, ma_the_xe)
       WHERE ma_phuong_tien = $1`,
      [maPhuongTien, trangThai, maTheXe ?? null],
    );
    revalidatePath("/khach-thue");
    return { error: null, success: "Cập nhật phương tiện thành công." };
  } catch (err) {
    console.error("Update vehicle error:", err);
    return { error: "Không thể cập nhật phương tiện.", success: null };
  }
}

/** Xóa phương tiện */
export async function deleteTenantVehicle(maPhuongTien: string): Promise<{
  error: string | null;
  success: string | null;
}> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  try {
    await getDbPool().query(
      `DELETE FROM public.phuong_tien WHERE ma_phuong_tien = $1`,
      [maPhuongTien],
    );
    revalidatePath("/khach-thue");
    return { error: null, success: "Đã xóa phương tiện." };
  } catch (err) {
    console.error("Delete vehicle error:", err);
    return { error: "Không thể xóa phương tiện.", success: null };
  }
}

/** Lấy danh sách xe và lịch sử hợp đồng của cư dân phục vụ Resident Drawer */
export async function getResidentDetails(maKhach: string) {
  const account = await getCurrentAccount();
  if (!account) return { vehicles: [], contracts: [] };

  const [vehicles, contracts] = await Promise.all([
    getTenantVehicles(maKhach),
    getTenantRentalHistory(maKhach),
  ]);
  return { vehicles, contracts };
}

/**
 * Lấy ảnh CCCD mặt trước & mặt sau theo yêu cầu cho 1 khách cụ thể (Lazy loading)
 * Giúp mở Drawer và tải danh sách siêu nhanh, chỉ tải ảnh khi người dùng thực sự xem chi tiết.
 */
export async function getResidentCccdImages(maKhach: string) {
  const account = await getCurrentAccount();
  if (!account) return { anh_cccd_mat_truoc: null, anh_cccd_mat_sau: null };

  const { rows } = await getDbPool().query<{
    anh_cccd_mat_truoc: string | null;
    anh_cccd_mat_sau: string | null;
  }>(
    `SELECT anh_cccd_mat_truoc, anh_cccd_mat_sau
     FROM public.khach_thue
     WHERE ma_khach = $1
     LIMIT 1`,
    [maKhach],
  );
  return rows[0] ?? { anh_cccd_mat_truoc: null, anh_cccd_mat_sau: null };
}
