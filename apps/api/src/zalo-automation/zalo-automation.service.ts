import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { IntegrationService } from '../settings/integration.service.js';

type SendRequest = {
  recipient: string;
  content: string;
  templateKey: string;
  studentId?: string;
  invoiceId?: string;
};

@Injectable()
export class ZaloAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly integrations: IntegrationService,
  ) {}

  private dateKey(date = new Date()) {
    const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return local.toISOString().slice(0, 10);
  }

  private formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(value);
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private async preferredGuardian(studentId: string) {
    const links = await this.prisma.studentGuardian.findMany({
      where: { studentId },
      include: { guardian: true },
    });

    const eligible = links.filter((link) => link.guardian.zaloUid);
    return (
      eligible.find((link) => link.isPrimary)?.guardian ??
      eligible[0]?.guardian ??
      null
    );
  }

  private async alreadyLogged(
    templateKey: string,
    recipient: string,
    includeDryRun: boolean,
  ) {
    return this.prisma.notificationLog.findFirst({
      where: {
        channel: 'ZALO' as any,
        templateKey,
        recipient,
        ...(includeDryRun ? {} : { providerId: { not: 'DRY_RUN' } }),
      },
      select: { id: true },
    });
  }

  private async sendOne(request: SendRequest) {
    const runtime = await this.integrations.zaloRuntime();
    const duplicate = await this.alreadyLogged(
      request.templateKey,
      request.recipient,
      !runtime.config.enabled,
    );

    if (duplicate) {
      return { skipped: true, reason: 'DUPLICATE' };
    }

    const log = await this.prisma.notificationLog.create({
      data: {
        studentId: request.studentId ?? null,
        invoiceId: request.invoiceId ?? null,
        channel: 'ZALO' as any,
        templateKey: request.templateKey,
        recipient: request.recipient,
        content: request.content,
        status: 'PENDING' as any,
      },
    });

    if (!runtime.config.enabled) {
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT' as any,
          providerId: 'DRY_RUN',
          sentAt: new Date(),
        },
      });

      return { sent: false, dryRun: true, logId: log.id };
    }

    if (!runtime.accessToken) {
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED' as any,
          error: 'Chưa cấu hình Zalo OA Access Token trong Thiết lập > Tích hợp',
        },
      });

      return { sent: false, error: 'MISSING_ACCESS_TOKEN', logId: log.id };
    }

    try {
      const response = await fetch(runtime.config.sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          access_token: runtime.accessToken,
        },
        body: JSON.stringify({
          recipient: {
            user_id: request.recipient,
          },
          message: {
            text: request.content,
          },
        }),
      });

      const body: any = await response.json().catch(() => null);
      const providerError = body?.error ?? body?.error_code ?? 0;

      if (!response.ok || (providerError !== 0 && providerError !== '0')) {
        throw new Error(
          body?.message ||
            body?.error_name ||
            `Zalo HTTP ${response.status}`,
        );
      }

      const providerId =
        body?.data?.message_id ??
        body?.message_id ??
        body?.data?.msg_id ??
        null;

      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT' as any,
          providerId: providerId ? String(providerId) : null,
          sentAt: new Date(),
        },
      });

      return { sent: true, logId: log.id, providerId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gửi Zalo thất bại';

      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED' as any,
          error: message.slice(0, 1000),
        },
      });

      return { sent: false, logId: log.id, error: message };
    }
  }

  async status() {
    const runtime = await this.integrations.zaloRuntime();
    const [totalGuardians, withZaloUid, recentLogs] = await Promise.all([
      this.prisma.guardian.count(),
      this.prisma.guardian.count({ where: { zaloUid: { not: null } } }),
      this.prisma.notificationLog.findMany({
        where: { channel: 'ZALO' as any },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          student: { select: { code: true, fullName: true } },
        },
      }),
    ]);

    return {
      enabled: runtime.config.enabled,
      accessTokenConfigured: Boolean(runtime.accessToken),
      adminUidConfigured: Boolean(runtime.config.adminUid),
      sendUrl: runtime.config.sendUrl,
      config: runtime.config,
      guardianCoverage: { totalGuardians, withZaloUid },
      schedules: [
        `Nhắc lịch học: trước ${runtime.config.classReminderMinutes} phút`,
        `Nhắc học phí: trước ${runtime.config.tuitionDueDays} ngày lúc ${runtime.config.tuitionDueTime}`,
        `Nhắc quá hạn: ${runtime.config.overdueTime} hàng ngày`,
        'Đánh giá học viên mới: kiểm tra mỗi 5 phút',
        `Báo cáo quản trị: ${runtime.config.dailyReportTime} hàng ngày`,
      ],
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        templateKey: log.templateKey,
        recipient: log.recipient,
        content: log.content,
        status: String(log.status),
        providerId: log.providerId,
        error: log.error,
        sentAt: log.sentAt,
        createdAt: log.createdAt,
        student: log.student,
      })),
    };
  }

  private async sendClassReminders() {
    const runtime = await this.integrations.zaloRuntime();
    if (!runtime.config.classReminders) return 0;
    const now = new Date();
    const targetMs = runtime.config.classReminderMinutes * 60_000;
    const start = new Date(now.getTime() + Math.max(targetMs - 4 * 60_000, 0));
    const end = new Date(now.getTime() + targetMs + 4 * 60_000);

    const sessions = await this.prisma.classSession.findMany({
      where: { isCancelled: false, startsAt: { gte: start, lte: end } },
      include: { class: { include: { branch: true } } },
    });

    let processed = 0;
    for (const session of sessions) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { classId: session.classId, status: 'ACTIVE' as any },
        include: { student: true },
      });
      for (const enrollment of enrollments) {
        const guardian = await this.preferredGuardian(enrollment.studentId);
        if (!guardian?.zaloUid) continue;
        const content = [
          'Nhắc lịch học Karate',
          `${enrollment.student.fullName} có lớp ${session.class.name}.`,
          `Thời gian: ${this.formatDateTime(session.startsAt)}.`,
          `Địa điểm: ${session.class.branch.name}.`,
          session.topic ? `Nội dung: ${session.topic}.` : '',
        ].filter(Boolean).join('\n');
        await this.sendOne({
          recipient: guardian.zaloUid,
          content,
          templateKey: `CLASS_REMINDER:${session.id}:${enrollment.studentId}`,
          studentId: enrollment.studentId,
        });
        processed += 1;
      }
    }
    return processed;
  }

  private async sendTuitionDueReminders() {
    const runtime = await this.integrations.zaloRuntime();
    if (!runtime.config.tuitionDueReminders) return 0;
    const now = new Date();
    const dueLimit = new Date(now.getTime() + runtime.config.tuitionDueDays * 86_400_000);

    const invoices = await this.prisma.tuitionInvoice.findMany({
      where: {
        dueDate: { gte: now, lte: dueLimit },
        status: { notIn: ['PAID', 'CANCELLED'] as any },
      },
      include: {
        student: true,
        studentPackage: true,
      },
    });

    let processed = 0;

    for (const invoice of invoices) {
      const remaining = Math.max(
        Number(invoice.total) - Number(invoice.paidAmount),
        0,
      );
      if (remaining <= 0) continue;

      const guardian = await this.preferredGuardian(invoice.studentId);
      if (!guardian?.zaloUid) continue;

      await this.sendOne({
        recipient: guardian.zaloUid,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        templateKey: `TUITION_DUE:${invoice.id}:${this.dateKey(invoice.dueDate)}`,
        content: [
          'Nhắc học phí Karate',
          `Học viên: ${invoice.student.fullName}.`,
          `Gói học: ${invoice.studentPackage?.packageNameSnapshot ?? 'Gói học'}.`,
          `Còn phải thu: ${this.formatMoney(remaining)}.`,
          `Hạn nộp: ${this.formatDateTime(invoice.dueDate)}.`,
          `Mã hóa đơn: ${invoice.invoiceNo}.`,
        ].join('\n'),
      });
      processed += 1;
    }

    return processed;
  }

  private async sendOverdueReminders() {
    const runtime = await this.integrations.zaloRuntime();
    if (!runtime.config.overdueReminders) return 0;
    const now = new Date();
    const todayKey = this.dateKey(now);

    const invoices = await this.prisma.tuitionInvoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['PAID', 'CANCELLED'] as any },
      },
      include: {
        student: true,
        studentPackage: true,
      },
    });

    let processed = 0;

    for (const invoice of invoices) {
      const remaining = Math.max(
        Number(invoice.total) - Number(invoice.paidAmount),
        0,
      );
      if (remaining <= 0) continue;

      const guardian = await this.preferredGuardian(invoice.studentId);
      if (!guardian?.zaloUid) continue;

      await this.sendOne({
        recipient: guardian.zaloUid,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        templateKey: `TUITION_OVERDUE:${invoice.id}:${todayKey}`,
        content: [
          'Thông báo học phí quá hạn',
          `Học viên: ${invoice.student.fullName}.`,
          `Còn nợ: ${this.formatMoney(remaining)}.`,
          `Hạn nộp: ${this.formatDateTime(invoice.dueDate)}.`,
          `Mã hóa đơn: ${invoice.invoiceNo}.`,
          'Vui lòng kiểm tra và hoàn tất học phí khi thuận tiện.',
        ].join('\n'),
      });
      processed += 1;
    }

    return processed;
  }

  private async sendNewEvaluations() {
    const runtime = await this.integrations.zaloRuntime();
    if (!runtime.config.evaluationMessages) return 0;
    const since = new Date(Date.now() - 20 * 60 * 1000);

    const notes = await this.prisma.learningNote.findMany({
      where: {
        studentId: { not: null },
        createdAt: { gte: since },
      },
      include: {
        student: true,
        class: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let processed = 0;

    for (const note of notes) {
      if (!note.studentId || !note.student) continue;
      const guardian = await this.preferredGuardian(note.studentId);
      if (!guardian?.zaloUid) continue;

      const contentPreview = note.content.length > 700
        ? `${note.content.slice(0, 697)}...`
        : note.content;

      await this.sendOne({
        recipient: guardian.zaloUid,
        studentId: note.studentId,
        templateKey: `EVALUATION:${note.id}`,
        content: [
          'Đánh giá học tập Karate',
          `Học viên: ${note.student.fullName}.`,
          note.class ? `Lớp: ${note.class.name}.` : '',
          `Nhận xét: ${contentPreview}`,
          note.rating != null ? `Đánh giá: ${note.rating}/5.` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
      processed += 1;
    }

    return processed;
  }

  private async sendDailyAdminReport() {
    const runtime = await this.integrations.zaloRuntime();
    if (!runtime.config.dailyReport || !runtime.config.adminUid) return 0;

    const today = this.dateKey();
    const overview = await this.reports.overview(today, today);

    await this.sendOne({
      recipient: runtime.config.adminUid,
      templateKey: `DAILY_REPORT:${today}`,
      content: [
        `Báo cáo vận hành Karate - ${today}`,
        `Học viên đang học: ${overview.metrics.activeStudents}`,
        `Tỷ lệ đi học: ${overview.metrics.attendanceRate}%`,
        `Tổng thu: ${this.formatMoney(overview.metrics.income)}`,
        `Tổng chi: ${this.formatMoney(overview.metrics.expense)}`,
        `Dòng tiền ròng: ${this.formatMoney(overview.metrics.balance)}`,
        `Công nợ học phí: ${this.formatMoney(overview.metrics.tuitionDebt)}`,
        `Doanh số bán hàng: ${this.formatMoney(overview.metrics.salesRevenue)}`,
        `Học viên cần theo dõi: ${overview.metrics.riskyStudents}`,
      ].join('\n'),
    });

    return 1;
  }

  private currentHm() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).formatToParts(new Date());
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
    return `${hour}:${minute}`;
  }

  private sameFiveMinuteBucket(nowHm: string, configured: string) {
    const [nh, nm] = nowHm.split(':').map(Number);
    const [ch, cm] = configured.split(':').map(Number);
    if (![nh, nm, ch, cm].every(Number.isFinite)) return false;
    return nh === ch && Math.floor(nm / 5) === Math.floor(cm / 5);
  }

  @Cron('0 */5 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async schedulerTick() {
    const runtime = await this.integrations.zaloRuntime();
    const nowHm = this.currentHm();
    const jobs: Promise<number>[] = [];

    if (runtime.config.classReminders) jobs.push(this.sendClassReminders());
    if (runtime.config.evaluationMessages) jobs.push(this.sendNewEvaluations());
    if (
      runtime.config.tuitionDueReminders &&
      this.sameFiveMinuteBucket(nowHm, runtime.config.tuitionDueTime)
    ) jobs.push(this.sendTuitionDueReminders());
    if (
      runtime.config.overdueReminders &&
      this.sameFiveMinuteBucket(nowHm, runtime.config.overdueTime)
    ) jobs.push(this.sendOverdueReminders());
    if (
      runtime.config.dailyReport &&
      this.sameFiveMinuteBucket(nowHm, runtime.config.dailyReportTime)
    ) jobs.push(this.sendDailyAdminReport());

    await Promise.all(jobs);
  }

  async runNow() {
    const [classReminders, tuitionDue, overdue, evaluations, adminReports] =
      await Promise.all([
        this.sendClassReminders(),
        this.sendTuitionDueReminders(),
        this.sendOverdueReminders(),
        this.sendNewEvaluations(),
        this.sendDailyAdminReport(),
      ]);

    return {
      enabled: (await this.integrations.zaloRuntime()).config.enabled,
      classReminders,
      tuitionDue,
      overdue,
      evaluations,
      adminReports,
      message: (await this.integrations.zaloRuntime()).config.enabled
        ? 'Đã chạy các tác vụ Zalo.'
        : 'Đã chạy ở chế độ mô phỏng. Bật Gửi thật tại Thiết lập > Tích hợp > Zalo OA.',
    };
  }

  async test(recipient?: string) {
    const runtime = await this.integrations.zaloRuntime();
    const target = recipient?.trim() || runtime.config.adminUid;

    if (!target) {
      return {
        sent: false,
        message: 'Chưa có recipient hoặc Zalo UID quản trị.',
      };
    }

    return this.sendOne({
      recipient: target,
      templateKey: `TEST:${Date.now()}`,
      content: `Tin nhắn kiểm tra từ Karate Dojo Management System lúc ${this.formatDateTime(new Date())}.`,
    });
  }
}
