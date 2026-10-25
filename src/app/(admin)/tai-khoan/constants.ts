/** Mật khẩu mặc định cấp cho nhân viên; bắt buộc đổi ở lần đăng nhập đầu. */
export const DEFAULT_PASSWORD = "123456";

/** Vai trò được phép tạo qua màn hình quản lý tài khoản. */
export const MANAGED_ROLES = ["QuanLy"] as const;

/** Trạng thái tài khoản hợp lệ trong bảng tai_khoan. */
export const ACCOUNT_STATUSES = ["HoatDong", "Khoa"] as const;
