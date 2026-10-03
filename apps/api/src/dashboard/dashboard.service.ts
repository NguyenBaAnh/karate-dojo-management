import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private localDayRange(now = new Date(), offsetHours = 7) {
    const offsetMs = offsetHours * 60 * 60 * 1000;
    const local = new Date(now.getTime() + offsetMs);
    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const d = local.getUTCDate();
    return {
      start: new Date(Date.UTC(y, m, d) - offsetMs),
      end: new Date(Date.UTC(y, m, d + 1) - offsetMs),
    };
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

  private monthRange(now = new Date()) {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }

  async overview(branchId?: string) {
    const now = new Date();
    const today = this.localDayRange(now);
    const month = this.monthRange(now);
    const absenceWarningCount = await this.absenceWarningThreshold();

    const [activeStudents, monthlyAttendance, income, expense, debtInvoices, todaySessions, absenceRisks, overdueInvoices, expiringPackages, branches] = await Promise.all([
      this.prisma.student.count({ where: { status: 'ACTIVE' as any, deletedAt: null, ...(branchId && { branchId }) } }),
      this.prisma.attendance.findMany({
        where: {
          checkedAt: { gte: month.start, lt: month.end },
          student: { deletedAt: null, ...(branchId && { branchId }) },
          session: { isCancelled: false },
        },
        select: { status: true },
      }),
      this.prisma.cashTransaction.aggregate({
        where: { type: 'INCOME' as any, occurredAt: { gte: month.start, lt: month.end }, ...(branchId && { branchId }) },
        _sum: { amount: true },
      }),
      this.prisma.cashTransaction.aggregate({
        where: { type: 'EXPENSE' as any, occurredAt: { gte: month.start, lt: month.end }, ...(branchId && { branchId }) },
        _sum: { amount: true },
      }),
      this.prisma.tuitionInvoice.findMany({
        where: {
          status: { notIn: ['PAID', 'CANCELLED'] as any },
          student: { deletedAt: null, ...(branchId && { branchId }) },
        },
        select: { total: true, paidAmount: true },
      }),
      this.prisma.classSession.findMany({
        where: {
          isCancelled: false,
          startsAt: { gte: today.start, lt: today.end },
          ...(branchId && { class: { branchId } }),
        },
        include: {
          class: { include: { branch: true } },
          teacher: { include: { user: true } },
          _count: { select: { attendances: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.student.findMany({
        where: { deletedAt: null, consecutiveAbsences: { gte: absenceWarningCount }, ...(branchId && { branchId }) },
        select: { id: true, fullName: true, consecutiveAbsences: true },
        orderBy: { consecutiveAbsences: 'desc' },
        take: 5,
      }),
      this.prisma.tuitionInvoice.findMany({
        where: {
          dueDate: { lt: now },
          status: { notIn: ['PAID', 'CANCELLED'] as any },
          student: { deletedAt: null, ...(branchId && { branchId }) },
        },
        include: { student: true },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      this.prisma.studentPackage.findMany({
        where: {
          status: { in: ['ACTIVE', 'PAUSED'] as any },
          endDate: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) },
          ...(branchId && { student: { branchId } }),
        },
        include: { student: true },
        orderBy: { endDate: 'asc' },
        take: 5,
      }),
      this.prisma.branch.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);

    const attendanceTotal = monthlyAttendance.length;
    const present = monthlyAttendance.filter((item) => ['PRESENT', 'LATE', 'MAKEUP'].includes(item.status as string)).length;
    const attendanceRate = attendanceTotal === 0 ? 0 : Math.round((present / attendanceTotal) * 1000) / 10;
    const monthlyRevenue = Number(income._sum.amount ?? 0);
    const monthlyExpenses = Number(expense._sum.amount ?? 0);
    const tuitionDebt = debtInvoices.reduce((sum, invoice) => sum + Math.max(Number(invoice.total) - Number(invoice.paidAmount), 0), 0);

    const currentOrNext = todaySessions.find((session) => {
      const start = session.startsAt.getTime();
      const end = session.endsAt?.getTime() ?? start + 2 * 60 * 60 * 1000;
      return start <= now.getTime() && end >= now.getTime();
    }) ?? todaySessions.find((session) => session.startsAt.getTime() >= now.getTime()) ?? null;

    const alerts = [
      ...absenceRisks.map((student) => ({ tone: 'danger', title: 'Nghỉ học liên tiếp', text: `${student.fullName} đã nghỉ ${student.consecutiveAbsences} buổi liên tiếp.`, targetPage: 'students' })),
      ...overdueInvoices.map((invoice) => ({ tone: 'warning', title: 'Học phí quá hạn', text: `${invoice.student.fullName} còn nợ ${Math.max(Number(invoice.total) - Number(invoice.paidAmount), 0).toLocaleString('vi-VN')} ₫.`, targetPage: 'tuition' })),
      ...expiringPackages.map((item) => ({ tone: 'info', title: 'Gói học sắp hết hạn', text: `${item.student.fullName} sắp hết hạn gói ${item.packageNameSnapshot}.`, targetPage: 'tuition' })),
    ].slice(0, 6);

    const revenueHistory = [] as Array<{ label: string; value: number }>;
    for (let offset = 5; offset >= 0; offset -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
      const aggregate = await this.prisma.cashTransaction.aggregate({
        where: { type: 'INCOME' as any, occurredAt: { gte: start, lt: end }, ...(branchId && { branchId }) },
        _sum: { amount: true },
      });
      revenueHistory.push({ label: `T${start.getMonth() + 1}`, value: Number(aggregate._sum.amount ?? 0) });
    }

    return {
      generatedAt: now,
      branchId: branchId ?? null,
      metrics: {
        activeStudents,
        attendanceRate,
        monthlyRevenue,
        monthlyExpenses,
        monthlyBalance: monthlyRevenue - monthlyExpenses,
        tuitionDebt,
      },
      todaySessions: todaySessions.map((session) => ({
        id: session.id,
        classId: session.classId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        topic: session.topic,
        className: session.class.name,
        classCode: session.class.code,
        branchName: session.class.branch.name,
        teacherName: session.teacher?.user.fullName ?? 'Chưa phân giáo viên',
        attendanceCount: session._count.attendances,
      })),
      quickAttendanceTarget: currentOrNext ? {
        classId: currentOrNext.classId,
        sessionId: currentOrNext.id,
        className: currentOrNext.class.name,
        startsAt: currentOrNext.startsAt,
      } : null,
      alerts,
      revenueHistory,
      branches: branches.map((branch) => ({ id: branch.id, code: branch.code, name: branch.name })),
    };
  }
}
