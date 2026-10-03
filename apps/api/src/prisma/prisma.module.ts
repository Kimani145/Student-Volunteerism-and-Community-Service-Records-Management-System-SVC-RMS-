import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { AuditContextStorage } from './audit-context.storage.js';

@Global()
@Module({
  providers: [PrismaService, AuditContextStorage],
  exports: [PrismaService, AuditContextStorage],
})
export class PrismaModule {}
