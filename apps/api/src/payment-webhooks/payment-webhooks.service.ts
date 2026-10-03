import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { IntegrationService } from '../settings/integration.service.js';
import { BankTransferWebhookDto } from './dto/bank-transfer-webhook.dto.js';

@Injectable()
export class PaymentWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationService,
  ) {}

  async verifySecret(secret?: string) {
    await this.integrations.verifyWebhookSecret(secret);
  }

  private extractInvoiceNo(description: string) {
    const normalized = description.toUpperCase();
    const match = normalized.match(
      /HP-\d{4}-[A-Z0-9]+/,
    );

    return match?.[0] ?? null;
  }

  async receiveBankTransfer(dto: BankTransferWebhookDto) {
    const provider = dto.provider.trim().toUpperCase();
    const transactionId = dto.transactionId.trim();

    const existing =
      await this.prisma.bankTransferEvent.findUnique({
        where: {
          provider_transactionId: {
            provider,
            transactionId,
          },
        },
      });

    if (existing) {
      return {
        duplicate: true,
        event: {
          ...existing,
          amount: Number(existing.amount),
        },
      };
    }

    const event =
      await this.prisma.bankTransferEvent.create({
        data: {
          provider,
          transactionId,
          amount: dto.amount,
          description: dto.description.trim(),
          accountNo: dto.accountNo?.trim() || null,
          transferredAt: new Date(dto.transferredAt),
          status: 'RECEIVED' as any,
          rawPayload:
            dto.rawPayload === undefined
              ? undefined
              : (dto.rawPayload as any),
        },
      });

    const processed = await this.processEvent(event.id);

    return {
      duplicate: false,
      event: processed,
    };
  }

  private async findInvoiceForEvent(
    event: {
      description: string;
      invoiceId: string | null;
    },
    forcedInvoiceId?: string,
  ) {
    if (forcedInvoiceId) {
      return this.prisma.tuitionInvoice.findUnique({
        where: { id: forcedInvoiceId },
        include: {
          student: true,
          studentPackage: true,
        },
      });
    }

    if (event.invoiceId) {
      return this.prisma.tuitionInvoice.findUnique({
        where: { id: event.invoiceId },
        include: {
          student: true,
          studentPackage: true,
        },
      });
    }

    const invoiceNo =
      this.extractInvoiceNo(event.description);

    if (!invoiceNo) return null;

    return this.prisma.tuitionInvoice.findUnique({
      where: { invoiceNo },
      include: {
        student: true,
        studentPackage: true,
      },
    });
  }

  private async processEvent(
    eventId: string,
    forcedInvoiceId?: string,
  ) {
    const event =
      await this.prisma.bankTransferEvent.findUnique({
        where: { id: eventId },
      });

    if (!event) {
      throw new NotFoundException(
        'Không tìm thấy giao dịch ngân hàng',
      );
    }

    if (event.status === ('MATCHED' as any)) {
      return {
        ...event,
        amount: Number(event.amount),
      };
    }

    const invoice =
      await this.findInvoiceForEvent(
        event,
        forcedInvoiceId,
      );

    if (!invoice) {
      const updated =
        await this.prisma.bankTransferEvent.update({
          where: { id: event.id },
          data: {
            status: 'UNMATCHED' as any,
            note:
              'Không tìm thấy hóa đơn từ nội dung chuyển khoản',
            invoiceId: null,
          },
        });

      return {
        ...updated,
        amount: Number(updated.amount),
      };
    }

    const amount = Number(event.amount);
    const total = Number(invoice.total);
    const paidAmount = Number(invoice.paidAmount);
    const remaining = Math.max(
      total - paidAmount,
      0,
    );

    if (remaining <= 0) {
      const updated =
        await this.prisma.bankTransferEvent.update({
          where: { id: event.id },
          data: {
            status: 'IGNORED' as any,
            invoiceId: invoice.id,
            note:
              'Hóa đơn đã thanh toán đủ trước khi giao dịch được đối soát',
          },
        });

      return {
        ...updated,
        amount: Number(updated.amount),
      };
    }

    if (amount > remaining) {
      const updated =
        await this.prisma.bankTransferEvent.update({
          where: { id: event.id },
          data: {
            status: 'NEEDS_REVIEW' as any,
            invoiceId: invoice.id,
            note:
              `Số tiền chuyển ${amount} lớn hơn công nợ còn lại ${remaining}`,
          },
        });

      return {
        ...updated,
        amount: Number(updated.amount),
      };
    }

    const existingPayment =
      await this.prisma.payment.findFirst({
        where: {
          bankReference: event.transactionId,
        },
      });

    if (existingPayment) {
      const updated =
        await this.prisma.bankTransferEvent.update({
          where: { id: event.id },
          data: {
            status: 'MATCHED' as any,
            invoiceId: invoice.id,
            paymentId: existingPayment.id,
            note:
              'Giao dịch đã được ghi nhận trước đó',
          },
        });

      return {
        ...updated,
        amount: Number(updated.amount),
      };
    }

    const nextPaid = paidAmount + amount;
    const nextStatus =
      nextPaid >= total ? 'PAID' : 'PARTIAL';

    const safeReference =
      event.transactionId
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-8) || event.id.slice(-8);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const paymentNo =
          `AUTO-${Date.now()
            .toString()
            .slice(-8)}-${safeReference}`;

        const receiptNo =
          `PT-${Date.now()
            .toString()
            .slice(-8)}-${safeReference}`;

        const payment = await tx.payment.create({
          data: {
            paymentNo,
            invoiceId: invoice.id,
            amount,
            method: 'BANK_TRANSFER' as any,
            paidAt: event.transferredAt,
            bankReference:
              event.transactionId,
            note:
              `Tự động đối soát ${event.provider}: ${event.description}`,
            receipt: {
              create: {
                receiptNo,
                issuedAt: event.transferredAt,
              },
            },
          },
          include: {
            receipt: true,
          },
        });

        await tx.tuitionInvoice.update({
          where: { id: invoice.id },
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
            amount,
            occurredAt: event.transferredAt,
            description:
              `Tự động thu ${invoice.invoiceNo} - ${invoice.student.fullName}`,
            referenceType: 'PAYMENT',
            referenceId: payment.id,
          },
        });

        return tx.bankTransferEvent.update({
          where: { id: event.id },
          data: {
            status: 'MATCHED' as any,
            invoiceId: invoice.id,
            paymentId: payment.id,
            note:
              nextStatus === 'PAID'
                ? 'Đã tự động đối soát và thanh toán đủ'
                : 'Đã tự động đối soát, hóa đơn còn công nợ',
          },
        });
      },
    );

    return {
      ...result,
      amount: Number(result.amount),
    };
  }

  async findEvents(status?: string) {
    const events =
      await this.prisma.bankTransferEvent.findMany({
        where:
          status && status !== 'ALL'
            ? {
                status: status as any,
              }
            : undefined,
        orderBy: {
          transferredAt: 'desc',
        },
        take: 100,
      });

    return events.map((event) => ({
      ...event,
      amount: Number(event.amount),
    }));
  }

  async manualMatch(
    eventId: string,
    invoiceId: string,
  ) {
    const event =
      await this.prisma.bankTransferEvent.findUnique({
        where: { id: eventId },
      });

    if (!event) {
      throw new NotFoundException(
        'Không tìm thấy giao dịch ngân hàng',
      );
    }

    if (event.status === ('MATCHED' as any)) {
      throw new BadRequestException(
        'Giao dịch đã được đối soát',
      );
    }

    const invoice =
      await this.prisma.tuitionInvoice.findUnique({
        where: { id: invoiceId },
      });

    if (!invoice) {
      throw new NotFoundException(
        'Không tìm thấy hóa đơn',
      );
    }

    await this.prisma.bankTransferEvent.update({
      where: { id: event.id },
      data: {
        invoiceId,
        status: 'RECEIVED' as any,
        note:
          'Quản trị viên yêu cầu đối soát lại với hóa đơn đã chọn',
      },
    });

    return this.processEvent(
      event.id,
      invoiceId,
    );
  }
}
