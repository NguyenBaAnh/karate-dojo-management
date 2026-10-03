import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { LearningPackagesController } from './learning-packages.controller.js';
import { LearningPackagesService } from './learning-packages.service.js';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [LearningPackagesController],
  providers: [LearningPackagesService],
  exports: [LearningPackagesService],
})
export class LearningPackagesModule {}
