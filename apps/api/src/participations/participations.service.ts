import { Injectable, ConflictException, UnprocessableEntityException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ParticipationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registerStudent(activityId: string, studentId: string) {
    return await this.prisma.$transaction(async (tx: any) => {
      // 1. Double-booking lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;

      // 2. Lock the activity to check capacity
      const actRes = await tx.$queryRaw<any[]>`SELECT status, capacity, start_at, end_at, registration_closes_at FROM activities WHERE id = ${activityId}::uuid FOR UPDATE`;
      if (actRes.length === 0) throw new NotFoundException('Activity not found');
      const act = actRes[0];

      if (act.status !== 'PUBLISHED') throw new ConflictException('Activity is not open for registration');
      if (new Date(act.registration_closes_at) < new Date()) throw new ConflictException('Registration closed');

      // 3. Check capacity
      const countRes = await tx.$queryRaw<any[]>`
        SELECT COUNT(*) as cnt 
        FROM participations 
        WHERE activity_id = ${activityId}::uuid 
        AND status IN ('REGISTERED', 'ATTENDED')
      `;
      const registered = Number(countRes[0].cnt);
      if (registered >= act.capacity) {
        throw new ConflictException('Capacity reached');
      }

      // 4. Check overlap
      const overlapRes = await tx.$queryRaw<any[]>`
        SELECT p.id 
        FROM participations p
        JOIN activities a ON p.activity_id = a.id
        WHERE p.student_id = ${studentId}::uuid 
        AND p.status IN ('REGISTERED', 'ATTENDED')
        AND (
          (a.start_at < ${act.end_at} AND a.end_at > ${act.start_at})
        )
        LIMIT 1
      `;
      if (overlapRes.length > 0) {
        throw new ConflictException('Time overlap with existing registration');
      }

      // 5. Register
      return await tx.participations.create({
        data: {
          activity_id: activityId,
          student_id: studentId,
          status: 'REGISTERED',
        }
      });
    });
  }

  async cancelRegistration(activityId: string, studentId: string) {
    const p = await this.prisma.participations.findUnique({
      where: { student_id_activity_id: { student_id: studentId, activity_id: activityId } }
    });
    if (!p) throw new NotFoundException();
    if (p.status !== 'REGISTERED') throw new ConflictException('Only REGISTERED can be cancelled');
    
    const act = await this.prisma.activities.findUnique({ where: { id: activityId } });
    if (!act || act.status === 'COMPLETED' || act.status === 'CANCELLED') {
      throw new ConflictException('Activity already finished');
    }

    await this.prisma.participations.update({
      where: { id: p.id },
      data: { status: 'CANCELLED' }
    });
  }

  async getStudentHistory(studentId: string) {
    return await this.prisma.participations.findMany({
      where: { student_id: studentId },
      include: { activities: true, certificates: true },
      orderBy: { activities: { start_at: 'desc' } }
    });
  }

  async getStudentSummary(studentId: string) {
    const parts = await this.prisma.participations.findMany({
      where: { student_id: studentId, status: 'ATTENDED' },
    });
    const totalHours = parts.reduce((sum, p) => sum + Number(p.hours_awarded || 0), 0);
    return { totalHours };
  }
}
