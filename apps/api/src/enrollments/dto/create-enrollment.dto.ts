import {
    IsNumber,
    IsOptional,
    IsString,
    Min,
  } from 'class-validator';
  
  export class CreateEnrollmentDto {
    @IsString()
    studentId!: string;
  
    @IsString()
    classId!: string;
  
    @IsOptional()
    @IsNumber()
    @Min(0)
    customPricePerSession?: number;
  }