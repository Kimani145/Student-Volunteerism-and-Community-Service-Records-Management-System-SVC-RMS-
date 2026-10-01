import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { RoutePolicyGuard } from './auth/route-policy.guard.js';
import { ProblemJsonFilter } from './common/problem-json.filter.js';
import { PrismaService } from './prisma/prisma.service.js';
import { AuditContextStorage } from './prisma/audit-context.storage.js';
import { AuditTestController } from './audit/audit-test.controller.js';
import { pinoHttpOptions } from './config/logger.js';

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
  ],
  controllers: [HealthController, AuditTestController],
  providers: [
    HealthService,
    PrismaService,
    AuditContextStorage,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoutePolicyGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ProblemJsonFilter,
    },
  ],
})
export class AppModule {}
