import { Controller, Get, Param, ConflictException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '@svc-rms/shared';
import { AuditEventsService } from '../audit/audit-events.service.js';

@Controller('students')
export class PrivacyController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(AuditEventsService) private auditEvents: AuditEventsService
  ) {}

  @Get(':id/export')
  @Roles(UserRole.ADMIN)
  async exportStudentData(@Param('id') id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            consents: true,
          }
        },
        schools: true,
        participations: {
          include: {
            activities: true,
            attendances: true,
            certificates: true,
          }
        }
      }
    });

    if (!student) {
      throw new ConflictException('Student not found');
    }

    await this.auditEvents.record('STUDENT_DATA_EXPORTED', { student_id: id });

    return student;
  }
}
