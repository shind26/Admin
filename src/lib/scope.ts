import "server-only";
import type { AccessScope } from "@/lib/session";

/**
 * Điều kiện SQL để giới hạn dữ liệu theo tòa, dùng chung cho mọi truy vấn.
 *
 * Mọi bảng nghiệp vụ đều suy ra tòa qua chuỗi liên kết:
 * - phong.toa_nha
 * - hop_dong.ma_phong -> phong.toa_nha
 * - hoa_don.ma_hop_dong -> hop_dong.ma_phong -> phong.toa_nha
 * - phieu_thu.ma_hoa_don -> hoa_don -> hop_dong -> phong.toa_nha
 * - chi_so_dien_nuoc.ma_hop_dong -> hop_dong -> phong.toa_nha
 * - su_co_bao_tri.ma_phong -> phong.toa_nha
 * - dang_ky_khach_qua_dem.ma_phong -> phong.toa_nha
 * - khach_thue: chỉ thấy khi có hợp đồng ở phòng thuộc tòa được gán
 *
 * `params` được thay đổi tại chỗ: luôn dùng lớp này trước khi thêm tham số khác,
 * hoặc đọc `params.length` để biết số thứ tự placeholder.
 */
export class ScopeQuery {
  readonly params: string[] = [];

  constructor(readonly accessScope: AccessScope) {}

  get limited() {
    return !this.accessScope.allBuildings;
  }

  /**
   * Trả về mệnh đề điều kiện cho `column` (ví dụ `p.toa_nha`),
   * hoặc chuỗi rỗng khi tài khoản có toàn quyền.
   */
  condition(column: string): string {
    if (!this.limited) return "";
    this.params.push(this.accessScope.building as string);
    return `${column} = $${this.params.length}`;
  }

  /** Gộp điều kiện phạm vi với các điều kiện khác thành mệnh đề WHERE. */
  where(conditions: string[]): string {
    const all = conditions.filter((item) => item.length > 0);
    return all.length > 0 ? `WHERE ${all.join(" AND ")}` : "";
  }

  /**
   * Điều kiện phạm vi cho trường hợp bảng chính không join trực tiếp được tới phòng,
   * ví dụ khách thuê (tòa suy ra qua hợp đồng).
   *
   * `baseQuery` là câu SELECT nối tới bảng ngoài (dùng bí danh riêng để không đụng
   * các bí danh khác trong truy vấn), và phải chọn `1`. Trả về chuỗi rỗng khi toàn quyền.
   */
  scopedExists(baseQuery: string): string {
    if (!this.limited) return "";
    this.params.push(this.accessScope.building as string);
    return `EXISTS (${baseQuery} AND p_scope.toa_nha = $${this.params.length})`;
  }
}
