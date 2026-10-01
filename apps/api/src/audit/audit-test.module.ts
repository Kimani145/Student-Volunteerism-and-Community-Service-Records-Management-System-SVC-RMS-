import { Module } from '@nestjs/common';
import { AuditTestController } from './audit-test.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditContextStorage } from '../prisma/audit-context.storage.js';

@Module({
  controllers: [AuditTestController],
  providers: [PrismaService, AuditContextStorage],
})
export class AuditTestModule {}
