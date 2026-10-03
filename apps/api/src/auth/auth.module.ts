import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessGuard } from './access.guard.js';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    JwtModule.register({
      secret: process.env.AUTH_JWT_SECRET || 'karate-local-dev-secret-change-me',
      signOptions: { expiresIn: 28_800 },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
