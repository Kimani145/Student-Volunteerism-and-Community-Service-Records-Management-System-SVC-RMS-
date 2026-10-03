import { Module } from '@nestjs/common';
import { AuditTestController } from './audit-test.controller.js';

@Module({
  controllers: [AuditTestController],
})
export class AuditTestModule {}
