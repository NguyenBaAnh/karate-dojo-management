# ROADMAP - Hệ thống quản lý võ đường Karate

## Giai đoạn 0 - Đã làm trong bản 0.1
- [x] Chuẩn hóa project React + NestJS
- [x] Dashboard Karate responsive
- [x] Màn hình học viên
- [x] Màn hình lớp học
- [x] Điểm danh online demo
- [x] Học phí/công nợ demo
- [x] Thu chi/bán hàng demo
- [x] Báo cáo demo
- [x] Nhân sự/giáo viên/phân quyền demo
- [x] Prisma schema cho nghiệp vụ chính
- [x] Cấu hình Docker PostgreSQL
- [x] Chuẩn bị biến môi trường Zalo/VietQR

## Giai đoạn 1 - Core database + đăng nhập
- [ ] Prisma migration
- [ ] Seed dữ liệu mẫu
- [ ] PrismaService
- [ ] Auth bằng JWT + refresh token
- [ ] Mật khẩu bcrypt/argon2
- [ ] Guard phân quyền theo Permission
- [ ] CRUD Branch
- [ ] CRUD User/Role/Permission

## Giai đoạn 2 - Học viên/lớp/điểm danh
- [ ] CRUD Student
- [ ] CRUD Guardian
- [ ] CRUD Class
- [ ] Enrollment
- [ ] Sinh ClassSession theo lịch
- [ ] Điểm danh theo buổi
- [ ] Điểm danh tối ưu mobile
- [ ] Lịch sử điểm danh học viên
- [ ] Báo cáo điểm danh lớp
- [ ] Cảnh báo nghỉ N buổi liên tiếp
- [ ] Giáo viên nhập nội dung học tập

## Giai đoạn 3 - Học phí/tài chính
- [ ] Tuition policy theo lớp/học viên
- [ ] Engine tính học phí theo Attendance
- [ ] Invoice theo tháng/kỳ
- [ ] Nội dung và số tiền riêng từng học viên
- [ ] Công nợ / overdue
- [ ] FeeReservation
- [ ] Payment
- [ ] Receipt
- [ ] Xuất phiếu thu PDF
- [ ] Thu chi
- [ ] Báo cáo doanh thu/chi phí/công nợ

## Giai đoạn 4 - Bán hàng/giáo viên/phụ huynh
- [ ] Product + tồn kho
- [ ] Sale/POS
- [ ] TeacherTimesheet
- [ ] Salary calculation
- [ ] Task management
- [ ] Parent login
- [ ] Parent chỉ xem con mình
- [ ] Điểm danh/học phí/đánh giá cho phụ huynh

## Giai đoạn 5 - Tích hợp
- [ ] Branding/logo
- [ ] VietQR
- [ ] Payment webhook
- [ ] Zalo OA
- [ ] ZBS template
- [ ] Tự nhắc học
- [ ] Tự nhắc học phí
- [ ] Tự cảnh báo nghỉ học
- [ ] Tự gửi phiếu thu

## Giai đoạn 6 - Báo cáo và production
- [ ] Excel export
- [ ] PDF export
- [ ] Chart doanh thu/chuyên cần/công nợ
- [ ] Audit log
- [ ] Backup database
- [ ] Docker production
- [ ] HTTPS/domain
- [ ] Monitoring/logging
