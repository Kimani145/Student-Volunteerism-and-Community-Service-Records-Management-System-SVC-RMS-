import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main.js';
import { applyTestEnv } from './test-env.js';
import { bearer } from './helpers/auth.js';
import { createUser, createStudent, createActivity } from './helpers/factories.js';
import { ownerPrisma } from './helpers/db.js';
import { UserRole } from '@svc-rms/shared';

describe('Activities (e2e)', () => {
  let app: INestApplication;
  let organizerUser: any;
  let organizerToken: string;
  let approverUser: any;
  let approverToken: string;
  let regularStaffUser: any;
  let regularStaffToken: string;
  let studentUser: any;
  let studentToken: string;
  let activityTypeId: number;

  beforeAll(async () => {
    applyTestEnv();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Get an activity type from DB
    const actType = await ownerPrisma.activityType.findFirst();
    activityTypeId = actType!.id;

    // 1. Organizer (Staff, canApprove = false)
    organizerUser = await createUser({ role: UserRole.STAFF, canApprove: false });
    organizerToken = await bearer({ id: organizerUser.id, role: UserRole.STAFF });

    // 2. Approver (Staff, canApprove = true)
    approverUser = await createUser({ role: UserRole.STAFF, canApprove: true });
    approverToken = await bearer({ id: approverUser.id, role: UserRole.STAFF });

    // 3. Regular Staff (cannot approve)
    regularStaffUser = await createUser({ role: UserRole.STAFF, canApprove: false });
    regularStaffToken = await bearer({ id: regularStaffUser.id, role: UserRole.STAFF });

    // 4. Student
    studentUser = await createUser({ role: UserRole.STUDENT });
    await createStudent(studentUser);
    studentToken = await bearer({ id: studentUser.id, role: UserRole.STUDENT });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('REQ-ACT-01', () => {
    it('creates activity with valid dates and rejects invalid dates', async () => {
      const http = app.getHttpServer();

      const now = Date.now();
      const validPayload = {
        title: 'Tree Planting Drive',
        typeId: activityTypeId,
        description: 'Planting trees on campus',
        venue: 'Main Campus Quad',
        startAt: new Date(now + 3600000 * 24).toISOString(),
        endAt: new Date(now + 3600000 * 28).toISOString(),
        registrationClosesAt: new Date(now + 3600000 * 20).toISOString(),
        capacity: 50,
        serviceHours: 4,
      };

      // Valid create
      const res = await request(http)
        .post('/api/v1/activities')
        .set('Authorization', organizerToken)
        .send(validPayload)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Tree Planting Drive');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.organizer_id).toBe(organizerUser.id);

      // Invalid: endAt <= startAt (422)
      await request(http)
        .post('/api/v1/activities')
        .set('Authorization', organizerToken)
        .send({
          ...validPayload,
          endAt: validPayload.startAt,
        })
        .expect(422);

      // Invalid: registrationClosesAt > startAt (422)
      await request(http)
        .post('/api/v1/activities')
        .set('Authorization', organizerToken)
        .send({
          ...validPayload,
          registrationClosesAt: new Date(now + 3600000 * 25).toISOString(),
        })
        .expect(422);
    });
  });

  describe('REQ-ACT-02 & REQ-ACT-04', () => {
    it('enforces approver rules on publish and verifies valid transitions', async () => {
      const http = app.getHttpServer();

      // Create draft activity
      const draft = await ownerPrisma.activities.create({
        data: {
          title: 'Campus Cleanup',
          type_id: activityTypeId,
          description: 'Cleaning the grounds',
          venue: 'Hostels',
          start_at: new Date(Date.now() + 3600000 * 24),
          end_at: new Date(Date.now() + 3600000 * 28),
          registration_closes_at: new Date(Date.now() + 3600000 * 20),
          capacity: 30,
          service_hours: 3,
          organizer_id: organizerUser.id,
          status: 'DRAFT',
        },
      });

      // 1. Organizer attempts to publish own activity -> 403 Forbidden
      await request(http)
        .post(`/api/v1/activities/${draft.id}/publish`)
        .set('Authorization', organizerToken)
        .expect(403);

      // 2. Staff without canApprove attempts to publish -> 403 Forbidden
      await request(http)
        .post(`/api/v1/activities/${draft.id}/publish`)
        .set('Authorization', regularStaffToken)
        .expect(403);

      // 3. Valid approver publishes -> 201 Created
      const pubRes = await request(http)
        .post(`/api/v1/activities/${draft.id}/publish`)
        .set('Authorization', approverToken)
        .expect(201);

      const pubInDb = await ownerPrisma.activities.findUnique({ where: { id: draft.id } });
      expect(pubInDb?.status).toBe('PUBLISHED');
      expect(pubInDb?.approved_by).toBe(approverUser.id);
      expect(pubInDb?.approved_at).toBeDefined();

      // 4. Invalid transition: cannot jump directly from PUBLISHED to COMPLETED -> 409
      await request(http)
        .post(`/api/v1/activities/${draft.id}/complete`)
        .set('Authorization', organizerToken)
        .expect(409);

      // 5. Valid transition: PUBLISHED -> IN_PROGRESS
      await request(http)
        .post(`/api/v1/activities/${draft.id}/start`)
        .set('Authorization', organizerToken)
        .expect(201);

      // 6. Valid transition: IN_PROGRESS -> COMPLETED
      await request(http)
        .post(`/api/v1/activities/${draft.id}/complete`)
        .set('Authorization', organizerToken)
        .expect(201);

      const completedInDb = await ownerPrisma.activities.findUnique({ where: { id: draft.id } });
      expect(completedInDb?.status).toBe('COMPLETED');
    });
  });

  describe('REQ-ACT-03', () => {
    it('allows updating fields in DRAFT, restricts fields in PUBLISHED/IN_PROGRESS, and blocks COMPLETED', async () => {
      const http = app.getHttpServer();

      // Create draft
      const draft = await ownerPrisma.activities.create({
        data: {
          title: 'Editable Draft',
          type_id: activityTypeId,
          description: 'Initial description',
          venue: 'Hall A',
          start_at: new Date(Date.now() + 3600000 * 24),
          end_at: new Date(Date.now() + 3600000 * 28),
          registration_closes_at: new Date(Date.now() + 3600000 * 20),
          capacity: 40,
          service_hours: 4,
          organizer_id: organizerUser.id,
          status: 'DRAFT',
        },
      });

      // Update in DRAFT
      await request(http)
        .patch(`/api/v1/activities/${draft.id}`)
        .set('Authorization', organizerToken)
        .send({ title: 'Updated Title Draft', capacity: 45 })
        .expect(200);

      // Move to COMPLETED
      const completed = await createActivity({
        title: 'Finished Event',
        type_id: activityTypeId,
        organizer_id: organizerUser.id,
        status: 'COMPLETED',
      });

      // Editing terminal state -> 409 Conflict
      await request(http)
        .patch(`/api/v1/activities/${completed.id}`)
        .set('Authorization', organizerToken)
        .send({ description: 'Try edit' })
        .expect(409);
    });
  });

  describe('REQ-ACT-05', () => {
    it('notifies registered students when activity is cancelled', async () => {
      const http = app.getHttpServer();

      // Create published activity with registered student
      const act = await createActivity({
        title: 'Activity To Cancel',
        type_id: activityTypeId,
        organizer_id: organizerUser.id,
        status: 'PUBLISHED',
      });

      const studentRec = await ownerPrisma.student.findUnique({ where: { user_id: studentUser.id } });
      await ownerPrisma.participations.create({
        data: {
          student_id: studentRec!.id,
          activity_id: act.id,
          status: 'REGISTERED',
        },
      });

      // Cancel activity
      await request(http)
        .post(`/api/v1/activities/${act.id}/cancel`)
        .set('Authorization', organizerToken)
        .expect(201);

      // Verify notification created for student
      const notifs = await ownerPrisma.notifications.findMany({
        where: { user_id: studentUser.id },
      });
      expect(notifs.some((n) => n.title.includes('Cancelled'))).toBe(true);
    });
  });

  describe('REQ-ACT-07 & REQ-ACT-08', () => {
    it('supports pagination, filters, and role-based visibility', async () => {
      const http = app.getHttpServer();

      const draft = await ownerPrisma.activities.create({
        data: {
          title: 'Secret Staff Draft',
          type_id: activityTypeId,
          description: 'Not for students',
          venue: 'Staff Room',
          start_at: new Date(Date.now() + 3600000 * 48),
          end_at: new Date(Date.now() + 3600000 * 52),
          registration_closes_at: new Date(Date.now() + 3600000 * 40),
          capacity: 10,
          service_hours: 2,
          organizer_id: organizerUser.id,
          status: 'DRAFT',
        },
      });

      // 1. Staff can see DRAFT
      const staffList = await request(http)
        .get('/api/v1/activities')
        .set('Authorization', organizerToken)
        .query({ status: 'DRAFT' })
        .expect(200);

      expect(staffList.body.items.some((a: any) => a.id === draft.id)).toBe(true);

      // 2. Student CANNOT see DRAFT in list
      const studentList = await request(http)
        .get('/api/v1/activities')
        .set('Authorization', studentToken)
        .expect(200);

      expect(studentList.body.items.some((a: any) => a.id === draft.id)).toBe(false);

      // 3. Student querying draft by ID gets 404
      await request(http)
        .get(`/api/v1/activities/${draft.id}`)
        .set('Authorization', studentToken)
        .expect(404);

      // 4. Pagination and search filters
      const searchRes = await request(http)
        .get('/api/v1/activities')
        .set('Authorization', organizerToken)
        .query({ q: 'Staff Draft', page: 1, limit: 5 })
        .expect(200);

      expect(searchRes.body.items.length).toBeGreaterThan(0);
      expect(searchRes.body.page).toBe(1);
    });
  });
});
