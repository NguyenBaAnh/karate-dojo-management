export class UpdateStaffPersonDto {
  username?: string;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  roleIds?: string[];

  isTeacher?: boolean;
  employeeCode?: string;
  payPerSession?: number | null;
  payPerHour?: number | null;
}
