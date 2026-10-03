import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
  } from 'class-validator';
  
  export class CreateClassDto {
    @IsString()
    @IsNotEmpty()
    code!: string;
  
    @IsString()
    @IsNotEmpty()
    name!: string;
  
    @IsOptional()
    @IsString()
    description?: string;
  
    @IsString()
    @IsNotEmpty()
    branchId!: string;
  
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
  }