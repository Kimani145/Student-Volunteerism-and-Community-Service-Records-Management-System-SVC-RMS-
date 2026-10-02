import { Injectable, ConflictException, ForbiddenException, UnprocessableEntityException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateToken, verifyToken } from './token.util.js';
import { BulkAttendanceDto } from './dto/attendance.dto.js';

@Injectable()
export class AttendanceService {
  private masterSecret: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    const secret = process.env.QR_MASTER_SECRET;
    if (!secret) {
      throw new Error('QR_MASTER_SECRET is required');
    }
    this.masterSecret = secret;
  }

  async getCheckInToken(activityId: string, user: { id: string, role: string }) {
    const activity = await this.prisma.activities.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new ConflictException('Activity not found');
    }

    if (activity.status !== 'IN_PROGRESS') {
      throw new ConflictException('Activity is not in progress');
    }

    if (user.role === 'STAFF' && activity.organizer_id !== user.id) {
      throw new ForbiddenException('Only the organizer can generate a check-in token');
    }

    return generateToken(this.masterSecret, activityId, Date.now());
  }

  async selfCheckIn(activityId: string, token: string, studentUserId: string, lat?: number, lng?: number) {
    const student = await this.prisma.student.findUnique({
      where: { user_id: studentUserId }
    });
    if (!student) {
      throw new ForbiddenException('Student profile not found');
    }

    const verify = verifyToken(this.masterSecret, activityId, token, Date.now());
    if (!verify.isValid) {
      await this.prisma.auditLog.create({
        data: {
          source: 'APP',
          eventType: 'ATTENDANCE_CHECKIN_FAILED',
          tableName: 'participations',
          recordId: activityId,
          newData: { reason: 'TOKEN_INVALID', token },
        }
      });
      throw new UnprocessableEntityException('TOKEN_INVALID');
    }

    const activity = await this.prisma.activities.findUnique({
      where: { id: activityId }
    });
    if (!activity) {
      throw new ConflictException('Activity not found');
    }
    
    const now = new Date();
    const endPlus30 = new Date(activity.end_at.getTime() + 30 * 60000);
    
    if (now < activity.start_at || now > endPlus30) {
      await this.prisma.auditLog.create({
        data: {
          source: 'APP',
          eventType: 'ATTENDANCE_CHECKIN_FAILED',
          tableName: 'participations',
          recordId: activityId,
          newData: { reason: 'OUTSIDE_WINDOW' },
        }
      });
      throw new UnprocessableEntityException('Outside of check-in window');
    }

    const participation = await this.prisma.participations.findUnique({
      where: {
        student_id_activity_id: {
          student_id: student.id,
          activity_id: activityId
        }
      }
    });

    if (!participation || participation.status !== 'REGISTERED') {
      if (participation?.status === 'ATTENDED') {
        // Return 200 idempotently
        return { message: 'Already checked in' };
      }
      throw new ForbiddenException('Must be registered to check in');
    }

    let locationFlag = false;
    if (activity.venue_lat && activity.venue_lng && lat && lng && activity.geofence_radius_m) {
      const distance = this.calculateDistance(Number(activity.venue_lat), Number(activity.venue_lng), lat, lng);
      if (distance > activity.geofence_radius_m) {
        locationFlag = true;
      }
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.participations.update({
        where: { id: participation.id },
        data: {
          status: 'ATTENDED',
          hours_awarded: activity.service_hours,
        }
      });

      await tx.attendances.create({
        data: {
          participation_id: participation.id,
          method: 'QR_SELF',
          recorded_by: studentUserId, // self
          lat: lat,
          lng: lng,
          location_flag: locationFlag,
        }
      });
    });

    return { message: 'Checked in successfully', location_flag: locationFlag };
  }

  async bulkUpdateAttendance(activityId: string, data: BulkAttendanceDto, staffUserId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      for (const item of data.participations) {
        if (item.status === 'ATTENDED' && item.hours_awarded !== undefined) {
          const activity = await tx.activities.findUnique({ where: { id: activityId } });
          if (item.hours_awarded !== Number(activity?.service_hours)) {
            if (!item.reason) {
              throw new UnprocessableEntityException('Hours override requires a reason');
            }
          }
        }
        
        const issuedCert = await tx.certificates.findFirst({
          where: {
            participation_id: item.id,
            status: 'ISSUED'
          }
        });

        if (issuedCert) {
          throw new ConflictException('CERTIFICATE_LOCKED');
        }

        const participation = await tx.participations.findUnique({ where: { id: item.id } });
        if (!participation) continue;
        if (participation.activity_id !== activityId) throw new ConflictException('Mismatched activity');

        let hours = participation.hours_awarded;
        if (item.status === 'ATTENDED') {
           hours = item.hours_awarded !== undefined ? item.hours_awarded : (await tx.activities.findUnique({ where: { id: activityId } }))?.service_hours ?? 0;
        } else {
           hours = 0 as any;
        }

        await tx.participations.update({
          where: { id: item.id },
          data: {
            status: item.status,
            hours_awarded: hours,
            hours_override_reason: item.reason || null
          }
        });

        await tx.attendances.upsert({
          where: { participation_id: item.id },
          create: {
            participation_id: item.id,
            method: 'MANUAL_STAFF',
            recorded_by: staffUserId,
            remarks: item.remarks || null,
          },
          update: {
            method: 'MANUAL_STAFF',
            recorded_by: staffUserId,
            remarks: item.remarks || null,
          }
        });
      }
      return { message: 'Attendance updated' };
    });
  }

  async markRemainingAsAbsent(activityId: string) {
    // When an activity becomes COMPLETED, remaining REGISTERED participations become ABSENT with 0 hours.
    return this.prisma.$transaction(async (tx: any) => {
      const participations = await tx.participations.findMany({
        where: {
          activity_id: activityId,
          status: 'REGISTERED'
        }
      });

      for (const p of participations) {
        await tx.participations.update({
          where: { id: p.id },
          data: {
            status: 'ABSENT',
            hours_awarded: 0
          }
        });
        
        // Is an attendance row needed for auto-absent? 
        // ATT-04 says "participations shall become ABSENT with 0 hours."
        // We might not need an attendance row since they didn't check in, 
        // but it could be cleaner to just leave attendances row absent or let the status reflect it.
      }
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }
}
