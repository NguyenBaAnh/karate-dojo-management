import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePackagePaymentDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsIn(['CASH', 'BANK_TRANSFER', 'VIETQR', 'CARD', 'OTHER'])
  method!: 'CASH' | 'BANK_TRANSFER' | 'VIETQR' | 'CARD' | 'OTHER';

  @IsOptional()
  @IsString()
  note?: string;
}
