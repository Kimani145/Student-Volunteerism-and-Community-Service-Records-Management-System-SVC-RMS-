import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '@svc-rms/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { AuditEventsService } from './audit-events.service.js';

const auditFilterSchema = z.object({
  actor: z.string().uuid().optional(),
  table: z.string().optional(),
  record_id: z.string().optional(),
  event_type: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

@Controller('audit')
export class AuditController {
  constructor(
    private prisma: PrismaService,
    private auditEvents: AuditEventsService
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async getAuditLogs(@Query(new ZodValidationPipe(auditFilterSchema)) query: any) {
    const { actor, table, record_id, event_type, from, to, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (actor) where.actorUserId = actor;
    if (table) where.tableName = table;
    if (record_id) where.recordId = record_id;
    if (event_type) where.eventType = event_type;
    
    if (from || to) {
      where.occurredAt = {};
      if (from) where.occurredAt.gte = new Date(from);
      if (to) where.occurredAt.lte = new Date(to);
    }

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' }
      })
    ]);

    await this.auditEvents.record('AUDIT_LOG_EXPORTED', { query });

    return { data, total, page, limit };
  }
}
