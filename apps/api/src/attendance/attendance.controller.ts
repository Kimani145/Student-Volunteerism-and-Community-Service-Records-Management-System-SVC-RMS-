import { Controller, Get, Post, Put, Param, Body, Req, Inject } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { CheckInDto, BulkAttendanceDto } from './dto/attendance.dto.js';
import { UserRole } from '@svc-rms/shared';
import { Roles } from '../auth/roles.decorator.js';

@Controller('activities')
export class AttendanceController {
  constructor(@Inject(AttendanceService) private readonly attendanceService: AttendanceService) {}

  @Get(':id/check-in-token')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getCheckInToken(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: string } }
  ) {
    return this.attendanceService.getCheckInToken(id, req.user);
  }

  @Post(':id/check-in')
  @Roles(UserRole.STUDENT)
  async selfCheckIn(
    @Param('id') id: string,
    @Body() body: CheckInDto,
    @Req() req: { user: { id: string; role: string } }
  ) {
    return this.attendanceService.selfCheckIn(id, body?.token, req.user?.id, body?.lat, body?.lng);
  }

  @Put(':id/attendance')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async bulkUpdateAttendance(
    @Param('id') id: string,
    @Body() body: BulkAttendanceDto,
    @Req() req: { user: { id: string; role: string } }
  ) {
    return this.attendanceService.bulkUpdateAttendance(id, body || { participations: [] }, req.user?.id);
  }
}
