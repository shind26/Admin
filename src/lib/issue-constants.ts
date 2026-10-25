export const ISSUE_STATUSES = [
  "Chờ xử lý",
  "Đang xử lý",
  "Đã xử lý",
  "Đã hoàn thành",
  "Đã hủy",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_PRIORITIES = ["Thấp", "Trung bình", "Cao", "Khẩn cấp"] as const;

/**
 * Bản đồ các trạng thái tiếp theo được phép chuyển (Quy trình tiến 1 chiều).
 * Chặn hoàn toàn việc chuyển ngược về trạng thái trước.
 */
export const ALLOWED_NEXT_STATUSES: Record<string, string[]> = {
  "Chờ xử lý": ["Đang xử lý", "Đã xử lý", "Đã hoàn thành", "Đã hủy"],
  "Đang xử lý": ["Đã xử lý", "Đã hoàn thành", "Đã hủy"],
  "Đã xử lý": ["Đã hoàn thành"],
  "Đã hoàn thành": [],
  "Đã hủy": [],
};

