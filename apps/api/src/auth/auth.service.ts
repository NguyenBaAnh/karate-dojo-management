import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { PERMISSIONS, ROLE_DEFAULTS, ROLE_META } from './auth.constants.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
  ) {}

  async ensureAccessCatalog() {
    for (const [code, name] of PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code }, create: { code, name }, update: { name },
      });
    }
    for (const role of ROLE_META) {
      const saved = await this.prisma.role.upsert({
        where: { code: role.code }, create: role, update: { name: role.name, description: role.description },
      });
      const count = await this.prisma.rolePermission.count({ where: { roleId: saved.id } });
      if (count === 0) {
        const permissions = await this.prisma.permission.findMany({
          where: { code: { in: ROLE_DEFAULTS[role.code] ?? [] } }, select: { id: true },
        });
        if (permissions.length) {
          await this.prisma.rolePermission.createMany({
            data: permissions.map((item) => ({ roleId: saved.id, permissionId: item.id })),
            skipDuplicates: true,
          });
        }
      }
    }
  }

  async bootstrapStatus() {
    await this.ensureAccessCatalog();
    const activatedUsers = await this.prisma.user.count({ where: { passwordHash: { not: 'ACCOUNT_NOT_ACTIVATED' } } });
    const settings = await this.settings.get();
    return {
      needsSetup: activatedUsers === 0,
      registrationOpen: activatedUsers === 0 || settings.security.allowPublicRegistration,
    };
  }

  private async userView(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const roles = user.roles.map((item) => ({ id: item.role.id, code: item.role.code, name: item.role.name }));
    const permissions = Array.from(new Set(user.roles.flatMap((item) => item.role.permissions.map((p) => p.permission.code))));
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles,
      permissions,
    };
  }

  private async issue(userId: string, rememberMe = false) {
    const token = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: process.env.AUTH_JWT_SECRET || 'karate-local-dev-secret-change-me',
        expiresIn: rememberMe ? 604_800 : 28_800,
      },
    );
    return { token, maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000 };
  }

  async register(body: any) {
    await this.ensureAccessCatalog();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const fullName = String(body?.fullName ?? '').trim();
    const email = String(body?.email ?? '').trim() || null;
    const password = String(body?.password ?? '');
    if (!username || !/^[a-z0-9._-]{3,40}$/.test(username)) throw new BadRequestException('Tên đăng nhập từ 3 ký tự, chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang');
    if (!fullName) throw new BadRequestException('Vui lòng nhập họ và tên');
    if (password.length < 8) throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');

    const activatedUsers = await this.prisma.user.count({ where: { passwordHash: { not: 'ACCOUNT_NOT_ACTIVATED' } } });
    const settings = await this.settings.get();
    if (activatedUsers > 0 && !settings.security.allowPublicRegistration) {
      throw new BadRequestException('Đăng ký công khai đang tắt. Hãy liên hệ quản trị viên.');
    }

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.passwordHash !== 'ACCOUNT_NOT_ACTIVATED') throw new BadRequestException('Tên đăng nhập đã tồn tại');
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail && byEmail.id !== existing?.id) throw new BadRequestException('Email đã được sử dụng');
    }

    const roleCode = activatedUsers === 0 ? 'OWNER' : 'GUEST';
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new BadRequestException('Chưa khởi tạo vai trò hệ thống');
    const passwordHash = await bcrypt.hash(password, 12);

    let userId: string;
    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: { fullName, email, passwordHash, status: 'ACTIVE' },
        });
        // Tự đăng ký luôn nhận đúng role mặc định của luồng đăng ký.
        // Không giữ lại role nhân sự đã gán trước đó để tránh tự kích hoạt
        // một tài khoản rồi vô tình có quyền cao hơn GUEST.
        await tx.userRole.deleteMany({ where: { userId: existing.id } });
        await tx.userRole.create({ data: { userId: existing.id, roleId: role.id } });
      });
      userId = existing.id;
    } else {
      const created = await this.prisma.user.create({
        data: {
          username, fullName, email, passwordHash, status: 'ACTIVE',
          roles: { create: [{ roleId: role.id }] },
        },
      });
      userId = created.id;
    }
    return { user: await this.userView(userId), ...(await this.issue(userId, Boolean(body?.rememberMe))) };
  }

  async login(body: any) {
    const username = String(body?.username ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.passwordHash === 'ACCOUNT_NOT_ACTIVATED') throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Tài khoản đang bị khóa hoặc ngừng hoạt động');
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    return { user: await this.userView(user.id), ...(await this.issue(user.id, Boolean(body?.rememberMe))) };
  }

  me(userId: string) { return this.userView(userId); }

  async updateProfile(userId: string, body: any) {
    const fullName = String(body?.fullName ?? '').trim();
    const phone = String(body?.phone ?? '').trim() || null;
    const email = String(body?.email ?? '').trim() || null;
    if (!fullName) throw new BadRequestException('Họ tên không được để trống');
    if (email) {
      const duplicate = await this.prisma.user.findFirst({ where: { email, id: { not: userId } } });
      if (duplicate) throw new BadRequestException('Email đã được sử dụng');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { fullName, phone, email } });
    return this.userView(userId);
  }

  async changePassword(userId: string, body: any) {
    const currentPassword = String(body?.currentPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');
    if (newPassword.length < 8) throw new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
    return { success: true };
  }

  async accessOverview() {
    await this.ensureAccessCatalog();
    const [users, roles, permissions] = await Promise.all([
      this.prisma.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { fullName: 'asc' } }),
      this.prisma.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: { name: 'asc' } }),
      this.prisma.permission.findMany({ orderBy: { code: 'asc' } }),
    ]);
    return {
      users: users.map((u) => ({ id: u.id, username: u.username, fullName: u.fullName, email: u.email, status: u.status, avatarUrl: u.avatarUrl, activated: u.passwordHash !== 'ACCOUNT_NOT_ACTIVATED', roles: u.roles.map((r) => ({ id: r.role.id, code: r.role.code, name: r.role.name })) })),
      roles: roles.map((r) => ({ id: r.id, code: r.code, name: r.name, description: r.description, userCount: r._count.users, permissions: r.permissions.map((p) => p.permission.code) })),
      permissions,
    };
  }

  async setUserRoles(userId: string, roleIds: string[], actorRoles: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const unique = Array.from(new Set(roleIds.filter(Boolean)));
    const ownerRole = await this.prisma.role.findUnique({ where: { code: 'OWNER' } });
    const hadOwner = user.roles.some((item) => item.role.code === 'OWNER');
    const wantsOwner = Boolean(ownerRole && unique.includes(ownerRole.id));
    if ((hadOwner !== wantsOwner) && !actorRoles.includes('OWNER')) {
      throw new ForbiddenException('Chỉ Chủ võ đường mới được cấp hoặc gỡ vai trò Chủ võ đường');
    }
    if (hadOwner && !wantsOwner && ownerRole) {
      const ownerCount = await this.prisma.userRole.count({ where: { roleId: ownerRole.id, user: { status: 'ACTIVE' } } });
      if (ownerCount <= 1) throw new BadRequestException('Hệ thống phải luôn còn ít nhất một Chủ võ đường đang hoạt động');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      if (unique.length) await tx.userRole.createMany({ data: unique.map((roleId) => ({ userId, roleId })), skipDuplicates: true });
    });
    return this.userView(userId);
  }

  async setRolePermissions(roleId: string, permissionCodes: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (role.code === 'OWNER') throw new BadRequestException('Vai trò Chủ võ đường luôn có toàn quyền');
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: Array.from(new Set(permissionCodes)) } } });
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId, permissionId: p.id })), skipDuplicates: true });
    });
    return this.accessOverview();
  }

  async setUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'LOCKED', actorRoles: string[]) {
    if (!['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status)) throw new BadRequestException('Trạng thái tài khoản không hợp lệ');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const isOwner = user.roles.some((item) => item.role.code === 'OWNER');
    if (isOwner && !actorRoles.includes('OWNER')) throw new ForbiddenException('Chỉ Chủ võ đường mới được thay đổi trạng thái tài khoản Chủ võ đường');
    if (isOwner && status !== 'ACTIVE') {
      const ownerRole = await this.prisma.role.findUnique({ where: { code: 'OWNER' } });
      if (ownerRole) {
        const activeOwners = await this.prisma.userRole.count({ where: { roleId: ownerRole.id, user: { status: 'ACTIVE' } } });
        if (activeOwners <= 1) throw new BadRequestException('Không thể khóa/ngừng Chủ võ đường đang hoạt động cuối cùng');
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    return this.userView(userId);
  }

  async adminSetPassword(userId: string, newPassword: string, actorRoles: string[]) {
    if (newPassword.length < 8) throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    const target = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.roles.some((item) => item.role.code === 'OWNER') && !actorRoles.includes('OWNER')) {
      throw new ForbiddenException('Chỉ Chủ võ đường mới được đặt lại mật khẩu cho Chủ võ đường');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12), status: 'ACTIVE' } });
    return { success: true };
  }

  private avatarDir() { return path.resolve(process.cwd(), 'uploads', 'user-avatars'); }

  async saveAvatar(userId: string, dataUrl: string) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(dataUrl || '');
    if (!match) throw new BadRequestException('Avatar phải là JPG, PNG hoặc WEBP');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 4 * 1024 * 1024) throw new BadRequestException('Avatar không được vượt quá 4 MB');
    const mime = match[1].toLowerCase();
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const dir = this.avatarDir();
    await mkdir(dir, { recursive: true });
    for (const oldExt of ['jpg', 'png', 'webp']) await unlink(path.join(dir, `${userId}.${oldExt}`)).catch(() => undefined);
    await writeFile(path.join(dir, `${userId}.${ext}`), buffer);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: `/api/auth/profile/avatar/${userId}` } });
    return this.userView(userId);
  }

  async deleteAvatar(userId: string) {
    const dir = this.avatarDir();
    for (const ext of ['jpg', 'png', 'webp']) await unlink(path.join(dir, `${userId}.${ext}`)).catch(() => undefined);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    return this.userView(userId);
  }

  async avatarFile(userId: string) {
    const dir = this.avatarDir();
    for (const item of [{ ext: 'jpg', mime: 'image/jpeg' }, { ext: 'png', mime: 'image/png' }, { ext: 'webp', mime: 'image/webp' }]) {
      try { return { buffer: await readFile(path.join(dir, `${userId}.${item.ext}`)), mime: item.mime }; } catch {}
    }
    throw new NotFoundException('Chưa có avatar');
  }
}
