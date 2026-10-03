import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SaveAttendanceRowDto {
  @IsString()
  studentId!: string;

  // null/undefined = chưa ghi nhận. Khi lưu, backend sẽ xóa bản ghi
  // Attendance cũ (nếu có) thay vì tự gán PRESENT.
  @IsOptional()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'MAKEUP'])
  status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'MAKEUP' | null;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SaveAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveAttendanceRowDto)
  rows!: SaveAttendanceRowDto[];
}
