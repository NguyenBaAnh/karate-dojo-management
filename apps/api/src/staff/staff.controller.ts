import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { CreateStaffPersonDto } from './dto/create-staff-person.dto.js';
import { UpdateStaffPersonDto } from './dto/update-staff-person.dto.js';
import { CreateTimesheetDto } from './dto/create-timesheet.dto.js';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  private normalizePersonBody(body: Record<string, unknown>) {
    const readString = (...keys: string[]) => {
      for (const key of keys) {
        const value = body[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      return undefined;
    };

    return {
      ...body,
      username: readString('username', 'staffUsername'),
      fullName: readString('fullName', 'name', 'full_name', 'staffFullName'),
    };
  }


  private readString(body: Record<string, unknown>, ...keys: string[]) {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string') return value.trim();
    }
    return undefined;
  }

  private readNumber(body: Record<string, unknown>, key: string) {
    const value = body[key];
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private normalizeTimesheetBody(body: Record<string, unknown>) {
    return {
      teacherId: this.readString(body, 'teacherId'),
      workDate: this.readString(body, 'workDate'),
      sessionId: this.readString(body, 'sessionId'),
      minutes: this.readNumber(body, 'minutes'),
      sessionCount: this.readNumber(body, 'sessionCount'),
      amount: body.amount === null ? null : this.readNumber(body, 'amount'),
      note: body.note === null ? null : this.readString(body, 'note'),
    };
  }

  private normalizeTaskBody(body: Record<string, unknown>) {
    return {
      title: this.readString(body, 'title', 'taskTitle'),
      description:
        body.description === null ? null : this.readString(body, 'description'),
      ownerId: body.ownerId === null ? null : this.readString(body, 'ownerId'),
      creatorId: this.readString(body, 'creatorId'),
      dueAt: body.dueAt === null ? null : this.readString(body, 'dueAt'),
      priority: this.readNumber(body, 'priority'),
      status: this.readString(body, 'status'),
    };
  }

  @Get('overview')
  overview(@Req() request: any) {
    return this.service.overview(request.user);
  }

  @Get('roles')
  roles() {
    return this.service.roles();
  }

  @Post('roles/bootstrap')
  bootstrapRoles() {
    return this.service.bootstrapRoles();
  }

  @Get('people')
  people(@Req() request: any) {
    return this.service.people(request.user);
  }

  @Post('people')
  createPerson(@Body() body: Record<string, unknown>) {
    const dto = this.normalizePersonBody(body) as CreateStaffPersonDto;
    return this.service.createPerson(dto);
  }

  @Patch('people/:userId')
  updatePerson(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = this.normalizePersonBody(body) as UpdateStaffPersonDto;
    return this.service.updatePerson(userId, dto);
  }


  @Delete('people/:userId')
  deletePerson(@Param('userId') userId: string) {
    return this.service.deletePerson(userId);
  }

  @Post('people/:userId/avatar')
  saveAvatar(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const dataUrl = this.readString(body, 'dataUrl') ?? '';
    return this.service.saveAvatar(userId, dataUrl);
  }

  @Get('people/:userId/avatar')
  async avatar(
    @Param('userId') userId: string,
    @Res() response: any,
  ) {
    const filePath = await this.service.avatarPath(userId);
    return response.sendFile(filePath);
  }

  @Delete('people/:userId/avatar')
  deleteAvatar(@Param('userId') userId: string) {
    return this.service.deleteAvatar(userId);
  }

  @Get('classes')
  classes() {
    return this.service.classes();
  }

  @Patch('classes/:classId/teacher')
  assignTeacher(
    @Param('classId') classId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const rawTeacherId = body.teacherId;
    const teacherId =
      typeof rawTeacherId === 'string' && rawTeacherId.trim()
        ? rawTeacherId.trim()
        : null;

    return this.service.assignClassTeacher(classId, { teacherId });
  }

  @Get('timesheets')
  timesheets(
    @Req() request: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.service.timesheets(from, to, teacherId, request.user);
  }

  @Post('timesheets')
  createTimesheet(@Body() body: Record<string, unknown>) {
    const dto = this.normalizeTimesheetBody(body) as CreateTimesheetDto;
    return this.service.createTimesheet(dto);
  }

  @Patch('timesheets/:id')
  updateTimesheet(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = this.normalizeTimesheetBody(body) as UpdateTimesheetDto;
    return this.service.updateTimesheet(id, dto);
  }

  @Post('timesheets/sync')
  syncTimesheets(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.syncTimesheets(from, to);
  }

  @Get('payroll')
  payroll(
    @Req() request: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.payroll(from, to, request.user);
  }

  @Get('tasks')
  tasks(@Query('status') status?: string) {
    return this.service.tasks(status);
  }

  @Post('tasks')
  createTask(@Body() body: Record<string, unknown>) {
    const dto = this.normalizeTaskBody(body) as CreateTaskDto;
    return this.service.createTask(dto);
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = this.normalizeTaskBody(body) as UpdateTaskDto;
    return this.service.updateTask(id, dto);
  }
}
