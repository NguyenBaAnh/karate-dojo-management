import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ThemeMode = 'light' | 'dark' | 'system';

export type SystemSettings = {
  general: {
    dojoName: string;
    shortName: string;
    slogan: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    timezone: string;
    currency: string;
    logoUrl: string | null;
  };
  appearance: {
    defaultTheme: ThemeMode;
    accentColor: string;
  };
  security: {
    allowPublicRegistration: boolean;
  };
  operations: {
    absenceWarningCount: number;
    tuitionWarningDays: number;
  };
};

const DEFAULTS: SystemSettings = {
  general: {
    dojoName: 'KARATE DOJO',
    shortName: 'KARATE',
    slogan: 'Management System',
    address: '',
    phone: '',
    email: '',
    website: '',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
    logoUrl: null,
  },
  appearance: {
    defaultTheme: 'light',
    accentColor: '#b91c1c',
  },
  security: {
    allowPublicRegistration: true,
  },
  operations: {
    absenceWarningCount: 2,
    tuitionWarningDays: 7,
  },
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private merge(raw: any): SystemSettings {
    return {
      general: { ...DEFAULTS.general, ...(raw?.general ?? {}) },
      appearance: { ...DEFAULTS.appearance, ...(raw?.appearance ?? {}) },
      security: { ...DEFAULTS.security, ...(raw?.security ?? {}) },
      operations: { ...DEFAULTS.operations, ...(raw?.operations ?? {}) },
    };
  }

  async get(): Promise<SystemSettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'system' } });
    return this.merge(row?.value);
  }

  async getPublic() {
    const settings = await this.get();
    const activatedUsers = await this.prisma.user.count({
      where: { passwordHash: { not: 'ACCOUNT_NOT_ACTIVATED' } },
    });
    return {
      dojoName: settings.general.dojoName,
      shortName: settings.general.shortName,
      slogan: settings.general.slogan,
      address: settings.general.address,
      phone: settings.general.phone,
      email: settings.general.email,
      website: settings.general.website,
      logoUrl: settings.general.logoUrl,
      defaultTheme: settings.appearance.defaultTheme,
      accentColor: settings.appearance.accentColor,
      registrationOpen: activatedUsers === 0 || settings.security.allowPublicRegistration,
      needsSetup: activatedUsers === 0,
    };
  }

  async update(patch: Partial<SystemSettings>) {
    const current = await this.get();
    const next: SystemSettings = {
      general: { ...current.general, ...(patch.general ?? {}) },
      appearance: { ...current.appearance, ...(patch.appearance ?? {}) },
      security: { ...current.security, ...(patch.security ?? {}) },
      operations: { ...current.operations, ...(patch.operations ?? {}) },
    };

    if (!next.general.dojoName.trim()) {
      throw new BadRequestException('Tên võ đường không được để trống');
    }
    if (!['light', 'dark', 'system'].includes(next.appearance.defaultTheme)) {
      throw new BadRequestException('Theme không hợp lệ');
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(next.appearance.accentColor)) {
      throw new BadRequestException('Màu chủ đạo phải có dạng #RRGGBB');
    }
    next.operations.absenceWarningCount = Math.max(1, Number(next.operations.absenceWarningCount || 2));
    next.operations.tuitionWarningDays = Math.max(1, Number(next.operations.tuitionWarningDays || 7));

    await this.prisma.systemSetting.upsert({
      where: { key: 'system' },
      create: { key: 'system', value: next as any },
      update: { value: next as any },
    });
    return this.get();
  }

  private uploadsDir() {
    return path.resolve(process.cwd(), 'uploads', 'system');
  }

  private decodeDataUrl(dataUrl: string) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(dataUrl || '');
    if (!match) throw new BadRequestException('Ảnh logo phải là JPG, PNG hoặc WEBP');
    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 4 * 1024 * 1024) throw new BadRequestException('Ảnh logo không được vượt quá 4 MB');
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return { mime, ext, buffer };
  }

  async saveLogo(dataUrl: string) {
    const { ext, buffer } = this.decodeDataUrl(dataUrl);
    const dir = this.uploadsDir();
    await mkdir(dir, { recursive: true });
    for (const oldExt of ['jpg', 'png', 'webp']) {
      await unlink(path.join(dir, `dojo-logo.${oldExt}`)).catch(() => undefined);
    }
    const filename = `dojo-logo.${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    const current = await this.get();
    return this.update({
      general: { ...current.general, logoUrl: '/api/settings/logo' },
    });
  }

  async deleteLogo() {
    const dir = this.uploadsDir();
    for (const ext of ['jpg', 'png', 'webp']) {
      await unlink(path.join(dir, `dojo-logo.${ext}`)).catch(() => undefined);
    }
    const current = await this.get();
    return this.update({
      general: { ...current.general, logoUrl: null },
    });
  }

  async logoFile() {
    const dir = this.uploadsDir();
    for (const item of [
      { ext: 'jpg', mime: 'image/jpeg' },
      { ext: 'png', mime: 'image/png' },
      { ext: 'webp', mime: 'image/webp' },
    ]) {
      try {
        const buffer = await readFile(path.join(dir, `dojo-logo.${item.ext}`));
        return { buffer, mime: item.mime };
      } catch {}
    }
    throw new NotFoundException('Chưa có logo võ đường');
  }

}