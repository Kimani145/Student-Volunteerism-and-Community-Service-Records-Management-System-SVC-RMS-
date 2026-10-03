import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { StudentsModule } from './students/students.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { ParticipationsModule } from './participations/participations.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { CertificatesModule } from './certificates/certificates.module.js';
import { RecordsModule } from './records/records.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuditModule } from './audit/audit.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { PublicModule } from './public/public.module.js';
import { StorageModule } from './storage/storage.module.js';
import { CsvModule } from './csv/csv.module.js';
import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { RoutePolicyGuard } from './auth/route-policy.guard.js';
import { ProblemJsonFilter } from './common/problem-json.filter.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditTestModule } from './audit/audit-test.module.js';
import { pinoHttpOptions } from './config/logger.js';

const baseImports = [
  AuthModule,
  UsersModule,
  StudentsModule,
  ActivitiesModule,
  ParticipationsModule,
  AttendanceModule,
  CertificatesModule,
  RecordsModule,
  ReportsModule,
  NotificationsModule,
  AuditModule,
  PartnersModule,
  PrivacyModule,
  PublicModule,
  StorageModule,
  CsvModule,
  DiscoveryModule,
  PrismaModule,
  LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
  ThrottlerModule.forRoot([
    {
      ttl: 60_000,
      limit: 60,
    },
  ]),
];

const baseControllers = [HealthController];

const baseProviders = [
  HealthService,
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
];

@Module({
  imports: baseImports,
  controllers: baseControllers,
  providers: baseProviders,
})
export class AppModule {
  static register(options: { isTest?: boolean } = {}): DynamicModule {
    const isTest = options.isTest ?? process.env.NODE_ENV === 'test';
    return {
      module: AppModule,
      imports: [...baseImports, ...(isTest ? [AuditTestModule] : [])],
      controllers: baseControllers,
      providers: baseProviders,
    };
  }
}
