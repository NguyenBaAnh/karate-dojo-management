import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { LearningPackagesService } from './learning-packages.service.js';
import { CreateLearningPackageDto } from './dto/create-learning-package.dto.js';
import { UpdateLearningPackageDto } from './dto/update-learning-package.dto.js';
import { CreateStudentPackageDto } from './dto/create-student-package.dto.js';
import { UpdateStudentPackageDto } from './dto/update-student-package.dto.js';
import { CreatePackagePaymentDto } from './dto/create-package-payment.dto.js';
import { RenewStudentPackageDto } from './dto/renew-student-package.dto.js';

@Controller('learning-packages')
export class LearningPackagesController {
  constructor(
    private readonly service: LearningPackagesService,
  ) {}

  @Get('catalog')
  findPackages(
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.findPackages(
      includeInactive === 'true',
    );
  }

  @Post('catalog')
  createPackage(
    @Body() dto: CreateLearningPackageDto,
  ) {
    return this.service.createPackage(dto);
  }

  @Patch('catalog/:id')
  updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdateLearningPackageDto,
  ) {
    return this.service.updatePackage(id, dto);
  }

  @Delete('catalog/:id')
  deactivatePackage(
    @Param('id') id: string,
  ) {
    return this.service.deactivatePackage(id);
  }

  @Get('subscriptions')
  listSubscriptions(
    @Query('studentId') studentId?: string,
  ) {
    return this.service.listSubscriptions(studentId);
  }

  @Post('subscriptions')
  createSubscription(
    @Body() dto: CreateStudentPackageDto,
  ) {
    return this.service.createSubscription(dto);
  }

  @Post('subscriptions/:id/renew')
  renewSubscription(
    @Param('id') id: string,
    @Body() dto: RenewStudentPackageDto,
  ) {
    return this.service.renewSubscription(id, dto);
  }

  @Patch('subscriptions/:id')
  updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateStudentPackageDto,
  ) {
    return this.service.updateSubscription(id, dto);
  }

  @Get('invoices')
  listInvoices() {
    return this.service.listInvoices();
  }

  @Get('invoices/:id/qr')
  getInvoiceQr(
    @Param('id') id: string,
  ) {
    return this.service.getInvoiceQr(id);
  }

  @Get('invoices/:id/payments')
  getInvoicePayments(
    @Param('id') id: string,
  ) {
    return this.service.getInvoicePayments(id);
  }

  @Post('invoices/:id/payments')
  createPayment(
    @Param('id') id: string,
    @Body() dto: CreatePackagePaymentDto,
  ) {
    return this.service.createPayment(id, dto);
  }

  @Get('warnings')
  warnings(
    @Query('days') days?: string,
  ) {
    const value = Number(days ?? 7);
    return this.service.warnings(
      Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : 7,
    );
  }
}
