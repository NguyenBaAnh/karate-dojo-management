import { Body, Controller, Delete, Get, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IntegrationService } from './integration.service.js';
import { SettingsService, type SystemSettings } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly service: SettingsService,
    private readonly integrations: IntegrationService,
  ) {}

  @Get('public')
  publicSettings() {
    return this.service.getPublic();
  }

  @Get('logo')
  async logo(@Res() response: Response) {
    const file = await this.service.logoFile();
    response.type(file.mime).send(file.buffer);
  }

  @Get()
  async settings() {
    return {
      ...(await this.service.get()),
      integrations: await this.integrations.summary(),
    };
  }

  @Patch()
  update(@Body() body: Partial<SystemSettings>) {
    return this.service.update(body ?? {});
  }

  @Post('logo')
  uploadLogo(@Body() body: { dataUrl?: string }) {
    return this.service.saveLogo(String(body?.dataUrl ?? ''));
  }

  @Delete('logo')
  deleteLogo() {
    return this.service.deleteLogo();
  }
}
