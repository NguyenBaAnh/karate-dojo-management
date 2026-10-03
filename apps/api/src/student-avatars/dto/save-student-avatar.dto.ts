import { IsString, MaxLength } from 'class-validator';

export class SaveStudentAvatarDto {
  @IsString()
  @MaxLength(8_000_000)
  dataUrl!: string;
}
