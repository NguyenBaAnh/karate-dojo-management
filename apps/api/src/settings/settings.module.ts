import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { IntegrationController } from './integration.controller.js';
import { IntegrationService } from './integration.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController, IntegrationController],
  providers: [SettingsService, IntegrationService],
  exports: [SettingsService, IntegrationService],
})
export class SettingsModule {}
