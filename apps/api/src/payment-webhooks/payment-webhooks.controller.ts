import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { PaymentWebhooksService } from './payment-webhooks.service.js';
import { BankTransferWebhookDto } from './dto/bank-transfer-webhook.dto.js';
import { ManualMatchDto } from './dto/manual-match.dto.js';

@Controller('payment-webhooks')
export class PaymentWebhooksController {
  constructor(
    private readonly service: PaymentWebhooksService,
  ) {}

  @Post('bank-transfer')
  async receiveBankTransfer(
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() dto: BankTransferWebhookDto,
  ) {
    await this.service.verifySecret(secret);
    return this.service.receiveBankTransfer(dto);
  }

  @Get('events')
  findEvents(
    @Query('status') status?: string,
  ) {
    return this.service.findEvents(status);
  }

  @Post('events/:id/match')
  manualMatch(
    @Param('id') id: string,
    @Body() dto: ManualMatchDto,
  ) {
    return this.service.manualMatch(
      id,
      dto.invoiceId,
    );
  }
}
