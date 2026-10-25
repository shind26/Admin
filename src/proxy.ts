import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * Next.js 16 Proxy (thay thế middleware.js):
 * Chạy trước khi route được render để lọc nhanh quyền truy cập ở tầng mạng:
 * 1. Chặn mọi truy cập chưa đăng nhập vào các trang quản trị -> chuyển về /login.
 * 2. Tự động chuyển người dùng đã có phiên hợp lệ từ /login về trang chủ /.
 * 3. Bảo vệ các endpoint API nội bộ.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;

  // Kiểm tra chữ ký số và thời hạn của token phiên (optimistic check)
  const session = verifySessionToken(token, secret, Date.now());

  const isLoginPage = pathname === "/login";
  const isApi = pathname.startsWith("/api");

  // Đã có phiên hợp lệ mà vào /login -> đưa về trang chủ
  if (isLoginPage) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Chưa đăng nhập mà truy cập các trang nội bộ
  if (!session) {
    if (isApi) {
      return NextResponse.json(
        { error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ." },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", request.url);
    // Lưu lại URL đích để sau khi đăng nhập có thể quay lại đúng trang (tùy chọn)
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Khớp tất cả các đường dẫn ngoại trừ:
     * - _next/static (tệp tĩnh build của Next.js)
     * - _next/image (tối ưu hóa hình ảnh)
     * - favicon.ico (icon trình duyệt)
     * - Các tệp tĩnh công khai (.svg, .png, .jpg, .jpeg, .gif, .webp, .css, .js)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};

