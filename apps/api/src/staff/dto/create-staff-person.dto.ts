export class CreateStaffPersonDto {
  username!: string;
  fullName!: string;
  phone?: string;
  email?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  roleIds?: string[];

  isTeacher?: boolean;
  // Mã giáo viên được backend tự sinh khi isTeacher = true.
  employeeCode?: string;
  payPerSession?: number;
  payPerHour?: number;
}
