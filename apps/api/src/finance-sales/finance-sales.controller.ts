import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { FinanceSalesService } from './finance-sales.service.js';
import { CreateCashTransactionDto } from './dto/create-cash-transaction.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';

@Controller('finance-sales')
export class FinanceSalesController {
  constructor(private readonly service: FinanceSalesService) {}

  @Get('summary')
  summary(@Query('branchId') branchId?: string) {
    return this.service.summary(branchId || undefined);
  }

  @Get('transactions')
  transactions(
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.transactions(
      branchId || undefined,
      limit ? Number(limit) : 100,
    );
  }

  @Post('transactions')
  createTransaction(@Body() dto: CreateCashTransactionDto) {
    return this.service.createTransaction(dto);
  }


  @Get('products')
  products(@Query('includeInactive') includeInactive?: string) {
    return this.service.products(includeInactive === 'true');
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.updateProduct(id, dto);
  }

  @Patch('products/:id/stock')
  adjustStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.service.adjustStock(id, dto);
  }

  @Delete('products/:id')
  deactivateProduct(@Param('id') id: string) {
    return this.service.deactivateProduct(id);
  }

  @Get('sales')
  sales(
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.sales(
      branchId || undefined,
      limit ? Number(limit) : 100,
    );
  }

  @Get('sales/qr')
  saleQr(@Query('amount') amount?: string) {
    return this.service.saleQr(Number(amount));
  }

  @Post('sales')
  createSale(@Body() dto: CreateSaleDto) {
    return this.service.createSale(dto);
  }

  @Patch('sales/:id/cancel')
  cancelSale(@Param('id') id: string) {
    return this.service.cancelSale(id);
  }
}
