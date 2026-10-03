import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { PaymentWebhooksController } from './payment-webhooks.controller.js';
import { PaymentWebhooksService } from './payment-webhooks.service.js';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [PaymentWebhooksController],
  providers: [PaymentWebhooksService],
})
export class PaymentWebhooksModule {}
