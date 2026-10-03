import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { ClassSessionsService } from './class-sessions.service.js';
import { CreateClassSessionDto } from './dto/create-class-session.dto.js';
import { SaveAttendanceDto } from './dto/save-attendance.dto.js';

@Controller('class-sessions')
export class ClassSessionsController {
  constructor(
    private readonly classSessionsService: ClassSessionsService,
  ) {}

  @Get()
  findAll(@Query('classId') classId?: string) {
    return this.classSessionsService.findAll(classId);
  }

  @Post()
  create(@Body() dto: CreateClassSessionDto) {
    return this.classSessionsService.create(dto);
  }


  @Post('attendance/rebuild-risk')
  rebuildAttendanceRisk(@Query('branchId') branchId?: string) {
    return this.classSessionsService.rebuildConsecutiveAbsences(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classSessionsService.findOne(id);
  }

  @Get(':id/attendance')
  getAttendance(@Param('id') id: string) {
    return this.classSessionsService.getAttendance(id);
  }

  @Put(':id/attendance')
  saveAttendance(
    @Param('id') id: string,
    @Body() dto: SaveAttendanceDto,
  ) {
    return this.classSessionsService.saveAttendance(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.classSessionsService.cancel(id);
  }
}
