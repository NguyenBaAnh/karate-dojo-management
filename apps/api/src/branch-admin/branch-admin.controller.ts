import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { BranchAdminService } from './branch-admin.service.js';
import { CreateBranchAdminDto } from './dto/create-branch-admin.dto.js';
import { UpdateBranchAdminDto } from './dto/update-branch-admin.dto.js';

@Controller('branch-admin')
export class BranchAdminController {
  constructor(
    private readonly service: BranchAdminService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(
    @Body() dto: CreateBranchAdminDto,
  ) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchAdminDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
  ) {
    return this.service.remove(id);
  }
}
