import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.js';
import { bearer, createStudent, createUser, clearDatabase } from '../helpers/index.js';

describe('REQ-STU-01 / REQ-STU-02', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await clearDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a student to view and update their profile, but rejects unknown keys (REQ-STU-01)', async () => {
    const user = await createUser({ role: 'STUDENT' });
    await createStudent(user, { school_id: 1, year_of_study: 2 });
    const token = await bearer(user as any);

    // View
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/students/me')
      .set('Authorization', token)
      .expect(200);
    expect(getRes.body.schoolId).toBe(1);

    // Update
    await request(app.getHttpServer())
      .patch('/api/v1/students/me')
      .set('Authorization', token)
      .send({ schoolId: 2, yearOfStudy: 3 })
      .expect(200);

    const getRes2 = await request(app.getHttpServer())
      .get('/api/v1/students/me')
      .set('Authorization', token)
      .expect(200);
    expect(getRes2.body.schoolId).toBe(2);
    expect(getRes2.body.yearOfStudy).toBe(3);

    // Reject unknown keys
    await request(app.getHttpServer())
      .patch('/api/v1/students/me')
      .set('Authorization', token)
      .send({ regNumber: 'TUK/123/2026' })
      .expect(422);

    await request(app.getHttpServer())
      .patch('/api/v1/students/me')
      .set('Authorization', token)
      .send({ email: 'hacker@example.com' })
      .expect(422);
  });

  it('allows STAFF to search students but restricts MANAGEMENT (REQ-STU-02)', async () => {
    const studentUser = await createUser({ role: 'STUDENT' });
    await createStudent(studentUser, { reg_number: 'FIND-ME-123', full_name: 'Alice Findme' });

    const staffUser = await createUser({ role: 'STAFF' });
    const staffToken = await bearer(staffUser as any);

    const mgtUser = await createUser({ role: 'MANAGEMENT' });
    const mgtToken = await bearer(mgtUser as any);

    // STAFF search
    const searchRes = await request(app.getHttpServer())
      .get('/api/v1/students?q=FIND-ME')
      .set('Authorization', staffToken)
      .expect(200);
    expect(searchRes.body.items).toBeDefined();
    expect(searchRes.body.items.some((s: any) => s.regNumber === 'FIND-ME-123')).toBe(true);

    // MANAGEMENT denied
    await request(app.getHttpServer())
      .get('/api/v1/students')
      .set('Authorization', mgtToken)
      .expect(403);
  });
});
