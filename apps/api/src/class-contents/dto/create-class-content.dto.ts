import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClassContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}
