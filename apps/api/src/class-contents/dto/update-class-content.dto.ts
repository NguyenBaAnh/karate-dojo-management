import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateClassContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}
