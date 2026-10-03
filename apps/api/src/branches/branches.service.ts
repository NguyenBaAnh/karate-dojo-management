import {
    BadRequestException,
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
  
  import { PrismaService } from '../prisma/prisma.service.js';
  import { CreateBranchDto } from './dto/create-branch.dto.js';
  import { UpdateBranchDto } from './dto/update-branch.dto.js';
  
  @Injectable()
  export class BranchesService {
    constructor(private readonly prisma: PrismaService) {}
  
    async findAll() {
      return this.prisma.branch.findMany({
        orderBy: {
          createdAt: 'asc',
        },
  
        include: {
          _count: {
            select: {
              students: true,
              classes: true,
            },
          },
        },
      });
    }
  
    async findOne(id: string) {
      const branch = await this.prisma.branch.findUnique({
        where: {
          id,
        },
  
        include: {
          _count: {
            select: {
              students: true,
              classes: true,
              transactions: true,
              sales: true,
            },
          },
        },
      });
  
      if (!branch) {
        throw new NotFoundException(
          'Không tìm thấy chi nhánh',
        );
      }
  
      return branch;
    }
  
    async create(dto: CreateBranchDto) {
      const code = dto.code.trim().toUpperCase();
  
      const existing = await this.prisma.branch.findUnique({
        where: {
          code,
        },
      });
  
      if (existing) {
        throw new BadRequestException(
          'Mã chi nhánh đã tồn tại',
        );
      }
  
      return this.prisma.branch.create({
        data: {
          code,
          name: dto.name.trim(),
          address: dto.address?.trim(),
          phone: dto.phone?.trim(),
          logoUrl: dto.logoUrl?.trim(),
        },
      });
    }
  
    async update(
      id: string,
      dto: UpdateBranchDto,
    ) {
      const branch = await this.findOne(id);
  
      let code: string | undefined;
  
      if (dto.code !== undefined) {
        code = dto.code.trim().toUpperCase();
  
        if (code !== branch.code) {
          const existing =
            await this.prisma.branch.findUnique({
              where: {
                code,
              },
            });
  
          if (existing) {
            throw new BadRequestException(
              'Mã chi nhánh đã tồn tại',
            );
          }
        }
      }
  
      return this.prisma.branch.update({
        where: {
          id,
        },
  
        data: {
          ...(code !== undefined && {
            code,
          }),
  
          ...(dto.name !== undefined && {
            name: dto.name.trim(),
          }),
  
          ...(dto.address !== undefined && {
            address: dto.address.trim(),
          }),
  
          ...(dto.phone !== undefined && {
            phone: dto.phone.trim(),
          }),
  
          ...(dto.logoUrl !== undefined && {
            logoUrl: dto.logoUrl.trim(),
          }),
        },
      });
    }
  }