import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSaleItemDto {
  productId!: string;
  quantity!: number;
}

export class CreateSaleDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsIn(['CASH', 'BANK_TRANSFER', 'OTHER'])
  paymentMethod!: 'CASH' | 'BANK_TRANSFER' | 'OTHER';

  @IsOptional()
  @IsString()
  saleNo?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  paymentNote?: string;

  @IsArray()
  @ArrayMinSize(1)
  items!: CreateSaleItemDto[];
}
