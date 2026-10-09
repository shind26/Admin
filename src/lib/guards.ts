import "server-only";
import { getDbPool } from "@/lib/db";
import type { AccessScope } from "@/lib/session";

/**
 * Kiểm tra quyền ghi theo tòa: quản lý tòa chỉ được tác động lên bản ghi
 * mà tòa (suy ra qua chuỗi liên kết) trùng với tòa được gán.
 * Trả về null nếu hợp lệ, hoặc thông báo lỗi nếu bị chặn.
 */

/** Kiểm tra một phòng thuộc tòa được phép. */
export async function assertRoomInScope(
  maPhong: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.phong WHERE ma_phong = $1 AND toa_nha = $2 LIMIT 1`,
    [maPhong, scope.building],
  );
  return rows.length > 0
    ? null
    : "Bạn không có quyền thao tác trên phòng của cơ sở khác.";
}

/** Kiểm tra hợp đồng (suy ra tòa qua phòng). */
export async function assertContractInScope(
  maHopDong: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.hop_dong hd
     JOIN public.phong p ON p.ma_phong = hd.ma_phong
     WHERE hd.ma_hop_dong = $1 AND p.toa_nha = $2 LIMIT 1`,
    [maHopDong, scope.building],
  );
  return rows.length > 0
    ? null
    : "Bạn không có quyền thao tác trên hợp đồng của cơ sở khác.";
}

/** Kiểm tra hóa đơn (suy ra tòa qua hợp đồng -> phòng). */
export async function assertInvoiceInScope(
  maHoaDon: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.hoa_don hd
     JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     JOIN public.phong p ON p.ma_phong = c.ma_phong
     WHERE hd.ma_hoa_don = $1 AND p.toa_nha = $2 LIMIT 1`,
    [maHoaDon, scope.building],
  );
  return rows.length > 0
    ? null
    : "Bạn không có quyền thao tác trên hóa đơn của cơ sở khác.";
}

/** Kiểm tra phiếu thu (suy ra tòa qua hóa đơn -> hợp đồng -> phòng). */
export async function assertReceiptInScope(
  maPhieuThu: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.phieu_thu pt
     JOIN public.hoa_don hd ON hd.ma_hoa_don = pt.ma_hoa_don
     JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     JOIN public.phong p ON p.ma_phong = c.ma_phong
     WHERE pt.ma_phieu_thu = $1 AND p.toa_nha = $2 LIMIT 1`,
    [maPhieuThu, scope.building],
  );
  return rows.length > 0
    ? null
    : "Bạn không có quyền thao tác trên phiếu thu của cơ sở khác.";
}

/** Kiểm tra kỳ ghi chỉ số (suy ra tòa qua hợp đồng -> phòng). */
export async function assertMeterInScope(
  maKy: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.chi_so_dien_nuoc cs
     JOIN public.hop_dong c ON c.ma_hop_dong = cs.ma_hop_dong
     JOIN public.phong p ON p.ma_phong = c.ma_phong
     WHERE cs.ma_ky = $1 AND p.toa_nha = $2 LIMIT 1`,
    [maKy, scope.building],
  );
  return rows.length > 0
    ? null
    : "Bạn không có quyền thao tác trên kỳ chỉ số của cơ sở khác.";
}

/** Kiểm tra sự cố (suy ra tòa qua phòng). */
export async function assertIssueInScope(
  maSuCo: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.su_co_bao_tri sc
     JOIN public.phong p ON p.ma_phong = sc.ma_phong
     WHERE sc.ma_su_co = $1 AND p.toa_nha = $2 LIMIT 1`,
    [maSuCo, scope.building],
  );
  return rows.length > 0
    ? null
    : "Bạn không có quyền thao tác trên sự cố của cơ sở khác.";
}

/** Kiểm tra đăng ký khách qua đêm (suy ra tòa qua phòng). */
export async function assertStayInScope(
  maDangKy: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.dang_ky_khach_qua_dem d
     JOIN public.phong p ON p.ma_phong = d.ma_phong
     WHERE d.ma_dang_ky = $1 AND p.toa_nha = $2 LIMIT 1`,
    [maDangKy, scope.building],
  );
  return rows.length > 0
    ? null
    : "Bạn không có quyền thao tác trên đăng ký của cơ sở khác.";
}

/**
 * Kiểm tra khách thuê thuộc phạm vi được phép: quản lý tòa chỉ thao tác được
 * với khách có hợp đồng ở phòng trong tòa của mình.
 */
export async function assertTenantInScope(
  maKhach: string,
  scope: AccessScope,
): Promise<string | null> {
  if (scope.allBuildings) return null;
  const { rows } = await getDbPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.khach_thue k
     WHERE k.ma_khach = $1 AND EXISTS (
       SELECT 1 FROM public.hop_dong hd
       JOIN public.phong p ON p.ma_phong = hd.ma_phong
       WHERE hd.ma_khach_dai_dien = k.ma_khach AND p.toa_nha = $2
     )
     LIMIT 1`,
    [maKhach, scope.building],
  );
  return rows.length > 0 ? null : "Bạn không có quyền thao tác trên khách thuê của cơ sở khác.";
}
