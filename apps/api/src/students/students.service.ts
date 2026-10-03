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
  total: number;
  recorded: number;
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

  private async buildAttendanceStats(studentIds: string[]) {
    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];
    const result = new Map<string, AttendanceStats>();

    for (const studentId of uniqueStudentIds) {
      result.set(studentId, { attended: 0, total: 0, recorded: 0 });
    }

    if (uniqueStudentIds.length === 0) return result;

    const now = new Date();
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: { in: uniqueStudentIds },
      },
      select: {
        studentId: true,
        classId: true,
        startedAt: true,
        endedAt: true,
      },
    });

    const classIds = [...new Set(enrollments.map((item) => item.classId))];
    if (classIds.length === 0) return result;

    const sessions = await this.prisma.classSession.findMany({
      where: {
        classId: { in: classIds },
        isCancelled: false,
        startsAt: { lte: now },
      },
      select: {
        id: true,
        classId: true,
        startsAt: true,
      },
    });

    const sessionsByClass = new Map<
      string,
      Array<{ id: string; startsAt: Date }>
    >();

    for (const session of sessions) {
      const rows = sessionsByClass.get(session.classId) ?? [];
      rows.push({ id: session.id, startsAt: session.startsAt });
      sessionsByClass.set(session.classId, rows);
    }

    const eligibleSessionIds = new Map<string, Set<string>>();
    for (const studentId of uniqueStudentIds) {
      eligibleSessionIds.set(studentId, new Set());
    }

    for (const enrollment of enrollments) {
      const sessionIds = eligibleSessionIds.get(enrollment.studentId)!;
      for (const session of sessionsByClass.get(enrollment.classId) ?? []) {
        if (session.startsAt < enrollment.startedAt) continue;
        if (enrollment.endedAt && session.startsAt > enrollment.endedAt) continue;
        sessionIds.add(session.id);
      }
    }

    const attendances = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: uniqueStudentIds },
        sessionId: { in: sessions.map((item) => item.id) },
      },
      select: {
        studentId: true,
        sessionId: true,
        status: true,
      },
    });

    for (const studentId of uniqueStudentIds) {
      const total = eligibleSessionIds.get(studentId)?.size ?? 0;
      result.set(studentId, { attended: 0, total, recorded: 0 });
    }

    for (const attendance of attendances) {
      const eligible = eligibleSessionIds.get(attendance.studentId);
      if (!eligible?.has(attendance.sessionId)) continue;

      const current = result.get(attendance.studentId) ?? {
        attended: 0,
        total: eligible.size,
        recorded: 0,
      };

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
        attendanceStats: attendanceStats.get(student.id) ?? {
          attended: 0,
          total: 0,
          recorded: 0,
        },
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
      attendanceStats: attendanceStats.get(student.id) ?? {
        attended: 0,
        total: 0,
        recorded: 0,
      },
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
      attendanceStats: attendanceStats.get(id) ?? {
        attended: 0,
        total: 0,
        recorded: 0,
      },
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
