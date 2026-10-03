export class UpdateTimesheetDto {
  teacherId?: string;
  workDate?: string;
  minutes?: number;
  sessionCount?: number;
  amount?: number | null;
  note?: string | null;
}
