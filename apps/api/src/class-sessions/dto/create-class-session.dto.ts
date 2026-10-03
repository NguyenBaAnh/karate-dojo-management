import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateClassSessionDto {
  @IsString()
  classId!: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
