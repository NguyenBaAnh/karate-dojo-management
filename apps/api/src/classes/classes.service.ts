import {
    BadRequestException,
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
  
  import { PrismaService } from '../prisma/prisma.service.js';
  import { CreateClassDto } from './dto/create-class.dto.js';
  import { UpdateClassDto } from './dto/update-class.dto.js';
  
  @Injectable()
  export class ClassesService {
    constructor(private readonly prisma: PrismaService) {}
  
    async findAll() {
      return this.prisma.class.findMany({
        include: {
          branch: true,
  
          teacher: {
            include: {
              user: true,
            },
          },
  
          _count: {
            select: {
              enrollments: {
                where: {
                  status: 'ACTIVE',
                  student: {
                    deletedAt: null,
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
        },
  
        orderBy: {
          createdAt: 'desc',
        },
      });
    }
  
    async findOne(id: string) {
      const karateClass = await this.prisma.class.findUnique({
        where: {
          id,
        },
  
        include: {
          branch: true,
  
          teacher: {
            include: {
              user: true,
            },
          },
  
          enrollments: {
            where: {
              status: 'ACTIVE',
              student: {
                deletedAt: null,
                status: 'ACTIVE',
              },
            },
            include: {
              student: true,
            },
          },
  
          _count: {
            select: {
              enrollments: {
                where: {
                  status: 'ACTIVE',
                  student: {
                    deletedAt: null,
                    status: 'ACTIVE',
                  },
                },
              },
              sessions: true,
            },
          },
        },
      });
  
      if (!karateClass) {
        throw new NotFoundException(
          'Không tìm thấy lớp học',
        );
      }
  
      return karateClass;
    }
  
    async create(dto: CreateClassDto) {
      const code = dto.code.trim().toUpperCase();
  
      const existingCode =
        await this.prisma.class.findUnique({
          where: {
            code,
          },
        });
  
      if (existingCode) {
        throw new BadRequestException(
          'Mã lớp đã tồn tại',
        );
      }
  
      const branch =
        await this.prisma.branch.findUnique({
          where: {
            id: dto.branchId,
          },
        });
  
      if (!branch) {
        throw new BadRequestException(
          'Chi nhánh không tồn tại',
        );
      }
  
      if (dto.teacherId) {
        const teacher =
          await this.prisma.teacher.findUnique({
            where: {
              id: dto.teacherId,
            },
          });
  
        if (!teacher) {
          throw new BadRequestException(
            'Giáo viên không tồn tại',
          );
        }
      }
  
      return this.prisma.class.create({
        data: {
          code,
          name: dto.name.trim(),
  
          description:
            dto.description?.trim() || null,
  
          branchId: dto.branchId,
  
          teacherId:
            dto.teacherId || null,
  
          capacity:
            dto.capacity ?? null,
  
          scheduleText:
            dto.scheduleText?.trim() || null,
  
          tuitionPerSession:
            dto.tuitionPerSession ?? null,
        },
  
        include: {
          branch: true,
  
          teacher: {
            include: {
              user: true,
            },
          },
        },
      });
    }
  
    async update(
      id: string,
      dto: UpdateClassDto,
    ) {
      const current = await this.findOne(id);
  
      if (dto.code) {
        const code = dto.code.trim().toUpperCase();
  
        if (code !== current.code) {
          const existing =
            await this.prisma.class.findUnique({
              where: {
                code,
              },
            });
  
          if (existing) {
            throw new BadRequestException(
              'Mã lớp đã tồn tại',
            );
          }
        }
      }
  
      if (dto.branchId) {
        const branch =
          await this.prisma.branch.findUnique({
            where: {
              id: dto.branchId,
            },
          });
  
        if (!branch) {
          throw new BadRequestException(
            'Chi nhánh không tồn tại',
          );
        }
      }
  
      if (dto.teacherId) {
        const teacher =
          await this.prisma.teacher.findUnique({
            where: {
              id: dto.teacherId,
            },
          });
  
        if (!teacher) {
          throw new BadRequestException(
            'Giáo viên không tồn tại',
          );
        }
      }
  
      return this.prisma.class.update({
        where: {
          id,
        },
  
        data: {
          ...(dto.code !== undefined && {
            code: dto.code.trim().toUpperCase(),
          }),
  
          ...(dto.name !== undefined && {
            name: dto.name.trim(),
          }),
  
          ...(dto.description !== undefined && {
            description:
              dto.description.trim() || null,
          }),
  
          ...(dto.branchId !== undefined && {
            branchId: dto.branchId,
          }),
  
          ...(dto.teacherId !== undefined && {
            teacherId:
              dto.teacherId || null,
          }),
  
          ...(dto.capacity !== undefined && {
            capacity: dto.capacity,
          }),
  
          ...(dto.scheduleText !== undefined && {
            scheduleText:
              dto.scheduleText.trim() || null,
          }),
  
          ...(dto.tuitionPerSession !== undefined && {
            tuitionPerSession:
              dto.tuitionPerSession,
          }),
  
          ...(dto.active !== undefined && {
            active: dto.active,
          }),
        },
  
        include: {
          branch: true,
  
          teacher: {
            include: {
              user: true,
            },
          },
        },
      });
    }
  
    async remove(id: string) {
      await this.findOne(id);
  
      await this.prisma.class.update({
        where: {
          id,
        },
  
        data: {
          active: false,
        },
      });
  
      return {
        message: 'Đã ngừng hoạt động lớp học',
      };
    }
  }