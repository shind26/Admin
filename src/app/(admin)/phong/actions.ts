"use server";

import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { getCurrentAccount, requireScope } from "@/lib/session";
import { assertRoomInScope } from "@/lib/guards";
import { hashPassword, DEFAULT_CUSTOMER_PASSWORD } from "@/lib/password";
import { saveHandoverAssets } from "@/lib/handover";
import type { ContractFormState } from "../hop-dong/actions";

export type RoomFormState = { error: string | null; success: string | null };

const ROOM_STATUSES = ["Trống", "Đã đặt cọc", "Đang thuê", "Đang bảo trì"];

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

/**
 * Đọc danh sách dạng mảng text[] từ textarea: mỗi dòng một mục.
 * Trả về null khi rỗng để cột mảng trong database nhận NULL thay vì mảng rỗng.
 */
function lines(formData: FormData, key: string): string[] | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const items = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return items.length > 0 ? items : null;
}

/**
 * Thêm phòng mới (chỉ dành cho Quản trị viên - Admin).
 * Kiểm tra trùng mã phòng, xác thực dữ liệu đầu vào và phân quyền chặt chẽ.
 */
export async function createRoom(
  _previous: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };

  if (account.vai_tro !== "Admin") {
    return {
      error: "Chỉ Quản trị viên (Admin) mới có quyền thêm phòng mới.",
      success: null,
    };
  }

  const maPhong = text(formData, "maPhong").toUpperCase().trim();
  if (!maPhong) return { error: "Vui lòng nhập mã phòng.", success: null };
  if (maPhong.length > 50) return { error: "Mã phòng tối đa 50 ký tự.", success: null };

  if (!/^[A-Za-z0-9_.-]+$/.test(maPhong)) {
    return {
      error: "Mã phòng chỉ được chứa chữ cái, số, dấu gạch nối (-), dấu gạch dưới (_) hoặc dấu chấm (.).",
      success: null,
    };
  }

  const toaNha = text(formData, "toaNha");
  if (!toaNha) return { error: "Vui lòng chọn cơ sở / tòa nhà.", success: null };

  const maLoaiPhong = text(formData, "maLoaiPhong");
  if (!maLoaiPhong) return { error: "Vui lòng chọn loại phòng.", success: null };

  const dienTich = number(formData, "dienTich");
  if (dienTich === null || dienTich <= 0) {
    return { error: "Vui lòng nhập diện tích phòng hợp lệ (> 0 m²).", success: null };
  }

  const giaThue = number(formData, "giaThue");
  if (giaThue === null || giaThue < 0) {
    return { error: "Vui lòng nhập giá thuê niêm yết hợp lệ.", success: null };
  }

  const tang = number(formData, "tang") ?? 1;
  const tienDatCoc = number(formData, "tienDatCoc") ?? 0;
  const chiSoDien = number(formData, "chiSoDien") ?? 0;
  const chiSoNuoc = number(formData, "chiSoNuoc") ?? 0;
  // Phòng mới tạo luôn có trạng thái mặc định là "Trống"
  const trangThai = "Trống";

  try {
    const existing = await getDbPool().query<{ ma_phong: string }>(
      "SELECT ma_phong FROM public.phong WHERE LOWER(ma_phong) = LOWER($1) LIMIT 1",
      [maPhong],
    );
    if (existing.rows.length > 0) {
      return {
        error: `Mã phòng "${maPhong}" đã tồn tại trên hệ thống.`,
        success: null,
      };
    }

    await getDbPool().query(
      `INSERT INTO public.phong (
        ma_phong, ten_hien_thi, tang, dien_tich, gia_thue,
        trang_thai, toa_nha, ma_loai_phong, mo_ta_ngan,
        tien_dat_coc, noi_that_san_co, hinh_anh,
        chi_so_dien, chi_so_nuoc
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::trang_thai_phong_enum, $7, $8, $9,
        $10, $11, $12,
        $13, $14
      )`,
      [
        maPhong,
        text(formData, "tenHienThi") || maPhong,
        tang,
        dienTich,
        giaThue,
        trangThai,
        toaNha,
        maLoaiPhong,
        text(formData, "moTaNgan") || null,
        tienDatCoc,
        lines(formData, "noiThat"),
        text(formData, "hinhAnh") || null,
        chiSoDien,
        chiSoNuoc,
      ],
    );
  } catch (err) {
    console.error("Lỗi khi thêm phòng mới:", err);
    return {
      error: "Không thể thêm phòng mới. Hãy kiểm tra lại dữ liệu.",
      success: null,
    };
  }

  revalidatePath("/phong");
  return { error: null, success: `Đã thêm phòng ${maPhong} thành công!` };
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
  if (!toaNha)
    return { error: "Vui lòng chọn cơ sở cho phòng.", success: null };

  const chiSoDien = number(formData, "chiSoDien");
  const chiSoNuoc = number(formData, "chiSoNuoc");

  try {
    // Quản lý tòa chỉ được sửa phòng trong tòa của mình.
    // Không cho phép sửa cơ sở/tòa nhà, tầng, loại phòng và diện tích của phòng đã tồn tại.
    const { rowCount } = await getDbPool().query(
      `UPDATE public.phong
       SET ten_hien_thi = $2, gia_thue = $3,
           trang_thai = $4,
           mo_ta_ngan = $5, tien_dat_coc = $6,
           noi_that_san_co = $7, hinh_anh = $8,
           chi_so_dien = COALESCE($10, chi_so_dien),
           chi_so_nuoc = COALESCE($11, chi_so_nuoc),
           ngay_cap_nhat_chi_so = CASE WHEN $10 IS NOT NULL OR $11 IS NOT NULL THEN NOW() ELSE ngay_cap_nhat_chi_so END
       WHERE ma_phong = $1
         AND ($9::text IS NULL OR toa_nha = $9)`,
      [
        maPhong,
        text(formData, "tenHienThi") || maPhong,
        number(formData, "giaThue"),
        trangThai,
        text(formData, "moTaNgan") || null,
        number(formData, "tienDatCoc"),
        lines(formData, "noiThat"),
        text(formData, "hinhAnh") || null,
        scope.allBuildings ? null : scope.building,
        chiSoDien,
        chiSoNuoc,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy phòng cần cập nhật.", success: null };
  } catch {
    return { error: "Không thể cập nhật phòng. Hãy thử lại.", success: null };
  }

  revalidatePath("/phong");
  revalidatePath(`/phong/${encodeURIComponent(maPhong)}`);
  revalidatePath("/dien-nuoc");
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

function newId(prefix: string) {
  return (
    prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
}

function generateTempPassword() {
  return DEFAULT_CUSTOMER_PASSWORD;
}

export type ReservationFormState = {
  error: string | null;
  success: string | null;
  maGiuCho?: string | null;
  isPendingPayment?: boolean;
  expiresAt?: string | null;
};

/** Nhận cọc giữ chỗ và khóa tạm phòng (ngăn double-booking) */
export async function reserveRoom(
  _previous: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  const soTienTheChan = number(formData, "soTienTheChan") || 100000;
  const ngayHetHan = text(formData, "ngayHetHan") || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const tenantMode = text(formData, "tenantMode") || "new";
  const ghiChu = text(formData, "ghiChu");
  const hinhThucThanhToan = text(formData, "hinhThucThanhToan") || "VietQR";
  const isQrHold = hinhThucThanhToan === "VietQR";

  if (!maPhong) return { error: "Thiếu mã phòng cần giữ chỗ.", success: null };

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  const client = await getDbPool().connect();
  const maGiuCho = newId("GC");

  try {
    await client.query("BEGIN");

    // Khóa tạm hàng dữ liệu phòng để chống tranh chấp (Concurrency Lock)
    const { rows: roomRows } = await client.query<{
      trang_thai: string;
      toa_nha: string;
    }>(
      "SELECT trang_thai, toa_nha FROM public.phong WHERE ma_phong = $1 FOR UPDATE",
      [maPhong],
    );

    if (roomRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Phòng không tồn tại.", success: null };
    }

    const currentStatus = roomRows[0].trang_thai;
    if (currentStatus !== "Trống") {
      await client.query("ROLLBACK");
      return {
        error: `Phòng hiện có trạng thái "${currentStatus}", không thể thực hiện đặt cọc giữ chỗ.`,
        success: null,
      };
    }

    let maKhach = text(formData, "maKhach");

    if (tenantMode === "new") {
      const newHoTen = text(formData, "newHoTen");
      const newSoDt = text(formData, "newSoDt");
      const newCccd = text(formData, "newCccd");
      const newDiaChi = text(formData, "newDiaChi");

      if (!newHoTen || !newSoDt) {
        await client.query("ROLLBACK");
        return {
          error: "Vui lòng nhập Họ tên và Số điện thoại khách đặt cọc.",
          success: null,
        };
      }

      // Kiểm tra khách đã có hồ sơ chưa
      const { rows: existingTenant } = await client.query<{ ma_khach: string }>(
        "SELECT ma_khach FROM public.khach_thue WHERE so_dt = $1 OR (cccd IS NOT NULL AND cccd = $2) LIMIT 1",
        [newSoDt, newCccd || null],
      );

      if (existingTenant.length > 0) {
        maKhach = existingTenant[0].ma_khach;
      } else {
        maKhach = newId("KH");
        await client.query(
          `INSERT INTO public.khach_thue
             (ma_khach, ho_ten_khach, so_dt, cccd, dia_chi_thuong_tru, trang_thai_ekyc)
           VALUES ($1, $2, $3, $4, $5, 'ChuaXacThuc')`,
          [maKhach, newHoTen, newSoDt, newCccd || null, newDiaChi || ""],
        );
      }
    } else {
      if (!maKhach) {
        await client.query("ROLLBACK");
        return { error: "Vui lòng chọn khách thuê từ danh sách.", success: null };
      }
    }

    // 1. Tạo bản ghi giữ chỗ:
    // Nếu chọn VietQR -> trang_thai = 'ChoThanhToan', khóa tạm 15 phút (expires_at = now() + 15m)
    // Nếu chọn Trực tiếp -> trang_thai = 'DangGiu', không có expires_at (khóa theo ngày hẹn nhận phòng ngay_het_han)
    const initialStatus = isQrHold ? "ChoThanhToan" : "DangGiu";
    const initialNote = isQrHold
      ? `[Khóa tạm 15 phút chờ thanh toán QR] ${ghiChu || ""}`
      : `[Đã nhận cọc trực tiếp] ${ghiChu || ""}`;

    await client.query(
      `INSERT INTO public.giu_cho
         (ma_giu_cho, ma_phong, ma_khach, so_tien_the_chan, thoi_gian_giu_cho, ngay_het_han, trang_thai, ghi_chu, expires_at)
       VALUES ($1, $2, $3, $4, now(), $5::timestamptz, $6, $7, CASE WHEN $8::boolean THEN now() + interval '15 minutes' ELSE NULL END)`,
      [maGiuCho, maPhong, maKhach, soTienTheChan, ngayHetHan, initialStatus, initialNote.trim(), isQrHold],
    );

    // 2. Cập nhật trạng thái phòng thành 'Đã đặt cọc' (Khóa tạm phòng)
    await client.query(
      "UPDATE public.phong SET trang_thai = 'Đã đặt cọc' WHERE ma_phong = $1",
      [maPhong],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reserve room error:", err);
    return {
      error: "Không thể lưu thông tin giữ chỗ. Hãy thử lại.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/phong");
  revalidatePath(`/phong/${maPhong}`);
  revalidatePath("/hop-dong");

  if (isQrHold) {
    return {
      error: null,
      success: `Đã tạo mã QR cọc giữ chỗ phòng ${maPhong}. Phòng được khóa tạm 15 phút để chờ khách thanh toán.`,
      maGiuCho,
      isPendingPayment: true,
    };
  }

  return {
    error: null,
    success: `Đã đặt cọc giữ chỗ phòng ${maPhong} thành công. Phòng được khóa tạm đến ${new Date(ngayHetHan).toLocaleDateString("vi-VN")}.`,
    maGiuCho,
    isPendingPayment: false,
  };
}

/** BQL xác nhận đã nhận tiền cọc qua VietQR -> Chuyển từ 'ChoThanhToan' sang 'DangGiu' */
export async function confirmReservationPayment(
  formData: FormData,
): Promise<ReservationFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maGiuCho = text(formData, "maGiuCho");
  const maPhong = text(formData, "maPhong");

  if (!maGiuCho || !maPhong) {
    return { error: "Thiếu thông tin phiếu giữ chỗ.", success: null };
  }

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  const client = await getDbPool().connect();

  try {
    await client.query("BEGIN");

    const { rows: gcRows } = await client.query<{
      trang_thai: string;
      expires_at: string | null;
    }>(
      `SELECT trang_thai, expires_at::text AS expires_at
       FROM public.giu_cho
       WHERE ma_giu_cho = $1 FOR UPDATE`,
      [maGiuCho],
    );

    if (gcRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Phiếu giữ chỗ không tồn tại.", success: null };
    }

    const gc = gcRows[0];
    if (gc.trang_thai !== "ChoThanhToan") {
      await client.query("ROLLBACK");
      return {
        error: `Phiếu giữ chỗ hiện ở trạng thái "${gc.trang_thai}", không cần duyệt thanh toán.`,
        success: null,
      };
    }

    // Cập nhật thành DangGiu, xóa hạn khóa 15p expires_at
    await client.query(
      `UPDATE public.giu_cho
       SET trang_thai = 'DangGiu',
           expires_at = NULL,
           ghi_chu = COALESCE(ghi_chu || ' | ', '') || '[BQL đã duyệt cọc lúc ' || to_char(now(), 'HH24:MI DD/MM/YYYY') || ']'
       WHERE ma_giu_cho = $1`,
      [maGiuCho],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Confirm reservation payment error:", err);
    return {
      error: "Không thể xác nhận thanh toán cọc. Hãy thử lại.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/phong");
  revalidatePath(`/phong/${maPhong}`);
  revalidatePath("/hop-dong");

  return {
    error: null,
    success: `Đã xác nhận nhận tiền cọc phiếu ${maGiuCho} thành công! Phòng đã chuyển sang trạng thái Đang giữ chỗ chính thức.`,
    maGiuCho,
  };
}

/** Hủy hoặc hết hạn giữ chỗ 15 phút -> Mở khóa phòng về 'Trống' */
export async function expireOrCancelHold(
  formData: FormData,
): Promise<ReservationFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maGiuCho = text(formData, "maGiuCho");
  const maPhong = text(formData, "maPhong");
  const reason = text(formData, "lyDo") || "Khách hủy hoặc hết hạn 15 phút thanh toán QR";

  if (!maGiuCho || !maPhong) {
    return { error: "Thiếu thông tin phiếu giữ chỗ.", success: null };
  }

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  const client = await getDbPool().connect();

  try {
    await client.query("BEGIN");

    const { rows: gcRows } = await client.query<{ trang_thai: string }>(
      `SELECT trang_thai FROM public.giu_cho WHERE ma_giu_cho = $1 FOR UPDATE`,
      [maGiuCho],
    );

    const validHoldStatuses = [
      "ChoThanhToan",
      "DangGiu",
      "DaThanhToan",
      "Đã thanh toán",
      "Đang giữ",
      "Chờ thanh toán",
    ];
    if (gcRows.length > 0 && validHoldStatuses.includes(gcRows[0].trang_thai)) {
      await client.query(
        `UPDATE public.giu_cho
         SET trang_thai = 'DaHuy',
             ghi_chu = COALESCE(ghi_chu || ' | ', '') || $2
         WHERE ma_giu_cho = $1`,
        [maGiuCho, `[${reason}]`],
      );

      await client.query(
        `UPDATE public.phong SET trang_thai = 'Trống' WHERE ma_phong = $1`,
        [maPhong],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Expire or cancel hold error:", err);
    return { error: "Không thể hủy giữ chỗ phòng.", success: null };
  } finally {
    client.release();
  }

  revalidatePath("/phong");
  revalidatePath(`/phong/${maPhong}`);
  revalidatePath("/hop-dong");

  return {
    error: null,
    success: `Đã mở khóa phòng ${maPhong} về trạng thái Trống.`,
  };
}

/** Hủy giữ chỗ / Xử lý khách bỏ cọc & Mở khóa phòng về trạng thái Trống */
export async function cancelReservation(
  _previous: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maGiuCho = text(formData, "maGiuCho");
  const maPhong = text(formData, "maPhong");
  const xuLyTienCoc = text(formData, "xuLyTienCoc") || "TichThu";
  const soTienHoanLai = number(formData, "soTienHoanLai") ?? 0;
  const lyDoHuy = text(formData, "lyDoHuy");

  if (!maGiuCho || !maPhong) {
    return { error: "Thiếu thông tin phiếu giữ chỗ cần hủy.", success: null };
  }

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  const client = await getDbPool().connect();

  try {
    await client.query("BEGIN");

    const { rows: gcRows } = await client.query<{
      trang_thai: string;
      so_tien_the_chan: string;
    }>(
      "SELECT trang_thai, so_tien_the_chan::text AS so_tien_the_chan FROM public.giu_cho WHERE ma_giu_cho = $1 FOR UPDATE",
      [maGiuCho],
    );

    if (gcRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Phiếu giữ chỗ không tồn tại.", success: null };
    }

    const validCancelStatuses = [
      "DangGiu",
      "DaThanhToan",
      "Đã thanh toán",
      "Đang giữ",
      "ChoThanhToan",
      "Chờ thanh toán",
    ];
    if (!validCancelStatuses.includes(gcRows[0].trang_thai)) {
      await client.query("ROLLBACK");
      return {
        error: `Phiếu giữ chỗ hiện có trạng thái "${gcRows[0].trang_thai}", không thể hủy.`,
        success: null,
      };
    }

    const xuLyNote =
      xuLyTienCoc === "TichThu"
        ? `[Khách bỏ cọc - Tịch thu toàn bộ ${Number(gcRows[0].so_tien_the_chan).toLocaleString("vi-VN")} đ]`
        : `[Hoàn lại cọc: ${soTienHoanLai.toLocaleString("vi-VN")} đ]`;

    const fullNote = [lyDoHuy ? `Lý do: ${lyDoHuy}` : null, xuLyNote]
      .filter(Boolean)
      .join(" | ");

    // 1. Cập nhật phiếu giữ chỗ thành DaHuy
    await client.query(
      `UPDATE public.giu_cho
       SET trang_thai = 'DaHuy',
           ghi_chu = COALESCE(ghi_chu || ' - ', '') || $2
       WHERE ma_giu_cho = $1`,
      [maGiuCho, fullNote],
    );

    // 2. Mở khóa phòng về trạng thái 'Trống'
    await client.query(
      "UPDATE public.phong SET trang_thai = 'Trống' WHERE ma_phong = $1",
      [maPhong],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Cancel reservation error:", err);
    return {
      error: "Không thể hủy giữ chỗ phòng. Hãy thử lại.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/phong");
  revalidatePath(`/phong/${maPhong}`);
  revalidatePath("/hop-dong");

  return {
    error: null,
    success: `Đã hủy phiếu giữ chỗ ${maGiuCho} và mở khóa phòng ${maPhong} về trạng thái Trống.`,
  };
}

/** Chuyển phiếu giữ chỗ thành Hợp đồng chính thức & Tự động cấp User App */
export async function convertReservationToContract(
  _previous: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maGiuCho = text(formData, "maGiuCho");
  const maPhong = text(formData, "maPhong");
  const ngayBd = text(formData, "ngayBd");
  const ngayKt = text(formData, "ngayKt");
  const ngayKy = text(formData, "ngayKy") || new Date().toISOString().slice(0, 10);
  const giaThueThoaThuan = number(formData, "giaThueThoaThuan");
  const tienDatCoc = number(formData, "tienDatCoc");
  const chuKyThuTien = number(formData, "chuKyThuTien") ?? 1;

  if (!maGiuCho || !maPhong || !ngayBd || !ngayKt) {
    return {
      error: "Vui lòng nhập đầy đủ thông tin thời hạn hợp đồng.",
      success: null,
    };
  }

  if (ngayKt <= ngayBd) {
    return { error: "Ngày kết thúc hợp đồng phải sau ngày bắt đầu vào ở.", success: null };
  }

  if (ngayKy && ngayKy > ngayBd) {
    return { error: "Ngày ký hợp đồng không thể sau ngày bắt đầu vào ở.", success: null };
  }

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  const client = await getDbPool().connect();
  const maHopDong = newId("HD");
  let tempPassCreated: string | null = null;
  let tenantPhone: string | null = null;
  let finalTenantName: string | null = null;

  try {
    await client.query("BEGIN");

    // 1. Khóa và kiểm tra phiếu giữ chỗ
    const { rows: gcRows } = await client.query<{
      ma_khach: string;
      trang_thai: string;
      so_tien_the_chan: string;
    }>(
      "SELECT ma_khach, trang_thai, so_tien_the_chan::text AS so_tien_the_chan FROM public.giu_cho WHERE ma_giu_cho = $1 FOR UPDATE",
      [maGiuCho],
    );

    if (gcRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Phiếu giữ chỗ không tồn tại.", success: null };
    }

    const validConvertStatuses = [
      "DangGiu",
      "DaThanhToan",
      "Đã thanh toán",
      "Đang giữ",
      "ChoThanhToan",
      "Chờ thanh toán",
    ];
    if (!validConvertStatuses.includes(gcRows[0].trang_thai)) {
      await client.query("ROLLBACK");
      return {
        error: `Phiếu giữ chỗ hiện ở trạng thái "${gcRows[0].trang_thai}", không thể chuyển hợp đồng.`,
        success: null,
      };
    }

    const maKhach = gcRows[0].ma_khach;

    // 2. Lấy thông tin phòng & tòa
    const { rows: roomRows } = await client.query<{ toa_nha: string | null }>(
      "SELECT toa_nha FROM public.phong WHERE ma_phong = $1 LIMIT 1",
      [maPhong],
    );
    const building = roomRows[0]?.toa_nha ?? null;

    // 3. Lấy thông tin khách thuê & tài khoản
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
      return { error: "Không tìm thấy hồ sơ khách thuê.", success: null };
    }

    tenantPhone = tenantRows[0].so_dt;
    finalTenantName = tenantRows[0].ho_ten_khach;
    let finalAccountId = tenantRows[0].ma_tai_khoan;

    // 4. Khởi tạo / cập nhật tài khoản khách hàng từ SĐT với mật khẩu mặc định 123456
    tempPassCreated = DEFAULT_CUSTOMER_PASSWORD;
    const hashed = await hashPassword(DEFAULT_CUSTOMER_PASSWORD);

    const { rows: existingAcc } = await client.query<{ ma_tai_khoan: string }>(
      "SELECT ma_tai_khoan FROM public.tai_khoan WHERE ten_dang_nhap = $1 LIMIT 1",
      [tenantPhone],
    );

    if (existingAcc.length > 0) {
      finalAccountId = existingAcc[0].ma_tai_khoan;
      await client.query(
        `UPDATE public.tai_khoan
         SET mat_khau = $1,
             vai_tro = 'KhachThue',
             co_so_van_hanh = $2,
             trang_thai = 'HoatDong',
             da_doi_mat_khau = false,
             ho_ten = COALESCE(NULLIF(ho_ten, ''), $3)
         WHERE ma_tai_khoan = $4`,
        [hashed, building, finalTenantName, finalAccountId],
      );
    } else {
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

    // 5. Tạo hợp đồng chính thức
    await client.query(
      `INSERT INTO public.hop_dong
         (ma_hop_dong, ma_phong, ma_khach_dai_dien, ngay_bd, ngay_kt, ngay_ky,
          tien_dat_coc, gia_thue_thoa_thuan, chu_ky_thu_tien, trang_thai)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Còn hạn')`,
      [
        maHopDong,
        maPhong,
        maKhach,
        ngayBd,
        ngayKt,
        ngayKy,
        tienDatCoc,
        giaThueThoaThuan,
        chuKyThuTien,
      ],
    );

    // 6. Gắn người đại diện vào chi tiết hợp đồng
    await client.query(
      `INSERT INTO public.chi_tiet_hop_dong_khach_thue
         (ma_hop_dong, ma_khach, vai_tro, ngay_vao_o, trang_thai_luu_tru)
       VALUES ($1, $2, 'Đại diện hợp đồng', $3, 'Đang ở')
       ON CONFLICT (ma_hop_dong, ma_khach) DO UPDATE
       SET vai_tro = 'Đại diện hợp đồng', trang_thai_luu_tru = 'Đang ở', ngay_vao_o = EXCLUDED.ngay_vao_o`,
      [maHopDong, maKhach, ngayBd],
    );

    // 7. Cập nhật phiếu giữ chỗ -> 'DaChuyenHopDong'
    await client.query(
      `UPDATE public.giu_cho
       SET trang_thai = 'DaChuyenHopDong',
           ghi_chu = COALESCE(ghi_chu || ' - ', '') || $2
       WHERE ma_giu_cho = $1`,
      [maGiuCho, `Đã chuyển thành HĐ ${maHopDong}`],
    );

    // 8. Cập nhật phòng -> 'Đang thuê'
    await client.query(
      "UPDATE public.phong SET trang_thai = 'Đang thuê' WHERE ma_phong = $1",
      [maPhong],
    );

    // 9. Lưu danh mục tài sản bàn giao đã kiểm tra / sửa đổi vào bảng tai_san
    const handoverItemsJson = text(formData, "handoverItemsJson");
    await saveHandoverAssets(client, maPhong, handoverItemsJson);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Convert reservation error:", err);
    return {
      error: "Không thể chuyển giữ chỗ thành hợp đồng. Hãy thử lại.",
      success: null,
    };
  } finally {
    client.release();
  }

  revalidatePath("/phong");
  revalidatePath(`/phong/${maPhong}`);
  revalidatePath("/hop-dong");
  revalidatePath("/khach-thue");

  return {
    error: null,
    success: `Kích hoạt hợp đồng ${maHopDong} từ phiếu giữ chỗ thành công.`,
    tempPassword: tempPassCreated,
    username: tempPassCreated ? tenantPhone : null,
    maHopDong,
    tenantName: finalTenantName,
  };
}
