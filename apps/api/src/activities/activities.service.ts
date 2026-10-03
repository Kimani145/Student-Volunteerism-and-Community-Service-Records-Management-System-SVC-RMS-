import { Injectable, ConflictException, UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { checkTransition } from './state-machine.js';
import { AuditEventsService } from '../audit/audit-events.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@svc-rms/shared';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditEventsService,
    private readonly notifications: NotificationsService
  ) {}

  async createActivity(data: any, organizerId: string) {
    if (new Date(data.endAt) <= new Date(data.startAt)) {
      throw new UnprocessableEntityException({ code: ErrorCode.VALIDATION_ERROR, detail: 'End time must be after start time' });
    }
    if (new Date(data.registrationClosesAt) > new Date(data.startAt)) {
      throw new UnprocessableEntityException({ code: ErrorCode.VALIDATION_ERROR, detail: 'Registration must close before start time' });
    }
    
    const createData: Prisma.activitiesUncheckedCreateInput = {
      title: data.title,
      type_id: data.typeId,
      description: data.description,
      venue: data.venue,
      start_at: new Date(data.startAt),
      end_at: new Date(data.endAt),
      registration_closes_at: new Date(data.registrationClosesAt),
      capacity: data.capacity,
      service_hours: data.serviceHours,
      organizer_id: organizerId,
    };

    if (data.eligibleYears) createData.eligible_years = data.eligibleYears;
    if (data.partnerId) createData.partner_id = data.partnerId;
    if (data.venueLat !== undefined) createData.venue_lat = data.venueLat;
    if (data.venueLng !== undefined) createData.venue_lng = data.venueLng;
    if (data.geofenceRadiusM !== undefined) createData.geofence_radius_m = data.geofenceRadiusM;

    return await this.prisma.activities.create({
      data: createData
    });
  }

  async updateActivity(id: string, data: any) {
    const activity = await this.prisma.activities.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Not found' });

    if (activity.status === 'COMPLETED' || activity.status === 'CANCELLED') {
      throw new ConflictException({ code: ErrorCode.INVALID_STATE_TRANSITION, detail: 'Cannot edit terminal state' });
    }
    
    const updateData: Prisma.activitiesUncheckedUpdateInput = {};

    if (activity.status === 'IN_PROGRESS') {
      if (data.description) updateData.description = data.description;
      return await this.prisma.activities.update({
        where: { id },
        data: updateData
      });
    }

    if (activity.status === 'PUBLISHED') {
      if (data.capacity && data.capacity < activity.capacity) {
        const registered = await this.prisma.participations.count({
          where: { activity_id: id, status: { in: ['REGISTERED', 'ATTENDED'] } }
        });
        if (data.capacity < registered) {
          throw new ConflictException({ code: ErrorCode.INVALID_STATE_TRANSITION, detail: 'Capacity cannot be less than registered count' });
        }
      }
      
      if (data.description) updateData.description = data.description;
      if (data.venue) updateData.venue = data.venue;
      if (data.startAt) updateData.start_at = new Date(data.startAt);
      if (data.endAt) updateData.end_at = new Date(data.endAt);
      if (data.capacity) updateData.capacity = data.capacity;
      if (data.venueLat !== undefined) updateData.venue_lat = data.venueLat;
      if (data.venueLng !== undefined) updateData.venue_lng = data.venueLng;
      if (data.geofenceRadiusM !== undefined) updateData.geofence_radius_m = data.geofenceRadiusM;

      return await this.prisma.activities.update({
        where: { id },
        data: updateData
      });
    }

    if (data.title) updateData.title = data.title;
    if (data.typeId) updateData.type_id = data.typeId;
    if (data.description) updateData.description = data.description;
    if (data.venue) updateData.venue = data.venue;
    if (data.startAt) updateData.start_at = new Date(data.startAt);
    if (data.endAt) updateData.end_at = new Date(data.endAt);
    if (data.registrationClosesAt) updateData.registration_closes_at = new Date(data.registrationClosesAt);
    if (data.capacity) updateData.capacity = data.capacity;
    if (data.serviceHours) updateData.service_hours = data.serviceHours;
    if (data.partnerId) updateData.partner_id = data.partnerId;
    if (data.eligibleYears) updateData.eligible_years = data.eligibleYears;
    if (data.venueLat !== undefined) updateData.venue_lat = data.venueLat;
    if (data.venueLng !== undefined) updateData.venue_lng = data.venueLng;
    if (data.geofenceRadiusM !== undefined) updateData.geofence_radius_m = data.geofenceRadiusM;

    return await this.prisma.activities.update({
      where: { id },
      data: updateData
    });
  }

  async transitionActivity(id: string, nextStatus: string, actorId: string) {
    const activity = await this.prisma.activities.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Not found' });

    checkTransition(activity.status, nextStatus);

    if (nextStatus === 'PUBLISHED') {
      if (activity.organizer_id === actorId) {
        throw new ConflictException({ code: ErrorCode.FORBIDDEN, detail: 'Approver cannot be the organizer' });
      }
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      if (!actor?.canApprove) {
        throw new ConflictException({ code: ErrorCode.FORBIDDEN, detail: 'Actor must be an approver' });
      }
      await this.prisma.activities.update({
        where: { id },
        data: { status: 'PUBLISHED', approved_by: actorId, approved_at: new Date() }
      });
    } else {
      await this.prisma.activities.update({
        where: { id },
        data: { status: nextStatus as any }
      });
    }

    if (nextStatus === 'CANCELLED') {
      const parts = await this.prisma.participations.findMany({
        where: { activity_id: id, status: 'REGISTERED' },
        include: { students: { include: { users: true } } }
      });
      for (const p of parts) {
        await this.notifications.notify(p.students.users.id, 'Activity Cancelled', `Activity ${activity.title} has been cancelled.`);
      }
    }
  }

  async getActivities(query: any, isStudent: boolean) {
    const where: any = {};
    if (isStudent) {
      where.status = { in: ['PUBLISHED', 'IN_PROGRESS'] };
    } else if (query.status) {
      where.status = query.status;
    }
    const [items, total] = await Promise.all([
      this.prisma.activities.findMany({ where, skip: 0, take: 20 }),
      this.prisma.activities.count({ where })
    ]);
    return { items, total };
  }

  async getActivity(id: string, isStudent: boolean) {
    const activity = await this.prisma.activities.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Not found' });

    if (isStudent && !['PUBLISHED', 'IN_PROGRESS'].includes(activity.status)) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Not found' });
    }
    return activity;
  }

  async getRoster(id: string) {
    return await this.prisma.participations.findMany({
      where: { activity_id: id, status: { not: 'CANCELLED' } },
      include: { students: true, attendances: true }
    });
  }
}
