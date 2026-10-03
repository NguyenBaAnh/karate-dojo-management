export class CreateTimesheetDto {
  teacherId!: string;
  workDate!: string;
  minutes?: number;
  sessionCount?: number;
  sessionId?: string;
  amount?: number;
  note?: string;
}
