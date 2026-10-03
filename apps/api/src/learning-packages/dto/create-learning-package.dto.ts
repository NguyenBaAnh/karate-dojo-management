import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateLearningPackageDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['TIME_BASED', 'SESSION_BASED', 'PT', 'CUSTOM'])
  billingType!: 'TIME_BASED' | 'SESSION_BASED' | 'PT' | 'CUSTOM';

  @IsOptional()
  @IsInt()
  @Min(1)
  durationValue?: number;

  @IsOptional()
  @IsIn(['DAY', 'WEEK', 'MONTH'])
  durationUnit?: 'DAY' | 'WEEK' | 'MONTH';

  @IsOptional()
  @IsInt()
  @Min(1)
  sessionsPerWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  includedSessions?: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
