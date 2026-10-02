import { Global, Module } from '@nestjs/common';
import { AuditEventsService } from './audit-events.service.js';

@Global()
@Module({
  providers: [AuditEventsService],
  exports: [AuditEventsService],
})
export class AuditModule {}
