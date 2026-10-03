import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ClassContentsController } from './class-contents.controller.js';
import { ClassContentsService } from './class-contents.service.js';

@Module({ imports: [PrismaModule], controllers: [ClassContentsController], providers: [ClassContentsService] })
export class ClassContentsModule {}
