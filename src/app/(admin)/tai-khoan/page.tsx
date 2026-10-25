import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageSkeleton } from "@/components/admin-skeleton";
import { getBuildings, getManagedAccounts } from "@/lib/queries";
import { ScopeQuery } from "@/lib/scope";
import { requireScope } from "@/lib/session";
import {
  AccountForm,
  EditAccountToggle,
  ResetPasswordButton,
} from "./account-forms";
import styles from "@/components/business.module.css";

export const metadata = { title: "Quản lý tài khoản | Kiêu Giang Boarding" };

type SearchParams = Promise<{ keyword?: string }>;

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

function roleLabel(role: string | null) {
  if (role === "Admin") return "Chủ trọ (toàn hệ thống)";
  if (role === "QuanLy") return "Quản lý tòa";
  return role ?? "-";
}

function statusClass(status: string | null) {
  return status === "HoatDong" ? styles.badgeOk : styles.badgeMuted;
}

async function AccountsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { account, scope } = await requireScope();

  // Chỉ Admin đang hoạt động mới được quản lý tài khoản.
  if (!scope.allBuildings || account.vai_tro !== "Admin") {
    return (
      <AdminShell active="account">
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Quản lý tài khoản</h1>
            <p className={styles.subtitle}>Khu vực dành riêng cho chủ trọ</p>
          </div>
        </div>
        <div className={styles.createBox}>
          <p className={styles.formMessage} role="alert">
            Chỉ tài khoản vai trò <strong>Admin</strong> và đang ở trạng thái{" "}
            <strong>HoatDong</strong> mới được quản lý tài khoản nhân viên.
          </p>
        </div>
      </AdminShell>
    );
  }

  const params = await searchParams;
  const keyword = params.keyword || "";
  const [accounts, buildings] = await Promise.all([
    getManagedAccounts(keyword),
    getBuildings(new ScopeQuery(scope)),
  ]);

  const active = accounts.filter(
    (item) => item.trang_thai === "HoatDong",
  ).length;
  const managers = accounts.filter((item) => item.vai_tro === "QuanLy").length;
  const mustChange = accounts.filter((item) => !item.da_doi_mat_khau).length;

  return (
    <AdminShell active="account">
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Quản lý tài khoản</h1>
          <p className={styles.subtitle}>
            Cấp tài khoản nhân viên, gán tòa quản lý và đặt lại mật khẩu
          </p>
        </div>
      </div>

      <section className={styles.miniStats}>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Tổng tài khoản</div>
          <div className={styles.miniValue}>{accounts.length}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Đang hoạt động</div>
          <div className={`${styles.miniValue} ${styles.ok}`}>{active}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Quản lý tòa</div>
          <div className={`${styles.miniValue} ${styles.info}`}>{managers}</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniLabel}>Chờ đổi mật khẩu</div>
          <div className={`${styles.miniValue} ${styles.warn}`}>
            {mustChange}
          </div>
        </div>
      </section>

      <details className={styles.createBox}>
        <summary className={styles.createSummary}>
          + Tạo tài khoản nhân viên
        </summary>
        <AccountForm buildings={buildings} />
      </details>

      <form className={styles.filterCard} action="/tai-khoan">
        <div className={styles.filterField}>
          <label htmlFor="keyword">
            Tìm theo tên đăng nhập, họ tên hoặc tòa nhà
          </label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword}
            placeholder="nhanvien.toaa, Nguyễn Văn A, Tòa A"
          />
        </div>
        <div className={styles.filterField} />
        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Tìm
          </button>
          <Link href="/tai-khoan" className={styles.resetButton}>
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ tên</th>
                <th>Vai trò</th>
                <th>Tòa quản lý</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Không có tài khoản phù hợp.
                  </td>
                </tr>
              ) : (
                accounts.map((item) => (
                  <tr key={item.ma_tai_khoan}>
                    <td>
                      <div className={styles.strong}>
                        {item.ten_dang_nhap || item.ma_tai_khoan}
                      </div>
                      <div className={styles.muted}>{item.ma_tai_khoan}</div>
                    </td>
                    <td>{item.ho_ten || "-"}</td>
                    <td>
                      <span
                        className={
                          item.vai_tro === "Admin"
                            ? styles.badgeInfo
                            : styles.badgeMuted
                        }
                      >
                        {roleLabel(item.vai_tro)}
                      </span>
                    </td>
                    <td>
                      {item.vai_tro === "Admin"
                        ? "Toàn hệ thống"
                        : item.co_so_van_hanh || "Chưa gán"}
                    </td>
                    <td>
                      <span className={statusClass(item.trang_thai)}>
                        {item.trang_thai}
                      </span>
                    </td>
                    <td>{formatDateTime(item.ngay_tao)}</td>
                    <td>
                      <div className={styles.actionCell}>
                        <EditAccountToggle
                          account={{
                            maTaiKhoan: item.ma_tai_khoan,
                            hoTen: item.ho_ten ?? "",
                            coSo: item.co_so_van_hanh ?? "",
                            trangThai: item.trang_thai ?? "HoatDong",
                            vaiTro: item.vai_tro ?? "QuanLy",
                          }}
                          buildings={buildings}
                        />
                        <ResetPasswordButton
                          maTaiKhoan={item.ma_tai_khoan}
                          tenDangNhap={item.ten_dang_nhap || item.ma_tai_khoan}
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

export default function AccountsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AccountsContent searchParams={searchParams} />
    </Suspense>
  );
}
