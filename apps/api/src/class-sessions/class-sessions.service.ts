import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClassSessionDto } from './dto/create-class-session.dto.js';
import { SaveAttendanceDto } from './dto/save-attendance.dto.js';

@Injectable()
export class ClassSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(classId?: string) {
    return this.prisma.classSession.findMany({
      where: classId ? { classId } : undefined,
      include: {
        class: {
          include: { branch: true },
        },
        teacher: {
          include: { user: true },
        },
        _count: {
          select: { attendances: true },
        },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: {
        class: {
          include: { branch: true },
        },
        teacher: {
          include: { user: true },
        },
        attendances: {
          include: { student: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy buổi học');
    }

    return session;
  }

  async create(dto: CreateClassSessionDto) {
    const karateClass = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });

    if (!karateClass) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    if (!karateClass.active) {
      throw new BadRequestException('Lớp học đã ngừng hoạt động');
    }

    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: dto.teacherId },
      });

      if (!teacher) {
        throw new BadRequestException('Giáo viên không tồn tại');
      }
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
    }

    return this.prisma.classSession.create({
      data: {
        classId: dto.classId,
        teacherId: dto.teacherId || karateClass.teacherId || null,
        startsAt,
        endsAt,
        topic: dto.topic?.trim() || null,
        note: dto.note?.trim() || null,
      },
      include: {
        class: {
          include: { branch: true },
        },
        teacher: {
          include: { user: true },
        },
      },
    });
  }

  private async buildAttendanceRoster(sessionId: string) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        class: {
          include: { branch: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy buổi học');
    }

    const [enrollments, savedAttendances] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: {
          classId: session.classId,
          startedAt: { lte: session.startsAt },
          OR: [
            { endedAt: null },
            { endedAt: { gte: session.startsAt } },
          ],
        },
        include: {
          student: {
            include: { branch: true },
          },
        },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.attendance.findMany({
        where: { sessionId },
        include: {
          student: {
            include: { branch: true },
          },
        },
      }),
    ]);

    const savedByStudent = new Map(
      savedAttendances.map((attendance) => [attendance.studentId, attendance]),
    );

    const rows = enrollments.map((enrollment) => {
      const saved = savedByStudent.get(enrollment.studentId);
      savedByStudent.delete(enrollment.studentId);

      return {
        enrollmentId: enrollment.id as string | null,
        studentId: enrollment.studentId,
        code: enrollment.student.code,
        fullName: enrollment.student.fullName,
        beltLevel: enrollment.student.beltLevel,
        consecutiveAbsences: enrollment.student.consecutiveAbsences,
        status: saved?.status ?? null,
        note: saved?.note ?? '',
        saved: Boolean(saved),
      };
    });

    // Giữ lại dữ liệu điểm danh lịch sử ngay cả khi enrollment đã thay đổi sau đó.
    for (const attendance of savedByStudent.values()) {
      rows.push({
        enrollmentId: null,
        studentId: attendance.studentId,
        code: attendance.student.code,
        fullName: attendance.student.fullName,
        beltLevel: attendance.student.beltLevel,
        consecutiveAbsences: attendance.student.consecutiveAbsences,
        status: attendance.status,
        note: attendance.note ?? '',
        saved: true,
      });
    }

    rows.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

    return { session, rows };
  }

  async getAttendance(sessionId: string) {
    return this.buildAttendanceRoster(sessionId);
  }

  async saveAttendance(sessionId: string, dto: SaveAttendanceDto) {
    const roster = await this.buildAttendanceRoster(sessionId);

    if (roster.session.isCancelled) {
      throw new BadRequestException('Buổi học đã bị hủy');
    }

    const duplicateCheck = new Set<string>();
    for (const row of dto.rows) {
      if (duplicateCheck.has(row.studentId)) {
        throw new BadRequestException('Danh sách điểm danh có học viên bị lặp');
      }
      duplicateCheck.add(row.studentId);
    }

    const allowedStudentIds = new Set(
      roster.rows.map((row) => row.studentId),
    );

    const invalid = dto.rows.find(
      (row) => !allowedStudentIds.has(row.studentId),
    );

    if (invalid) {
      throw new BadRequestException(
        'Có học viên không thuộc danh sách của buổi học này',
      );
    }

    // Chỉ có bản ghi Attendance khi người dùng thực sự chọn trạng thái.
    // status null/undefined nghĩa là "chưa ghi nhận" và sẽ xóa bản ghi cũ
    // nếu học viên trước đó đã được điểm danh rồi bỏ chọn.
    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        if (row.status == null) {
          await tx.attendance.deleteMany({
            where: {
              sessionId,
              studentId: row.studentId,
            },
          });
          continue;
        }

        await tx.attendance.upsert({
          where: {
            sessionId_studentId: {
              sessionId,
              studentId: row.studentId,
            },
          },
          create: {
            sessionId,
            studentId: row.studentId,
            status: row.status as any,
            note: row.note?.trim() || null,
          },
          update: {
            status: row.status as any,
            note: row.note?.trim() || null,
            checkedAt: new Date(),
          },
        });
      }
    });

    // Tính lại cho TOÀN BỘ học viên của buổi học, không chỉ các dòng thay đổi.
    // Điều này sửa cả trường hợp dữ liệu cũ bị lệch hoặc frontend gửi payload không đủ.
    await this.recalculateConsecutiveAbsences(
      roster.rows.map((row) => row.studentId),
    );

    return this.buildAttendanceRoster(sessionId);
  }

  private async recalculateConsecutiveAbsences(studentIds: string[]) {
    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];
    const counters = new Map<string, number>();

    if (uniqueStudentIds.length === 0) return counters;

    const now = new Date();
    const history = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: uniqueStudentIds },
        session: {
          isCancelled: false,
          startsAt: { lte: now },
        },
      },
      select: {
        studentId: true,
        status: true,
        session: { select: { startsAt: true } },
      },
    });

    const byStudent = new Map<string, typeof history>();
    for (const item of history) {
      const rows = byStudent.get(item.studentId) ?? [];
      rows.push(item);
      byStudent.set(item.studentId, rows);
    }

    for (const studentId of uniqueStudentIds) {
      const rows = byStudent.get(studentId) ?? [];
      rows.sort(
        (a, b) =>
          b.session.startsAt.getTime() - a.session.startsAt.getTime(),
      );

      let consecutiveAbsences = 0;
      for (const attendance of rows) {
        if (String(attendance.status) !== 'ABSENT') break;
        consecutiveAbsences += 1;
      }
      counters.set(studentId, consecutiveAbsences);
    }

    await this.prisma.$transaction(
      uniqueStudentIds.map((studentId) =>
        this.prisma.student.update({
          where: { id: studentId },
          data: {
            consecutiveAbsences: counters.get(studentId) ?? 0,
          },
        }),
      ),
    );

    return counters;
  }

  async rebuildConsecutiveAbsences(branchId?: string) {
    const students = await this.prisma.student.findMany({
      where: {
        deletedAt: null,
        ...(branchId && { branchId }),
      },
      select: { id: true },
    });

    const counters = await this.recalculateConsecutiveAbsences(
      students.map((student) => student.id),
    );

    let threshold = 2;
    try {
      const settings = await this.prisma.systemSetting.findUnique({
        where: { key: 'system' },
        select: { value: true },
      });
      const configured = Number(
        (settings?.value as any)?.operations?.absenceWarningCount ?? 2,
      );
      if (Number.isFinite(configured) && configured >= 1) threshold = configured;
    } catch {
      // Dự án cũ chưa có SystemSetting vẫn dùng mặc định 2 buổi.
    }

    const riskyStudents = Array.from(counters.values()).filter(
      (count) => count >= threshold,
    ).length;

    return {
      updatedStudents: students.length,
      riskyStudents,
      warningThreshold: threshold,
    };
  }

  async cancel(id: string) {
    const session = await this.findOne(id);

    if (session.isCancelled) {
      return { message: 'Buổi học đã được hủy trước đó' };
    }

    const studentIds = session.attendances.map(
      (attendance) => attendance.studentId,
    );

    await this.prisma.classSession.update({
      where: { id },
      data: { isCancelled: true },
    });

    if (studentIds.length > 0) {
      await this.recalculateConsecutiveAbsences(studentIds);
    }

    return { message: 'Đã hủy buổi học' };
  }
}
