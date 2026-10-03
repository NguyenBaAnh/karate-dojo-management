# FEATURE MATRIX

Trạng thái:
- **Demo UI/API**: đã có màn hình và/hoặc API dữ liệu mẫu để demo luồng.
- **Schema ready**: cơ sở dữ liệu đã thiết kế nhưng chưa nối CRUD thật.
- **Next**: cần triển khai ở giai đoạn sau.

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Điểm danh online | Demo UI/API + Schema ready | Có mặt / vắng / trễ / có phép |
| Quản lý học sinh | Demo UI/API + Schema ready | Student, Guardian |
| Quản lý lớp học | Demo UI/API + Schema ready | Class, Enrollment, ClassSession |
| Báo cáo học sinh nghỉ học | Demo UI/API + Schema ready | Có cảnh báo nghỉ liên tiếp |
| Thu chi | Demo UI/API + Schema ready | CashTransaction |
| Tính học phí theo điểm danh | Demo UI + Schema ready | TuitionInvoice + Attendance |
| Báo cáo công nợ / trễ hạn | Demo UI/API + Schema ready | InvoiceStatus OVERDUE |
| Bảo lưu học phí | Demo UI + Schema ready | FeeReservation |
| Bán hàng | Demo UI + Schema ready | Product, Sale, SaleItem |
| Xuất báo cáo điểm danh cả lớp | Next | Cần Excel/PDF export |
| Xuất thông báo học phí hàng loạt | Demo UI + Schema ready | Gửi thật ở giai đoạn Zalo |
| Mã QR thanh toán | Schema/config ready | VietQR cần thông tin ngân hàng/API |
| Lưu lịch sử học từng học viên | Schema ready | Enrollment, Attendance, LearningNote |
| Cảnh báo nghỉ học liên tiếp | Demo UI/API + Schema ready | Job tự động là bước tiếp |
| Báo trễ HP / nợ HP / số buổi đã học | Demo UI/API + Schema ready | |
| Nội dung + số tiền HP riêng từng học sinh | Schema ready | customContent + invoice items |
| Chart báo cáo thống kê | Demo UI | Nâng cấp chart thật ở giai đoạn report |
| Phân quyền nhân viên | Schema ready + Demo UI | Role, Permission |
| Chấm công giáo viên | Schema ready + Demo UI | TeacherTimesheet |
| Giao việc nhân viên | Schema ready + Demo UI | Task |
| Logo thương hiệu | Config ready | Branch.logoUrl |
| Quyền truy cập phụ huynh | Schema ready | Guardian.canLogin |
| GV nhập nội dung học tập | Schema ready + Demo UI | LearningNote |
| Zalo tự động | Config ready | Cần Zalo App/OA/token/template |
| Xuất phiếu thu tự động | Schema ready | Receipt, PDF là bước tiếp |
| Xem điểm danh / học phí / đánh giá | Schema ready | Cổng phụ huynh là giai đoạn 4 |
| Tính lương theo điểm danh / lịch | Schema ready | TeacherTimesheet |
| Phụ huynh thanh toán, tự xuất phiếu | Schema ready | Cần webhook thanh toán |
| Phân tích báo cáo chuyên nghiệp | Demo UI | Cần dữ liệu thật + chart/export |
