import { NextResponse } from "next/server";
import { getCurrentAccount, getAccessScope } from "@/lib/session";
import { getDbPool } from "@/lib/db";

export type NotificationItem = {
  id: string;
  type: "hold" | "issue" | "invoice" | "transfer" | "liquidation" | "meter" | "extension";
  title: string;
  description: string;
  time: string | null;
  link: string;
};

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getDbPool();
    const scope = getAccessScope(account);

    const [
      holdsResult,
      issuesResult,
      invoicesResult,
      transfersResult,
      liquidationsResult,
      meterResult,
      extensionRequestsResult,
      expiringContractsResult,
    ] = await Promise.all([
      // 1. Cọc giữ chỗ chờ xử lý
      pool.query<{
        ma_giu_cho: string;
        ma_phong: string | null;
        so_tien_the_chan: string;
        thoi_gian_giu_cho: string | null;
        ho_ten_khach: string | null;
      }>(
        `SELECT gc.ma_giu_cho, gc.ma_phong, gc.so_tien_the_chan::text AS so_tien_the_chan,
                gc.thoi_gian_giu_cho::text AS thoi_gian_giu_cho, k.ho_ten_khach
         FROM public.giu_cho gc
         LEFT JOIN public.khach_thue k ON k.ma_khach = gc.ma_khach
         WHERE gc.trang_thai IN ('DangGiu', 'DaThanhToan', 'Đã thanh toán', 'Đang giữ')
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = gc.ma_phong AND p_scope.toa_nha = $2))
         ORDER BY gc.thoi_gian_giu_cho DESC
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),

      // 2. Sự cố báo hỏng chưa hoàn thành
      pool.query<{
        ma_su_co: string;
        ma_phong: string | null;
        noi_dung: string | null;
        danh_muc: string | null;
        muc_do_uu_tien: string | null;
        ngay_bao_cao: string | null;
      }>(
        `SELECT sc.ma_su_co, sc.ma_phong, sc.noi_dung, sc.danh_muc, sc.muc_do_uu_tien,
                sc.ngay_bao_cao::text AS ngay_bao_cao
         FROM public.su_co_bao_tri sc
         WHERE sc.trang_thai IS DISTINCT FROM 'Đã xử lý' AND sc.trang_thai IS DISTINCT FROM 'Đã hoàn thành'
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = sc.ma_phong AND p_scope.toa_nha = $2))
         ORDER BY sc.ngay_bao_cao DESC NULLS LAST
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),

      // 3. Hóa đơn chưa thanh toán
      pool.query<{
        ma_hoa_don: string;
        ma_phong: string | null;
        han_dong_tien: string | null;
        tong_tien: string;
        da_thu: string;
      }>(
        `WITH inv_calc AS (
           SELECT
             hd.ma_hoa_don,
             c.ma_phong,
             hd.han_dong_tien,
             COALESCE(
               NULLIF(hd.tong_tien, 0),
               (COALESCE(hd.tien_phong, 0) + COALESCE(hd.tien_dien_nuoc, 0) + COALESCE(hd.tien_dich_vu_khac, 0) + COALESCE(hd.no_cu, 0))
             ) AS tong_tien,
             COALESCE((
               SELECT SUM(pt.so_tien_thu)
               FROM public.phieu_thu pt
               WHERE pt.ma_hoa_don = hd.ma_hoa_don AND pt.trang_thai IN ('Đã xác nhận', 'Đã khớp lệnh', 'Đã thanh toán')
             ), 0) AS da_thu
           FROM public.hoa_don hd
           LEFT JOIN public.hop_dong c ON c.ma_hop_dong = hd.ma_hop_dong
           WHERE hd.trang_thai NOT IN ('Đã thanh toán', 'Đã hủy')
         )
         SELECT
           ma_hoa_don,
           ma_phong,
           han_dong_tien::text AS han_dong_tien,
           tong_tien::text AS tong_tien,
           da_thu::text AS da_thu
         FROM inv_calc
         WHERE (tong_tien - da_thu) > 0
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = inv_calc.ma_phong AND p_scope.toa_nha = $2))
         ORDER BY han_dong_tien ASC NULLS LAST
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),

      // 4. Yêu cầu đổi / chuyển phòng từ Mobile App
      pool.query<{
        ma_yeu_cau: string;
        ma_hop_dong_ht: string;
        ma_phong_cu: string;
        ten_phong_cu: string | null;
        ma_phong_moi: string;
        ten_phong_moi: string | null;
        ho_ten_khach: string | null;
        thoi_gian_hen: string | null;
        ngay_tao: string | null;
        ly_do_chuyen: string | null;
      }>(
        `SELECT
           y.ma_yeu_cau,
           y.ma_hop_dong_ht,
           y.ma_phong_cu,
           COALESCE(p_cu.ten_hien_thi, p_cu.ma_phong) AS ten_phong_cu,
           y.ma_phong_moi,
           COALESCE(p_moi.ten_hien_thi, p_moi.ma_phong) AS ten_phong_moi,
           k.ho_ten_khach,
           y.thoi_gian_hen::text AS thoi_gian_hen,
           y.ngay_tao::text AS ngay_tao,
           y.ly_do_chuyen
         FROM public.yeu_cau_chuyen_phong y
         JOIN public.hop_dong hd ON hd.ma_hop_dong = y.ma_hop_dong_ht
         JOIN public.phong p_cu ON p_cu.ma_phong = y.ma_phong_cu
         LEFT JOIN public.phong p_moi ON p_moi.ma_phong = y.ma_phong_moi
         LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
         WHERE y.trang_thai_tien_do::text IN ('Chờ duyệt', 'Đang xử lý', 'Chờ khách xác nhận', 'Đã kiểm tra', 'Khách đã xác nhận', 'Chờ chủ duyệt')
           AND hd.trang_thai IN ('Còn hạn', 'Đang thuê')
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = y.ma_phong_cu AND p_scope.toa_nha = $2))
         ORDER BY y.ngay_tao DESC
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),

      // 5. Yêu cầu trả phòng / thanh lý hợp đồng từ Mobile App
      pool.query<{
        ma_thanh_ly: string;
        ma_hop_dong: string;
        ma_phong: string;
        ten_phong: string | null;
        ho_ten_khach: string | null;
        ngay_tra_phong: string | null;
        ghi_chu: string | null;
      }>(
        `SELECT
           tl.ma_thanh_ly,
           tl.ma_hop_dong,
           hd.ma_phong,
           COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
           k.ho_ten_khach,
           tl.ngay_tra_phong::text AS ngay_tra_phong,
           tl.ghi_chu
         FROM public.bien_ban_thanh_ly tl
         JOIN public.hop_dong hd ON hd.ma_hop_dong = tl.ma_hop_dong
         JOIN public.phong p ON p.ma_phong = hd.ma_phong
         LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
         WHERE hd.trang_thai IN ('Còn hạn', 'Đang thuê')
           AND (tl.trang_thai IN ('CHO_DUYET', 'ChoDuyet', 'Chờ duyệt', 'CHO DUYET') OR (tl.trang_thai IS NULL AND tl.ghi_chu LIKE '%[Trạng thái: CHO_DUYET]%'))
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = hd.ma_phong AND p_scope.toa_nha = $2))
         ORDER BY tl.ngay_tra_phong ASC
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),

      // 6. Số điện nước khách gửi lên chờ duyệt
      pool.query<{
        ma_ky: string;
        thang_nam: string;
        ma_hop_dong: string;
        ma_phong: string;
        ten_phong: string | null;
        ho_ten_khach: string | null;
        ngay_ghi_nhan: string | null;
        chi_so_dien_moi: string | null;
        chi_so_nuoc_moi: string | null;
      }>(
        `SELECT
           cs.ma_ky,
           cs.thang_nam,
           cs.ma_hop_dong,
           hd.ma_phong,
           COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
           k.ho_ten_khach,
           cs.ngay_ghi_nhan::text AS ngay_ghi_nhan,
           cs.chi_so_dien_moi::text AS chi_so_dien_moi,
           cs.chi_so_nuoc_moi::text AS chi_so_nuoc_moi
         FROM public.chi_so_dien_nuoc cs
         JOIN public.hop_dong hd ON hd.ma_hop_dong = cs.ma_hop_dong
         JOIN public.phong p ON p.ma_phong = hd.ma_phong
         LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
         WHERE cs.trang_thai_duyet = 'Chờ duyệt'
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = hd.ma_phong AND p_scope.toa_nha = $2))
         ORDER BY cs.ngay_ghi_nhan DESC NULLS LAST
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),

      // 7. Yêu cầu phụ lục gia hạn hợp đồng chờ duyệt
      pool.query<{
        ma_phu_luc: string;
        ma_hop_dong: string;
        ma_phong: string;
        ten_phong: string | null;
        ho_ten_khach: string | null;
        ngay_gia_han_den: string | null;
        ngay_lap: string | null;
        noi_dung_dieu_chinh: string | null;
      }>(
        `SELECT
           pl.ma_phu_luc,
           pl.ma_hop_dong,
           hd.ma_phong,
           COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
           k.ho_ten_khach,
           pl.ngay_gia_han_den::text AS ngay_gia_han_den,
           pl.ngay_lap::text AS ngay_lap,
           pl.noi_dung_dieu_chinh
         FROM public.phu_luc_hop_dong pl
         JOIN public.hop_dong hd ON hd.ma_hop_dong = pl.ma_hop_dong
         JOIN public.phong p ON p.ma_phong = hd.ma_phong
         LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
         WHERE pl.trang_thai::text IN ('Chờ duyệt', 'Đang xử lý', 'ChoDuyet', 'CHO_DUYET')
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = hd.ma_phong AND p_scope.toa_nha = $2))
         ORDER BY pl.ngay_lap DESC NULLS LAST
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),

      // 8. Hợp đồng sắp hết hạn trong 30 ngày (cần liên hệ gia hạn)
      pool.query<{
        ma_hop_dong: string;
        ma_phong: string;
        ten_phong: string | null;
        ho_ten_khach: string | null;
        ngay_kt: string;
        so_ngay_con_lai: number;
      }>(
        `SELECT
           hd.ma_hop_dong,
           hd.ma_phong,
           COALESCE(p.ten_hien_thi, p.ma_phong) AS ten_phong,
           k.ho_ten_khach,
           hd.ngay_kt::text AS ngay_kt,
           EXTRACT(DAY FROM (hd.ngay_kt::timestamp - CURRENT_DATE::timestamp))::int AS so_ngay_con_lai
         FROM public.hop_dong hd
         JOIN public.phong p ON p.ma_phong = hd.ma_phong
         LEFT JOIN public.khach_thue k ON k.ma_khach = hd.ma_khach_dai_dien
         WHERE hd.trang_thai IN ('Còn hạn', 'Đang thuê')
           AND hd.ngay_kt <= CURRENT_DATE + interval '30 days'
           AND hd.ngay_kt >= CURRENT_DATE
           AND ($1::boolean OR EXISTS (SELECT 1 FROM public.phong p_scope WHERE p_scope.ma_phong = hd.ma_phong AND p_scope.toa_nha = $2))
         ORDER BY hd.ngay_kt ASC
         LIMIT 5`,
        [scope.allBuildings, scope.building]
      ),
    ]);

    const items: NotificationItem[] = [];

    // 1. Cọc giữ chỗ
    for (const h of holdsResult.rows) {
      const moneyStr = Number(h.so_tien_the_chan || 0).toLocaleString("vi-VN") + "\u00A0đ";
      items.push({
        id: `hold-${h.ma_giu_cho}`,
        type: "hold",
        title: `Phòng ${h.ma_phong || "—"}: Cọc giữ chỗ mới`,
        description: `${h.ho_ten_khach ? h.ho_ten_khach + " cọc " : "Cọc "}${moneyStr}`,
        time: h.thoi_gian_giu_cho,
        link: "/hop-dong",
      });
    }

    // 2. Sự cố báo hỏng
    for (const sc of issuesResult.rows) {
      let descText = "Cần kiểm tra xử lý";
      if (sc.noi_dung) {
        try {
          const parsed = JSON.parse(sc.noi_dung);
          if (parsed.mo_ta) descText = parsed.mo_ta;
        } catch {
          descText = sc.noi_dung;
        }
      }
      items.push({
        id: `issue-${sc.ma_su_co}`,
        type: "issue",
        title: `Phòng ${sc.ma_phong || "—"}: Báo hỏng ${sc.danh_muc ? sc.danh_muc.toLowerCase() : "thiết bị"}`,
        description: descText,
        time: sc.ngay_bao_cao,
        link: "/su-co",
      });
    }

    // 3. Hóa đơn chưa thanh toán
    for (const inv of invoicesResult.rows) {
      const debt = Number(inv.tong_tien || 0) - Number(inv.da_thu || 0);
      const debtStr = debt.toLocaleString("vi-VN") + "\u00A0đ";
      items.push({
        id: `inv-${inv.ma_hoa_don}`,
        type: "invoice",
        title: `Phòng ${inv.ma_phong || "—"}: Hóa đơn chưa thanh toán`,
        description: `Còn thiếu ${debtStr}`,
        time: inv.han_dong_tien,
        link: `/hoa-don?keyword=${inv.ma_hoa_don}`,
      });
    }

    // 4. Yêu cầu đổi / chuyển phòng
    for (const cp of transfersResult.rows) {
      items.push({
        id: `transfer-${cp.ma_yeu_cau}`,
        type: "transfer",
        title: `Phòng ${cp.ten_phong_cu || cp.ma_phong_cu}: Yêu cầu đổi phòng`,
        description: `${cp.ho_ten_khach || "Cư dân"} đề xuất chuyển sang ${cp.ten_phong_moi || cp.ma_phong_moi}`,
        time: cp.ngay_tao || cp.thoi_gian_hen,
        link: "/hop-dong",
      });
    }

    // 5. Yêu cầu trả phòng / thanh lý
    for (const tl of liquidationsResult.rows) {
      const dateStr = tl.ngay_tra_phong ? new Date(tl.ngay_tra_phong).toLocaleDateString("vi-VN") : "—";
      items.push({
        id: `liq-${tl.ma_thanh_ly}`,
        type: "liquidation",
        title: `Phòng ${tl.ten_phong || tl.ma_phong}: Yêu cầu trả phòng`,
        description: `${tl.ho_ten_khach || "Cư dân"} báo dọn đi ngày ${dateStr}`,
        time: tl.ngay_tra_phong,
        link: "/hop-dong",
      });
    }

    // 6. Số điện nước khách gửi lên chờ duyệt
    for (const cs of meterResult.rows) {
      items.push({
        id: `meter-${cs.ma_ky}`,
        type: "meter",
        title: `Phòng ${cs.ten_phong || cs.ma_phong}: Chốt số điện nước kỳ ${cs.thang_nam}`,
        description: `${cs.ho_ten_khach ? `${cs.ho_ten_khach} đã gửi: ` : ""}Điện: ${cs.chi_so_dien_moi || "—"}, Nước: ${cs.chi_so_nuoc_moi || "—"}`,
        time: cs.ngay_ghi_nhan,
        link: `/dien-nuoc?keyword=${encodeURIComponent(cs.ma_phong)}`,
      });
    }

    // 7. Yêu cầu phụ lục gia hạn hợp đồng chờ duyệt
    for (const pl of extensionRequestsResult.rows) {
      const dateStr = pl.ngay_gia_han_den ? new Date(pl.ngay_gia_han_den).toLocaleDateString("vi-VN") : "kỳ mới";
      items.push({
        id: `pl-${pl.ma_phu_luc}`,
        type: "extension",
        title: `Phòng ${pl.ten_phong || pl.ma_phong}: Yêu cầu gia hạn hợp đồng`,
        description: `${pl.ho_ten_khach || "Cư dân"} xin gia hạn đến ${dateStr}`,
        time: pl.ngay_lap,
        link: `/hop-dong/${encodeURIComponent(pl.ma_hop_dong)}`,
      });
    }

    // 8. Hợp đồng sắp hết hạn trong 30 ngày (cần liên hệ gia hạn)
    for (const hd of expiringContractsResult.rows) {
      const dateStr = new Date(hd.ngay_kt).toLocaleDateString("vi-VN");
      items.push({
        id: `exp-${hd.ma_hop_dong}`,
        type: "extension",
        title: `Phòng ${hd.ten_phong || hd.ma_phong}: HĐ sắp hết hạn (${hd.so_ngay_con_lai} ngày)`,
        description: `HĐ ${hd.ma_hop_dong} (${hd.ho_ten_khach || "Cư dân"}) hết hạn ${dateStr}. Cần gia hạn.`,
        time: hd.ngay_kt,
        link: `/hop-dong/${encodeURIComponent(hd.ma_hop_dong)}`,
      });
    }

    // Sắp xếp thông báo mới nhất lên đầu
    items.sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });

    return NextResponse.json({
      total: items.length,
      items,
    });
  } catch (error) {
    console.error("Lỗi lấy thông báo hệ thống:", error);
    return NextResponse.json({ error: "Lỗi máy chủ", total: 0, items: [] }, { status: 500 });
  }
}
