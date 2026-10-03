import { Controller, Get, Post, Patch, Body, Param, Query, UsePipes } from '@nestjs/common';
import { ActivitiesService } from './activities.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserRole } from '@svc-rms/shared';
import { ZodValidationPipe } from './zod.pipe.js';
import { createActivitySchema, updateActivitySchema } from './dto.js';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly svc: ActivitiesService) {}

  @Post()
  @Roles(UserRole.STAFF)
  @UsePipes(new ZodValidationPipe(createActivitySchema))
  async create(@Body() body: any, @CurrentUser() user: any) {
    return this.svc.createActivity(body, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.STAFF)
  @UsePipes(new ZodValidationPipe(updateActivitySchema))
  async update(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateActivity(id, body);
  }

  @Post(':id/publish')
  @Roles(UserRole.STAFF)
  async publish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.transitionActivity(id, 'PUBLISHED', user.id);
  }

  @Post(':id/start')
  @Roles(UserRole.STAFF)
  async start(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.transitionActivity(id, 'IN_PROGRESS', user.id);
  }

  @Post(':id/complete')
  @Roles(UserRole.STAFF)
  async complete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.transitionActivity(id, 'COMPLETED', user.id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.STAFF)
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.transitionActivity(id, 'CANCELLED', user.id);
  }

  @Get()
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  async getActivities(@CurrentUser() user: any, @Query() q: any) {
    return this.svc.getActivities(q, user.role === 'STUDENT');
  }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  async getActivity(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getActivity(id, user.role === 'STUDENT');
  }

  @Get(':id/roster')
  @Roles(UserRole.STAFF)
  async getRoster(@Param('id') id: string) {
    return this.svc.getRoster(id);
  }
}
