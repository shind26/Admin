"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import {
  assertContractInScope,
  assertRoomInScope,
  assertTenantInScope,
} from "@/lib/guards";
import { getCurrentAccount, requireScope } from "@/lib/session";
import { hashPassword, DEFAULT_CUSTOMER_PASSWORD } from "@/lib/password";
import { saveHandoverAssets } from "@/lib/handover";
import { createNotification } from "@/lib/notifications";

export type ContractFormState = {
  error: string | null;
  success: string | null;
  tempPassword?: string | null;
  username?: string | null;
  maHopDong?: string | null;
  tenantName?: string | null;
};

const CONTRACT_STATUSES = ["Còn hạn", "Đã đặt cọc", "Đã kết thúc"];

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

function generateTempPassword() {
  return DEFAULT_CUSTOMER_PASSWORD;
}

/** Kiểm tra theo ContractController.ValidateForm. */
async function validate(
  maPhong: string,
  maKhach: string,
  ngayBd: string,
  ngayKt: string,
  ngayKy: string | null | undefined,
  trangThai: string,
  currentId?: string,
): Promise<string | null> {
  if (!ngayBd || !ngayKt) return "Vui lòng nhập ngày bắt đầu và ngày kết thúc hợp đồng.";
  if (ngayKt <= ngayBd) return "Ngày kết thúc hợp đồng phải sau ngày bắt đầu vào ở.";
  if (ngayKy) {
    if (ngayKy > ngayKt)
      return "Ngày ký hợp đồng không thể sau ngày kết thúc hợp đồng.";
    if (ngayKy > ngayBd)
      return "Ngày ký hợp đồng không thể sau ngày bắt đầu vào ở (bàn giao phòng).";
  }

  const { rows: roomRows } = await getDbPool().query<{
    trang_thai: string | null;
  }>("SELECT trang_thai FROM public.phong WHERE ma_phong = $1 LIMIT 1", [
    maPhong,
  ]);
  if (roomRows.length === 0) return "Phòng không tồn tại.";
  if (roomRows[0].trang_thai === "Đang bảo trì")
    return "Không thể lập hợp đồng cho phòng đang bảo trì.";
  if (!currentId) {
    if (roomRows[0].trang_thai === "Đang thuê")
      return "Không thể chọn phòng đang thuê để tạo hợp đồng mới.";
    if (
      roomRows[0].trang_thai === "Đã đặt cọc" ||
      roomRows[0].trang_thai === "Đã cọc"
    )
      return "Không thể chọn phòng đã đặt cọc để tạo hợp đồng mới. Vui lòng xác nhận qua hàng đợi giữ chỗ hoặc chờ giải phóng cọc.";
  }

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
 * Đồng bộ trạng thái phòng:
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
  if (rows.length === 0 || rows[0].trang_thai === "Đang bảo trì") return;

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

/** Tạo hợp đồng mới & tự động cấp tài khoản Mobile App nếu khách chưa có */
export async function createContract(
  _previous: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  const tenantMode = text(formData, "tenantMode") || "existing";
  let maKhach = text(formData, "maKhachDaiDien");
  const ngayBd = text(formData, "ngayBd");
  const ngayKt = text(formData, "ngayKt");
  const ngayKy = text(formData, "ngayKy") || new Date().toISOString().slice(0, 10);
  // Trạng thái hợp đồng khi tạo mới luôn mặc định là "Còn hạn"
  const trangThai = "Còn hạn";

  if (!maPhong || !ngayBd || !ngayKt) {
    return {
      error: "Vui lòng chọn phòng và khoảng thời gian thuê.",
      success: null,
    };
  }

  // Khách mới tạo trực tiếp
  const newHoTen = text(formData, "newHoTen");
  const newSoDt = text(formData, "newSoDt");
  const newCccd = text(formData, "newCccd");
  const newDiaChi = text(formData, "newDiaChi");

  if (tenantMode === "new") {
    if (!newHoTen || !newSoDt || !newCccd) {
      return {
        error: "Vui lòng nhập đầy đủ Họ tên, Số điện thoại và CCCD của khách thuê mới.",
        success: null,
      };
    }
  } else if (!maKhach) {
    return {
      error: "Vui lòng chọn khách thuê đại diện từ danh sách.",
      success: null,
    };
  }

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  if (tenantMode === "existing" && maKhach) {
    const tenantGuard = await assertTenantInScope(maKhach, scope);
    if (tenantGuard) return { error: tenantGuard, success: null };
  }

  const maHopDong = newId("HD");
  const client = await getDbPool().connect();
  let tempPassCreated: string | null = null;
  let tenantPhone: string | null = null;
  let finalTenantName: string | null = null;

  try {
    await client.query("BEGIN");

    // 1. Lấy thông tin tòa nhà của phòng
    const { rows: roomRows } = await client.query<{ toa_nha: string | null }>(
      "SELECT toa_nha FROM public.phong WHERE ma_phong = $1 LIMIT 1",
      [maPhong],
    );
    const building = roomRows[0]?.toa_nha ?? null;

    // 2. Xử lý khách thuê
    if (tenantMode === "new") {
      // Kiểm tra xem khách đã có hồ sơ chưa (qua CCCD hoặc SĐT)
      const { rows: existingTenant } = await client.query<{
        ma_khach: string;
        ma_tai_khoan: string | null;
        ho_ten_khach: string;
        so_dt: string;
      }>(
        "SELECT ma_khach, ma_tai_khoan, ho_ten_khach, so_dt FROM public.khach_thue WHERE cccd = $1 OR so_dt = $2 LIMIT 1",
        [newCccd, newSoDt],
      );

      if (existingTenant.length > 0) {
        maKhach = existingTenant[0].ma_khach;
        finalTenantName = existingTenant[0].ho_ten_khach;
        tenantPhone = existingTenant[0].so_dt;
      } else {
        maKhach = newId("KH");
        finalTenantName = newHoTen;
        tenantPhone = newSoDt;
        await client.query(
          `INSERT INTO public.khach_thue
             (ma_khach, ho_ten_khach, so_dt, cccd, dia_chi_thuong_tru, trang_thai_ekyc)
           VALUES ($1, $2, $3, $4, $5, 'ChuaXacThuc')`,
          [maKhach, newHoTen, newSoDt, newCccd, newDiaChi || ""],
        );
      }
    }

    const problem = await validate(maPhong, maKhach, ngayBd, ngayKt, ngayKy, trangThai);
    if (problem) {
      await client.query("ROLLBACK");
      return { error: problem, success: null };
    }

    // 3. Lấy thông tin khách & kiểm tra tài khoản
    const { rows: tenantRows } = await client.query<{
      so_dt: string;
      ho_ten_khach: string;
      ma_tai_khoan: string | null;
    }>(
      "SELECT so_dt, ho_ten_khach, ma_tai_khoan FROM public.khach_thue WHERE ma_khach = $1 LIMIT 1",
      [maKhach],
    );
    if (tenantRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy khách thuê.", success: null };
    }

    tenantPhone = tenantRows[0].so_dt;
    finalTenantName = tenantRows[0].ho_ten_khach;
    let finalAccountId = tenantRows[0].ma_tai_khoan;

    // 4. Xử lý cấp tài khoản hoặc cập nhật cơ sở vận hành cho tài khoản
    if (!finalAccountId) {
      // Kiểm tra xem SĐT này đã có tài khoản trong tai_khoan chưa
      const { rows: existingAcc } = await client.query<{ ma_tai_khoan: string }>(
        "SELECT ma_tai_khoan FROM public.tai_khoan WHERE ten_dang_nhap = $1 LIMIT 1",
        [tenantPhone],
      );

      if (existingAcc.length > 0) {
        finalAccountId = existingAcc[0].ma_tai_khoan;
        tempPassCreated = DEFAULT_CUSTOMER_PASSWORD;
        const hashed = await hashPassword(DEFAULT_CUSTOMER_PASSWORD);
        await client.query(
          `UPDATE public.tai_khoan
           SET mat_khau = $1, co_so_van_hanh = $2, vai_tro = 'KhachThue', trang_thai = 'HoatDong', da_doi_mat_khau = false
           WHERE ma_tai_khoan = $3`,
          [hashed, building, finalAccountId],
        );
      } else {
        // Tự động cấp tài khoản App mới với username = SĐT
        tempPassCreated = DEFAULT_CUSTOMER_PASSWORD;
        const hashed = await hashPassword(tempPassCreated);
        finalAccountId = newId("TK");
        await client.query(
          `INSERT INTO public.tai_khoan
            (ma_tai_khoan, ten_dang_nhap, mat_khau, vai_tro, co_so_van_hanh, trang_thai, da_doi_mat_khau, ho_ten)
           VALUES ($1, $2, $3, 'KhachThue', $4, 'HoatDong', false, $5)`,
          [finalAccountId, tenantPhone, hashed, building, finalTenantName],
        );
      }

      await client.query(
        "UPDATE public.khach_thue SET ma_tai_khoan = $1 WHERE ma_khach = $2",
        [finalAccountId, maKhach],
      );
    } else {
      // Đã có tài khoản: cập nhật co_so_van_hanh theo tòa nhà đang thuê
      await client.query(
        "UPDATE public.tai_khoan SET co_so_van_hanh = $1 WHERE ma_tai_khoan = $2",
        [building, finalAccountId],
      );
    }

    // 5. Tạo bản ghi hợp đồng
    await client.query(
      `INSERT INTO public.hop_dong
         (ma_hop_dong, ma_phong, ma_khach_dai_dien, ngay_bd, ngay_kt, ngay_ky,
          tien_dat_coc, gia_thue_thoa_thuan, chu_ky_thu_tien, trang_thai)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
        trangThai,
      ],
    );

    // Đồng bộ khách đại diện trong chi_tiet_hop_dong_khach_thue
    await client.query(
      `UPDATE public.chi_tiet_hop_dong_khach_thue
       SET vai_tro = 'Thành viên ở cùng'
       WHERE ma_hop_dong = $1 AND vai_tro IN ('Đại diện hợp đồng', 'DaiDien') AND ma_khach <> $2`,
      [maHopDong, maKhach],
    );
    await client.query(
      `INSERT INTO public.chi_tiet_hop_dong_khach_thue
         (ma_hop_dong, ma_khach, vai_tro, ngay_vao_o, trang_thai_luu_tru)
       VALUES ($1, $2, 'Đại diện hợp đồng', $3, 'Đang ở')
       ON CONFLICT (ma_hop_dong, ma_khach) DO UPDATE
       SET vai_tro = 'Đại diện hợp đồng', trang_thai_luu_tru = 'Đang ở'`,
      [maHopDong, maKhach, ngayBd],
    );

    // 6. Tự động thêm khách vào bảng chi_tiet_hop_dong_khach_thue với vai trò 'DaiDien'
    await client.query(
      `INSERT INTO public.chi_tiet_hop_dong_khach_thue
         (ma_hop_dong, ma_khach, vai_tro, ngay_vao_o, trang_thai_luu_tru)
       VALUES ($1, $2, 'Đại diện hợp đồng', $3, 'Đang ở')
       ON CONFLICT (ma_hop_dong, ma_khach) DO UPDATE
       SET vai_tro = 'Đại diện hợp đồng', trang_thai_luu_tru = 'Đang ở', ngay_vao_o = EXCLUDED.ngay_vao_o`,
      [maHopDong, maKhach, ngayBd],
    );

    // 7. Lưu danh mục tài sản bàn giao đã kiểm tra / sửa đổi vào bảng tai_san
    const handoverItemsJson = text(formData, "handoverItemsJson");
    await saveHandoverAssets(client, maPhong, handoverItemsJson);

    await client.query("COMMIT");

    const todayActive =
      (trangThai === "Còn hạn" || trangThai === "Đang thuê") &&
      ngayBd <= new Date().toISOString().slice(0, 10) &&
      ngayKt >= new Date().toISOString().slice(0, 10);
    await syncRoomStatus(maPhong, maHopDong, todayActive);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create contract error:", err);
    return {
      error: "Không thể lưu hợp đồng. Hãy kiểm tra kết nối và dữ liệu liên quan.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/hop-dong");
  revalidatePath("/phong");
  revalidatePath("/khach-thue");

  return {
    error: null,
    success: `Tạo hợp đồng ${maHopDong} thành công.`,
    tempPassword: tempPassCreated,
    username: tempPassCreated ? tenantPhone : null,
    maHopDong,
    tenantName: finalTenantName,
  };
}

/** Cập nhật hợp đồng (kèm nghiệp vụ thanh lý / kết thúc hợp đồng) */
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

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    const { rows: previousRows } = await client.query<{
      ma_phong: string | null;
    }>("SELECT ma_phong FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1", [
      maHopDong,
    ]);
    if (previousRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy hợp đồng.", success: null };
    }
    const previousRoom = previousRows[0].ma_phong;

    const ngayKy = text(formData, "ngayKy");
    const problem = await validate(
      maPhong,
      maKhach,
      ngayBd,
      ngayKt,
      ngayKy,
      trangThai,
      maHopDong,
    );
    if (problem) {
      await client.query("ROLLBACK");
      return { error: problem, success: null };
    }

    await client.query(
      `UPDATE public.hop_dong
       SET ma_phong = $2, ma_khach_dai_dien = $3, ngay_bd = $4, ngay_kt = $5, ngay_ky = $6,
           tien_dat_coc = $7, gia_thue_thoa_thuan = $8, chu_ky_thu_tien = $9,
           trang_thai = $10
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
        trangThai,
      ],
    );

    // Xử lý khi Hợp đồng ĐÃ KẾT THÚC (Check-out)
    if (trangThai === "Đã kết thúc") {
      // 1. Cập nhật trạng thái người ở sang 'DaRoiDi'
      await client.query(
        "UPDATE public.chi_tiet_hop_dong_khach_thue SET trang_thai_luu_tru = 'Đã rời đi' WHERE ma_hop_dong = $1",
        [maHopDong],
      );

      // 2. Tìm tất cả khách trong hợp đồng (cả đại diện lẫn người ở cùng)
      const { rows: allContractTenants } = await client.query<{ ma_khach: string }>(
        `SELECT DISTINCT ma_khach FROM public.chi_tiet_hop_dong_khach_thue WHERE ma_hop_dong = $1
         UNION
         SELECT $2 AS ma_khach`,
        [maHopDong, maKhach],
      );

      // 3. Nếu khách không còn ở phòng nào khác -> Cập nhật co_so_van_hanh = NULL trên tai_khoan (Cựu cư dân)
      for (const t of allContractTenants) {
        if (!t.ma_khach) continue;
        const { rows: activeOther } = await client.query(
          `SELECT 1 FROM public.hop_dong hd
           LEFT JOIN public.chi_tiet_hop_dong_khach_thue ct ON ct.ma_hop_dong = hd.ma_hop_dong
           WHERE (hd.ma_khach_dai_dien = $1 OR (ct.ma_khach = $1 AND ct.trang_thai_luu_tru IN ('Đang ở', 'DangO')))
             AND hd.ma_hop_dong <> $2
             AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
           LIMIT 1`,
          [t.ma_khach, maHopDong],
        );

        if (activeOther.length === 0) {
          await client.query(
            `UPDATE public.tai_khoan tk
             SET co_so_van_hanh = NULL
             FROM public.khach_thue kt
             WHERE kt.ma_khach = $1 AND kt.ma_tai_khoan = tk.ma_tai_khoan`,
            [t.ma_khach],
          );
        }
      }
    }

    await client.query("COMMIT");

    if (previousRoom && previousRoom !== maPhong) {
      await syncRoomStatus(previousRoom, maHopDong, false);
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayActive =
      (trangThai === "Còn hạn" || trangThai === "Đang thuê") &&
      ngayBd <= today &&
      ngayKt >= today;
    await syncRoomStatus(maPhong, maHopDong, todayActive);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update contract error:", err);
    return {
      error: "Không thể cập nhật hợp đồng. Hãy thử lại.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/hop-dong");
  revalidatePath("/phong");
  revalidatePath("/khach-thue");
  return { error: null, success: "Cập nhật hợp đồng thành công." };
}

/** Xóa hợp đồng */
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

    const { rows: contractRows } = await getDbPool().query<{
      ma_phong: string | null;
      ma_khach_dai_dien: string | null;
    }>(
      "SELECT ma_phong, ma_khach_dai_dien FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1",
      [maHopDong],
    );
    if (contractRows.length === 0)
      return { error: "Không tìm thấy hợp đồng.", success: null };

    // Thu thập danh sách khách trong hợp đồng
    const { rows: contractTenants } = await getDbPool().query<{ ma_khach: string }>(
      `SELECT DISTINCT ma_khach FROM public.chi_tiet_hop_dong_khach_thue WHERE ma_hop_dong = $1
       UNION
       SELECT $2 AS ma_khach WHERE $2 IS NOT NULL`,
      [maHopDong, contractRows[0].ma_khach_dai_dien],
    );

    // Xóa liên kết người ở cùng
    await getDbPool().query(
      "DELETE FROM public.chi_tiet_hop_dong_khach_thue WHERE ma_hop_dong = $1",
      [maHopDong],
    );

    await getDbPool().query(
      "DELETE FROM public.hop_dong WHERE ma_hop_dong = $1",
      [maHopDong],
    );

    // Kiểm tra & cập nhật co_so_van_hanh = NULL cho khách không còn hợp đồng hiệu lực
    for (const t of contractTenants) {
      if (!t.ma_khach) continue;
      const { rows: otherActive } = await getDbPool().query(
        `SELECT 1 FROM public.hop_dong hd
         LEFT JOIN public.chi_tiet_hop_dong_khach_thue ct ON ct.ma_hop_dong = hd.ma_hop_dong
         WHERE (hd.ma_khach_dai_dien = $1 OR (ct.ma_khach = $1 AND ct.trang_thai_luu_tru IN ('Đang ở', 'DangO')))
           AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
         LIMIT 1`,
        [t.ma_khach],
      );

      if (otherActive.length === 0) {
        await getDbPool().query(
          `UPDATE public.tai_khoan tk
           SET co_so_van_hanh = NULL
           FROM public.khach_thue kt
           WHERE kt.ma_khach = $1 AND kt.ma_tai_khoan = tk.ma_tai_khoan`,
          [t.ma_khach],
        );
      }
    }

    const maPhong = contractRows[0].ma_phong;
    if (maPhong) await syncRoomStatus(maPhong, maHopDong, false);
  } catch {
    return {
      error: "Không thể xóa hợp đồng đang có dữ liệu liên quan.",
      success: null,
    };
  }

  revalidatePath("/hop-dong");
  revalidatePath("/phong");
  revalidatePath("/khach-thue");
  return { error: null, success: "Đã xóa hợp đồng." };
}

export type ProvisionAccountState = {
  error: string | null;
  success: string | null;
  username?: string | null;
  tempPassword?: string | null;
  occupantName?: string | null;
};

/** Cấp tài khoản Mobile App cho người ở cùng và gửi thông báo tự động cho chủ phòng */
export async function provisionOccupantAccount(
  maHopDong: string,
  maKhach: string,
): Promise<ProvisionAccountState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    // 1. Lấy thông tin người ở cùng
    const { rows: occupantRows } = await client.query<{
      ho_ten_khach: string;
      so_dt: string;
      ma_tai_khoan: string | null;
    }>(
      `SELECT ho_ten_khach, so_dt, ma_tai_khoan FROM public.khach_thue WHERE ma_khach = $1 LIMIT 1`,
      [maKhach],
    );
    if (occupantRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy thông tin khách ở cùng.", success: null };
    }
    const occupant = occupantRows[0];
    if (!occupant.so_dt) {
      await client.query("ROLLBACK");
      return { error: "Khách ở cùng chưa có số điện thoại để cấp tài khoản.", success: null };
    }

    // 2. Lấy thông tin hợp đồng, phòng & chủ phòng (đại diện)
    const { rows: contractRows } = await client.query<{
      ma_phong: string;
      toa_nha: string | null;
      ten_phong: string | null;
      rep_tai_khoan: string | null;
      rep_ho_ten: string | null;
    }>(
      `SELECT hd.ma_phong, p.toa_nha, COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
              k_rep.ma_tai_khoan AS rep_tai_khoan, k_rep.ho_ten_khach AS rep_ho_ten
       FROM public.hop_dong hd
       LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.khach_thue k_rep ON k_rep.ma_khach = hd.ma_khach_dai_dien
       WHERE hd.ma_hop_dong = $1 LIMIT 1`,
      [maHopDong],
    );
    if (contractRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy hợp đồng.", success: null };
    }
    const contract = contractRows[0];

    // 3. Tạo tài khoản hoặc kích hoạt
    const tempPassword = DEFAULT_CUSTOMER_PASSWORD;
    const hashed = await hashPassword(tempPassword);
    let finalAccountId = occupant.ma_tai_khoan;

    if (!finalAccountId) {
      const { rows: existingAcc } = await client.query<{ ma_tai_khoan: string }>(
        `SELECT ma_tai_khoan FROM public.tai_khoan WHERE ten_dang_nhap = $1 LIMIT 1`,
        [occupant.so_dt],
      );
      if (existingAcc.length > 0) {
        finalAccountId = existingAcc[0].ma_tai_khoan;
        await client.query(
          `UPDATE public.tai_khoan
           SET mat_khau = $1, da_doi_mat_khau = false, trang_thai = 'HoatDong', co_so_van_hanh = $2
           WHERE ma_tai_khoan = $3`,
          [hashed, contract.toa_nha, finalAccountId],
        );
      } else {
        finalAccountId = newId("TK");
        await client.query(
          `INSERT INTO public.tai_khoan
            (ma_tai_khoan, ten_dang_nhap, mat_khau, vai_tro, trang_thai, da_doi_mat_khau, ho_ten, co_so_van_hanh)
           VALUES ($1, $2, $3, 'KhachThue', 'HoatDong', false, $4, $5)`,
          [finalAccountId, occupant.so_dt, hashed, occupant.ho_ten_khach, contract.toa_nha],
        );
      }

      await client.query(
        `UPDATE public.khach_thue SET ma_tai_khoan = $1 WHERE ma_khach = $2`,
        [finalAccountId, maKhach],
      );
    } else {
      await client.query(
        `UPDATE public.tai_khoan
         SET mat_khau = $1, da_doi_mat_khau = false, trang_thai = 'HoatDong', co_so_van_hanh = $2
         WHERE ma_tai_khoan = $3`,
        [hashed, contract.toa_nha, finalAccountId],
      );
    }

    // 4. Cập nhật chi tiết hợp đồng sang 'Đang ở'
    await client.query(
      `UPDATE public.chi_tiet_hop_dong_khach_thue
       SET trang_thai_luu_tru = 'Đang ở'
       WHERE ma_hop_dong = $1 AND ma_khach = $2`,
      [maHopDong, maKhach],
    );

    // 5. Gửi thông báo đến bảng thong_bao cho Chủ phòng (Khách đại diện) để hiển thị trên Mobile
    if (contract.rep_tai_khoan) {
      await createNotification(
        {
          maTaiKhoan: contract.rep_tai_khoan,
          maPhong: contract.ma_phong,
          toaNha: contract.toa_nha,
          tieuDe: "Đã cấp tài khoản cho bạn ở cùng",
          noiDung: `Ban quản lý đã cấp tài khoản cho bạn cùng phòng ${occupant.ho_ten_khach} (SĐT: ${occupant.so_dt}). Mật khẩu mặc định: ${tempPassword}.`,
          loaiThongBao: "TaiKhoan",
          duLieuDinhKem: {
            so_dt: occupant.so_dt,
            ho_ten: occupant.ho_ten_khach,
            mat_khau: tempPassword,
            ma_hop_dong: maHopDong,
            ma_phong: contract.ma_phong,
          },
        },
        client,
      );
    }

    // 6. Gửi thông báo chào mừng đến tài khoản của bạn cùng phòng
    await createNotification(
      {
        maTaiKhoan: finalAccountId,
        maPhong: contract.ma_phong,
        toaNha: contract.toa_nha,
        tieuDe: `Chào mừng bạn đến phòng ${contract.ten_phong}!`,
        noiDung: `Tài khoản của bạn đã được kích hoạt. Vui lòng đổi mật khẩu và cập nhật thông tin cá nhân.`,
        loaiThongBao: "TaiKhoan",
        duLieuDinhKem: {
          ma_hop_dong: maHopDong,
          ma_phong: contract.ma_phong,
        },
      },
      client,
    );

    await client.query("COMMIT");

    revalidatePath(`/hop-dong/${maHopDong}`);
    revalidatePath("/khach-thue");

    return {
      error: null,
      success: `Đã cấp tài khoản thành công cho ${occupant.ho_ten_khach}. Đã lưu thông báo gửi đến chủ phòng.`,
      username: occupant.so_dt,
      tempPassword,
      occupantName: occupant.ho_ten_khach,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Provision occupant account error:", err);
    return { error: "Không thể cấp tài khoản cho người ở cùng.", success: null };
  } finally {
    client.release();
  }
}

/** Thêm người ở cùng vào hợp đồng (chọn khách có sẵn hoặc nhập nhanh Họ tên & SĐT) */
export async function addContractOccupant(
  maHopDong: string,
  maKhachOrPayload: string | { maKhach?: string; newHoTen?: string; newSoDt?: string; ngayVaoO?: string },
  maybeNgayVaoO?: string,
): Promise<{ error: string | null; success: string | null }> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const isPayloadObj = typeof maKhachOrPayload === "object" && maKhachOrPayload !== null;
  const maKhach = isPayloadObj ? maKhachOrPayload.maKhach : maKhachOrPayload;
  const newHoTen = isPayloadObj ? maKhachOrPayload.newHoTen?.trim() : undefined;
  const newSoDt = isPayloadObj ? maKhachOrPayload.newSoDt?.trim() : undefined;
  const ngayVaoO = isPayloadObj ? maKhachOrPayload.ngayVaoO : maybeNgayVaoO;

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    let finalMaKhach = maKhach;

    if (!finalMaKhach && newHoTen && newSoDt) {
      // Tìm xem đã có khách thuê với SĐT này chưa
      const { rows: existing } = await client.query<{ ma_khach: string }>(
        `SELECT ma_khach FROM public.khach_thue WHERE so_dt = $1 LIMIT 1`,
        [newSoDt],
      );
      if (existing.length > 0) {
        finalMaKhach = existing[0].ma_khach;
      } else {
        finalMaKhach = newId("KH");
        await client.query(
          `INSERT INTO public.khach_thue (ma_khach, ho_ten_khach, so_dt, trang_thai_ekyc)
           VALUES ($1, $2, $3, 'ChuaXacThuc')`,
          [finalMaKhach, newHoTen, newSoDt],
        );
      }
    }

    if (!finalMaKhach) {
      await client.query("ROLLBACK");
      return { error: "Vui lòng chọn khách thuê hoặc nhập Họ tên và SĐT.", success: null };
    }

    // Kiểm tra xem khách đã có tài khoản chưa để gán trạng thái lưu trú
    const { rows: tenantRow } = await client.query<{ ma_tai_khoan: string | null }>(
      `SELECT ma_tai_khoan FROM public.khach_thue WHERE ma_khach = $1 LIMIT 1`,
      [finalMaKhach],
    );
    const hasAccount = tenantRow.length > 0 && !!tenantRow[0].ma_tai_khoan;
    const trangThaiLuuTru = hasAccount ? "Đang ở" : "Chờ cấp tài khoản";

    await client.query(
      `INSERT INTO public.chi_tiet_hop_dong_khach_thue
         (ma_hop_dong, ma_khach, vai_tro, ngay_vao_o, trang_thai_luu_tru)
       VALUES ($1, $2, 'Thành viên ở cùng', COALESCE($3::date, CURRENT_DATE), $4)
       ON CONFLICT (ma_hop_dong, ma_khach) DO UPDATE
       SET vai_tro = 'Thành viên ở cùng', trang_thai_luu_tru = $4, ngay_vao_o = COALESCE($3::date, CURRENT_DATE)`,
      [maHopDong, finalMaKhach, ngayVaoO || null, trangThaiLuuTru],
    );

    // Cập nhật co_so_van_hanh của người ở cùng theo tòa của phòng
    await client.query(
      `UPDATE public.tai_khoan tk
       SET co_so_van_hanh = p.toa_nha
       FROM public.khach_thue kt, public.hop_dong hd, public.phong p
       WHERE kt.ma_khach = $2 AND kt.ma_tai_khoan = tk.ma_tai_khoan
         AND hd.ma_hop_dong = $1 AND p.ma_phong = hd.ma_phong`,
      [maHopDong, finalMaKhach],
    );

    await client.query("COMMIT");

    revalidatePath(`/hop-dong/${maHopDong}`);
    revalidatePath("/khach-thue");
    return { error: null, success: "Đã thêm người ở cùng vào phòng." };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Add occupant error:", err);
    return { error: "Không thể thêm người ở cùng.", success: null };
  } finally {
    client.release();
  }
}

/** Xóa / Đánh dấu người ở cùng đã rời đi */
export async function removeContractOccupant(
  maHopDong: string,
  maKhach: string,
): Promise<{ error: string | null; success: string | null }> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  try {
    await getDbPool().query(
      `UPDATE public.chi_tiet_hop_dong_khach_thue
       SET trang_thai_luu_tru = 'Đã rời đi'
       WHERE ma_hop_dong = $1 AND ma_khach = $2`,
      [maHopDong, maKhach],
    );

    // Kiểm tra xem khách này còn hợp đồng nào khác không
    const { rows: otherActive } = await getDbPool().query(
      `SELECT 1 FROM public.hop_dong hd
       LEFT JOIN public.chi_tiet_hop_dong_khach_thue ct ON ct.ma_hop_dong = hd.ma_hop_dong
       WHERE (hd.ma_khach_dai_dien = $1 OR (ct.ma_khach = $1 AND ct.trang_thai_luu_tru IN ('Đang ở', 'DangO')))
         AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
       LIMIT 1`,
      [maKhach],
    );

    if (otherActive.length === 0) {
      await getDbPool().query(
        `UPDATE public.tai_khoan tk
         SET co_so_van_hanh = NULL
         FROM public.khach_thue kt
         WHERE kt.ma_khach = $1 AND kt.ma_tai_khoan = tk.ma_tai_khoan`,
        [maKhach],
      );
    }

    revalidatePath(`/hop-dong/${maHopDong}`);
    revalidatePath("/khach-thue");
    return { error: null, success: "Đã cập nhật trạng thái người ở." };
  } catch (err) {
    console.error("Remove occupant error:", err);
    return { error: "Không thể cập nhật người ở.", success: null };
  }
}

export type LiquidationFormState = {
  error: string | null;
  success: string | null;
  maThanhLy?: string | null;
};

/** Thanh lý hợp đồng, lập biên bản thanh lý và thu hồi phòng/quyền cư dân */
export async function liquidateContract(
  _previous: LiquidationFormState,
  formData: FormData,
): Promise<LiquidationFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maHopDong = text(formData, "maHopDong");
  const ngayTraPhong = text(formData, "ngayTraPhong") || new Date().toISOString().slice(0, 10);
  const chiSoDienCuoi = number(formData, "chiSoDienCuoi");
  const chiSoNuocCuoi = number(formData, "chiSoNuocCuoi");
  const tienCocHoanLai = number(formData, "tienCocHoanLai") ?? 0;
  const tienKhTraThem = number(formData, "tienKhTraThem") ?? 0;
  const ghiChu = text(formData, "ghiChu") || null;

  if (!maHopDong) return { error: "Thiếu mã hợp đồng cần thanh lý.", success: null };
  if (chiSoDienCuoi === null || chiSoNuocCuoi === null) {
    return {
      error: "Vui lòng nhập đầy đủ chỉ số điện và nước ngày trả phòng.",
      success: null,
    };
  }

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const existingMaThanhLy = text(formData, "maThanhLy");
  const maThanhLy = existingMaThanhLy || newId("TL");
  const client = await getDbPool().connect();

  try {
    await client.query("BEGIN");

    // 1. Kiểm tra hợp đồng và lấy thông tin cư dân để gửi thông báo
    const { rows: contractRows } = await client.query<{
      ma_phong: string;
      ma_khach_dai_dien: string;
      trang_thai: string;
      toa_nha: string | null;
      ten_phong: string | null;
      ma_tai_khoan: string | null;
    }>(
      `SELECT hd.ma_phong, hd.ma_khach_dai_dien, hd.trang_thai,
              p.toa_nha, COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
              kt.ma_tai_khoan
       FROM public.hop_dong hd
       LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.khach_thue kt ON kt.ma_khach = hd.ma_khach_dai_dien
       WHERE hd.ma_hop_dong = $1 LIMIT 1`,
      [maHopDong],
    );
    if (contractRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy hợp đồng.", success: null };
    }
    const contract = contractRows[0];
    if (contract.trang_thai === "Đã kết thúc") {
      await client.query("ROLLBACK");
      return { error: "Hợp đồng này đã được thanh lý trước đó.", success: null };
    }

    // 2. Lưu biên bản thanh lý vào public.bien_ban_thanh_ly (trạng thái DA_DUYET)
    try {
      await client.query(
        `INSERT INTO public.bien_ban_thanh_ly
           (ma_thanh_ly, ma_hop_dong, ngay_tra_phong, chi_so_dien_cuoi, chi_so_nuoc_cuoi, tien_coc_hoan_lai, tien_kh_tra_them, ghi_chu, trang_thai)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DA_DUYET')
         ON CONFLICT (ma_thanh_ly) DO UPDATE
         SET ngay_tra_phong = EXCLUDED.ngay_tra_phong,
             chi_so_dien_cuoi = EXCLUDED.chi_so_dien_cuoi,
             chi_so_nuoc_cuoi = EXCLUDED.chi_so_nuoc_cuoi,
             tien_coc_hoan_lai = EXCLUDED.tien_coc_hoan_lai,
             tien_kh_tra_them = EXCLUDED.tien_kh_tra_them,
             ghi_chu = EXCLUDED.ghi_chu,
             trang_thai = 'DA_DUYET'`,
        [
          maThanhLy,
          maHopDong,
          ngayTraPhong,
          chiSoDienCuoi,
          chiSoNuocCuoi,
          tienCocHoanLai,
          tienKhTraThem,
          ghiChu,
        ],
      );
    } catch {
      await client.query(
        `INSERT INTO public.bien_ban_thanh_ly
           (ma_thanh_ly, ma_hop_dong, ngay_tra_phong, chi_so_dien_cuoi, chi_so_nuoc_cuoi, tien_coc_hoan_lai, tien_kh_tra_them, ghi_chu)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (ma_thanh_ly) DO UPDATE
         SET ngay_tra_phong = EXCLUDED.ngay_tra_phong,
             chi_so_dien_cuoi = EXCLUDED.chi_so_dien_cuoi,
             chi_so_nuoc_cuoi = EXCLUDED.chi_so_nuoc_cuoi,
             tien_coc_hoan_lai = EXCLUDED.tien_coc_hoan_lai,
             tien_kh_tra_them = EXCLUDED.tien_kh_tra_them,
             ghi_chu = EXCLUDED.ghi_chu`,
        [
          maThanhLy,
          maHopDong,
          ngayTraPhong,
          chiSoDienCuoi,
          chiSoNuocCuoi,
          tienCocHoanLai,
          tienKhTraThem,
          `[Trạng thái: DA_DUYET] ${ghiChu ?? ""}`.trim(),
        ],
      );
    }

    // 3. Cập nhật trạng thái hợp đồng thành 'Đã kết thúc'
    await client.query(
      "UPDATE public.hop_dong SET trang_thai = 'Đã kết thúc' WHERE ma_hop_dong = $1",
      [maHopDong],
    );

    // 4. Cập nhật tất cả người ở trong hợp đồng sang 'DaRoiDi'
    await client.query(
      "UPDATE public.chi_tiet_hop_dong_khach_thue SET trang_thai_luu_tru = 'Đã rời đi' WHERE ma_hop_dong = $1",
      [maHopDong],
    );

    // 5. Thu thập toàn bộ cư dân trong hợp đồng
    const { rows: allContractTenants } = await client.query<{ ma_khach: string }>(
      `SELECT DISTINCT ma_khach FROM public.chi_tiet_hop_dong_khach_thue WHERE ma_hop_dong = $1
       UNION
       SELECT $2 AS ma_khach WHERE $2 IS NOT NULL`,
      [maHopDong, contract.ma_khach_dai_dien],
    );

    // 6. Chuyển sang Cựu cư dân (co_so_van_hanh = NULL) nếu không còn hợp đồng hiệu lực khác
    for (const t of allContractTenants) {
      if (!t.ma_khach) continue;
      const { rows: activeOther } = await client.query(
        `SELECT 1 FROM public.hop_dong hd
         LEFT JOIN public.chi_tiet_hop_dong_khach_thue ct ON ct.ma_hop_dong = hd.ma_hop_dong
         WHERE (hd.ma_khach_dai_dien = $1 OR (ct.ma_khach = $1 AND ct.trang_thai_luu_tru IN ('Đang ở', 'DangO')))
           AND hd.ma_hop_dong <> $2
           AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
         LIMIT 1`,
        [t.ma_khach, maHopDong],
      );

      if (activeOther.length === 0) {
        await client.query(
          `UPDATE public.tai_khoan tk
           SET co_so_van_hanh = NULL
           FROM public.khach_thue kt
           WHERE kt.ma_khach = $1 AND kt.ma_tai_khoan = tk.ma_tai_khoan`,
          [t.ma_khach],
        );
      }
    }

    // 7. Giải phóng phòng về trạng thái 'Trống'
    await syncRoomStatus(contract.ma_phong, maHopDong, false);

    // 8. Gửi thông báo tới cư dân
    if (contract.ma_tai_khoan) {
      await createNotification(
        {
          maTaiKhoan: contract.ma_tai_khoan,
          maPhong: contract.ma_phong,
          toaNha: contract.toa_nha,
          loaiThongBao: "HopDong",
          tieuDe: "Biên bản thanh lý hợp đồng & Bàn giao hoàn tất",
          noiDung: `Biên bản thanh lý hợp đồng ${maHopDong} cho phòng ${contract.ten_phong} đã hoàn tất nghiệm thu và quyết toán cọc. Cảm ơn bạn đã đồng hành!`,
          duLieuDinhKem: {
            ma_hop_dong: maHopDong,
            ma_thanh_ly: maThanhLy,
            trang_thai: "DA_DUYET",
            tien_coc_hoan_lai: tienCocHoanLai,
            tien_kh_tra_them: tienKhTraThem,
          },
        },
        client,
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Liquidate contract error:", err);
    return {
      error: "Không thể thực hiện thanh lý hợp đồng. Hãy thử lại.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/hop-dong");
  revalidatePath(`/hop-dong/${maHopDong}`);
  revalidatePath("/khach-thue");
  revalidatePath("/phong");

  return {
    error: null,
    success: `Đã hoàn tất thanh lý hợp đồng ${maHopDong} và giải phóng phòng thành công.`,
    maThanhLy,
  };
}

export type RejectLiquidationState = {
  error: string | null;
  success: string | null;
};

/** Từ chối yêu cầu trả phòng / thanh lý hợp đồng từ Mobile App */
export async function rejectLiquidationRequest(
  _previous: RejectLiquidationState,
  formData: FormData,
): Promise<RejectLiquidationState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maThanhLy = text(formData, "maThanhLy");
  const maHopDong = text(formData, "maHopDong");
  const lyDo = text(formData, "lyDo") || "Chưa đạt yêu cầu bàn giao phòng";

  if (!maThanhLy || !maHopDong) {
    return { error: "Thiếu thông tin yêu cầu cần từ chối.", success: null };
  }

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    // Lấy thông tin phòng & tài khoản cư dân
    const { rows: contractRows } = await client.query<{
      ma_phong: string;
      toa_nha: string | null;
      ten_phong: string | null;
      ma_tai_khoan: string | null;
    }>(
      `SELECT hd.ma_phong, p.toa_nha, COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong, kt.ma_tai_khoan
       FROM public.hop_dong hd
       LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.khach_thue kt ON kt.ma_khach = hd.ma_khach_dai_dien
       WHERE hd.ma_hop_dong = $1 LIMIT 1`,
      [maHopDong],
    );

    const info = contractRows[0];

    // Cập nhật trạng thái biên bản thanh lý thành TU_CHOI
    try {
      await client.query(
        `UPDATE public.bien_ban_thanh_ly
         SET trang_thai = 'TU_CHOI',
             ghi_chu = CONCAT(COALESCE(ghi_chu, ''), ' | [Từ chối: ', $1::text, ']')
         WHERE ma_thanh_ly = $2`,
        [lyDo, maThanhLy],
      );
    } catch {
      await client.query(
        `UPDATE public.bien_ban_thanh_ly
         SET ghi_chu = CONCAT('[Trạng thái: TU_CHOI] ', COALESCE(ghi_chu, ''), ' | [Lý do từ chối: ', $1::text, ']')
         WHERE ma_thanh_ly = $2`,
        [lyDo, maThanhLy],
      );
    }

    if (info?.ma_tai_khoan) {
      await createNotification(
        {
          maTaiKhoan: info.ma_tai_khoan,
          maPhong: info.ma_phong,
          toaNha: info.toa_nha,
          loaiThongBao: "HopDong",
          tieuDe: "Yêu cầu trả phòng chưa được phê duyệt",
          noiDung: `Yêu cầu trả phòng ${info.ten_phong || info.ma_phong} chưa được Ban Quản Lý chấp thuận: "${lyDo}". Vui lòng liên hệ BQL để được hỗ trợ.`,
          duLieuDinhKem: {
            ma_hop_dong: maHopDong,
            ma_thanh_ly: maThanhLy,
            trang_thai: "TU_CHOI",
            ly_do: lyDo,
          },
        },
        client,
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reject liquidation error:", err);
    return { error: "Không thể từ chối yêu cầu. Vui lòng thử lại.", success: null };
  } finally {
    client.release();
  }

  revalidatePath("/hop-dong");
  revalidatePath(`/hop-dong/${maHopDong}`);
  return { error: null, success: "Đã từ chối yêu cầu trả phòng." };
}

export type RoomTransferState = {
  error: string | null;
  success: string | null;
  maPhuLuc?: string | null;
};

/**
 * Phê duyệt yêu cầu chuyển phòng (từ Mobile) hoặc BQL chủ động đổi phòng cho hợp đồng.
 * 1. Lập phụ lục hợp đồng (phu_luc_hop_dong) ghi nhận việc đổi phòng & bảo lưu cọc.
 * 2. Cập nhật phòng mới vào hợp đồng (hop_dong.ma_phong = maPhongMoi, gia_thue_thoa_thuan = giaThueMoi).
 * 3. Chuyển phòng cũ về 'Trống', phòng mới sang 'Đang thuê'.
 * 4. Cập nhật trạng thái phiếu yêu cầu (yeu_cau_chuyen_phong) thành 'Đã duyệt'.
 * 5. Gửi thông báo đến tài khoản cư dân.
 */
export async function approveRoomTransfer(
  _previous: RoomTransferState,
  formData: FormData,
): Promise<RoomTransferState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maYeuCau = text(formData, "maYeuCau");
  const maHopDong = text(formData, "maHopDong");
  const maPhongCu = text(formData, "maPhongCu");
  const maPhongMoi = text(formData, "maPhongMoi");
  const ngayChuyen = text(formData, "ngayChuyen") || new Date().toISOString().slice(0, 10);
  const giaThueMoi = number(formData, "giaThueMoi") ?? 0;
  const chenhLechTienCoc = number(formData, "chenhLechTienCoc") ?? 0;
  const tienDienNuocCu = number(formData, "tienDienNuocCu") ?? 0;
  const tienHuHaiCu = number(formData, "tienHuHaiCu") ?? 0;
  const ghiChu = text(formData, "ghiChu") || "";

  if (!maHopDong || !maPhongCu || !maPhongMoi) {
    return { error: "Vui lòng chọn đầy đủ thông tin hợp đồng và phòng cần chuyển.", success: null };
  }

  if (maPhongCu === maPhongMoi) {
    return { error: "Phòng mới phải khác phòng hiện tại.", success: null };
  }

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const roomGuard = await assertRoomInScope(maPhongMoi, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  const client = await getDbPool().connect();
  const maPhuLuc = `PLCP_${maHopDong.replace(/\s+/g, "")}_${newId("PL").slice(0, 6)}`;

  try {
    await client.query("BEGIN");

    // 1. Kiểm tra phòng mới có đang trống không
    const { rows: newRoomRows } = await client.query<{
      trang_thai: string;
      ten_hien_thi: string | null;
      toa_nha: string | null;
      gia_thue: number | null;
    }>(
      "SELECT trang_thai, ten_hien_thi, toa_nha, gia_thue FROM public.phong WHERE ma_phong = $1 LIMIT 1",
      [maPhongMoi],
    );
    if (newRoomRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy phòng mới.", success: null };
    }
    const newRoom = newRoomRows[0];
    if (newRoom.trang_thai !== "Trống" && newRoom.trang_thai !== "Trong") {
      await client.query("ROLLBACK");
      return {
        error: `Phòng mới (${newRoom.ten_hien_thi || maPhongMoi}) hiện không ở trạng thái Trống (trạng thái: ${newRoom.trang_thai}). Vui lòng chọn phòng khác.`,
        success: null,
      };
    }

    // 2. Lấy thông tin hợp đồng & khách thuê
    const { rows: hdRows } = await client.query<{
      ma_khach_dai_dien: string;
      ma_tai_khoan: string | null;
      ten_khach: string | null;
      toa_nha: string | null;
      gia_thue_thoa_thuan: number | null;
      tien_dat_coc: number | null;
    }>(
      `SELECT hd.ma_khach_dai_dien, hd.gia_thue_thoa_thuan, hd.tien_dat_coc,
              kt.ma_tai_khoan, kt.ho_ten_khach AS ten_khach, p.toa_nha
       FROM public.hop_dong hd
       LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.khach_thue kt ON kt.ma_khach = hd.ma_khach_dai_dien
       WHERE hd.ma_hop_dong = $1 LIMIT 1`,
      [maHopDong],
    );
    if (hdRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy hợp đồng.", success: null };
    }
    const hd = hdRows[0];

    const finalGiaThue = giaThueMoi > 0 ? giaThueMoi : (newRoom.gia_thue || hd.gia_thue_thoa_thuan || 0);

    // 3. Tạo Phụ lục hợp đồng chuyển phòng
    const noiDungPhuLuc = `Phụ lục chuyển đổi phòng từ ${maPhongCu} sang phòng ${maPhongMoi}${maYeuCau ? ` (Theo phiếu ${maYeuCau})` : ""}. Tiền cọc phòng cũ được bảo lưu chuyển sang phòng mới.${ghiChu ? ` Ghi chú: ${ghiChu}` : ""}`;
    await client.query(
      `INSERT INTO public.phu_luc_hop_dong
         (ma_phu_luc, ma_hop_dong, ngay_lap, noi_dung_dieu_chinh, gia_thue_moi, chenh_lech_tien_coc, ngay_gia_han_den, ma_phong_moi, trang_thai)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Đã duyệt')`,
      [
        maPhuLuc,
        maHopDong,
        ngayChuyen,
        noiDungPhuLuc,
        finalGiaThue,
        chenhLechTienCoc,
        ngayChuyen,
        maPhongMoi,
      ],
    );

    // 4. Cập nhật phòng trong Hợp đồng
    await client.query(
      "UPDATE public.hop_dong SET ma_phong = $1, gia_thue_thoa_thuan = $2 WHERE ma_hop_dong = $3",
      [maPhongMoi, finalGiaThue, maHopDong],
    );

    // 5. Cập nhật trạng thái phòng: Phòng cũ -> Trống, Phòng mới -> Đang thuê
    await client.query("UPDATE public.phong SET trang_thai = 'Trống' WHERE ma_phong = $1", [maPhongCu]);
    await client.query("UPDATE public.phong SET trang_thai = 'Đang thuê' WHERE ma_phong = $1", [maPhongMoi]);

    // 6. Nếu có mã yêu cầu từ Mobile, cập nhật yeu_cau_chuyen_phong
    if (maYeuCau) {
      await client.query(
        `UPDATE public.yeu_cau_chuyen_phong
         SET trang_thai_tien_do = 'Đã duyệt',
             tien_dien_nuoc_cu = $1,
             tien_hu_hai_cu = $2,
             tien_phat_sinh = $3,
             ghi_chu_hu_hai = CASE WHEN $4::text <> '' THEN $4::text ELSE ghi_chu_hu_hai END,
             nguoi_don_bql = $5
         WHERE ma_yeu_cau = $6`,
        [tienDienNuocCu, tienHuHaiCu, chenhLechTienCoc, ghiChu, account.ho_ten || account.ten_dang_nhap || "BQL Kiều Giang", maYeuCau],
      );
    }

    // 7. Gửi thông báo đến tài khoản cư dân
    if (hd.ma_tai_khoan) {
      await createNotification(
        {
          maTaiKhoan: hd.ma_tai_khoan,
          maPhong: maPhongMoi,
          toaNha: newRoom.toa_nha || hd.toa_nha,
          loaiThongBao: "HopDong",
          tieuDe: "Yêu cầu chuyển phòng đã được phê duyệt!",
          noiDung: `Ban Quản Lý đã phê duyệt chuyển sang phòng ${newRoom.ten_hien_thi || maPhongMoi}. Hợp đồng và phụ lục đã được cập nhật thành công.`,
          duLieuDinhKem: {
            ma_hop_dong: maHopDong,
            ma_phu_luc: maPhuLuc,
            ma_phong_cu: maPhongCu,
            ma_phong_moi: maPhongMoi,
            trang_thai: "DA_DUYET",
            thoi_gian_hen: ngayChuyen,
          },
        },
        client,
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Approve room transfer error:", err);
    return { error: "Không thể phê duyệt chuyển phòng. Hãy thử lại.", success: null };
  } finally {
    client.release();
  }

  revalidatePath("/hop-dong");
  revalidatePath(`/hop-dong/${maHopDong}`);
  revalidatePath("/phong");
  revalidatePath(`/phong/${maPhongCu}`);
  revalidatePath(`/phong/${maPhongMoi}`);

  return {
    error: null,
    success: `Đã hoàn tất đổi sang phòng ${maPhongMoi} và lập phụ lục ${maPhuLuc} thành công.`,
    maPhuLuc,
  };
}

/** Từ chối yêu cầu chuyển phòng từ Mobile App */
export async function rejectRoomTransfer(
  _previous: RoomTransferState,
  formData: FormData,
): Promise<RoomTransferState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maYeuCau = text(formData, "maYeuCau");
  const maHopDong = text(formData, "maHopDong");
  const lyDo = text(formData, "lyDo") || "Phòng mới không còn trống hoặc chưa đạt điều kiện chuyển phòng";

  if (!maYeuCau || !maHopDong) {
    return { error: "Thiếu mã yêu cầu cần từ chối.", success: null };
  }

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { error: contractGuard, success: null };

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    // Lấy thông tin phòng & tài khoản cư dân
    const { rows: contractRows } = await client.query<{
      ma_phong: string;
      toa_nha: string | null;
      ten_phong: string | null;
      ma_tai_khoan: string | null;
    }>(
      `SELECT hd.ma_phong, p.toa_nha, COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong, kt.ma_tai_khoan
       FROM public.hop_dong hd
       LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.khach_thue kt ON kt.ma_khach = hd.ma_khach_dai_dien
       WHERE hd.ma_hop_dong = $1 LIMIT 1`,
      [maHopDong],
    );
    const info = contractRows[0];

    // Cập nhật trạng thái yeu_cau_chuyen_phong thành 'Từ chối'
    await client.query(
      `UPDATE public.yeu_cau_chuyen_phong
       SET trang_thai_tien_do = 'Từ chối',
           ghi_chu_hu_hai = CONCAT(COALESCE(ghi_chu_hu_hai, ''), ' | [Lý do từ chối: ', $1::text, ']')
       WHERE ma_yeu_cau = $2`,
      [lyDo, maYeuCau],
    );

    if (info?.ma_tai_khoan) {
      await createNotification(
        {
          maTaiKhoan: info.ma_tai_khoan,
          maPhong: info.ma_phong,
          toaNha: info.toa_nha,
          loaiThongBao: "HopDong",
          tieuDe: "Yêu cầu chuyển phòng chưa được phê duyệt",
          noiDung: `Yêu cầu chuyển phòng của bạn chưa được Ban Quản Lý chấp thuận: "${lyDo}". Vui lòng liên hệ BQL để biết thêm chi tiết.`,
          duLieuDinhKem: {
            ma_hop_dong: maHopDong,
            ma_yeu_cau: maYeuCau,
            trang_thai: "TU_CHOI",
            ly_do: lyDo,
          },
        },
        client,
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reject room transfer error:", err);
    return { error: "Không thể từ chối yêu cầu. Vui lòng thử lại.", success: null };
  } finally {
    client.release();
  }

  revalidatePath("/hop-dong");
  revalidatePath(`/hop-dong/${maHopDong}`);
  return { error: null, success: "Đã từ chối yêu cầu chuyển phòng." };
}

