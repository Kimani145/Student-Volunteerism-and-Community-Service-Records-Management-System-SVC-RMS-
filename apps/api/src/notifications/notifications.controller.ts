import { Controller, Get, Post, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser, CurrentUserType } from '../auth/current-user.decorator.js';
import { UserRole } from '@svc-rms/shared';
import { Roles } from '../auth/roles.decorator.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  async getNotifications(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.list(user.id);
  }

  @Post(':id/read')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  async markRead(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.notificationsService.markRead(id, user.id);
  }
}
