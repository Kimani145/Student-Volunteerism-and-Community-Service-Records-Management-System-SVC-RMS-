import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesService } from './activities.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';

@Module({
  imports: [NotificationsModule, AttendanceModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}

