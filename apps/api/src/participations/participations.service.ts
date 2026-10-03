import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ErrorCode } from '@svc-rms/shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ParticipationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registerStudent(activityId: string, studentId: string) {
    if (!UUID_REGEX.test(activityId)) {
      throw new UnprocessableEntityException({ code: ErrorCode.VALIDATION_ERROR, detail: 'Malformed UUID parameter' });
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // Find student profile
      const student = await tx.student.findFirst({
        where: { OR: [{ id: studentId }, { user_id: studentId }] },
      });
      if (!student) {
        throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Student not found' });
      }
      const actualStudentId = student.id;

      // 1. Double-booking lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actualStudentId}))`;

      // 2. Lock the activity to check capacity
      const actRes = await tx.$queryRaw<any[]>`
        SELECT id, status, capacity, start_at, end_at, registration_closes_at, eligible_years 
        FROM activities 
        WHERE id = ${activityId}::uuid 
        FOR UPDATE
      `;
      if (actRes.length === 0) {
        throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Activity not found' });
      }
      const act = actRes[0];

      if (act.status !== 'PUBLISHED') {
        throw new ConflictException({ code: ErrorCode.INVALID_STATE_TRANSITION, detail: 'Activity is not open for registration' });
      }
      if (new Date(act.registration_closes_at) < new Date()) {
        throw new ConflictException({ code: ErrorCode.REGISTRATION_CLOSED, detail: 'Registration closed' });
      }

      // Check eligible years (REQ-STU-03)
      if (act.eligible_years && Array.isArray(act.eligible_years) && act.eligible_years.length > 0) {
        if (!act.eligible_years.includes(student.year_of_study)) {
          throw new ForbiddenException({ code: ErrorCode.NOT_ELIGIBLE, detail: 'Not eligible for this activity' });
        }
      }

      // Check existing registration
      const existing = await tx.participations.findUnique({
        where: {
          student_id_activity_id: { student_id: actualStudentId, activity_id: activityId },
        },
      });
      if (existing) {
        if (existing.status === 'REGISTERED' || existing.status === 'ATTENDED') {
          throw new ConflictException({ code: ErrorCode.ALREADY_REGISTERED, detail: 'Already registered' });
        }
      }

      // 3. Check capacity
      const countRes = await tx.$queryRaw<any[]>`
        SELECT COUNT(*) as cnt 
        FROM participations 
        WHERE activity_id = ${activityId}::uuid 
        AND status IN ('REGISTERED', 'ATTENDED')
      `;
      const registered = Number(countRes[0].cnt);
      if (registered >= act.capacity) {
        throw new ConflictException({ code: ErrorCode.CAPACITY_FULL, detail: 'Capacity reached' });
      }

      // 4. Check overlap (double-booking)
      const overlapRes = await tx.$queryRaw<any[]>`
        SELECT p.id 
        FROM participations p
        JOIN activities a ON p.activity_id = a.id
        WHERE p.student_id = ${actualStudentId}::uuid 
        AND p.activity_id != ${activityId}::uuid
        AND p.status IN ('REGISTERED', 'ATTENDED')
        AND (
          (a.start_at < ${act.end_at} AND a.end_at > ${act.start_at})
        )
        LIMIT 1
      `;
      if (overlapRes.length > 0) {
        throw new ConflictException({ code: ErrorCode.SCHEDULE_CONFLICT, detail: 'Time overlap with existing registration' });
      }

      // 5. Register: if existing is CANCELLED, reactivate row (REG-04)
      if (existing && existing.status === 'CANCELLED') {
        return await tx.participations.update({
          where: { id: existing.id },
          data: {
            status: 'REGISTERED',
            registered_at: new Date(),
            cancelled_at: null,
          },
        });
      }

      return await tx.participations.create({
        data: {
          activity_id: activityId,
          student_id: actualStudentId,
          status: 'REGISTERED',
        },
      });
    });
  }

  async cancelRegistration(activityId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { OR: [{ id: studentId }, { user_id: studentId }] },
    });
    if (!student) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Student not found' });
    }

    const p = await this.prisma.participations.findUnique({
      where: { student_id_activity_id: { student_id: student.id, activity_id: activityId } },
    });
    if (!p) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, detail: 'Registration not found' });
    }
    if (p.status !== 'REGISTERED') {
      throw new ConflictException({ code: ErrorCode.INVALID_STATE_TRANSITION, detail: 'Only REGISTERED can be cancelled' });
    }
    
    const act = await this.prisma.activities.findUnique({ where: { id: activityId } });
    if (!act || act.status === 'COMPLETED' || act.status === 'CANCELLED') {
      throw new ConflictException({ code: ErrorCode.INVALID_STATE_TRANSITION, detail: 'Activity already finished or cancelled' });
    }

    if (new Date() >= act.start_at) {
      throw new ConflictException({ code: ErrorCode.INVALID_STATE_TRANSITION, detail: 'Cancellation only allowed before activity start time' });
    }

    await this.prisma.participations.update({
      where: { id: p.id },
      data: {
        status: 'CANCELLED',
        cancelled_at: new Date(),
      },
    });
  }

  async getStudentHistory(studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { OR: [{ id: studentId }, { user_id: studentId }] },
    });
    const actualStudentId = student ? student.id : studentId;

    return await this.prisma.participations.findMany({
      where: { student_id: actualStudentId },
      include: { activities: true, certificates: true },
      orderBy: { activities: { start_at: 'desc' } },
    });
  }

  async getStudentSummary(studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { OR: [{ id: studentId }, { user_id: studentId }] },
    });
    const actualStudentId = student ? student.id : studentId;

    const parts = await this.prisma.participations.findMany({
      where: { student_id: actualStudentId, status: 'ATTENDED' },
    });
    const totalHours = parts.reduce((sum, p) => sum + Number(p.hours_awarded || 0), 0);
    return { totalHours };
  }
}

