import { Body, Controller, Get, Inject, InternalServerErrorException, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditContextStorage } from '../prisma/audit-context.storage.js';
import { randomUUID } from 'node:crypto';
import { UserRole, strictObject } from '@svc-rms/shared';
import { z } from 'zod';

const bodySchema = strictObject({
  userId: z.string().uuid(),
  email: z.string().email(),
});

@Controller('/_test')
export class AuditTestController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditContextStorage) private readonly auditContextStorage: AuditContextStorage,
  ) {}

  @Get('/protected')
  @Roles(UserRole.ADMIN)
  protectedEndpoint(): { ok: true } {
    return { ok: true };
  }

  @Post('/audit-attribution')
  @Public()
  async attribution(@Body() body: unknown): Promise<{ studentId: string; ok: true }> {
    const parsed = bodySchema.parse(body);
    const requestId = randomUUID();

    return this.auditContextStorage.run(
      { userId: parsed.userId, clientIp: '127.0.0.1', requestId },
      async () => {
        let school = await this.prisma.school.findFirst();
        if (!school) {
          school = await this.prisma.school.create({ data: { name: 'Audit Test School' } });
        }

        const studentUser = await this.prisma.user.create({
          data: {
            email: parsed.email,
            passwordHash: 'seeded_password_hash',
            role: UserRole.STUDENT,
          },
        });

        const regNumber = `REG-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const student = await this.prisma.student.create({
          data: {
            user_id: studentUser.id,
            reg_number: regNumber,
            full_name: 'Attributed Student',
            school_id: school.id,
            programme: 'BSc Computer Science',
            year_of_study: 1,
          },
        });

        const rows = await this.prisma.$queryRaw<Array<{ actor_user_id: string | null }>>`
          SELECT actor_user_id
          FROM audit_log
          WHERE table_name = 'students' AND record_id = ${student.id}
          ORDER BY id DESC
          LIMIT 1
        `;

        if (!rows[0]?.actor_user_id || rows[0].actor_user_id !== parsed.userId) {
          throw new InternalServerErrorException({ detail: 'Missing or mismatched audit attribution' });
        }

        return { studentId: student.id, ok: true };
      },
    );
  }
}
