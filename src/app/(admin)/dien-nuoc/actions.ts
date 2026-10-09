"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertContractInScope, assertMeterInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type MeterFormState = { error: string | null; success: string | null };

const METER_STATUSES = ["Chờ duyệt", "Đã duyệt", "Từ chối"];

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

/** Kiểm tra theo MeterController.ValidateForm. */
async function validate(
  maHopDong: string,
  thangNam: string,
  chiSoDienCu: number | null,
  chiSoDienMoi: number | null,
  chiSoNuocCu: number | null,
  chiSoNuocMoi: number | null,
  trangThai: string,
  currentId?: string,
): Promise<string | null> {
  if (
    chiSoDienCu !== null &&
    chiSoDienMoi !== null &&
    chiSoDienMoi < chiSoDienCu
  ) {
    return "Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ.";
  }
  if (
    chiSoNuocCu !== null &&
    chiSoNuocMoi !== null &&
    chiSoNuocMoi < chiSoNuocCu
  ) {
    return "Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ.";
  }
  if (!METER_STATUSES.includes(trangThai))
    return "Trạng thái duyệt không hợp lệ.";

  const { rows: contractRows } = await getDbPool().query(
    "SELECT 1 FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1",
    [maHopDong],
  );
  if (contractRows.length === 0) return "Hợp đồng không tồn tại.";

  const { rows: duplicateRows } = await getDbPool().query(
    `SELECT 1 FROM public.chi_so_dien_nuoc
     WHERE ma_hop_dong = $1 AND thang_nam = $2 AND ($3::text IS NULL OR ma_ky <> $3)
     LIMIT 1`,
    [maHopDong, thangNam, currentId ?? null],
  );
  if (duplicateRows.length > 0) return "Hợp đồng đã có chỉ số trong kỳ này.";

  return null;
}

/** Ghi chỉ số theo MeterController.Create. */
export async function createMeterReading(
  _previous: MeterFormState,
  formData: FormData,
): Promise<MeterFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHopDong = text(formData, "maHopDong");
  const thangNam = text(formData, "thangNam");
  if (!maHopDong) return { error: "Vui lòng chọn hợp đồng.", success: null };

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };
  if (!/^\d{4}-\d{2}$/.test(thangNam))
    return { error: "Kỳ ghi chỉ số phải theo dạng YYYY-MM.", success: null };

  const trangThai = text(formData, "trangThai") || "Chờ duyệt";
  const chiSoDienCu = number(formData, "chiSoDienCu");
  const chiSoDienMoi = number(formData, "chiSoDienMoi");
  const chiSoNuocCu = number(formData, "chiSoNuocCu");
  const chiSoNuocMoi = number(formData, "chiSoNuocMoi");

  try {
    const problem = await validate(
      maHopDong,
      thangNam,
      chiSoDienCu,
      chiSoDienMoi,
      chiSoNuocCu,
      chiSoNuocMoi,
      trangThai,
    );
    if (problem) return { error: problem, success: null };

    await getDbPool().query(
      `INSERT INTO public.chi_so_dien_nuoc
         (ma_ky, ma_hop_dong, thang_nam, chi_so_dien_cu, chi_so_dien_moi,
          chi_so_nuoc_cu, chi_so_nuoc_moi, ngay_ghi_nhan, trang_thai_duyet,
          anh_cong_to_dien, anh_cong_to_nuoc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        "DN" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
        maHopDong,
        thangNam,
        chiSoDienCu,
        chiSoDienMoi,
        chiSoNuocCu,
        chiSoNuocMoi,
        text(formData, "ngayGhiNhan") || null,
        trangThai,
        text(formData, "anhCongToDien") || null,
        text(formData, "anhCongToNuoc") || null,
      ],
    );
  } catch {
    return {
      error: "Không thể lưu chỉ số. Hãy kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  }

  revalidatePath("/dien-nuoc");
  return { error: null, success: "Lưu chỉ số điện nước thành công." };
}

/** Cập nhật chỉ số theo MeterController.Edit. */
export async function updateMeterReading(
  _previous: MeterFormState,
  formData: FormData,
): Promise<MeterFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maKy = text(formData, "maKy");
  const maHopDong = text(formData, "maHopDong");
  const thangNam = text(formData, "thangNam");
  if (!maKy) return { error: "Thiếu mã kỳ.", success: null };

  const meterGuard = await assertMeterInScope(maKy, scope);
  if (meterGuard) return { error: meterGuard, success: null };
  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };
  if (!maHopDong) return { error: "Vui lòng chọn hợp đồng.", success: null };
  if (!/^\d{4}-\d{2}$/.test(thangNam))
    return { error: "Kỳ ghi chỉ số phải theo dạng YYYY-MM.", success: null };

  const trangThai = text(formData, "trangThai") || "Chờ duyệt";
  const chiSoDienCu = number(formData, "chiSoDienCu");
  const chiSoDienMoi = number(formData, "chiSoDienMoi");
  const chiSoNuocCu = number(formData, "chiSoNuocCu");
  const chiSoNuocMoi = number(formData, "chiSoNuocMoi");

  try {
    const problem = await validate(
      maHopDong,
      thangNam,
      chiSoDienCu,
      chiSoDienMoi,
      chiSoNuocCu,
      chiSoNuocMoi,
      trangThai,
      maKy,
    );
    if (problem) return { error: problem, success: null };

    const { rowCount } = await getDbPool().query(
      `UPDATE public.chi_so_dien_nuoc
       SET ma_hop_dong = $2, thang_nam = $3, chi_so_dien_cu = $4, chi_so_dien_moi = $5,
           chi_so_nuoc_cu = $6, chi_so_nuoc_moi = $7, ngay_ghi_nhan = $8,
           trang_thai_duyet = $9, anh_cong_to_dien = $10, anh_cong_to_nuoc = $11
       WHERE ma_ky = $1`,
      [
        maKy,
        maHopDong,
        thangNam,
        chiSoDienCu,
        chiSoDienMoi,
        chiSoNuocCu,
        chiSoNuocMoi,
        text(formData, "ngayGhiNhan") || null,
        trangThai,
        text(formData, "anhCongToDien") || null,
        text(formData, "anhCongToNuoc") || null,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };
  } catch {
    return { error: "Không thể cập nhật chỉ số. Hãy thử lại.", success: null };
  }

  revalidatePath("/dien-nuoc");
  return { error: null, success: "Cập nhật chỉ số điện nước thành công." };
}

/** Xóa kỳ ghi chỉ số theo MeterController.Delete (chặn khi có chi tiết dịch vụ). */
export async function deleteMeterReading(
  _previous: MeterFormState,
  formData: FormData,
): Promise<MeterFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maKy = text(formData, "maKy");
  if (!maKy) return { error: "Thiếu mã kỳ.", success: null };

  const meterGuard = await assertMeterInScope(maKy, scope);
  if (meterGuard) return { error: meterGuard, success: null };

  try {
    const { rows } = await getDbPool().query<{ used: number }>(
      `SELECT EXISTS(SELECT 1 FROM public.chi_tiet_dich_vu WHERE ma_ky = $1)::int AS used`,
      [maKy],
    );
    if ((rows[0]?.used ?? 0) === 1) {
      return {
        error: "Không thể xóa kỳ đã phát sinh chi tiết dịch vụ.",
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      "DELETE FROM public.chi_so_dien_nuoc WHERE ma_ky = $1",
      [maKy],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };
  } catch {
    return {
      error: "Không thể xóa kỳ ghi chỉ số. Hãy thử lại.",
      success: null,
    };
  }

  revalidatePath("/dien-nuoc");
  return { error: null, success: "Đã xóa kỳ ghi chỉ số." };
}
