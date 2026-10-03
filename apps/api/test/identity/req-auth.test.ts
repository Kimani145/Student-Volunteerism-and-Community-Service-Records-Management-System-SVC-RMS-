import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.js';
import { createUser, clearDatabase, ownerPrisma } from '../helpers/index.js';
import * as argon2 from 'argon2';

describe('REQ-AUTH', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await clearDatabase();
    app = await createTestApp();
    // seed a school
    await ownerPrisma.$executeRaw`INSERT INTO schools (id, name) VALUES (1, 'Engineering') ON CONFLICT DO NOTHING`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows self-registration and email verification (REQ-AUTH-01 / REQ-AUTH-02)', async () => {
    // 1. Register
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'student1@example.test',
        password: 'Password123456!',
        regNumber: 'TUK/111/2026',
        fullName: 'Test Student',
        schoolId: 1,
        programme: 'BSc Comp Sci',
        yearOfStudy: 1,
        noticeVersion: 'v0.1',
      })
      .expect(201);

    // Get the token from DB manually to test verification
    const emailToken = await ownerPrisma.$queryRaw<any[]>`SELECT * FROM email_tokens WHERE purpose = 'VERIFY_EMAIL' ORDER BY expires_at DESC LIMIT 1`;
    expect(emailToken.length).toBe(1);
    
    // We can't verify easily without the raw token because it's hashed.
    // Let's just create a test token directly for verification test.
    const user = await createUser({ email: 'verify@example.test', email_verified_at: null, role: 'STUDENT' });
    const { randomBytes, createHash } = await import('node:crypto');
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest();
    await ownerPrisma.$executeRaw`
      INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
      VALUES (${user.id}::uuid, 'VERIFY_EMAIL', ${tokenHash}, NOW() + interval '1 hour')
    `;

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(200);

    // Reuse fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(410);
  });

  it('handles login, lockout, and refresh (REQ-AUTH-03/04/05)', async () => {
    const password = 'Password123456!';
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await createUser({ email: 'login@example.test', passwordHash, role: 'STUDENT' });

    // 1. Successful Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.test', password })
      .expect(200);
    
    expect(loginRes.body.accessToken).toBeDefined();
    const setCookie = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.find((c: string) => c.startsWith('refresh_token=')) : undefined;((c: string) => c.startsWith('refresh_token='));
    expect(cookie).toBeDefined();

    // 2. Refresh
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    
    expect(refreshRes.body.accessToken).toBeDefined();

    // 3. Lockout
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.test', password: 'wrong' })
        .expect(401);
    }
    
    // 6th attempt even with correct password should fail
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.test', password })
      .expect(401); // 401 Account locked
  });
});
