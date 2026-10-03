import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { DatabaseController } from './database.controller.js';
import { StudentsModule } from './students/students.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { ClassSessionsModule } from './class-sessions/class-sessions.module.js';
import { LearningPackagesModule } from './learning-packages/learning-packages.module.js';
import { PaymentWebhooksModule } from './payment-webhooks/payment-webhooks.module.js';
import { StudentAvatarsModule } from './student-avatars/student-avatars.module.js';
import { ClassContentsModule } from './class-contents/class-contents.module.js';
import { BranchAdminModule } from './branch-admin/branch-admin.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { FinanceSalesModule } from './finance-sales/finance-sales.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ZaloAutomationModule } from './zalo-automation/zalo-automation.module.js';
import { StaffModule } from './staff/staff.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  imports: [
    PrismaModule,
    BranchesModule,
    StudentsModule,
    ClassesModule,
    EnrollmentsModule,
    ClassSessionsModule,
    LearningPackagesModule,
    PaymentWebhooksModule,
    StudentAvatarsModule,
    ClassContentsModule,
    BranchAdminModule,
    DashboardModule,
    FinanceSalesModule,
    ReportsModule,
    ZaloAutomationModule,
    StaffModule,
    AuthModule,
    SettingsModule,
  ],

  controllers: [
    AppController,
    DatabaseController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}