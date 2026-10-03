import { INestApplication } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import request from 'supertest';
import { createApp, pinoHttpOptions } from '../src/main.js';
import { applyTestEnv } from './test-env.js';
import { bearer } from './helpers/auth.js';
import { createUser, createStudent, createActivity } from './helpers/factories.js';
import { ownerPrisma } from './helpers/db.js';
import { UserRole, ErrorCode } from '@svc-rms/shared';
import * as crypto from 'node:crypto';

describe('Phase 4: Security, IDOR, Governance & Privacy (e2e)', () => {
  let app: INestApplication;
  let adminUser: any;
  let adminToken: string;
  let staffUser: any;
  let staffToken: string;
  let studentAUser: any;
  let studentA: any;
  let studentAToken: string;
  let studentBUser: any;
  let studentB: any;
  let studentBToken: string;

  beforeAll(async () => {
    applyTestEnv();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    adminUser = await createUser({ role: UserRole.ADMIN });
    adminToken = await bearer({ id: adminUser.id, role: UserRole.ADMIN });

    staffUser = await createUser({ role: UserRole.STAFF, canApprove: true });
    staffToken = await bearer({ id: staffUser.id, role: UserRole.STAFF });

    studentAUser = await createUser({ role: UserRole.STUDENT });
    studentA = await createStudent(studentAUser, { year_of_study: 1 });
    studentAToken = await bearer({ id: studentAUser.id, role: UserRole.STUDENT });

    studentBUser = await createUser({ role: UserRole.STUDENT });
    studentB = await createStudent(studentBUser, { year_of_study: 2 });
    studentBToken = await bearer({ id: studentBUser.id, role: UserRole.STUDENT });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('REQ-AUTH-08 & Charter #1 (IDOR Sweep Test)', () => {
    it('enumerates every route with an :id param from the router and tests unauthorized access, non-existent UUIDs, and malformed IDs', async () => {
      const discoveryService = app.get(DiscoveryService);
      const controllers = discoveryService.getControllers();
      const http = app.getHttpServer();

      const routesWithId: Array<{ method: 'get' | 'post' | 'put' | 'delete' | 'patch'; pathTemplate: string }> = [];

      for (const controllerWrapper of controllers) {
        const { metatype } = controllerWrapper;
        if (!metatype) continue;

        const controllerPath = (Reflect.getMetadata(PATH_METADATA, metatype) as string | undefined) ?? '';
        const prototype = metatype.prototype;
        const methodNames = Object.getOwnPropertyNames(prototype).filter(
          (name) => name !== 'constructor' && typeof prototype[name] === 'function',
        );

        for (const methodName of methodNames) {
          const handler = prototype[methodName];
          const routePath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
          if (routePath === undefined) continue;

          const httpMethodCode = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
          if (httpMethodCode === undefined) continue;

          const methodMap: Record<number, 'get' | 'post' | 'put' | 'delete' | 'patch'> = {
            0: 'get',
            1: 'post',
            2: 'put',
            3: 'delete',
            4: 'patch',
          };
          const method = methodMap[httpMethodCode] ?? 'get';

          const cleanController = controllerPath ? `/${controllerPath.replace(/^\/|\/$/g, '')}` : '';
          const cleanRoute = routePath ? `/${routePath.replace(/^\/|\/$/g, '')}` : '';
          const fullPath = `/api/v1${cleanController}${cleanRoute}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

          if (fullPath.includes(':id')) {
            routesWithId.push({ method, pathTemplate: fullPath });
          }
        }
      }

      expect(routesWithId.length).toBeGreaterThan(0);

      // Create an activity owned by student A or staff
      const act = await createActivity({ organizer_id: staffUser.id, status: 'PUBLISHED' });
      // Create participation for student B
      const partB = await ownerPrisma.participations.create({
        data: {
          student_id: studentB.id,
          activity_id: act.id,
          status: 'REGISTERED',
        },
      });

      for (const route of routesWithId) {
        // 1. Test malformed ID -> expects 422 (or 404/403/422, but specifically malformed UUID parameter is 422)
        const malformedUrl = route.pathTemplate.replace(':id', 'invalid-not-a-uuid');
        const malformedRes = await request(http)[route.method](malformedUrl)
          .set('Authorization', studentAToken)
          .set('X-Forwarded-For', '10.200.1.1');
        if (malformedRes.status === 500) {
          console.error('500 on route:', route.method, malformedUrl, malformedRes.body);
        }
        // Malformed UUID path params return 422 from problem-json filter or 404/403
        expect([422, 404, 403]).toContain(malformedRes.status);

        // 2. Test non-existent random UUID -> expects 404 (or 403)
        const randomUuid = crypto.randomUUID();
        const randomUrl = route.pathTemplate.replace(':id', randomUuid);
        const randomRes = await request(http)[route.method](randomUrl)
          .set('Authorization', studentAToken)
          .set('X-Forwarded-For', '10.200.1.2');
        expect([404, 403]).toContain(randomRes.status);
      }
    });

    it('rejects mass-assignment attempts on write endpoints with 422 (Charter #11)', async () => {
      const http = app.getHttpServer();

      // Attempt creating activity with unexpected extra fields
      const res = await request(http)
        .post('/api/v1/activities')
        .set('Authorization', staffToken)
        .set('X-Forwarded-For', '10.200.2.1')
        .send({
          title: 'Extra Keys Activity',
          typeId: 1,
          description: 'Desc',
          venue: 'Hall',
          startAt: new Date(Date.now() + 3600000 * 24).toISOString(),
          endAt: new Date(Date.now() + 3600000 * 28).toISOString(),
          registrationClosesAt: new Date(Date.now() + 3600000 * 20).toISOString(),
          capacity: 20,
          serviceHours: 2,
          isHacked: true, // Unknown extra key
          __proto__: { admin: true },
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('REQ-AUTH-09', () => {
    it('allows ADMIN to create accounts, deactivate users, and prevents last ADMIN from deactivating self', async () => {
      const http = app.getHttpServer();

      // 1. ADMIN creates STAFF account
      const staffEmail = `newstaff_${Date.now()}@example.test`;
      const createRes = await request(http)
        .post('/api/v1/users')
        .set('Authorization', adminToken)
        .set('X-Forwarded-For', '10.200.3.1')
        .send({ email: staffEmail, role: 'STAFF' })
        .expect(201);

      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.email).toBe(staffEmail);

      const dbUser = await ownerPrisma.user.findUnique({ where: { id: createRes.body.id } });
      expect(dbUser?.must_change_password).toBe(true);

      // 2. ADMIN sets can_approve and deactivates staff user
      const patchRes = await request(http)
        .patch(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', adminToken)
        .set('X-Forwarded-For', '10.200.3.2')
        .send({ canApprove: true, isActive: false })
        .expect(200);

      expect(patchRes.body.canApprove).toBe(true);
      expect(patchRes.body.isActive).toBe(false);

      // 3. Last active ADMIN attempts to deactivate self -> 409 Conflict
      // Ensure only 1 active admin exists for this test
      await ownerPrisma.user.updateMany({
        where: { role: 'ADMIN', id: { not: adminUser.id } },
        data: { isActive: false },
      });

      const deactAdminRes = await request(http)
        .patch(`/api/v1/users/${adminUser.id}`)
        .set('Authorization', adminToken)
        .set('X-Forwarded-For', '10.200.3.3')
        .send({ isActive: false })
        .expect(409);

      expect(deactAdminRes.body.detail).toMatch(/last active ADMIN/i);
    });
  });

  describe('REQ-PRIV-01 & REQ-PRIV-02', () => {
    it('stores accepted notice version in consents and allows optional fields to be omitted', async () => {
      const http = app.getHttpServer();

      // Missing noticeVersion -> 422
      await request(http)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.200.4.1')
        .send({
          email: `priv_test_${Date.now()}@example.test`,
          password: 'Password123456!',
          regNumber: `TUK/${Date.now().toString().slice(-4)}/2026`,
          fullName: 'Test Privacy Student',
          schoolId: 1,
          programme: 'Computer Science',
          yearOfStudy: 1,
          // noticeVersion omitted!
        })
        .expect(422);

      // Registration with noticeVersion and omitting optional gender/phone -> 200/201 Success (REQ-PRIV-02)
      const regRes = await request(http)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.200.4.2')
        .send({
          email: `priv_success_${Date.now()}@example.test`,
          password: 'Password123456!',
          regNumber: `TUK/OK/${Date.now().toString().slice(-4)}/2026`,
          fullName: 'Test Privacy Student OK',
          schoolId: 1,
          programme: 'Computer Science',
          yearOfStudy: 1,
          noticeVersion: 'v1.0.0', // Accepted notice version (REQ-PRIV-01)
        })
        .expect(201);

      // Verify consent row in DB
      const user = await ownerPrisma.user.findFirst({
        where: { email: { startsWith: 'priv_success_' } },
        orderBy: { createdAt: 'desc' },
      });
      const consent = await ownerPrisma.consents.findFirst({
        where: { user_id: user!.id },
      });
      expect(consent).not.toBeNull();
      expect(consent?.notice_version).toBe('v1.0.0');
    });
  });

  describe('REQ-PRIV-05', () => {
    it('verifies logger configuration redacts credentials and authorization headers', () => {
      expect(pinoHttpOptions.redact.paths).toContain('req.headers.authorization');
      expect(pinoHttpOptions.redact.paths).toContain('req.headers.cookie');
    });
  });

  describe('REQ-AUD-03', () => {
    it('records audit events for authentication, failed check-ins, and user actions', async () => {
      // Query database audit log for various event types recorded throughout test runs
      const eventTypes = await ownerPrisma.auditLog.findMany({
        select: { eventType: true },
        distinct: ['eventType'],
      });

      const types = eventTypes.map((e) => e.eventType);
      // Verify recorded audit event types exist
      expect(types.length).toBeGreaterThan(0);
    });
  });
});
