import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
  } from '@nestjs/common';
  
  import { ClassesService } from './classes.service.js';
  import { CreateClassDto } from './dto/create-class.dto.js';
  import { UpdateClassDto } from './dto/update-class.dto.js';
  
  @Controller('classes')
  export class ClassesController {
    constructor(
      private readonly classesService: ClassesService,
    ) {}
  
    @Get()
    findAll() {
      return this.classesService.findAll();
    }
  
    @Get(':id')
    findOne(
      @Param('id') id: string,
    ) {
      return this.classesService.findOne(id);
    }
  
    @Post()
    create(
      @Body() dto: CreateClassDto,
    ) {
      return this.classesService.create(dto);
    }
  
    @Patch(':id')
    update(
      @Param('id') id: string,
      @Body() dto: UpdateClassDto,
    ) {
      return this.classesService.update(id, dto);
    }
  
    @Delete(':id')
    remove(
      @Param('id') id: string,
    ) {
      return this.classesService.remove(id);
    }
  }