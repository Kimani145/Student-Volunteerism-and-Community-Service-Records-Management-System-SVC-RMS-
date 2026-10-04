import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { applyTestEnv } from './test-env.js';
import { bearer, createUser, createStudent, createActivity } from './helpers/index.js';
import { ownerPrisma } from './helpers/db.js';
import { UserRole } from '@svc-rms/shared';

const isCI = Boolean(process.env.CI && process.env.CI !== 'false');
const hasDatabase = Boolean(process.env.DATABASE_URL);
if (isCI && !hasDatabase) {
  throw new Error('DATABASE_URL must be set in CI for database tests (skipping is not allowed)');
}
const describeDb = hasDatabase ? describe : describe.skip;

describeDb('REQ-NTF-01', () => {
  let app: any;
  let server: any;
  let studentToken: string;
  let studentUser: any;
  
  beforeAll(async () => {
    applyTestEnv();
    app = await createTestApp();
    server = app.getHttpServer();

    studentUser = await createUser({ role: UserRole.STUDENT });
    studentToken = await bearer({ id: studentUser.id, role: studentUser.role });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('REQ-NTF-01: List and mark read in-app notifications', async () => {
    // Create a notification directly in db for the user
    const n = await ownerPrisma.notifications.create({
      data: {
        user_id: studentUser.id,
        type: 'REGISTRATION_CONFIRM',
        title: 'Registration Confirmed',
        body: 'You are registered.',
      }
    });

    const getRes = await request(server)
      .get('/api/v1/notifications')
      .set('Authorization', studentToken)
      .expect(200);

    expect(getRes.body).toBeInstanceOf(Array);
    expect(getRes.body.length).toBe(1);
    expect(getRes.body[0].title).toBe('Registration Confirmed');
    expect(getRes.body[0].read_at).toBeNull();

    // Mark as read
    await request(server)
      .post(`/api/v1/notifications/${n.id}/read`)
      .set('Authorization', studentToken)
      .expect(201);

    const getRes2 = await request(server)
      .get('/api/v1/notifications')
      .set('Authorization', studentToken)
      .expect(200);

    expect(getRes2.body[0].read_at).not.toBeNull();
  });
});
