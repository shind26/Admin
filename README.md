# 🏢 Hệ Thống Quản Lý Căn Hộ & Phòng Trọ Kiều Giang (Web Admin PMS)

> **Hệ thống Quản lý Bất động sản Cho thuê (Property Management System - PMS)** chuyên sâu dành cho Ban Quản Lý chuỗi căn hộ, phòng trọ dịch vụ Kiều Giang.  
> Xây dựng trên nền tảng **Next.js 16 (App Router)**, **React 19**, **TypeScript**, và **PostgreSQL (Supabase)**.

---

## 📋 Mục lục

1. [Yêu cầu môi trường (Prerequisites)](#-yêu-cầu-môi-trường-prerequisites)
2. [Cài đặt & Cấu hình biến môi trường](#-cài-đặt--cấu-hình-biến-môi-trường)
3. [Cách chạy dự án (Getting Started)](#-cách-chạy-dự-án-getting-started)
4. [Cấu trúc Thư mục & Chức năng từng File (Directory Structure)](#-cấu-trúc-thư-mục--chức-năng-từng-file)
   - [1. Thư mục `src/app` (Các trang & Routes)](#1-thư-mục-srcapp-các-trang--routes)
   - [2. Thư mục `src/lib` (Hạt nhân logic & Tiện ích)](#2-thư-mục-srclib-hạt-nhân-logic--tiện-ích)
   - [3. Thư mục `src/components` (Giao diện dùng chung)](#3-thư-mục-srccomponents-giao-diện-dùng-chung)
   - [4. Thư mục `scripts` (Công cụ DB & Migration)](#4-thư-mục-scripts-công-cụ-db--migration)
5. [Các luồng nghiệp vụ cốt lõi (Core Business Flows)](#-các-luồng-nghiệp-vụ-cốt-lõi)
6. [Cơ chế Phân quyền Quản trị (Multi-Property Scope)](#-cơ-chế-phân-quyền-quản-trị)
7. [Lưu ý kỹ thuật quan trọng](#-lưu-ý-kỹ-thuật-quan-trọng)

---

## ⚙️ Yêu cầu môi trường (Prerequisites)

- **Node.js**: Phiên bản `>= 18.18.0` (Khuyến nghị **Node.js 20 LTS** hoặc **22 LTS**).
  Node.js (Bản LTS 20 hoặc 22): Tải file cài đặt tại nodejs.org
  (chọn nút bên trái: LTS Recommended for Most Users). Khi cài đặt cứ bấm Next cho đến khi hoàn tất (Node.js đã tự kèm theo công cụ npm).
- **Trình quản lý gói**: `npm` (mặc định đi kèm Node.js) hoặc `pnpm`/`yarn`.
- **Cơ sở dữ liệu**: PostgreSQL phiên bản `>= 14` (Dự án được tối ưu trực tiếp cho **Supabase Database**).
- **Hệ điều hành**: Windows, macOS hoặc Linux.

---

## 🔑 Cài đặt & Cấu hình biến môi trường

### 1. Cài đặt các gói phụ thuộc (Dependencies)

Mở terminal tại thư mục gốc của dự án (`d:/2`):

```bash
npm install
```

### 2. Cấu hình file `.env.local`

Tạo file `.env.local` ở thư mục gốc (dựa trên mẫu `.env.example`):

```bash
cp .env.example .env.local
```

Cập nhật các biến sau trong `.env.local`:

```env
# 1. Chuỗi kết nối PostgreSQL (Lấy từ Supabase: Project Settings → Database → Connection string)
# Ưu tiên cổng 5432 hoặc 6543 (Session/Transaction pooler)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres

# 2. Chuỗi bí mật ký Token phiên đăng nhập (Tối thiểu 32 ký tự ngẫu nhiên)
SESSION_SECRET=kieu-giang-pms-super-secret-key-32-chars-long-random

# 3. Supabase Storage API (Dùng để upload & xóa ảnh thực tế của phòng)
# Lấy tại: Supabase Dashboard → Project Settings → API
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...[KHÓA_SERVICE_ROLE]

# 4. Tên Bucket chứa ảnh phòng trên Supabase Storage (chế độ Public)
SUPABASE_STORAGE_BUCKET=room-photos
```

### 3. Kiểm tra kết nối cơ sở dữ liệu

Chạy lệnh kiểm tra kết nối tới Supabase:

```bash
npm run db:check
```

Nếu terminal thông báo kết nối thành công và in ra danh sách bảng, hệ thống đã sẵn sàng hoạt động.

---

## 🚀 Cách chạy dự án (Getting Started)

### 1. Môi trường phát triển (Development)

Khởi chạy máy chủ phát triển cục bộ với Turbopack:

```bash
npm run dev
```

> **Mẹo cho Windows PowerShell**: Nếu gặp lỗi Execution Policy chặn script `.ps1`, hãy chạy bằng lệnh:
>
> ```powershell
> npm.cmd run dev
> ```

- Mở trình duyệt và truy cập: **[http://localhost:3000](http://localhost:3000)**
- Trang sẽ tự động điều hướng tới `/login` nếu bạn chưa đăng nhập.

### 2. Biên dịch & Đóng gói sản phẩm (Production Build)

Biên dịch tối ưu hóa toàn bộ hệ thống với tính năng **Partial Prefetching (PPR)** và kiểm tra TypeScript:

```bash
npm run build
# hoặc trên Windows PowerShell:
npm.cmd run build
```

Khởi chạy máy chủ Production sau khi build:

```bash
npm run start
# hoặc:
npm.cmd run start
```

---

## 📂 Cấu trúc Thư mục & Chức năng từng File

```
d:/2/
├── .env.example                # File mẫu cấu hình biến môi trường
├── package.json                # Khai báo thư viện & scripts
├── next.config.ts              # Cấu hình Next.js (Cache, PPR, Images)
├── tsconfig.json               # Cấu hình TypeScript
├── src/
│   ├── proxy.ts                # Middleware/Proxy Edge bảo vệ phiên & xử lý Date an toàn
│   ├── app/                    # Next.js App Router (Giao diện & Server Actions)
│   ├── components/             # Các UI Components dùng chung toàn hệ thống
│   └── lib/                    # Core Business Logic, Queries, Session, Utilities
└── scripts/                    # Các scripts Node.js hỗ trợ kiểm tra DB & migration
```

---

### 1. Thư mục `src/app` (Các trang & Routes)

#### 🛡️ Xác thực & Đổi mật khẩu

- **`src/proxy.ts`**: Proxy chạy tại Network Edge, kiểm tra cookie phiên đăng nhập (`kg_session`), chuyển hướng nếu chưa đăng nhập và tiêm `x-session-time` an toàn cho các trang Static Prerender.
- **`src/app/login/`**: Trang đăng nhập hệ thống (`page.tsx`, `actions.ts`, `login-form.tsx`). Hỗ trợ chống brute-force qua rate limiter, kiểm tra quyền `Admin`/`QuanLy`.
- **`src/app/doi-mat-khau-lan-dau/`**: Giao diện bắt buộc đổi mật khẩu khi tài khoản đăng nhập lần đầu tiên (`da_doi_mat_khau = false`).
- **`src/app/doi-mat-khau/`**: Giao diện cho phép quản trị viên chủ động đổi mật khẩu định kỳ.

#### 🏢 Phân hệ Quản trị viên `src/app/(admin)/`

Toàn bộ các trang nghiệp vụ đều được bọc bên trong layout quản trị `AdminShell`:

| Đường dẫn / Thư mục                         | Chức năng chính                                                                                                                                                                                                                                                                                   | Các file quan trọng                                                                                     |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| **`src/app/(admin)/page.tsx`**              | **Dashboard Tổng quan**: Thống kê số phòng (Trống, Đang thuê, Đã cọc, Bảo trì), doanh thu tháng, công nợ chưa thu, số cư dân, sự cố cần xử lý.                                                                                                                                                    | `page.tsx`, `dashboard.module.css`                                                                      |
| **`src/app/(admin)/phong/`**                | **Quản lý danh sách Phòng**: Hiển thị phòng theo sơ đồ tầng/tòa nhà, lọc trạng thái, tìm kiếm, thêm phòng mới, upload ảnh phòng lên Supabase Storage.                                                                                                                                             | `page.tsx`, `room-card.tsx`, `room-forms.tsx`, `actions.ts`                                             |
| **`src/app/(admin)/phong/[maPhong]/`**      | **Chi tiết một Căn phòng**: Xem thông tin chi tiết, chỉnh sửa phòng, kiểm kê danh mục tài sản nội thất bàn giao, tóm tắt chỉ số điện nước, lịch sử khách thuê, tiếp nhận và xử lý cọc giữ chỗ.                                                                                                    | `page.tsx`, `room-reservation.tsx`, `room-assets.tsx`, `room-utility-summary.tsx`, `rental-history.tsx` |
| **`src/app/(admin)/hop-dong/`**             | **Quản lý Hợp đồng**: Danh sách hợp đồng đang hiệu lực/hết hạn, bộ lọc, hàng đợi **`PendingReservationsQueue`** (tiếp nhận khách đặt cọc từ Mobile App để tạo hợp đồng 1-click), form lập hợp đồng mới tự động sinh User App.                                                                     | `page.tsx`, `contract-forms.tsx`, `pending-reservations.tsx`, `actions.ts`                              |
| **`src/app/(admin)/hop-dong/[maHopDong]/`** | **Chi tiết Hợp đồng & Thanh lý**: Xem điều khoản hợp đồng, in hợp đồng cho khách, quy trình **Thanh lý hợp đồng & Trả phòng** (`liquidation-dialog.tsx`) tự động chốt điện nước, khấu trừ tài sản hỏng và hoàn cọc vào `bien_ban_thanh_ly`.                                                       | `page.tsx`, `liquidation-dialog.tsx`, `print-bar.tsx`                                                   |
| **`src/app/(admin)/khach-thue/`**           | **Quản lý Cư dân**: Danh sách khách thuê đại diện và người ở cùng, quản lý đăng ký phương tiện / thẻ xe (`phuong_tien`), phê duyệt ảnh CCCD eKYC, nút cấp lại mật khẩu App kèm tin nhắn mẫu SMS/Zalo, xuất Excel/CSV cư dân.                                                                      | `page.tsx`, `resident-drawer.tsx`, `resident-table-view.tsx`, `tenant-forms.tsx`, `actions.ts`          |
| **`src/app/(admin)/khach-thue/tam-tru/`**   | **Quản lý Tạm trú & Khách qua đêm**: Theo dõi danh sách đăng ký lưu trú tạm thời, xuất file danh sách báo cáo Công an khu vực theo quy định.                                                                                                                                                      | `page.tsx`, `stay-forms.tsx`, `actions.ts`                                                              |
| **`src/app/(admin)/dien-nuoc/`**            | **Quản lý Điện & Nước**: Ghi nhận chỉ số đồng hồ điện/nước hàng tháng theo kỳ, tự động tính sản lượng tiêu thụ, cảnh báo chỉ số bất thường, nút 1-click sinh hóa đơn tự động hàng loạt cho toàn bộ tòa nhà.                                                                                       | `page.tsx`, `meter-forms.tsx`, `generate-invoice-button.tsx`, `actions.ts`                              |
| **`src/app/(admin)/hoa-don/`**              | **Quản lý Hóa đơn**: Danh sách hóa đơn sinh tự động, theo dõi công nợ phòng, modal xem chi tiết hóa đơn chiết tính đầy đủ các mục tiền phòng/điện/nước/xe/dịch vụ, in hóa đơn. Khóa tạo/sửa thủ công tùy tiện để chống sai lệch số liệu.                                                          | `page.tsx`, `invoice-detail-modal.tsx`, `invoice-detail-view.tsx`, `actions.ts`                         |
| **`src/app/(admin)/phieu-thu/`**            | **Quản lý Phiếu thu tiền**: Tiếp nhận thanh toán (Tiền mặt, Chuyển khoản, VietQR tự động), nút duyệt nhanh 1-click, tự động gạch nợ hóa đơn, **In phiếu thu chuẩn Mẫu 01 - TT** (TT 133/2016/TT-BTC) kèm đọc số tiền bằng chữ tiếng Việt. Khóa chỉnh sửa đối với phiếu đã duyệt (**Lựa chọn A**). | `page.tsx`, `receipt-detail-modal.tsx`, `receipt-forms.tsx`, `actions.ts`                               |
| **`src/app/(admin)/dich-vu/`**              | **Bảng giá Dịch vụ**: Cấu hình giá phòng, đơn giá điện nước (lũy tiến hoặc cố định), phí gửi xe máy/ô tô, internet, thang máy, vệ sinh.                                                                                                                                                           | `page.tsx`, `service-forms.tsx`, `actions.ts`                                                           |
| **`src/app/(admin)/su-co/`**                | **Bảo trì & Sự cố**: Tiếp nhận báo hỏng từ cư dân hoặc quản lý phát hiện, phân loại hạng mục (Điều hòa, Điện nước, Cửa...), gán chi phí sửa chữa, tự động hiển thị huy hiệu cảnh báo đỏ lên thẻ phòng tại sơ đồ phòng.                                                                            | `page.tsx`, `issue-forms.tsx`, `actions.ts`                                                             |
| **`src/app/(admin)/tai-khoan/`**            | **Quản lý Tài khoản & Phân quyền**: Quản lý tài khoản quản trị, cấp tài khoản cho Quản lý tòa nhà, phân quyền cơ sở vận hành (`co_so_van_hanh`), reset mật khẩu nhân viên.                                                                                                                        | `page.tsx`, `account-forms.tsx`, `actions.ts`                                                           |

#### 🌐 API Routes `src/app/api/`

- **`src/app/api/upload/room-photo/route.ts`**: Tiếp nhận multipart form data, kiểm tra dung lượng/định dạng ảnh, upload trực tiếp lên bucket Supabase Storage và trả về Public URL.
- **`src/app/api/upload/room-photo/delete/route.ts`**: Xóa tệp ảnh khỏi Supabase Storage khi người dùng xóa ảnh phòng.

---

### 2. Thư mục `src/lib` (Hạt nhân logic & Tiện ích)

- **`db.ts`**: Khởi tạo singleton PostgreSQL Connection Pool (`pg.Pool`) kết nối tới Supabase, cấu hình SSL an toàn.
- **`queries.ts`**: File chứa toàn bộ các câu lệnh SQL truy vấn dữ liệu nghiệp vụ (Rooms, Invoices, Receipts, Meters, Contracts, Tenants, Issues, Stats...), hỗ trợ lọc an toàn qua parameterized queries `$1, $2...`.
- **`session.ts`**: Quản lý phiên đăng nhập lưu trong HTTP-only Cookie (`kg_session`), hàm `requireScope()` và `getCurrentAccount()` dùng để bảo vệ Server Components và Server Actions.
- **`session-token.ts`**: Thuật toán mã hóa & xác thực chữ ký token phiên bằng HMAC-SHA256 chuẩn Web Crypto API (hoạt động tốt trên cả Edge lẫn Node.js).
- **`scope.ts`**: Lớp tiện ích `ScopeQuery` đảm bảo bảo mật dữ liệu đa cơ sở: nếu tài khoản có vai trò `QuanLy`, hệ thống tự động chèn điều kiện lọc `WHERE p.toa_nha = ...` để ngăn xem chéo dữ liệu của tòa nhà khác.
- **`password.ts`**: Tiện ích băm (`hashPassword`) và so khớp (`verifyPassword`) mật khẩu tài khoản sử dụng thuật toán an toàn `bcryptjs`.
- **`number-to-words.ts`**: Chuyển đổi số tiền thành chuỗi chữ tiếng Việt chuẩn kế toán (ví dụ: `4180000` $\to$ _"Bốn triệu một trăm tám mươi nghìn đồng chẵn."_), phục vụ xuất phiếu thu Mẫu 01-TT.
- **`notifications.ts`**: Hàm gửi thông báo hệ thống vào bảng `public.thong_bao` để đồng bộ thông tin sang ứng dụng Mobile của cư dân khi có hóa đơn mới, duyệt phiếu thu, duyệt xe hoặc bàn giao phòng.
- **`meter-utils.ts`**: Tính toán sản lượng tiêu thụ điện/nước, kiểm tra cảnh báo chỉ số mới thấp hơn chỉ số cũ hoặc tăng đột biến.
- **`storage.ts`**: Module giao tiếp với Supabase Storage client để upload và xóa hình ảnh.
- **`handover.ts`**: Lưu và cập nhật danh mục tài sản bàn giao của phòng vào bảng `public.tai_san`.
- **`rate-limit.ts`**: Kiểm soát tần suất đăng nhập sai để ngăn chặn tấn công dò mật khẩu.
- **`guards.ts`**: Các hàm guard kiểm tra quyền hạn tài khoản trước khi thực hiện thao tác nhạy cảm.
- **`export.ts`**: Tiện ích chuyển đổi dữ liệu mảng thành file CSV/Excel UTF-8 có BOM hỗ trợ tiếng Việt không lỗi font.

---

### 3. Thư mục `src/components` (Giao diện dùng chung)

- **`admin-shell.tsx` & `admin-shell-layout.tsx`**: Khung sườn giao diện Admin gồm thanh điều hướng trên cùng, logo hệ thống, menu các phân hệ, bộ chọn cơ sở vận hành (`BuildingScopeSwitcher`), hiển thị tên người dùng và nút Đăng xuất.
- **`admin-skeleton.tsx`**: Giao diện khung chờ (Skeleton Loading) hiển thị mượt mà trong khi Server Components nạp dữ liệu.
- **`business.module.css`**: Hệ thống CSS Modules chuẩn hóa toàn bộ giao diện: thẻ tóm tắt (mini-stats), bảng dữ liệu (`table`), form nhập liệu (`formGrid`), huy hiệu trạng thái (`badgeOk`, `badgeWarn`, `badgeDanger`), bộ lọc (`filterCard`).
- **`handover-items-editor.tsx`**: Bảng kiểm kê thiết bị bàn giao tương tác trực tiếp (thêm/sửa/xóa tên tài sản, tình trạng hoạt động) dùng khi cọc và lập hợp đồng.
- **`confirm-modal.tsx` & `modal.tsx`**: Hộp thoại xác nhận thao tác nguy hiểm (Xóa phòng, hủy cọc, thanh lý hợp đồng).
- **`toast.tsx`**: Thông báo trạng thái nhanh góc màn hình.

---

### 4. Thư mục `scripts` (Công cụ DB & Migration)

- **`check-db.mjs`**: Kiểm tra kết nối tới Database qua biến môi trường.
- **`check-scope.mjs`**: Kiểm tra phân quyền truy cập theo từng chi nhánh/tòa nhà.
- **`inspect-managers.mjs`**: Liệt kê danh sách các tài khoản Admin & Quản lý hiện có.
- **`migrate-thong-bao.mjs`**: Migration tạo bảng `public.thong_bao` cho trung tâm thông báo cư dân.
- **`migrate-taisan.mjs`**: Migration chuẩn hóa bảng `public.tai_san` phục vụ bàn giao thiết bị phòng.
- **`migrate-loai-phong.mjs`**: Migration bổ sung thông tin tiện ích và loại phòng.
- **`migrate-room-meters.mjs`**: Migration bổ sung cột `chi_so_dien`, `chi_so_nuoc`, `ngay_cap_nhat_chi_so` vào bảng `public.phong` và đồng bộ số đo ban đầu từ kỳ ghi gần nhất.
- **`toggle-first-login.mjs`**: Bật/tắt cờ `da_doi_mat_khau` cho tài khoản khi cần kiểm thử luồng đổi mật khẩu lần đầu.

---

## 🔄 Các luồng nghiệp vụ cốt lõi

```mermaid
flowchart TD
    A[Khách xem phòng & Đặt cọc qua Mobile App] -->|Lưu vào public.giu_cho| B(Yêu cầu cọc xuất hiện tại /hop-dong)
    B -->|BQL bấm 'Tạo hợp đồng ngay'| C[Hệ thống tự động kích hoạt Hợp đồng]
    C -->|Tự động đối trừ tiền cọc| D[Cấp User Mobile App cho cư dân]
    D -->|Hàng tháng| E[Ghi chỉ số Điện & Nước tại /dien-nuoc]
    E -->|1-Click Chốt kỳ| F[Tự động sinh Hóa đơn hàng loạt tại /hoa-don]
    F -->|Khách nộp tiền mặt hoặc VietQR| G[Lập & Duyệt Phiếu thu tại /phieu-thu]
    G -->|Tự động gạch nợ hóa đơn| H[Gửi thông báo xác nhận sang App Cư dân]
    H -->|Hết hạn thuê| I[BQL bấm 'Thanh lý hợp đồng' tại /hop-dong/ID]
    I -->|Chốt số đo cuối & Khấu trừ cọc| J[Lưu Biên bản thanh lý & Mở lại phòng Trống]
```

---

## 🔐 Cơ chế Phân quyền Quản trị

| Vai trò (`vai_tro`) | Quyền hạn dữ liệu                                                                | Phạm vi cơ sở (`co_so_van_hanh`)                                                                           |
| :------------------ | :------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **`Admin`**         | Toàn quyền cấu hình hệ thống, quản lý tài khoản nhân viên, xem báo cáo tổng hợp. | **Toàn hệ thống** (Có thể chọn xem tất cả hoặc lọc theo từng tòa nhà bất kỳ).                              |
| **`QuanLy`**        | Quản lý vận hành hàng ngày (Phòng, Khách, Hợp đồng, Điện nước, Hóa đơn, Sự cố).  | **Chỉ xem và thao tác trên Tòa nhà được phân công** (Tự động khóa dữ liệu ngoài phạm vi qua `ScopeQuery`). |
| **`KhachThue`**     | Chỉ dùng để đăng nhập ứng dụng Mobile dành riêng cho cư dân.                     | Bị chặn hoàn toàn không thể đăng nhập vào cổng Web Admin này (`/login`).                                   |

---

## 📌 Lưu ý kỹ thuật quan trọng

1. **Next.js 16 Partial Prerendering (PPR) & Date.now()**:
   - Tuyệt đối không gọi trực tiếp `Date.now()`, `new Date()`, hoặc hàm tạo ngẫu nhiên trong Server Component Render Tree nếu không bọc trong `<Suspense>`.
   - Việc lấy mốc thời gian phiên đăng nhập đã được chuyển ra Network Edge tại [`src/proxy.ts`](file:///d:/2/src/proxy.ts) và truyền qua HTTP Header `x-session-time` để đảm bảo 100% trang prerender tĩnh không bị lỗi `Blocking RouteServer`.
2. **Quy chuẩn Phiếu thu (Lựa chọn A)**:
   - Phiếu thu khi đã ở trạng thái **`Đã xác nhận`** hoặc **`Đã khớp lệnh`** (VietQR) sẽ **bị khóa nút Sửa** trên toàn hệ thống để bảo đảm tính toàn vẹn chứng từ kế toán. Nếu có sai sót, quy trình cho phép xóa và lập phiếu mới để tính toán lại công nợ chính xác.
3. **Đồng bộ Đặt cọc hai chiều (Mobile ↔ Web)**:
   - Trạng thái phiếu cọc trong bảng `public.giu_cho` hỗ trợ đầy đủ cả dạng tiếng Việt có dấu (`'Đã thanh toán'`, `'Đang giữ'`, `'Chờ thanh toán'`) lẫn mã hệ thống (`'DaThanhToan'`, `'DangGiu'`, `'ChoThanhToan'`).
   - Trạng thái phòng trong `public.phong` nhận diện đồng bộ cả `'Đã cọc'` và `'Đã đặt cọc'`.
4. **Quy ước Chạy lệnh trên Windows**:
   - Khi thực thi các lệnh npm trên Windows PowerShell, ưu tiên sử dụng `npm.cmd [lệnh]` (ví dụ: `npm.cmd run dev`, `npm.cmd run build`) để tránh lỗi policy cấm chạy file script `npm.ps1`.
5. **Cơ chế Chỉ số Điện Nước Gắn Với Phòng (Room-level Meters)**:
   - Đồng hồ công tơ điện nước được định danh trực tiếp theo thực thể Phòng vật lý (`public.phong.chi_so_dien`, `public.phong.chi_so_nuoc`).
   - Khi chủ trọ tạo phòng mới hoặc sửa thông tin phòng, có thể gán/cập nhật chỉ số công tơ ban đầu.
   - Khi Ban Quản Lý phê duyệt kỳ ghi chỉ số (`trang_thai_duyet = 'Đã duyệt'`) hoặc tự ghi chỉ số mới tại `/dien-nuoc`, hệ thống tự động:
     1. Lưu lịch sử kỳ vào bảng `public.chi_so_dien_nuoc`.
     2. Cập nhật chỉ số mới nhất ngược lại vào bảng `public.phong`.
     3. Tự động kết chuyển chi tiết dịch vụ và sinh Hóa đơn tiền phòng & dịch vụ trọn gói (`public.hoa_don`).
   - Nhờ vậy, khi khách cũ rời đi hoặc đổi khách mới, số đo hiện tại của phòng luôn được kế thừa mượt mà mà không bị thất thoát hay phải nhập tay lại từ đầu.

#### 🌐 API Routes `src/app/api/`

- **`src/app/api/upload/room-photo/route.ts`**: Tiếp nhận multipart form data, kiểm tra dung lượng/định dạng ảnh, upload trực tiếp lên bucket Supabase Storage và trả về Public URL.
- **`src/app/api/upload/room-photo/delete/route.ts`**: Xóa tệp ảnh khỏi Supabase Storage khi người dùng xóa ảnh phòng.

---

### 2. Thư mục `src/lib` (Hạt nhân logic & Tiện ích)

- **`db.ts`**: Khởi tạo singleton PostgreSQL Connection Pool (`pg.Pool`) kết nối tới Supabase, cấu hình SSL an toàn.
- **`queries.ts`**: File chứa toàn bộ các câu lệnh SQL truy vấn dữ liệu nghiệp vụ (Rooms, Invoices, Receipts, Meters, Contracts, Tenants, Issues, Stats...), hỗ trợ lọc an toàn qua parameterized queries `$1, $2...`.
- **`session.ts`**: Quản lý phiên đăng nhập lưu trong HTTP-only Cookie (`kg_session`), hàm `requireScope()` và `getCurrentAccount()` dùng để bảo vệ Server Components và Server Actions.
- **`session-token.ts`**: Thuật toán mã hóa & xác thực chữ ký token phiên bằng HMAC-SHA256 chuẩn Web Crypto API (hoạt động tốt trên cả Edge lẫn Node.js).
- **`scope.ts`**: Lớp tiện ích `ScopeQuery` đảm bảo bảo mật dữ liệu đa cơ sở: nếu tài khoản có vai trò `QuanLy`, hệ thống tự động chèn điều kiện lọc `WHERE p.toa_nha = ...` để ngăn xem chéo dữ liệu của tòa nhà khác.
- **`password.ts`**: Tiện ích băm (`hashPassword`) và so khớp (`verifyPassword`) mật khẩu tài khoản sử dụng thuật toán an toàn `bcryptjs`.
- **`number-to-words.ts`**: Chuyển đổi số tiền thành chuỗi chữ tiếng Việt chuẩn kế toán (ví dụ: `4180000` $\to$ _"Bốn triệu một trăm tám mươi nghìn đồng chẵn."_), phục vụ xuất phiếu thu Mẫu 01-TT.
- **`notifications.ts`**: Hàm gửi thông báo hệ thống vào bảng `public.thong_bao` để đồng bộ thông tin sang ứng dụng Mobile của cư dân khi có hóa đơn mới, duyệt phiếu thu, duyệt xe hoặc bàn giao phòng.
- **`meter-utils.ts`**: Tính toán sản lượng tiêu thụ điện/nước, kiểm tra cảnh báo chỉ số mới thấp hơn chỉ số cũ hoặc tăng đột biến.
- **`storage.ts`**: Module giao tiếp với Supabase Storage client để upload và xóa hình ảnh.
- **`handover.ts`**: Lưu và cập nhật danh mục tài sản bàn giao của phòng vào bảng `public.tai_san`.
- **`rate-limit.ts`**: Kiểm soát tần suất đăng nhập sai để ngăn chặn tấn công dò mật khẩu.
- **`guards.ts`**: Các hàm guard kiểm tra quyền hạn tài khoản trước khi thực hiện thao tác nhạy cảm.
- **`export.ts`**: Tiện ích chuyển đổi dữ liệu mảng thành file CSV/Excel UTF-8 có BOM hỗ trợ tiếng Việt không lỗi font.

---

### 3. Thư mục `src/components` (Giao diện dùng chung)

- **`admin-shell.tsx` & `admin-shell-layout.tsx`**: Khung sườn giao diện Admin gồm thanh điều hướng trên cùng, logo hệ thống, menu các phân hệ, bộ chọn cơ sở vận hành (`BuildingScopeSwitcher`), hiển thị tên người dùng và nút Đăng xuất.
- **`admin-skeleton.tsx`**: Giao diện khung chờ (Skeleton Loading) hiển thị mượt mà trong khi Server Components nạp dữ liệu.
- **`business.module.css`**: Hệ thống CSS Modules chuẩn hóa toàn bộ giao diện: thẻ tóm tắt (mini-stats), bảng dữ liệu (`table`), form nhập liệu (`formGrid`), huy hiệu trạng thái (`badgeOk`, `badgeWarn`, `badgeDanger`), bộ lọc (`filterCard`).
- **`handover-items-editor.tsx`**: Bảng kiểm kê thiết bị bàn giao tương tác trực tiếp (thêm/sửa/xóa tên tài sản, tình trạng hoạt động) dùng khi cọc và lập hợp đồng.
- **`confirm-modal.tsx` & `modal.tsx`**: Hộp thoại xác nhận thao tác nguy hiểm (Xóa phòng, hủy cọc, thanh lý hợp đồng).
- **`toast.tsx`**: Thông báo trạng thái nhanh góc màn hình.

---

### 4. Thư mục `scripts` (Công cụ DB & Migration)

- **`check-db.mjs`**: Kiểm tra kết nối tới Database qua biến môi trường.
- **`check-scope.mjs`**: Kiểm tra phân quyền truy cập theo từng chi nhánh/tòa nhà.
- **`inspect-managers.mjs`**: Liệt kê danh sách các tài khoản Admin & Quản lý hiện có.
- **`migrate-thong-bao.mjs`**: Migration tạo bảng `public.thong_bao` cho trung tâm thông báo cư dân.
- **`migrate-taisan.mjs`**: Migration chuẩn hóa bảng `public.tai_san` phục vụ bàn giao thiết bị phòng.
- **`migrate-loai-phong.mjs`**: Migration bổ sung thông tin tiện ích và loại phòng.
- **`migrate-room-meters.mjs`**: Migration bổ sung cột `chi_so_dien`, `chi_so_nuoc`, `ngay_cap_nhat_chi_so` vào bảng `public.phong` và đồng bộ số đo ban đầu từ kỳ ghi gần nhất.
- **`toggle-first-login.mjs`**: Bật/tắt cờ `da_doi_mat_khau` cho tài khoản khi cần kiểm thử luồng đổi mật khẩu lần đầu.

---

## 🔄 Các luồng nghiệp vụ cốt lõi

```mermaid
flowchart TD
    A[Khách xem phòng & Đặt cọc qua Mobile App] -->|Lưu vào public.giu_cho| B(Yêu cầu cọc xuất hiện tại /hop-dong)
    B -->|BQL bấm 'Tạo hợp đồng ngay'| C[Hệ thống tự động kích hoạt Hợp đồng]
    C -->|Tự động đối trừ tiền cọc| D[Cấp User Mobile App cho cư dân]
    D -->|Hàng tháng| E[Ghi chỉ số Điện & Nước tại /dien-nuoc]
    E -->|1-Click Chốt kỳ| F[Tự động sinh Hóa đơn hàng loạt tại /hoa-don]
    F -->|Khách nộp tiền mặt hoặc VietQR| G[Lập & Duyệt Phiếu thu tại /phieu-thu]
    G -->|Tự động gạch nợ hóa đơn| H[Gửi thông báo xác nhận sang App Cư dân]
    H -->|Hết hạn thuê| I[BQL bấm 'Thanh lý hợp đồng' tại /hop-dong/ID]
    I -->|Chốt số đo cuối & Khấu trừ cọc| J[Lưu Biên bản thanh lý & Mở lại phòng Trống]
```

---

## 🔐 Cơ chế Phân quyền Quản trị

| Vai trò (`vai_tro`) | Quyền hạn dữ liệu                                                                | Phạm vi cơ sở (`co_so_van_hanh`)                                                                           |
| :------------------ | :------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **`Admin`**         | Toàn quyền cấu hình hệ thống, quản lý tài khoản nhân viên, xem báo cáo tổng hợp. | **Toàn hệ thống** (Có thể chọn xem tất cả hoặc lọc theo từng tòa nhà bất kỳ).                              |
| **`QuanLy`**        | Quản lý vận hành hàng ngày (Phòng, Khách, Hợp đồng, Điện nước, Hóa đơn, Sự cố).  | **Chỉ xem và thao tác trên Tòa nhà được phân công** (Tự động khóa dữ liệu ngoài phạm vi qua `ScopeQuery`). |
| **`KhachThue`**     | Chỉ dùng để đăng nhập ứng dụng Mobile dành riêng cho cư dân.                     | Bị chặn hoàn toàn không thể đăng nhập vào cổng Web Admin này (`/login`).                                   |

---

## 📌 Lưu ý kỹ thuật quan trọng

1. **Next.js 16 Partial Prerendering (PPR) & Date.now()**:
   - Tuyệt đối không gọi trực tiếp `Date.now()`, `new Date()`, hoặc hàm tạo ngẫu nhiên trong Server Component Render Tree nếu không bọc trong `<Suspense>`.
   - Việc lấy mốc thời gian phiên đăng nhập đã được chuyển ra Network Edge tại [`src/proxy.ts`](file:///d:/2/src/proxy.ts) và truyền qua HTTP Header `x-session-time` để đảm bảo 100% trang prerender tĩnh không bị lỗi `Blocking RouteServer`.
2. **Quy chuẩn Phiếu thu (Lựa chọn A)**:
   - Phiếu thu khi đã ở trạng thái **`Đã xác nhận`** hoặc **`Đã khớp lệnh`** (VietQR) sẽ **bị khóa nút Sửa** trên toàn hệ thống để bảo đảm tính toàn vẹn chứng từ kế toán. Nếu có sai sót, quy trình cho phép xóa và lập phiếu mới để tính toán lại công nợ chính xác.
3. **Đồng bộ Đặt cọc hai chiều (Mobile ↔ Web)**:
   - Trạng thái phiếu cọc trong bảng `public.giu_cho` hỗ trợ đầy đủ cả dạng tiếng Việt có dấu (`'Đã thanh toán'`, `'Đang giữ'`, `'Chờ thanh toán'`) lẫn mã hệ thống (`'DaThanhToan'`, `'DangGiu'`, `'ChoThanhToan'`).
   - Trạng thái phòng trong `public.phong` nhận diện đồng bộ cả `'Đã cọc'` và `'Đã đặt cọc'`.
4. **Quy ước Chạy lệnh trên Windows**:
   - Khi thực thi các lệnh npm trên Windows PowerShell, ưu tiên sử dụng `npm.cmd [lệnh]` (ví dụ: `npm.cmd run dev`, `npm.cmd run build`) để tránh lỗi policy cấm chạy file script `npm.ps1`.
5. **Cơ chế Chỉ số Điện Nước Gắn Với Phòng (Room-level Meters)**:
   - Đồng hồ công tơ điện nước được định danh trực tiếp theo thực thể Phòng vật lý (`public.phong.chi_so_dien`, `public.phong.chi_so_nuoc`).
   - Khi chủ trọ tạo phòng mới hoặc sửa thông tin phòng, có thể gán/cập nhật chỉ số công tơ ban đầu.
   - Khi Ban Quản Lý phê duyệt kỳ ghi chỉ số (`trang_thai_duyet = 'Đã duyệt'`) hoặc tự ghi chỉ số mới tại `/dien-nuoc`, hệ thống tự động:
     1. Lưu lịch sử kỳ vào bảng `public.chi_so_dien_nuoc`.
     2. Cập nhật chỉ số mới nhất ngược lại vào bảng `public.phong`.
     3. Tự động kết chuyển chi tiết dịch vụ và sinh Hóa đơn tiền phòng & dịch vụ trọn gói (`public.hoa_don`).
   - Nhờ vậy, khi khách cũ rời đi hoặc đổi khách mới, số đo hiện tại của phòng luôn được kế thừa mượt mà mà không bị thất thoát hay phải nhập tay lại từ đầu.
