import { IsNotEmpty, IsString } from 'class-validator';

export class CopyClassEnrollmentsDto {
  @IsString()
  @IsNotEmpty()
  sourceClassId!: string;

  @IsString()
  @IsNotEmpty()
  targetClassId!: string;
}
