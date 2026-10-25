import "server-only";
import { getDbPool } from "@/lib/db";
import { ScopeQuery } from "@/lib/scope";

export const ALL_BUILDINGS = "all";

export type DashboardStats = {
  tongPhong: number;
  dangThue: number;
  phongTrong: number;
  daDatCoc: number;
  dangBaoTri: number;
  suCo: number;
  tyLeLapDay: number;
};

export type FinancialDashboardData = {
  kpi: {
    doanhThuThang: number;
    doanhThuThangTruoc: number;
    chenhLechDoanhThuPct: number;
    tongThucThu: number;
    phatHanhThang: number;
    noThangNay: number;
    tongNoTonDong: number;
    tyLeThuThang: number;
    tienCocHopDong: number;
    tienCocGiuCho: number;
    tongTienCoc: number;
    // Operation stats
    tongPhong: number;
    dangThue: number;
    phongTrong: number;
    daDatCoc: number;
    dangBaoTri: number;
    suCo: number;
    tyLeLapDay: number;
    soCuDan: number;
    pendingHoldCount: number;
  };
  monthlyTrend: Array<{
    monthKey: string;
    label: string;
    daThu: number;
    conNo: number;
    tongTien: number;
  }>;
  revenueBreakdown: {
    tienPhong: number;
    tienDienNuoc: number;
    tienDichVu: number;
    tong: number;
  };
  unpaidInvoices: Array<{
    ma_hoa_don: string;
    ma_phong: string | null;
    toa_nha: string | null;
    ten_khach: string | null;
    so_dt: string | null;
    tong_tien: string;
    da_thu: string;
    con_lai: string;
    han_dong_tien: string | null;
    ngay_lap: string | null;
  }>;
  recentReceipts: Array<{
    ma_phieu_thu: string;
    ma_hoa_don: string | null;
    ma_phong: string | null;
    toa_nha: string | null;
    ten_khach: string | null;
    so_tien_thu: string;
    ngay_thu: string | null;
    hinh_thuc: string | null;
    trang_thai: string | null;
  }>;
};

/**
 * Lấy toàn bộ dữ liệu tài chính, biểu đồ và vận hành tổng quan cho Dashboard.
 */
export async function getFinancialDashboardData(
  buildingFilter: string | null,
  scope: ScopeQuery,
): Promise<FinancialDashboardData> {
  await autoExpirePendingHolds();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // 1. Phân quyền Scope cho phòng/tòa nhà
  const baseRoom = cloneScope(scope);
  const roomConds: string[] = [];
  const roomScope = baseRoom.condition("p.toa_nha");
  if (roomScope) roomConds.push(roomScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    baseRoom.params.push(buildingFilter);
    roomConds.push(`p.toa_nha = $${baseRoom.params.length}`);
  }

  // 2. Room & Issue Stats
  const roomStatsPromise = getDbPool().query<{
    tong_phong: number;
    dang_thue: number;
    phong_trong: number;
    da_dat_coc: number;
    dang_bao_tri: number;
  }>(
    `SELECT
       COUNT(*)::int AS tong_phong,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Đang thuê')::int AS dang_thue,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Trống')::int AS phong_trong,
       COUNT(*) FILTER (WHERE p.trang_thai IN ('Đã đặt cọc', 'Đã cọc'))::int AS da_dat_coc,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Đang bảo trì')::int AS dang_bao_tri
     FROM public.phong p
     ${baseRoom.where(roomConds)}`,
    baseRoom.params,
  );

  const issueQ = cloneScope(scope);
  const issueConds = [
    `sc.trang_thai IS DISTINCT FROM 'Đã xử lý'`,
    `sc.trang_thai IS DISTINCT FROM 'Đã hoàn thành'`,
  ];
  const issueScope = issueQ.condition("p.toa_nha");
  if (issueScope) issueConds.push(issueScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    issueQ.params.push(buildingFilter);
    issueConds.push(`p.toa_nha = $${issueQ.params.length}`);
  }
  const issueStatsPromise = getDbPool().query<{ su_co: number }>(
    `SELECT COUNT(*)::int AS su_co
     FROM public.su_co_bao_tri sc
     LEFT JOIN public.phong p ON p.ma_phong = sc.ma_phong
     ${issueQ.where(issueConds)}`,
    issueQ.params,
  );

  // 3. Revenue stats (Phiếu thu)
  const revQ = cloneScope(scope);
  const revConds = [`pt.trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')`];
  const revScope = revQ.condition("p.toa_nha");
  if (revScope) revConds.push(revScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    revQ.params.push(buildingFilter);
    revConds.push(`p.toa_nha = $${revQ.params.length}`);
  }
  revQ.params.push(currentMonthStr);
  const curIdx = revQ.params.length;
  revQ.params.push(prevMonthStr);
  const prevIdx = revQ.params.length;

  const revenueStatsPromise = getDbPool().query<{
    doanh_thu_thang: string;
    doanh_thu_thang_truoc: string;
    tong_thuc_thu: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN to_char(COALESCE(pt.ngay_thu, now()), 'YYYY-MM') = $${curIdx} THEN pt.so_tien_thu ELSE 0 END), 0)::text AS doanh_thu_thang,
       COALESCE(SUM(CASE WHEN to_char(COALESCE(pt.ngay_thu, now()), 'YYYY-MM') = $${prevIdx} THEN pt.so_tien_thu ELSE 0 END), 0)::text AS doanh_thu_thang_truoc,
       COALESCE(SUM(pt.so_tien_thu), 0)::text AS tong_thuc_thu
     FROM public.phieu_thu pt
     LEFT JOIN public.hoa_don hd ON hd.ma_hoa_don = pt.ma_hoa_don
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     ${revQ.where(revConds)}`,
    revQ.params,
  );

  // 4. Invoices & Breakdown stats
  const invQ = cloneScope(scope);
  const invConds: string[] = [];
  const invScope = invQ.condition("p.toa_nha");
  if (invScope) invConds.push(invScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    invQ.params.push(buildingFilter);
    invConds.push(`p.toa_nha = $${invQ.params.length}`);
  }
  invQ.params.push(currentMonthStr);
  const invCurIdx = invQ.params.length;

  const invoiceStatsPromise = getDbPool().query<{
    tong_phat_hanh: string;
    phat_hanh_thang: string;
    tong_no_ton_dong: string;
    no_thang_nay: string;
    tong_tien_phong: string;
    tong_tien_dien_nuoc: string;
    tong_tien_dich_vu: string;
  }>(
    `WITH inv_calc AS (
       SELECT
         hd.ma_hoa_don,
         to_char(COALESCE(hd.ngay_lap, now()), 'YYYY-MM') AS thang_lap,
         COALESCE(
           NULLIF(hd.tong_tien, 0),
           (COALESCE(hd.tien_phong, 0) + COALESCE(hd.tien_dien_nuoc, 0) + COALESCE(hd.tien_dich_vu_khac, 0) + COALESCE(hd.no_cu, 0))
         ) AS tong_tien_thuc,
         COALESCE(hd.tien_phong, 0) AS tien_phong,
         COALESCE(hd.tien_dien_nuoc, 0) AS tien_dien_nuoc,
         COALESCE(hd.tien_dich_vu_khac, 0) AS tien_dich_vu_khac,
         COALESCE((
           SELECT SUM(pt.so_tien_thu)
           FROM public.phieu_thu pt
           WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')
         ), 0) AS da_thu
       FROM public.hoa_don hd
       LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
       LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
       ${invQ.where(invConds)}
     )
     SELECT
       COALESCE(SUM(tong_tien_thuc), 0)::text AS tong_phat_hanh,
       COALESCE(SUM(CASE WHEN thang_lap = $${invCurIdx} THEN tong_tien_thuc ELSE 0 END), 0)::text AS phat_hanh_thang,
       COALESCE(SUM(GREATEST(0, tong_tien_thuc - da_thu)), 0)::text AS tong_no_ton_dong,
       COALESCE(SUM(CASE WHEN thang_lap = $${invCurIdx} THEN GREATEST(0, tong_tien_thuc - da_thu) ELSE 0 END), 0)::text AS no_thang_nay,
       COALESCE(SUM(tien_phong), 0)::text AS tong_tien_phong,
       COALESCE(SUM(tien_dien_nuoc), 0)::text AS tong_tien_dien_nuoc,
       COALESCE(SUM(tien_dich_vu_khac), 0)::text AS tong_tien_dich_vu
     FROM inv_calc`,
    invQ.params,
  );

  // 5. Total Deposits
  const depQ = cloneScope(scope);
  const depConds = [`c.trang_thai IN ('Còn hạn', 'Đang thuê', 'Đã đặt cọc')`];
  const depScope = depQ.condition("p.toa_nha");
  if (depScope) depConds.push(depScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    depQ.params.push(buildingFilter);
    depConds.push(`p.toa_nha = $${depQ.params.length}`);
  }

  const depositStatsPromise = getDbPool().query<{
    tien_coc_hop_dong: string;
    tien_coc_giu_cho: string;
  }>(
    `SELECT
       COALESCE(SUM(c.tien_dat_coc), 0)::text AS tien_coc_hop_dong,
       COALESCE((
         SELECT SUM(gc.so_tien_the_chan)
         FROM public.giu_cho gc
         LEFT JOIN public.phong gp ON gp.ma_phong = gc.ma_phong
         WHERE gc.trang_thai IN ('DangGiu', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ')
           ${depScope ? `AND ${depScope.replace(/p\./g, "gp.")}` : ""}
           ${buildingFilter && buildingFilter !== ALL_BUILDINGS ? `AND gp.toa_nha = '${buildingFilter.replace(/'/g, "''")}'` : ""}
       ), 0)::text AS tien_coc_giu_cho
     FROM public.hop_dong c
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     ${depQ.where(depConds)}`,
    depQ.params,
  );

  // 6. Trend 6 Months
  const trendQ = cloneScope(scope);
  const trendCondsForP: string[] = [];
  const trendScope = trendQ.condition("p.toa_nha");
  if (trendScope) trendCondsForP.push(trendScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    trendQ.params.push(buildingFilter);
    trendCondsForP.push(`p.toa_nha = $${trendQ.params.length}`);
  }
  const trendPWhere = trendCondsForP.length > 0 ? `AND ${trendCondsForP.join(" AND ")}` : "";

  const trendStatsPromise = getDbPool().query<{
    month_key: string;
    da_thu: string;
    con_no: string;
    tong_tien: string;
  }>(
    `WITH months AS (
       SELECT to_char(d, 'YYYY-MM') AS month_key
       FROM generate_series(
         date_trunc('month', now()) - interval '5 months',
         date_trunc('month', now()),
         interval '1 month'
       ) AS d
     ),
     rev AS (
       SELECT
         to_char(COALESCE(pt.ngay_thu, now()), 'YYYY-MM') AS month_key,
         SUM(pt.so_tien_thu) AS da_thu
       FROM public.phieu_thu pt
       LEFT JOIN public.hoa_don hd ON hd.ma_hoa_don = pt.ma_hoa_don
       LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
       LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
       WHERE pt.trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')
         ${trendPWhere}
       GROUP BY month_key
     ),
     inv AS (
       SELECT
         to_char(COALESCE(hd.ngay_lap, now()), 'YYYY-MM') AS month_key,
         SUM(COALESCE(
           NULLIF(hd.tong_tien, 0),
           (COALESCE(hd.tien_phong, 0) + COALESCE(hd.tien_dien_nuoc, 0) + COALESCE(hd.tien_dich_vu_khac, 0) + COALESCE(hd.no_cu, 0))
         )) AS tong_phat_hanh
       FROM public.hoa_don hd
       LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
       LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
       WHERE 1=1 ${trendPWhere}
       GROUP BY month_key
     )
     SELECT
       m.month_key,
       COALESCE(r.da_thu, 0)::text AS da_thu,
       GREATEST(0, COALESCE(i.tong_phat_hanh, 0) - COALESCE(r.da_thu, 0))::text AS con_no,
       COALESCE(i.tong_phat_hanh, COALESCE(r.da_thu, 0))::text AS tong_tien
     FROM months m
     LEFT JOIN rev r ON r.month_key = m.month_key
     LEFT JOIN inv i ON i.month_key = m.month_key
     ORDER BY m.month_key ASC`,
    trendQ.params,
  );

  // 7. Unpaid Invoices (top 6)
  const unpQ = cloneScope(scope);
  const unpConds: string[] = [];
  const unpScope = unpQ.condition("p.toa_nha");
  if (unpScope) unpConds.push(unpScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    unpQ.params.push(buildingFilter);
    unpConds.push(`p.toa_nha = $${unpQ.params.length}`);
  }

  const unpaidInvoicesPromise = getDbPool().query<{
    ma_hoa_don: string;
    ma_phong: string | null;
    toa_nha: string | null;
    ten_khach: string | null;
    so_dt: string | null;
    tong_tien: string;
    da_thu: string;
    con_lai: string;
    han_dong_tien: string | null;
    ngay_lap: string | null;
  }>(
    `WITH inv_calc AS (
       SELECT
         hd.ma_hoa_don,
         c.ma_phong,
         p.toa_nha,
         k.ho_ten_khach AS ten_khach,
         k.so_dt,
         COALESCE(
           NULLIF(hd.tong_tien, 0),
           (COALESCE(hd.tien_phong, 0) + COALESCE(hd.tien_dien_nuoc, 0) + COALESCE(hd.tien_dich_vu_khac, 0) + COALESCE(hd.no_cu, 0))
         ) AS tong_tien,
         COALESCE((
           SELECT SUM(pt.so_tien_thu)
           FROM public.phieu_thu pt
           WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')
         ), 0) AS da_thu,
         hd.han_dong_tien,
         hd.ngay_lap
       FROM public.hoa_don hd
       LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
       LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
       LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
       ${unpQ.where(unpConds)}
     )
     SELECT
       ma_hoa_don,
       ma_phong,
       toa_nha,
       ten_khach,
       so_dt,
       tong_tien::text AS tong_tien,
       da_thu::text AS da_thu,
       (tong_tien - da_thu)::text AS con_lai,
       han_dong_tien::text AS han_dong_tien,
       ngay_lap::text AS ngay_lap
     FROM inv_calc
     WHERE (tong_tien - da_thu) > 0
     ORDER BY (tong_tien - da_thu) DESC, han_dong_tien ASC NULLS LAST
     LIMIT 6`,
    unpQ.params,
  );

  // 8. Recent Receipts (top 6)
  const recQ = cloneScope(scope);
  const recConds: string[] = [];
  const recScope = recQ.condition("p.toa_nha");
  if (recScope) recConds.push(recScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    recQ.params.push(buildingFilter);
    recConds.push(`p.toa_nha = $${recQ.params.length}`);
  }

  const recentReceiptsPromise = getDbPool().query<{
    ma_phieu_thu: string;
    ma_hoa_don: string | null;
    ma_phong: string | null;
    toa_nha: string | null;
    ten_khach: string | null;
    so_tien_thu: string;
    ngay_thu: string | null;
    hinh_thuc: string | null;
    trang_thai: string | null;
  }>(
    `SELECT
       pt.ma_phieu_thu,
       pt.ma_hoa_don,
       c.ma_phong,
       p.toa_nha,
       k.ho_ten_khach AS ten_khach,
       pt.so_tien_thu::text AS so_tien_thu,
       pt.ngay_thu::text AS ngay_thu,
       pt.hinh_thuc,
       pt.trang_thai
     FROM public.phieu_thu pt
     LEFT JOIN public.hoa_don hd ON hd.ma_hoa_don = pt.ma_hoa_don
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
     ${recQ.where(recConds)}
     ORDER BY pt.ngay_thu DESC NULLS LAST
     LIMIT 6`,
    recQ.params,
  );

  // 9. Extra Counts (Cư dân & Phiếu giữ chỗ chờ tạo HĐ)
  const extrasPromise = Promise.all([
    getDbPool().query<{ count: number }>(
      `SELECT COUNT(DISTINCT ma_khach)::int AS count
       FROM public.chi_tiet_hop_dong_khach_thue
       WHERE trang_thai_luu_tru = 'Đang ở'`,
    ),
    getDbPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.giu_cho gc
       WHERE gc.trang_thai IN ('DangGiu', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ')`,
    ),
  ]);

  const [
    roomRows,
    issueRows,
    revenueRows,
    invoiceRows,
    depositRows,
    trendRows,
    unpaidRows,
    receiptRows,
    [residentRows, holdRows],
  ] = await Promise.all([
    roomStatsPromise,
    issueStatsPromise,
    revenueStatsPromise,
    invoiceStatsPromise,
    depositStatsPromise,
    trendStatsPromise,
    unpaidInvoicesPromise,
    recentReceiptsPromise,
    extrasPromise,
  ]);

  // Calculations
  const tongPhong = roomRows.rows[0]?.tong_phong ?? 0;
  const dangThue = roomRows.rows[0]?.dang_thue ?? 0;
  const phongTrong = roomRows.rows[0]?.phong_trong ?? 0;
  const daDatCoc = roomRows.rows[0]?.da_dat_coc ?? 0;
  const dangBaoTri = roomRows.rows[0]?.dang_bao_tri ?? 0;
  const suCo = issueRows.rows[0]?.su_co ?? 0;
  const tyLeLapDay = tongPhong > 0 ? Math.round((dangThue / tongPhong) * 1000) / 10 : 0;

  const doanhThuThang = Number(revenueRows.rows[0]?.doanh_thu_thang ?? 0);
  const doanhThuThangTruoc = Number(revenueRows.rows[0]?.doanh_thu_thang_truoc ?? 0);
  const tongThucThu = Number(revenueRows.rows[0]?.tong_thuc_thu ?? 0);

  let chenhLechDoanhThuPct = 0;
  if (doanhThuThangTruoc > 0) {
    chenhLechDoanhThuPct =
      Math.round(((doanhThuThang - doanhThuThangTruoc) / doanhThuThangTruoc) * 1000) / 10;
  }

  const phatHanhThang = Number(invoiceRows.rows[0]?.phat_hanh_thang ?? 0);
  const noThangNay = Number(invoiceRows.rows[0]?.no_thang_nay ?? 0);
  const tongNoTonDong = Number(invoiceRows.rows[0]?.tong_no_ton_dong ?? 0);

  const tongPhaiThuThang = phatHanhThang > 0 ? phatHanhThang : doanhThuThang + noThangNay;
  const tyLeThuThang =
    tongPhaiThuThang > 0
      ? Math.min(100, Math.round((doanhThuThang / tongPhaiThuThang) * 1000) / 10)
      : doanhThuThang > 0
        ? 100
        : 0;

  const tienCocHopDong = Number(depositRows.rows[0]?.tien_coc_hop_dong ?? 0);
  const tienCocGiuCho = Number(depositRows.rows[0]?.tien_coc_giu_cho ?? 0);
  const tongTienCoc = tienCocHopDong + tienCocGiuCho;

  const tienPhong = Number(invoiceRows.rows[0]?.tong_tien_phong ?? 0);
  const tienDienNuoc = Number(invoiceRows.rows[0]?.tong_tien_dien_nuoc ?? 0);
  const tienDichVu = Number(invoiceRows.rows[0]?.tong_tien_dich_vu ?? 0);
  const tongBreakdown = tienPhong + tienDienNuoc + tienDichVu;

  const monthlyTrend = trendRows.rows.map((r) => {
    const [y, m] = r.month_key.split("-");
    return {
      monthKey: r.month_key,
      label: `T${Number(m)}/${y.slice(2)}`,
      daThu: Number(r.da_thu ?? 0),
      conNo: Number(r.con_no ?? 0),
      tongTien: Number(r.tong_tien ?? 0),
    };
  });

  return {
    kpi: {
      doanhThuThang,
      doanhThuThangTruoc,
      chenhLechDoanhThuPct,
      tongThucThu,
      phatHanhThang,
      noThangNay,
      tongNoTonDong,
      tyLeThuThang,
      tienCocHopDong,
      tienCocGiuCho,
      tongTienCoc,
      tongPhong,
      dangThue,
      phongTrong,
      daDatCoc,
      dangBaoTri,
      suCo,
      tyLeLapDay,
      soCuDan: residentRows.rows[0]?.count ?? 0,
      pendingHoldCount: holdRows.rows[0]?.count ?? 0,
    },
    monthlyTrend,
    revenueBreakdown: {
      tienPhong,
      tienDienNuoc,
      tienDichVu,
      tong: tongBreakdown,
    },
    unpaidInvoices: unpaidRows.rows,
    recentReceipts: receiptRows.rows,
  };
}

/** Nhân bản phạm vi cho truy vấn phụ (mỗi truy vấn cần bộ tham số riêng). */
function cloneScope(scope: ScopeQuery): ScopeQuery {
  return new ScopeQuery(scope.accessScope);
}

/**
 * Số liệu tổng quan theo cách tính của SupabaseApp/HomeController.Index.
 * `buildingFilter` là tòa đang xem; `scope` là giới hạn quyền của tài khoản.
 */
export async function getDashboardStats(
  buildingFilter: string | null,
  scope: ScopeQuery,
): Promise<DashboardStats> {
  const room = cloneScope(scope);
  const roomConditions: string[] = [];
  const roomScope = room.condition("p.toa_nha");
  if (roomScope) roomConditions.push(roomScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    room.params.push(buildingFilter);
    roomConditions.push(`p.toa_nha = $${room.params.length}`);
  }

  const { rows } = await getDbPool().query<{
    tong_phong: number;
    dang_thue: number;
    phong_trong: number;
    da_dat_coc: number;
    dang_bao_tri: number;
  }>(
    `SELECT
       COUNT(*)::int AS tong_phong,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Đang thuê')::int AS dang_thue,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Trống')::int AS phong_trong,
       COUNT(*) FILTER (WHERE p.trang_thai IN ('Đã đặt cọc', 'Đã cọc'))::int AS da_dat_coc,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Đang bảo trì')::int AS dang_bao_tri
     FROM public.phong p
     ${room.where(roomConditions)}`,
    room.params,
  );

  const issue = cloneScope(scope);
  const issueConditions = [
    `sc.trang_thai IS DISTINCT FROM 'Đã xử lý'`,
    `sc.trang_thai IS DISTINCT FROM 'Đã hoàn thành'`,
  ];
  const issueScope = issue.condition("p.toa_nha");
  if (issueScope) issueConditions.push(issueScope);
  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    issue.params.push(buildingFilter);
    issueConditions.push(`p.toa_nha = $${issue.params.length}`);
  }

  const { rows: issueRows } = await getDbPool().query<{ su_co: number }>(
    `SELECT COUNT(*)::int AS su_co
     FROM public.su_co_bao_tri sc
     LEFT JOIN public.phong p ON p.ma_phong = sc.ma_phong
     ${issue.where(issueConditions)}`,
    issue.params,
  );

  const tongPhong = rows[0]?.tong_phong ?? 0;
  const dangThue = rows[0]?.dang_thue ?? 0;
  const phongTrong = rows[0]?.phong_trong ?? 0;
  const daDatCoc = rows[0]?.da_dat_coc ?? 0;
  const dangBaoTri = rows[0]?.dang_bao_tri ?? 0;

  return {
    tongPhong,
    dangThue,
    phongTrong,
    daDatCoc,
    dangBaoTri,
    suCo: issueRows[0]?.su_co ?? 0,
    tyLeLapDay:
      tongPhong > 0 ? Math.round((dangThue / tongPhong) * 1000) / 10 : 0,
  };
}

export type RoomRow = {
  ma_phong: string;
  ten_hien_thi: string | null;
  tang: number | null;
  dien_tich: number | null;
  gia_thue: string | null;
  tien_dat_coc: string | null;
  trang_thai: string | null;
  toa_nha: string | null;
  ma_loai_phong: string | null;
  mo_ta_ngan: string | null;
  noi_that_san_co: string[] | null;
  hinh_anh: string | null;
  ten_loai_phong: string | null;
  loai_phong_tien_ich?: string[] | null;
  khach_thue: string | null;
  ngay_kt: string | null;
  /** Danh mục sự cố đang mở (chưa xử lý) gần nhất, dùng cho badge "Sửa...". */
  su_co_dang_mo: string | null;
  giu_cho_trang_thai?: string | null;
  giu_cho_expires_at?: string | null;
  chi_so_dien?: string | null;
  chi_so_nuoc?: string | null;
  ngay_cap_nhat_chi_so?: string | null;
};

export type RoomFilters = {
  building?: string;
  status?: string;
  keyword?: string;
  scope: ScopeQuery;
};

/**
 * Tự động quét và xử lý:
 * 1. Các phiếu giữ chỗ QR quá hạn 15 phút (ChoThanhToan -> HetHan).
 * 2. Các phiếu giữ chỗ quá 5 ngày không đến làm hợp đồng (DangGiu / DaThanhToan -> MatCoc).
 * 3. Hoàn trả trạng thái phòng về 'Trống' nếu phòng không còn phiếu giữ chỗ hợp lệ hoặc hợp đồng hiệu lực.
 */
export async function autoExpirePendingHolds(): Promise<number> {
  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    // 1. Quét phiếu QR hết hạn 15 phút
    await client.query(`
      UPDATE public.giu_cho
      SET trang_thai = 'HetHan',
          ghi_chu = COALESCE(ghi_chu || ' | ', '') || '[Hết hạn 15 phút thanh toán QR]'
      WHERE trang_thai IN ('ChoThanhToan', 'Chờ thanh toán')
        AND expires_at IS NOT NULL
        AND expires_at < now()
    `);

    // 2. Quét phiếu giữ chỗ quá hạn 5 ngày không đến ký hợp đồng -> Tự động mất cọc
    await client.query(`
      UPDATE public.giu_cho
      SET trang_thai = 'MatCoc',
          ghi_chu = COALESCE(ghi_chu || ' | ', '') || '[Quá hạn 5 ngày giữ chỗ - Tự động mất cọc]'
      WHERE trang_thai IN ('DangGiu', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ')
        AND (
          (ngay_het_han IS NOT NULL AND ngay_het_han < now())
          OR (ngay_het_han IS NULL AND thoi_gian_giu_cho + INTERVAL '5 days' < now())
        )
    `);

    // 3. Mở khóa phòng về trạng thái 'Trống' nếu không còn phiếu giữ chỗ hợp lệ hoặc hợp đồng đang hiệu lực
    const { rowCount } = await client.query(`
      UPDATE public.phong p
      SET trang_thai = 'Trống'
      WHERE p.trang_thai IN ('Đã đặt cọc', 'Đã cọc')
        AND NOT EXISTS (
          SELECT 1 FROM public.giu_cho gc
          WHERE gc.ma_phong = p.ma_phong
            AND gc.trang_thai IN ('DangGiu', 'DaThanhToan', 'ChoThanhToan', 'Đã thanh toán', 'Đang giữ', 'Chờ thanh toán')
            AND (gc.ngay_het_han IS NULL OR gc.ngay_het_han >= now())
            AND (gc.expires_at IS NULL OR gc.expires_at >= now())
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.hop_dong hd
          WHERE hd.ma_phong = p.ma_phong
            AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
        )
    `);

    await client.query("COMMIT");
    return rowCount ?? 0;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Auto expire pending holds error:", err);
    return 0;
  } finally {
    client.release();
  }
}

/** Danh sách phòng kèm hợp đồng hiệu lực, tương ứng RoomController.Index. */
export async function getRooms(filters: RoomFilters): Promise<RoomRow[]> {
  await autoExpirePendingHolds();
  const query = cloneScope(filters.scope);
  const conditions: string[] = [];

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  if (filters.building && filters.building !== ALL_BUILDINGS) {
    query.params.push(filters.building);
    conditions.push(`p.toa_nha = $${query.params.length}`);
  }

  if (filters.status === "DangThue")
    conditions.push(`p.trang_thai = 'Đang thuê'`);
  else if (filters.status === "Trong")
    conditions.push(`p.trang_thai = 'Trống'`);
  else if (filters.status === "SuaChua")
    conditions.push(`p.trang_thai = 'Đang bảo trì'`);
  else if (filters.status === "DaCoc")
    conditions.push(`p.trang_thai IN ('Đã đặt cọc', 'Đã cọc')`);

  if (filters.keyword) {
    query.params.push(`%${filters.keyword.trim().toLowerCase()}%`);
    const index = query.params.length;
    conditions.push(
      `(LOWER(COALESCE(p.ten_hien_thi, p.ma_phong)) LIKE $${index} OR LOWER(COALESCE(k.ho_ten_khach, '')) LIKE $${index})`,
    );
  }

  const { rows } = await getDbPool().query<RoomRow>(
    `SELECT
       p.ma_phong,
       p.ten_hien_thi,
       p.tang,
       p.dien_tich,
       p.gia_thue::text AS gia_thue,
       p.tien_dat_coc::text AS tien_dat_coc,
       p.trang_thai,
       p.toa_nha,
       p.ma_loai_phong,
       p.mo_ta_ngan,
       p.noi_that_san_co,
       p.hinh_anh,
       p.chi_so_dien::text AS chi_so_dien,
       p.chi_so_nuoc::text AS chi_so_nuoc,
       p.ngay_cap_nhat_chi_so::text AS ngay_cap_nhat_chi_so,
       lp.ten_loai_phong,
       COALESCE(k.ho_ten_khach, kgc.ho_ten_khach) AS khach_thue,
       gc.trang_thai AS giu_cho_trang_thai,
       gc.expires_at::text AS giu_cho_expires_at,
       h.ngay_kt::text AS ngay_kt,
       sc.danh_muc AS su_co_dang_mo
     FROM public.phong p
     LEFT JOIN public.loai_phong lp ON lp.ma_loai_phong = p.ma_loai_phong
     LEFT JOIN LATERAL (
       SELECT hd.ma_khach_dai_dien, hd.ngay_kt
       FROM public.hop_dong hd
       WHERE hd.ma_phong = p.ma_phong
         AND hd.trang_thai IN ('Còn hạn', 'Đang thuê', 'Đã đặt cọc')
       ORDER BY hd.ngay_bd DESC NULLS LAST
       LIMIT 1
     ) h ON true
     LEFT JOIN public.khach_thue k ON k.ma_khach = h.ma_khach_dai_dien
     LEFT JOIN LATERAL (
       SELECT gc.ma_khach, gc.trang_thai, gc.expires_at
       FROM public.giu_cho gc
       WHERE gc.ma_phong = p.ma_phong AND gc.trang_thai IN ('DangGiu', 'ChoThanhToan', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ', 'Chờ thanh toán')
       ORDER BY gc.thoi_gian_giu_cho DESC
       LIMIT 1
     ) gc ON true
     LEFT JOIN public.khach_thue kgc ON kgc.ma_khach = gc.ma_khach
     LEFT JOIN LATERAL (
       SELECT s.danh_muc
       FROM public.su_co_bao_tri s
       WHERE s.ma_phong = p.ma_phong
         AND s.trang_thai IS DISTINCT FROM 'Đã xử lý'
         AND s.trang_thai IS DISTINCT FROM 'Đã hoàn thành'
       ORDER BY s.ngay_bao_cao DESC NULLS LAST
       LIMIT 1
     ) sc ON true
     ${query.where(conditions)}
     ORDER BY p.tang DESC NULLS LAST, p.ma_phong`,
    query.params,
  );

  return rows;
}

/** Danh sách cơ sở (tòa nhà) hiện có, giới hạn theo quyền của tài khoản. */
export async function getBuildings(scope: ScopeQuery): Promise<string[]> {
  const query = cloneScope(scope);
  const conditions = ["toa_nha IS NOT NULL"];
  const scopeWhere = query.condition("toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<{ toa_nha: string }>(
    `SELECT DISTINCT toa_nha FROM public.phong
     ${query.where(conditions)}
     ORDER BY toa_nha`,
    query.params,
  );
  return rows.map((row) => row.toa_nha);
}

export type RoomTypeOption = {
  ma_loai_phong: string;
  ten_loai_phong: string;
  don_gia_co_ban?: string;
  tien_ich?: string[] | null;
};

/** Danh mục loại phòng kèm tiện ích chuẩn cho các ô chọn. */
export async function getRoomTypes(): Promise<RoomTypeOption[]> {
  const { rows } = await getDbPool().query<RoomTypeOption>(
    `SELECT ma_loai_phong, ten_loai_phong, don_gia_co_ban::text AS don_gia_co_ban, tien_ich
     FROM public.loai_phong
     ORDER BY don_gia_co_ban DESC NULLS LAST, ten_loai_phong`,
  );
  return rows;
}

/** Số hợp đồng sắp hết hạn trong 30 ngày, tương ứng ViewBag.SapHetHan. */
export async function getExpiringContractCount(
  buildingFilter: string | null,
  scope: ScopeQuery,
): Promise<number> {
  const query = cloneScope(scope);
  const conditions = [
    `hd.trang_thai IN ('Còn hạn', 'Đang thuê')`,
    `hd.ngay_kt IS NOT NULL`,
    `hd.ngay_kt <= now() + interval '30 days'`,
  ];

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  if (buildingFilter && buildingFilter !== ALL_BUILDINGS) {
    query.params.push(buildingFilter);
    conditions.push(`p.toa_nha = $${query.params.length}`);
  }

  const { rows } = await getDbPool().query<{ sap_het_han: number }>(
    `SELECT COUNT(*)::int AS sap_het_han
     FROM public.hop_dong hd
     JOIN public.phong p ON p.ma_phong = hd.ma_phong
     ${query.where(conditions)}`,
    query.params,
  );
  return rows[0]?.sap_het_han ?? 0;
}

export type EmergencyContact = {
  ho_ten?: string;
  so_dt?: string;
  moi_quan_he?: string;
};

export type TenantRow = {
  ma_khach: string;
  ho_ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  dia_chi_thuong_tru: string | null;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ngay_cap_cccd: string | null;
  noi_cap_cccd: string | null;
  anh_cccd_mat_truoc: string | null;
  anh_cccd_mat_sau: string | null;
  co_anh_cccd_truoc?: boolean;
  co_anh_cccd_sau?: boolean;
  trang_thai_ekyc: string | null;
  nguoi_lien_he_khan_cap: EmergencyContact | null;
  ghi_chu_noi_bo: string | null;
  ma_tai_khoan: string | null;
  ten_dang_nhap: string | null;
  trang_thai_tai_khoan: string | null;
  da_doi_mat_khau: boolean | null;
  ma_phong_hien_tai: string | null;
  toa_nha_hien_tai: string | null;
  vai_tro_phong: string | null;
  trang_thai_cu_dan: "DangO" | "CuuCuDan" | "ChuaThue";
  so_phuong_tien: number;
  so_xe_cho_duyet: number;
  danh_sach_xe: string | null;
};

export type VehicleRow = {
  ma_phuong_tien: string;
  ma_khach: string;
  ma_phong: string | null;
  loai_xe: string;
  bien_so_xe: string;
  ma_the_xe: string | null;
  trang_thai: string;
  ngay_dang_ky: string | null;
};

export type TenantContractHistoryRow = {
  ma_hop_dong: string;
  ma_phong: string;
  toa_nha: string | null;
  vai_tro: string;
  ngay_bd: string | null;
  ngay_kt: string | null;
  gia_thue: string | null;
  trang_thai: string;
};

/**
 * Danh sách khách thuê & cư dân đầy đủ hồ sơ (eKYC, tài khoản, phương tiện).
 * Hỗ trợ lọc theo trạng thái: Tất cả (All), Đang ở (active), Chờ duyệt (pending), Cựu cư dân (past).
 */
export async function getTenants(
  filterOrKeyword: { status?: string; keyword?: string } | string,
  scope: ScopeQuery,
): Promise<TenantRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  const filters =
    typeof filterOrKeyword === "string"
      ? { keyword: filterOrKeyword, status: "All" }
      : {
          keyword: filterOrKeyword.keyword || "",
          status: filterOrKeyword.status || "All",
        };

  if (filters.keyword.trim()) {
    query.params.push(`%${filters.keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(k.ho_ten_khach ILIKE $${index} OR k.cccd ILIKE $${index} OR k.so_dt ILIKE $${index} OR active_room.ma_phong ILIKE $${index} OR v.danh_sach_xe ILIKE $${index})`,
    );
  }

  const scopeWhere = query.scopedExists(
    `SELECT 1 FROM public.hop_dong hd_scope
     JOIN public.phong p_scope ON p_scope.ma_phong = hd_scope.ma_phong
     LEFT JOIN public.chi_tiet_hop_dong_khach_thue ct_scope ON ct_scope.ma_hop_dong = hd_scope.ma_hop_dong
     WHERE (hd_scope.ma_khach_dai_dien = k.ma_khach OR ct_scope.ma_khach = k.ma_khach)`,
  );
  if (scopeWhere) conditions.push(scopeWhere);

  if (filters.status === "active") {
    conditions.push("active_room.ma_phong IS NOT NULL");
  } else if (filters.status === "past") {
    conditions.push("active_room.ma_phong IS NULL AND past_room.ma_phong IS NOT NULL");
  } else if (filters.status === "pending") {
    conditions.push(
      `(COALESCE(k.trang_thai_ekyc, 'ChuaXacThuc') = 'ChoDuyet' OR EXISTS(SELECT 1 FROM public.phuong_tien pt WHERE pt.ma_khach = k.ma_khach AND pt.trang_thai = 'ChoDuyet'))`,
    );
  } else if (filters.status === "unassigned") {
    conditions.push("active_room.ma_phong IS NULL AND past_room.ma_phong IS NULL");
  }

  const { rows } = await getDbPool().query<TenantRow>(
    `SELECT
       k.ma_khach,
       k.ho_ten_khach,
       k.so_dt,
       k.cccd,
       k.dia_chi_thuong_tru,
       k.ngay_sinh::text AS ngay_sinh,
       k.gioi_tinh,
       k.ngay_cap_cccd::text AS ngay_cap_cccd,
       k.noi_cap_cccd,
       (k.anh_cccd_mat_truoc IS NOT NULL AND length(k.anh_cccd_mat_truoc) > 0) AS co_anh_cccd_truoc,
       (k.anh_cccd_mat_sau IS NOT NULL AND length(k.anh_cccd_mat_sau) > 0) AS co_anh_cccd_sau,
       NULL::text AS anh_cccd_mat_truoc,
       NULL::text AS anh_cccd_mat_sau,
       COALESCE(k.trang_thai_ekyc, 'ChuaXacThuc') AS trang_thai_ekyc,
       k.nguoi_lien_he_khan_cap,
       k.ghi_chu_noi_bo,
       k.ma_tai_khoan,
       tk.ten_dang_nhap,
       tk.trang_thai AS trang_thai_tai_khoan,
       tk.da_doi_mat_khau,
       active_room.ma_phong AS ma_phong_hien_tai,
       active_room.toa_nha AS toa_nha_hien_tai,
       CASE
         WHEN active_room.is_rep THEN 'Đại diện HĐ'
         WHEN active_room.is_occ THEN 'Người ở cùng'
         WHEN past_room.ma_phong IS NOT NULL THEN 'Cựu cư dân'
         ELSE 'Chưa thuê'
       END AS vai_tro_phong,
       CASE
         WHEN active_room.ma_phong IS NOT NULL THEN 'DangO'
         WHEN past_room.ma_phong IS NOT NULL THEN 'CuuCuDan'
         ELSE 'ChuaThue'
       END AS trang_thai_cu_dan,
       COALESCE(v.so_xe, 0)::int AS so_phuong_tien,
       COALESCE(v.so_xe_cho_duyet, 0)::int AS so_xe_cho_duyet,
       v.danh_sach_xe
     FROM public.khach_thue k
     LEFT JOIN public.tai_khoan tk ON tk.ma_tai_khoan = k.ma_tai_khoan
     LEFT JOIN LATERAL (
       SELECT
         p.ma_phong,
         p.toa_nha,
         (hd.ma_khach_dai_dien = k.ma_khach) AS is_rep,
         (ct.ma_khach = k.ma_khach) AS is_occ
       FROM public.hop_dong hd
       JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.chi_tiet_hop_dong_khach_thue ct ON ct.ma_hop_dong = hd.ma_hop_dong AND ct.ma_khach = k.ma_khach
       WHERE (hd.ma_khach_dai_dien = k.ma_khach OR (ct.ma_khach = k.ma_khach AND (ct.trang_thai_luu_tru IS NULL OR ct.trang_thai_luu_tru IN ('Đang ở', 'DangO'))))
         AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
       ORDER BY hd.ngay_bd DESC NULLS LAST
       LIMIT 1
     ) active_room ON true
     LEFT JOIN LATERAL (
       SELECT p.ma_phong
       FROM public.hop_dong hd
       JOIN public.phong p ON p.ma_phong = hd.ma_phong
       LEFT JOIN public.chi_tiet_hop_dong_khach_thue ct ON ct.ma_hop_dong = hd.ma_hop_dong AND ct.ma_khach = k.ma_khach
       WHERE (hd.ma_khach_dai_dien = k.ma_khach OR ct.ma_khach = k.ma_khach)
       ORDER BY hd.ngay_kt DESC NULLS LAST
       LIMIT 1
     ) past_room ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS so_xe,
         COUNT(CASE WHEN pt.trang_thai = 'ChoDuyet' THEN 1 END)::int AS so_xe_cho_duyet,
         STRING_AGG(pt.bien_so_xe || ' (' || pt.loai_xe || ')', ', ' ORDER BY pt.ngay_dang_ky DESC) AS danh_sach_xe
       FROM public.phuong_tien pt
       WHERE pt.ma_khach = k.ma_khach AND pt.trang_thai <> 'DaHuy'
     ) v ON true
     ${query.where(conditions)}
     ORDER BY k.ho_ten_khach`,
    query.params,
  );
  return rows;
}

/** Danh sách phương tiện của một khách thuê */
export async function getTenantVehicles(maKhach: string): Promise<VehicleRow[]> {
  const { rows } = await getDbPool().query<VehicleRow>(
    `SELECT ma_phuong_tien, ma_khach, ma_phong, loai_xe, bien_so_xe, ma_the_xe, trang_thai, ngay_dang_ky::text AS ngay_dang_ky
     FROM public.phuong_tien
     WHERE ma_khach = $1
     ORDER BY ngay_dang_ky DESC`,
    [maKhach],
  );
  return rows;
}

/** Lịch sử các hợp đồng của một cư dân */
export async function getTenantRentalHistory(
  maKhach: string,
): Promise<TenantContractHistoryRow[]> {
  const { rows } = await getDbPool().query<TenantContractHistoryRow>(
    `SELECT
       hd.ma_hop_dong,
       hd.ma_phong,
       p.toa_nha,
       CASE WHEN hd.ma_khach_dai_dien = $1 THEN 'Khách đại diện' ELSE 'Người ở cùng' END AS vai_tro,
       hd.ngay_bd::text AS ngay_bd,
       hd.ngay_kt::text AS ngay_kt,
       hd.gia_thue_thoa_thuan::text AS gia_thue,
       hd.trang_thai
     FROM public.hop_dong hd
     JOIN public.phong p ON p.ma_phong = hd.ma_phong
     WHERE hd.ma_khach_dai_dien = $1
        OR EXISTS (
          SELECT 1 FROM public.chi_tiet_hop_dong_khach_thue ct
          WHERE ct.ma_hop_dong = hd.ma_hop_dong AND ct.ma_khach = $1
        )
     ORDER BY hd.ngay_bd DESC NULLS LAST`,
    [maKhach],
  );
  return rows;
}
export type StayRow = {
  ma_dang_ky: string;
  ho_ten_khach_ngoai: string | null;
  cccd_khach_ngoai: string | null;
  ma_phong: string | null;
  ten_nguoi_dang_ky: string | null;
  tu_ngay: string | null;
  den_ngay: string | null;
  cam_ket_an_ninh: boolean | null;
  trang_thai: string | null;
};

/** Danh sách khách qua đêm, tương ứng StayController.Index. */
export async function getOvernightStays(
  filters: { status?: string; keyword?: string },
  scope: ScopeQuery,
): Promise<StayRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (
    filters.status &&
    filters.status !== ALL_BUILDINGS &&
    filters.status !== "All"
  ) {
    query.params.push(filters.status);
    conditions.push(`d.trang_thai = $${query.params.length}`);
  }
  if (filters.keyword?.trim()) {
    query.params.push(`%${filters.keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(d.ho_ten_khach_ngoai ILIKE $${index} OR d.cccd_khach_ngoai ILIKE $${index} OR p.ma_phong ILIKE $${index})`,
    );
  }

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<StayRow>(
    `SELECT
       d.ma_dang_ky,
       d.ho_ten_khach_ngoai,
       d.cccd_khach_ngoai,
       p.ma_phong,
       k.ho_ten_khach AS ten_nguoi_dang_ky,
       d.tu_ngay::text AS tu_ngay,
       d.den_ngay::text AS den_ngay,
       d.cam_ket_an_ninh,
       d.trang_thai
     FROM public.dang_ky_khach_qua_dem d
     LEFT JOIN public.phong p ON p.ma_phong = d.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = d.ma_khach_dang_ky
     ${query.where(conditions)}
     ORDER BY d.tu_ngay DESC NULLS LAST`,
    query.params,
  );
  return rows;
}

export type ContractOption = {
  ma_hop_dong: string;
  ma_phong: string | null;
  ten_khach: string | null;
  trang_thai: string | null;
  chi_so_dien?: string | null;
  chi_so_nuoc?: string | null;
};

/** Hợp đồng còn hiệu lực để chọn khi tạo chứng từ, giới hạn theo quyền. */
export async function getActiveContracts(
  scope: ScopeQuery,
): Promise<ContractOption[]> {
  const query = cloneScope(scope);
  const conditions = [`hd.trang_thai IN ('Còn hạn', 'Đang thuê')`];
  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<ContractOption>(
    `SELECT 
       hd.ma_hop_dong, 
       hd.ma_phong, 
       k.ho_ten_khach AS ten_khach, 
       hd.trang_thai,
       p.chi_so_dien::text AS chi_so_dien,
       p.chi_so_nuoc::text AS chi_so_nuoc
     FROM public.hop_dong hd
     LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
     LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
     ${query.where(conditions)}
     ORDER BY hd.ngay_bd DESC NULLS LAST`,
    query.params,
  );
  return rows;
}

export type ContractRow = {
  ma_hop_dong: string;
  ma_phong: string | null;
  ma_khach_dai_dien?: string | null;
  ten_khach: string | null;
  ngay_bd: string | null;
  ngay_kt: string | null;
  tien_dat_coc: string | null;
  gia_thue_thoa_thuan: string | null;
  chu_ky_thu_tien: number | null;
  trang_thai: string | null;
  ngay_ky?: string | null;
  co_yeu_cau_thanh_ly?: boolean;
  co_yeu_cau_doi_phong?: boolean;
};

export type ContractStats = { total: number; active: number; expiring: number };

/** Danh sách hợp đồng kèm số liệu, tương ứng ContractController.Index. */
export async function getContracts(
  filters: { status?: string; keyword?: string },
  scope: ScopeQuery,
): Promise<{ contracts: ContractRow[]; stats: ContractStats }> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (filters.status && filters.status !== "All") {
    query.params.push(filters.status);
    conditions.push(`hd.trang_thai = $${query.params.length}`);
  }
  if (filters.keyword?.trim()) {
    query.params.push(`%${filters.keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(hd.ma_hop_dong ILIKE $${index} OR hd.ma_phong ILIKE $${index} OR k.ho_ten_khach ILIKE $${index})`,
    );
  }

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<ContractRow>(
    `SELECT
       hd.ma_hop_dong,
       hd.ma_phong,
       hd.ma_khach_dai_dien,
       k.ho_ten_khach AS ten_khach,
       hd.ngay_bd::text AS ngay_bd,
       hd.ngay_kt::text AS ngay_kt,
       hd.ngay_ky::text AS ngay_ky,
       hd.tien_dat_coc::text AS tien_dat_coc,
       hd.gia_thue_thoa_thuan::text AS gia_thue_thoa_thuan,
       hd.chu_ky_thu_tien,
       hd.trang_thai,
       EXISTS (
         SELECT 1 FROM public.bien_ban_thanh_ly tl
         WHERE tl.ma_hop_dong = hd.ma_hop_dong
           AND (tl.trang_thai IN ('CHO_DUYET', 'ChoDuyet', 'Chờ duyệt', 'CHO DUYET')
                OR (tl.trang_thai IS NULL AND tl.ghi_chu LIKE '%[Trạng thái: CHO_DUYET]%'))
       ) AS co_yeu_cau_thanh_ly,
       EXISTS (
         SELECT 1 FROM public.yeu_cau_chuyen_phong y
         WHERE y.ma_hop_dong_ht = hd.ma_hop_dong
           AND y.trang_thai_tien_do::text IN ('Chờ duyệt', 'Đang xử lý', 'Chờ khách xác nhận', 'Đã kiểm tra', 'Khách đã xác nhận', 'Chờ chủ duyệt')
       ) AS co_yeu_cau_doi_phong
     FROM public.hop_dong hd
     LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
     LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
     ${query.where(conditions)}
     ORDER BY hd.ngay_bd DESC NULLS LAST`,
    query.params,
  );

  const statQuery = cloneScope(scope);
  const statConditions: string[] = [];
  const statScope = statQuery.condition("p.toa_nha");
  if (statScope) statConditions.push(statScope);

  const { rows: statRows } = await getDbPool().query<ContractStats>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE hd.trang_thai IN ('Còn hạn', 'Đang thuê'))::int AS active,
       COUNT(*) FILTER (
         WHERE hd.trang_thai IN ('Còn hạn', 'Đang thuê') AND hd.ngay_kt <= now() + interval '30 days'
       )::int AS expiring
     FROM public.hop_dong hd
     LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
     ${statQuery.where(statConditions)}`,
    statQuery.params,
  );

  return {
    contracts: rows,
    stats: statRows[0] ?? { total: 0, active: 0, expiring: 0 },
  };
}

export type InvoiceRow = {
  ma_hoa_don: string;
  ma_hop_dong: string | null;
  ma_phong: string | null;
  ten_khach: string | null;
  tong_tien: string | null;
  tien_phong?: string | null;
  tien_dien_nuoc?: string | null;
  tien_dich_vu_khac?: string | null;
  no_cu?: string | null;
  chi_tiet_khoan_thu?: string | null;
  da_thu: string | null;
  ngay_lap: string | null;
  han_dong_tien: string | null;
  trang_thai: string | null;
  loai_giao_dich: string | null;
};

/** Danh sách hóa đơn kèm số đã thu, tương ứng InvoiceController.Index. */
export async function getInvoices(
  filters: { status?: string; keyword?: string; loaiGiaoDich?: string },
  scope: ScopeQuery,
): Promise<InvoiceRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (filters.status && filters.status !== "All") {
    query.params.push(filters.status);
    conditions.push(`hd.trang_thai = $${query.params.length}`);
  }
  if (filters.loaiGiaoDich && filters.loaiGiaoDich !== "All") {
    if (filters.loaiGiaoDich === "PhatSinh") {
      conditions.push(`hd.loai_giao_dich ILIKE '%phát sinh%'`);
    } else if (filters.loaiGiaoDich === "DinhKy") {
      conditions.push(`(hd.loai_giao_dich IS NULL OR hd.loai_giao_dich NOT ILIKE '%phát sinh%')`);
    }
  }
  if (filters.keyword?.trim()) {
    query.params.push(`%${filters.keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(hd.ma_hoa_don ILIKE $${index} OR hd.ma_hop_dong ILIKE $${index} OR k.ho_ten_khach ILIKE $${index} OR c.ma_phong ILIKE $${index})`,
    );
  }

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<InvoiceRow>(
    `SELECT
       hd.ma_hoa_don,
       hd.ma_hop_dong,
       c.ma_phong,
       k.ho_ten_khach AS ten_khach,
       hd.tong_tien::text AS tong_tien,
       hd.tien_phong::text AS tien_phong,
       hd.tien_dien_nuoc::text AS tien_dien_nuoc,
       hd.tien_dich_vu_khac::text AS tien_dich_vu_khac,
       hd.no_cu::text AS no_cu,
       (
         SELECT string_agg(ct.ten_khoan_thu, ', ')
         FROM public.chi_tiet_hoa_don ct
         WHERE ct.ma_hoa_don = hd.ma_hoa_don
       ) AS chi_tiet_khoan_thu,
       COALESCE((
         SELECT SUM(pt.so_tien_thu) FROM public.phieu_thu pt
         WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')
       ), 0)::text AS da_thu,
       hd.ngay_lap::text AS ngay_lap,
       hd.han_dong_tien::text AS han_dong_tien,
       hd.trang_thai,
       hd.loai_giao_dich
     FROM public.hoa_don hd
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
     ${query.where(conditions)}
     ORDER BY hd.ngay_lap DESC NULLS LAST`,
    query.params,
  );
  return rows;
}

export type InvoiceDetail = {
  ma_hoa_don: string;
  ma_hop_dong: string | null;
  ma_phong: string | null;
  toa_nha: string | null;
  ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  dia_chi_thuong_tru: string | null;
  tong_tien: string | null;
  tien_phong: string | null;
  tien_dien_nuoc: string | null;
  tien_dich_vu_khac: string | null;
  no_cu: string | null;
  da_thu: string;
  con_lai: string;
  ngay_lap: string | null;
  han_dong_tien: string | null;
  trang_thai: string | null;
  loai_giao_dich: string | null;
  ma_ky: string | null;
  chi_tiet: Array<{
    ma_cthd: string;
    ten_khoan_thu: string;
    so_luong: string;
    don_gia: string;
    thanh_tien: string;
  }>;
  phieu_thu: Array<{
    ma_phieu_thu: string;
    ma_tra_cuu: string | null;
    so_tien_thu: string;
    hinh_thuc: string | null;
    ngay_thu: string | null;
    trang_thai: string | null;
  }>;
  chi_so_dien_nuoc?: {
    ma_ky: string;
    thang_nam: string;
    chi_so_dien_cu: string;
    chi_so_dien_moi: string;
    tieu_thu_dien: number;
    chi_so_nuoc_cu: string;
    chi_so_nuoc_moi: string;
    tieu_thu_nuoc: number;
    ngay_ghi_nhan: string | null;
    trang_thai_duyet: string | null;
  } | null;
};

/** Lấy thông tin chi tiết đầy đủ của hóa đơn. */
export async function getInvoiceDetail(
  maHoaDon: string,
  scope: ScopeQuery,
): Promise<InvoiceDetail | null> {
  const query = cloneScope(scope);
  query.params.push(maHoaDon);
  const conditions = [`hd.ma_hoa_don = $${query.params.length}`];

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<{
    ma_hoa_don: string;
    ma_hop_dong: string | null;
    ma_phong: string | null;
    toa_nha: string | null;
    ten_khach: string | null;
    so_dt: string | null;
    cccd: string | null;
    dia_chi_thuong_tru: string | null;
    tong_tien: string | null;
    tien_phong: string | null;
    tien_dien_nuoc: string | null;
    tien_dich_vu_khac: string | null;
    no_cu: string | null;
    ngay_lap: string | null;
    han_dong_tien: string | null;
    trang_thai: string | null;
    loai_giao_dich: string | null;
    ma_ky: string | null;
    da_thu: string;
  }>(
    `SELECT
       hd.ma_hoa_don,
       hd.ma_hop_dong,
       c.ma_phong,
       p.toa_nha,
       k.ho_ten_khach AS ten_khach,
       k.so_dt,
       k.cccd,
       k.dia_chi_thuong_tru,
       hd.tong_tien::text AS tong_tien,
       hd.tien_phong::text AS tien_phong,
       hd.tien_dien_nuoc::text AS tien_dien_nuoc,
       hd.tien_dich_vu_khac::text AS tien_dich_vu_khac,
       hd.no_cu::text AS no_cu,
       hd.ngay_lap::text AS ngay_lap,
       hd.han_dong_tien::text AS han_dong_tien,
       hd.trang_thai,
       hd.loai_giao_dich,
       hd.ma_ky,
       COALESCE((
         SELECT SUM(pt.so_tien_thu)
         FROM public.phieu_thu pt
         WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh')
       ), 0)::text AS da_thu
     FROM public.hoa_don hd
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
     ${query.where(conditions)}
     LIMIT 1`,
    query.params,
  );

  if (rows.length === 0) return null;
  const inv = rows[0];

  const [chiTietResult, receiptResult] = await Promise.all([
    getDbPool().query<{
      ma_cthd: string;
      ten_khoan_thu: string;
      so_luong: string;
      don_gia: string;
      thanh_tien: string;
    }>(
      `SELECT ma_cthd, ten_khoan_thu, so_luong::text, don_gia::text, thanh_tien::text
       FROM public.chi_tiet_hoa_don
       WHERE ma_hoa_don = $1
       ORDER BY ma_cthd ASC`,
      [maHoaDon],
    ),
    getDbPool().query<{
      ma_phieu_thu: string;
      ma_tra_cuu: string | null;
      so_tien_thu: string;
      hinh_thuc: string | null;
      ngay_thu: string | null;
      trang_thai: string | null;
    }>(
      `SELECT ma_phieu_thu, ma_tra_cuu, so_tien_thu::text, hinh_thuc, ngay_thu::text, trang_thai
       FROM public.phieu_thu
       WHERE ma_hoa_don = $1
       ORDER BY ngay_thu DESC NULLS LAST`,
      [maHoaDon],
    ),
  ]);

  let chiSo: InvoiceDetail["chi_so_dien_nuoc"] = null;
  if (inv.ma_ky) {
    const { rows: csRows } = await getDbPool().query<{
      ma_ky: string;
      thang_nam: string;
      chi_so_dien_cu: string;
      chi_so_dien_moi: string;
      chi_so_nuoc_cu: string;
      chi_so_nuoc_moi: string;
      ngay_ghi_nhan: string | null;
      trang_thai_duyet: string | null;
    }>(
      `SELECT ma_ky, thang_nam, chi_so_dien_cu::text, chi_so_dien_moi::text, chi_so_nuoc_cu::text, chi_so_nuoc_moi::text, ngay_ghi_nhan::text, trang_thai_duyet
       FROM public.chi_so_dien_nuoc
       WHERE ma_ky = $1
       LIMIT 1`,
      [inv.ma_ky],
    );
    if (csRows.length > 0) {
      const c = csRows[0];
      const dienCu = Number(c.chi_so_dien_cu || 0);
      const dienMoi = Number(c.chi_so_dien_moi || 0);
      const nuocCu = Number(c.chi_so_nuoc_cu || 0);
      const nuocMoi = Number(c.chi_so_nuoc_moi || 0);
      chiSo = {
        ...c,
        tieu_thu_dien: Math.max(0, dienMoi - dienCu),
        tieu_thu_nuoc: Math.max(0, nuocMoi - nuocCu),
      };
    }
  }

  const daThuNum = Number(inv.da_thu || 0);
  let tongTienNum = Number(inv.tong_tien || 0);
  if (tongTienNum <= 0) {
    const breakdownSum =
      Number(inv.tien_phong || 0) +
      Number(inv.tien_dien_nuoc || 0) +
      Number(inv.tien_dich_vu_khac || 0) +
      Number(inv.no_cu || 0);
    if (breakdownSum > 0) {
      tongTienNum = breakdownSum;
    } else if (chiTietResult.rows.length > 0) {
      tongTienNum = chiTietResult.rows.reduce(
        (sum, item) => sum + Number(item.thanh_tien || 0),
        0,
      );
    }
  }

  const conLaiNum = Math.max(0, tongTienNum - daThuNum);

  return {
    ...inv,
    tong_tien: String(tongTienNum),
    da_thu: String(daThuNum),
    con_lai: String(conLaiNum),
    chi_tiet: chiTietResult.rows,
    phieu_thu: receiptResult.rows,
    chi_so_dien_nuoc: chiSo,
  };
}

export type ReceiptRow = {
  ma_phieu_thu: string;
  ma_hoa_don: string | null;
  ma_phong: string | null;
  toa_nha: string | null;
  ten_khach: string | null;
  so_dt: string | null;
  ma_hop_dong: string | null;
  tong_tien_hoa_don: string | null;
  loai_giao_dich: string | null;
  so_tien_thu: string | null;
  ngay_thu: string | null;
  hinh_thuc: string | null;
  trang_thai: string | null;
  ma_tra_cuu: string | null;
};

/** Danh sách phiếu thu, tương ứng ReceiptController.Index. */
export async function getReceipts(
  filters: { status?: string; invoiceId?: string; keyword?: string },
  scope: ScopeQuery,
): Promise<ReceiptRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (filters.status && filters.status !== "All") {
    query.params.push(filters.status);
    conditions.push(`pt.trang_thai = $${query.params.length}`);
  }
  if (filters.invoiceId) {
    query.params.push(filters.invoiceId);
    conditions.push(`pt.ma_hoa_don = $${query.params.length}`);
  }
  if (filters.keyword?.trim()) {
    query.params.push(`%${filters.keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(pt.ma_phieu_thu ILIKE $${index} OR pt.ma_hoa_don ILIKE $${index} OR pt.ma_tra_cuu ILIKE $${index} OR c.ma_phong ILIKE $${index} OR k.ho_ten_khach ILIKE $${index})`,
    );
  }

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<ReceiptRow>(
    `SELECT
       pt.ma_phieu_thu,
       pt.ma_hoa_don,
       c.ma_phong,
       p.toa_nha,
       k.ho_ten_khach AS ten_khach,
       k.so_dt,
       c.ma_hop_dong,
       hd.tong_tien::text AS tong_tien_hoa_don,
       hd.loai_giao_dich,
       pt.so_tien_thu::text AS so_tien_thu,
       pt.ngay_thu::text AS ngay_thu,
       pt.hinh_thuc,
       pt.trang_thai,
       pt.ma_tra_cuu
     FROM public.phieu_thu pt
     LEFT JOIN public.hoa_don hd ON hd.ma_hoa_don = pt.ma_hoa_don
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
     ${query.where(conditions)}
     ORDER BY pt.ngay_thu DESC NULLS LAST`,
    query.params,
  );
  return rows;
}

export type MeterRow = {
  ma_ky: string;
  thang_nam: string | null;
  ma_hop_dong: string | null;
  ma_phong: string | null;
  ten_khach: string | null;
  chi_so_dien_cu: string | null;
  chi_so_dien_moi: string | null;
  chi_so_nuoc_cu: string | null;
  chi_so_nuoc_moi: string | null;
  dien_tieu_thu: string | null;
  nuoc_tieu_thu: string | null;
  dien_ky_truoc?: string | null;
  nuoc_ky_truoc?: string | null;
  ngay_ghi_nhan: string | null;
  trang_thai_duyet: string | null;
  anh_dien?: string | null;
  anh_nuoc?: string | null;
  trang_thai_phong?: string | null;
  ma_hoa_don?: string | null;
  tien_dien_nuoc?: string | null;
};

/** Danh sách kỳ ghi chỉ số điện nước, tương ứng MeterController.Index. */
export async function getMeterReadings(
  filters: { status?: string; keyword?: string },
  scope: ScopeQuery,
): Promise<MeterRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (filters.status && filters.status !== "All") {
    query.params.push(filters.status);
    conditions.push(`cs.trang_thai_duyet = $${query.params.length}`);
  }
  if (filters.keyword?.trim()) {
    query.params.push(`%${filters.keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(cs.thang_nam ILIKE $${index} OR c.ma_phong ILIKE $${index} OR k.ho_ten_khach ILIKE $${index})`,
    );
  }

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<MeterRow>(
    `SELECT
       cs.ma_ky,
       cs.thang_nam,
       cs.ma_hop_dong,
       c.ma_phong,
       k.ho_ten_khach AS ten_khach,
       cs.chi_so_dien_cu::text AS chi_so_dien_cu,
       cs.chi_so_dien_moi::text AS chi_so_dien_moi,
       cs.chi_so_nuoc_cu::text AS chi_so_nuoc_cu,
       cs.chi_so_nuoc_moi::text AS chi_so_nuoc_moi,
       (COALESCE(cs.chi_so_dien_moi, 0) - COALESCE(cs.chi_so_dien_cu, 0))::text AS dien_tieu_thu,
       (COALESCE(cs.chi_so_nuoc_moi, 0) - COALESCE(cs.chi_so_nuoc_cu, 0))::text AS nuoc_tieu_thu,
       cs.ngay_ghi_nhan::text AS ngay_ghi_nhan,
       cs.trang_thai_duyet,
       cs.anh_dien,
       cs.anh_nuoc,
       p.trang_thai::text AS trang_thai_phong,
       hd_inv.ma_hoa_don,
       hd_inv.tien_dien_nuoc::text AS tien_dien_nuoc,
       (
         SELECT (COALESCE(prev.chi_so_dien_moi, 0) - COALESCE(prev.chi_so_dien_cu, 0))
         FROM public.chi_so_dien_nuoc prev
         WHERE prev.ma_hop_dong = cs.ma_hop_dong
           AND prev.ma_ky <> cs.ma_ky
           AND TO_DATE(prev.thang_nam, CASE WHEN prev.thang_nam LIKE '%/%' THEN 'MM/YYYY' ELSE 'YYYY-MM' END) <
               TO_DATE(cs.thang_nam, CASE WHEN cs.thang_nam LIKE '%/%' THEN 'MM/YYYY' ELSE 'YYYY-MM' END)
         ORDER BY TO_DATE(prev.thang_nam, CASE WHEN prev.thang_nam LIKE '%/%' THEN 'MM/YYYY' ELSE 'YYYY-MM' END) DESC
         LIMIT 1
       )::text AS dien_ky_truoc,
       (
         SELECT (COALESCE(prev.chi_so_nuoc_moi, 0) - COALESCE(prev.chi_so_nuoc_cu, 0))
         FROM public.chi_so_dien_nuoc prev
         WHERE prev.ma_hop_dong = cs.ma_hop_dong
           AND prev.ma_ky <> cs.ma_ky
           AND TO_DATE(prev.thang_nam, CASE WHEN prev.thang_nam LIKE '%/%' THEN 'MM/YYYY' ELSE 'YYYY-MM' END) <
               TO_DATE(cs.thang_nam, CASE WHEN cs.thang_nam LIKE '%/%' THEN 'MM/YYYY' ELSE 'YYYY-MM' END)
         ORDER BY TO_DATE(prev.thang_nam, CASE WHEN prev.thang_nam LIKE '%/%' THEN 'MM/YYYY' ELSE 'YYYY-MM' END) DESC
         LIMIT 1
       )::text AS nuoc_ky_truoc
     FROM public.chi_so_dien_nuoc cs
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = cs.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
     LEFT JOIN public.hoa_don hd_inv ON hd_inv.ma_ky = cs.ma_ky
     ${query.where(conditions)}
     ORDER BY cs.thang_nam DESC NULLS LAST`,
    query.params,
  );
  return rows;
}

export type MeterProgressData = {
  selectedPeriod: string;
  availablePeriods: string[];
  totalRooms: number;
  submitted: number;
  approved: number;
  pending: number;
  rejected: number;
  percentSubmitted: number;
  unsubmittedRooms: Array<{
    ma_phong: string;
    toa_nha: string | null;
    ma_hop_dong: string;
    ten_khach: string | null;
    so_dt: string | null;
  }>;
};

/** Theo dõi tiến độ chốt số theo kỳ ghi chỉ số. */
export async function getMeterClosingProgress(
  targetPeriod: string | null | undefined,
  scope: ScopeQuery,
): Promise<MeterProgressData> {
  const { rows: pRows } = await getDbPool().query<{ thang_nam: string }>(
    `SELECT DISTINCT thang_nam FROM public.chi_so_dien_nuoc ORDER BY thang_nam DESC LIMIT 12`,
  );
  const availablePeriods = pRows.map((r) => r.thang_nam);

  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  if (!availablePeriods.includes(currentMonthStr)) {
    availablePeriods.unshift(currentMonthStr);
  }
  const selectedPeriod =
    targetPeriod && availablePeriods.includes(targetPeriod)
      ? targetPeriod
      : availablePeriods[0] ?? currentMonthStr;

  const query = cloneScope(scope);
  const conditions = [`hd.trang_thai IN ('Còn hạn', 'Đang thuê')`];
  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  query.params.push(selectedPeriod);
  const periodParamIdx = query.params.length;

  const { rows } = await getDbPool().query<{
    ma_hop_dong: string;
    ma_phong: string;
    toa_nha: string | null;
    ten_khach: string | null;
    so_dt: string | null;
    ma_ky: string | null;
    trang_thai_duyet: string | null;
  }>(
    `SELECT
       hd.ma_hop_dong,
       hd.ma_phong,
       p.toa_nha,
       k.ho_ten_khach AS ten_khach,
       k.so_dt,
       cs.ma_ky,
       cs.trang_thai_duyet
     FROM public.hop_dong hd
     JOIN public.phong p ON p.ma_phong = hd.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
     LEFT JOIN public.chi_so_dien_nuoc cs ON cs.ma_hop_dong = hd.ma_hop_dong AND cs.thang_nam = $${periodParamIdx}
     ${query.where(conditions)}
     ORDER BY p.ma_phong ASC`,
    query.params,
  );

  const totalRooms = rows.length;
  let submitted = 0;
  let approved = 0;
  let pending = 0;
  let rejected = 0;
  const unsubmittedRooms: MeterProgressData["unsubmittedRooms"] = [];

  for (const r of rows) {
    if (r.ma_ky) {
      submitted++;
      if (r.trang_thai_duyet === "Đã duyệt") approved++;
      else if (r.trang_thai_duyet === "Từ chối") rejected++;
      else pending++;
    } else {
      unsubmittedRooms.push({
        ma_phong: r.ma_phong,
        toa_nha: r.toa_nha,
        ma_hop_dong: r.ma_hop_dong,
        ten_khach: r.ten_khach,
        so_dt: r.so_dt,
      });
    }
  }

  const percentSubmitted = totalRooms > 0 ? Math.round((submitted / totalRooms) * 100) : 0;

  return {
    selectedPeriod,
    availablePeriods,
    totalRooms,
    submitted,
    approved,
    pending,
    rejected,
    percentSubmitted,
    unsubmittedRooms,
  };
}

export type IssueRow = {
  ma_su_co: string;
  ma_phong: string | null;
  ten_khach_bao: string | null;
  danh_muc: string | null;
  noi_dung: string | null;
  mo_ta: string;
  hinh_anh: string[];
  muc_do_uu_tien: string | null;
  chi_phi_sua_chua: string | null;
  trang_thai: string | null;
  ngay_bao_cao: string | null;
};

/**
 * Tách nội dung sự cố thành phần Mô tả văn bản và Danh sách hình ảnh
 * (Hỗ trợ định dạng JSON từ Mobile App và văn bản thô từ Web Admin)
 */
export function parseIssueContent(rawContent: string | null): {
  moTa: string;
  hinhAnh: string[];
} {
  if (!rawContent || !rawContent.trim()) {
    return { moTa: "-", hinhAnh: [] };
  }

  const trimmed = rawContent.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const moTa =
        parsed.mo_ta ||
        parsed.mota ||
        parsed.noi_dung ||
        parsed.description ||
        "";

      let hinhAnh: string[] = [];
      if (Array.isArray(parsed.hinh_anh)) {
        hinhAnh = parsed.hinh_anh.filter(
          (img: unknown) => typeof img === "string" && img.length > 0,
        );
      } else if (typeof parsed.hinh_anh === "string" && parsed.hinh_anh.length > 0) {
        hinhAnh = [parsed.hinh_anh];
      } else if (Array.isArray(parsed.images)) {
        hinhAnh = parsed.images.filter(
          (img: unknown) => typeof img === "string" && img.length > 0,
        );
      }

      return {
        moTa: moTa || "-",
        hinhAnh,
      };
    } catch {
      return { moTa: trimmed, hinhAnh: [] };
    }
  }

  return { moTa: trimmed, hinhAnh: [] };
}

/** Danh sách sự cố, tương ứng MaintenanceController.Index. */
export async function getIssues(
  filters: { status?: string; keyword?: string },
  scope: ScopeQuery,
): Promise<IssueRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (filters.status && filters.status !== "All") {
    if (filters.status === "Đã hoàn thành") {
      conditions.push(`(sc.trang_thai = 'Đã hoàn thành' OR sc.trang_thai = 'Đã xử lý')`);
    } else {
      query.params.push(filters.status);
      conditions.push(`sc.trang_thai = $${query.params.length}`);
    }
  }
  if (filters.keyword?.trim()) {
    query.params.push(`%${filters.keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(sc.ma_phong ILIKE $${index} OR sc.danh_muc ILIKE $${index} OR sc.noi_dung ILIKE $${index})`,
    );
  }

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<Omit<IssueRow, "mo_ta" | "hinh_anh">>(
    `SELECT
       sc.ma_su_co,
       sc.ma_phong,
       k.ho_ten_khach AS ten_khach_bao,
       sc.danh_muc,
       sc.noi_dung,
       sc.muc_do_uu_tien,
       sc.chi_phi_sua_chua::text AS chi_phi_sua_chua,
       CASE WHEN sc.trang_thai = 'Đã xử lý' THEN 'Đã hoàn thành' ELSE sc.trang_thai END AS trang_thai,
       sc.ngay_bao_cao::text AS ngay_bao_cao
     FROM public.su_co_bao_tri sc
     LEFT JOIN public.phong p ON p.ma_phong = sc.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = sc.ma_khach_bao
     ${query.where(conditions)}
     ORDER BY sc.ngay_bao_cao DESC NULLS LAST`,
    query.params,
  );

  return rows.map((r) => {
    const { moTa, hinhAnh } = parseIssueContent(r.noi_dung);
    return {
      ...r,
      mo_ta: moTa,
      hinh_anh: hinhAnh,
    };
  });
}

export type RoomOption = {
  ma_phong: string;
  ten_hien_thi: string | null;
  gia_thue: string | null;
  tien_dat_coc: string | null;
  toa_nha: string | null;
  trang_thai: string | null;
  noi_that_san_co?: string[] | null;
};

/** Danh sách phòng cho ô chọn kèm giá niêm yết, tiền cọc, tòa nhà và nội thất sẵn có. */
export async function getRoomOptions(
  scope: ScopeQuery,
  options?: { excludeRentedOrReserved?: boolean },
): Promise<RoomOption[]> {
  await autoExpirePendingHolds();
  const query = cloneScope(scope);
  const conditions: string[] = [];
  const scopeWhere = query.condition("toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  if (options?.excludeRentedOrReserved) {
    conditions.push(`trang_thai NOT IN ('Đang thuê', 'Đã đặt cọc', 'Đã cọc')`);
  }

  const { rows } = await getDbPool().query<RoomOption>(
    `SELECT ma_phong, ten_hien_thi, gia_thue::text AS gia_thue, tien_dat_coc::text AS tien_dat_coc, toa_nha, trang_thai, noi_that_san_co
     FROM public.phong
     ${query.where(conditions)}
     ORDER BY ma_phong`,
    query.params,
  );
  return rows;
}

export type TenantOption = {
  ma_khach: string;
  ho_ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
};

/**
 * Danh sách khách thuê cho ô chọn kèm SĐT và CCCD.
 * Với quản lý tòa: chỉ khách thuộc tòa được gán hoặc khách tự do.
 */
export async function getTenantOptions(scope: ScopeQuery): Promise<TenantOption[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];
  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<TenantOption>(
    `SELECT DISTINCT k.ma_khach, k.ho_ten_khach, k.so_dt, k.cccd
     FROM public.khach_thue k
     LEFT JOIN public.hop_dong hd ON hd.ma_khach_dai_dien = k.ma_khach
     LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
     ${query.where(conditions)}
     ORDER BY k.ho_ten_khach`,
    query.params,
  );
  return rows;
}

export type ManagedAccountRow = {
  ma_tai_khoan: string;
  ten_dang_nhap: string | null;
  ho_ten: string | null;
  vai_tro: string | null;
  co_so_van_hanh: string | null;
  trang_thai: string | null;
  da_doi_mat_khau: boolean | null;
  ngay_tao: string | null;
};

/**
 * Danh sách tài khoản cho màn hình quản lý.
 * Chỉ dành cho tài khoản toàn quyền (Admin) — nơi gọi phải tự kiểm tra quyền.
 * Không truy vấn cột `mat_khau` để tránh đưa hash ra khỏi database.
 */
export async function getManagedAccounts(
  keyword: string,
): Promise<ManagedAccountRow[]> {
  const conditions = [`vai_tro IN ('Admin', 'QuanLy')`];
  const params: string[] = [];

  if (keyword.trim()) {
    params.push(`%${keyword.trim()}%`);
    conditions.push(
      `(ten_dang_nhap ILIKE $1 OR ho_ten ILIKE $1 OR co_so_van_hanh ILIKE $1)`,
    );
  }

  const { rows } = await getDbPool().query<ManagedAccountRow>(
    `SELECT ma_tai_khoan, ten_dang_nhap, ho_ten, vai_tro, co_so_van_hanh,
            trang_thai, da_doi_mat_khau, ngay_tao::text AS ngay_tao
     FROM public.tai_khoan
     WHERE ${conditions.join(" AND ")}
     ORDER BY vai_tro, ten_dang_nhap`,
    params,
  );
  return rows;
}

export type ServiceRow = {
  ma_dich_vu: string;
  ten_dich_vu: string | null;
  don_gia: string | null;
  don_vi_tinh: string | null;
  ghi_chu: string | null;
  /** Số kỳ chỉ số đã áp dụng dịch vụ này (để chặn xóa). */
  so_lan_ap_dung: number;
};

/**
 * Bảng giá dịch vụ dùng chung (Rác, Wifi, Gửi xe, Dọn dẹp...).
 * Không giới hạn theo tòa vì đây là danh mục toàn hệ thống.
 */
export async function getServices(): Promise<ServiceRow[]> {
  const { rows } = await getDbPool().query<ServiceRow>(
    `SELECT dv.ma_dich_vu,
            dv.ten_dich_vu,
            dv.don_gia::text AS don_gia,
            dv.don_vi_tinh,
            dv.ghi_chu,
            COALESCE((
              SELECT COUNT(*) FROM public.chi_tiet_dich_vu ct
              WHERE ct.ma_dich_vu = dv.ma_dich_vu
            ), 0)::int AS so_lan_ap_dung
     FROM public.dich_vu dv
     ORDER BY dv.ten_dich_vu`,
  );
  return rows;
}

/**
 * Chi tiết một phòng theo mã, kèm hợp đồng hiệu lực và sự cố đang mở.
 * Trả về null khi không tìm thấy hoặc ngoài phạm vi tòa được phép.
 */
export async function getRoomDetail(
  maPhong: string,
  scope: ScopeQuery,
): Promise<RoomRow | null> {
  await autoExpirePendingHolds();
  const query = cloneScope(scope);
  const conditions = [`p.ma_phong = $1`];
  query.params.push(maPhong);

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<RoomRow>(
    `SELECT
       p.ma_phong,
       p.ten_hien_thi,
       p.tang,
       p.dien_tich,
       p.gia_thue::text AS gia_thue,
       p.tien_dat_coc::text AS tien_dat_coc,
       p.trang_thai,
       p.toa_nha,
       p.ma_loai_phong,
       p.mo_ta_ngan,
       p.noi_that_san_co,
       p.hinh_anh,
       p.chi_so_dien::text AS chi_so_dien,
       p.chi_so_nuoc::text AS chi_so_nuoc,
       p.ngay_cap_nhat_chi_so::text AS ngay_cap_nhat_chi_so,
       lp.ten_loai_phong,
       lp.tien_ich AS loai_phong_tien_ich,
       COALESCE(k.ho_ten_khach, kgc.ho_ten_khach) AS khach_thue,
       gc.trang_thai AS giu_cho_trang_thai,
       gc.expires_at::text AS giu_cho_expires_at,
       h.ngay_kt::text AS ngay_kt,
       sc.danh_muc AS su_co_dang_mo
     FROM public.phong p
     LEFT JOIN public.loai_phong lp ON lp.ma_loai_phong = p.ma_loai_phong
     LEFT JOIN LATERAL (
       SELECT hd.ma_khach_dai_dien, hd.ngay_kt
       FROM public.hop_dong hd
       WHERE hd.ma_phong = p.ma_phong
         AND hd.trang_thai IN ('Còn hạn', 'Đang thuê', 'Đã đặt cọc')
       ORDER BY hd.ngay_bd DESC NULLS LAST
       LIMIT 1
     ) h ON true
     LEFT JOIN public.khach_thue k ON k.ma_khach = h.ma_khach_dai_dien
     LEFT JOIN LATERAL (
       SELECT gc.ma_khach, gc.trang_thai, gc.expires_at
       FROM public.giu_cho gc
       WHERE gc.ma_phong = p.ma_phong AND gc.trang_thai IN ('DangGiu', 'ChoThanhToan', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ', 'Chờ thanh toán')
       ORDER BY gc.thoi_gian_giu_cho DESC
       LIMIT 1
     ) gc ON true
     LEFT JOIN public.khach_thue kgc ON kgc.ma_khach = gc.ma_khach
     LEFT JOIN LATERAL (
       SELECT s.danh_muc
       FROM public.su_co_bao_tri s
       WHERE s.ma_phong = p.ma_phong
         AND s.trang_thai IS DISTINCT FROM 'Đã xử lý'
         AND s.trang_thai IS DISTINCT FROM 'Đã hoàn thành'
       ORDER BY s.ngay_bao_cao DESC NULLS LAST
       LIMIT 1
     ) sc ON true
     ${query.where(conditions)}
     LIMIT 1`,
    query.params,
  );

  return rows[0] ?? null;
}

export type RoomReservationDetail = {
  ma_giu_cho: string;
  ma_phong: string;
  ma_khach: string;
  so_tien_the_chan: string;
  thoi_gian_giu_cho: string;
  ngay_het_han: string;
  ngay_du_kien_o: string | null;
  so_nguoi_o: number | null;
  expires_at: string | null;
  trang_thai: string;
  ghi_chu: string | null;
  ho_ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  dia_chi_thuong_tru: string | null;
};

/** Lấy thông tin phiếu giữ chỗ đang có hiệu lực của phòng (nếu có). */
export async function getActiveRoomReservation(
  maPhong: string,
): Promise<RoomReservationDetail | null> {
  await autoExpirePendingHolds();
  const { rows } = await getDbPool().query<RoomReservationDetail>(
    `SELECT
       gc.ma_giu_cho,
       gc.ma_phong,
       gc.ma_khach,
       gc.so_tien_the_chan::text AS so_tien_the_chan,
       gc.thoi_gian_giu_cho::text AS thoi_gian_giu_cho,
       gc.ngay_het_han::text AS ngay_het_han,
       gc.ngay_du_kien_o::text AS ngay_du_kien_o,
       gc.so_nguoi_o,
       gc.expires_at::text AS expires_at,
       gc.trang_thai,
       gc.ghi_chu,
       k.ho_ten_khach,
       k.so_dt,
       k.cccd,
       k.dia_chi_thuong_tru
     FROM public.giu_cho gc
     JOIN public.khach_thue k ON k.ma_khach = gc.ma_khach
     WHERE gc.ma_phong = $1 AND gc.trang_thai IN ('DangGiu', 'ChoThanhToan', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ', 'Chờ thanh toán')
     ORDER BY gc.thoi_gian_giu_cho DESC
     LIMIT 1`,
    [maPhong],
  );
  return rows[0] ?? null;
}

export type PaidReservationRow = {
  ma_giu_cho: string;
  ma_phong: string;
  ma_khach: string;
  so_tien_the_chan: string;
  thoi_gian_giu_cho: string;
  ngay_het_han: string;
  ngay_du_kien_o: string | null;
  so_nguoi_o: number | null;
  trang_thai: string;
  ghi_chu: string | null;
  ho_ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  dia_chi_thuong_tru: string | null;
  ten_phong: string | null;
  toa_nha: string | null;
  tang: number | null;
  gia_thue: string | null;
  tien_dat_coc: string | null;
};

/**
 * Lấy danh sách các phiếu giữ chỗ đã thanh toán cọc (trang_thai = 'DangGiu' hoặc 'DaThanhToan')
 * đang chờ Ban Quản Lý xác nhận tạo hợp đồng trên Web Admin.
 */
export async function getPaidReservationsPendingContract(
  scope: ScopeQuery,
): Promise<PaidReservationRow[]> {
  await autoExpirePendingHolds();
  const query = cloneScope(scope);
  const conditions = [
    `gc.trang_thai IN ('DangGiu', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ')`,
  ];

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<PaidReservationRow>(
    `SELECT
       gc.ma_giu_cho,
       gc.ma_phong,
       gc.ma_khach,
       gc.so_tien_the_chan::text AS so_tien_the_chan,
       gc.thoi_gian_giu_cho::text AS thoi_gian_giu_cho,
       gc.ngay_het_han::text AS ngay_het_han,
       gc.ngay_du_kien_o::text AS ngay_du_kien_o,
       gc.so_nguoi_o,
       gc.trang_thai,
       gc.ghi_chu,
       k.ho_ten_khach,
       k.so_dt,
       k.cccd,
       k.dia_chi_thuong_tru,
       COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
       p.toa_nha,
       p.tang,
       p.gia_thue::text AS gia_thue,
       p.tien_dat_coc::text AS tien_dat_coc
     FROM public.giu_cho gc
     JOIN public.khach_thue k ON k.ma_khach = gc.ma_khach
     JOIN public.phong p ON p.ma_phong = gc.ma_phong
     ${query.where(conditions)}
     ORDER BY gc.thoi_gian_giu_cho DESC`,
    query.params,
  );
  return rows;
}

export type PendingLiquidationRequest = {
  ma_thanh_ly: string;
  ma_hop_dong: string;
  ma_phong: string;
  ten_phong: string | null;
  toa_nha: string | null;
  ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  ma_tai_khoan: string | null;
  ngay_tra_phong: string;
  ngay_kt_hop_dong: string | null;
  tien_dat_coc: string;
  tien_coc_hoan_lai: string;
  trang_thai: string;
  ghi_chu: string | null;
  so_ngay_con_lai: number;
  hinh_thuc: "Đúng hạn" | "Trước hạn";
  chi_so_dien_gan_nhat: number;
  chi_so_nuoc_gan_nhat: number;
  unpaid_total: number;
};

/**
 * Lấy danh sách các đơn yêu cầu trả phòng / thanh lý hợp đồng gửi từ Mobile App
 * đang chờ Ban Quản Lý duyệt và nghiệm thu (trang_thai = 'CHO_DUYET').
 */
export async function getPendingLiquidationRequests(
  scope: ScopeQuery,
): Promise<PendingLiquidationRequest[]> {
  const query = cloneScope(scope);
  const conditions = [
    `hd.trang_thai IN ('Còn hạn', 'Đang thuê')`,
    `(tl.trang_thai IN ('CHO_DUYET', 'ChoDuyet', 'Chờ duyệt', 'CHO DUYET') OR (tl.trang_thai IS NULL AND tl.ghi_chu LIKE '%[Trạng thái: CHO_DUYET]%'))`,
  ];

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<{
    ma_thanh_ly: string;
    ma_hop_dong: string;
    ngay_tra_phong: string;
    tien_coc_hoan_lai: string;
    ghi_chu: string | null;
    trang_thai: string | null;
    ma_phong: string;
    ten_phong: string | null;
    toa_nha: string | null;
    ten_khach: string | null;
    so_dt: string | null;
    cccd: string | null;
    ma_tai_khoan: string | null;
    ngay_kt_hop_dong: string | null;
    tien_dat_coc: string;
    dien_gan_nhat: string | null;
    nuoc_gan_nhat: string | null;
    unpaid_total: string | null;
  }>(
    `SELECT
       tl.ma_thanh_ly,
       tl.ma_hop_dong,
       tl.ngay_tra_phong::text AS ngay_tra_phong,
       tl.tien_coc_hoan_lai::text AS tien_coc_hoan_lai,
       tl.ghi_chu,
       COALESCE(tl.trang_thai, 'CHO_DUYET') AS trang_thai,
       hd.ma_phong,
       COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
       p.toa_nha,
       k.ho_ten_khach AS ten_khach,
       k.so_dt,
       k.cccd,
       k.ma_tai_khoan,
       hd.ngay_kt::text AS ngay_kt_hop_dong,
       hd.tien_dat_coc::text AS tien_dat_coc,
       (
         SELECT cs.chi_so_dien_moi::text
         FROM public.chi_so_dien_nuoc cs
         WHERE cs.ma_hop_dong = hd.ma_hop_dong
         ORDER BY cs.ngay_ghi_nhan DESC NULLS LAST, cs.ma_ky DESC
         LIMIT 1
       ) AS dien_gan_nhat,
       (
         SELECT cs.chi_so_nuoc_moi::text
         FROM public.chi_so_dien_nuoc cs
         WHERE cs.ma_hop_dong = hd.ma_hop_dong
         ORDER BY cs.ngay_ghi_nhan DESC NULLS LAST, cs.ma_ky DESC
         LIMIT 1
       ) AS nuoc_gan_nhat,
       COALESCE((
         SELECT SUM(COALESCE(inv.tong_tien, 0) - COALESCE(
           (SELECT SUM(pt.so_tien_thu) FROM public.phieu_thu pt WHERE pt.ma_hoa_don = inv.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'), 0)
         )
         FROM public.hoa_don inv
         WHERE inv.ma_hop_dong = hd.ma_hop_dong AND inv.trang_thai NOT IN ('Đã thanh toán', 'Đã hủy')
       ), 0)::text AS unpaid_total
     FROM public.bien_ban_thanh_ly tl
     JOIN public.hop_dong hd ON hd.ma_hop_dong = tl.ma_hop_dong
     JOIN public.phong p ON p.ma_phong = hd.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
     ${query.where(conditions)}
     ORDER BY tl.ngay_tra_phong ASC`,
    query.params,
  );

  return rows.map((r) => {
    let diffDays = 0;
    let isDungHan = false;
    if (r.ngay_kt_hop_dong && r.ngay_tra_phong) {
      const kt = new Date(r.ngay_kt_hop_dong);
      const tra = new Date(r.ngay_tra_phong);
      const dKt = new Date(kt.getFullYear(), kt.getMonth(), kt.getDate()).getTime();
      const dTra = new Date(tra.getFullYear(), tra.getMonth(), tra.getDate()).getTime();
      diffDays = Math.round((dKt - dTra) / (1000 * 60 * 60 * 24));
      isDungHan = diffDays <= 30;
    } else {
      isDungHan = Number(r.tien_coc_hoan_lai) > 0;
    }

    return {
      ma_thanh_ly: r.ma_thanh_ly,
      ma_hop_dong: r.ma_hop_dong,
      ma_phong: r.ma_phong,
      ten_phong: r.ten_phong,
      toa_nha: r.toa_nha,
      ten_khach: r.ten_khach,
      so_dt: r.so_dt,
      cccd: r.cccd,
      ma_tai_khoan: r.ma_tai_khoan,
      ngay_tra_phong: r.ngay_tra_phong,
      ngay_kt_hop_dong: r.ngay_kt_hop_dong,
      tien_dat_coc: r.tien_dat_coc,
      tien_coc_hoan_lai: r.tien_coc_hoan_lai,
      trang_thai: r.trang_thai || "CHO_DUYET",
      ghi_chu: r.ghi_chu,
      so_ngay_con_lai: diffDays,
      hinh_thuc: isDungHan ? ("Đúng hạn" as const) : ("Trước hạn" as const),
      chi_so_dien_gan_nhat: Number(r.dien_gan_nhat) || 0,
      chi_so_nuoc_gan_nhat: Number(r.nuoc_gan_nhat) || 0,
      unpaid_total: Number(r.unpaid_total) || 0,
    };
  });
}

export type PendingRoomTransferRequest = {
  ma_yeu_cau: string;
  ma_hop_dong: string;
  ma_phong_cu: string;
  ten_phong_cu: string | null;
  ma_phong_moi: string;
  ten_phong_moi: string | null;
  toa_nha: string | null;
  ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  ma_tai_khoan: string | null;
  thoi_gian_hen: string;
  ly_do_chuyen: string | null;
  trang_thai_tien_do: string;
  tien_coc_bao_luu: number;
  tien_dien_nuoc_cu: number;
  tien_hu_hai_cu: number;
  tien_phat_sinh: number;
  ghi_chu_hu_hai: string | null;
  ngay_tao: string;
  gia_phong_cu: number;
  gia_phong_moi: number;
  tien_coc_phong_moi: number;
  unpaid_total: number;
};

/**
 * Lấy danh sách các đơn yêu cầu đổi / chuyển phòng gửi từ Mobile App
 * đang chờ Ban Quản Lý phê duyệt và nghiệm thu.
 */
export async function getPendingRoomTransferRequests(
  scope: ScopeQuery,
): Promise<PendingRoomTransferRequest[]> {
  const query = cloneScope(scope);
  const conditions = [
    `y.trang_thai_tien_do::text IN ('Chờ duyệt', 'Đang xử lý', 'Chờ khách xác nhận', 'Đã kiểm tra', 'Khách đã xác nhận', 'Chờ chủ duyệt')`,
    `hd.trang_thai IN ('Còn hạn', 'Đang thuê')`,
  ];

  const scopeWhere = query.condition("p_cu.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<{
    ma_yeu_cau: string;
    ma_hop_dong_ht: string;
    ma_phong_cu: string;
    ten_phong_cu: string | null;
    ma_phong_moi: string;
    ten_phong_moi: string | null;
    toa_nha: string | null;
    ten_khach: string | null;
    so_dt: string | null;
    cccd: string | null;
    ma_tai_khoan: string | null;
    thoi_gian_hen: string;
    ly_do_chuyen: string | null;
    trang_thai_tien_do: string;
    tien_coc_bao_luu: string;
    tien_dien_nuoc_cu: string;
    tien_hu_hai_cu: string;
    tien_phat_sinh: string;
    ghi_chu_hu_hai: string | null;
    ngay_tao: string;
    gia_phong_cu: string | null;
    gia_phong_moi: string | null;
    tien_coc_phong_moi: string | null;
    unpaid_total: string | null;
  }>(
    `SELECT
       y.ma_yeu_cau,
       y.ma_hop_dong_ht,
       y.ma_phong_cu,
       COALESCE(p_cu.ten_hien_thi, p_cu.ma_phong) AS ten_phong_cu,
       y.ma_phong_moi,
       COALESCE(p_moi.ten_hien_thi, p_moi.ma_phong) AS ten_phong_moi,
       p_cu.toa_nha,
       k.ho_ten_khach AS ten_khach,
       k.so_dt,
       k.cccd,
       k.ma_tai_khoan,
       y.thoi_gian_hen::text AS thoi_gian_hen,
       y.ly_do_chuyen,
       COALESCE(y.trang_thai_tien_do::text, 'Chờ duyệt') AS trang_thai_tien_do,
       COALESCE(y.tien_coc_bao_luu, 0)::text AS tien_coc_bao_luu,
       COALESCE(y.tien_dien_nuoc_cu, 0)::text AS tien_dien_nuoc_cu,
       COALESCE(y.tien_hu_hai_cu, 0)::text AS tien_hu_hai_cu,
       COALESCE(y.tien_phat_sinh, 0)::text AS tien_phat_sinh,
       y.ghi_chu_hu_hai,
       y.ngay_tao::text AS ngay_tao,
       hd.gia_thue_thoa_thuan::text AS gia_phong_cu,
       p_moi.gia_thue::text AS gia_phong_moi,
       COALESCE(p_moi.tien_dat_coc, p_moi.gia_thue)::text AS tien_coc_phong_moi,
       COALESCE((
         SELECT SUM(COALESCE(inv.tong_tien, 0) - COALESCE(
           (SELECT SUM(pt.so_tien_thu) FROM public.phieu_thu pt WHERE pt.ma_hoa_don = inv.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'), 0)
         )
         FROM public.hoa_don inv
         WHERE inv.ma_hop_dong = hd.ma_hop_dong AND inv.trang_thai NOT IN ('Đã thanh toán', 'Đã hủy')
       ), 0)::text AS unpaid_total
     FROM public.yeu_cau_chuyen_phong y
     JOIN public.hop_dong hd ON hd.ma_hop_dong = y.ma_hop_dong_ht
     JOIN public.phong p_cu ON p_cu.ma_phong = y.ma_phong_cu
     LEFT JOIN public.phong p_moi ON p_moi.ma_phong = y.ma_phong_moi
     LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
     ${query.where(conditions)}
     ORDER BY y.ngay_tao DESC`,
    query.params,
  );

  return rows.map((r) => ({
    ma_yeu_cau: r.ma_yeu_cau,
    ma_hop_dong: r.ma_hop_dong_ht,
    ma_phong_cu: r.ma_phong_cu,
    ten_phong_cu: r.ten_phong_cu,
    ma_phong_moi: r.ma_phong_moi,
    ten_phong_moi: r.ten_phong_moi,
    toa_nha: r.toa_nha,
    ten_khach: r.ten_khach,
    so_dt: r.so_dt,
    cccd: r.cccd,
    ma_tai_khoan: r.ma_tai_khoan,
    thoi_gian_hen: r.thoi_gian_hen,
    ly_do_chuyen: r.ly_do_chuyen,
    trang_thai_tien_do: r.trang_thai_tien_do,
    tien_coc_bao_luu: Number(r.tien_coc_bao_luu) || 0,
    tien_dien_nuoc_cu: Number(r.tien_dien_nuoc_cu) || 0,
    tien_hu_hai_cu: Number(r.tien_hu_hai_cu) || 0,
    tien_phat_sinh: Number(r.tien_phat_sinh) || 0,
    ghi_chu_hu_hai: r.ghi_chu_hu_hai,
    ngay_tao: r.ngay_tao,
    gia_phong_cu: Number(r.gia_phong_cu) || 0,
    gia_phong_moi: Number(r.gia_phong_moi) || 0,
    tien_coc_phong_moi: Number(r.tien_coc_phong_moi) || 0,
    unpaid_total: Number(r.unpaid_total) || 0,
  }));
}

export type RoomAssetRow = {
  ma_tai_san: string;
  ten_tai_san: string;
  tinh_trang: string;
  ma_phong: string;
  so_luong: number;
  thuong_hieu: string | null;
  so_serial: string | null;
  gia_tri: string | null;
  ghi_chu: string | null;
  ngay_trang_bi: string | null;
};

/** Lấy danh mục tài sản & thiết bị trang bị trong phòng (bảng public.tai_san). */
export async function getRoomAssets(maPhong: string): Promise<RoomAssetRow[]> {
  const { rows } = await getDbPool().query<RoomAssetRow>(
    `SELECT
       ma_tai_san,
       ten_tai_san,
       tinh_trang,
       ma_phong,
       so_luong,
       thuong_hieu,
       so_serial,
       gia_tri::text AS gia_tri,
       ghi_chu,
       ngay_trang_bi::text AS ngay_trang_bi
     FROM public.tai_san
     WHERE ma_phong = $1
     ORDER BY ma_tai_san ASC`,
    [maPhong],
  );
  return rows;
}

export type RoomWithAssetsSummary = {
  ma_phong: string;
  ten_hien_thi: string | null;
  toa_nha: string | null;
  asset_count: number;
};

/** Lấy danh sách các phòng khác đã có tài sản để phục vụ tính năng sao chép. */
export async function getRoomsWithAssets(
  currentRoom: string,
  scope: ScopeQuery,
): Promise<RoomWithAssetsSummary[]> {
  const query = cloneScope(scope);
  const conditions = [`p.ma_phong <> $1`];
  query.params.push(currentRoom);

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<RoomWithAssetsSummary>(
    `SELECT
       p.ma_phong,
       p.ten_hien_thi,
       p.toa_nha,
       COUNT(t.ma_tai_san)::int AS asset_count
     FROM public.phong p
     JOIN public.tai_san t ON t.ma_phong = p.ma_phong
     ${query.where(conditions)}
     GROUP BY p.ma_phong, p.ten_hien_thi, p.toa_nha
     HAVING COUNT(t.ma_tai_san) > 0
     ORDER BY p.toa_nha, p.ma_phong`,
    query.params,
  );
  return rows;
}

export type RoomRentalHistoryRow = {
  ma_hop_dong: string;
  ma_phong: string;
  ma_khach_dai_dien: string | null;
  ho_ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  dia_chi_thuong_tru: string | null;
  ngay_bd: string | null;
  ngay_kt: string | null;
  ngay_ky: string | null;
  gia_thue: string | null;
  tien_dat_coc: string | null;
  chu_ky_thu_tien: number | null;
  trang_thai: string | null;
  so_nguoi_o: number;
};

/**
 * Lịch sử các hợp đồng thuê (cũ và mới) của một phòng.
 * Giới hạn theo quyền tòa nhà được gán (ScopeQuery).
 */
export async function getRoomRentalHistory(
  maPhong: string,
  scope: ScopeQuery,
): Promise<RoomRentalHistoryRow[]> {
  const query = cloneScope(scope);
  const conditions = [`hd.ma_phong = $1`];
  query.params.push(maPhong);

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<RoomRentalHistoryRow>(
    `SELECT
       hd.ma_hop_dong,
       hd.ma_phong,
       hd.ma_khach_dai_dien,
       k.ho_ten_khach,
       k.so_dt,
       k.cccd,
       k.dia_chi_thuong_tru,
       hd.ngay_bd::text AS ngay_bd,
       hd.ngay_kt::text AS ngay_kt,
       hd.ngay_ky::text AS ngay_ky,
       hd.gia_thue_thoa_thuan::text AS gia_thue,
       hd.tien_dat_coc::text AS tien_dat_coc,
       hd.chu_ky_thu_tien,
       hd.trang_thai,
       COALESCE((
         SELECT COUNT(*)::int
         FROM public.chi_tiet_hop_dong_khach_thue ct
         WHERE ct.ma_hop_dong = hd.ma_hop_dong
       ), 1) AS so_nguoi_o
     FROM public.hop_dong hd
     LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
     JOIN public.phong p ON p.ma_phong = hd.ma_phong
     ${query.where(conditions)}
     ORDER BY hd.ngay_bd DESC NULLS LAST, hd.ma_hop_dong DESC`,
    query.params,
  );
  return rows;
}

export type RoomMeterRow = {
  ma_ky: string;
  thang_nam: string | null;
  chi_so_dien_cu: string | null;
  chi_so_dien_moi: string | null;
  chi_so_nuoc_cu: string | null;
  chi_so_nuoc_moi: string | null;
  dien_tieu_thu: string | null;
  nuoc_tieu_thu: string | null;
  ngay_ghi_nhan: string | null;
  trang_thai_duyet: string | null;
  ma_hop_dong: string | null;
  anh_dien: string | null;
  anh_nuoc: string | null;
};

export type RoomLatestInvoiceRow = {
  ma_hoa_don: string;
  ma_hop_dong: string | null;
  ngay_lap: string | null;
  han_dong_tien: string | null;
  tien_phong: string | null;
  tien_dien_nuoc: string | null;
  tien_dich_vu_khac: string | null;
  tong_tien: string | null;
  da_thu: string | null;
  con_no: string | null;
  trang_thai: string | null;
  loai_giao_dich: string | null;
  ky_thang_nam: string | null;
};

export type RoomUtilitySummary = {
  meters: RoomMeterRow[];
  latestInvoice: RoomLatestInvoiceRow | null;
  totalDebt: string;
  unpaidInvoiceCount: number;
};

/**
 * Lấy tóm tắt 3 kỳ chỉ số điện nước gần nhất và hóa đơn phát sinh mới nhất của phòng.
 * Phục vụ xem nhanh công nợ & tiêu thụ khi kiểm tra phòng.
 */
export async function getRoomUtilitySummary(
  maPhong: string,
  scope: ScopeQuery,
): Promise<RoomUtilitySummary> {
  const meterQuery = cloneScope(scope);
  const meterConditions = [`hd.ma_phong = $1`];
  meterQuery.params.push(maPhong);

  const meterScopeWhere = meterQuery.condition("p.toa_nha");
  if (meterScopeWhere) meterConditions.push(meterScopeWhere);

  const invoiceQuery = cloneScope(scope);
  const invoiceConditions = [`c.ma_phong = $1`];
  invoiceQuery.params.push(maPhong);

  const invoiceScopeWhere = invoiceQuery.condition("p.toa_nha");
  if (invoiceScopeWhere) invoiceConditions.push(invoiceScopeWhere);

  const debtQuery = cloneScope(scope);
  const debtConditions = [`c.ma_phong = $1`, `hd.trang_thai <> 'Đã thanh toán'`];
  debtQuery.params.push(maPhong);

  const debtScopeWhere = debtQuery.condition("p.toa_nha");
  if (debtScopeWhere) debtConditions.push(debtScopeWhere);

  const [metersRes, invoicesRes, debtRes] = await Promise.all([
    getDbPool().query<RoomMeterRow>(
      `SELECT
         cs.ma_ky,
         cs.thang_nam,
         cs.chi_so_dien_cu::text AS chi_so_dien_cu,
         cs.chi_so_dien_moi::text AS chi_so_dien_moi,
         cs.chi_so_nuoc_cu::text AS chi_so_nuoc_cu,
         cs.chi_so_nuoc_moi::text AS chi_so_nuoc_moi,
         (COALESCE(cs.chi_so_dien_moi, 0) - COALESCE(cs.chi_so_dien_cu, 0))::text AS dien_tieu_thu,
         (COALESCE(cs.chi_so_nuoc_moi, 0) - COALESCE(cs.chi_so_nuoc_cu, 0))::text AS nuoc_tieu_thu,
         cs.ngay_ghi_nhan::text AS ngay_ghi_nhan,
         cs.trang_thai_duyet,
         cs.ma_hop_dong,
         cs.anh_dien,
         cs.anh_nuoc
       FROM public.chi_so_dien_nuoc cs
       JOIN public.hop_dong hd ON hd.ma_hop_dong = cs.ma_hop_dong
       JOIN public.phong p ON p.ma_phong = hd.ma_phong
       ${meterQuery.where(meterConditions)}
       ORDER BY cs.ngay_ghi_nhan DESC NULLS LAST, cs.thang_nam DESC NULLS LAST
       LIMIT 3`,
      meterQuery.params,
    ),
    getDbPool().query<RoomLatestInvoiceRow>(
      `SELECT
         hd.ma_hoa_don,
         hd.ma_hop_dong,
         hd.ngay_lap::text AS ngay_lap,
         hd.han_dong_tien::text AS han_dong_tien,
         hd.tien_phong::text AS tien_phong,
         hd.tien_dien_nuoc::text AS tien_dien_nuoc,
         hd.tien_dich_vu_khac::text AS tien_dich_vu_khac,
         hd.tong_tien::text AS tong_tien,
         COALESCE((
           SELECT SUM(pt.so_tien_thu)
           FROM public.phieu_thu pt
           WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'
         ), 0)::text AS da_thu,
         (COALESCE(hd.tong_tien, 0) - COALESCE((
           SELECT SUM(pt.so_tien_thu)
           FROM public.phieu_thu pt
           WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'
         ), 0))::text AS con_no,
         hd.trang_thai,
         hd.loai_giao_dich,
         cs.thang_nam AS ky_thang_nam
       FROM public.hoa_don hd
       JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
       JOIN public.phong p ON p.ma_phong = c.ma_phong
       LEFT JOIN public.chi_so_dien_nuoc cs ON cs.ma_ky = hd.ma_ky
       ${invoiceQuery.where(invoiceConditions)}
       ORDER BY hd.ngay_lap DESC NULLS LAST, hd.ma_hoa_don DESC
       LIMIT 1`,
      invoiceQuery.params,
    ),
    getDbPool().query<{ tong_no: string; so_hoa_don_chua_thu: number }>(
      `SELECT
         COALESCE(SUM(
           COALESCE(hd.tong_tien, 0) - COALESCE((
             SELECT SUM(pt.so_tien_thu)
             FROM public.phieu_thu pt
             WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'
           ), 0)
         ), 0)::text AS tong_no,
         COUNT(hd.ma_hoa_don)::int AS so_hoa_don_chua_thu
       FROM public.hoa_don hd
       JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
       JOIN public.phong p ON p.ma_phong = c.ma_phong
       ${debtQuery.where(debtConditions)}`,
      debtQuery.params,
    ),
  ]);

  return {
    meters: metersRes.rows,
    latestInvoice: invoicesRes.rows[0] ?? null,
    totalDebt: debtRes.rows[0]?.tong_no ?? "0",
    unpaidInvoiceCount: debtRes.rows[0]?.so_hoa_don_chua_thu ?? 0,
  };
}

export type ContractDetail = {
  ma_hop_dong: string;
  ma_phong: string | null;
  ma_khach_dai_dien: string | null;
  ngay_bd: string | null;
  ngay_kt: string | null;
  ngay_ky: string | null;
  tien_dat_coc: string | null;
  gia_thue_thoa_thuan: string | null;
  chu_ky_thu_tien: number | null;
  trang_thai: string | null;
  chu_ky_ben_a: string | null;
  chu_ky_ben_b: string | null;
  da_xac_nhan_ban_giao: boolean | null;
  ngay_xac_nhan_ban_giao: string | null;
  /** Thông tin khách đại diện (Bên B). */
  khach_ho_ten: string | null;
  khach_cccd: string | null;
  khach_so_dt: string | null;
  khach_dia_chi: string | null;
  /** Thông tin phòng. */
  phong_ten: string | null;
  phong_toa: string | null;
  phong_tang: number | null;
  phong_dien_tich: number | null;
  phong_loai: string | null;
};

export type ContractOccupant = {
  ma_khach: string;
  ho_ten_khach: string | null;
  cccd: string | null;
  so_dt: string | null;
  ma_tai_khoan?: string | null;
  vai_tro: string | null;
  ngay_vao_o: string | null;
  trang_thai_luu_tru: string | null;
};

export type ContractAppendix = {
  ma_phu_luc: string;
  ngay_lap: string | null;
  ngay_gia_han_den: string | null;
  gia_thue_moi: string | null;
  chenh_lech_tien_coc: string | null;
  ma_phong_moi: string | null;
  noi_dung_dieu_chinh: string | null;
  trang_thai: string | null;
};

export type ContractInvoice = {
  ma_hoa_don: string;
  tong_tien: string | null;
  da_thu: string | null;
  ngay_lap: string | null;
  han_dong_tien: string | null;
  trang_thai: string | null;
};

export type LiquidationRow = {
  ma_thanh_ly: string;
  ma_hop_dong: string;
  ngay_tra_phong: string;
  chi_so_dien_cuoi: string;
  chi_so_nuoc_cuoi: string;
  tien_coc_hoan_lai: string;
  tien_kh_tra_them: string | null;
  ghi_chu: string | null;
  trang_thai: string | null;
};

export type ContractDetailBundle = {
  hopDong: ContractDetail;
  nguoiO: ContractOccupant[];
  phuLuc: ContractAppendix[];
  hoaDon: ContractInvoice[];
  bienBanThanhLy: LiquidationRow | null;
  chiSoGanNhat: { dien: number; nuoc: number } | null;
  yeuCauChuyenPhong: PendingRoomTransferRequest | null;
};

/**
 * Toàn bộ dữ liệu của một hợp đồng: thông tin chính, người ở cùng,
 * phụ lục đã lập và hóa đơn liên quan.
 * Trả về null khi không tìm thấy hoặc ngoài phạm vi tòa được phép.
 */
export async function getContractDetail(
  maHopDong: string,
  scope: ScopeQuery,
): Promise<ContractDetailBundle | null> {
  const query = cloneScope(scope);
  const conditions = [`hd.ma_hop_dong = $1`];
  query.params.push(maHopDong);

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<ContractDetail>(
    `SELECT
       hd.ma_hop_dong,
       hd.ma_phong,
       hd.ma_khach_dai_dien,
       hd.ngay_bd::text AS ngay_bd,
       hd.ngay_kt::text AS ngay_kt,
       hd.ngay_ky::text AS ngay_ky,
       hd.tien_dat_coc::text AS tien_dat_coc,
       hd.gia_thue_thoa_thuan::text AS gia_thue_thoa_thuan,
       hd.chu_ky_thu_tien,
       hd.trang_thai,
       hd.chu_ky_ben_a,
       hd.chu_ky_ben_b,
       hd.da_xac_nhan_ban_giao,
       hd.ngay_xac_nhan_ban_giao::text AS ngay_xac_nhan_ban_giao,
       k.ho_ten_khach AS khach_ho_ten,
       k.cccd AS khach_cccd,
       k.so_dt AS khach_so_dt,
       k.dia_chi_thuong_tru AS khach_dia_chi,
       COALESCE(p.ten_hien_thi, p.ma_phong) AS phong_ten,
       p.toa_nha AS phong_toa,
       p.tang AS phong_tang,
       p.dien_tich AS phong_dien_tich,
       lp.ten_loai_phong AS phong_loai
     FROM public.hop_dong hd
     LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
     LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
     LEFT JOIN public.loai_phong lp ON lp.ma_loai_phong = p.ma_loai_phong
     ${query.where(conditions)}
     LIMIT 1`,
    query.params,
  );

  const hopDong = rows[0];
  if (!hopDong) return null;

  const [nguoiO, phuLuc, hoaDon, thanhLy, chiSo, chuyenPhong] = await Promise.all([
    getDbPool().query<ContractOccupant>(
      `SELECT k.ma_khach,
              k.ho_ten_khach,
              k.cccd,
              k.so_dt,
              k.ma_tai_khoan,
              c.vai_tro,
              c.ngay_vao_o::text AS ngay_vao_o,
              c.trang_thai_luu_tru
       FROM public.chi_tiet_hop_dong_khach_thue c
       LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach
       WHERE c.ma_hop_dong = $1
       ORDER BY c.vai_tro NULLS LAST, k.ho_ten_khach`,
      [maHopDong],
    ),
    getDbPool().query<ContractAppendix>(
      `SELECT ma_phu_luc,
              ngay_lap::text AS ngay_lap,
              ngay_gia_han_den::text AS ngay_gia_han_den,
              gia_thue_moi::text AS gia_thue_moi,
              chenh_lech_tien_coc::text AS chenh_lech_tien_coc,
              ma_phong_moi,
              noi_dung_dieu_chinh,
              trang_thai
       FROM public.phu_luc_hop_dong
       WHERE ma_hop_dong = $1
       ORDER BY ngay_lap DESC NULLS LAST`,
      [maHopDong],
    ),
    getDbPool().query<ContractInvoice>(
      `SELECT hd.ma_hoa_don,
              hd.tong_tien::text AS tong_tien,
              COALESCE((
                SELECT SUM(pt.so_tien_thu) FROM public.phieu_thu pt
                WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'
              ), 0)::text AS da_thu,
              hd.ngay_lap::text AS ngay_lap,
              hd.han_dong_tien::text AS han_dong_tien,
              hd.trang_thai
       FROM public.hoa_don hd
       WHERE hd.ma_hop_dong = $1
       ORDER BY hd.ngay_lap DESC NULLS LAST`,
      [maHopDong],
    ),
    getDbPool().query<LiquidationRow>(
      `SELECT ma_thanh_ly,
              ma_hop_dong,
              ngay_tra_phong::text AS ngay_tra_phong,
              chi_so_dien_cuoi::text AS chi_so_dien_cuoi,
              chi_so_nuoc_cuoi::text AS chi_so_nuoc_cuoi,
              tien_coc_hoan_lai::text AS tien_coc_hoan_lai,
              tien_kh_tra_them::text AS tien_kh_tra_them,
              ghi_chu,
              COALESCE(trang_thai, CASE
                WHEN ghi_chu LIKE '%[Trạng thái: DA_DUYET]%' THEN 'DA_DUYET'
                WHEN ghi_chu LIKE '%[Trạng thái: TU_CHOI]%' THEN 'TU_CHOI'
                ELSE 'CHO_DUYET'
              END) AS trang_thai
       FROM public.bien_ban_thanh_ly
       WHERE ma_hop_dong = $1
       ORDER BY ngay_tra_phong DESC
       LIMIT 1`,
      [maHopDong],
    ),
    getDbPool().query<{ dien: number; nuoc: number }>(
      `SELECT chi_so_dien_moi::numeric AS dien, chi_so_nuoc_moi::numeric AS nuoc
       FROM public.chi_so_dien_nuoc
       WHERE ma_hop_dong = $1
       ORDER BY ngay_ghi_nhan DESC NULLS LAST, ma_ky DESC
       LIMIT 1`,
      [maHopDong],
    ),
    getDbPool().query<{
      ma_yeu_cau: string;
      ma_hop_dong_ht: string;
      ma_phong_cu: string;
      ten_phong_cu: string | null;
      ma_phong_moi: string;
      ten_phong_moi: string | null;
      toa_nha: string | null;
      ten_khach: string | null;
      so_dt: string | null;
      cccd: string | null;
      ma_tai_khoan: string | null;
      thoi_gian_hen: string;
      ly_do_chuyen: string | null;
      trang_thai_tien_do: string;
      tien_coc_bao_luu: string;
      tien_dien_nuoc_cu: string;
      tien_hu_hai_cu: string;
      tien_phat_sinh: string;
      ghi_chu_hu_hai: string | null;
      ngay_tao: string;
      gia_phong_cu: string | null;
      gia_phong_moi: string | null;
      tien_coc_phong_moi: string | null;
      unpaid_total: string | null;
    }>(
      `SELECT
         y.ma_yeu_cau,
         y.ma_hop_dong_ht,
         y.ma_phong_cu,
         COALESCE(p_cu.ten_hien_thi, p_cu.ma_phong) AS ten_phong_cu,
         y.ma_phong_moi,
         COALESCE(p_moi.ten_hien_thi, p_moi.ma_phong) AS ten_phong_moi,
         p_cu.toa_nha,
         k.ho_ten_khach AS ten_khach,
         k.so_dt,
         k.cccd,
         k.ma_tai_khoan,
         y.thoi_gian_hen::text AS thoi_gian_hen,
         y.ly_do_chuyen,
         COALESCE(y.trang_thai_tien_do::text, 'Chờ duyệt') AS trang_thai_tien_do,
         COALESCE(y.tien_coc_bao_luu, 0)::text AS tien_coc_bao_luu,
         COALESCE(y.tien_dien_nuoc_cu, 0)::text AS tien_dien_nuoc_cu,
         COALESCE(y.tien_hu_hai_cu, 0)::text AS tien_hu_hai_cu,
         COALESCE(y.tien_phat_sinh, 0)::text AS tien_phat_sinh,
         y.ghi_chu_hu_hai,
         y.ngay_tao::text AS ngay_tao,
         hd.gia_thue_thoa_thuan::text AS gia_phong_cu,
         p_moi.gia_thue::text AS gia_phong_moi,
         COALESCE(p_moi.tien_dat_coc, p_moi.gia_thue)::text AS tien_coc_phong_moi,
         COALESCE((
           SELECT SUM(COALESCE(inv.tong_tien, 0) - COALESCE(
             (SELECT SUM(pt.so_tien_thu) FROM public.phieu_thu pt WHERE pt.ma_hoa_don = inv.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'), 0)
           )
           FROM public.hoa_don inv
           WHERE inv.ma_hop_dong = hd.ma_hop_dong AND inv.trang_thai NOT IN ('Đã thanh toán', 'Đã hủy')
         ), 0)::text AS unpaid_total
       FROM public.yeu_cau_chuyen_phong y
       JOIN public.hop_dong hd ON hd.ma_hop_dong = y.ma_hop_dong_ht
       JOIN public.phong p_cu ON p_cu.ma_phong = y.ma_phong_cu
       LEFT JOIN public.phong p_moi ON p_moi.ma_phong = y.ma_phong_moi
       LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
       WHERE y.ma_hop_dong_ht = $1
       ORDER BY y.ngay_tao DESC
       LIMIT 1`,
      [maHopDong],
    ),
  ]);

  const cpRow = chuyenPhong.rows[0];
  const yeuCauChuyenPhong: PendingRoomTransferRequest | null = cpRow
    ? {
        ma_yeu_cau: cpRow.ma_yeu_cau,
        ma_hop_dong: cpRow.ma_hop_dong_ht,
        ma_phong_cu: cpRow.ma_phong_cu,
        ten_phong_cu: cpRow.ten_phong_cu,
        ma_phong_moi: cpRow.ma_phong_moi,
        ten_phong_moi: cpRow.ten_phong_moi,
        toa_nha: cpRow.toa_nha,
        ten_khach: cpRow.ten_khach,
        so_dt: cpRow.so_dt,
        cccd: cpRow.cccd,
        ma_tai_khoan: cpRow.ma_tai_khoan,
        thoi_gian_hen: cpRow.thoi_gian_hen,
        ly_do_chuyen: cpRow.ly_do_chuyen,
        trang_thai_tien_do: cpRow.trang_thai_tien_do,
        tien_coc_bao_luu: Number(cpRow.tien_coc_bao_luu) || 0,
        tien_dien_nuoc_cu: Number(cpRow.tien_dien_nuoc_cu) || 0,
        tien_hu_hai_cu: Number(cpRow.tien_hu_hai_cu) || 0,
        tien_phat_sinh: Number(cpRow.tien_phat_sinh) || 0,
        ghi_chu_hu_hai: cpRow.ghi_chu_hu_hai,
        ngay_tao: cpRow.ngay_tao,
        gia_phong_cu: Number(cpRow.gia_phong_cu) || 0,
        gia_phong_moi: Number(cpRow.gia_phong_moi) || 0,
        tien_coc_phong_moi: Number(cpRow.tien_coc_phong_moi) || 0,
        unpaid_total: Number(cpRow.unpaid_total) || 0,
      }
    : null;

  return {
    hopDong,
    nguoiO: nguoiO.rows,
    phuLuc: phuLuc.rows,
    hoaDon: hoaDon.rows,
    bienBanThanhLy: thanhLy.rows[0] ?? null,
    chiSoGanNhat: chiSo.rows[0] ? { dien: Number(chiSo.rows[0].dien), nuoc: Number(chiSo.rows[0].nuoc) } : null,
    yeuCauChuyenPhong,
  };
}
