export const PERMISSIONS = [
  ['DASHBOARD_VIEW', 'Xem tổng quan'],
  ['STUDENTS_VIEW', 'Xem học viên'],
  ['STUDENTS_MANAGE', 'Quản lý học viên'],
  ['CLASSES_VIEW', 'Xem lớp học'],
  ['CLASSES_MANAGE', 'Quản lý lớp học'],
  ['ATTENDANCE_VIEW', 'Xem điểm danh'],
  ['ATTENDANCE_MANAGE', 'Chấm/sửa điểm danh'],
  ['TUITION_VIEW', 'Xem học phí & công nợ'],
  ['TUITION_MANAGE', 'Quản lý học phí & thanh toán'],
  ['FINANCE_VIEW', 'Xem thu chi & bán hàng'],
  ['FINANCE_MANAGE', 'Quản lý thu chi & bán hàng'],
  ['REPORTS_VIEW', 'Xem báo cáo'],
  ['REPORTS_EXPORT', 'Xuất Excel/PDF báo cáo'],
  ['STAFF_VIEW', 'Xem nhân sự & giáo viên'],
  ['STAFF_MANAGE', 'Quản lý nhân sự & phân công'],
  ['PAYROLL_VIEW', 'Xem chấm công & lương'],
  ['PAYROLL_MANAGE', 'Quản lý chấm công & lương'],
  ['BRANCHES_VIEW', 'Xem chi nhánh'],
  ['BRANCHES_MANAGE', 'Quản lý chi nhánh'],
  ['SETTINGS_VIEW', 'Xem thiết lập'],
  ['SETTINGS_MANAGE', 'Thay đổi thiết lập'],
  ['ACCESS_MANAGE', 'Quản lý tài khoản & phân quyền'],
  ['NOTIFICATIONS_MANAGE', 'Quản lý Zalo/thông báo'],
  ['INTEGRATIONS_VIEW', 'Xem cấu hình tích hợp'],
  ['INTEGRATIONS_MANAGE', 'Quản lý tích hợp Zalo/VietQR'],
] as const;

export const ROLE_DEFAULTS: Record<string, string[]> = {
  OWNER: PERMISSIONS.map(([code]) => code),
  MANAGER: PERMISSIONS.map(([code]) => code).filter((code) => code !== 'ACCESS_MANAGE'),
  TEACHER: [
    'DASHBOARD_VIEW', 'STUDENTS_VIEW', 'CLASSES_VIEW',
    'ATTENDANCE_VIEW', 'ATTENDANCE_MANAGE', 'STAFF_VIEW',
  ],
  CASHIER: [
    'DASHBOARD_VIEW', 'STUDENTS_VIEW', 'TUITION_VIEW', 'TUITION_MANAGE',
    'FINANCE_VIEW', 'FINANCE_MANAGE', 'REPORTS_VIEW', 'REPORTS_EXPORT',
  ],
  STAFF: ['DASHBOARD_VIEW', 'STUDENTS_VIEW', 'CLASSES_VIEW', 'ATTENDANCE_VIEW'],
  GUEST: [],
};

export const ROLE_META = [
  { code: 'OWNER', name: 'Chủ võ đường', description: 'Toàn quyền hệ thống' },
  { code: 'MANAGER', name: 'Quản lý', description: 'Quản lý vận hành võ đường' },
  { code: 'TEACHER', name: 'Giáo viên', description: 'Lớp học, điểm danh và học viên' },
  { code: 'CASHIER', name: 'Thu ngân', description: 'Học phí, thu chi và bán hàng' },
  { code: 'STAFF', name: 'Nhân viên', description: 'Quyền vận hành cơ bản' },
  { code: 'GUEST', name: 'Khách', description: 'Tài khoản tự đăng ký, chưa được cấp quyền vận hành' },
];
