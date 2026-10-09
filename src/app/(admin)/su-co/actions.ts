"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertIssueInScope, assertRoomInScope, assertTenantInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type IssueFormState = { error: string | null; success: string | null };

const ISSUE_STATUSES = ["Chờ xử lý", "Đang xử lý", "Đã xử lý", "Đã hoàn thành"];
const PRIORITIES = ["Thấp", "Trung bình", "Cao", "Khẩn cấp"];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Kiểm tra theo MaintenanceController.ValidateForm. */
async function validate(
  maPhong: string,
  maKhachBao: string,
  trangThai: string,
  mucDoUuTien: string,
): Promise<string | null> {
  if (!maPhong) return "Vui lòng chọn phòng.";

  const { rows: roomRows } = await getDbPool().query(
    "SELECT 1 FROM public.phong WHERE ma_phong = $1 LIMIT 1",
    [maPhong],
  );
  if (roomRows.length === 0) return "Phòng không tồn tại.";

  if (maKhachBao) {
    const { rows: tenantRows } = await getDbPool().query(
      "SELECT 1 FROM public.khach_thue WHERE ma_khach = $1 LIMIT 1",
      [maKhachBao],
    );
    if (tenantRows.length === 0) return "Khách thuê không tồn tại.";
  }

  if (!ISSUE_STATUSES.includes(trangThai)) return "Trạng thái không hợp lệ.";
  if (!PRIORITIES.includes(mucDoUuTien)) return "Mức độ ưu tiên không hợp lệ.";

  return null;
}

/** Tạo phiếu sự cố theo MaintenanceController.Create. */
export async function createIssue(
  _previous: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  const maKhachBao = text(formData, "maKhachBao");
  const danhMuc = text(formData, "danhMuc");
  const noiDung = text(formData, "noiDung");
  const mucDoUuTien = text(formData, "mucDoUuTien") || "Trung bình";
  const trangThai = text(formData, "trangThai") || "Chờ xử lý";

  if (!danhMuc || !noiDung)
    return {
      error: "Vui lòng nhập danh mục và nội dung sự cố.",
      success: null,
    };

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };
  const tenantGuard = await assertTenantInScope(maKhachBao, scope);
  if (tenantGuard) return { error: tenantGuard, success: null };

  try {
    const problem = await validate(maPhong, maKhachBao, trangThai, mucDoUuTien);
    if (problem) return { error: problem, success: null };

    await getDbPool().query(
      `INSERT INTO public.su_co_bao_tri
         (ma_su_co, ma_phong, ma_khach_bao, danh_muc, noi_dung, hinh_anh_1, hinh_anh_2,
          muc_do_uu_tien, chi_phi_sua_chua, trang_thai, ngay_bao_cao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        "SC" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
        maPhong,
        maKhachBao || null,
        danhMuc,
        noiDung,
        text(formData, "hinhAnh1") || null,
        text(formData, "hinhAnh2") || null,
        mucDoUuTien,
        money(formData, "chiPhiSuaChua"),
        trangThai,
        text(formData, "ngayBaoCao") || null,
      ],
    );
  } catch {
    return {
      error: "Không thể lưu sự cố. Hãy kiểm tra dữ liệu liên quan.",
      success: null,
    };
  }

  revalidatePath("/su-co");
  revalidatePath("/");
  return { error: null, success: "Tạo phiếu sự cố thành công." };
}

/** Cập nhật phiếu sự cố theo MaintenanceController.Edit. */
export async function updateIssue(
  _previous: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maSuCo = text(formData, "maSuCo");
  const maPhong = text(formData, "maPhong");
  const maKhachBao = text(formData, "maKhachBao");
  const danhMuc = text(formData, "danhMuc");
  const noiDung = text(formData, "noiDung");
  const mucDoUuTien = text(formData, "mucDoUuTien");
  const trangThai = text(formData, "trangThai");

  if (!maSuCo) return { error: "Thiếu mã sự cố.", success: null };

  const issueGuard = await assertIssueInScope(maSuCo, scope);
  if (issueGuard) return { error: issueGuard, success: null };
  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };
  const tenantGuard = await assertTenantInScope(maKhachBao, scope);
  if (tenantGuard) return { error: tenantGuard, success: null };
  if (!danhMuc || !noiDung)
    return {
      error: "Vui lòng nhập danh mục và nội dung sự cố.",
      success: null,
    };

  try {
    const problem = await validate(maPhong, maKhachBao, trangThai, mucDoUuTien);
    if (problem) return { error: problem, success: null };

    const { rowCount } = await getDbPool().query(
      `UPDATE public.su_co_bao_tri
       SET ma_phong = $2, ma_khach_bao = $3, danh_muc = $4, noi_dung = $5,
           hinh_anh_1 = $6, hinh_anh_2 = $7, muc_do_uu_tien = $8,
           chi_phi_sua_chua = $9, trang_thai = $10, ngay_bao_cao = $11
       WHERE ma_su_co = $1`,
      [
        maSuCo,
        maPhong,
        maKhachBao || null,
        danhMuc,
        noiDung,
        text(formData, "hinhAnh1") || null,
        text(formData, "hinhAnh2") || null,
        mucDoUuTien,
        money(formData, "chiPhiSuaChua"),
        trangThai,
        text(formData, "ngayBaoCao") || null,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy phiếu sự cố.", success: null };
  } catch {
    return { error: "Không thể cập nhật sự cố. Hãy thử lại.", success: null };
  }

  revalidatePath("/su-co");
  revalidatePath("/");
  return { error: null, success: "Cập nhật sự cố thành công." };
}

/** Xóa phiếu sự cố theo MaintenanceController.Delete. */
export async function deleteIssue(
  _previous: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maSuCo = text(formData, "maSuCo");
  if (!maSuCo) return { error: "Thiếu mã sự cố.", success: null };

  const issueGuard = await assertIssueInScope(maSuCo, scope);
  if (issueGuard) return { error: issueGuard, success: null };

  try {
    const { rowCount } = await getDbPool().query(
      "DELETE FROM public.su_co_bao_tri WHERE ma_su_co = $1",
      [maSuCo],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy phiếu sự cố.", success: null };
  } catch {
    return { error: "Không thể xóa phiếu sự cố. Hãy thử lại.", success: null };
  }

  revalidatePath("/su-co");
  revalidatePath("/");
  return { error: null, success: "Đã xóa phiếu sự cố." };
}
