import { Body, Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SaveStudentAvatarDto } from './dto/save-student-avatar.dto.js';
import { StudentAvatarsService } from './student-avatars.service.js';

@Controller('student-avatars')
export class StudentAvatarsController {
  constructor(private readonly service: StudentAvatarsService) {}

  @Post(':studentId')
  save(@Param('studentId') studentId: string, @Body() dto: SaveStudentAvatarDto) {
    return this.service.save(studentId, dto.dataUrl);
  }

  @Get(':studentId')
  async get(@Param('studentId') studentId: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.get(studentId);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'no-store');
    return result.stream;
  }

  @Delete(':studentId')
  remove(@Param('studentId') studentId: string) {
    return this.service.remove(studentId);
  }
}
