-- Attendance chỉ tồn tại khi người dùng đã chọn trạng thái điểm danh.
-- Bỏ mặc định PRESENT để không thể vô tình tạo một lượt "Có mặt" khi thiếu status.
ALTER TABLE "Attendance" ALTER COLUMN "status" DROP DEFAULT;
