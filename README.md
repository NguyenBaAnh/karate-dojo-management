# Karate Dojo Management System

Bản nâng cấp từ project `education-management` sang hệ thống quản lý võ đường Karate.

## 1. Công nghệ

- Frontend: React 19 + TypeScript + Vite
- Backend: NestJS 12 + TypeScript
- Database: PostgreSQL 17
- ORM: Prisma 7
- Chạy local: Docker Compose + pnpm

> Bản `0.1.0` tập trung vào kiến trúc và màn hình nghiệp vụ để demo. API nghiệp vụ hiện dùng dữ liệu mẫu trong RAM, còn schema Prisma đã mô hình hóa đầy đủ để chuyển sang PostgreSQL ở bước tiếp theo.

## 2. Những chức năng đã dựng trong bản 0.1

### Học viên / lớp
- Danh sách và tìm kiếm học viên
- Trạng thái đang học / bảo lưu
- Lớp, giáo viên, lịch học, sĩ số
- Lưu lịch sử học qua Enrollment, Attendance, LearningNote

### Điểm danh
- Điểm danh online từ laptop / điện thoại / tablet
- Có mặt / vắng / trễ / có phép
- Cảnh báo nghỉ liên tiếp
- Điểm danh là dữ liệu gốc để tính học phí và lương

### Học phí / công nợ
- Thiết kế tính học phí theo số buổi thực học
- Hóa đơn học phí theo kỳ
- Công nợ, trễ hạn, số tiền đã đóng
- Bảo lưu học phí
- Payment + Receipt để tự xuất phiếu thu
- Sẵn mô hình QR thanh toán riêng từng học viên

### Thu chi / bán hàng
- Sổ thu chi
- Hàng hóa, tồn kho cơ bản
- Đơn bán hàng và chi tiết đơn

### Giáo viên / nhân viên
- Chấm công theo buổi / thời lượng
- Dữ liệu tính lương
- Giao việc
- Role + Permission để phân quyền linh hoạt

### Phụ huynh / thông báo
- Guardian + StudentGuardian
- Có trường `canLogin` cho cổng phụ huynh
- NotificationLog cho Zalo / SMS / email / in-app

## 3. Chạy dự án từ đầu

### Bước 1 - Cài phần mềm
Cài:
- Node.js 22 trở lên
- pnpm
- Docker Desktop

Kiểm tra:
```bash
node -v
pnpm -v
docker -v
```

### Bước 2 - Mở PostgreSQL
Tại thư mục gốc:
```bash
docker compose up -d
```

PostgreSQL local:
- host: `localhost`
- port: `5432`
- database: `education_management`
- user: `education`
- password: `education123`

### Bước 3 - Cài dependency
```bash
pnpm install
```

### Bước 4 - Chuẩn bị biến môi trường
Trong `apps/api`:
```bash
copy .env.example .env
```

Trong `apps/web`:
```bash
copy .env.example .env
```

Trên macOS/Linux đổi `copy` thành `cp`.

### Bước 5 - Chạy API
Mở terminal 1:
```bash
pnpm dev:api
```

Kiểm tra:
- `GET http://localhost:3000/api/health`
- `GET http://localhost:3000/api/dashboard`
- `GET http://localhost:3000/api/students`
- `GET http://localhost:3000/api/attendance/today`

### Bước 6 - Chạy giao diện
Mở terminal 2:
```bash
pnpm dev:web
```

Truy cập địa chỉ Vite in ra, thường là:
`http://localhost:5173`

## 4. Nối Prisma với PostgreSQL

Schema đã nằm tại:
`apps/api/prisma/schema.prisma`

Sau khi cài dependency:
```bash
pnpm prisma:generate
pnpm prisma:migrate
```

Khi Prisma yêu cầu tên migration có thể đặt:
`init_karate_dojo`

Sau bước này chuyển `FeaturesService` từ dữ liệu demo sang các service dùng Prisma.

## 5. Luồng nghiệp vụ nên làm tiếp

### Luồng điểm danh
1. Admin tạo lớp.
2. Xếp học viên vào lớp.
3. Sinh buổi học (`ClassSession`).
4. Giáo viên mở màn hình điểm danh.
5. Lưu `Attendance`.
6. Sau mỗi buổi cập nhật số lần nghỉ liên tiếp.
7. Nếu vượt ngưỡng thì tạo cảnh báo / NotificationLog.

### Luồng học phí theo điểm danh
1. Chọn kỳ tính phí.
2. Lấy tất cả Attendance có trạng thái tính phí.
3. Xác định đơn giá của học viên hoặc lớp.
4. `subtotal = số buổi x đơn giá`.
5. Trừ giảm giá và phần bảo lưu được sử dụng.
6. Tạo `TuitionInvoice` + `TuitionInvoiceItem`.
7. Tạo nội dung chuyển khoản riêng, ví dụ `HP HV002 T092026`.
8. Sinh VietQR.
9. Khi nhận thanh toán: tạo `Payment`.
10. Cập nhật paidAmount/status và sinh `Receipt`.

### Luồng trễ học phí
1. Job chạy mỗi sáng.
2. Tìm invoice chưa thanh toán và `dueDate < today`.
3. Đổi trạng thái thành `OVERDUE`.
4. Ghi `NotificationLog`.
5. Gửi Zalo theo template.
6. Hiện badge/cảnh báo trên dashboard.

## 6. Tích hợp VietQR

Có hai mức:

### Demo nhanh
Dùng VietQR Quick Link để hiển thị QR theo tài khoản + số tiền + nội dung.

### Chính thức
Dùng API `v2/generate`, cấu hình:
- `VIETQR_CLIENT_ID`
- `VIETQR_API_KEY`
- ngân hàng/BIN
- tài khoản nhận tiền

Nếu muốn tự xác nhận giao dịch, dùng payment gateway/webhook (ví dụ payOS) thay vì chỉ hiển thị ảnh QR.

## 7. Tích hợp Zalo

Tạo Zalo App + Official Account. Sau đó cấu hình access token và các template thông báo.

Nên tách 1 module `notifications`:
- `ZaloProvider`
- `sendTuitionReminder()`
- `sendAbsenceWarning()`
- `sendClassReminder()`
- `sendLearningReport()`

Không hard-code token trong source; luôn đặt trong `.env`.

## 8. Thứ tự phát triển đề nghị

Xem chi tiết tại `ROADMAP.md`.

Ưu tiên:
1. Auth + phân quyền
2. CRUD học viên/lớp/đăng ký lớp
3. Điểm danh thật bằng PostgreSQL
4. Học phí theo điểm danh + công nợ + bảo lưu
5. Thu chi + bán hàng
6. Giáo viên/chấm công/lương
7. Phiếu thu PDF + Excel/PDF reports
8. VietQR + webhook thanh toán
9. Zalo OA/ZBS
10. Cổng phụ huynh
11. Dashboard phân tích nâng cao

## 9. Lưu ý khi nộp / deploy

Không đóng gói:
- `node_modules`
- `dist`
- `.git`
- file `.env` có token thật

Nên nộp:
- source code
- `.env.example`
- migration/schema
- README
- ảnh demo
- tài khoản demo
