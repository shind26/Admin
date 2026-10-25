import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { getServices } from "@/lib/queries";
import { requireScope } from "@/lib/session";
import {
  DeleteServiceButton,
  ServiceEditorToggle,
  ServiceForm,
} from "./service-forms";
import styles from "@/components/business.module.css";

export const metadata = { title: "Cài đặt dịch vụ | Kiêu Giang Boarding" };

function formatMoney(value: string | null) {
  if (value === null) return "Chưa có giá";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

async function ServicesContent() {
  const { account } = await requireScope();
  const services = await getServices();

  const isAdmin = account.vai_tro === "Admin";
  const total = services.reduce(
    (sum, item) => sum + Number(item.don_gia ?? 0),
    0,
  );
  const applied = services.filter((item) => item.so_lan_ap_dung > 0).length;

  return (
    <AdminShell active="service">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Cài đặt dịch vụ</h1>
          <p className={styles.subtitle}>
            Bảng giá dịch vụ áp dụng cho các phòng: rác, wifi, gửi xe, dọn dẹp…
          </p>
        </div>
      </div>

      {!isAdmin && (
        <p className={styles.formMessage} role="status">
          Bạn đang xem ở chế độ chỉ đọc. Chỉ tài khoản <strong>Admin</strong>{" "}
          được sửa bảng giá dịch vụ dùng chung.
        </p>
      )}

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Số dịch vụ</div>
          <div className={styles.miniValue}>{services.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng đơn giá</div>
          <div className={styles.miniValue}>{formatMoney(String(total))}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đang áp dụng</div>
          <div className={`${styles.miniValue} ${styles.info}`}>{applied}</div>
        </div>
      </section>

      {isAdmin && (
        <details className={styles.createBox}>
          <summary className={styles.createSummary}>+ Thêm dịch vụ mới</summary>
          <ServiceForm mode="create" />
        </details>
      )}

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã dịch vụ</th>
                <th>Tên dịch vụ</th>
                <th>Đơn giá</th>
                <th>Đơn vị tính</th>
                <th>Ghi chú</th>
                <th>Đã áp dụng</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Chưa có dịch vụ nào trong bảng giá.
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.ma_dich_vu}>
                    <td className={styles.muted}>{service.ma_dich_vu}</td>
                    <td className={styles.strong}>{service.ten_dich_vu}</td>
                    <td className={styles.strong}>
                      {formatMoney(service.don_gia)}
                    </td>
                    <td>{service.don_vi_tinh}</td>
                    <td>{service.ghi_chu || "-"}</td>
                    <td>
                      {service.so_lan_ap_dung > 0 ? (
                        <span className={styles.badgeInfo}>
                          {service.so_lan_ap_dung} kỳ
                        </span>
                      ) : (
                        <span className={styles.badgeMuted}>Chưa dùng</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <ServiceEditorToggle
                          service={{
                            maDichVu: service.ma_dich_vu,
                            tenDichVu: service.ten_dich_vu ?? "",
                            donViTinh: service.don_vi_tinh ?? "",
                            donGia: service.don_gia ?? "",
                            ghiChu: service.ghi_chu ?? "",
                          }}
                          readOnly={!isAdmin}
                        />
                        <DeleteServiceButton
                          maDichVu={service.ma_dich_vu}
                          tenDichVu={service.ten_dich_vu ?? service.ma_dich_vu}
                          readOnly={!isAdmin}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ServicesContent />
    </Suspense>
  );
}
