import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStaffPersonDto } from './dto/create-staff-person.dto.js';
import { UpdateStaffPersonDto } from './dto/update-staff-person.dto.js';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto.js';
import { CreateTimesheetDto } from './dto/create-timesheet.dto.js';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

type StaffViewer = {
  id: string;
  roles?: string[];
  permissions?: string[];
};

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private isTeacherReadOnly(viewer?: StaffViewer) {
    const roles = viewer?.roles ?? [];
    return roles.includes('TEACHER') && !roles.includes('OWNER') && !roles.includes('MANAGER');
  }

  private async teacherIdForUser(userId?: string) {
    if (!userId) return null;
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      select: { id: true },
    });
    return teacher?.id ?? null;
  }


  private avatarDirectory() {
    return resolve(process.cwd(), 'uploads', 'staff-avatars');
  }

  private avatarFile(userId: string, extension: string) {
    return resolve(this.avatarDirectory(), `${userId}.${extension}`);
  }

  private async removeAvatarFiles(userId: string) {
    for (const extension of ['jpg', 'png', 'webp']) {
      try {
        await unlink(this.avatarFile(userId, extension));
      } catch {
        // File không tồn tại: bỏ qua.
      }
    }
  }

  private vietnamMonthRange() {
    const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();

    return {
      start: new Date(Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000),
      end: new Date(Date.UTC(year, month + 1, 1) - 7 * 60 * 60 * 1000),
    };
  }

  private parseRange(from?: string, to?: string) {
    if (!from && !to) return this.vietnamMonthRange();

    const start = from
      ? new Date(`${from}T00:00:00+07:00`)
      : new Date('2000-01-01T00:00:00+07:00');

    const end = to
      ? new Date(`${to}T23:59:59.999+07:00`)
      : new Date('2100-01-01T00:00:00+07:00');

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Khoảng thời gian không hợp lệ');
    }

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
    }

    return { start, end };
  }

  private money(value: unknown) {
    if (value == null) return 0;
    return Number(value);
  }

  private teacherAmount(
    teacher: { payPerSession?: unknown; payPerHour?: unknown },
    minutes: number,
    sessionCount: number,
  ) {
    const perSession = this.money(teacher.payPerSession);
    const perHour = this.money(teacher.payPerHour);

    // Ưu tiên lương theo buổi nếu có số buổi và mức lương/buổi.
    if (sessionCount > 0 && perSession > 0) {
      return Math.round(sessionCount * perSession);
    }

    if (minutes > 0 && perHour > 0) {
      return Math.round((minutes / 60) * perHour);
    }

    return 0;
  }

  private personView(user: any) {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
      roles: (user.roles ?? []).map((item: any) => ({
        id: item.role.id,
        code: item.role.code,
        name: item.role.name,
      })),
      teacher: user.teacher
        ? {
            id: user.teacher.id,
            employeeCode: user.teacher.employeeCode,
            payPerSession: this.money(user.teacher.payPerSession),
            payPerHour: this.money(user.teacher.payPerHour),
            active: user.teacher.active,
            classes: (user.teacher.classes ?? []).map((item: any) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              branchId: item.branchId,
              branchName: item.branch?.name ?? '',
              scheduleText: item.scheduleText,
            })),
          }
        : null,
    };
  }

  async overview(viewer?: StaffViewer) {
    const { start, end } = this.vietnamMonthRange();
    const teacherReadOnly = this.isTeacherReadOnly(viewer);
    const ownTeacherId = teacherReadOnly ? await this.teacherIdForUser(viewer?.id) : null;
    const now = new Date();

    const [
      activePeople,
      activeTeachers,
      activeClasses,
      unassignedClasses,
      openTasks,
      overdueTasks,
      timesheets,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' as any } }),
      this.prisma.teacher.count({
        where: {
          active: true,
          user: { status: 'ACTIVE' as any },
        },
      }),
      this.prisma.class.count({ where: { active: true } }),
      this.prisma.class.count({
        where: { active: true, teacherId: null },
      }),
      this.prisma.task.count({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS'] as any },
        },
      }),
      this.prisma.task.count({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS'] as any },
          dueAt: { lt: now },
        },
      }),
      this.prisma.teacherTimesheet.findMany({
        where: {
          workDate: { gte: start, lt: end },
          ...(teacherReadOnly
            ? { teacherId: ownTeacherId ?? '__NO_TEACHER__' }
            : {}),
        },
        select: {
          amount: true,
          sessionCount: true,
          minutes: true,
        },
      }),
    ]);

    return {
      activePeople,
      activeTeachers,
      activeClasses,
      unassignedClasses,
      openTasks,
      overdueTasks,
      monthSessionCount: timesheets.reduce(
        (sum, item) => sum + item.sessionCount,
        0,
      ),
      monthMinutes: timesheets.reduce(
        (sum, item) => sum + item.minutes,
        0,
      ),
      monthPayroll: timesheets.reduce(
        (sum, item) => sum + this.money(item.amount),
        0,
      ),
    };
  }

  async roles() {
    return this.prisma.role.findMany({
      orderBy: [{ name: 'asc' }],
    });
  }

  async bootstrapRoles() {
    const defaults = [
      { code: 'OWNER', name: 'Chủ võ đường', description: 'Toàn quyền vận hành võ đường' },
      { code: 'MANAGER', name: 'Quản lý', description: 'Quản lý học viên, lớp, tài chính và báo cáo' },
      { code: 'TEACHER', name: 'Giáo viên', description: 'Giảng dạy, điểm danh và đánh giá học viên' },
      { code: 'CASHIER', name: 'Thu ngân', description: 'Học phí, phiếu thu và bán hàng' },
      { code: 'STAFF', name: 'Nhân viên', description: 'Nhân sự vận hành chung' },
    ];

    for (const item of defaults) {
      await this.prisma.role.upsert({
        where: { code: item.code },
        create: item,
        update: { name: item.name, description: item.description },
      });
    }

    return this.roles();
  }

  async people(viewer?: StaffViewer) {
    const rows = await this.prisma.user.findMany({
      include: {
        roles: {
          include: { role: true },
        },
        teacher: {
          include: {
            classes: {
              where: { active: true },
              include: { branch: true },
              orderBy: [{ name: 'asc' }],
            },
          },
        },
      },
      orderBy: [{ fullName: 'asc' }],
    });

    const teacherReadOnly = this.isTeacherReadOnly(viewer);
    return rows.map((item) => {
      const view = this.personView(item);
      if (teacherReadOnly && item.id !== viewer?.id && view.teacher) {
        // Không để lộ mức lương của giáo viên khác qua API.
        view.teacher.payPerSession = 0;
        view.teacher.payPerHour = 0;
      }
      return view;
    });
  }

  private async generateEmployeeCode() {
    const rows = await this.prisma.teacher.findMany({
      select: { employeeCode: true },
    });

    let maxNumber = 0;
    for (const row of rows) {
      const match = /^GV(\d+)$/i.exec(row.employeeCode ?? '');
      if (!match) continue;
      maxNumber = Math.max(maxNumber, Number(match[1]));
    }

    let nextNumber = maxNumber + 1;
    while (true) {
      const candidate = `GV${String(nextNumber).padStart(3, '0')}`;
      const exists = await this.prisma.teacher.findUnique({
        where: { employeeCode: candidate },
      });
      if (!exists) return candidate;
      nextNumber += 1;
    }
  }

  async createPerson(dto: CreateStaffPersonDto) {
    const fullName = dto.fullName?.trim();
    const email = dto.email?.trim() || null;
    const roleIds = Array.from(new Set(dto.roleIds ?? [])).filter(Boolean);

    if (!fullName) {
      throw new BadRequestException('Vui lòng nhập họ và tên nhân sự');
    }

    const username = dto.username?.trim();
    if (!username) {
      throw new BadRequestException('Vui lòng nhập tên đăng nhập');
    }

    const employeeCode = dto.isTeacher
      ? await this.generateEmployeeCode()
      : null;

    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (duplicate) {
      throw new BadRequestException('Tên đăng nhập hoặc email đã tồn tại');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          // Hệ thống hiện chưa có module đăng nhập. Không lưu mật khẩu thô.
          // Khi bổ sung Auth, tài khoản này sẽ dùng luồng kích hoạt/đặt mật khẩu.
          passwordHash: 'ACCOUNT_NOT_ACTIVATED',
          fullName,
          phone: dto.phone?.trim() || null,
          email,
          status: (dto.status ?? 'ACTIVE') as any,
        },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
          skipDuplicates: true,
        });
      }

      if (dto.isTeacher) {
        await tx.teacher.create({
          data: {
            userId: user.id,
            employeeCode: employeeCode!,
            payPerSession:
              dto.payPerSession == null ? null : Number(dto.payPerSession),
            payPerHour:
              dto.payPerHour == null ? null : Number(dto.payPerHour),
            active: true,
          },
        });
      }

      return user;
    });

    return this.personById(created.id);
  }

  async updatePerson(userId: string, dto: UpdateStaffPersonDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacher: true },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy nhân sự');
    }

    const username = dto.username?.trim();
    const email = dto.email === undefined
      ? undefined
      : dto.email?.trim() || null;

    if (username || email) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [
            ...(username ? [{ username }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      });
      if (duplicate) {
        throw new BadRequestException('Tên đăng nhập hoặc email đã tồn tại');
      }
    }

    const generatedEmployeeCode =
      dto.isTeacher === true && !existing.teacher
        ? await this.generateEmployeeCode()
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(username !== undefined ? { username } : {}),
          ...(dto.fullName !== undefined
            ? { fullName: dto.fullName.trim() }
            : {}),
          ...(dto.phone !== undefined
            ? { phone: dto.phone?.trim() || null }
            : {}),
          ...(email !== undefined ? { email } : {}),
          ...(dto.status !== undefined
            ? { status: dto.status as any }
            : {}),
        },
      });

      if (dto.roleIds !== undefined) {
        const roleIds = Array.from(new Set(dto.roleIds)).filter(Boolean);
        await tx.userRole.deleteMany({ where: { userId } });
        if (roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({ userId, roleId })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.isTeacher === true) {
        if (existing.teacher) {
          await tx.teacher.update({
            where: { id: existing.teacher.id },
            data: {
              active: true,
              ...(dto.payPerSession !== undefined
                ? { payPerSession: dto.payPerSession }
                : {}),
              ...(dto.payPerHour !== undefined
                ? { payPerHour: dto.payPerHour }
                : {}),
            },
          });
        } else {
          await tx.teacher.create({
            data: {
              userId,
              employeeCode: generatedEmployeeCode!,
              payPerSession:
                dto.payPerSession == null ? null : Number(dto.payPerSession),
              payPerHour:
                dto.payPerHour == null ? null : Number(dto.payPerHour),
              active: true,
            },
          });
        }
      }

      if (dto.isTeacher === false && existing.teacher) {
        await tx.teacher.update({
          where: { id: existing.teacher.id },
          data: { active: false },
        });
      }
    });

    return this.personById(userId);
  }

  private async personById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        teacher: {
          include: {
            classes: {
              where: { active: true },
              include: { branch: true },
              orderBy: [{ name: 'asc' }],
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy nhân sự');
    return this.personView(user);
  }

  async saveAvatar(userId: string, dataUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân sự');

    const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
      dataUrl.trim(),
    );
    if (!match) {
      throw new BadRequestException('Ảnh phải là JPG, PNG hoặc WEBP');
    }

    const extension = match[1].toLowerCase() === 'jpeg'
      ? 'jpg'
      : match[1].toLowerCase();
    const content = Buffer.from(match[2], 'base64');
    if (content.length === 0) {
      throw new BadRequestException('File ảnh rỗng');
    }
    if (content.length > 4 * 1024 * 1024) {
      throw new BadRequestException('Ảnh nhân sự không được vượt quá 4 MB');
    }

    await mkdir(this.avatarDirectory(), { recursive: true });
    await this.removeAvatarFiles(userId);
    await writeFile(this.avatarFile(userId, extension), content);

    const avatarUrl = `/api/staff/people/${userId}/avatar?v=${Date.now()}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return this.personById(userId);
  }

  async avatarPath(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân sự');

    for (const extension of ['jpg', 'png', 'webp']) {
      const filePath = this.avatarFile(userId, extension);
      try {
        await stat(filePath);
        return filePath;
      } catch {
        // Thử phần mở rộng tiếp theo.
      }
    }

    throw new NotFoundException('Nhân sự chưa có ảnh đại diện');
  }

  async deleteAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân sự');

    await this.removeAvatarFiles(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
    return this.personById(userId);
  }

  async deletePerson(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        teacher: {
          include: {
            _count: {
              select: {
                sessions: true,
                timesheets: true,
                learningNotes: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasksCreated: true,
            tasksOwned: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy nhân sự');

    const teacherHistory = user.teacher
      ? user.teacher._count.sessions +
        user.teacher._count.timesheets +
        user.teacher._count.learningNotes
      : 0;

    if (teacherHistory > 0) {
      throw new BadRequestException(
        'Không thể xóa nhân sự này vì đã có lịch sử giảng dạy/chấm công/đánh giá. Hãy chuyển trạng thái sang Ngừng hoạt động để bảo toàn dữ liệu.',
      );
    }

    if (user._count.tasksCreated > 0) {
      throw new BadRequestException(
        'Không thể xóa nhân sự này vì đã tạo công việc trong hệ thống. Hãy chuyển trạng thái sang Ngừng hoạt động để giữ lịch sử.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Công việc đang giao cho người này vẫn được giữ, chỉ bỏ người phụ trách.
      if (user._count.tasksOwned > 0) {
        await tx.task.updateMany({
          where: { ownerId: userId },
          data: { ownerId: null },
        });
      }

      if (user.teacher) {
        // Phân công lớp hiện tại không phải lịch sử; bỏ phân công trước khi xóa giáo viên.
        await tx.class.updateMany({
          where: { teacherId: user.teacher.id },
          data: { teacherId: null },
        });
        await tx.teacher.delete({ where: { id: user.teacher.id } });
      }

      await tx.userRole.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    await this.removeAvatarFiles(userId);
    return { deleted: true, userId };
  }

  async classes() {
    const rows = await this.prisma.class.findMany({
      where: { active: true },
      include: {
        branch: true,
        teacher: { include: { user: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [
        { branch: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    return rows.map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      branchId: item.branchId,
      branchName: item.branch?.name ?? '',
      scheduleText: item.scheduleText,
      teacherId: item.teacherId,
      teacherName: item.teacher?.user?.fullName ?? null,
      enrollmentCount: item._count?.enrollments ?? 0,
    }));
  }

  async assignClassTeacher(classId: string, dto: AssignClassTeacherDto) {
    const classItem = await this.prisma.class.findUnique({
      where: { id: classId },
    });
    if (!classItem) throw new NotFoundException('Không tìm thấy lớp học');

    const teacherId = dto.teacherId?.trim() || null;
    if (teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { user: true },
      });

      if (!teacher || teacher.user.status !== 'ACTIVE') {
        throw new BadRequestException('Giáo viên không hoạt động hoặc không tồn tại');
      }

      // Dữ liệu giáo viên cũ có thể còn teacher.active = false dù tài khoản
      // nhân sự vẫn đang hoạt động. Khi quản lý chủ động phân lớp, kích hoạt
      // lại hồ sơ giáo viên để dropdown và các nghiệp vụ sau đó dùng được.
      if (!teacher.active) {
        await this.prisma.teacher.update({
          where: { id: teacher.id },
          data: { active: true },
        });
      }
    }

    await this.prisma.class.update({
      where: { id: classId },
      data: { teacherId },
    });

    return this.classes();
  }

  async timesheets(from?: string, to?: string, teacherId?: string, viewer?: StaffViewer) {
    const { start, end } = this.parseRange(from, to);
    const teacherReadOnly = this.isTeacherReadOnly(viewer);
    const ownTeacherId = teacherReadOnly ? await this.teacherIdForUser(viewer?.id) : null;
    const effectiveTeacherId = teacherReadOnly ? ownTeacherId : teacherId;

    if (teacherReadOnly && !ownTeacherId) return [];

    const rows = await this.prisma.teacherTimesheet.findMany({
      where: {
        workDate: { gte: start, lte: end },
        ...(effectiveTeacherId ? { teacherId: effectiveTeacherId } : {}),
      },
      include: {
        teacher: { include: { user: true } },
        session: {
          include: {
            class: true,
          },
        },
      },
      orderBy: [{ workDate: 'desc' }],
    });

    return rows.map((item: any) => ({
      id: item.id,
      teacherId: item.teacherId,
      teacherName: item.teacher?.user?.fullName ?? '',
      employeeCode: item.teacher?.employeeCode ?? '',
      workDate: item.workDate,
      minutes: item.minutes,
      sessionCount: item.sessionCount,
      amount: this.money(item.amount),
      note: item.note,
      sessionId: item.sessionId,
      session: item.session
        ? {
            id: item.session.id,
            startsAt: item.session.startsAt,
            classId: item.session.classId,
            classCode: item.session.class?.code ?? '',
            className: item.session.class?.name ?? '',
          }
        : null,
    }));
  }

  async createTimesheet(dto: CreateTimesheetDto) {
    const teacherId = dto.teacherId?.trim();
    if (!teacherId) {
      throw new BadRequestException('Vui lòng chọn giáo viên cần chấm công');
    }
    if (!dto.workDate?.trim()) {
      throw new BadRequestException('Vui lòng chọn ngày làm việc');
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: true },
    });

    if (!teacher || !teacher.active) {
      throw new BadRequestException('Giáo viên không tồn tại hoặc đã ngừng hoạt động');
    }

    const workDate = new Date(dto.workDate);
    if (Number.isNaN(workDate.getTime())) {
      throw new BadRequestException('Ngày chấm công không hợp lệ');
    }

    let minutes = Math.max(0, Number(dto.minutes ?? 0));
    let sessionCount = Math.max(0, Number(dto.sessionCount ?? 0));
    let sessionId = dto.sessionId?.trim() || null;

    if (sessionId) {
      const session = await this.prisma.classSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) throw new NotFoundException('Không tìm thấy buổi học');
      if (session.isCancelled) {
        throw new BadRequestException('Không thể chấm công cho buổi học đã hủy');
      }
      if (session.teacherId && session.teacherId !== teacher.id) {
        throw new BadRequestException('Buổi học đang được gán cho giáo viên khác');
      }

      const duplicate = await this.prisma.teacherTimesheet.findFirst({
        where: { teacherId: teacher.id, sessionId },
      });
      if (duplicate) {
        throw new BadRequestException('Buổi học này đã được ghi công cho giáo viên');
      }

      if (sessionCount === 0) sessionCount = 1;
      if (minutes === 0 && session.endsAt) {
        minutes = Math.max(
          0,
          Math.round(
            (session.endsAt.getTime() - session.startsAt.getTime()) / 60000,
          ),
        );
      }
    }

    const amount = dto.amount == null
      ? this.teacherAmount(teacher, minutes, sessionCount)
      : Math.max(0, Number(dto.amount));

    return this.prisma.teacherTimesheet.create({
      data: {
        teacherId: teacher.id,
        workDate,
        minutes,
        sessionCount,
        amount,
        sessionId,
        note: dto.note?.trim() || null,
      },
    });
  }

  async updateTimesheet(id: string, dto: UpdateTimesheetDto) {
    const existing = await this.prisma.teacherTimesheet.findUnique({
      where: { id },
      include: { teacher: true },
    });

    if (!existing) throw new NotFoundException('Không tìm thấy bản chấm công');

    const teacherId = dto.teacherId ?? existing.teacherId;
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên');

    const minutes = dto.minutes == null
      ? existing.minutes
      : Math.max(0, Number(dto.minutes));
    const sessionCount = dto.sessionCount == null
      ? existing.sessionCount
      : Math.max(0, Number(dto.sessionCount));

    const workDate = dto.workDate
      ? new Date(dto.workDate)
      : existing.workDate;

    if (Number.isNaN(workDate.getTime())) {
      throw new BadRequestException('Ngày chấm công không hợp lệ');
    }

    const amount = dto.amount === undefined
      ? this.teacherAmount(teacher, minutes, sessionCount)
      : dto.amount == null
        ? 0
        : Math.max(0, Number(dto.amount));

    return this.prisma.teacherTimesheet.update({
      where: { id },
      data: {
        teacherId,
        workDate,
        minutes,
        sessionCount,
        amount,
        ...(dto.note !== undefined
          ? { note: dto.note?.trim() || null }
          : {}),
      },
    });
  }

  async syncTimesheets(from?: string, to?: string) {
    const { start, end } = this.parseRange(from, to);

    const sessions = await this.prisma.classSession.findMany({
      where: {
        startsAt: { gte: start, lte: end },
        isCancelled: false,
        teacherId: { not: null },
      },
      include: {
        teacher: true,
      },
      orderBy: [{ startsAt: 'asc' }],
    });

    let created = 0;
    let skipped = 0;

    for (const session of sessions) {
      if (!session.teacherId || !session.teacher || !session.teacher.active) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.teacherTimesheet.findFirst({
        where: {
          teacherId: session.teacherId,
          sessionId: session.id,
        },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const minutes = session.endsAt
        ? Math.max(
            0,
            Math.round(
              (session.endsAt.getTime() - session.startsAt.getTime()) / 60000,
            ),
          )
        : 0;
      const sessionCount = 1;
      const amount = this.teacherAmount(
        session.teacher,
        minutes,
        sessionCount,
      );

      await this.prisma.teacherTimesheet.create({
        data: {
          teacherId: session.teacherId,
          sessionId: session.id,
          workDate: session.startsAt,
          minutes,
          sessionCount,
          amount,
          note: 'Tự động tạo từ buổi học',
        },
      });
      created += 1;
    }

    return { created, skipped, totalSessions: sessions.length };
  }

  async payroll(from?: string, to?: string, viewer?: StaffViewer) {
    const { start, end } = this.parseRange(from, to);
    const teacherReadOnly = this.isTeacherReadOnly(viewer);
    const ownTeacherId = teacherReadOnly ? await this.teacherIdForUser(viewer?.id) : null;

    if (teacherReadOnly && !ownTeacherId) return [];

    const teachers = await this.prisma.teacher.findMany({
      where: teacherReadOnly ? { id: ownTeacherId! } : undefined,
      include: { user: true },
      orderBy: { employeeCode: 'asc' },
    });

    const sheets = await this.prisma.teacherTimesheet.findMany({
      where: {
        workDate: { gte: start, lte: end },
        ...(teacherReadOnly ? { teacherId: ownTeacherId! } : {}),
      },
      orderBy: { workDate: 'asc' },
    });

    const grouped = new Map<string, {
      sessionCount: number;
      minutes: number;
      amount: number;
      rows: number;
    }>();

    for (const sheet of sheets) {
      const current = grouped.get(sheet.teacherId) ?? {
        sessionCount: 0,
        minutes: 0,
        amount: 0,
        rows: 0,
      };
      current.sessionCount += sheet.sessionCount;
      current.minutes += sheet.minutes;
      current.amount += this.money(sheet.amount);
      current.rows += 1;
      grouped.set(sheet.teacherId, current);
    }

    return teachers.map((teacher) => {
      const summary = grouped.get(teacher.id) ?? {
        sessionCount: 0,
        minutes: 0,
        amount: 0,
        rows: 0,
      };

      return {
        teacherId: teacher.id,
        employeeCode: teacher.employeeCode,
        fullName: teacher.user.fullName,
        active: teacher.active,
        payPerSession: this.money(teacher.payPerSession),
        payPerHour: this.money(teacher.payPerHour),
        sessionCount: summary.sessionCount,
        minutes: summary.minutes,
        amount: summary.amount,
        timesheetCount: summary.rows,
      };
    });
  }

  async tasks(status?: string) {
    const rows = await this.prisma.task.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        creator: true,
        owner: true,
      },
      orderBy: [
        { status: 'asc' },
        { dueAt: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return rows.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      creatorId: item.creatorId,
      creatorName: item.creator?.fullName ?? '',
      ownerId: item.ownerId,
      ownerName: item.owner?.fullName ?? null,
      dueAt: item.dueAt,
      status: item.status,
      priority: item.priority,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      overdue:
        Boolean(item.dueAt) &&
        new Date(item.dueAt).getTime() < Date.now() &&
        !['DONE', 'CANCELLED'].includes(item.status),
    }));
  }

  async createTask(dto: CreateTaskDto) {
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('Vui lòng nhập tên công việc');

    let creatorId = dto.creatorId?.trim() || dto.ownerId?.trim() || '';

    if (!creatorId) {
      const firstActiveUser = await this.prisma.user.findFirst({
        where: { status: 'ACTIVE' as any },
        orderBy: { createdAt: 'asc' },
      });
      creatorId = firstActiveUser?.id ?? '';
    }

    if (!creatorId) {
      throw new BadRequestException(
        'Chưa có tài khoản nhân sự để làm người tạo công việc',
      );
    }

    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('Deadline không hợp lệ');
    }

    return this.prisma.task.create({
      data: {
        title,
        description: dto.description?.trim() || null,
        creatorId,
        ownerId: dto.ownerId?.trim() || null,
        dueAt,
        priority: Math.min(3, Math.max(1, Number(dto.priority ?? 2))),
        status: 'TODO' as any,
      },
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy công việc');

    let dueAt: Date | null | undefined = undefined;
    if (dto.dueAt !== undefined) {
      dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
      if (dueAt && Number.isNaN(dueAt.getTime())) {
        throw new BadRequestException('Deadline không hợp lệ');
      }
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.ownerId !== undefined
          ? { ownerId: dto.ownerId?.trim() || null }
          : {}),
        ...(dueAt !== undefined ? { dueAt } : {}),
        ...(dto.status !== undefined
          ? { status: dto.status as any }
          : {}),
        ...(dto.priority !== undefined
          ? {
              priority: Math.min(
                3,
                Math.max(1, Number(dto.priority)),
              ),
            }
          : {}),
      },
    });
  }
}
