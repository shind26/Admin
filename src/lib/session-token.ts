import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE = 4 * 60 * 60; // 4 giờ, tương ứng IdleTimeout của hệ thống

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Tính dấu định danh mật khẩu (Security Stamp).
 * Khi mật khẩu thay đổi trong DB, stamp này sẽ đổi theo -> vô hiệu hóa mọi phiên cũ.
 */
export function computePasswordStamp(passwordHash: string | null | undefined): string {
  if (!passwordHash) return "none";
  return createHmac("sha256", "kg_stamp_salt")
    .update(passwordHash)
    .digest("hex")
    .slice(0, 10);
}

export type ParsedToken = {
  accountId: string;
  stamp: string;
  expires: number;
};

/**
 * Tạo token phiên dạng:
 * `maTaiKhoan.stamp.expiresAt.signature` đã ký HMAC.
 */
export function createSessionToken(
  accountId: string,
  secret: string,
  passwordHash?: string | null,
): string | null {
  if (!secret || secret.length < 32 || !accountId) return null;
  const stamp = computePasswordStamp(passwordHash);
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${accountId}.${stamp}.${expires}`;
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

/**
 * Xác thực cấu trúc và chữ ký HMAC của token phiên.
 * Hàm này thuần túy tính toán mã hóa, không phụ thuộc Database nên dùng được cho cả Proxy (Next.js 16)
 * lẫn các Server Component.
 */
export function verifySessionToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  currentTime?: number,
): ParsedToken | null {
  if (!token || !secret || secret.length < 32) return null;

  const signatureAt = token.lastIndexOf(".");
  if (signatureAt < 0) return null;

  const payload = token.slice(0, signatureAt);
  const signature = token.slice(signatureAt + 1);

  if (!/^[a-f0-9]{64}$/.test(signature)) return null;

  const expected = sign(payload, secret);
  try {
    if (
      !timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expected, "hex"),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  // Cấu trúc mới: accountId.stamp.expires
  const parts = payload.split(".");
  if (parts.length === 3) {
    const [accountId, stamp, expiresStr] = parts;
    const expires = Number(expiresStr);
    if (!accountId || !stamp || !Number.isSafeInteger(expires)) {
      return null;
    }
    if (currentTime !== undefined && expires < currentTime) {
      return null;
    }
    return { accountId, stamp, expires };
  }

  // Tương thích ngược với định dạng cũ: accountId.expires
  if (parts.length === 2) {
    const [accountId, expiresStr] = parts;
    const expires = Number(expiresStr);
    if (!accountId || !Number.isSafeInteger(expires)) {
      return null;
    }
    if (currentTime !== undefined && expires < currentTime) {
      return null;
    }
    return { accountId, stamp: "", expires };
  }

  return null;
}

