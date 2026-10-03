import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBranchAdminDto } from './dto/create-branch-admin.dto.js';
import { UpdateBranchAdminDto } from './dto/update-branch-admin.dto.js';

@Injectable()
export class BranchAdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private monthRange() {
    const now = new Date();

    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),
      end: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      ),
    };
  }

  async findAll() {
    const branches =
      await this.prisma.branch.findMany({
        orderBy: {
          createdAt: 'asc',
        },
      });

    const { start, end } = this.monthRange();

    return Promise.all(
      branches.map(async (branch) => {
        const [
          activeStudents,
          allStudents,
          activeClasses,
          income,
          expense,
        ] = await Promise.all([
          this.prisma.student.count({
            where: {
              branchId: branch.id,
              status: 'ACTIVE' as any,
              deletedAt: null,
            },
          }),
          this.prisma.student.count({
            where: {
              branchId: branch.id,
              deletedAt: null,
            },
          }),
          this.prisma.class.count({
            where: {
              branchId: branch.id,
              active: true,
            },
          }),
          this.prisma.cashTransaction.aggregate({
            where: {
              branchId: branch.id,
              type: 'INCOME' as any,
              occurredAt: {
                gte: start,
                lt: end,
              },
            },
            _sum: {
              amount: true,
            },
          }),
          this.prisma.cashTransaction.aggregate({
            where: {
              branchId: branch.id,
              type: 'EXPENSE' as any,
              occurredAt: {
                gte: start,
                lt: end,
              },
            },
            _sum: {
              amount: true,
            },
          }),
        ]);

        const monthlyIncome =
          Number(income._sum.amount ?? 0);

        const monthlyExpense =
          Number(expense._sum.amount ?? 0);

        return {
          ...branch,
          stats: {
            activeStudents,
            allStudents,
            activeClasses,
            monthlyIncome,
            monthlyExpense,
            monthlyBalance:
              monthlyIncome - monthlyExpense,
          },
        };
      }),
    );
  }

  async create(dto: CreateBranchAdminDto) {
    const code = dto.code.trim().toUpperCase();

    const duplicate =
      await this.prisma.branch.findUnique({
        where: { code },
      });

    if (duplicate) {
      throw new BadRequestException(
        'Mã chi nhánh đã tồn tại',
      );
    }

    return this.prisma.branch.create({
      data: {
        code,
        name: dto.name.trim(),
        address:
          dto.address?.trim() || null,
        phone:
          dto.phone?.trim() || null,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateBranchAdminDto,
  ) {
    const current =
      await this.prisma.branch.findUnique({
        where: { id },
      });

    if (!current) {
      throw new NotFoundException(
        'Không tìm thấy chi nhánh',
      );
    }

    if (
      dto.code &&
      dto.code.trim().toUpperCase() !==
        current.code
    ) {
      const duplicate =
        await this.prisma.branch.findUnique({
          where: {
            code:
              dto.code
                .trim()
                .toUpperCase(),
          },
        });

      if (duplicate) {
        throw new BadRequestException(
          'Mã chi nhánh đã tồn tại',
        );
      }
    }

    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && {
          code:
            dto.code
              .trim()
              .toUpperCase(),
        }),
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),
        ...(dto.address !== undefined && {
          address:
            dto.address.trim() || null,
        }),
        ...(dto.phone !== undefined && {
          phone:
            dto.phone.trim() || null,
        }),
      },
    });
  }

  async remove(id: string) {
    const current =
      await this.prisma.branch.findUnique({
        where: { id },
      });

    if (!current) {
      throw new NotFoundException(
        'Không tìm thấy chi nhánh',
      );
    }

    // Phải tính cả dữ liệu đã soft-delete vì các bản ghi đó
    // vẫn còn branchId và vẫn tạo ràng buộc khóa ngoại trong PostgreSQL.
    const [
      studentCount,
      classCount,
      transactionCount,
      saleCount,
    ] = await Promise.all([
      this.prisma.student.count({
        where: {
          branchId: id,
        },
      }),
      this.prisma.class.count({
        where: {
          branchId: id,
        },
      }),
      this.prisma.cashTransaction.count({
        where: {
          branchId: id,
        },
      }),
      this.prisma.sale.count({
        where: {
          branchId: id,
        },
      }),
    ]);

    if (
      studentCount > 0 ||
      classCount > 0 ||
      transactionCount > 0 ||
      saleCount > 0
    ) {
      const reasons: string[] = [];

      if (studentCount > 0) {
        reasons.push(`${studentCount} học viên`);
      }

      if (classCount > 0) {
        reasons.push(`${classCount} lớp học`);
      }

      if (transactionCount > 0) {
        reasons.push(
          `${transactionCount} giao dịch thu/chi`,
        );
      }

      if (saleCount > 0) {
        reasons.push(`${saleCount} đơn bán hàng`);
      }

      throw new BadRequestException(
        `Không thể xóa chi nhánh vì đang có dữ liệu liên kết: ${reasons.join(', ')}. ` +
        'Hãy chuyển hoặc xử lý các dữ liệu này trước khi xóa chi nhánh.',
      );
    }

    await this.prisma.branch.delete({
      where: { id },
    });

    return {
      message: `Đã xóa chi nhánh ${current.code} · ${current.name}`,
      id: current.id,
    };
  }
}
