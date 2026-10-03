import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
  }

  private cookie(response: Response, token: string, maxAge: number) {
    response.cookie('karate_session', token, {
      ...this.cookieOptions(),
      maxAge,
    });
  }

  @Get('bootstrap-status')
  bootstrapStatus() { return this.service.bootstrapStatus(); }

  @Post('register')
  async register(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    const result = await this.service.register(body);
    this.cookie(response, result.token, result.maxAge);
    return { user: result.user };
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    const result = await this.service.login(body);
    this.cookie(response, result.token, result.maxAge);
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('karate_session', this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  me(@Req() request: Request & { user?: any }) { return this.service.me(request.user!.id); }

  @Patch('profile')
  updateProfile(@Req() request: Request & { user?: any }, @Body() body: any) {
    return this.service.updateProfile(request.user!.id, body);
  }

  @Post('change-password')
  changePassword(@Req() request: Request & { user?: any }, @Body() body: any) {
    return this.service.changePassword(request.user!.id, body);
  }

  @Post('profile/avatar')
  saveAvatar(@Req() request: Request & { user?: any }, @Body() body: any) {
    return this.service.saveAvatar(request.user!.id, String(body?.dataUrl ?? ''));
  }

  @Delete('profile/avatar')
  deleteAvatar(@Req() request: Request & { user?: any }) {
    return this.service.deleteAvatar(request.user!.id);
  }

  @Get('profile/avatar/:userId')
  async avatar(@Param('userId') userId: string, @Res() response: Response) {
    const file = await this.service.avatarFile(userId);
    response.type(file.mime).send(file.buffer);
  }

  @Get('access')
  access() { return this.service.accessOverview(); }

  @Patch('users/:userId/roles')
  userRoles(@Req() request: Request & { user?: any }, @Param('userId') userId: string, @Body() body: any) {
    return this.service.setUserRoles(userId, Array.isArray(body?.roleIds) ? body.roleIds : [], request.user?.roles ?? []);
  }

  @Patch('roles/:roleId/permissions')
  rolePermissions(@Param('roleId') roleId: string, @Body() body: any) {
    return this.service.setRolePermissions(roleId, Array.isArray(body?.permissionCodes) ? body.permissionCodes : []);
  }

  @Patch('users/:userId/status')
  userStatus(@Req() request: Request & { user?: any }, @Param('userId') userId: string, @Body() body: any) {
    return this.service.setUserStatus(userId, body?.status, request.user?.roles ?? []);
  }

  @Post('users/:userId/password')
  setPassword(@Req() request: Request & { user?: any }, @Param('userId') userId: string, @Body() body: any) {
    return this.service.adminSetPassword(userId, String(body?.newPassword ?? ''), request.user?.roles ?? []);
  }
}
