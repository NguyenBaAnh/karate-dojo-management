import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';

import { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from './reports.service.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type ExportFilter = {
  from?: string;
  to?: string;
  branchId?: string;
};

type ExcelColumn = {
  header: string;
  key: string;
  width: number;
  type?: 'text' | 'number' | 'money' | 'date' | 'datetime' | 'percent';
};

@Injectable()
export class ReportsExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  private parseRange(from?: string, to?: string) {
    const now = new Date();
    const start = from
      ? new Date(`${from}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to
      ? new Date(`${to}T23:59:59.999`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private formatDate(value: Date | string) {
    return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
  }

  private formatDateTime(value: Date | string) {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private async reportMeta(branchId?: string) {
    if (!branchId) {
      return {
        branchLabel: 'Tất cả chi nhánh',
      };
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { code: true, name: true },
    });

    return {
      branchLabel: branch ? `${branch.code} · ${branch.name}` : 'Chi nhánh không xác định',
    };
  }

  private async rawFinance(filter: ExportFilter) {
    const { start, end } = this.parseRange(filter.from, filter.to);

    const [transactions, sales] = await Promise.all([
      this.prisma.cashTransaction.findMany({
        where: {
          occurredAt: { gte: start, lte: end },
          ...(filter.branchId && { branchId: filter.branchId }),
        },
        include: { branch: true },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.sale.findMany({
        where: {
          soldAt: { gte: start, lte: end },
          ...(filter.branchId && { branchId: filter.branchId }),
        },
        include: {
          branch: true,
          items: { include: { product: true } },
        },
        orderBy: { soldAt: 'asc' },
      }),
    ]);

    const studentIds = Array.from(
      new Set(sales.map((sale) => sale.studentId).filter(Boolean) as string[]),
    );

    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, code: true, fullName: true },
        })
      : [];

    const studentMap = new Map(students.map((student) => [student.id, student]));

    return {
      transactions: transactions.map((item) => ({
        id: item.id,
        occurredAt: item.occurredAt,
        branchCode: item.branch.code,
        branchName: item.branch.name,
        type: String(item.type),
        category: item.category,
        amount: Number(item.amount),
        description: item.description ?? '',
        referenceType: item.referenceType ?? '',
        referenceId: item.referenceId ?? '',
      })),
      sales: sales.map((sale: any) => ({
        id: sale.id,
        saleNo: sale.saleNo,
        soldAt: sale.soldAt,
        branchCode: sale.branch.code,
        branchName: sale.branch.name,
        studentCode: sale.studentId ? studentMap.get(sale.studentId)?.code ?? '' : '',
        customerName: sale.studentId
          ? studentMap.get(sale.studentId)?.fullName ?? 'Học viên'
          : 'Khách lẻ',
        paymentMethod: sale.paymentMethod ?? '',
        paymentReference: sale.paymentReference ?? '',
        paymentNote: sale.paymentNote ?? '',
        status: String(sale.status),
        total: Number(sale.total),
        items: sale.items.map((item: any) => ({
          sku: item.product.sku,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          amount: Number(item.amount),
        })),
      })),
    };
  }

  private styleWorkbook(workbook: ExcelJS.Workbook) {
    workbook.creator = 'Karate Dojo Management System';
    workbook.company = 'Karate Dojo';
    workbook.subject = 'Báo cáo vận hành võ đường';
    workbook.category = 'Báo cáo';
    workbook.created = new Date();
    workbook.modified = new Date();
  }

  private addTableSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    title: string,
    subtitle: string,
    columns: ExcelColumn[],
    rows: Record<string, unknown>[],
  ) {
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 4 }],
      properties: { defaultRowHeight: 19 },
    });

    const lastColumn = Math.max(columns.length, 1);

    sheet.mergeCells(1, 1, 1, lastColumn);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = {
      bold: true,
      size: 17,
      color: { argb: 'FFFFFFFF' },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF243C31' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells(2, 1, 2, lastColumn);
    const subtitleCell = sheet.getCell(2, 1);
    subtitleCell.value = subtitle;
    subtitleCell.font = { italic: true, color: { argb: 'FF5F6E64' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(2).height = 24;

    columns.forEach((column, index) => {
      const cell = sheet.getCell(4, index + 1);
      cell.value = column.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF496255' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: column.type === 'number' || column.type === 'money' || column.type === 'percent'
          ? 'right'
          : 'center',
        wrapText: true,
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFCDD7D1' } },
      };
      sheet.getColumn(index + 1).width = column.width;
    });
    sheet.getRow(4).height = 28;

    for (const rowData of rows) {
      const row = sheet.addRow(columns.map((column) => rowData[column.key] ?? ''));
      row.height = 21;

      columns.forEach((column, index) => {
        const cell = row.getCell(index + 1);
        cell.alignment = {
          vertical: 'middle',
          horizontal:
            column.type === 'number' || column.type === 'money' || column.type === 'percent'
              ? 'right'
              : column.type === 'date' || column.type === 'datetime'
                ? 'center'
                : 'left',
          wrapText: true,
        };

        if (column.type === 'money') {
          cell.numFmt = '#,##0 "₫";[Red](#,##0 "₫");-';
        } else if (column.type === 'number') {
          cell.numFmt = '#,##0;[Red](#,##0);-';
        } else if (column.type === 'percent') {
          cell.numFmt = '0.0%';
        } else if (column.type === 'date') {
          cell.numFmt = 'dd/mm/yyyy';
        } else if (column.type === 'datetime') {
          cell.numFmt = 'dd/mm/yyyy hh:mm';
        }
      });
    }

    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: lastColumn },
    };

    sheet.pageSetup = {
      orientation: columns.length >= 8 ? 'landscape' : 'portrait',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    };

    sheet.headerFooter.oddFooter = 'Trang &P / &N';
    sheet.headerFooter.oddHeader = '&LKarate Dojo Management System&R&D';

    return sheet;
  }

  async excel(filter: ExportFilter) {
    const [overview, attendance, debts, finance, risks, raw, meta] = await Promise.all([
      this.reports.overview(filter.from, filter.to, filter.branchId),
      this.reports.attendance(filter.from, filter.to, filter.branchId),
      this.reports.debts(filter.branchId),
      this.reports.finance(filter.from, filter.to, filter.branchId),
      this.reports.risks(filter.branchId),
      this.rawFinance(filter),
      this.reportMeta(filter.branchId),
    ]);

    const workbook = new ExcelJS.Workbook();
    this.styleWorkbook(workbook);

    const period = `${this.formatDate(overview.from)} - ${this.formatDate(overview.to)}`;
    const subtitle = `Kỳ báo cáo: ${period} | Chi nhánh: ${meta.branchLabel}`;

    const summarySheet = workbook.addWorksheet('Tổng hợp', {
      views: [{ state: 'frozen', ySplit: 5 }],
    });
    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = 'BÁO CÁO VẬN HÀNH VÕ ĐƯỜNG KARATE';
    summarySheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243C31' } };
    summarySheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
    summarySheet.getRow(1).height = 32;
    summarySheet.mergeCells('A2:D2');
    summarySheet.getCell('A2').value = subtitle;
    summarySheet.getCell('A2').font = { italic: true, color: { argb: 'FF5F6E64' } };
    summarySheet.getRow(2).height = 24;
    summarySheet.getCell('A4').value = 'CHỈ TIÊU';
    summarySheet.getCell('B4').value = 'GIÁ TRỊ';
    summarySheet.getCell('C4').value = 'ĐƠN VỊ';
    summarySheet.getCell('D4').value = 'GHI CHÚ';
    summarySheet.getRow(4).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF496255' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    summarySheet.getRow(4).height = 28;
    summarySheet.columns = [
      { width: 34 },
      { width: 22 },
      { width: 16 },
      { width: 42 },
    ];

    const summaryRows = [
      ['Học viên đang học', overview.metrics.activeStudents, 'học viên', `${overview.metrics.newStudents} học viên mới trong kỳ`],
      ['Lớp đang hoạt động', overview.metrics.activeClasses, 'lớp', ''],
      ['Tỷ lệ đi học', overview.metrics.attendanceRate / 100, '%', `${overview.metrics.attendanceRecords} lượt điểm danh`],
      ['Tổng thu', overview.metrics.income, 'VND', 'Theo sổ thu chi'],
      ['Tổng chi', overview.metrics.expense, 'VND', 'Theo sổ thu chi'],
      ['Dòng tiền ròng', overview.metrics.balance, 'VND', 'Tổng thu - Tổng chi'],
      ['Công nợ học phí', overview.metrics.tuitionDebt, 'VND', 'Các hóa đơn chưa thu đủ'],
      ['Doanh số bán hàng', overview.metrics.salesRevenue, 'VND', `${overview.metrics.salesCount} đơn hàng`],
      ['Học viên rủi ro', overview.metrics.riskyStudents, 'học viên', 'Nghỉ liên tiếp từ 2 buổi'],
    ];

    summaryRows.forEach((values) => {
      const row = summarySheet.addRow(values);
      row.height = 22;
      row.getCell(2).alignment = { horizontal: 'right' };
      if (values[2] === 'VND') row.getCell(2).numFmt = '#,##0 "₫";[Red](#,##0 "₫");-';
      if (values[2] === '%') row.getCell(2).numFmt = '0.0%';
    });

    this.addTableSheet(
      workbook,
      'Chuyên cần - Lớp',
      'BÁO CÁO CHUYÊN CẦN THEO LỚP',
      subtitle,
      [
        { header: 'Mã lớp', key: 'classCode', width: 14 },
        { header: 'Tên lớp', key: 'className', width: 26 },
        { header: 'Chi nhánh', key: 'branchName', width: 26 },
        { header: 'Số buổi', key: 'sessions', width: 12, type: 'number' },
        { header: 'Lượt điểm danh', key: 'total', width: 16, type: 'number' },
        { header: 'Có mặt', key: 'present', width: 12, type: 'number' },
        { header: 'Vắng', key: 'absent', width: 10, type: 'number' },
        { header: 'Trễ', key: 'late', width: 10, type: 'number' },
        { header: 'Có phép', key: 'excused', width: 12, type: 'number' },
        { header: 'Học bù', key: 'makeup', width: 10, type: 'number' },
        { header: 'Tỷ lệ đi học', key: 'rate', width: 15, type: 'percent' },
      ],
      attendance.classes.map((item: any) => ({ ...item, rate: item.rate / 100 })),
    );

    this.addTableSheet(
      workbook,
      'Chuyên cần - Học viên',
      'BÁO CÁO CHUYÊN CẦN THEO HỌC VIÊN',
      subtitle,
      [
        { header: 'Mã học viên', key: 'code', width: 16 },
        { header: 'Họ và tên', key: 'fullName', width: 28 },
        { header: 'Chi nhánh', key: 'branchName', width: 26 },
        { header: 'Lượt điểm danh', key: 'total', width: 16, type: 'number' },
        { header: 'Có mặt', key: 'present', width: 12, type: 'number' },
        { header: 'Vắng', key: 'absent', width: 10, type: 'number' },
        { header: 'Trễ', key: 'late', width: 10, type: 'number' },
        { header: 'Có phép', key: 'excused', width: 12, type: 'number' },
        { header: 'Học bù', key: 'makeup', width: 10, type: 'number' },
        { header: 'Tỷ lệ đi học', key: 'rate', width: 15, type: 'percent' },
      ],
      attendance.students.map((item: any) => ({ ...item, rate: item.rate / 100 })),
    );

    this.addTableSheet(
      workbook,
      'Công nợ học phí',
      'BÁO CÁO CÔNG NỢ HỌC PHÍ',
      `${subtitle} | Tổng nợ: ${this.formatMoney(debts.totalDebt)} | Quá hạn: ${this.formatMoney(debts.overdueDebt)}`,
      [
        { header: 'Số hóa đơn', key: 'invoiceNo', width: 22 },
        { header: 'Mã học viên', key: 'studentCode', width: 16 },
        { header: 'Học viên', key: 'studentName', width: 28 },
        { header: 'Chi nhánh', key: 'branchName', width: 26 },
        { header: 'Gói học', key: 'packageName', width: 30 },
        { header: 'Hạn thu', key: 'dueDate', width: 14, type: 'date' },
        { header: 'Phải thu', key: 'total', width: 18, type: 'money' },
        { header: 'Đã thu', key: 'paidAmount', width: 18, type: 'money' },
        { header: 'Còn nợ', key: 'remaining', width: 18, type: 'money' },
        { header: 'Trạng thái', key: 'statusText', width: 16 },
      ],
      debts.rows.map((item: any) => ({
        ...item,
        dueDate: new Date(item.dueDate),
        statusText:
          item.status === 'OVERDUE'
            ? 'Quá hạn'
            : item.status === 'PARTIAL'
              ? 'Thu một phần'
              : 'Chưa thu',
      })),
    );

    this.addTableSheet(
      workbook,
      'Sổ thu chi',
      'SỔ THU CHI CHI TIẾT',
      subtitle,
      [
        { header: 'Mã giao dịch', key: 'id', width: 28 },
        { header: 'Thời gian', key: 'occurredAt', width: 20, type: 'datetime' },
        { header: 'Mã CN', key: 'branchCode', width: 12 },
        { header: 'Chi nhánh', key: 'branchName', width: 26 },
        { header: 'Loại', key: 'typeText', width: 10 },
        { header: 'Danh mục', key: 'category', width: 22 },
        { header: 'Số tiền', key: 'amount', width: 18, type: 'money' },
        { header: 'Mô tả', key: 'description', width: 38 },
        { header: 'Nguồn', key: 'referenceType', width: 18 },
        { header: 'Mã tham chiếu', key: 'referenceId', width: 28 },
      ],
      raw.transactions.map((item) => ({
        ...item,
        occurredAt: new Date(item.occurredAt),
        typeText: item.type === 'INCOME' ? 'Thu' : 'Chi',
      })),
    );

    this.addTableSheet(
      workbook,
      'Tài chính - Danh mục',
      'TỔNG HỢP THU CHI THEO DANH MỤC',
      subtitle,
      [
        { header: 'Loại', key: 'typeText', width: 12 },
        { header: 'Danh mục', key: 'category', width: 30 },
        { header: 'Số giao dịch', key: 'count', width: 16, type: 'number' },
        { header: 'Số tiền', key: 'amount', width: 20, type: 'money' },
      ],
      finance.categories.map((item: any) => ({
        ...item,
        typeText: item.type === 'INCOME' ? 'Thu' : 'Chi',
      })),
    );

    this.addTableSheet(
      workbook,
      'Dòng tiền ngày',
      'DÒNG TIỀN THEO NGÀY',
      subtitle,
      [
        { header: 'Ngày', key: 'dateValue', width: 16, type: 'date' },
        { header: 'Thu', key: 'income', width: 20, type: 'money' },
        { header: 'Chi', key: 'expense', width: 20, type: 'money' },
        { header: 'Dòng tiền ròng', key: 'balance', width: 22, type: 'money' },
      ],
      finance.daily.map((item: any) => ({
        ...item,
        dateValue: new Date(`${item.date}T00:00:00`),
        balance: item.income - item.expense,
      })),
    );

    this.addTableSheet(
      workbook,
      'Sản phẩm bán chạy',
      'BÁO CÁO SẢN PHẨM BÁN CHẠY',
      subtitle,
      [
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Sản phẩm', key: 'name', width: 34 },
        { header: 'Số lượng bán', key: 'quantity', width: 16, type: 'number' },
        { header: 'Doanh số', key: 'revenue', width: 22, type: 'money' },
      ],
      finance.products,
    );

    this.addTableSheet(
      workbook,
      'Đơn bán hàng',
      'LỊCH SỬ BÁN HÀNG',
      subtitle,
      [
        { header: 'Mã đơn', key: 'saleNo', width: 22 },
        { header: 'Thời gian', key: 'soldAt', width: 20, type: 'datetime' },
        { header: 'Mã CN', key: 'branchCode', width: 12 },
        { header: 'Chi nhánh', key: 'branchName', width: 26 },
        { header: 'Mã học viên', key: 'studentCode', width: 16 },
        { header: 'Khách hàng', key: 'customerName', width: 28 },
        { header: 'Thanh toán', key: 'paymentMethodText', width: 18 },
        { header: 'Tham chiếu TT', key: 'paymentReference', width: 24 },
        { header: 'Ghi chú TT', key: 'paymentNote', width: 32 },
        { header: 'Tổng tiền', key: 'total', width: 18, type: 'money' },
        { header: 'Trạng thái', key: 'statusText', width: 16 },
      ],
      raw.sales.map((sale) => ({
        ...sale,
        soldAt: new Date(sale.soldAt),
        paymentMethodText: ({
          CASH: 'Tiền mặt',
          BANK_TRANSFER: 'Chuyển khoản',
          VIETQR: 'VietQR',
          CARD: 'Thẻ',
          OTHER: 'Khác',
        } as Record<string, string>)[String(sale.paymentMethod)] ?? String(sale.paymentMethod),
        statusText: sale.status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn tất',
      })),
    );

    this.addTableSheet(
      workbook,
      'Chi tiết bán hàng',
      'CHI TIẾT SẢN PHẨM TRONG ĐƠN BÁN HÀNG',
      subtitle,
      [
        { header: 'Mã đơn', key: 'saleNo', width: 22 },
        { header: 'Thời gian', key: 'soldAt', width: 20, type: 'datetime' },
        { header: 'Chi nhánh', key: 'branchName', width: 26 },
        { header: 'Khách hàng', key: 'customerName', width: 28 },
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Sản phẩm', key: 'productName', width: 34 },
        { header: 'Số lượng', key: 'quantity', width: 12, type: 'number' },
        { header: 'Đơn giá', key: 'unitPrice', width: 18, type: 'money' },
        { header: 'Thành tiền', key: 'amount', width: 18, type: 'money' },
        { header: 'Trạng thái đơn', key: 'statusText', width: 16 },
      ],
      raw.sales.flatMap((sale) =>
        sale.items.map((item: {
          sku: string;
          productName: string;
          quantity: number;
          unitPrice: number;
          amount: number;
        }) => ({
          saleNo: sale.saleNo,
          soldAt: new Date(sale.soldAt),
          branchName: sale.branchName,
          customerName: sale.customerName,
          ...item,
          statusText: sale.status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn tất',
        })),
      ),
    );

    this.addTableSheet(
      workbook,
      'Học viên rủi ro',
      'HỌC VIÊN CẦN THEO DÕI',
      subtitle,
      [
        { header: 'Mã học viên', key: 'code', width: 16 },
        { header: 'Họ và tên', key: 'fullName', width: 28 },
        { header: 'Chi nhánh', key: 'branchName', width: 26 },
        { header: 'Cấp đai', key: 'beltLevel', width: 16 },
        { header: 'Số điện thoại', key: 'phone', width: 16 },
        { header: 'Nghỉ liên tiếp', key: 'consecutiveAbsences', width: 16, type: 'number' },
        { header: 'Mức cảnh báo', key: 'riskLevel', width: 18 },
        { header: 'Trạng thái HV', key: 'status', width: 16 },
      ],
      risks.map((item: any) => ({
        ...item,
        riskLevel:
          item.consecutiveAbsences >= 4
            ? 'Cao'
            : item.consecutiveAbsences >= 3
              ? 'Cần liên hệ'
              : 'Theo dõi',
      })),
    );

    const buffer = await workbook.xlsx.writeBuffer();
    const dateSuffix = `${filter.from ?? new Date().toISOString().slice(0, 10)}_${filter.to ?? new Date().toISOString().slice(0, 10)}`;

    return {
      filename: `bao-cao-karate-${dateSuffix}.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  private resolvePdfFonts() {
    let packageNormal: string | undefined;
    let packageBold: string | undefined;
  
    try {
      packageNormal = require.resolve(
        'dejavu-fonts-ttf/ttf/DejaVuSans.ttf',
      );
  
      packageBold = require.resolve(
        'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',
      );
    } catch {
      packageNormal = undefined;
      packageBold = undefined;
    }
  
    const normalCandidates = [
      process.env.REPORT_PDF_FONT_PATH,
      packageNormal,
      'C:\\Windows\\Fonts\\arial.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ].filter(Boolean) as string[];
  
    const boldCandidates = [
      process.env.REPORT_PDF_FONT_BOLD_PATH,
      packageBold,
      'C:\\Windows\\Fonts\\arialbd.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ].filter(Boolean) as string[];
  
    const normal = normalCandidates.find((candidate) =>
      existsSync(candidate),
    );
  
    const bold = boldCandidates.find((candidate) =>
      existsSync(candidate),
    );
  
    if (!normal || !bold) {
      throw new Error(
        'Không tìm thấy font Unicode dùng để tạo PDF.',
      );
    }
  
    return { normal, bold };
  }

  private pdfTable(
    doc: PDFKit.PDFDocument,
    title: string,
    headers: string[],
    rows: string[][],
    widths: number[],
    normalFont: string,
    boldFont: string,
  ) {
    const margin = 36;
    const pageBottom = doc.page.height - 42;
    const rowPadding = 5;

    // PDFKit không tự co bảng theo khổ giấy. Một số bảng nhiều cột
    // (đặc biệt Công nợ học phí) có tổng width lớn hơn vùng in A4 landscape.
    // Chuẩn hóa toàn bộ độ rộng cột về đúng vùng in để cột cuối không bị tràn/cắt.
    const printableWidth = doc.page.width - margin * 2;
    const requestedWidth = widths.reduce((sum, value) => sum + value, 0);
    const scale = requestedWidth > printableWidth
      ? printableWidth / requestedWidth
      : 1;
    const fittedWidths = widths.map((value) => value * scale);

    // Bảng từ 8 cột trở lên dùng font nhỏ hơn một chút, nhưng vẫn giữ dễ đọc.
    const tableFontSize = headers.length >= 8 ? 7.4 : 8;

    const addSectionTitle = () => {
      doc.font(boldFont).fontSize(13).fillColor('#243C31').text(title, margin, doc.y + 8);
      doc.moveDown(0.5);
    };

    const drawHeader = () => {
      const y = doc.y;
      const heights = headers.map((header, index) =>
        doc.font(boldFont).fontSize(tableFontSize).heightOfString(header, { width: fittedWidths[index] - 10, lineGap: 1 }),
      );
      const h = Math.max(26, ...heights.map((value) => value + rowPadding * 2));
      let x = margin;
      headers.forEach((header, index) => {
        doc.rect(x, y, fittedWidths[index], h).fill('#496255');
        doc.font(boldFont).fontSize(tableFontSize).fillColor('#FFFFFF').text(header, x + 5, y + rowPadding, {
          width: fittedWidths[index] - 10,
          lineGap: 1,
          align: index >= headers.length - 3 ? 'right' : 'left',
        });
        x += fittedWidths[index];
      });
      doc.y = y + h;
      doc.fillColor('#1F2D25');
    };

    addSectionTitle();
    drawHeader();

    for (const row of rows) {
      const cellHeights = row.map((value, index) =>
        doc.font(normalFont).fontSize(tableFontSize).heightOfString(value, { width: fittedWidths[index] - 10, lineGap: 1 }),
      );
      const h = Math.max(22, ...cellHeights.map((value) => value + rowPadding * 2));

      if (doc.y + h > pageBottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin });
        addSectionTitle();
        drawHeader();
      }

      const y = doc.y;
      let x = margin;
      row.forEach((value, index) => {
        doc.rect(x, y, fittedWidths[index], h).fillAndStroke('#FFFFFF', '#DDE4DF');
        doc.font(normalFont).fontSize(tableFontSize).fillColor('#26352C').text(value, x + 5, y + rowPadding, {
          width: fittedWidths[index] - 10,
          lineGap: 1,
          align: index >= headers.length - 3 ? 'right' : 'left',
        });
        x += fittedWidths[index];
      });
      doc.y = y + h;
    }

    doc.moveDown(0.8);
  }

  async pdf(filter: ExportFilter) {
    const [overview, attendance, debts, finance, risks, meta] = await Promise.all([
      this.reports.overview(filter.from, filter.to, filter.branchId),
      this.reports.attendance(filter.from, filter.to, filter.branchId),
      this.reports.debts(filter.branchId),
      this.reports.finance(filter.from, filter.to, filter.branchId),
      this.reports.risks(filter.branchId),
      this.reportMeta(filter.branchId),
    ]);

    const fonts = this.resolvePdfFonts();
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      bufferPages: true,
      info: {
        Title: 'Báo cáo vận hành võ đường Karate',
        Author: 'Karate Dojo Management System',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.registerFont('ReportNormal', fonts.normal);
    doc.registerFont('ReportBold', fonts.bold);

    const normal = 'ReportNormal';
    const bold = 'ReportBold';

    doc.rect(0, 0, doc.page.width, 100).fill('#243C31');
    doc.font(bold).fontSize(22).fillColor('#FFFFFF').text('BÁO CÁO VẬN HÀNH VÕ ĐƯỜNG KARATE', 36, 28);
    doc.font(normal).fontSize(10).fillColor('#DDE7E1').text(
      `Kỳ báo cáo: ${this.formatDate(overview.from)} - ${this.formatDate(overview.to)} | ${meta.branchLabel}`,
      36,
      62,
    );
    doc.y = 118;

    const metrics = [
      ['Học viên đang học', String(overview.metrics.activeStudents), `${overview.metrics.newStudents} mới trong kỳ`],
      ['Tỷ lệ đi học', `${overview.metrics.attendanceRate}%`, `${overview.metrics.attendanceRecords} lượt điểm danh`],
      ['Tổng thu', this.formatMoney(overview.metrics.income), `Chi ${this.formatMoney(overview.metrics.expense)}`],
      ['Dòng tiền ròng', this.formatMoney(overview.metrics.balance), 'Thu - Chi'],
      ['Công nợ học phí', this.formatMoney(overview.metrics.tuitionDebt), 'Chưa thu đủ'],
      ['Doanh số bán hàng', this.formatMoney(overview.metrics.salesRevenue), `${overview.metrics.salesCount} đơn`],
      ['Lớp đang hoạt động', String(overview.metrics.activeClasses), ''],
      ['Học viên rủi ro', String(overview.metrics.riskyStudents), 'Nghỉ từ 2 buổi liên tiếp'],
    ];

    const cardWidth = 181;
    const cardHeight = 68;
    metrics.forEach((metric, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 36 + col * (cardWidth + 9);
      const y = 118 + row * (cardHeight + 10);
      doc.roundedRect(x, y, cardWidth, cardHeight, 6).fillAndStroke('#F6F8F5', '#DDE4DF');
      doc.font(normal).fontSize(8).fillColor('#6E7B72').text(metric[0], x + 10, y + 10, { width: cardWidth - 20 });
      doc.font(bold).fontSize(15).fillColor('#243C31').text(metric[1], x + 10, y + 27, { width: cardWidth - 20 });
      doc.font(normal).fontSize(7).fillColor('#819087').text(metric[2], x + 10, y + 51, { width: cardWidth - 20 });
    });

    doc.y = 276;

    this.pdfTable(
      doc,
      'Chuyên cần theo lớp',
      ['Mã lớp', 'Lớp', 'Chi nhánh', 'Buổi', 'Lượt', 'Có mặt', 'Vắng', 'Trễ', 'Có phép', 'Tỷ lệ'],
      attendance.classes.map((item: any) => [
        item.classCode,
        item.className,
        item.branchName,
        String(item.sessions),
        String(item.total),
        String(item.present),
        String(item.absent),
        String(item.late),
        String(item.excused),
        `${item.rate}%`,
      ]),
      [58, 115, 125, 44, 48, 55, 44, 42, 52, 52],
      normal,
      bold,
    );

    this.pdfTable(
      doc,
      'Công nợ học phí',
      ['Hóa đơn', 'Học viên', 'Chi nhánh', 'Gói học', 'Hạn thu', 'Phải thu', 'Đã thu', 'Còn nợ', 'Trạng thái'],
      debts.rows.map((item: any) => [
        item.invoiceNo,
        `${item.studentCode} · ${item.studentName}`,
        item.branchName,
        item.packageName,
        this.formatDate(item.dueDate),
        this.formatMoney(item.total),
        this.formatMoney(item.paidAmount),
        this.formatMoney(item.remaining),
        item.status === 'OVERDUE' ? 'Quá hạn' : item.status === 'PARTIAL' ? 'Thu một phần' : 'Chưa thu',
      ]),
      [88, 130, 108, 120, 66, 84, 84, 84, 72],
      normal,
      bold,
    );

    this.pdfTable(
      doc,
      'Tài chính theo danh mục',
      ['Loại', 'Danh mục', 'Số giao dịch', 'Số tiền'],
      finance.categories.map((item: any) => [
        item.type === 'INCOME' ? 'Thu' : 'Chi',
        item.category,
        String(item.count),
        this.formatMoney(item.amount),
      ]),
      [90, 330, 120, 170],
      normal,
      bold,
    );

    this.pdfTable(
      doc,
      'Dòng tiền theo ngày',
      ['Ngày', 'Thu', 'Chi', 'Dòng tiền ròng'],
      finance.daily.map((item: any) => [
        this.formatDate(`${item.date}T00:00:00`),
        this.formatMoney(item.income),
        this.formatMoney(item.expense),
        this.formatMoney(item.income - item.expense),
      ]),
      [160, 180, 180, 190],
      normal,
      bold,
    );

    this.pdfTable(
      doc,
      'Sản phẩm bán chạy',
      ['SKU', 'Sản phẩm', 'Số lượng bán', 'Doanh số'],
      finance.products.map((item: any) => [
        item.sku,
        item.name,
        String(item.quantity),
        this.formatMoney(item.revenue),
      ]),
      [120, 330, 120, 170],
      normal,
      bold,
    );

    this.pdfTable(
      doc,
      'Học viên cần theo dõi',
      ['Mã HV', 'Học viên', 'Chi nhánh', 'Cấp đai', 'SĐT', 'Nghỉ liên tiếp', 'Mức cảnh báo'],
      risks.map((item: any) => [
        item.code,
        item.fullName,
        item.branchName,
        item.beltLevel ?? '—',
        item.phone ?? '—',
        `${item.consecutiveAbsences} buổi`,
        item.consecutiveAbsences >= 4
          ? 'Cao'
          : item.consecutiveAbsences >= 3
            ? 'Cần liên hệ'
            : 'Theo dõi',
      ]),
      [75, 140, 130, 85, 92, 92, 105],
      normal,
      bold,
    );

    const range = doc.bufferedPageRange();
    for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      doc.font(normal).fontSize(7).fillColor('#758178').text(
        `Karate Dojo Management System · ${this.formatDateTime(new Date())}`,
        36,
        doc.page.height - 28,
        { width: 450 },
      );
      doc.font(normal).fontSize(7).fillColor('#758178').text(
        `Trang ${pageIndex + 1} / ${range.count}`,
        doc.page.width - 130,
        doc.page.height - 28,
        { width: 94, align: 'right' },
      );
    }

    doc.end();

    const buffer = await finished;
    const dateSuffix = `${filter.from ?? new Date().toISOString().slice(0, 10)}_${filter.to ?? new Date().toISOString().slice(0, 10)}`;

    return {
      filename: `bao-cao-karate-${dateSuffix}.pdf`,
      buffer,
    };
  }
}
