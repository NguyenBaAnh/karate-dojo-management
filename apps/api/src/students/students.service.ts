import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';

type AttendanceStats = {
  attended: number;
  total: number | null;
  recorded: number;
  subscriptionId: string | null;
  packageId: string | null;
  packageName: string | null;
};

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateStudentCode() {
    const year = new Date().getFullYear();
    const random = randomUUID()
      .replaceAll('-', '')
      .slice(0, 6)
      .toUpperCase();

    return `HV-${year}-${random}`;
  }

  private emptyAttendanceStats(): AttendanceStats {
    return {
      attended: 0,
      total: null,
      recorded: 0,
      subscriptionId: null,
      packageId: null,
      packageName: null,
    };
  }

  private packageTotal(subscription: {
    includedSessionsSnapshot: number | null;
    durationValueSnapshot: number | null;
    durationUnitSnapshot: string | null;
    sessionsPerWeekSnapshot: number | null;
  }) {
    // Ưu tiên tuyệt đối "Tổng số buổi" đã nhập trong gói.
    if (subscription.includedSessionsSnapshot != null) {
      return subscription.includedSessionsSnapshot;
    }

    // Chỉ quy ước khi gói KHÔNG nhập tổng số buổi.
    const duration = subscription.durationValueSnapshot;
    const unit = subscription.durationUnitSnapshot;
    const sessionsPerWeek = subscription.sessionsPerWeekSnapshot;

    if (!duration || !unit || !sessionsPerWeek) return null;

    if (unit === 'WEEK') {
      return duration * sessionsPerWeek;
    }

    if (unit === 'MONTH') {
      return duration * 4 * sessionsPerWeek;
    }

    if (unit === 'DAY') {
      return Math.ceil((duration * sessionsPerWeek) / 7);
    }

    return null;
  }

  private async buildAttendanceStats(studentIds: string[]) {
    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];
    const result = new Map<string, AttendanceStats>();

    for (const studentId of uniqueStudentIds) {
      result.set(studentId, this.emptyAttendanceStats());
    }

    if (uniqueStudentIds.length === 0) return result;

    const now = new Date();

    const subscriptions = await this.prisma.studentPackage.findMany({
      where: {
        studentId: { in: uniqueStudentIds },
        status: { not: 'CANCELLED' as any },
      },
      select: {
        id: true,
        studentId: true,
        packageId: true,
        startDate: true,
        endDate: true,
        status: true,
        includedSessionsSnapshot: true,
        durationValueSnapshot: true,
        durationUnitSnapshot: true,
        sessionsPerWeekSnapshot: true,
        packageNameSnapshot: true,
        createdAt: true,
      },
      orderBy: [
        { startDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const subscriptionsByStudent = new Map<
      string,
      Array<(typeof subscriptions)[number]>
    >();

    for (const subscription of subscriptions) {
      const rows = subscriptionsByStudent.get(subscription.studentId) ?? [];
      rows.push(subscription);
      subscriptionsByStudent.set(subscription.studentId, rows);
    }

    const selectedSubscriptions: Array<(typeof subscriptions)[number]> = [];

    for (const studentId of uniqueStudentIds) {
      const rows = subscriptionsByStudent.get(studentId) ?? [];
      if (rows.length === 0) continue;

      // 1) Gói ACTIVE/PAUSED đang thực sự có hiệu lực.
      const active = rows.find((subscription) => {
        const status = subscription.status as string;
        return (
          (status === 'ACTIVE' || status === 'PAUSED') &&
          subscription.startDate.getTime() <= now.getTime() &&
          (!subscription.endDate ||
            subscription.endDate.getTime() >= now.getTime())
        );
      });

      // 2) Gói PENDING đã tới ngày bắt đầu nhưng trạng thái chưa được cập nhật.
      const pendingStarted = rows.find(
        (subscription) =>
          (subscription.status as string) === 'PENDING' &&
          subscription.startDate.getTime() <= now.getTime(),
      );

      // 3) Nếu đã gia hạn trước, ưu tiên gói PENDING sắp tới khi gói cũ không còn hiệu lực.
      const pendingFuture = rows.find(
        (subscription) =>
          (subscription.status as string) === 'PENDING' &&
          subscription.startDate.getTime() > now.getTime(),
      );

      // 4) Cuối cùng dùng gói gần nhất đã bắt đầu để vẫn hiển thị lịch sử gói.
      const latestStarted = rows.find(
        (subscription) => subscription.startDate.getTime() <= now.getTime(),
      );

      const selected =
        active ?? pendingStarted ?? pendingFuture ?? latestStarted ?? rows[0];

      selectedSubscriptions.push(selected);

      result.set(studentId, {
        attended: 0,
        total: this.packageTotal(selected),
        recorded: 0,
        subscriptionId: selected.id,
        packageId: selected.packageId,
        packageName: selected.packageNameSnapshot,
      });
    }

    if (selectedSubscriptions.length === 0) return result;

    const attendances = await this.prisma.attendance.findMany({
      where: {
        OR: selectedSubscriptions.map((subscription) => {
          const usageEnd =
            subscription.endDate && subscription.endDate.getTime() < now.getTime()
              ? subscription.endDate
              : now;

          return {
            studentId: subscription.studentId,
            session: {
              isCancelled: false,
              startsAt: {
                gte: subscription.startDate,
                lte: usageEnd,
              },
            },
          };
        }),
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    for (const attendance of attendances) {
      const current = result.get(attendance.studentId);
      if (!current) continue;

      current.recorded += 1;

      if (
        attendance.status === 'PRESENT' ||
        attendance.status === 'LATE' ||
        attendance.status === 'MAKEUP'
      ) {
        current.attended += 1;
      }

      result.set(attendance.studentId, current);
    }

    return result;
  }

  async findAll(
    search?: string,
    branchId?: string,
    status?: string,
    page = 1,
    limit = 20,
  ) {
    page = Math.max(page, 1);
    limit = Math.min(Math.max(limit, 1), 500);

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          fullName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (branchId) {
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          branch: true,
          guardians: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    const attendanceStats = await this.buildAttendanceStats(
      students.map((student) => student.id),
    );

    return {
      data: students.map((student) => ({
        ...student,
        attendanceStats: attendanceStats.get(student.id) ?? this.emptyAttendanceStats(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
        guardians: true,
        enrollments: true,
        attendances: {
          orderBy: { checkedAt: 'desc' },
          take: 20,
        },
        learningNotes: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        invoices: true,
        reservations: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    const attendanceStats = await this.buildAttendanceStats([student.id]);
    return {
      ...student,
      attendanceStats: attendanceStats.get(student.id) ?? this.emptyAttendanceStats(),
    };
  }

  async attendanceHistory(id: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: id },
      select: {
        classId: true,
        startedAt: true,
        endedAt: true,
      },
    });

    const classIds = [...new Set(enrollments.map((item) => item.classId))];
    if (classIds.length === 0) {
      return {
        student: {
          id: student.id,
          code: student.code,
          fullName: student.fullName,
          beltLevel: student.beltLevel,
          status: student.status,
          branch: student.branch,
        },
        summary: { attended: 0, total: 0, recorded: 0 },
        rows: [],
      };
    }

    const now = new Date();
    const sessions = await this.prisma.classSession.findMany({
      where: {
        classId: { in: classIds },
        isCancelled: false,
        startsAt: { lte: now },
      },
      include: {
        class: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        attendances: {
          where: { studentId: id },
          select: {
            status: true,
            note: true,
            checkedAt: true,
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });

    const eligibleSessions = sessions.filter((session) =>
      enrollments.some(
        (enrollment) =>
          enrollment.classId === session.classId &&
          session.startsAt >= enrollment.startedAt &&
          (!enrollment.endedAt || session.startsAt <= enrollment.endedAt),
      ),
    );

    const rows = eligibleSessions.map((session) => {
      const attendance = session.attendances[0];
      return {
        sessionId: session.id,
        classId: session.classId,
        classCode: session.class.code,
        className: session.class.name,
        startsAt: session.startsAt,
        topic: session.topic,
        status: attendance?.status ?? null,
        note: attendance?.note ?? '',
        checkedAt: attendance?.checkedAt ?? null,
      };
    });

    const attended = rows.filter(
      (row) =>
        row.status === 'PRESENT' ||
        row.status === 'LATE' ||
        row.status === 'MAKEUP',
    ).length;
    const recorded = rows.filter((row) => row.status !== null).length;

    return {
      student: {
        id: student.id,
        code: student.code,
        fullName: student.fullName,
        beltLevel: student.beltLevel,
        status: student.status,
        branch: student.branch,
      },
      summary: {
        attended,
        total: rows.length,
        recorded,
      },
      rows,
    };
  }

  async create(dto: CreateStudentDto) {
    const branch = await this.prisma.branch.findUnique({
      where: {
        id: dto.branchId,
      },
    });

    if (!branch) {
      throw new BadRequestException('Chi nhánh không tồn tại');
    }

    const code = dto.code?.trim() || this.generateStudentCode();
    const existingCode = await this.prisma.student.findUnique({
      where: { code },
    });

    if (existingCode) {
      throw new BadRequestException('Mã học viên đã tồn tại');
    }

    return this.prisma.student.create({
      data: {
        code,
        fullName: dto.fullName.trim(),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        beltLevel: dto.beltLevel,
        status: dto.status ?? 'ACTIVE',
        note: dto.note,
        branchId: dto.branchId,
      },
      include: {
        branch: true,
      },
    });
  }

  async update(id: string, dto: UpdateStudentDto) {
    const currentStudent = await this.prisma.student.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!currentStudent) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: {
          id: dto.branchId,
        },
      });

      if (!branch) {
        throw new BadRequestException('Chi nhánh không tồn tại');
      }
    }

    const changedAt = new Date();

    const updatedStudent = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && {
            fullName: dto.fullName.trim(),
          }),
          ...(dto.dateOfBirth !== undefined && {
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.beltLevel !== undefined && { beltLevel: dto.beltLevel }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.status !== undefined &&
            dto.status !== 'ACTIVE' && {
              consecutiveAbsences: 0,
            }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        },
        include: {
          branch: true,
        },
      });

      // Bảo lưu: kết thúc các enrollment đang hoạt động tại thời điểm bảo lưu.
      // Khi học viên quay lại ACTIVE, quản lý chủ động xếp lại lớp phù hợp.
      if (dto.status === 'PAUSED') {
        await tx.enrollment.updateMany({
          where: {
            studentId: id,
            status: 'ACTIVE',
          },
          data: {
            status: 'PAUSED',
            endedAt: changedAt,
          },
        });
      }

      // Nghỉ hẳn: đóng cả enrollment ACTIVE và PAUSED để không còn xuất hiện
      // trong lớp/điểm danh và không tiếp tục tăng tổng số buổi.
      if (dto.status === 'INACTIVE') {
        await tx.enrollment.updateMany({
          where: {
            studentId: id,
            status: {
              in: ['ACTIVE', 'PAUSED'],
            },
          },
          data: {
            status: 'CANCELLED',
            endedAt: changedAt,
          },
        });
      }

      return student;
    });

    const attendanceStats = await this.buildAttendanceStats([id]);

    return {
      ...updatedStudent,
      attendanceStats: attendanceStats.get(id) ?? this.emptyAttendanceStats(),
    };
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.student.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      message: 'Đã xóa học viên',
    };
  }
}
