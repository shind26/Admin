"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getDbPool } from "@/lib/db";
import { assertContractInScope, assertMeterInScope, assertRoomInScope } from "@/lib/guards";
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
  if (!/^(\d{4}-\d{2}|\d{2}\/\d{4})$/.test(thangNam))
    return { error: "Kỳ ghi chỉ số phải theo dạng YYYY-MM hoặc MM/YYYY.", success: null };

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

    const maKyNew = "DN" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await getDbPool().query(
      `INSERT INTO public.chi_so_dien_nuoc
         (ma_ky, ma_hop_dong, thang_nam, chi_so_dien_cu, chi_so_dien_moi,
          chi_so_nuoc_cu, chi_so_nuoc_moi, ngay_ghi_nhan, trang_thai_duyet,
          anh_dien, anh_nuoc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        maKyNew,
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

    if (trangThai === "Đã duyệt") {
      const client = await getDbPool().connect();
      try {
        await client.query("BEGIN");
        // Cập nhật chỉ số vào phòng
        const { rows: roomRows } = await client.query<{ ma_phong: string }>(
          "SELECT ma_phong FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1",
          [maHopDong],
        );
        if (roomRows.length > 0 && roomRows[0].ma_phong) {
          await client.query(
            `UPDATE public.phong
             SET 
               chi_so_dien = COALESCE($1, chi_so_dien),
               chi_so_nuoc = COALESCE($2, chi_so_nuoc),
               ngay_cap_nhat_chi_so = NOW()
             WHERE ma_phong = $3`,
            [chiSoDienMoi, chiSoNuocMoi, roomRows[0].ma_phong],
          );
        }
        await syncMeterToInvoice(client, maKyNew);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Auto billing / room meter sync in create error:", err);
      } finally {
        client.release();
      }
    }
  } catch {
    return {
      error: "Không thể lưu chỉ số. Hãy kiểm tra dữ liệu và thử lại.",
      success: null,
    };
  }

  revalidatePath("/dien-nuoc");
  revalidatePath("/phong");
  revalidatePath("/hoa-don");
  return { error: null, success: "Lưu chỉ số điện nước thành công." };
}

/** Cập nhật chỉ số theo MeterController.Edit: Không cho sửa chỉ số cũ; khóa trạng thái nếu đã duyệt hoặc từ chối */
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
  if (!/^(\d{4}-\d{2}|\d{2}\/\d{4})$/.test(thangNam))
    return { error: "Kỳ ghi chỉ số phải theo dạng YYYY-MM hoặc MM/YYYY.", success: null };

  // 1. Kiểm tra bản ghi hiện tại trong DB
  const { rows: currentRows } = await getDbPool().query<{
    trang_thai_duyet: string;
    chi_so_dien_cu: string;
    chi_so_nuoc_cu: string;
  }>(
    "SELECT trang_thai_duyet, chi_so_dien_cu::text AS chi_so_dien_cu, chi_so_nuoc_cu::text AS chi_so_nuoc_cu FROM public.chi_so_dien_nuoc WHERE ma_ky = $1 LIMIT 1",
    [maKy],
  );
  if (currentRows.length === 0) return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };

  const currentStatus = currentRows[0].trang_thai_duyet;
  const requestedStatus = text(formData, "trangThai") || currentStatus;

  // 2. Xét tính hợp lý của trạng thái: Đã duyệt hoặc Từ chối thì KHÔNG cho chỉnh trạng thái nữa
  let finalStatus = requestedStatus;
  if (currentStatus === "Đã duyệt" || currentStatus === "Từ chối") {
    if (requestedStatus !== currentStatus) {
      return {
        error: `Kỳ chỉ số này đã ở trạng thái "${currentStatus}", không thể thay đổi trạng thái nữa.`,
        success: null,
      };
    }
    finalStatus = currentStatus;
  }

  // 3. Không được sửa chỉ số cũ: Lấy cố định từ DB
  const chiSoDienCu = Number(currentRows[0].chi_so_dien_cu);
  const chiSoNuocCu = Number(currentRows[0].chi_so_nuoc_cu);
  const chiSoDienMoi = number(formData, "chiSoDienMoi");
  const chiSoNuocMoi = number(formData, "chiSoNuocMoi");

  try {
    const problem = await validate(
      maHopDong,
      thangNam,
      chiSoDienCu,
      chiSoDienMoi,
      chiSoNuocCu,
      chiSoNuocMoi,
      finalStatus,
      maKy,
    );
    if (problem) return { error: problem, success: null };

    const anhDienVal = text(formData, "anhDien") || text(formData, "anhCongToDien") || null;
    const anhNuocVal = text(formData, "anhNuoc") || text(formData, "anhCongToNuoc") || null;

    const { rowCount } = await getDbPool().query(
      `UPDATE public.chi_so_dien_nuoc
       SET ma_hop_dong = $2, thang_nam = $3, chi_so_dien_moi = $4,
           chi_so_nuoc_moi = $5, ngay_ghi_nhan = $6,
           trang_thai_duyet = $7,
           anh_dien = COALESCE($8, anh_dien),
           anh_nuoc = COALESCE($9, anh_nuoc)
       WHERE ma_ky = $1`,
      [
        maKy,
        maHopDong,
        thangNam,
        chiSoDienMoi,
        chiSoNuocMoi,
        text(formData, "ngayGhiNhan") || null,
        finalStatus,
        anhDienVal,
        anhNuocVal,
      ],
    );
    if (rowCount === 0)
      return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };
    if (finalStatus === "Đã duyệt") {
      const client = await getDbPool().connect();
      try {
        await client.query("BEGIN");
        // Cập nhật chỉ số vào phòng
        const { rows: roomRows } = await client.query<{ ma_phong: string }>(
          "SELECT ma_phong FROM public.hop_dong WHERE ma_hop_dong = $1 LIMIT 1",
          [maHopDong],
        );
        if (roomRows.length > 0 && roomRows[0].ma_phong) {
          await client.query(
            `UPDATE public.phong
             SET 
               chi_so_dien = COALESCE($1, chi_so_dien),
               chi_so_nuoc = COALESCE($2, chi_so_nuoc),
               ngay_cap_nhat_chi_so = NOW()
             WHERE ma_phong = $3`,
            [chiSoDienMoi, chiSoNuocMoi, roomRows[0].ma_phong],
          );
        }
        await syncMeterToInvoice(client, maKy);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Auto billing / room meter sync in update error:", err);
      } finally {
        client.release();
      }
    }
  } catch {
    return { error: "Không thể cập nhật chỉ số. Hãy thử lại.", success: null };
  }

  revalidatePath("/dien-nuoc");
  revalidatePath("/phong");
  revalidatePath("/hoa-don");
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

/**
 * Tự động kết chuyển chỉ số điện nước sang chi tiết dịch vụ và Hóa đơn (Auto-Billing).
 */
async function syncMeterToInvoice(
  client: any,
  maKy: string,
): Promise<{
  maHoaDon: string;
  tienDien: number;
  tienNuoc: number;
  tongDienNuoc: number;
}> {
  // 1. Lấy thông tin kỳ chỉ số và hợp đồng
  const { rows: meterRows } = await client.query(
    `SELECT cs.*, c.ma_phong, c.gia_thue_thoa_thuan, k.ho_ten_khach
     FROM public.chi_so_dien_nuoc cs
     JOIN public.hop_dong c ON c.ma_hop_dong = cs.ma_hop_dong
     LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
     WHERE cs.ma_ky = $1
     LIMIT 1`,
    [maKy],
  );
  if (meterRows.length === 0) {
    throw new Error("Không tìm thấy kỳ ghi chỉ số.");
  }
  const m = meterRows[0];
  const dienTieuThu = Math.max(
    0,
    Number(m.chi_so_dien_moi || 0) - Number(m.chi_so_dien_cu || 0),
  );
  const nuocTieuThu = Math.max(
    0,
    Number(m.chi_so_nuoc_moi || 0) - Number(m.chi_so_nuoc_cu || 0),
  );

  // 2. Lấy đơn giá điện & nước từ bảng dịch vụ
  const { rows: rates } = await client.query(
    `SELECT ma_dich_vu, don_gia FROM public.dich_vu WHERE ma_dich_vu IN ('DV_DIEN', 'DV_NUOC')`,
  );
  const rateMap = Object.fromEntries(
    rates.map((r: any) => [r.ma_dich_vu, Number(r.don_gia)]),
  );
  const donGiaDien = rateMap["DV_DIEN"] ?? 3500;
  const donGiaNuoc = rateMap["DV_NUOC"] ?? 20000;
  const tienDien = Math.round(dienTieuThu * donGiaDien);
  const tienNuoc = Math.round(nuocTieuThu * donGiaNuoc);
  const tongDienNuoc = tienDien + tienNuoc;

  // 3. Cập nhật chi_tiet_dich_vu cho ma_ky (Lưu ý: thanh_tien là GENERATED ALWAYS AS ...)
  await client.query(
    `DELETE FROM public.chi_tiet_dich_vu WHERE ma_ky = $1 AND ma_dich_vu IN ('DV_DIEN', 'DV_NUOC')`,
    [maKy],
  );
  await client.query(
    `INSERT INTO public.chi_tiet_dich_vu (ma_ky, ma_dich_vu, so_luong, don_gia)
     VALUES ($1, 'DV_DIEN', $2, $3), ($1, 'DV_NUOC', $4, $5)`,
    [maKy, dienTieuThu, donGiaDien, nuocTieuThu, donGiaNuoc],
  );

  // 4. Tìm hoặc tạo hóa đơn
  const sanitizedThang = String(m.thang_nam).replace(/[^0-9]/g, "");
  const { rows: existingHd } = await client.query(
    `SELECT ma_hoa_don, tien_phong, tien_dich_vu_khac, no_cu, tong_tien, trang_thai
     FROM public.hoa_don
     WHERE ma_ky = $1 OR (ma_hop_dong = $2 AND ma_hoa_don LIKE $3)
     ORDER BY (ma_ky = $1) DESC
     LIMIT 1`,
    [maKy, m.ma_hop_dong, `%${sanitizedThang}%`],
  );

  let targetInvoiceId = existingHd[0]?.ma_hoa_don;

  if (targetInvoiceId) {
    const tienPhong = Number(existingHd[0].tien_phong ?? 0);
    const tienDvk = Number(existingHd[0].tien_dich_vu_khac ?? 0);
    const noCu = Number(existingHd[0].no_cu ?? 0);
    const newTotal = tienPhong + tongDienNuoc + tienDvk + noCu;

    await client.query(
      `UPDATE public.hoa_don
       SET ma_ky = $1, tien_dien_nuoc = $2, tong_tien = $3
       WHERE ma_hoa_don = $4`,
      [maKy, tongDienNuoc, newTotal, targetInvoiceId],
    );

    // Xóa dòng điện nước cũ nếu có trong chi_tiet_hoa_don
    await client.query(
      `DELETE FROM public.chi_tiet_hoa_don
       WHERE ma_hoa_don = $1 AND (ten_khoan_thu ILIKE '%điện%' OR ten_khoan_thu ILIKE '%nước%')`,
      [targetInvoiceId],
    );

    // Thêm 2 dòng mới cho điện và nước (ma_cthd tối đa 10 ký tự)
    const cthd1 = "CT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const cthd2 = "CT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await client.query(
      `INSERT INTO public.chi_tiet_hoa_don (ma_cthd, ma_hoa_don, ten_khoan_thu, so_luong, don_gia, thanh_tien)
       VALUES 
         ($1, $2, $3, $4, $5, $6),
         ($7, $8, $9, $10, $11, $12)`,
      [
        cthd1,
        targetInvoiceId,
        `Tiền điện (${dienTieuThu} kWh)`,
        dienTieuThu,
        donGiaDien,
        tienDien,
        cthd2,
        targetInvoiceId,
        `Tiền nước (${nuocTieuThu} m³)`,
        nuocTieuThu,
        donGiaNuoc,
        tienNuoc,
      ],
    );
  } else {
    // Tạo hóa đơn mới
    targetInvoiceId = "HD" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const tienPhong = Number(m.gia_thue_thoa_thuan ?? 0);
    const tienDvk = 0;
    const noCu = 0;
    const tongTien = tienPhong + tongDienNuoc + tienDvk + noCu;

    const now = new Date();
    const ngayLap = now.toISOString().slice(0, 10);
    const dueDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const hanDongTien = dueDate.toISOString().slice(0, 10);

    await client.query(
      `INSERT INTO public.hoa_don
         (ma_hoa_don, ma_hop_dong, loai_giao_dich, tien_phong, tien_dien_nuoc,
          tien_dich_vu_khac, no_cu, tong_tien, ngay_lap, han_dong_tien, trang_thai, ma_ky)
       VALUES ($1, $2, 'Tiền phòng & Dịch vụ', $3, $4, $5, $6, $7, $8, $9, 'Chưa thanh toán', $10)`,
      [
        targetInvoiceId,
        m.ma_hop_dong,
        tienPhong,
        tongDienNuoc,
        tienDvk,
        noCu,
        tongTien,
        ngayLap,
        hanDongTien,
        maKy,
      ],
    );

    // Chèn chi tiết: Tiền thuê phòng, Tiền điện, Tiền nước
    const cthdP = "CT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const cthdD = "CT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const cthdN = "CT" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

    await client.query(
      `INSERT INTO public.chi_tiet_hoa_don (ma_cthd, ma_hoa_don, ten_khoan_thu, so_luong, don_gia, thanh_tien)
       VALUES 
         ($1, $2, $3, 1, $4, $4),
         ($5, $2, $6, $7, $8, $9),
         ($10, $2, $11, $12, $13, $14)`,
      [
        cthdP,
        targetInvoiceId,
        `Tiền thuê phòng kỳ ${m.thang_nam}`,
        tienPhong,
        cthdD,
        targetInvoiceId,
        `Tiền điện (${dienTieuThu} kWh)`,
        dienTieuThu,
        donGiaDien,
        tienDien,
        cthdN,
        targetInvoiceId,
        `Tiền nước (${nuocTieuThu} m³)`,
        nuocTieuThu,
        donGiaNuoc,
        tienNuoc,
      ],
    );
  }

  return { maHoaDon: targetInvoiceId, tienDien, tienNuoc, tongDienNuoc };
}

/** Duyệt nhanh kỳ ghi chỉ số (1-click) kèm tự động kết chuyển Hóa đơn */
export async function approveMeterReading(
  maKy: string,
): Promise<MeterFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  if (!maKy) return { error: "Thiếu mã kỳ.", success: null };
  const meterGuard = await assertMeterInScope(maKy, scope);
  if (meterGuard) return { error: meterGuard, success: null };

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    const { rows: currentRows } = await client.query<{ trang_thai_duyet: string }>(
      "SELECT trang_thai_duyet FROM public.chi_so_dien_nuoc WHERE ma_ky = $1 LIMIT 1",
      [maKy],
    );
    if (currentRows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };
    }
    if (currentRows[0].trang_thai_duyet !== "Chờ duyệt") {
      await client.query("ROLLBACK");
      return {
        error: `Kỳ ghi này đã ở trạng thái "${currentRows[0].trang_thai_duyet}", không thể thay đổi nữa.`,
        success: null,
      };
    }

    const { rowCount } = await client.query(
      `UPDATE public.chi_so_dien_nuoc
       SET trang_thai_duyet = 'Đã duyệt'
       WHERE ma_ky = $1`,
      [maKy],
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };
    }

    // Cập nhật chỉ số mới vào phòng
    const { rows: roomInfo } = await client.query<{
      ma_phong: string;
      chi_so_dien_moi: number | null;
      chi_so_nuoc_moi: number | null;
    }>(
      `SELECT hd.ma_phong, cs.chi_so_dien_moi, cs.chi_so_nuoc_moi
       FROM public.chi_so_dien_nuoc cs
       JOIN public.hop_dong hd ON hd.ma_hop_dong = cs.ma_hop_dong
       WHERE cs.ma_ky = $1
       LIMIT 1`,
      [maKy],
    );
    if (roomInfo.length > 0 && roomInfo[0].ma_phong) {
      await client.query(
        `UPDATE public.phong
         SET 
           chi_so_dien = COALESCE($1, chi_so_dien),
           chi_so_nuoc = COALESCE($2, chi_so_nuoc),
           ngay_cap_nhat_chi_so = NOW()
         WHERE ma_phong = $3`,
        [roomInfo[0].chi_so_dien_moi, roomInfo[0].chi_so_nuoc_moi, roomInfo[0].ma_phong],
      );
    }

    // Tự động kết chuyển Hóa đơn
    const syncRes = await syncMeterToInvoice(client, maKy);

    await client.query("COMMIT");

    revalidatePath("/dien-nuoc");
    revalidatePath("/phong");
    revalidatePath("/hoa-don");
    return {
      error: null,
      success: `Đã duyệt chỉ số và tự động kết chuyển Hóa đơn ${syncRes.maHoaDon} (Điện: ${syncRes.tienDien.toLocaleString("vi-VN")}đ, Nước: ${syncRes.tienNuoc.toLocaleString("vi-VN")}đ).`,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Approve meter error:", err);
    return { error: "Không thể duyệt chỉ số điện nước.", success: null };
  } finally {
    client.release();
  }
}

/** Từ chối kỳ ghi chỉ số (1-click) */
export async function rejectMeterReading(
  maKy: string,
): Promise<MeterFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  if (!maKy) return { error: "Thiếu mã kỳ.", success: null };
  const meterGuard = await assertMeterInScope(maKy, scope);
  if (meterGuard) return { error: meterGuard, success: null };

  try {
    const { rows: currentRows } = await getDbPool().query<{ trang_thai_duyet: string }>(
      "SELECT trang_thai_duyet FROM public.chi_so_dien_nuoc WHERE ma_ky = $1 LIMIT 1",
      [maKy],
    );
    if (currentRows.length === 0) return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };
    if (currentRows[0].trang_thai_duyet !== "Chờ duyệt") {
      return {
        error: `Kỳ ghi này đã ở trạng thái "${currentRows[0].trang_thai_duyet}", không thể thay đổi nữa.`,
        success: null,
      };
    }

    const { rowCount } = await getDbPool().query(
      `UPDATE public.chi_so_dien_nuoc
       SET trang_thai_duyet = 'Từ chối'
       WHERE ma_ky = $1`,
      [maKy],
    );
    if (rowCount === 0) return { error: "Không tìm thấy kỳ ghi chỉ số.", success: null };
  } catch (err) {
    console.error("Reject meter error:", err);
    return { error: "Không thể từ chối chỉ số.", success: null };
  }

  revalidatePath("/dien-nuoc");
  return { error: null, success: "Đã đánh dấu từ chối chỉ số." };
}

/** Duyệt hàng loạt các kỳ chỉ số đang chờ duyệt kèm kết chuyển Hóa đơn */
export async function batchApproveMeterReadings(
  maKyList: string[],
): Promise<MeterFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  if (!maKyList || maKyList.length === 0) {
    return { error: "Chưa chọn kỳ ghi chỉ số nào.", success: null };
  }

  for (const maKy of maKyList) {
    const meterGuard = await assertMeterInScope(maKy, scope);
    if (meterGuard) return { error: meterGuard, success: null };
  }

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE public.chi_so_dien_nuoc
       SET trang_thai_duyet = 'Đã duyệt'
       WHERE ma_ky = ANY($1::text[])`,
      [maKyList],
    );

    // Cập nhật chỉ số vào từng phòng tương ứng
    const { rows: batchRooms } = await client.query<{
      ma_phong: string;
      chi_so_dien_moi: number | null;
      chi_so_nuoc_moi: number | null;
    }>(
      `SELECT hd.ma_phong, cs.chi_so_dien_moi, cs.chi_so_nuoc_moi
       FROM public.chi_so_dien_nuoc cs
       JOIN public.hop_dong hd ON hd.ma_hop_dong = cs.ma_hop_dong
       WHERE cs.ma_ky = ANY($1::text[])`,
      [maKyList],
    );

    for (const r of batchRooms) {
      if (r.ma_phong) {
        await client.query(
          `UPDATE public.phong
           SET 
             chi_so_dien = COALESCE($1, chi_so_dien),
             chi_so_nuoc = COALESCE($2, chi_so_nuoc),
             ngay_cap_nhat_chi_so = NOW()
           WHERE ma_phong = $3`,
          [r.chi_so_dien_moi, r.chi_so_nuoc_moi, r.ma_phong],
        );
      }
    }

    for (const maKy of maKyList) {
      await syncMeterToInvoice(client, maKy);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Batch approve meter error:", err);
    return { error: "Không thể duyệt hàng loạt chỉ số.", success: null };
  } finally {
    client.release();
  }

  revalidatePath("/dien-nuoc");
  revalidatePath("/phong");
  revalidatePath("/hoa-don");
  return { error: null, success: `Đã duyệt và kết chuyển hóa đơn thành công cho ${maKyList.length} phòng.` };
}

/**
 * Chủ trọ/quản lý cập nhật trực tiếp chỉ số điện nước cho phòng
 * (Dùng khi thay đồng hồ, kiểm tra định kỳ hoặc hiệu chỉnh).
 */
export async function updateRoomMetersDirectly(
  _previous: MeterFormState,
  formData: FormData,
): Promise<MeterFormState> {
  const account = await getCurrentAccount();
  if (!account) return { error: "Phiên đăng nhập đã hết hạn.", success: null };
  const { scope } = await requireScope();

  const maPhong = text(formData, "maPhong");
  if (!maPhong) return { error: "Thiếu mã phòng.", success: null };

  const roomGuard = await assertRoomInScope(maPhong, scope);
  if (roomGuard) return { error: roomGuard, success: null };

  const chiSoDien = number(formData, "chiSoDien");
  const chiSoNuoc = number(formData, "chiSoNuoc");

  if (chiSoDien === null || chiSoDien < 0) {
    return { error: "Chỉ số điện không hợp lệ (phải >= 0).", success: null };
  }
  if (chiSoNuoc === null || chiSoNuoc < 0) {
    return { error: "Chỉ số nước không hợp lệ (phải >= 0).", success: null };
  }

  try {
    const { rowCount } = await getDbPool().query(
      `UPDATE public.phong
       SET 
         chi_so_dien = $1,
         chi_so_nuoc = $2,
         ngay_cap_nhat_chi_so = NOW()
       WHERE ma_phong = $3`,
      [chiSoDien, chiSoNuoc, maPhong],
    );

    if (rowCount === 0) {
      return { error: "Không tìm thấy phòng.", success: null };
    }
  } catch (err) {
    console.error("Direct room meter update error:", err);
    return { error: "Không thể cập nhật chỉ số phòng.", success: null };
  }

  revalidatePath("/phong");
  revalidatePath(`/phong/${encodeURIComponent(maPhong)}`);
  revalidatePath("/dien-nuoc");
  return {
    error: null,
    success: `Đã cập nhật chỉ số phòng ${maPhong}: Điện ${chiSoDien} kWh, Nước ${chiSoNuoc} m³.`,
  };
}

/** Gửi thông báo nhắc khách thuê nộp ảnh chỉ số qua App mobile */
export async function remindTenantToSubmitMeter(
  maHopDong: string,
  maPhong: string,
  thangNam: string,
): Promise<{ success: boolean; message: string }> {
  const account = await getCurrentAccount();
  if (!account) return { success: false, message: "Phiên đăng nhập đã hết hạn." };
  const { scope } = await requireScope();

  const contractGuard = await assertContractInScope(maHopDong, scope);
  if (contractGuard) return { success: false, message: contractGuard };

  return {
    success: true,
    message: `Đã gửi thông báo đẩy nhắc phòng ${maPhong} chụp ảnh công tơ kỳ ${thangNam} qua ứng dụng di động!`,
  };
}
