import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main.js';
import { applyTestEnv } from './test-env.js';
import { bearer } from './helpers/auth.js';
import { createUser, createStudent, createActivity } from './helpers/factories.js';
import { ownerPrisma } from './helpers/db.js';
import { UserRole } from '@svc-rms/shared';
import * as crypto from 'node:crypto';

describe('Registrations (e2e)', () => {
  let app: INestApplication;
  let organizerUser: any;
  let approverUser: any;
  let studentUser: any;
  let studentRec: any;
  let studentToken: string;

  beforeAll(async () => {
    applyTestEnv();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    organizerUser = await createUser({ role: UserRole.STAFF });
    approverUser = await createUser({ role: UserRole.STAFF, canApprove: true });

    studentUser = await createUser({ role: UserRole.STUDENT });
    studentRec = await createStudent(studentUser, { year_of_study: 2 });
    studentToken = await bearer({ id: studentUser.id, role: UserRole.STUDENT });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('REQ-REG-01', () => {
    it('allows student registration and enforces deadline and duplicate rules', async () => {
      const http = app.getHttpServer();

      // Create open published activity
      const act = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        capacity: 10,
        start_at: new Date(Date.now() + 3600000 * 24),
        end_at: new Date(Date.now() + 3600000 * 28),
        registration_closes_at: new Date(Date.now() + 3600000 * 20),
      });

      // 1. Success registration
      const res = await request(http)
        .post(`/api/v1/activities/${act.id}/registrations`)
        .set('Authorization', studentToken)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('REGISTERED');

      // 2. Duplicate registration -> 409 ALREADY_REGISTERED
      const dupRes = await request(http)
        .post(`/api/v1/activities/${act.id}/registrations`)
        .set('Authorization', studentToken)
        .expect(409);
      expect(dupRes.body.code).toBe('ALREADY_REGISTERED');

      // 3. Activity with closed registration -> 409 REGISTRATION_CLOSED
      const closedAct = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        capacity: 10,
        start_at: new Date(Date.now() + 3600000 * 24),
        end_at: new Date(Date.now() + 3600000 * 28),
        registration_closes_at: new Date(Date.now() - 3600000), // in the past
      });

      const closedRes = await request(http)
        .post(`/api/v1/activities/${closedAct.id}/registrations`)
        .set('Authorization', studentToken)
        .expect(409);
      expect(closedRes.body.code).toBe('REGISTRATION_CLOSED');
    });
  });

  describe('REQ-REG-02', () => {
    it('prevents double-booking when activities have overlapping schedules', async () => {
      const http = app.getHttpServer();

      const stuUser2 = await createUser({ role: UserRole.STUDENT });
      await createStudent(stuUser2);
      const token2 = await bearer({ id: stuUser2.id, role: UserRole.STUDENT });

      const baseTime = Date.now() + 3600000 * 48;
      // Activity A: 10:00 to 14:00
      const actA = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        start_at: new Date(baseTime),
        end_at: new Date(baseTime + 3600000 * 4),
        registration_closes_at: new Date(baseTime - 3600000),
      });

      // Activity B: 12:00 to 16:00 (overlaps A)
      const actB = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        start_at: new Date(baseTime + 3600000 * 2),
        end_at: new Date(baseTime + 3600000 * 6),
        registration_closes_at: new Date(baseTime - 3600000),
      });

      // Register for A
      await request(http)
        .post(`/api/v1/activities/${actA.id}/registrations`)
        .set('Authorization', token2)
        .expect(201);

      // Register for B (overlaps A) -> 409 SCHEDULE_CONFLICT
      const conflictRes = await request(http)
        .post(`/api/v1/activities/${actB.id}/registrations`)
        .set('Authorization', token2)
        .expect(409);
      expect(conflictRes.body.code).toBe('SCHEDULE_CONFLICT');
    });
  });

  describe('REQ-REG-03', () => {
    it('200-parallel capacity race condition: exactly capacity (50) succeed, remaining fail with 409', async () => {
      const http = app.getHttpServer();

      // Create activity with capacity 50
      const act = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        capacity: 50,
        start_at: new Date(Date.now() + 3600000 * 72),
        end_at: new Date(Date.now() + 3600000 * 76),
        registration_closes_at: new Date(Date.now() + 3600000 * 60),
      });

      // Generate 200 synthetic students in bulk
      const count = 200;
      const userRows = [];
      const studentRows = [];
      const tokens: string[] = [];

      for (let i = 0; i < count; i++) {
        const uId = crypto.randomUUID();
        const sId = crypto.randomUUID();
        userRows.push({
          id: uId,
          email: `p200_race_${i}_${Date.now()}@example.test`,
          passwordHash: 'dummy_hash',
          role: UserRole.STUDENT,
          isActive: true,
        });
        studentRows.push({
          id: sId,
          user_id: uId,
          reg_number: `TUK/PAR/${Date.now().toString().slice(-4)}/${i.toString().padStart(4, '0')}`,
          full_name: `Parallel Student ${i}`,
          gender: 'UNDISCLOSED',
          school_id: 1,
          programme: 'Engineering',
          year_of_study: 1,
        });
      }

      await ownerPrisma.user.createMany({ data: userRows });
      await ownerPrisma.student.createMany({ data: studentRows });

      for (const u of userRows) {
        tokens.push(await bearer({ id: u.id, role: UserRole.STUDENT }));
      }

      // Fire 200 concurrent registration requests with unique client IPs
      const results = await Promise.all(
        tokens.map((token, i) =>
          request(http)
            .post(`/api/v1/activities/${act.id}/registrations`)
            .set('Authorization', token)
            .set('X-Forwarded-For', `10.200.${Math.floor(i / 250)}.${(i % 250) + 1}`)
        )
      );

      const successCount = results.filter((r) => r.status === 201).length;
      const conflictCount = results.filter((r) => r.status === 409).length;

      expect(successCount).toBe(50);
      expect(conflictCount).toBe(150);

      // Verify database state: exactly 50 registrations exist
      const dbCount = await ownerPrisma.participations.count({
        where: { activity_id: act.id, status: 'REGISTERED' },
      });
      expect(dbCount).toBe(50);
    }, 45000);
  });

  describe('REQ-REG-04', () => {
    it('allows cancellation before start_at, rejects cancellation after start_at, and reactivates cancelled row on re-register', async () => {
      const http = app.getHttpServer();

      const stuUser3 = await createUser({ role: UserRole.STUDENT });
      const stu3 = await createStudent(stuUser3);
      const token3 = await bearer({ id: stuUser3.id, role: UserRole.STUDENT });

      // 1. Activity in the future: cancellation allowed
      const futureAct = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        start_at: new Date(Date.now() + 3600000 * 24),
        end_at: new Date(Date.now() + 3600000 * 28),
        registration_closes_at: new Date(Date.now() + 3600000 * 20),
      });

      // Register
      const regRes = await request(http)
        .post(`/api/v1/activities/${futureAct.id}/registrations`)
        .set('Authorization', token3)
        .set('X-Forwarded-For', '10.204.1.1')
        .expect(201);
      const initialPartId = regRes.body.id;

      // Cancel registration
      await request(http)
        .delete(`/api/v1/activities/${futureAct.id}/registrations/me`)
        .set('Authorization', token3)
        .set('X-Forwarded-For', '10.204.1.1')
        .expect(200);

      const cancelledPart = await ownerPrisma.participations.findUnique({
        where: { id: initialPartId },
      });
      expect(cancelledPart?.status).toBe('CANCELLED');

      // Re-register: must reactivate existing row (same ID, status REGISTERED)
      const reRegRes = await request(http)
        .post(`/api/v1/activities/${futureAct.id}/registrations`)
        .set('Authorization', token3)
        .set('X-Forwarded-For', '10.204.1.1')
        .expect(201);

      expect(reRegRes.body.id).toBe(initialPartId);
      expect(reRegRes.body.status).toBe('REGISTERED');

      // 2. Cancellation after activity start_at is rejected
      const pastStartAct = await createActivity({
        organizer_id: organizerUser.id,
        status: 'IN_PROGRESS',
        start_at: new Date(Date.now() - 3600000), // started 1 hr ago
        end_at: new Date(Date.now() + 3600000 * 2),
        registration_closes_at: new Date(Date.now() - 3600000 * 2),
      });

      await ownerPrisma.participations.create({
        data: {
          student_id: stu3.id,
          activity_id: pastStartAct.id,
          status: 'REGISTERED',
        },
      });

      await request(http)
        .delete(`/api/v1/activities/${pastStartAct.id}/registrations/me`)
        .set('Authorization', token3)
        .set('X-Forwarded-For', '10.204.1.1')
        .expect(409);
    });
  });

  describe('REQ-REG-05', () => {
    it('double-booking race: concurrent registrations for overlapping activities allow exactly 1', async () => {
      const http = app.getHttpServer();

      const stuUser4 = await createUser({ role: UserRole.STUDENT });
      await createStudent(stuUser4);
      const token4 = await bearer({ id: stuUser4.id, role: UserRole.STUDENT });

      const baseTime = Date.now() + 3600000 * 96;
      // Overlapping activities C and D
      const actC = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        start_at: new Date(baseTime),
        end_at: new Date(baseTime + 3600000 * 3),
        registration_closes_at: new Date(baseTime - 3600000),
      });

      const actD = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        start_at: new Date(baseTime + 3600000),
        end_at: new Date(baseTime + 3600000 * 4),
        registration_closes_at: new Date(baseTime - 3600000),
      });

      // Concurrently fire registrations for C and D
      const [resC, resD] = await Promise.all([
        request(http)
          .post(`/api/v1/activities/${actC.id}/registrations`)
          .set('Authorization', token4)
          .set('X-Forwarded-For', '10.205.1.1'),
        request(http)
          .post(`/api/v1/activities/${actD.id}/registrations`)
          .set('Authorization', token4)
          .set('X-Forwarded-For', '10.205.1.1'),
      ]);

      const statuses = [resC.status, resD.status].sort();
      expect(statuses).toEqual([201, 409]);
    });
  });

  describe('REQ-STU-03', () => {
    it('restricts registration based on eligible years of study', async () => {
      const http = app.getHttpServer();

      // Student in year 2 (studentUser)
      // Activity for year 3 and 4 only
      const restrictedAct = await createActivity({
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
        eligible_years: [3, 4],
        start_at: new Date(Date.now() + 3600000 * 120),
        end_at: new Date(Date.now() + 3600000 * 124),
        registration_closes_at: new Date(Date.now() + 3600000 * 100),
      });

      // Year 2 student -> 403 NOT_ELIGIBLE
      const deniedRes = await request(http)
        .post(`/api/v1/activities/${restrictedAct.id}/registrations`)
        .set('Authorization', studentToken)
        .set('X-Forwarded-For', '10.206.1.1')
        .expect(403);
      expect(deniedRes.body.code).toBe('NOT_ELIGIBLE');

      // Create student in year 3
      const eligibleStudentUser = await createUser({ role: UserRole.STUDENT });
      await createStudent(eligibleStudentUser, { year_of_study: 3 });
      const eligibleToken = await bearer({ id: eligibleStudentUser.id, role: UserRole.STUDENT });

      // Year 3 student -> 201 Created
      const allowedRes = await request(http)
        .post(`/api/v1/activities/${restrictedAct.id}/registrations`)
        .set('Authorization', eligibleToken)
        .set('X-Forwarded-For', '10.206.1.2')
        .expect(201);
      expect(allowedRes.body.status).toBe('REGISTERED');
    });
  });

  describe('REQ-STU-04', () => {
    it('shows cumulative verified hours (sum of hours_awarded over ATTENDED)', async () => {
      const u = await createUser({ role: UserRole.STUDENT });
      const stu = await createStudent(u);
      const token = await bearer({ id: u.id, role: UserRole.STUDENT });

      const act1 = await createActivity({ organizer_id: organizerUser.id, status: 'COMPLETED' });
      const act2 = await createActivity({ organizer_id: organizerUser.id, status: 'COMPLETED' });
      const act3 = await createActivity({ organizer_id: organizerUser.id, status: 'COMPLETED' });

      // Attended, awarded 8.0 hours
      await ownerPrisma.participations.create({
        data: {
          activity_id: act1.id,
          student_id: stu.id,
          status: 'ATTENDED',
          hours_awarded: 8.0,
        }
      });

      // Attended, awarded 4.5 hours
      await ownerPrisma.participations.create({
        data: {
          activity_id: act2.id,
          student_id: stu.id,
          status: 'ATTENDED',
          hours_awarded: 4.5,
        }
      });

      // Registered but not attended (should be ignored)
      await ownerPrisma.participations.create({
        data: {
          activity_id: act3.id,
          student_id: stu.id,
          status: 'REGISTERED',
          hours_awarded: 10.0,
        }
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/me')
        .set('Authorization', token)
        .expect(200);

      expect(res.body.cumulativeHours).toBe(12.5); // 8.0 + 4.5
    });
  });
});
