type AttemptRecord = {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
};

// Lưu trữ bộ đếm số lần đăng nhập sai theo định danh (IP hoặc tên đăng nhập)
const store = new Map<string, AttemptRecord>();

const WINDOW_MS = 5 * 60 * 1000; // Cửa sổ theo dõi: 5 phút
const BLOCK_DURATION_MS = 5 * 60 * 1000; // Thời gian khóa: 5 phút

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Kiểm tra xem định danh có đang bị khóa đăng nhập do thử sai quá nhiều không.
 */
export function checkLoginRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record) {
    return { allowed: true };
  }

  // Đang trong thời gian bị khóa
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Đã hết cửa sổ theo dõi hoặc hết hạn khóa -> reset
  if (now - record.firstAttemptAt > WINDOW_MS && (!record.blockedUntil || record.blockedUntil <= now)) {
    store.delete(identifier);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Ghi nhận một lần đăng nhập thất bại.
 * `maxAttempts`: số lần sai tối đa (mặc định 5 cho tài khoản, 30 cho IP để tránh khóa cả mạng văn phòng).
 */
export function recordFailedLogin(
  identifier: string,
  maxAttempts = 5,
): {
  blocked: boolean;
  retryAfterSeconds: number;
  attemptsLeft: number;
} {
  const now = Date.now();
  let record = store.get(identifier);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    record = { count: 1, firstAttemptAt: now, blockedUntil: null };
    store.set(identifier, record);
    return {
      blocked: false,
      retryAfterSeconds: 0,
      attemptsLeft: maxAttempts - 1,
    };
  }

  record.count += 1;
  if (record.count >= maxAttempts) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    const retryAfterSeconds = Math.ceil(BLOCK_DURATION_MS / 1000);
    return { blocked: true, retryAfterSeconds, attemptsLeft: 0 };
  }

  return {
    blocked: false,
    retryAfterSeconds: 0,
    attemptsLeft: Math.max(0, maxAttempts - record.count),
  };
}

/**
 * Xóa bộ đếm khi đăng nhập thành công.
 */
export function resetLoginRateLimit(identifier: string): void {
  store.delete(identifier);
}

/** Xóa toàn bộ bộ đếm (dùng cho test). */
export function clearAllRateLimits(): void {
  store.clear();
}

// Tự động dọn dẹp các bản ghi cũ mỗi 10 phút để tránh tiêu tốn bộ nhớ
if (typeof setInterval !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (
        (record.blockedUntil && record.blockedUntil < now) ||
        (!record.blockedUntil && now - record.firstAttemptAt > WINDOW_MS)
      ) {
        store.delete(key);
      }
    }
  };
  const timer = setInterval(cleanup, 10 * 60 * 1000);
  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }
}
