import { IsInt, IsString, Min } from 'class-validator';

export class AdjustStockDto {
  @IsInt()
  quantity!: number;

  @IsString()
  reason!: string;
}
