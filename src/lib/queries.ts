import "server-only";
import { getDbPool } from "@/lib/db";
import { ScopeQuery } from "@/lib/scope";

export const ALL_BUILDINGS = "all";

export type DashboardStats = {
  tongPhong: number;
  dangThue: number;
  phongTrong: number;
  suCo: number;
  tyLeLapDay: number;
};

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
  }>(
    `SELECT
       COUNT(*)::int AS tong_phong,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Đang thuê')::int AS dang_thue,
       COUNT(*) FILTER (WHERE p.trang_thai = 'Trống')::int AS phong_trong
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

  return {
    tongPhong,
    dangThue,
    phongTrong,
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
  ten_loai_phong: string | null;
  khach_thue: string | null;
  ngay_kt: string | null;
};

export type RoomFilters = {
  building?: string;
  status?: string;
  keyword?: string;
  scope: ScopeQuery;
};

/** Danh sách phòng kèm hợp đồng hiệu lực, tương ứng RoomController.Index. */
export async function getRooms(filters: RoomFilters): Promise<RoomRow[]> {
  const query = cloneScope(filters.scope);
  const conditions: string[] = [];

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  if (filters.building && filters.building !== ALL_BUILDINGS) {
    query.params.push(filters.building);
    conditions.push(`p.toa_nha = $${query.params.length}`);
  }

  if (filters.status === "DangThue") conditions.push(`p.trang_thai = 'Đang thuê'`);
  else if (filters.status === "Trong") conditions.push(`p.trang_thai = 'Trống'`);
  else if (filters.status === "SuaChua") conditions.push(`p.trang_thai = 'Sửa chữa'`);

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
       lp.ten_loai_phong,
       k.ho_ten_khach AS khach_thue,
       h.ngay_kt::text AS ngay_kt
     FROM public.phong p
     LEFT JOIN public.loai_phong lp ON lp.ma_loai_phong = p.ma_loai_phong
     LEFT JOIN LATERAL (
       SELECT hd.ma_khach_dai_dien, hd.ngay_kt
       FROM public.hop_dong hd
       WHERE hd.ma_phong = p.ma_phong
         AND hd.trang_thai IN ('Còn hạn', 'Đang thuê', 'Đã cọc')
       ORDER BY hd.ngay_bd DESC NULLS LAST
       LIMIT 1
     ) h ON true
     LEFT JOIN public.khach_thue k ON k.ma_khach = h.ma_khach_dai_dien
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

/** Danh mục loại phòng cho các ô chọn. */
export async function getRoomTypes(): Promise<{ ma_loai_phong: string; ten_loai_phong: string }[]> {
  const { rows } = await getDbPool().query<{ ma_loai_phong: string; ten_loai_phong: string }>(
    `SELECT ma_loai_phong, ten_loai_phong FROM public.loai_phong ORDER BY ten_loai_phong`,
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

export type TenantRow = {
  ma_khach: string;
  ho_ten_khach: string | null;
  so_dt: string | null;
  cccd: string | null;
  dia_chi_thuong_tru: string | null;
  ma_phong_hien_tai: string | null;
};

/**
 * Danh sách khách thuê, tương ứng TenantController.Index.
 * Với quản lý tòa: chỉ thấy khách có hợp đồng ở phòng thuộc tòa được gán.
 */
export async function getTenants(keyword: string, scope: ScopeQuery): Promise<TenantRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (keyword.trim()) {
    query.params.push(`%${keyword.trim()}%`);
    const index = query.params.length;
    conditions.push(
      `(k.ho_ten_khach ILIKE $${index} OR k.cccd ILIKE $${index} OR k.so_dt ILIKE $${index})`,
    );
  }

  const scopeWhere = query.scopedExists(
    `SELECT 1 FROM public.hop_dong hd_scope
     JOIN public.phong p_scope ON p_scope.ma_phong = hd_scope.ma_phong
     WHERE hd_scope.ma_khach_dai_dien = k.ma_khach`,
  );
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<TenantRow>(
    `SELECT
       k.ma_khach,
       k.ho_ten_khach,
       k.so_dt,
       k.cccd,
       k.dia_chi_thuong_tru,
       (SELECT hd.ma_phong FROM public.hop_dong hd
        JOIN public.phong p ON p.ma_phong = hd.ma_phong
        WHERE hd.ma_khach_dai_dien = k.ma_khach
          AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
        ORDER BY hd.ngay_bd DESC NULLS LAST
        LIMIT 1) AS ma_phong_hien_tai
     FROM public.khach_thue k
     ${query.where(conditions)}
     ORDER BY k.ho_ten_khach`,
    query.params,
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

  if (filters.status && filters.status !== ALL_BUILDINGS && filters.status !== "All") {
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
};

/** Hợp đồng còn hiệu lực để chọn khi tạo chứng từ, giới hạn theo quyền. */
export async function getActiveContracts(scope: ScopeQuery): Promise<ContractOption[]> {
  const query = cloneScope(scope);
  const conditions = [`hd.trang_thai IN ('Còn hạn', 'Đang thuê')`];
  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<ContractOption>(
    `SELECT hd.ma_hop_dong, hd.ma_phong, k.ho_ten_khach AS ten_khach, hd.trang_thai
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
  ten_khach: string | null;
  ngay_bd: string | null;
  ngay_kt: string | null;
  tien_dat_coc: string | null;
  gia_thue_thoa_thuan: string | null;
  chu_ky_thu_tien: number | null;
  trang_thai: string | null;
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
       k.ho_ten_khach AS ten_khach,
       hd.ngay_bd::text AS ngay_bd,
       hd.ngay_kt::text AS ngay_kt,
       hd.tien_dat_coc::text AS tien_dat_coc,
       hd.gia_thue_thoa_thuan::text AS gia_thue_thoa_thuan,
       hd.chu_ky_thu_tien,
       hd.trang_thai
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
  da_thu: string | null;
  ngay_lap: string | null;
  han_dong_tien: string | null;
  trang_thai: string | null;
  loai_giao_dich: string | null;
};

/** Danh sách hóa đơn kèm số đã thu, tương ứng InvoiceController.Index. */
export async function getInvoices(
  filters: { status?: string; keyword?: string },
  scope: ScopeQuery,
): Promise<InvoiceRow[]> {
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
      `(hd.ma_hoa_don ILIKE $${index} OR hd.ma_hop_dong ILIKE $${index} OR k.ho_ten_khach ILIKE $${index})`,
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
       COALESCE((
         SELECT SUM(pt.so_tien_thu) FROM public.phieu_thu pt
         WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai = 'Đã xác nhận'
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

export type ReceiptRow = {
  ma_phieu_thu: string;
  ma_hoa_don: string | null;
  ma_phong: string | null;
  so_tien_thu: string | null;
  ngay_thu: string | null;
  hinh_thuc: string | null;
  trang_thai: string | null;
  ma_tra_cuu: string | null;
};

/** Danh sách phiếu thu, tương ứng ReceiptController.Index. */
export async function getReceipts(
  filters: { status?: string; invoiceId?: string },
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

  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<ReceiptRow>(
    `SELECT
       pt.ma_phieu_thu,
       pt.ma_hoa_don,
       c.ma_phong,
       pt.so_tien_thu::text AS so_tien_thu,
       pt.ngay_thu::text AS ngay_thu,
       pt.hinh_thuc,
       pt.trang_thai,
       pt.ma_tra_cuu
     FROM public.phieu_thu pt
     LEFT JOIN public.hoa_don hd ON hd.ma_hoa_don = pt.ma_hoa_don
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
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
  ngay_ghi_nhan: string | null;
  trang_thai_duyet: string | null;
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
       cs.trang_thai_duyet
     FROM public.chi_so_dien_nuoc cs
     LEFT JOIN public.hop_dong c ON c.ma_hop_dong = cs.ma_hop_dong
     LEFT JOIN public.phong p ON p.ma_phong = c.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = c.ma_khach_dai_dien
     ${query.where(conditions)}
     ORDER BY cs.thang_nam DESC NULLS LAST`,
    query.params,
  );
  return rows;
}

export type IssueRow = {
  ma_su_co: string;
  ma_phong: string | null;
  ten_khach_bao: string | null;
  danh_muc: string | null;
  noi_dung: string | null;
  muc_do_uu_tien: string | null;
  chi_phi_sua_chua: string | null;
  trang_thai: string | null;
  ngay_bao_cao: string | null;
};

/** Danh sách sự cố, tương ứng MaintenanceController.Index. */
export async function getIssues(
  filters: { status?: string; keyword?: string },
  scope: ScopeQuery,
): Promise<IssueRow[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];

  if (filters.status && filters.status !== "All") {
    query.params.push(filters.status);
    conditions.push(`sc.trang_thai = $${query.params.length}`);
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

  const { rows } = await getDbPool().query<IssueRow>(
    `SELECT
       sc.ma_su_co,
       sc.ma_phong,
       k.ho_ten_khach AS ten_khach_bao,
       sc.danh_muc,
       sc.noi_dung,
       sc.muc_do_uu_tien,
       sc.chi_phi_sua_chua::text AS chi_phi_sua_chua,
       sc.trang_thai,
       sc.ngay_bao_cao::text AS ngay_bao_cao
     FROM public.su_co_bao_tri sc
     LEFT JOIN public.phong p ON p.ma_phong = sc.ma_phong
     LEFT JOIN public.khach_thue k ON k.ma_khach = sc.ma_khach_bao
     ${query.where(conditions)}
     ORDER BY sc.ngay_bao_cao DESC NULLS LAST`,
    query.params,
  );
  return rows;
}

/** Danh sách phòng cho ô chọn (mã phòng + tên hiển thị), giới hạn theo quyền. */
export async function getRoomOptions(
  scope: ScopeQuery,
): Promise<{ ma_phong: string; ten_hien_thi: string | null }[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];
  const scopeWhere = query.condition("toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<{ ma_phong: string; ten_hien_thi: string | null }>(
    `SELECT ma_phong, ten_hien_thi FROM public.phong
     ${query.where(conditions)}
     ORDER BY ma_phong`,
    query.params,
  );
  return rows;
}

/**
 * Danh sách khách thuê cho ô chọn.
 * Với quản lý tòa: chỉ khách thuộc tòa được gán (có hợp đồng ở phòng trong tòa đó).
 */
export async function getTenantOptions(
  scope: ScopeQuery,
): Promise<{ ma_khach: string; ho_ten_khach: string | null }[]> {
  const query = cloneScope(scope);
  const conditions: string[] = [];
  const scopeWhere = query.condition("p.toa_nha");
  if (scopeWhere) conditions.push(scopeWhere);

  const { rows } = await getDbPool().query<{ ma_khach: string; ho_ten_khach: string | null }>(
    `SELECT DISTINCT k.ma_khach, k.ho_ten_khach
     FROM public.khach_thue k
     LEFT JOIN public.hop_dong hd ON hd.ma_khach_dai_dien = k.ma_khach
     LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
     ${query.where(conditions)}
     ORDER BY k.ho_ten_khach`,
    query.params,
  );
  return rows;
}
