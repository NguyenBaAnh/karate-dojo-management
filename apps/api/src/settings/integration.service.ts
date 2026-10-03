import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';

export type ZaloIntegrationConfig = {
  enabled: boolean;
  oaId: string;
  appId: string;
  adminUid: string;
  sendUrl: string;
  classReminders: boolean;
  classReminderMinutes: number;
  tuitionDueReminders: boolean;
  tuitionDueDays: number;
  tuitionDueTime: string;
  overdueReminders: boolean;
  overdueTime: string;
  evaluationMessages: boolean;
  dailyReport: boolean;
  dailyReportTime: string;
};

export type VietQrIntegrationConfig = {
  enabled: boolean;
  mode: 'quicklink' | 'api';
  bankId: string;
  accountNo: string;
  accountName: string;
  template: string;
  tuitionPrefix: string;
  salesPrefix: string;
};

export type IntegrationConfig = {
  zalo: ZaloIntegrationConfig;
  vietQr: VietQrIntegrationConfig;
};

type SecretProvider = 'ZALO' | 'VIETQR';

type SecretPatch = Record<string, string | null | undefined>;

@Injectable()
export class IntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  private defaults(): IntegrationConfig {
    return {
      zalo: {
        enabled: process.env.ZALO_AUTOMATION_ENABLED === 'true',
        oaId: process.env.ZALO_OA_ID?.trim() ?? '',
        appId: process.env.ZALO_APP_ID?.trim() ?? '',
        adminUid: process.env.ZALO_ADMIN_UID?.trim() ?? '',
        sendUrl:
          process.env.ZALO_OA_SEND_URL?.trim() ||
          'https://openapi.zalo.me/v3.0/oa/message/cs',
        classReminders: true,
        classReminderMinutes: 60,
        tuitionDueReminders: true,
        tuitionDueDays: 3,
        tuitionDueTime: '08:00',
        overdueReminders: true,
        overdueTime: '08:10',
        evaluationMessages: true,
        dailyReport: true,
        dailyReportTime: '20:00',
      },
      vietQr: {
        enabled: Boolean(
          process.env.VIETQR_BANK_ID && process.env.VIETQR_ACCOUNT_NO,
        ),
        mode: 'quicklink',
        bankId: process.env.VIETQR_BANK_ID?.trim() ?? '',
        accountNo: process.env.VIETQR_ACCOUNT_NO?.trim() ?? '',
        accountName: process.env.VIETQR_ACCOUNT_NAME?.trim() ?? '',
        template: process.env.VIETQR_TEMPLATE?.trim() || 'compact2',
        tuitionPrefix: 'HP',
        salesPrefix: 'BH',
      },
    };
  }

  private merge(raw: any): IntegrationConfig {
    const defaults = this.defaults();
    return {
      zalo: {
        ...defaults.zalo,
        ...(raw?.zalo ?? {}),
      },
      vietQr: {
        ...defaults.vietQr,
        ...(raw?.vietQr ?? {}),
      },
    };
  }

  async config(): Promise<IntegrationConfig> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'integrations' },
    });
    return this.merge(row?.value);
  }

  private masterKey() {
    const raw = process.env.INTEGRATION_MASTER_KEY?.trim();
    if (!raw || raw.length < 32) {
      throw new BadRequestException(
        'Chưa cấu hình INTEGRATION_MASTER_KEY (tối thiểu 32 ký tự) trong apps/api/.env',
      );
    }
    return createHash('sha256').update(raw, 'utf8').digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return {
      valueEnc: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  private decrypt(row: { valueEnc: string; iv: string; authTag: string }) {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.masterKey(),
        Buffer.from(row.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(row.authTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(row.valueEnc, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new BadRequestException(
        'Không giải mã được secret tích hợp. Kiểm tra INTEGRATION_MASTER_KEY.',
      );
    }
  }

  private envFallback(provider: SecretProvider, key: string) {
    const map: Record<string, string | undefined> = {
      'ZALO:accessToken': process.env.ZALO_OA_ACCESS_TOKEN,
      'ZALO:refreshToken': process.env.ZALO_OA_REFRESH_TOKEN,
      'ZALO:appSecret': process.env.ZALO_APP_SECRET,
      'VIETQR:clientId': process.env.VIETQR_CLIENT_ID,
      'VIETQR:apiKey': process.env.VIETQR_API_KEY,
      'VIETQR:webhookSecret': process.env.BANK_WEBHOOK_SECRET,
    };
    return map[`${provider}:${key}`]?.trim() ?? '';
  }

  private async getSecret(provider: SecretProvider, key: string) {
    const row = await this.prisma.integrationSecret.findUnique({
      where: { provider_key: { provider, key } },
    });
    if (!row) return this.envFallback(provider, key);
    return this.decrypt(row);
  }

  private async hasSecret(provider: SecretProvider, key: string) {
    const row = await this.prisma.integrationSecret.findUnique({
      where: { provider_key: { provider, key } },
      select: { id: true },
    });
    return Boolean(row || this.envFallback(provider, key));
  }

  private async patchSecrets(provider: SecretProvider, patch: SecretPatch) {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null || !String(value).trim()) {
        await this.prisma.integrationSecret.deleteMany({
          where: { provider, key },
        });
        continue;
      }
      const encrypted = this.encrypt(String(value).trim());
      await this.prisma.integrationSecret.upsert({
        where: { provider_key: { provider, key } },
        create: { provider, key, ...encrypted },
        update: encrypted,
      });
    }
  }

  private validateTime(value: string, field: string) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new BadRequestException(`${field} phải có dạng HH:mm`);
    }
  }

  private async saveConfig(next: IntegrationConfig) {
    await this.prisma.systemSetting.upsert({
      where: { key: 'integrations' },
      create: { key: 'integrations', value: next as any },
      update: { value: next as any },
    });
    return next;
  }

  async safeView() {
    const config = await this.config();
    const [zaloAccess, zaloRefresh, zaloSecret, vClient, vKey, webhookSecret] =
      await Promise.all([
        this.hasSecret('ZALO', 'accessToken'),
        this.hasSecret('ZALO', 'refreshToken'),
        this.hasSecret('ZALO', 'appSecret'),
        this.hasSecret('VIETQR', 'clientId'),
        this.hasSecret('VIETQR', 'apiKey'),
        this.hasSecret('VIETQR', 'webhookSecret'),
      ]);

    return {
      ...config,
      security: {
        masterKeyConfigured: Boolean(
          process.env.INTEGRATION_MASTER_KEY?.trim() &&
            process.env.INTEGRATION_MASTER_KEY!.trim().length >= 32,
        ),
      },
      secrets: {
        zalo: {
          accessTokenConfigured: zaloAccess,
          refreshTokenConfigured: zaloRefresh,
          appSecretConfigured: zaloSecret,
        },
        vietQr: {
          clientIdConfigured: vClient,
          apiKeyConfigured: vKey,
          webhookSecretConfigured: webhookSecret,
        },
      },
    };
  }

  async summary() {
    const safe = await this.safeView();
    return {
      zalo: Boolean(
        safe.zalo.oaId && safe.secrets.zalo.accessTokenConfigured,
      ),
      vietQr: Boolean(
        safe.vietQr.bankId &&
          safe.vietQr.accountNo &&
          safe.vietQr.accountName,
      ),
      jwtSecretConfigured: Boolean(process.env.AUTH_JWT_SECRET),
      masterKeyConfigured: safe.security.masterKeyConfigured,
    };
  }

  async updateZalo(body: any) {
    const current = await this.config();
    const patch = body?.config ?? body ?? {};
    const next: IntegrationConfig = {
      ...current,
      zalo: {
        ...current.zalo,
        enabled: Boolean(patch.enabled ?? current.zalo.enabled),
        oaId:
          patch.oaId === undefined
            ? current.zalo.oaId
            : String(patch.oaId ?? '').trim(),
        appId:
          patch.appId === undefined
            ? current.zalo.appId
            : String(patch.appId ?? '').trim(),
        adminUid:
          patch.adminUid === undefined
            ? current.zalo.adminUid
            : String(patch.adminUid ?? '').trim(),
        sendUrl:
          patch.sendUrl === undefined
            ? current.zalo.sendUrl
            : String(patch.sendUrl ?? '').trim(),
        classReminders:
          patch.classReminders === undefined
            ? current.zalo.classReminders
            : Boolean(patch.classReminders),
        classReminderMinutes: Math.max(
          5,
          Number(
            patch.classReminderMinutes ?? current.zalo.classReminderMinutes,
          ),
        ),
        tuitionDueReminders:
          patch.tuitionDueReminders === undefined
            ? current.zalo.tuitionDueReminders
            : Boolean(patch.tuitionDueReminders),
        tuitionDueDays: Math.max(
          1,
          Number(patch.tuitionDueDays ?? current.zalo.tuitionDueDays),
        ),
        tuitionDueTime: String(
          patch.tuitionDueTime ?? current.zalo.tuitionDueTime,
        ),
        overdueReminders:
          patch.overdueReminders === undefined
            ? current.zalo.overdueReminders
            : Boolean(patch.overdueReminders),
        overdueTime: String(patch.overdueTime ?? current.zalo.overdueTime),
        evaluationMessages:
          patch.evaluationMessages === undefined
            ? current.zalo.evaluationMessages
            : Boolean(patch.evaluationMessages),
        dailyReport:
          patch.dailyReport === undefined
            ? current.zalo.dailyReport
            : Boolean(patch.dailyReport),
        dailyReportTime: String(
          patch.dailyReportTime ?? current.zalo.dailyReportTime,
        ),
      },
    };

    if (!next.zalo.sendUrl) {
      throw new BadRequestException('Zalo Send URL không được để trống');
    }
    this.validateTime(next.zalo.tuitionDueTime, 'Giờ nhắc học phí');
    this.validateTime(next.zalo.overdueTime, 'Giờ nhắc quá hạn');
    this.validateTime(next.zalo.dailyReportTime, 'Giờ báo cáo ngày');

    await this.saveConfig(next);
    await this.patchSecrets('ZALO', {
      accessToken: body?.secrets?.accessToken,
      refreshToken: body?.secrets?.refreshToken,
      appSecret: body?.secrets?.appSecret,
    });
    return this.safeView();
  }

  async updateVietQr(body: any) {
    const current = await this.config();
    const patch = body?.config ?? body ?? {};
    const mode = String(patch.mode ?? current.vietQr.mode) as
      | 'quicklink'
      | 'api';
    if (!['quicklink', 'api'].includes(mode)) {
      throw new BadRequestException('Chế độ VietQR không hợp lệ');
    }

    const next: IntegrationConfig = {
      ...current,
      vietQr: {
        ...current.vietQr,
        enabled:
          patch.enabled === undefined
            ? current.vietQr.enabled
            : Boolean(patch.enabled),
        mode,
        bankId:
          patch.bankId === undefined
            ? current.vietQr.bankId
            : String(patch.bankId ?? '').trim(),
        accountNo:
          patch.accountNo === undefined
            ? current.vietQr.accountNo
            : String(patch.accountNo ?? '').trim(),
        accountName:
          patch.accountName === undefined
            ? current.vietQr.accountName
            : String(patch.accountName ?? '').trim(),
        template:
          patch.template === undefined
            ? current.vietQr.template
            : String(patch.template ?? '').trim() || 'compact2',
        tuitionPrefix:
          patch.tuitionPrefix === undefined
            ? current.vietQr.tuitionPrefix
            : String(patch.tuitionPrefix ?? '').trim() || 'HP',
        salesPrefix:
          patch.salesPrefix === undefined
            ? current.vietQr.salesPrefix
            : String(patch.salesPrefix ?? '').trim() || 'BH',
      },
    };

    if (
      next.vietQr.enabled &&
      (!next.vietQr.bankId ||
        !next.vietQr.accountNo ||
        !next.vietQr.accountName)
    ) {
      throw new BadRequestException(
        'Vui lòng nhập ngân hàng/BIN, số tài khoản và tên tài khoản',
      );
    }

    await this.saveConfig(next);
    await this.patchSecrets('VIETQR', {
      clientId: body?.secrets?.clientId,
      apiKey: body?.secrets?.apiKey,
      webhookSecret: body?.secrets?.webhookSecret,
    });
    return this.safeView();
  }

  async zaloRuntime() {
    const config = (await this.config()).zalo;
    const [accessToken, refreshToken, appSecret] = await Promise.all([
      this.getSecret('ZALO', 'accessToken'),
      this.getSecret('ZALO', 'refreshToken'),
      this.getSecret('ZALO', 'appSecret'),
    ]);
    return { config, accessToken, refreshToken, appSecret };
  }

  async vietQrRuntime() {
    const config = (await this.config()).vietQr;
    const [clientId, apiKey, webhookSecret] = await Promise.all([
      this.getSecret('VIETQR', 'clientId'),
      this.getSecret('VIETQR', 'apiKey'),
      this.getSecret('VIETQR', 'webhookSecret'),
    ]);
    return { config, clientId, apiKey, webhookSecret };
  }

  sanitizeTransferContent(value: string, max = 50) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/đ/g, 'd')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  async buildVietQr(input: { amount: number; addInfo: string }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Số tiền VietQR không hợp lệ');
    }
    const runtime = await this.vietQrRuntime();
    const { config } = runtime;
    if (!config.enabled) {
      throw new BadRequestException('VietQR đang bị tắt trong Thiết lập');
    }
    if (!config.bankId || !config.accountNo || !config.accountName) {
      throw new BadRequestException('Chưa cấu hình đầy đủ tài khoản VietQR');
    }

    if (config.mode === 'api') {
      if (!runtime.clientId || !runtime.apiKey) {
        throw new BadRequestException(
          'Chế độ VietQR API cần Client ID và API Key',
        );
      }
      if (!/^\d{6}$/.test(config.bankId)) {
        throw new BadRequestException(
          'Chế độ VietQR API cần Bank ID là mã BIN 6 chữ số',
        );
      }
      const addInfo = this.sanitizeTransferContent(input.addInfo, 25);
      const response = await fetch('https://api.vietqr.io/v2/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': runtime.clientId,
          'x-api-key': runtime.apiKey,
        },
        body: JSON.stringify({
          accountNo: config.accountNo,
          accountName: this.sanitizeTransferContent(config.accountName, 50),
          acqId: Number(config.bankId),
          amount: Math.round(input.amount),
          addInfo,
          format: 'text',
          template: config.template,
        }),
      });
      const body: any = await response.json().catch(() => null);
      if (!response.ok || body?.code !== '00') {
        throw new BadRequestException(
          body?.desc || body?.message || `VietQR HTTP ${response.status}`,
        );
      }
      return {
        amount: Math.round(input.amount),
        bankId: config.bankId,
        accountNo: config.accountNo,
        accountName: config.accountName,
        addInfo,
        template: config.template,
        mode: config.mode,
        qrImageUrl: body?.data?.qrDataURL ?? null,
        qrCode: body?.data?.qrCode ?? null,
      };
    }

    const addInfo = this.sanitizeTransferContent(input.addInfo, 50);
    const qrImageUrl =
      `https://img.vietqr.io/image/` +
      `${encodeURIComponent(config.bankId)}-` +
      `${encodeURIComponent(config.accountNo)}-` +
      `${encodeURIComponent(config.template)}.png` +
      `?amount=${Math.round(input.amount)}` +
      `&addInfo=${encodeURIComponent(addInfo)}` +
      `&accountName=${encodeURIComponent(config.accountName)}`;

    return {
      amount: Math.round(input.amount),
      bankId: config.bankId,
      accountNo: config.accountNo,
      accountName: config.accountName,
      addInfo,
      template: config.template,
      mode: config.mode,
      qrImageUrl,
      qrCode: null,
    };
  }

  async testVietQr() {
    const runtime = await this.vietQrRuntime();
    const preview = await this.buildVietQr({
      amount: 10_000,
      addInfo: `${runtime.config.salesPrefix} KARATE TEST`,
    });
    return {
      success: true,
      message:
        runtime.config.mode === 'api'
          ? 'VietQR API phản hồi thành công.'
          : 'Đã tạo Quick Link VietQR thử nghiệm.',
      preview,
    };
  }

  async sendZaloTest(recipient?: string) {
    const runtime = await this.zaloRuntime();
    const target = String(recipient ?? runtime.config.adminUid).trim();
    if (!runtime.accessToken) {
      throw new BadRequestException('Chưa cấu hình Zalo OA Access Token');
    }
    if (!target) {
      throw new BadRequestException('Chưa có Zalo UID nhận tin thử');
    }
    const response = await fetch(runtime.config.sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        access_token: runtime.accessToken,
      },
      body: JSON.stringify({
        recipient: { user_id: target },
        message: {
          text: `Tin nhắn kiểm tra từ Karate Dojo lúc ${new Intl.DateTimeFormat(
            'vi-VN',
            {
              dateStyle: 'short',
              timeStyle: 'medium',
              timeZone: 'Asia/Ho_Chi_Minh',
            },
          ).format(new Date())}`,
        },
      }),
    });
    const body: any = await response.json().catch(() => null);
    const providerError = body?.error ?? body?.error_code ?? 0;
    if (!response.ok || (providerError !== 0 && providerError !== '0')) {
      throw new BadRequestException(
        body?.message || body?.error_name || `Zalo HTTP ${response.status}`,
      );
    }
    return {
      success: true,
      recipient: target,
      providerId:
        body?.data?.message_id ?? body?.message_id ?? body?.data?.msg_id ?? null,
      message: 'Zalo OA đã gửi tin thử thành công.',
    };
  }

  async recentZaloLogs(limit = 20) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const rows = await this.prisma.notificationLog.findMany({
      where: { channel: 'ZALO' as any },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        student: { select: { code: true, fullName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      templateKey: row.templateKey,
      recipient: row.recipient,
      status: String(row.status),
      providerId: row.providerId,
      error: row.error,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
      student: row.student,
    }));
  }

  async verifyWebhookSecret(secret?: string) {
    const expected = (await this.vietQrRuntime()).webhookSecret;
    if (!expected) {
      throw new UnauthorizedException(
        'Chưa cấu hình Webhook Secret trong Thiết lập > Tích hợp > VietQR',
      );
    }
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Webhook secret không hợp lệ');
    }
  }
}
