import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuditContext, AuditContextStorage } from './audit-context.storage.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(AuditContextStorage) private readonly auditContextStorage: AuditContextStorage) {
    super();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async withAuditContext<T>(
    ctx: AuditContext,
    callback: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.auditContextStorage.run(ctx, async () => {
      return this.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT
          set_config('app.user_id', ${ctx.userId}, true),
          set_config('app.client_ip', ${ctx.clientIp}, true),
          set_config('app.request_id', ${ctx.requestId}, true)`;
        return callback(tx);
      });
    });
  }
}
