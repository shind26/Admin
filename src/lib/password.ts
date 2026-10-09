import "server-only";
import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";

/**
 * Tương thích với PasswordHelper của SupabaseApp (C#).
 * Hỗ trợ: BCrypt ($2a/$2b/$2y/$2x), PBKDF2 legacy của ASP.NET Crypto, và dữ liệu seed dạng thô.
 */
export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!password || !stored) return false;

  if (stored.startsWith("$2")) {
    try {
      return await compare(password, stored);
    } catch {
      // Rơi xuống các định dạng bên dưới nếu chuỗi không phải BCrypt hợp lệ.
    }
  }

  try {
    const decoded = Buffer.from(stored, "base64");
    if (decoded.length === 49 && decoded[0] === 0x00) {
      const salt = decoded.subarray(1, 17);
      const expected = decoded.subarray(17, 49);
      const actual = pbkdf2Sync(password, salt, 1000, 32, "sha1");
      return timingSafeEqual(actual, expected);
    }
  } catch {
    // Rơi xuống kiểm tra dữ liệu thô bên dưới.
  }

  // Chỉ áp dụng cho dữ liệu seed dạng thô, không phải mật khẩu đã băm.
  return stored === password;
}

/** Băm mật khẩu mới bằng BCrypt, cùng work factor với PasswordHelper của SupabaseApp. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, 11);
}
