import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StudentAvatarsController } from './student-avatars.controller.js';
import { StudentAvatarsService } from './student-avatars.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [StudentAvatarsController],
  providers: [StudentAvatarsService],
})
export class StudentAvatarsModule {}
