import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main.js';
import { applyTestEnv } from './test-env.js';
import { bearer } from './helpers/auth.js';
import { createUser, createStudent, createActivity } from './helpers/factories.js';
import { ownerPrisma } from './helpers/db.js';
import { UserRole } from '@svc-rms/shared';
import * as crypto from 'node:crypto';

describe('Attendance (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let organizerId: string;
  let organizerToken: string;
  let studentUserId: string;
  let studentId: string;
  let studentToken: string;
  let activityId: string;

  beforeAll(async () => {
    applyTestEnv();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Create Admin
    const adminUser = await createUser({ role: UserRole.ADMIN });
    adminToken = await bearer({ id: adminUser.id, role: UserRole.ADMIN });

    // Create Staff (Not Organizer)
    const staffUser = await createUser({ role: UserRole.STAFF });
    staffToken = await bearer({ id: staffUser.id, role: UserRole.STAFF });

    // Create Organizer
    const orgUser = await createUser({ role: UserRole.STAFF });
    organizerId = orgUser.id;
    organizerToken = await bearer({ id: orgUser.id, role: UserRole.STAFF });

    // Create Student
    const studentUser = await createUser({ role: UserRole.STUDENT });
    studentUserId = studentUser.id;
    studentToken = await bearer({ id: studentUser.id, role: UserRole.STUDENT });
    const student = await createStudent(studentUser);
    studentId = student.id;

    // Create Activity
    const activity = await createActivity({ organizer_id: organizerId, status: 'IN_PROGRESS' });
    activityId = activity.id;

    // Create Participation
    await ownerPrisma.participations.create({
      data: {
        student_id: studentId,
        activity_id: activityId,
        status: 'REGISTERED'
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('REQ-ATT-01', () => {
    it('Organizer/ADMIN gets a rolling check-in token for IN_PROGRESS activity', async () => {
      const http = app.getHttpServer();
      
      // Admin should be allowed
      const adminRes = await request(http)
        .get(`/api/v1/activities/${activityId}/check-in-token`)
        .set('Authorization', adminToken)
        .expect(200);
      expect(adminRes.body.token).toBeDefined();

      // Organizer should be allowed
      const orgRes = await request(http)
        .get(`/api/v1/activities/${activityId}/check-in-token`)
        .set('Authorization', organizerToken)
        .expect(200);
      expect(orgRes.body.token).toBeDefined();

      // Non-organizer staff should be denied (403)
      await request(http)
        .get(`/api/v1/activities/${activityId}/check-in-token`)
        .set('Authorization', staffToken)
        .expect(403);
    });

    it('Returns 409 if activity is not IN_PROGRESS', async () => {
      const http = app.getHttpServer();
      const draftActivity = await createActivity({ organizer_id: organizerId, status: 'DRAFT' });
      
      await request(http)
        .get(`/api/v1/activities/${draftActivity.id}/check-in-token`)
        .set('Authorization', organizerToken)
        .expect(409);
    });
  });

  describe('REQ-ATT-02', () => {
    it('Student self check-in by submitting token', async () => {
      const http = app.getHttpServer();
      
      // Get valid token
      const tokenRes = await request(http)
        .get(`/api/v1/activities/${activityId}/check-in-token`)
        .set('Authorization', organizerToken)
        .expect(200);
      
      const token = tokenRes.body.token;

      // Student checks in
      const res = await request(http)
        .post(`/api/v1/activities/${activityId}/check-in`)
        .set('Authorization', studentToken)
        .send({ token })
        .expect(201);
      
      expect(res.body.message).toBe('Checked in successfully');

      // Check DB
      const participation = await ownerPrisma.participations.findUnique({
        where: { student_id_activity_id: { student_id: studentId, activity_id: activityId } },
        include: { attendances: true }
      });

      expect(participation?.status).toBe('ATTENDED');
      expect(participation?.attendances).not.toBeNull();
      expect(participation?.attendances?.method).toBe('QR_SELF');

      // Idempotent (Replay -> 200)
      const replayRes = await request(http)
        .post(`/api/v1/activities/${activityId}/check-in`)
        .set('Authorization', studentToken)
        .send({ token })
        .expect(201); // Created or Ok based on NestJS POST, 201 is default
      
      expect(replayRes.body.message).toBe('Already checked in');
    });
  });

  describe('REQ-ATT-03', () => {
    it('STAFF record attendance in bulk', async () => {
      const http = app.getHttpServer();

      // Create new activity & student to test STAFF override
      const act = await createActivity({ organizer_id: organizerId, status: 'COMPLETED' });
      const stuUser = await createUser({ role: UserRole.STUDENT });
      const stu = await createStudent(stuUser);
      const part = await ownerPrisma.participations.create({
        data: { student_id: stu.id, activity_id: act.id, status: 'REGISTERED' }
      });

      // Override with missing reason should fail (422) if hours < service_hours
      await request(http)
        .put(`/api/v1/activities/${act.id}/attendance`)
        .set('Authorization', staffToken)
        .send({
          participations: [
            { id: part.id, status: 'ATTENDED', hours_awarded: 2 }
          ]
        })
        .expect(422); // Need reason

      // Valid override
      await request(http)
        .put(`/api/v1/activities/${act.id}/attendance`)
        .set('Authorization', staffToken)
        .send({
          participations: [
            { id: part.id, status: 'ATTENDED', hours_awarded: 2, reason: 'Left early' }
          ]
        })
        .expect(200);

      // Issued certificate blocks edit (409)
      await ownerPrisma.certificates.create({
        data: {
          participation_id: part.id,
          cvid: 'TUK-VOL-2026-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
          payload: {},
          signature: Buffer.from('sig'),
          key_id: 'key1',
          status: 'ISSUED',
          issued_by: adminToken.length > 0 ? (await ownerPrisma.user.findFirst({ where: { role: 'ADMIN' } }))!.id : stuUser.id
        }
      });

      await request(http)
        .put(`/api/v1/activities/${act.id}/attendance`)
        .set('Authorization', staffToken)
        .send({
          participations: [
            { id: part.id, status: 'ABSENT' }
          ]
        })
        .expect(409);
    });
  });

  describe('REQ-ATT-04', () => {
    it('marks remaining REGISTERED participations as ABSENT with 0 hours on COMPLETED transition', async () => {
      const http = app.getHttpServer();

      // Create an activity in IN_PROGRESS state
      const act = await createActivity({ organizer_id: organizerId, status: 'IN_PROGRESS' });
      const stuUser = await createUser({ role: UserRole.STUDENT });
      const stu = await createStudent(stuUser);
      const part = await ownerPrisma.participations.create({
        data: { student_id: stu.id, activity_id: act.id, status: 'REGISTERED' },
      });

      // Complete the activity
      await request(http)
        .post(`/api/v1/activities/${act.id}/complete`)
        .set('Authorization', organizerToken)
        .expect(201);

      // Verify participation became ABSENT with 0 hours awarded
      const updatedPart = await ownerPrisma.participations.findUnique({
        where: { id: part.id },
      });
      expect(updatedPart?.status).toBe('ABSENT');
      expect(Number(updatedPart?.hours_awarded)).toBe(0);
    });
  });

  describe('REQ-ATT-06', () => {
    it('validates bounds, returns 404 for unknown records, and does not leak raw tokens in audit log', async () => {
      const http = app.getHttpServer();
      const randomUuid = crypto.randomUUID();

      // 1. Unknown activity returns 404
      await request(http)
        .get(`/api/v1/activities/${randomUuid}/check-in-token`)
        .set('Authorization', organizerToken)
        .expect(404);

      await request(http)
        .post(`/api/v1/activities/${randomUuid}/check-in`)
        .set('Authorization', studentToken)
        .send({ token: '1234567890' })
        .expect(404);

      // 2. Unknown participation returns 404 in bulk update
      const act = await createActivity({ organizer_id: organizerId, status: 'IN_PROGRESS' });
      await request(http)
        .put(`/api/v1/activities/${act.id}/attendance`)
        .set('Authorization', staffToken)
        .send({
          participations: [
            { id: randomUuid, status: 'ATTENDED', hours_awarded: 2, reason: 'Good work' }
          ]
        })
        .expect(404);

      // 3. Hours out of bounds (< 0 or > service_hours) returns 422
      const stuUser = await createUser({ role: UserRole.STUDENT });
      const stu = await createStudent(stuUser);
      const part = await ownerPrisma.participations.create({
        data: { student_id: stu.id, activity_id: act.id, status: 'REGISTERED' },
      });

      await request(http)
        .put(`/api/v1/activities/${act.id}/attendance`)
        .set('Authorization', staffToken)
        .send({
          participations: [
            { id: part.id, status: 'ATTENDED', hours_awarded: 999 }
          ]
        })
        .expect(422);

      // 4. Failed check-in creates audit log with NO raw token (privacy check)
      const secretRawToken = 'SUPER_SECRET_RAW_TOKEN_999';
      await request(http)
        .post(`/api/v1/activities/${act.id}/check-in`)
        .set('Authorization', studentToken)
        .send({ token: secretRawToken })
        .expect(422);

      const logs = await ownerPrisma.auditLog.findMany({
        where: {
          recordId: act.id,
          eventType: 'ATTENDANCE_CHECKIN_FAILED',
        },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      });

      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];
      const logData = latestLog.newData as Record<string, any>;
      expect(logData.reason).toBe('TOKEN_INVALID');
      expect(logData.token).toBeUndefined();
    });
  });
});

