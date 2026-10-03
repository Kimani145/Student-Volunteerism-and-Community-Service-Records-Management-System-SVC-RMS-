import { Controller, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ParticipationsService } from './participations.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserRole } from '@svc-rms/shared';

@Controller('activities/:id/registrations')
export class ParticipationsController {
  constructor(private readonly svc: ParticipationsService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  async register(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.registerStudent(id, user.studentId);
  }

  @Delete('me')
  @Roles(UserRole.STUDENT)
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.cancelRegistration(id, user.studentId);
  }

  @Post('manual')
  @Roles(UserRole.STAFF)
  async manualRegister(@Param('id') id: string, @CurrentUser() user: any) {
    // implementation stub
  }
}
