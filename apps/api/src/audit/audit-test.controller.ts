import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { strictObject } from '@svc-rms/shared';
import { z } from 'zod';

const bodySchema = strictObject({
  userId: z.string().uuid(),
  email: z.string().email(),
});

@Controller('/_test')
export class AuditTestController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('/audit-attribution')
  @Public()
  async attribution(@Body() body: unknown): Promise<{ ok: true }> {
    const parsed = bodySchema.parse(body);

    await this.prisma.withAuditContext(
      { userId: parsed.userId, clientIp: '127.0.0.1', requestId: randomUUID() },
      async (tx) => {
        await tx.$executeRaw`
          INSERT INTO users (id, email, password_hash, role)
          VALUES (${parsed.userId}::uuid, ${parsed.email}, 'seeded_password_hash', 'STAFF'::user_role)
          ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
        `;
      },
    );

    const rows = await this.prisma.$queryRaw<Array<{ actor_user_id: string | null }>>`
      SELECT actor_user_id
      FROM audit_log
      WHERE table_name = 'users'
      ORDER BY id DESC
      LIMIT 1
    `;

    if (!rows[0]?.actor_user_id) {
      throw new InternalServerErrorException({ detail: 'Missing audit attribution' });
    }

    return { ok: true };
  }
}
