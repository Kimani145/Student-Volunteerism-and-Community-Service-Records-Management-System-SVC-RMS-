import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditContextStorage } from '../prisma/audit-context.storage.js';

@Injectable()
export class AuditEventsService {
  private readonly logger = new Logger(AuditEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContextStorage: AuditContextStorage
  ) {}

  async record(eventType: string, details?: any): Promise<void> {
    const ctx = this.auditContextStorage.get();
    try {
      await this.prisma.auditLog.create({
        data: {
          source: 'APP',
          eventType,
          requestId: ctx?.requestId ?? '',
          // details can be saved in old_values or new_values or we just map it to details
          // wait, schema.prisma has old_values, new_values. Let's just put it in new_values
          new_values: details ? details : undefined,
        }
      });
    } catch (err) {
      this.logger.error(`Failed to record audit event ${eventType}: ${err}`);
    }
  }
}
