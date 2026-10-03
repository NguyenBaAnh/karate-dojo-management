import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { IntegrationService } from '../settings/integration.service.js';
import { CreateCashTransactionDto } from './dto/create-cash-transaction.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';

@Injectable()
export class FinanceSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationService,
  ) {}


  private paymentMethodLabel(method: string) {
    return {
      CASH: 'Tiền mặt',
      BANK_TRANSFER: 'Chuyển khoản',
      OTHER: 'Khác',
    }[method] ?? method;
  }

  private generateSaleNo() {
    const now = new Date();
    return `BH-${now.getFullYear()}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase()}`;
  }

  async saleQr(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán không hợp lệ');
    }

    const runtime = await this.integrations.vietQrRuntime();
    const saleNo = this.generateSaleNo();
    const addInfo = this.integrations.sanitizeTransferContent(
      `${runtime.config.salesPrefix} ${saleNo}`,
    );
    const qr = await this.integrations.buildVietQr({ amount, addInfo });

    return {
      saleNo,
      ...qr,
    };
  }

  private monthRange() {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }

  private transactionView(item: any) {
    return {
      ...item,
      amount: Number(item.amount),
    };
  }

  private productView(item: any) {
    return {
      ...item,
      price: Number(item.price),
      cost: item.cost == null ? null : Number(item.cost),
    };
  }

  private saleView(item: any, studentMap?: Map<string, any>) {
    return {
      ...item,
      total: Number(item.total),
      student:
        item.studentId && studentMap
          ? studentMap.get(item.studentId) ?? null
          : null,
      items: (item.items ?? []).map((saleItem: any) => ({
        ...saleItem,
        unitPrice: Number(saleItem.unitPrice),
        amount: Number(saleItem.amount),
        product: saleItem.product
          ? this.productView(saleItem.product)
          : undefined,
      })),
    };
  }

  async summary(branchId?: string) {
    const { start, end } = this.monthRange();

    const txWhere: any = {
      occurredAt: { gte: start, lt: end },
      ...(branchId && { branchId }),
    };

    const saleWhere: any = {
      soldAt: { gte: start, lt: end },
      status: 'COMPLETED' as any,
      ...(branchId && { branchId }),
    };

    const [income, expense, sales, salesCount, activeProducts, lowStockProducts] =
      await Promise.all([
        this.prisma.cashTransaction.aggregate({
          where: { ...txWhere, type: 'INCOME' as any },
          _sum: { amount: true },
        }),
        this.prisma.cashTransaction.aggregate({
          where: { ...txWhere, type: 'EXPENSE' as any },
          _sum: { amount: true },
        }),
        this.prisma.sale.aggregate({
          where: saleWhere,
          _sum: { total: true },
        }),
        this.prisma.sale.count({ where: saleWhere }),
        this.prisma.product.count({ where: { active: true } }),
        this.prisma.product.count({
          where: {
            active: true,
            stockQty: { lte: 5 },
          },
        }),
      ]);

    const monthlyIncome = Number(income._sum.amount ?? 0);
    const monthlyExpense = Number(expense._sum.amount ?? 0);

    return {
      branchId: branchId ?? null,
      monthStart: start,
      monthEnd: end,
      monthlyIncome,
      monthlyExpense,
      monthlyBalance: monthlyIncome - monthlyExpense,
      monthlySales: Number(sales._sum.total ?? 0),
      salesCount,
      activeProducts,
      lowStockProducts,
    };
  }

  async transactions(branchId?: string, limit = 100) {
    const items = await this.prisma.cashTransaction.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 300),
    });

    return items.map((item) => this.transactionView(item));
  }

  async createTransaction(dto: CreateCashTransactionDto) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }

    const item = await this.prisma.cashTransaction.create({
      data: {
        branchId: dto.branchId,
        type: dto.type as any,
        category: dto.category.trim(),
        amount: dto.amount,
        occurredAt: dto.occurredAt
          ? new Date(dto.occurredAt)
          : new Date(),
        description: dto.description?.trim() || null,
      },
      include: { branch: true },
    });

    return this.transactionView(item);
  }

  async products(includeInactive = false) {
    const items = await this.prisma.product.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return items.map((item) => this.productView(item));
  }

  async createProduct(dto: CreateProductDto) {
    const sku = dto.sku.trim().toUpperCase();

    const duplicate = await this.prisma.product.findUnique({
      where: { sku },
    });

    if (duplicate) {
      throw new BadRequestException('Mã SKU đã tồn tại');
    }

    const product = await this.prisma.product.create({
      data: {
        sku,
        name: dto.name.trim(),
        unit: dto.unit?.trim() || null,
        price: dto.price,
        cost: dto.cost ?? null,
        stockQty: dto.stockQty ?? 0,
        active: true,
      },
    });

    return this.productView(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const current = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    if (dto.sku && dto.sku.trim().toUpperCase() !== current.sku) {
      const duplicate = await this.prisma.product.findUnique({
        where: { sku: dto.sku.trim().toUpperCase() },
      });
      if (duplicate) {
        throw new BadRequestException('Mã SKU đã tồn tại');
      }
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku !== undefined && {
          sku: dto.sku.trim().toUpperCase(),
        }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.unit !== undefined && {
          unit: dto.unit.trim() || null,
        }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    return this.productView(product);
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    if (!Number.isInteger(dto.quantity) || dto.quantity === 0) {
      throw new BadRequestException(
        'Số lượng điều chỉnh phải là số nguyên khác 0',
      );
    }

    const current = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const nextQty = current.stockQty + dto.quantity;
    if (nextQty < 0) {
      throw new BadRequestException(
        `Tồn kho hiện tại chỉ còn ${current.stockQty}. Không thể giảm thêm ${Math.abs(dto.quantity)}.`,
      );
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { stockQty: nextQty },
    });

    return {
      ...this.productView(product),
      stockAdjustment: {
        quantity: dto.quantity,
        reason: dto.reason.trim(),
      },
    };
  }

  async deactivateProduct(id: string) {
    const current = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return this.productView(product);
  }

  async sales(branchId?: string, limit = 100) {
    const items = await this.prisma.sale.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        branch: true,
        items: { include: { product: true } },
      },
      orderBy: { soldAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 300),
    });

    const studentIds = Array.from(
      new Set(items.map((item) => item.studentId).filter(Boolean) as string[]),
    );

    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, code: true, fullName: true },
        })
      : [];

    const studentMap = new Map(students.map((student) => [student.id, student]));

    return items.map((item) => this.saleView(item, studentMap));
  }

  async createSale(dto: CreateSaleDto) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }

    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({
        where: {
          id: dto.studentId,
          deletedAt: null,
        },
      });

      if (!student) {
        throw new NotFoundException('Không tìm thấy học viên');
      }

      if (student.branchId !== dto.branchId) {
        throw new BadRequestException(
          'Học viên không thuộc chi nhánh đang bán hàng',
        );
      }
    }

    if (!dto.items?.length) {
      throw new BadRequestException('Đơn hàng chưa có sản phẩm');
    }

    for (const item of dto.items) {
      if (
        !item?.productId ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        throw new BadRequestException(
          'Sản phẩm hoặc số lượng trong đơn hàng không hợp lệ',
        );
      }
    }

    const merged = new Map<string, number>();
    for (const item of dto.items) {
      merged.set(
        item.productId,
        (merged.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const requested = Array.from(merged.entries()).map(
      ([productId, quantity]) => ({ productId, quantity }),
    );

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: requested.map((item) => item.productId) },
        active: true,
      },
    });

    if (products.length !== requested.length) {
      throw new BadRequestException(
        'Có sản phẩm không tồn tại hoặc đã ngừng bán',
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const lines = requested.map((item) => {
      const product = productMap.get(item.productId)!;
      if (product.stockQty < item.quantity) {
        throw new BadRequestException(
          `${product.name} chỉ còn ${product.stockQty} ${product.unit ?? 'sản phẩm'}.`,
        );
      }

      const unitPrice = Number(product.price);
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        amount: unitPrice * item.quantity,
      };
    });

    const total = lines.reduce((sum, item) => sum + item.amount, 0);
    const soldAt = new Date();
    const saleNo = dto.saleNo?.trim().toUpperCase() || this.generateSaleNo();

    const duplicateSaleNo = await this.prisma.sale.findUnique({
      where: { saleNo },
    });

    if (duplicateSaleNo) {
      throw new BadRequestException(
        'Mã đơn bán hàng đã tồn tại. Hãy tạo lại thanh toán.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: {
            id: line.productId,
            active: true,
            stockQty: { gte: line.quantity },
          },
          data: {
            stockQty: { decrement: line.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            'Tồn kho vừa thay đổi. Hãy tải lại và thử bán hàng lần nữa.',
          );
        }
      }

      const sale = await tx.sale.create({
        data: {
          saleNo,
          branchId: dto.branchId,
          studentId: dto.studentId || null,
          status: 'COMPLETED' as any,
          total,
          soldAt,
          paymentMethod: dto.paymentMethod as any,
          paymentReference: dto.paymentReference?.trim() || null,
          paymentNote: dto.paymentNote?.trim() || null,
          items: {
            create: lines,
          },
        },
        include: {
          branch: true,
          items: { include: { product: true } },
        },
      });

      await tx.cashTransaction.create({
        data: {
          branchId: dto.branchId,
          type: 'INCOME' as any,
          category: 'Bán hàng',
          amount: total,
          occurredAt: soldAt,
          description: `Bán hàng ${sale.saleNo} · ${this.paymentMethodLabel(dto.paymentMethod)}`,
          referenceType: 'SALE',
          referenceId: sale.id,
        },
      });

      return sale;
    });

    const studentMap = new Map<string, any>();
    if (dto.studentId) {
      const student = await this.prisma.student.findUnique({
        where: { id: dto.studentId },
        select: { id: true, code: true, fullName: true },
      });
      if (student) studentMap.set(student.id, student);
    }

    return this.saleView(created, studentMap);
  }

  async cancelSale(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Không tìm thấy đơn bán hàng');
    }

    if (sale.status === ('CANCELLED' as any)) {
      throw new BadRequestException('Đơn hàng đã được hủy trước đó');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: { increment: item.quantity },
          },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'CANCELLED' as any },
      });

      const originalIncome = await tx.cashTransaction.findFirst({
        where: {
          referenceType: 'SALE',
          referenceId: sale.id,
          type: 'INCOME' as any,
        },
      });

      if (originalIncome) {
        await tx.cashTransaction.create({
          data: {
            branchId: sale.branchId,
            type: 'EXPENSE' as any,
            category: 'Hoàn tiền bán hàng',
            amount: sale.total,
            occurredAt: new Date(),
            description: `Hủy đơn ${sale.saleNo} · hoàn tiền/đảo giao dịch`,
            referenceType: 'SALE_REFUND',
            referenceId: sale.id,
          },
        });
      }
    });

    return {
      message: 'Đã hủy đơn hàng và hoàn lại tồn kho',
    };
  }
}
