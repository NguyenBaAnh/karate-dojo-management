import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  beltLevel?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'INACTIVE'])
  status?: 'ACTIVE' | 'PAUSED' | 'INACTIVE';

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
