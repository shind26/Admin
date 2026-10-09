"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertContractInScope, assertStayInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type StayFormState = { error: string | null; success: string | null };

const STAY_STATUSES = ["Chờ xác nhận", "Đã duyệt", "Hoàn tất", "Từ chối"];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function newId(prefix: string) {
  return (
    prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
}

/** Kiểm tra dữ liệu theo StayController.ValidateForm, trả về hợp đồng được chọn. */
async function resolveContract(maHopDong: string) {
  const { rows } = await getDbPool().query<{
    ma_hop_dong: string;
    ma_phong: string;
    ma_khach_dai_dien: string;
    trang_thai: string | null;
  }>(
    `SELECT ma_hop_dong, ma_phong, ma_khach_dai_dien, trang_thai
     FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1`,
    [maHopDong],
  );
  return rows[0] ?? null;
}

/** Đăng ký khách qua đêm theo StayController.Create. */
export async function createStay(
  _previous: StayFormState,
  formData: FormData,
): Promise<StayFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHopDong = text(formData, "maHopDong");
  const hoTen = text(formData, "hoTenKhachNgoai");
  const cccd = text(formData, "cccdKhachNgoai");
  const tuNgay = text(formData, "tuNgay");
  const denNgay = text(formData, "denNgay");
  const trangThai = text(formData, "trangThai") || "Chờ xác nhận";
  const camKet = formData.get("camKetAnNinh") === "on";

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  if (!hoTen || !cccd || !tuNgay || !denNgay) {
    return {
      error: "Vui lòng nhập đầy đủ tên khách, CCCD và thời gian lưu trú.",
      success: null,
    };
  }
  if (denNgay < tuNgay) {
    return {
      error: "Ngày kết thúc không được trước ngày bắt đầu.",
      success: null,
    };
  }
  if (!STAY_STATUSES.includes(trangThai)) {
    return { error: "Trạng thái không hợp lệ.", success: null };
  }

  try {
    const contract = await resolveContract(maHopDong);
    if (!contract) return { error: "Không tìm thấy hợp đồng.", success: null };
    if (
      contract.trang_thai !== "Còn hạn" &&
      contract.trang_thai !== "Đang thuê"
    ) {
      return { error: "Chỉ chọn được hợp đồng còn hiệu lực.", success: null };
    }

    await getDbPool().query(
      `INSERT INTO public.dang_ky_khach_qua_dem
         (ma_dang_ky, ma_phong, ma_khach_dang_ky, ho_ten_khach_ngoai, cccd_khach_ngoai,
          tu_ngay, den_ngay, cam_ket_an_ninh, trang_thai)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        newId("DK"),
        contract.ma_phong,
        contract.ma_khach_dai_dien,
        hoTen,
        cccd,
        tuNgay,
        denNgay,
        camKet,
        trangThai,
      ],
    );
  } catch {
    return {
      error: "Không thể lưu đăng ký. Kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  }

  revalidatePath("/khach-thue/tam-tru");
  return { error: null, success: "Đăng ký khách qua đêm thành công." };
}

/** Cập nhật đăng ký theo StayController.Edit. */
export async function updateStay(
  _previous: StayFormState,
  formData: FormData,
): Promise<StayFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maDangKy = text(formData, "maDangKy");
  const maHopDong = text(formData, "maHopDong");

  if (!maDangKy) return { error: "Thiếu mã đăng ký.", success: null };

  const stayGuard = await assertStayInScope(maDangKy, scope);
  if (stayGuard) return { error: stayGuard, success: null };
  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };
  const hoTen = text(formData, "hoTenKhachNgoai");
  const cccd = text(formData, "cccdKhachNgoai");
  const tuNgay = text(formData, "tuNgay");
  const denNgay = text(formData, "denNgay");
  const trangThai = text(formData, "trangThai");
  const camKet = formData.get("camKetAnNinh") === "on";

  if (!maDangKy) return { error: "Thiếu mã đăng ký.", success: null };
  if (!hoTen || !cccd || !tuNgay || !denNgay) {
    return {
      error: "Vui lòng nhập đầy đủ tên khách, CCCD và thời gian lưu trú.",
      success: null,
    };
  }
  if (denNgay < tuNgay) {
    return {
      error: "Ngày kết thúc không được trước ngày bắt đầu.",
      success: null,
    };
  }
  if (!STAY_STATUSES.includes(trangThai)) {
    return { error: "Trạng thái không hợp lệ.", success: null };
  }

  try {
    const contract = await resolveContract(maHopDong);
    if (!contract) return { error: "Không tìm thấy hợp đồng.", success: null };

    const { rowCount } = await getDbPool().query(
      `UPDATE public.dang_ky_khach_qua_dem
       SET ma_phong = $2, ma_khach_dang_ky = $3, ho_ten_khach_ngoai = $4, cccd_khach_ngoai = $5,
           tu_ngay = $6, den_ngay = $7, cam_ket_an_ninh = $8, trang_thai = $9
       WHERE ma_dang_ky = $1`,
      [
        maDangKy,
        contract.ma_phong,
        contract.ma_khach_dai_dien,
        hoTen,
        cccd,
        tuNgay,
        denNgay,
        camKet,
        trangThai,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy đăng ký.", success: null };
  } catch {
    return { error: "Không thể cập nhật đăng ký. Hãy thử lại.", success: null };
  }

  revalidatePath("/khach-thue/tam-tru");
  return { error: null, success: "Cập nhật đăng ký thành công." };
}

/** Xóa đăng ký theo StayController.Delete. */
export async function deleteStay(
  _previous: StayFormState,
  formData: FormData,
): Promise<StayFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maDangKy = text(formData, "maDangKy");
  if (!maDangKy) return { error: "Thiếu mã đăng ký.", success: null };

  const stayGuard = await assertStayInScope(maDangKy, scope);
  if (stayGuard) return { error: stayGuard, success: null };

  try {
    const { rowCount } = await getDbPool().query(
      "DELETE FROM public.dang_ky_khach_qua_dem WHERE ma_dang_ky = $1",
      [maDangKy],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy đăng ký.", success: null };
  } catch {
    return { error: "Không thể xóa đăng ký. Hãy thử lại.", success: null };
  }

  revalidatePath("/khach-thue/tam-tru");
  return { error: null, success: "Đã xóa đăng ký khách qua đêm." };
}
