import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ReportsExportService } from './reports-export.service.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly exportService: ReportsExportService,
  ) {}

  @Get('overview')
  overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.overview(from, to, branchId || undefined);
  }

  @Get('attendance')
  attendance(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.attendance(from, to, branchId || undefined);
  }

  @Get('debts')
  debts(@Query('branchId') branchId?: string) {
    return this.service.debts(branchId || undefined);
  }

  @Get('finance')
  finance(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.finance(from, to, branchId || undefined);
  }

  @Get('risks')
  risks(@Query('branchId') branchId?: string) {
    return this.service.risks(branchId || undefined);
  }

  @Get('export/excel')
  async exportExcel(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.exportService.excel({
      from,
      to,
      branchId: branchId || undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }

  @Get('export/pdf')
  async exportPdf(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.exportService.pdf({
      from,
      to,
      branchId: branchId || undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }
}
