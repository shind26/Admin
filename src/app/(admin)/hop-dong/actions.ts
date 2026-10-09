"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertContractInScope, assertRoomInScope, assertTenantInScope } from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";

export type ContractFormState = {
  error: string | null;
  success: string | null;
};

const CONTRACT_STATUSES = ["Đang thuê", "Còn hạn", "Đã cọc", "Đã kết thúc"];

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

function newId(prefix: string) {
  return (
    prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
}

/** Kiểm tra theo ContractController.ValidateForm. */
async function validate(
  maPhong: string,
  maKhach: string,
  ngayBd: string,
  ngayKt: string,
  trangThai: string,
  currentId?: string,
): Promise<string | null> {
  if (ngayKt <= ngayBd) return "Ngày kết thúc phải sau ngày bắt đầu.";

  const { rows: roomRows } = await getDbPool().query<{
    trang_thai: string | null;
  }>("SELECT trang_thai FROM public.phong WHERE ma_phong = $1 LIMIT 1", [
    maPhong,
  ]);
  if (roomRows.length === 0) return "Phòng không tồn tại.";
  if (roomRows[0].trang_thai === "Sửa chữa")
    return "Không thể lập hợp đồng cho phòng đang sửa chữa.";

  const { rows: tenantRows } = await getDbPool().query(
    "SELECT 1 FROM public.khach_thue WHERE ma_khach = $1 LIMIT 1",
    [maKhach],
  );
  if (tenantRows.length === 0) return "Khách thuê không tồn tại.";

  if (trangThai === "Còn hạn" || trangThai === "Đang thuê") {
    const { rows: overlap } = await getDbPool().query(
      `SELECT 1 FROM public.hop_dong
       WHERE ma_phong = $1 AND trang_thai IN ('Còn hạn', 'Đang thuê')
         AND ($4::text IS NULL OR ma_hop_dong <> $4)
         AND ngay_bd < $3::date AND ngay_kt > $2::date
       LIMIT 1`,
      [maPhong, ngayBd, ngayKt, currentId ?? null],
    );
    if (overlap.length > 0)
      return "Phòng đã có hợp đồng hiệu lực trong khoảng thời gian này.";
  }

  return null;
}

/**
 * Đồng bộ trạng thái phòng theo ContractController.SyncRoomStatus:
 * phòng đang sửa chữa được giữ nguyên; còn lại thành "Đang thuê" nếu có hợp đồng hiệu lực hôm nay.
 */
async function syncRoomStatus(
  maPhong: string,
  contractId: string,
  pendingActive: boolean,
) {
  const { rows } = await getDbPool().query<{ trang_thai: string | null }>(
    "SELECT trang_thai FROM public.phong WHERE ma_phong = $1 LIMIT 1",
    [maPhong],
  );
  if (rows.length === 0 || rows[0].trang_thai === "Sửa chữa") return;

  const { rows: otherRows } = await getDbPool().query(
    `SELECT 1 FROM public.hop_dong
     WHERE ma_phong = $1 AND ma_hop_dong <> $2
       AND trang_thai IN ('Còn hạn', 'Đang thuê')
       AND ngay_bd <= CURRENT_DATE AND ngay_kt >= CURRENT_DATE
     LIMIT 1`,
    [maPhong, contractId],
  );

  const occupied = pendingActive || otherRows.length > 0;
  await getDbPool().query(
    "UPDATE public.phong SET trang_thai = $2 WHERE ma_phong = $1",
    [maPhong, occupied ? "Đang thuê" : "Trống"],
  );
}

/** Tạo hợp đồng theo ContractController.Create. */
export async function createContract(
  _previous: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  const maKhach = text(formData, "maKhachDaiDien");
  const ngayBd = text(formData, "ngayBd");
  const ngayKt = text(formData, "ngayKt");
  const ngayKy = text(formData, "ngayKy");
  const trangThai = text(formData, "trangThai") || "Đang thuê";

  if (!maPhong || !maKhach || !ngayBd || !ngayKt) {
    return {
      error: "Vui lòng chọn phòng, khách đại diện và khoảng thời gian.",
      success: null,
    };
  }
  if (!CONTRACT_STATUSES.includes(trangThai)) {
    return { error: "Trạng thái hợp đồng không hợp lệ.", success: null };
  }

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };
  const tenantGuard = await assertTenantInScope(maKhach, scope);
  if (tenantGuard) return { error: tenantGuard, success: null };

  const maHopDong = newId("HD");

  try {
    const problem = await validate(maPhong, maKhach, ngayBd, ngayKt, trangThai);
    if (problem) return { error: problem, success: null };

    await getDbPool().query(
      `INSERT INTO public.hop_dong
         (ma_hop_dong, ma_phong, ma_khach_dai_dien, ngay_bd, ngay_kt, ngay_ky,
          tien_dat_coc, gia_thue_thoa_thuan, chu_ky_thu_tien, chu_ky_khach_thue, trang_thai)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        maHopDong,
        maPhong,
        maKhach,
        ngayBd,
        ngayKt,
        ngayKy || null,
        number(formData, "tienDatCoc"),
        number(formData, "giaThueThoaThuan"),
        number(formData, "chuKyThuTien"),
        text(formData, "chuKyKhachThue") || null,
        trangThai,
      ],
    );

    const todayActive =
      (trangThai === "Còn hạn" || trangThai === "Đang thuê") &&
      ngayBd <= new Date().toISOString().slice(0, 10) &&
      ngayKt >= new Date().toISOString().slice(0, 10);
    await syncRoomStatus(maPhong, maHopDong, todayActive);
  } catch {
    return {
      error:
        "Không thể lưu hợp đồng. Hãy kiểm tra kết nối và dữ liệu liên quan.",
      success: null,
    };
  }

  revalidatePath("/hop-dong");
  revalidatePath("/phong");
  return { error: null, success: "Tạo hợp đồng thành công." };
}

/** Cập nhật hợp đồng theo ContractController.Edit. */
export async function updateContract(
  _previous: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHopDong = text(formData, "maHopDong");
  const maPhong = text(formData, "maPhong");
  const maKhach = text(formData, "maKhachDaiDien");
  const ngayBd = text(formData, "ngayBd");
  const ngayKt = text(formData, "ngayKt");
  const trangThai = text(formData, "trangThai");

  if (!maHopDong) return { error: "Thiếu mã hợp đồng.", success: null };
  if (!maPhong || !maKhach || !ngayBd || !ngayKt) {
    return {
      error: "Vui lòng chọn phòng, khách đại diện và khoảng thời gian.",
      success: null,
    };
  }
  if (!CONTRACT_STATUSES.includes(trangThai)) {
    return { error: "Trạng thái hợp đồng không hợp lệ.", success: null };
  }

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };
  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };
  const tenantGuard = await assertTenantInScope(maKhach, scope);
  if (tenantGuard) return { error: tenantGuard, success: null };

  try {
    const { rows: previousRows } = await getDbPool().query<{
      ma_phong: string | null;
    }>("SELECT ma_phong FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1", [
      maHopDong,
    ]);
    if (previousRows.length === 0)
      return { error: "Không tìm thấy hợp đồng.", success: null };
    const previousRoom = previousRows[0].ma_phong;

    const problem = await validate(
      maPhong,
      maKhach,
      ngayBd,
      ngayKt,
      trangThai,
      maHopDong,
    );
    if (problem) return { error: problem, success: null };

    await getDbPool().query(
      `UPDATE public.hop_dong
       SET ma_phong = $2, ma_khach_dai_dien = $3, ngay_bd = $4, ngay_kt = $5, ngay_ky = $6,
           tien_dat_coc = $7, gia_thue_thoa_thuan = $8, chu_ky_thu_tien = $9,
           chu_ky_khach_thue = $10, trang_thai = $11
       WHERE ma_hop_dong = $1`,
      [
        maHopDong,
        maPhong,
        maKhach,
        ngayBd,
        ngayKt,
        text(formData, "ngayKy") || null,
        number(formData, "tienDatCoc"),
        number(formData, "giaThueThoaThuan"),
        number(formData, "chuKyThuTien"),
        text(formData, "chuKyKhachThue") || null,
        trangThai,
      ],
    );

    if (previousRoom && previousRoom !== maPhong) {
      await syncRoomStatus(previousRoom, maHopDong, false);
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayActive =
      (trangThai === "Còn hạn" || trangThai === "Đang thuê") &&
      ngayBd <= today &&
      ngayKt >= today;
    await syncRoomStatus(maPhong, maHopDong, todayActive);
  } catch {
    return {
      error: "Không thể cập nhật hợp đồng. Hãy thử lại.",
      success: null,
    };
  }

  revalidatePath("/hop-dong");
  revalidatePath("/phong");
  return { error: null, success: "Cập nhật hợp đồng thành công." };
}

/** Xóa hợp đồng theo ContractController.Delete (chặn khi có hóa đơn hoặc phụ lục). */
export async function deleteContract(
  _previous: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHopDong = text(formData, "maHopDong");
  if (!maHopDong) return { error: "Thiếu mã hợp đồng.", success: null };

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  try {
    const { rows: usedRows } = await getDbPool().query<{ used: number }>(
      `SELECT (
         EXISTS(SELECT 1 FROM public.hoa_don WHERE ma_hop_dong = $1)
         OR EXISTS(SELECT 1 FROM public.phu_luc_hop_dong WHERE ma_hop_dong = $1)
       )::int AS used`,
      [maHopDong],
    );
    if ((usedRows[0]?.used ?? 0) === 1) {
      return {
        error: "Không thể xóa hợp đồng đã phát sinh hóa đơn hoặc phụ lục.",
        success: null,
      };
    }

    const { rows: roomRows } = await getDbPool().query<{
      ma_phong: string | null;
    }>("SELECT ma_phong FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1", [
      maHopDong,
    ]);
    if (roomRows.length === 0)
      return { error: "Không tìm thấy hợp đồng.", success: null };

    await getDbPool().query(
      "DELETE FROM public.hop_dong WHERE ma_hop_dong = $1",
      [maHopDong],
    );

    const maPhong = roomRows[0].ma_phong;
    if (maPhong) await syncRoomStatus(maPhong, maHopDong, false);
  } catch {
    return {
      error: "Không thể xóa hợp đồng đang có dữ liệu liên quan.",
      success: null,
    };
  }

  revalidatePath("/hop-dong");
  revalidatePath("/phong");
  return { error: null, success: "Đã xóa hợp đồng." };
}
