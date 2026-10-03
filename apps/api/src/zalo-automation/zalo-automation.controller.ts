import { Body, Controller, Get, Post } from '@nestjs/common';

import { ZaloAutomationService } from './zalo-automation.service.js';

@Controller('zalo-automation')
export class ZaloAutomationController {
  constructor(private readonly service: ZaloAutomationService) {}

  @Get('status')
  status() {
    return this.service.status();
  }

  @Post('run-now')
  runNow() {
    return this.service.runNow();
  }

  @Post('test')
  test(@Body() body: { recipient?: string }) {
    return this.service.test(body?.recipient);
  }
}
