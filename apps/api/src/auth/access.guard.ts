import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

function cookieValue(header: string | undefined, key: string) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === key) return decodeURIComponent(value.join('='));
  }
  return null;
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  private isPublic(path: string, method: string) {
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
    return path === '/auth/login'
      || path === '/auth/register'
      || path === '/auth/bootstrap-status'
      || path === '/settings/public'
      || (path === '/settings/logo' && read)
      || path.startsWith('/payment-webhooks');
  }

  private requiredPermission(path: string, method: string): string | null {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
    if (path.startsWith('/auth/access') || path.startsWith('/auth/users') || path.startsWith('/auth/roles') || path.startsWith('/auth/permissions')) return 'ACCESS_MANAGE';
    // Mọi tài khoản đã đăng nhập đều được xem thông tin võ đường và thiết lập an toàn.
    // Chỉ người có SETTINGS_MANAGE mới được sửa cấu hình hệ thống / logo.
    if (path.startsWith('/settings')) return write ? 'SETTINGS_MANAGE' : null;
    if (path.startsWith('/dashboard')) return 'DASHBOARD_VIEW';
    if (path.startsWith('/students') || path.startsWith('/student-avatars')) return write ? 'STUDENTS_MANAGE' : 'STUDENTS_VIEW';
    if (path.startsWith('/class-sessions')) return write ? 'ATTENDANCE_MANAGE' : 'ATTENDANCE_VIEW';
    if (path.startsWith('/classes') || path.startsWith('/enrollments') || path.startsWith('/class-contents')) return write ? 'CLASSES_MANAGE' : 'CLASSES_VIEW';
    if (path.startsWith('/learning-packages')) return write ? 'TUITION_MANAGE' : 'TUITION_VIEW';
    if (path.startsWith('/finance-sales')) return write ? 'FINANCE_MANAGE' : 'FINANCE_VIEW';
    if (path.startsWith('/reports/export')) return 'REPORTS_EXPORT';
    if (path.startsWith('/reports')) return 'REPORTS_VIEW';
    if (path.startsWith('/staff/payroll') || path.startsWith('/staff/timesheets')) return write ? 'PAYROLL_MANAGE' : 'PAYROLL_VIEW';
    if (path.startsWith('/staff')) return write ? 'STAFF_MANAGE' : 'STAFF_VIEW';
    if (path.startsWith('/branch-admin')) return 'BRANCHES_MANAGE';
    if (path.startsWith('/branches')) return write ? 'BRANCHES_MANAGE' : 'BRANCHES_VIEW';
    if (path.startsWith('/zalo-automation')) return 'NOTIFICATIONS_MANAGE';
    if (path.startsWith('/database')) return 'SETTINGS_MANAGE';
    return null;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<any>();
    const rawPath = String(request.path ?? request.url ?? '').split('?')[0];
    const path = rawPath.startsWith('/api/') ? rawPath.slice(4) : rawPath;
    if (this.isPublic(path, request.method)) return true;

    const bearer = String(request.headers?.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
    const token = cookieValue(request.headers?.cookie, 'karate_session') || bearer;
    if (!token) throw new UnauthorizedException('Vui lòng đăng nhập');

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: process.env.AUTH_JWT_SECRET || 'karate-local-dev-secret-change-me',
      });
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: String(payload.sub ?? '') },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Tài khoản không hoạt động');

    const roles = user.roles.map((item) => item.role.code);
    const permissions = Array.from(new Set(user.roles.flatMap((item) => item.role.permissions.map((p) => p.permission.code))));
    request.user = { id: user.id, username: user.username, fullName: user.fullName, roles, permissions };

    if (roles.includes('OWNER')) return true;

    const read = ['GET', 'HEAD', 'OPTIONS'].includes(String(request.method).toUpperCase());

    if (path.startsWith('/settings/integrations')) {
      const required = read ? 'INTEGRATIONS_VIEW' : 'INTEGRATIONS_MANAGE';
      const legacySettingsAdmin = permissions.includes('SETTINGS_MANAGE');
      if (!permissions.includes(required) && !legacySettingsAdmin) {
        throw new ForbiddenException(`Bạn không có quyền ${required}`);
      }
      return true;
    }

    const teacherReadOnly = roles.includes('TEACHER') && !roles.includes('MANAGER');

    // Role TEACHER luôn chỉ đọc trong module Nhân sự & giáo viên.
    // Cho phép đọc cả chấm công/lương, nhưng controller/service sẽ ép dữ liệu
    // về đúng giáo viên đang đăng nhập. Mọi thao tác ghi đều bị chặn tại đây.
    if (teacherReadOnly && path.startsWith('/staff')) {
      if (read) return true;
      throw new ForbiddenException('Giáo viên chỉ có quyền xem Nhân sự & giáo viên');
    }

    const required = this.requiredPermission(path, request.method);
    if (required && !permissions.includes(required)) {
      throw new ForbiddenException(`Bạn không có quyền ${required}`);
    }
    return true;
  }
}
