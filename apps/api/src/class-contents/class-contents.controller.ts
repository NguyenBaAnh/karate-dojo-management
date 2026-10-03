import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ClassContentsService } from './class-contents.service.js';
import { CreateClassContentDto } from './dto/create-class-content.dto.js';
import { UpdateClassContentDto } from './dto/update-class-content.dto.js';

@Controller('class-contents')
export class ClassContentsController {
  constructor(private readonly service: ClassContentsService) {}

  @Get('class/:classId')
  findByClass(@Param('classId') classId: string) { return this.service.findByClass(classId); }

  @Post('class/:classId')
  create(@Param('classId') classId: string, @Body() dto: CreateClassContentDto) { return this.service.create(classId, dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClassContentDto) { return this.service.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
