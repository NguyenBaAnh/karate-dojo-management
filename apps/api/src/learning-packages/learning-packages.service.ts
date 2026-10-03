import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { IntegrationService } from '../settings/integration.service.js';
import { CreateLearningPackageDto } from './dto/create-learning-package.dto.js';
import { UpdateLearningPackageDto } from './dto/update-learning-package.dto.js';
import { CreateStudentPackageDto } from './dto/create-student-package.dto.js';
import { UpdateStudentPackageDto } from './dto/update-student-package.dto.js';
import { CreatePackagePaymentDto } from './dto/create-package-payment.dto.js';
import { RenewStudentPackageDto } from './dto/renew-student-package.dto.js';

@Injectable()
export class LearningPackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationService,
  ) {}

  private calculateEndDate(
    startDate: Date,
    durationValue?: number | null,
    durationUnit?: string | null,
  ) {
    if (!durationValue || !durationUnit) return null;

    const end = new Date(startDate);

    if (durationUnit === 'DAY') {
      end.setDate(end.getDate() + durationValue);
    } else if (durationUnit === 'WEEK') {
      end.setDate(end.getDate() + durationValue * 7);
    } else if (durationUnit === 'MONTH') {
      end.setMonth(end.getMonth() + durationValue);
    }

    return end;
  }

  private async ensurePackageRules(dto: {
    durationValue?: number;
    durationUnit?: string;
    sessionsPerWeek?: number;
    includedSessions?: number;
  }) {
    if (
      (dto.durationValue && !dto.durationUnit) ||
      (!dto.durationValue && dto.durationUnit)
    ) {
      throw new BadRequestException(
        'Thời hạn gói phải có cả giá trị và đơn vị',
      );
    }

    if (
      !dto.durationValue &&
      !dto.includedSessions &&
      !dto.sessionsPerWeek
    ) {
      throw new BadRequestException(
        'Gói học cần có thời hạn, số buổi/tuần hoặc tổng số buổi',
      );
    }
  }

  async findPackages(includeInactive = false) {
    return this.prisma.learningPackage.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [
        { active: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async createPackage(dto: CreateLearningPackageDto) {
    await this.ensurePackageRules(dto);

    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.learningPackage.findUnique({
      where: { code },
    });

    if (existing) {
      throw new BadRequestException('Mã gói học đã tồn tại');
    }

    return this.prisma.learningPackage.create({
      data: {
        code,
        name: dto.name.trim(),
        billingType: dto.billingType as any,
        durationValue: dto.durationValue ?? null,
        durationUnit: (dto.durationUnit ?? null) as any,
        sessionsPerWeek: dto.sessionsPerWeek ?? null,
        includedSessions: dto.includedSessions ?? null,
        price: dto.price,
        description: dto.description?.trim() || null,
      },
    });
  }

  async updatePackage(id: string, dto: UpdateLearningPackageDto) {
    const current = await this.prisma.learningPackage.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy gói học');
    }

    const merged = {
      durationValue:
        dto.durationValue !== undefined
          ? dto.durationValue
          : current.durationValue ?? undefined,
      durationUnit:
        dto.durationUnit !== undefined
          ? dto.durationUnit
          : current.durationUnit ?? undefined,
      sessionsPerWeek:
        dto.sessionsPerWeek !== undefined
          ? dto.sessionsPerWeek
          : current.sessionsPerWeek ?? undefined,
      includedSessions:
        dto.includedSessions !== undefined
          ? dto.includedSessions
          : current.includedSessions ?? undefined,
    };

    await this.ensurePackageRules(merged);

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== current.code) {
        const duplicate = await this.prisma.learningPackage.findUnique({
          where: { code },
        });
        if (duplicate) {
          throw new BadRequestException('Mã gói học đã tồn tại');
        }
      }
    }

    return this.prisma.learningPackage.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && {
          code: dto.code.trim().toUpperCase(),
        }),
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),
        ...(dto.billingType !== undefined && {
          billingType: dto.billingType as any,
        }),
        ...(dto.durationValue !== undefined && {
          durationValue: dto.durationValue,
        }),
        ...(dto.durationUnit !== undefined && {
          durationUnit: dto.durationUnit as any,
        }),
        ...(dto.sessionsPerWeek !== undefined && {
          sessionsPerWeek: dto.sessionsPerWeek,
        }),
        ...(dto.includedSessions !== undefined && {
          includedSessions: dto.includedSessions,
        }),
        ...(dto.price !== undefined && {
          price: dto.price,
        }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(dto.active !== undefined && {
          active: dto.active,
        }),
      },
    });
  }

  async deactivatePackage(id: string) {
    const current = await this.prisma.learningPackage.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy gói học');
    }

    await this.prisma.learningPackage.update({
      where: { id },
      data: { active: false },
    });

    return { message: 'Đã ngừng sử dụng gói học' };
  }

  private async usageForSubscription(subscription: {
    studentId: string;
    startDate: Date;
    endDate: Date | null;
    includedSessionsSnapshot: number | null;
  }) {
    const count = await this.prisma.attendance.count({
      where: {
        studentId: subscription.studentId,
        status: {
          in: ['PRESENT', 'LATE', 'MAKEUP'] as any,
        },
        session: {
          isCancelled: false,
          startsAt: {
            gte: subscription.startDate,
            ...(subscription.endDate
              ? { lte: subscription.endDate }
              : {}),
          },
        },
      },
    });

    const remaining =
      subscription.includedSessionsSnapshot == null
        ? null
        : Math.max(
            subscription.includedSessionsSnapshot - count,
            0,
          );

    return {
      usedSessions: count,
      remainingSessions: remaining,
    };
  }

  private derivePackageState(
    subscription: {
      status: string;
      endDate: Date | null;
      includedSessionsSnapshot: number | null;
    },
    usedSessions: number,
    warningDays = 7,
  ) {
    if (subscription.status === 'CANCELLED') return 'CANCELLED';
    if (subscription.status === 'COMPLETED') return 'COMPLETED';
    if (subscription.status === 'PAUSED') return 'PAUSED';
    if (subscription.status === 'PENDING') return 'PENDING';

    if (
      subscription.includedSessionsSnapshot != null &&
      usedSessions >= subscription.includedSessionsSnapshot
    ) {
      return 'COMPLETED';
    }

    if (subscription.endDate) {
      const now = new Date();
      const diffMs = subscription.endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / 86_400_000);

      if (diffDays < 0) return 'EXPIRED';
      if (diffDays <= warningDays) return 'EXPIRING';
    }

    return 'ACTIVE';
  }

  async listSubscriptions(studentId?: string) {
    const subscriptions = await this.prisma.studentPackage.findMany({
      where: studentId ? { studentId } : undefined,
      include: {
        student: {
          include: { branch: true },
        },
        package: true,
        invoices: {
          include: {
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      subscriptions.map(async (subscription) => {
        const usage = await this.usageForSubscription(subscription);

        const invoice = subscription.invoices[0] ?? null;
        const total = invoice ? Number(invoice.total) : Number(subscription.priceSnapshot);
        const paidAmount = invoice ? Number(invoice.paidAmount) : 0;

        return {
          ...subscription,
          priceSnapshot: Number(subscription.priceSnapshot),
          usage,
          displayStatus: this.derivePackageState(
            subscription,
            usage.usedSessions,
          ),
          billing: {
            invoiceId: invoice?.id ?? null,
            invoiceNo: invoice?.invoiceNo ?? null,
            total,
            paidAmount,
            remaining: Math.max(total - paidAmount, 0),
            status: invoice?.status ?? 'NO_INVOICE',
            dueDate: invoice?.dueDate ?? subscription.paymentDueDate,
          },
        };
      }),
    );
  }

  async createSubscription(dto: CreateStudentPackageDto) {
    const [student, learningPackage] = await Promise.all([
      this.prisma.student.findFirst({
        where: {
          id: dto.studentId,
          deletedAt: null,
        },
      }),
      this.prisma.learningPackage.findUnique({
        where: { id: dto.packageId },
      }),
    ]);

    if (!student) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    if (!learningPackage || !learningPackage.active) {
      throw new NotFoundException(
        'Không tìm thấy gói học đang hoạt động',
      );
    }

    const activeCandidates = await this.prisma.studentPackage.findMany({
      where: {
        studentId: dto.studentId,
        status: {
          in: ['ACTIVE', 'PAUSED'] as any,
        },
      },
    });

    for (const candidate of activeCandidates) {
      const usage = await this.usageForSubscription(candidate);
      const expiredByDate =
        candidate.endDate != null &&
        candidate.endDate.getTime() < Date.now();
      const usedUp =
        candidate.includedSessionsSnapshot != null &&
        usage.usedSessions >= candidate.includedSessionsSnapshot;

      if (!expiredByDate && !usedUp) {
        throw new BadRequestException(
          'Học viên đang có một gói học còn hiệu lực. Hãy hoàn tất, hủy hoặc xử lý gói hiện tại trước.',
        );
      }
    }

    const startDate = new Date(dto.startDate);
    const endDate = this.calculateEndDate(
      startDate,
      learningPackage.durationValue,
      learningPackage.durationUnit,
    );

    const paymentDueDate = dto.paymentDueDate
      ? new Date(dto.paymentDueDate)
      : startDate;

    const price =
      dto.priceOverride !== undefined
        ? dto.priceOverride
        : Number(learningPackage.price);

    const initialStatus =
      startDate.getTime() > Date.now() ? 'PENDING' : 'ACTIVE';

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.studentPackage.create({
        data: {
          studentId: student.id,
          packageId: learningPackage.id,
          startDate,
          endDate,
          paymentDueDate,
          status: initialStatus as any,
          packageCodeSnapshot: learningPackage.code,
          packageNameSnapshot: learningPackage.name,
          billingTypeSnapshot: learningPackage.billingType,
          durationValueSnapshot: learningPackage.durationValue,
          durationUnitSnapshot: learningPackage.durationUnit,
          sessionsPerWeekSnapshot: learningPackage.sessionsPerWeek,
          includedSessionsSnapshot: learningPackage.includedSessions,
          priceSnapshot: price,
          note: dto.note?.trim() || null,
        },
      });

      if (dto.createInvoice !== false) {
        const invoiceNo =
          `HP-${new Date().getFullYear()}-${Date.now()
            .toString()
            .slice(-8)}`;

        await tx.tuitionInvoice.create({
          data: {
            invoiceNo,
            studentId: student.id,
            studentPackageId: subscription.id,
            periodStart: startDate,
            periodEnd: endDate ?? startDate,
            dueDate: paymentDueDate,
            status: 'UNPAID' as any,
            attendedSessions: 0,
            subtotal: price,
            discount: 0,
            reservedCredit: 0,
            total: price,
            paidAmount: 0,
            customContent:
              `Học phí gói ${learningPackage.name}`,
            items: {
              create: [
                {
                  title: `Gói học: ${learningPackage.name}`,
                  quantity: 1,
                  unitPrice: price,
                  amount: price,
                  referenceType: 'STUDENT_PACKAGE',
                  referenceId: subscription.id,
                },
              ],
            },
          },
        });
      }

      return subscription;
    });
  }

  async renewSubscription(
    id: string,
    dto: RenewStudentPackageDto,
  ) {
    const current = await this.prisma.studentPackage.findUnique({
      where: { id },
      include: {
        package: true,
        student: true,
      },
    });

    if (!current) {
      throw new NotFoundException(
        'Không tìm thấy gói học cần gia hạn',
      );
    }

    if (current.status === ('CANCELLED' as any)) {
      throw new BadRequestException(
        'Không thể gia hạn một gói đã hủy',
      );
    }

    if (current.status === ('PENDING' as any)) {
      throw new BadRequestException(
        'Gói này đang chờ kích hoạt, chưa cần gia hạn',
      );
    }

    if (!current.package.active) {
      throw new BadRequestException(
        'Gói học này đã ngừng bán. Hãy đăng ký một gói khác.',
      );
    }

    const existingPending =
      await this.prisma.studentPackage.findFirst({
        where: {
          studentId: current.studentId,
          id: { not: current.id },
          status: 'PENDING' as any,
        },
      });

    if (existingPending) {
      throw new BadRequestException(
        'Học viên đã có một gói gia hạn đang chờ kích hoạt',
      );
    }

    const now = new Date();
    const usage = await this.usageForSubscription(current);

    const expiredByDate =
      current.endDate != null &&
      current.endDate.getTime() <= now.getTime();

    const usedUp =
      current.includedSessionsSnapshot != null &&
      usage.usedSessions >= current.includedSessionsSnapshot;

    let startDate: Date;

    if (dto.startDate) {
      startDate = new Date(dto.startDate);
    } else if (
      current.endDate &&
      current.endDate.getTime() > now.getTime()
    ) {
      startDate = new Date(current.endDate);
    } else {
      startDate = now;
    }

    if (
      !expiredByDate &&
      !usedUp &&
      current.endDate &&
      startDate.getTime() < current.endDate.getTime()
    ) {
      throw new BadRequestException(
        'Ngày bắt đầu gia hạn không được trước ngày kết thúc gói hiện tại',
      );
    }

    if (
      !expiredByDate &&
      !usedUp &&
      !current.endDate
    ) {
      throw new BadRequestException(
        'Gói hiện tại chưa kết thúc hoặc chưa dùng hết số buổi',
      );
    }

    const endDate = this.calculateEndDate(
      startDate,
      current.package.durationValue,
      current.package.durationUnit,
    );

    const price =
      dto.priceOverride !== undefined
        ? dto.priceOverride
        : Number(current.package.price);

    const paymentDueDate = dto.paymentDueDate
      ? new Date(dto.paymentDueDate)
      : now;

    const nextStatus =
      startDate.getTime() > now.getTime()
        ? 'PENDING'
        : 'ACTIVE';

    return this.prisma.$transaction(async (tx) => {
      if (
        nextStatus === 'ACTIVE' &&
        current.status !== ('COMPLETED' as any)
      ) {
        await tx.studentPackage.update({
          where: { id: current.id },
          data: {
            status: 'COMPLETED' as any,
          },
        });
      }

      const renewal = await tx.studentPackage.create({
        data: {
          studentId: current.studentId,
          packageId: current.packageId,
          startDate,
          endDate,
          paymentDueDate,
          status: nextStatus as any,

          packageCodeSnapshot: current.package.code,
          packageNameSnapshot: current.package.name,
          billingTypeSnapshot: current.package.billingType,
          durationValueSnapshot: current.package.durationValue,
          durationUnitSnapshot: current.package.durationUnit,
          sessionsPerWeekSnapshot: current.package.sessionsPerWeek,
          includedSessionsSnapshot: current.package.includedSessions,
          priceSnapshot: price,

          note:
            dto.note?.trim() ||
            `Gia hạn từ gói ${current.packageNameSnapshot}`,
        },
      });

      const invoiceNo =
        `HP-${new Date().getFullYear()}-${Date.now()
          .toString()
          .slice(-8)}`;

      await tx.tuitionInvoice.create({
        data: {
          invoiceNo,
          studentId: current.studentId,
          studentPackageId: renewal.id,
          periodStart: startDate,
          periodEnd: endDate ?? startDate,
          dueDate: paymentDueDate,
          status: 'UNPAID' as any,
          attendedSessions: 0,
          subtotal: price,
          discount: 0,
          reservedCredit: 0,
          total: price,
          paidAmount: 0,
          customContent:
            `Gia hạn gói ${current.package.name}`,
          items: {
            create: [
              {
                title:
                  `Gia hạn gói: ${current.package.name}`,
                quantity: 1,
                unitPrice: price,
                amount: price,
                referenceType: 'STUDENT_PACKAGE_RENEWAL',
                referenceId: renewal.id,
              },
            ],
          },
        },
      });

      return renewal;
    });
  }

  async updateSubscription(
    id: string,
    dto: UpdateStudentPackageDto,
  ) {
    const current = await this.prisma.studentPackage.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy gói của học viên');
    }

    let endDate = current.endDate;
    let pauseStartedAt = current.pauseStartedAt;
    let totalPausedDays = current.totalPausedDays;

    if (
      dto.status === 'PAUSED' &&
      current.status !== ('PAUSED' as any)
    ) {
      pauseStartedAt = new Date();
    }

    if (dto.status === 'ACTIVE') {
      const others = await this.prisma.studentPackage.findMany({
        where: {
          studentId: current.studentId,
          id: { not: current.id },
          status: { in: ['ACTIVE', 'PAUSED'] as any },
        },
      });

      for (const other of others) {
        const usage = await this.usageForSubscription(other);
        const expiredByDate =
          other.endDate != null &&
          other.endDate.getTime() < Date.now();
        const usedUp =
          other.includedSessionsSnapshot != null &&
          usage.usedSessions >= other.includedSessionsSnapshot;

        if (!expiredByDate && !usedUp) {
          throw new BadRequestException(
            'Học viên đã có một gói học khác còn hiệu lực',
          );
        }
      }
    }

    if (
      dto.status === 'ACTIVE' &&
      current.status === ('PAUSED' as any) &&
      current.pauseStartedAt
    ) {
      const days = Math.max(
        1,
        Math.ceil(
          (Date.now() - current.pauseStartedAt.getTime()) /
            86_400_000,
        ),
      );

      totalPausedDays += days;

      if (endDate) {
        const extended = new Date(endDate);
        extended.setDate(extended.getDate() + days);
        endDate = extended;
      }

      pauseStartedAt = null;
    }

    return this.prisma.studentPackage.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && {
          status: dto.status as any,
        }),
        ...(dto.paymentDueDate !== undefined && {
          paymentDueDate: new Date(dto.paymentDueDate),
        }),
        ...(dto.note !== undefined && {
          note: dto.note.trim() || null,
        }),
        endDate,
        pauseStartedAt,
        totalPausedDays,
      },
    });
  }

  async listInvoices() {
    const invoices = await this.prisma.tuitionInvoice.findMany({
      where: {
        studentPackageId: {
          not: null,
        },
      },
      include: {
        student: {
          include: { branch: true },
        },
        studentPackage: {
          include: { package: true },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    return invoices.map((invoice) => {
      const total = Number(invoice.total);
      const paidAmount = Number(invoice.paidAmount);
      const remaining = Math.max(total - paidAmount, 0);

      let displayStatus = invoice.status as string;

      if (
        remaining > 0 &&
        invoice.dueDate.getTime() < now.getTime()
      ) {
        displayStatus = 'OVERDUE';
      }

      return {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        discount: Number(invoice.discount),
        reservedCredit: Number(invoice.reservedCredit),
        total,
        paidAmount,
        remaining,
        displayStatus,
      };
    });
  }

  async getInvoiceQr(invoiceId: string) {
    const invoice = await this.prisma.tuitionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: true,
        studentPackage: true,
      },
    });

    if (
      !invoice ||
      !invoice.studentPackageId ||
      !invoice.studentPackage
    ) {
      throw new NotFoundException('Không tìm thấy hóa đơn gói học');
    }

    const total = Number(invoice.total);
    const paidAmount = Number(invoice.paidAmount);
    const remaining = Math.max(total - paidAmount, 0);

    if (remaining <= 0) {
      throw new BadRequestException('Hóa đơn đã thanh toán đủ');
    }

    const runtime = await this.integrations.vietQrRuntime();
    const addInfo = this.integrations.sanitizeTransferContent(
      `${runtime.config.tuitionPrefix} ${invoice.invoiceNo}`,
    );
    const qr = await this.integrations.buildVietQr({
      amount: remaining,
      addInfo,
    });

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      studentId: invoice.studentId,
      studentName: invoice.student.fullName,
      packageName: invoice.studentPackage.packageNameSnapshot,
      ...qr,
    };
  }

  async getInvoicePayments(invoiceId: string) {
    const invoice = await this.prisma.tuitionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: true,
        payments: {
          include: {
            receipt: true,
          },
          orderBy: {
            paidAt: 'desc',
          },
        },
      },
    });

    if (!invoice || !invoice.studentPackageId) {
      throw new NotFoundException(
        'Không tìm thấy hóa đơn gói học',
      );
    }

    return invoice.payments.map((payment) => ({
      id: payment.id,
      paymentNo: payment.paymentNo,
      amount: Number(payment.amount),
      method: payment.method,
      paidAt: payment.paidAt,
      bankReference: payment.bankReference,
      note: payment.note,
      receipt: payment.receipt,
      invoice: {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        studentName: invoice.student.fullName,
        total: Number(invoice.total),
        paidAmount: Number(invoice.paidAmount),
      },
    }));
  }

  async createPayment(
    invoiceId: string,
    dto: CreatePackagePaymentDto,
  ) {
    const invoice = await this.prisma.tuitionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: true,
      },
    });

    if (!invoice || !invoice.studentPackageId) {
      throw new NotFoundException(
        'Không tìm thấy hóa đơn gói học',
      );
    }

    const total = Number(invoice.total);
    const paid = Number(invoice.paidAmount);
    const remaining = Math.max(total - paid, 0);

    if (remaining <= 0) {
      throw new BadRequestException('Hóa đơn đã thanh toán đủ');
    }

    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Số tiền thu vượt công nợ còn lại (${remaining})`,
      );
    }

    const nextPaid = paid + dto.amount;
    const nextStatus =
      nextPaid >= total ? 'PAID' : 'PARTIAL';
    const vietQrAccountNo =
      dto.method === 'BANK_TRANSFER' || dto.method === 'VIETQR'
        ? (await this.integrations.vietQrRuntime()).config.accountNo || null
        : null;

    return this.prisma.$transaction(async (tx) => {
      const paymentNo =
        `TT-${Date.now().toString().slice(-10)}`;
      const receiptNo =
        `PT-${Date.now().toString().slice(-10)}`;

      const payment = await tx.payment.create({
        data: {
          paymentNo,
          invoiceId,
          amount: dto.amount,
          method: dto.method as any,
          note: dto.note?.trim() || null,
          receipt: {
            create: {
              receiptNo,
            },
          },
        },
        include: {
          receipt: true,
        },
      });

      await tx.tuitionInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: nextPaid,
          status: nextStatus as any,
        },
      });

      await tx.cashTransaction.create({
        data: {
          branchId: invoice.student.branchId,
          type: 'INCOME' as any,
          category: 'Học phí gói',
          amount: dto.amount,
          description:
            `Thu học phí ${invoice.invoiceNo} - ${invoice.student.fullName}`,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
        },
      });

      if (
        dto.method === 'BANK_TRANSFER' ||
        dto.method === 'VIETQR'
      ) {
        await tx.bankTransferEvent.create({
          data: {
            provider: 'SYSTEM_MANUAL',
            transactionId: `SYSTEM-${payment.paymentNo}`,
            amount: dto.amount,
            description: `HP ${invoice.invoiceNo}`,
            accountNo: vietQrAccountNo,
            transferredAt: payment.paidAt,
            status: 'MATCHED' as any,
            invoiceId: invoice.id,
            paymentId: payment.id,
            note:
              'Chuyển khoản được xác nhận thủ công trong hệ thống',
            rawPayload: {
              source: 'SYSTEM_MANUAL',
              paymentNo: payment.paymentNo,
              method: dto.method,
            } as any,
          },
        });
      }

      return {
        ...payment,
        amount: Number(payment.amount),
        invoice: {
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          studentName: invoice.student.fullName,
          total,
          paidAmount: nextPaid,
        },
      };
    });
  }

  async warnings(days = 7) {
    const subscriptions = await this.listSubscriptions();
    const result: Array<Record<string, unknown>> = [];

    for (const subscription of subscriptions) {
      const student = subscription.student;
      const billing = subscription.billing;
      const usage = subscription.usage;

      if (
        billing.remaining > 0 &&
        billing.invoiceId !== null
      ) {
        const dueDate = billing.dueDate
          ? new Date(billing.dueDate)
          : null;

        if (
          dueDate &&
          dueDate.getTime() < Date.now()
        ) {
          result.push({
            type: 'OVERDUE_PAYMENT',
            severity: 'danger',
            studentId: student.id,
            studentName: student.fullName,
            subscriptionId: subscription.id,
            packageName: subscription.packageNameSnapshot,
            message:
              `Quá hạn học phí ${billing.remaining.toLocaleString('vi-VN')} ₫`,
            amount: billing.remaining,
            date: dueDate,
          });
        } else {
          result.push({
            type: 'UNPAID_FEE',
            severity: 'warning',
            studentId: student.id,
            studentName: student.fullName,
            subscriptionId: subscription.id,
            packageName: subscription.packageNameSnapshot,
            message:
              `Chưa nộp đủ học phí, còn ${billing.remaining.toLocaleString('vi-VN')} ₫`,
            amount: billing.remaining,
            date: dueDate,
          });
        }
      }

      if (
        subscription.endDate &&
        !['CANCELLED', 'COMPLETED'].includes(
          subscription.status as string,
        )
      ) {
        const endDate = new Date(subscription.endDate);
        const diffDays = Math.ceil(
          (endDate.getTime() - Date.now()) /
            86_400_000,
        );

        if (diffDays < 0) {
          result.push({
            type: 'PACKAGE_EXPIRED',
            severity: 'danger',
            studentId: student.id,
            studentName: student.fullName,
            subscriptionId: subscription.id,
            packageName: subscription.packageNameSnapshot,
            message: `Gói đã hết hạn ${Math.abs(diffDays)} ngày`,
            date: endDate,
          });
        } else if (diffDays <= days) {
          result.push({
            type: 'PACKAGE_EXPIRING',
            severity: 'warning',
            studentId: student.id,
            studentName: student.fullName,
            subscriptionId: subscription.id,
            packageName: subscription.packageNameSnapshot,
            message: `Gói còn ${diffDays} ngày`,
            date: endDate,
          });
        }
      }

      if (
        subscription.includedSessionsSnapshot != null &&
        usage.remainingSessions != null &&
        usage.remainingSessions <= 2 &&
        usage.remainingSessions > 0 &&
        subscription.displayStatus === 'ACTIVE'
      ) {
        result.push({
          type: 'SESSIONS_LOW',
          severity: 'warning',
          studentId: student.id,
          studentName: student.fullName,
          subscriptionId: subscription.id,
          packageName: subscription.packageNameSnapshot,
          message: `Gói chỉ còn ${usage.remainingSessions} buổi`,
          remainingSessions: usage.remainingSessions,
        });
      }

      if (
        subscription.includedSessionsSnapshot != null &&
        usage.remainingSessions === 0 &&
        !['CANCELLED', 'COMPLETED'].includes(
          subscription.status as string,
        )
      ) {
        result.push({
          type: 'SESSIONS_USED_UP',
          severity: 'danger',
          studentId: student.id,
          studentName: student.fullName,
          subscriptionId: subscription.id,
          packageName: subscription.packageNameSnapshot,
          message: 'Đã sử dụng hết số buổi của gói',
          remainingSessions: 0,
        });
      }
    }

    return result;
  }
}
