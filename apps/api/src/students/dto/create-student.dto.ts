import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

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

  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
