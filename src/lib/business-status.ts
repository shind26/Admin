/** Giá trị ghi xuống database; chấp nhận các nhãn cũ từ URL hoặc form đã mở trước đó. */
export function contractStatus(value: string): string {
  return value === "Đã kết thúc" ? "Đã thanh lý" : value;
}

export function stayStatus(value: string): string {
  if (value === "Chờ xác nhận") return "Chờ duyệt";
  if (value === "Hoàn tất") return "Hết hạn";
  return value;
}

export function receiptStatus(value: string): string {
  return value === "Từ chối" ? "Đã hủy" : value;
}

export function vehicleStatus(value: string): string {
  return value === "DaDuyet" ? "HoatDong" : value;
}
