import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateStudentPackageDto {
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsDateString()
  paymentDueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
