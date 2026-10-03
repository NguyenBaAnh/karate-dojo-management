import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BranchAdminController } from './branch-admin.controller.js';
import { BranchAdminService } from './branch-admin.service.js';

@Module({ imports: [PrismaModule], controllers: [BranchAdminController], providers: [BranchAdminService] })
export class BranchAdminModule {}
