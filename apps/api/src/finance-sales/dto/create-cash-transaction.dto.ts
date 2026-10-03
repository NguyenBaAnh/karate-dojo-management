import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum CashTransactionTypeDto {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export class CreateCashTransactionDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsEnum(CashTransactionTypeDto)
  type!: CashTransactionTypeDto;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
