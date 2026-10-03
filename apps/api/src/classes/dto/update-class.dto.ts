import {
    IsBoolean,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Min,
  } from 'class-validator';
  
  export class UpdateClassDto {
    @IsOptional()
    @IsString()
    code?: string;
  
    @IsOptional()
    @IsString()
    name?: string;
  
    @IsOptional()
    @IsString()
    description?: string;
  
    @IsOptional()
    @IsString()
    branchId?: string;
  
    @IsOptional()
    @IsString()
    teacherId?: string;
  
    @IsOptional()
    @IsInt()
    @Min(1)
    capacity?: number;
  
    @IsOptional()
    @IsString()
    scheduleText?: string;
  
    @IsOptional()
    @IsNumber()
    @Min(0)
    tuitionPerSession?: number;
  
    @IsOptional()
    @IsBoolean()
    active?: boolean;
  }