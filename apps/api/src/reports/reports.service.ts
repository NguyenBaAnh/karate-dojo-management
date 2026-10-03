import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseRange(from?: string, to?: string) {
    const now = new Date();

    const start = from
      ? new Date(`${from}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    const end = to
      ? new Date(`${to}T23:59:59.999`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return { start, end };
  }

  private async absenceWarningThreshold() {
    try {
      const settings = await this.prisma.systemSetting.findUnique({
        where: { key: 'system' },
        select: { value: true },
      });
      const value = Number(
        (settings?.value as any)?.operations?.absenceWarningCount ?? 2,
      );
      return Number.isFinite(value) && value >= 1 ? value : 2;
    } catch {
      return 2;
    }
  }

  private attendanceCounts(items: Array<{ status: unknown }>) {
    const present = items.filter((item) =>
      ['PRESENT', 'LATE', 'MAKEUP'].includes(String(item.status)),
    ).length;

    const absent = items.filter(
      (item) => String(item.status) === 'ABSENT',
    ).length;

    const late = items.filter(
      (item) => String(item.status) === 'LATE',
    ).length;

    const excused = items.filter(
      (item) => String(item.status) === 'EXCUSED',
    ).length;

    const makeup = items.filter(
      (item) => String(item.status) === 'MAKEUP',
    ).length;

    const total = items.length;
    const rate = total === 0 ? 0 : Math.round((present / total) * 1000) / 10;

    return {
      total,
      present,
      absent,
      late,
      excused,
      makeup,
      rate,
    };
  }

  async overview(from?: string, to?: string, branchId?: string) {
    const { start, end } = this.parseRange(from, to);
    const absenceWarningCount = await this.absenceWarningThreshold();

    const studentFilter: any = {
      deletedAt: null,
      ...(branchId && { branchId }),
    };

    const [
      activeStudents,
      newStudents,
      activeClasses,
      attendances,
      incomeTransactions,
      expenseTransactions,
      debtInvoices,
      sales,
      riskyStudents,
      branches,
    ] = await Promise.all([
      this.prisma.student.count({
        where: {
          ...studentFilter,
          status: 'ACTIVE' as any,
        },
      }),

      this.prisma.student.count({
        where: {
          ...studentFilter,
          joinedAt: { gte: start, lte: end },
        },
      }),

      this.prisma.class.count({
        where: {
          active: true,
          ...(branchId && { branchId }),
        },
      }),

      this.prisma.attendance.findMany({
        where: {
          checkedAt: { gte: start, lte: end },
          student: studentFilter,
          session: {
            isCancelled: false,
            ...(branchId && {
              class: { branchId },
            }),
          },
        },
        select: { status: true },
      }),

      this.prisma.cashTransaction.findMany({
        where: {
          occurredAt: { gte: start, lte: end },
          type: 'INCOME' as any,
          ...(branchId && { branchId }),
        },
        select: { amount: true },
      }),

      this.prisma.cashTransaction.findMany({
        where: {
          occurredAt: { gte: start, lte: end },
          type: 'EXPENSE' as any,
          ...(branchId && { branchId }),
        },
        select: { amount: true },
      }),

      this.prisma.tuitionInvoice.findMany({
        where: {
          status: {
            notIn: ['PAID', 'CANCELLED'] as any,
          },
          student: studentFilter,
        },
        select: {
          total: true,
          paidAmount: true,
        },
      }),

      this.prisma.sale.findMany({
        where: {
          soldAt: { gte: start, lte: end },
          status: 'COMPLETED' as any,
          ...(branchId && { branchId }),
        },
        select: { total: true },
      }),

      this.prisma.student.count({
        where: {
          ...studentFilter,
          consecutiveAbsences: { gte: absenceWarningCount },
        },
      }),

      this.prisma.branch.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
    ]);

    const attendance = this.attendanceCounts(attendances);

    const income = incomeTransactions.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    const expense = expenseTransactions.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    const tuitionDebt = debtInvoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(
          Number(invoice.total) - Number(invoice.paidAmount),
          0,
        ),
      0,
    );

    const salesRevenue = sales.reduce(
      (sum, sale) => sum + Number(sale.total),
      0,
    );

    return {
      from: start,
      to: end,
      branchId: branchId ?? null,
      metrics: {
        activeStudents,
        newStudents,
        activeClasses,
        attendanceRate: attendance.rate,
        attendanceRecords: attendance.total,
        income,
        expense,
        balance: income - expense,
        tuitionDebt,
        salesRevenue,
        salesCount: sales.length,
        riskyStudents,
      },
      branches,
    };
  }

  async attendance(from?: string, to?: string, branchId?: string) {
    const { start, end } = this.parseRange(from, to);

    const sessions = await this.prisma.classSession.findMany({
      where: {
        isCancelled: false,
        startsAt: { gte: start, lte: end },
        ...(branchId && {
          class: { branchId },
        }),
      },
      include: {
        class: {
          include: { branch: true },
        },
        attendances: {
          include: {
            student: true,
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    const byClass = new Map<string, any>();
    const studentMap = new Map<string, any>();

    for (const session of sessions) {
      const existing = byClass.get(session.classId) ?? {
        classId: session.classId,
        classCode: session.class.code,
        className: session.class.name,
        branchName: session.class.branch.name,
        sessions: 0,
        records: [] as Array<{ status: unknown }>,
      };

      existing.sessions += 1;
      existing.records.push(...session.attendances);
      byClass.set(session.classId, existing);

      for (const attendance of session.attendances) {
        const key = attendance.studentId;
        const current = studentMap.get(key) ?? {
          studentId: attendance.studentId,
          code: attendance.student.code,
          fullName: attendance.student.fullName,
          branchName: session.class.branch.name,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          makeup: 0,
          total: 0,
        };

        current.total += 1;
        const status = String(attendance.status);

        if (['PRESENT', 'LATE', 'MAKEUP'].includes(status)) {
          current.present += 1;
        }
        if (status === 'ABSENT') current.absent += 1;
        if (status === 'LATE') current.late += 1;
        if (status === 'EXCUSED') current.excused += 1;
        if (status === 'MAKEUP') current.makeup += 1;

        studentMap.set(key, current);
      }
    }

    const classes = Array.from(byClass.values()).map((item) => ({
      classId: item.classId,
      classCode: item.classCode,
      className: item.className,
      branchName: item.branchName,
      sessions: item.sessions,
      ...this.attendanceCounts(item.records),
    }));

    const students = Array.from(studentMap.values()).map((item) => ({
      ...item,
      rate:
        item.total === 0
          ? 0
          : Math.round((item.present / item.total) * 1000) / 10,
    }));

    const allRecords = sessions.flatMap((session) => session.attendances);

    return {
      from: start,
      to: end,
      summary: this.attendanceCounts(allRecords),
      classes,
      students: students.sort((a, b) => a.rate - b.rate),
    };
  }

  async debts(branchId?: string) {
    const now = new Date();

    const invoices = await this.prisma.tuitionInvoice.findMany({
      where: {
        status: {
          notIn: ['PAID', 'CANCELLED'] as any,
        },
        student: {
          deletedAt: null,
          ...(branchId && { branchId }),
        },
      },
      include: {
        student: {
          include: { branch: true },
        },
        studentPackage: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const rows = invoices
      .map((invoice) => {
        const total = Number(invoice.total);
        const paidAmount = Number(invoice.paidAmount);
        const remaining = Math.max(total - paidAmount, 0);
        const overdue = remaining > 0 && invoice.dueDate.getTime() < now.getTime();

        return {
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          studentId: invoice.studentId,
          studentCode: invoice.student.code,
          studentName: invoice.student.fullName,
          branchName: invoice.student.branch.name,
          packageName:
            invoice.studentPackage?.packageNameSnapshot ?? 'Gói học',
          dueDate: invoice.dueDate,
          total,
          paidAmount,
          remaining,
          status: overdue ? 'OVERDUE' : String(invoice.status),
        };
      })
      .filter((item) => item.remaining > 0);

    return {
      totalDebt: rows.reduce((sum, item) => sum + item.remaining, 0),
      overdueDebt: rows
        .filter((item) => item.status === 'OVERDUE')
        .reduce((sum, item) => sum + item.remaining, 0),
      overdueCount: rows.filter((item) => item.status === 'OVERDUE').length,
      rows,
    };
  }

  async finance(from?: string, to?: string, branchId?: string) {
    const { start, end } = this.parseRange(from, to);

    const [transactions, sales] = await Promise.all([
      this.prisma.cashTransaction.findMany({
        where: {
          occurredAt: { gte: start, lte: end },
          ...(branchId && { branchId }),
        },
        include: { branch: true },
        orderBy: { occurredAt: 'asc' },
      }),

      this.prisma.sale.findMany({
        where: {
          soldAt: { gte: start, lte: end },
          status: 'COMPLETED' as any,
          ...(branchId && { branchId }),
        },
        include: {
          branch: true,
          items: {
            include: { product: true },
          },
        },
        orderBy: { soldAt: 'asc' },
      }),
    ]);

    const income = transactions
      .filter((item) => String(item.type) === 'INCOME')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const expense = transactions
      .filter((item) => String(item.type) === 'EXPENSE')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const categoryMap = new Map<string, any>();

    for (const item of transactions) {
      const key = `${String(item.type)}::${item.category}`;
      const current = categoryMap.get(key) ?? {
        type: String(item.type),
        category: item.category,
        amount: 0,
        count: 0,
      };

      current.amount += Number(item.amount);
      current.count += 1;
      categoryMap.set(key, current);
    }

    const productMap = new Map<string, any>();

    for (const sale of sales) {
      for (const item of sale.items) {
        const current = productMap.get(item.productId) ?? {
          productId: item.productId,
          sku: item.product.sku,
          name: item.product.name,
          quantity: 0,
          revenue: 0,
        };

        current.quantity += item.quantity;
        current.revenue += Number(item.amount);
        productMap.set(item.productId, current);
      }
    }

    const dayMap = new Map<string, { date: string; income: number; expense: number }>();

    for (const item of transactions) {
      const date = item.occurredAt.toISOString().slice(0, 10);
      const current = dayMap.get(date) ?? {
        date,
        income: 0,
        expense: 0,
      };

      if (String(item.type) === 'INCOME') {
        current.income += Number(item.amount);
      } else {
        current.expense += Number(item.amount);
      }

      dayMap.set(date, current);
    }

    return {
      from: start,
      to: end,
      summary: {
        income,
        expense,
        balance: income - expense,
        salesRevenue: sales.reduce(
          (sum, sale) => sum + Number(sale.total),
          0,
        ),
        salesCount: sales.length,
      },
      categories: Array.from(categoryMap.values()).sort(
        (a, b) => b.amount - a.amount,
      ),
      products: Array.from(productMap.values()).sort(
        (a, b) => b.revenue - a.revenue,
      ),
      daily: Array.from(dayMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    };
  }

  async risks(branchId?: string) {
    const absenceWarningCount = await this.absenceWarningThreshold();
    const rows = await this.prisma.student.findMany({
      where: {
        deletedAt: null,
        consecutiveAbsences: { gte: absenceWarningCount },
        ...(branchId && { branchId }),
      },
      include: { branch: true },
      orderBy: [
        { consecutiveAbsences: 'desc' },
        { fullName: 'asc' },
      ],
    });

    return rows.map((student) => ({
      id: student.id,
      code: student.code,
      fullName: student.fullName,
      phone: student.phone,
      branchName: student.branch.name,
      beltLevel: student.beltLevel,
      consecutiveAbsences: student.consecutiveAbsences,
      status: student.status,
    }));
  }
}
