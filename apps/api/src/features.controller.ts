import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { FeaturesService } from './features.service.js';

@Controller()
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get('dashboard')
  dashboard() {
    return this.features.dashboard();
  }

  @Get('students')
  students() {
    return this.features.listStudents();
  }

  @Get('classes')
  classes() {
    return this.features.listClasses();
  }

  @Get('attendance/today')
  attendance() {
    return this.features.todayAttendance();
  }

  @Patch('attendance/:studentId')
  checkAttendance(
    @Param('studentId') studentId: string,
    @Body() body: { status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' },
  ) {
    return this.features.checkAttendance(studentId, body.status);
  }

  @Get('tuition')
  tuition() {
    return this.features.tuition();
  }

  @Get('finance')
  finance() {
    return this.features.finance();
  }

  @Get('reports')
  reports() {
    return this.features.reports();
  }
}
