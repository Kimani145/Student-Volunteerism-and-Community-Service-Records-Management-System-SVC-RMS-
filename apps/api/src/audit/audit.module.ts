import { Global, Module } from '@nestjs/common';
import { AuditEventsService } from './audit-events.service.js';
import { AuditController } from './audit.controller.js';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditEventsService],
  exports: [AuditEventsService],
})
export class AuditModule {}
