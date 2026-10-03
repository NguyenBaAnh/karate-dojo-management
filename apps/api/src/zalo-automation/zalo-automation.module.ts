import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ZaloAutomationController } from './zalo-automation.controller.js';
import { ZaloAutomationService } from './zalo-automation.service.js';

@Module({
  imports: [
    PrismaModule,
    ReportsModule,
    SettingsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [ZaloAutomationController],
  providers: [ZaloAutomationService],
})
export class ZaloAutomationModule {}
