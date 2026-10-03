# ARCHITECTURE

## 1. Kiến trúc tổng thể

```text
React/Vite (Web responsive)
        |
        | HTTP REST
        v
NestJS API
        |
        +-- Auth / RBAC
        +-- Students / Guardians
        +-- Classes / Enrollments / Sessions
        +-- Attendance
        +-- Tuition / Payments / Receipts
        +-- Finance / Sales
        +-- Teachers / Timesheets / Tasks
        +-- Reports
        +-- Notifications
        +-- Integrations
                +-- Zalo OA / ZBS
                +-- VietQR / Payment webhook
        |
        v
Prisma ORM
        |
        v
PostgreSQL
```

## 2. Nguyên tắc dữ liệu quan trọng

### Attendance là nguồn dữ liệu trung tâm
Một bản ghi điểm danh có thể được dùng để:
- tính chuyên cần;
- cảnh báo nghỉ liên tiếp;
- tính học phí theo buổi;
- đối chiếu số buổi học;
- tính công/lương giáo viên;
- tạo báo cáo lớp.

### TuitionInvoice là snapshot theo kỳ
Không nên tính lại học phí “live” mỗi lần mở màn hình. Khi chốt kỳ:
1. lấy attendance;
2. tính số buổi;
3. áp đơn giá;
4. trừ bảo lưu/giảm giá;
5. lưu invoice + items;
6. theo dõi payment.

### Payment và Receipt tách riêng
- Payment: tiền đã nhận.
- Receipt: phiếu thu đã phát hành.
Một payment thành công có thể tự sinh receipt.

## 3. Quyền truy cập

Ví dụ permission:
- student.read
- student.create
- student.update
- attendance.read
- attendance.check
- tuition.read
- tuition.generate
- tuition.collect
- finance.read
- finance.create
- report.export
- teacher.timesheet
- task.manage
- settings.manage

Role chỉ là nhóm permission, không hard-code quyền theo tên role.

## 4. Bảo mật cần làm khi chuyển production

- Hash mật khẩu bằng Argon2/bcrypt.
- JWT access token + refresh token.
- Rate limit login.
- Audit log cho tài chính và điểm danh.
- Không lưu access token Zalo/API key trong Git.
- HTTPS khi deploy.
- Backup PostgreSQL định kỳ.
- Phụ huynh chỉ được query học viên có liên kết StudentGuardian.
