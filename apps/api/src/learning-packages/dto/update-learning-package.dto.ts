import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateLearningPackageDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['TIME_BASED', 'SESSION_BASED', 'PT', 'CUSTOM'])
  billingType?: 'TIME_BASED' | 'SESSION_BASED' | 'PT' | 'CUSTOM';

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
