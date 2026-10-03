import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    EnrollmentsController,
  ],

  providers: [
    EnrollmentsService,
  ],

  exports: [
    EnrollmentsService,
  ],
})
export class EnrollmentsModule {}