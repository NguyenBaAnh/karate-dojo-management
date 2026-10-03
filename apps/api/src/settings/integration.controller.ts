import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { IntegrationService } from './integration.service.js';

@Controller('settings/integrations')
export class IntegrationController {
  constructor(private readonly integrations: IntegrationService) {}

  @Get()
  settings() {
    return this.integrations.safeView();
  }

  @Patch('zalo')
  updateZalo(@Body() body: any) {
    return this.integrations.updateZalo(body ?? {});
  }

  @Post('zalo/test')
  testZalo(@Body() body: { recipient?: string }) {
    return this.integrations.sendZaloTest(body?.recipient);
  }

  @Get('zalo/logs')
  logs(@Query('limit') limit?: string) {
    return this.integrations.recentZaloLogs(Number(limit ?? 20));
  }

  @Patch('vietqr')
  updateVietQr(@Body() body: any) {
    return this.integrations.updateVietQr(body ?? {});
  }

  @Post('vietqr/test')
  testVietQr() {
    return this.integrations.testVietQr();
  }
}
