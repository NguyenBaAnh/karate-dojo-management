import {
    BadRequestException,
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
  
  import { PrismaService } from '../prisma/prisma.service.js';
  import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
  import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto.js';
  
  @Injectable()
  export class EnrollmentsService {
    constructor(
      private readonly prisma: PrismaService,
    ) {}
  
    async findByClass(classId: string) {
      const karateClass =
        await this.prisma.class.findUnique({
          where: {
            id: classId,
          },
        });
  
      if (!karateClass) {
        throw new NotFoundException(
          'Không tìm thấy lớp học',
        );
      }
  
      return this.prisma.enrollment.findMany({
        where: {
          classId,
          status: 'ACTIVE',
        },
  
        include: {
          student: {
            include: {
              branch: true,
            },
          },
        },
  
        orderBy: {
          startedAt: 'asc',
        },
      });
    }
  
    async create(dto: CreateEnrollmentDto) {
      const student =
        await this.prisma.student.findFirst({
          where: {
            id: dto.studentId,
            deletedAt: null,
          },
        });
  
      if (!student) {
        throw new NotFoundException(
          'Không tìm thấy học viên',
        );
      }
  
      const karateClass =
        await this.prisma.class.findUnique({
          where: {
            id: dto.classId,
          },
        });
  
      if (!karateClass) {
        throw new NotFoundException(
          'Không tìm thấy lớp học',
        );
      }
  
      if (!karateClass.active) {
        throw new BadRequestException(
          'Lớp học đã ngừng hoạt động',
        );
      }
  
      if (student.branchId !== karateClass.branchId) {
        throw new BadRequestException(
          'Học viên và lớp học không cùng chi nhánh',
        );
      }
  
      const existing =
        await this.prisma.enrollment.findFirst({
          where: {
            studentId: dto.studentId,
            classId: dto.classId,
            status: 'ACTIVE',
          },
        });
  
      if (existing) {
        throw new BadRequestException(
          'Học viên đã có trong lớp này',
        );
      }
  
      if (karateClass.capacity) {
        const currentStudents =
          await this.prisma.enrollment.count({
            where: {
              classId: dto.classId,
              status: 'ACTIVE',
            },
          });
  
        if (
          currentStudents >= karateClass.capacity
        ) {
          throw new BadRequestException(
            'Lớp đã đủ sĩ số',
          );
        }
      }
  
      return this.prisma.enrollment.create({
        data: {
          studentId: dto.studentId,
          classId: dto.classId,
  
          customPricePerSession:
            dto.customPricePerSession ?? null,
        },
  
        include: {
          student: {
            include: {
              branch: true,
            },
          },
  
          class: {
            include: {
              branch: true,
            },
          },
        },
      });
    }
  
    async copyClassEnrollments(
      sourceClassId: string,
      targetClassId: string,
    ) {
      if (!sourceClassId || !targetClassId) {
        throw new BadRequestException(
          'Thiếu lớp nguồn hoặc lớp đích',
        );
      }

      if (sourceClassId === targetClassId) {
        throw new BadRequestException(
          'Lớp nguồn và lớp đích không được trùng nhau',
        );
      }

      const [sourceClass, targetClass] = await Promise.all([
        this.prisma.class.findUnique({
          where: { id: sourceClassId },
        }),
        this.prisma.class.findUnique({
          where: { id: targetClassId },
        }),
      ]);

      if (!sourceClass) {
        throw new NotFoundException('Không tìm thấy lớp nguồn');
      }

      if (!targetClass) {
        throw new NotFoundException('Không tìm thấy lớp đích');
      }

      if (!targetClass.active) {
        throw new BadRequestException('Lớp đích đã ngừng hoạt động');
      }

      if (sourceClass.branchId !== targetClass.branchId) {
        throw new BadRequestException(
          'Chỉ được sao chép học viên giữa các lớp cùng chi nhánh',
        );
      }

      const [sourceEnrollments, targetEnrollments] = await Promise.all([
        this.prisma.enrollment.findMany({
          where: {
            classId: sourceClassId,
            status: 'ACTIVE',
            student: {
              deletedAt: null,
              status: 'ACTIVE',
            },
          },
          select: { studentId: true },
        }),
        this.prisma.enrollment.findMany({
          where: {
            classId: targetClassId,
            status: 'ACTIVE',
          },
          select: { studentId: true },
        }),
      ]);

      const sourceStudentIds = [...new Set(
        sourceEnrollments.map((item) => item.studentId),
      )];
      const existingStudentIds = new Set(
        targetEnrollments.map((item) => item.studentId),
      );
      const studentIdsToCopy = sourceStudentIds.filter(
        (studentId) => !existingStudentIds.has(studentId),
      );

      if (studentIdsToCopy.length === 0) {
        return {
          copied: 0,
          skipped: sourceStudentIds.length,
          totalSource: sourceStudentIds.length,
          message:
            sourceStudentIds.length === 0
              ? 'Lớp nguồn chưa có học viên đang học'
              : 'Toàn bộ học viên đã có trong lớp đích',
        };
      }

      const startedAt = new Date();
      const result = await this.prisma.enrollment.createMany({
        data: studentIdsToCopy.map((studentId) => ({
          studentId,
          classId: targetClassId,
          status: 'ACTIVE',
          startedAt,
        })),
        skipDuplicates: true,
      });

      return {
        copied: result.count,
        skipped: sourceStudentIds.length - result.count,
        totalSource: sourceStudentIds.length,
        message: `Đã sao chép ${result.count} học viên`,
      };
    }

    async updateStatus(
      id: string,
      dto: UpdateEnrollmentStatusDto,
    ) {
      const enrollment =
        await this.prisma.enrollment.findUnique({
          where: {
            id,
          },
        });
  
      if (!enrollment) {
        throw new NotFoundException(
          'Không tìm thấy đăng ký lớp',
        );
      }
  
      if (dto.status === 'ACTIVE') {
        const existing =
          await this.prisma.enrollment.findFirst({
            where: {
              studentId: enrollment.studentId,
              classId: enrollment.classId,
              status: 'ACTIVE',
  
              NOT: {
                id,
              },
            },
          });
  
        if (existing) {
          throw new BadRequestException(
            'Học viên đã có enrollment đang hoạt động',
          );
        }
      }
  
      return this.prisma.enrollment.update({
        where: {
          id,
        },
  
        data: {
          status: dto.status,
  
          endedAt:
            dto.status === 'COMPLETED' ||
            dto.status === 'CANCELLED'
              ? new Date()
              : null,
        },
  
        include: {
          student: true,
          class: true,
        },
      });
    }
  
    async remove(id: string) {
      const enrollment =
        await this.prisma.enrollment.findUnique({
          where: {
            id,
          },
        });
  
      if (!enrollment) {
        throw new NotFoundException(
          'Không tìm thấy đăng ký lớp',
        );
      }
  
      await this.prisma.enrollment.update({
        where: {
          id,
        },
  
        data: {
          status: 'CANCELLED',
          endedAt: new Date(),
        },
      });
  
      return {
        message:
          'Đã đưa học viên ra khỏi lớp',
      };
    }
  }