"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertIssueInScope, assertRoomInScope, assertTenantInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";
import { ALLOWED_NEXT_STATUSES } from "@/lib/issue-constants";

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

    const existingImagesRaw = text(formData, "existingImages");
    let images: string[] = [];
    if (existingImagesRaw) {
      try {
        images = JSON.parse(existingImagesRaw);
      } catch {}
    }
    const img1 = text(formData, "hinhAnh1");
    const img2 = text(formData, "hinhAnh2");
    if (img1 && !images.includes(img1)) images.push(img1);
    if (img2 && !images.includes(img2)) images.push(img2);

    const noiDungPayload = JSON.stringify({
      mo_ta: noiDung,
      hinh_anh: images,
    });

    await getDbPool().query(
      `INSERT INTO public.su_co_bao_tri
         (ma_su_co, ma_phong, ma_khach_bao, danh_muc, noi_dung,
          muc_do_uu_tien, chi_phi_sua_chua, trang_thai, ngay_bao_cao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        "SC" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
        maPhong,
        maKhachBao || null,
        danhMuc,
        noiDungPayload,
        mucDoUuTien,
        money(formData, "chiPhiSuaChua"),
        trangThai,
        text(formData, "ngayBaoCao") || null,
      ],
    );
  } catch (err) {
    console.error("Create issue error:", err);
    return {
      error: "Không thể lưu sự cố. Hãy kiểm tra dữ liệu liên quan.",
      success: null,
    };
  }

  revalidatePath("/su-co");
  revalidatePath("/");
  return { error: null, success: "Tạo phiếu sự cố thành công." };
}

/**
 * Cập nhật nhanh trạng thái sự cố trực tiếp từ dropdown tại bảng (chọn trạng thái tiếp theo)
 */
export async function updateIssueStatus(
  maSuCo: string,
  newTrangThai: string,
): Promise<{ error: string | null; success: string | null }> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  if (!maSuCo) return { error: "Thiếu mã sự cố.", success: null };
  if (!newTrangThai) return { error: "Vui lòng chọn trạng thái mới.", success: null };

  const issueGuard = await assertIssueInScope(maSuCo, scope);
  if (issueGuard) return { error: issueGuard, success: null };

  try {
    const { rows } = await getDbPool().query<{ trang_thai: string }>(
      `SELECT trang_thai FROM public.su_co_bao_tri WHERE ma_su_co = $1 LIMIT 1`,
      [maSuCo],
    );

    if (rows.length === 0) {
      return { error: "Không tìm thấy phiếu sự cố.", success: null };
    }

    const currentStatus = rows[0].trang_thai;
    const allowedList = ALLOWED_NEXT_STATUSES[currentStatus] ?? [currentStatus];

    if (!allowedList.includes(newTrangThai)) {
      return {
        error: `Ràng buộc quy trình: Không được phép chuyển ngược từ "${currentStatus}" về "${newTrangThai}".`,
        success: null,
      };
    }

    if (currentStatus === newTrangThai) {
      return { error: null, success: "Trạng thái không thay đổi." };
    }

    await getDbPool().query(
      `UPDATE public.su_co_bao_tri
       SET trang_thai = $2
       WHERE ma_su_co = $1`,
      [maSuCo, newTrangThai],
    );
  } catch (err) {
    console.error("Update issue status error:", err);
    return { error: "Không thể cập nhật trạng thái sự cố. Hãy thử lại.", success: null };
  }

  revalidatePath("/su-co");
  revalidatePath("/");
  return {
    error: null,
    success: `Đã cập nhật trạng thái sự cố thành "${newTrangThai}".`,
  };
}

/** Cập nhật phiếu sự cố qua Form Action (backward-compatibility cho IssueForm) */
export async function updateIssue(
  _previous: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const maSuCo = text(formData, "maSuCo");
  const trangThai = text(formData, "trangThai");
  return updateIssueStatus(maSuCo, trangThai);
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
