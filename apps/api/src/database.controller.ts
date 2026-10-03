import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Controller('database')
export class DatabaseController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('check')
  async checkDatabase() {
    const result = await this.prisma.$queryRaw`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS time
    `;

    return {
      success: true,
      message: 'PostgreSQL connected successfully',
      result,
    };
  }
}