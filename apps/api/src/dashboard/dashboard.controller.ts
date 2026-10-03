import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get('overview') overview(@Query('branchId') branchId?: string) {
    return this.service.overview(branchId || undefined);
  }
}
