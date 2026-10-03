import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { FinanceSalesController } from './finance-sales.controller.js';
import { FinanceSalesService } from './finance-sales.service.js';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [FinanceSalesController],
  providers: [FinanceSalesService],
})
export class FinanceSalesModule {}
