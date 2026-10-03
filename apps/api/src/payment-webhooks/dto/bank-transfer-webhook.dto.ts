import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class BankTransferWebhookDto {
  @IsString()
  provider!: string;

  @IsString()
  transactionId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  description!: string;

  @IsDateString()
  transferredAt!: string;

  @IsOptional()
  @IsString()
  accountNo?: string;

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
