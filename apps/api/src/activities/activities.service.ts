import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { checkTransition } from './state-machine.js';
import { AuditEventsService } from '../audit/audit-events.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@svc-rms/shared';

@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventsService) private readonly audit: AuditEventsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(AttendanceService) private readonly attendanceService: AttendanceService,
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

    const startAt = data.startAt ? new Date(data.startAt) : activity.start_at;
    const endAt = data.endAt ? new Date(data.endAt) : activity.end_at;
    const registrationClosesAt = data.registrationClosesAt ? new Date(data.registrationClosesAt) : activity.registration_closes_at;

    if (endAt <= startAt) {
      throw new UnprocessableEntityException({ code: ErrorCode.VALIDATION_ERROR, detail: 'End time must be after start time' });
    }
    if (registrationClosesAt > startAt) {
      throw new UnprocessableEntityException({ code: ErrorCode.VALIDATION_ERROR, detail: 'Registration must close before start time' });
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
        throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, detail: 'Approver cannot be the organizer' });
      }
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      if (!actor?.canApprove) {
        throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, detail: 'Actor must be an approver' });
      }
    }

    await this.prisma.$transaction(async (tx: any) => {
      if (nextStatus === 'PUBLISHED') {
        await tx.activities.update({
          where: { id },
          data: { status: 'PUBLISHED', approved_by: actorId, approved_at: new Date() }
        });
      } else {
        await tx.activities.update({
          where: { id },
          data: { status: nextStatus as any }
        });
      }

      if (nextStatus === 'COMPLETED') {
        await this.attendanceService.markRemainingAsAbsent(id, tx);
      }
    });

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
    } else if (query?.status) {
      where.status = query.status;
    }

    if (query?.typeId) {
      where.type_id = Number(query.typeId);
    } else if (query?.type) {
      where.activity_types = { name: query.type };
    }

    if (query?.startDate || query?.from) {
      where.start_at = { ...(where.start_at || {}), gte: new Date(query.startDate || query.from) };
    }
    if (query?.endDate || query?.to) {
      where.end_at = { ...(where.end_at || {}), lte: new Date(query.endDate || query.to) };
    }

    if (query?.q || query?.search) {
      const search = query.q || query.search;
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { venue: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, parseInt(query?.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query?.limit || query?.take || '20', 10)));
    const skip = query?.skip !== undefined ? parseInt(query.skip, 10) : (page - 1) * limit;
    const take = limit;

    const [items, total] = await Promise.all([
      this.prisma.activities.findMany({
        where,
        skip,
        take,
        orderBy: { start_at: 'asc' },
        include: { activity_types: true, community_partners: true },
      }),
      this.prisma.activities.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getActivity(id: string, isStudent: boolean) {
    const activity = await this.prisma.activities.findUnique({
      where: { id },
      include: { activity_types: true, community_partners: true },
    });
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

