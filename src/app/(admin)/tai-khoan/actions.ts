"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getCurrentAccount, type AccountRow } from "@/lib/session";
import { ACCOUNT_STATUSES, DEFAULT_PASSWORD, MANAGED_ROLES } from "./constants";

export type AccountFormState = { error: string | null; success: string | null };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function newId() {
  return "TK" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Chỉ tài khoản vai trò Admin và đang HoatDong mới được quản lý tài khoản khác.
 * Trả về tài khoản hiện tại nếu hợp lệ, hoặc thông báo lỗi.
 */
async function requireAdmin(): Promise<
  { account: AccountRow } | { error: string }
> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn." };
  if (account.vai_tro !== "Admin") {
    return { error: "Chỉ tài khoản vai trò Admin mới được quản lý tài khoản." };
  }
  return { account };
}

/** Tạo tài khoản nhân viên mới với mật khẩu mặc định và cờ bắt buộc đổi mật khẩu. */
export async function createAccount(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error, success: null };

  const tenDangNhap = text(formData, "tenDangNhap");
  const hoTen = text(formData, "hoTen");
  const vaiTro = text(formData, "vaiTro") || "QuanLy";
  const toaNha = text(formData, "toaNha");

  if (!tenDangNhap)
    return { error: "Vui lòng nhập tên đăng nhập.", success: null };
  if (!hoTen)
    return { error: "Vui lòng nhập họ tên nhân viên.", success: null };
  if (!MANAGED_ROLES.includes(vaiTro as (typeof MANAGED_ROLES)[number])) {
    return { error: "Vai trò không hợp lệ.", success: null };
  }
  // Quản lý bắt buộc phải được gán một tòa để giới hạn dữ liệu.
  if (!toaNha) {
    return {
      error: "Vui lòng chọn tòa nhà mà nhân viên sẽ quản lý.",
      success: null,
    };
  }

  try {
    const { rows: existed } = await getDbPool().query<{ exists: number }>(
      `SELECT 1 AS exists FROM public.tai_khoan
       WHERE ten_dang_nhap = $1 OR ho_ten = $2 LIMIT 1`,
      [tenDangNhap, hoTen],
    );
    if (existed.length > 0) {
      return {
        error: "Tên đăng nhập hoặc họ tên này đã tồn tại.",
        success: null,
      };
    }

    const { rows: roomRows } = await getDbPool().query<{ ok: number }>(
      `SELECT 1 AS ok FROM public.phong WHERE toa_nha = $1 LIMIT 1`,
      [toaNha],
    );
    if (roomRows.length === 0) {
      return {
        error: "Tòa nhà không tồn tại trong hệ thống phòng.",
        success: null,
      };
    }

    await getDbPool().query(
      `INSERT INTO public.tai_khoan
         (ma_tai_khoan, ten_dang_nhap, mat_khau, vai_tro, co_so_van_hanh,
          ho_ten, ngay_tao, trang_thai, da_doi_mat_khau)
       VALUES ($1,$2,$3,$4,$5,$6,now(),'HoatDong',false)`,
      [
        newId(),
        tenDangNhap,
        await hashPassword(DEFAULT_PASSWORD),
        vaiTro,
        toaNha,
        hoTen,
      ],
    );
  } catch {
    return {
      error: "Không thể tạo tài khoản. Hãy kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  }

  revalidatePath("/tai-khoan");
  return {
    error: null,
    success: `Đã tạo tài khoản ${tenDangNhap}. Mật khẩu mặc định: ${DEFAULT_PASSWORD} (bắt buộc đổi khi đăng nhập lần đầu).`,
  };
}

/** Cập nhật họ tên, tòa quản lý và trạng thái của một tài khoản. */
export async function updateAccount(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error, success: null };

  const maTaiKhoan = text(formData, "maTaiKhoan");
  const hoTen = text(formData, "hoTen");
  const toaNha = text(formData, "toaNha");
  const trangThai = text(formData, "trangThai");

  if (!maTaiKhoan) return { error: "Thiếu mã tài khoản.", success: null };
  if (!hoTen)
    return { error: "Vui lòng nhập họ tên nhân viên.", success: null };
  if (!ACCOUNT_STATUSES.includes(trangThai as (typeof ACCOUNT_STATUSES)[number])) {
    return { error: "Trạng thái không hợp lệ.", success: null };
  }

  try {
    const { rows } = await getDbPool().query<{
      vai_tro: string | null;
      ten_dang_nhap: string | null;
    }>(
      `SELECT vai_tro, ten_dang_nhap FROM public.tai_khoan WHERE ma_tai_khoan = $1 LIMIT 1`,
      [maTaiKhoan],
    );
    if (rows.length === 0)
      return { error: "Không tìm thấy tài khoản.", success: null };

    // Không cho tự khóa chính mình để tránh mất quyền quản trị.
    if (maTaiKhoan === guard.account.ma_tai_khoan && trangThai !== "HoatDong") {
      return {
        error: "Bạn không thể khóa tài khoản đang đăng nhập.",
        success: null,
      };
    }

    // Tài khoản Admin luôn toàn quyền nên không gán tòa.
    const isAdmin = rows[0].vai_tro === "Admin";
    if (!isAdmin && toaNha) {
      const { rows: roomRows } = await getDbPool().query<{ ok: number }>(
        `SELECT 1 AS ok FROM public.phong WHERE toa_nha = $1 LIMIT 1`,
        [toaNha],
      );
      if (roomRows.length === 0) {
        return {
          error: "Tòa nhà không tồn tại trong hệ thống phòng.",
          success: null,
        };
      }
    }

    await getDbPool().query(
      `UPDATE public.tai_khoan
       SET ho_ten = $2, co_so_van_hanh = $3, trang_thai = $4
       WHERE ma_tai_khoan = $1`,
      [maTaiKhoan, hoTen, isAdmin ? null : toaNha || null, trangThai],
    );
  } catch {
    return {
      error: "Không thể cập nhật tài khoản. Hãy thử lại.",
      success: null,
    };
  }

  revalidatePath("/tai-khoan");
  return { error: null, success: "Cập nhật tài khoản thành công." };
}

/** Đặt lại mật khẩu về mặc định và bật lại cờ buộc đổi mật khẩu. */
export async function resetAccountPassword(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error, success: null };

  const maTaiKhoan = text(formData, "maTaiKhoan");
  if (!maTaiKhoan) return { error: "Thiếu mã tài khoản.", success: null };

  try {
    const { rowCount } = await getDbPool().query(
      `UPDATE public.tai_khoan
       SET mat_khau = $2, da_doi_mat_khau = false
       WHERE ma_tai_khoan = $1`,
      [maTaiKhoan, await hashPassword(DEFAULT_PASSWORD)],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy tài khoản.", success: null };
  } catch {
    return { error: "Không thể đặt lại mật khẩu. Hãy thử lại.", success: null };
  }

  revalidatePath("/tai-khoan");
  return {
    error: null,
    success: `Đã đặt lại mật khẩu về ${DEFAULT_PASSWORD}. Nhân viên sẽ phải đổi mật khẩu ở lần đăng nhập kế tiếp.`,
  };
}
