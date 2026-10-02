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
    const cookie = Array.isArray(setCookie) ? setCookie.find((c: string) => c.startsWith('refresh_token=')) : undefined;
    expect(cookie).toBeDefined();

    // 2. Refresh
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie!)
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

  it('returns 422 when registering with an unknown schoolId (REQ-AUTH-01)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'unknown-school@example.test',
        password: 'Password123456!',
        regNumber: 'TUK/999/2026',
        fullName: 'Unknown School Student',
        schoolId: 9999,
        programme: 'BSc Comp Sci',
        yearOfStudy: 1,
        noticeVersion: 'v0.1',
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('detects refresh token rotation and reuse (REQ-AUTH-04)', async () => {
    const password = 'Password123456!';
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await createUser({ email: 'rotate@example.test', passwordHash, role: 'STAFF' });

    // 1. Login to get initial refresh token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'rotate@example.test', password })
      .expect(200);

    const cookie1 = (loginRes.headers['set-cookie'] as string[]).find((c) => c.startsWith('refresh_token='));
    expect(cookie1).toBeDefined();

    // 2. Rotate refresh token
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie1!)
      .expect(200);

    const cookie2 = (refreshRes.headers['set-cookie'] as string[]).find((c) => c.startsWith('refresh_token='));
    expect(cookie2).toBeDefined();
    expect(cookie2).not.toEqual(cookie1);

    // 3. Reusing old refresh token must fail (401) and revoke family
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie1!)
      .expect(401);

    // 4. Now the active new refresh token should also be revoked due to family revocation
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie2!)
      .expect(401);
  });

  it('enforces account lockout per-account so shared IP cannot lock other accounts (REQ-AUTH-05)', async () => {
    const password = 'Password123456!';
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await createUser({ email: 'victim@example.test', passwordHash, role: 'STAFF' });
    await createUser({ email: 'innocent@example.test', passwordHash, role: 'STAFF' });

    // Lock victim with 5 bad attempts from a specific IP
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '198.51.100.42')
        .send({ email: 'victim@example.test', password: 'wrong-password' })
        .expect(401);
    }

    // Victim is locked
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '198.51.100.42')
      .send({ email: 'victim@example.test', password })
      .expect(401);

    // Innocent user from the exact SAME IP can still log in successfully!
    const innocentRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '198.51.100.42')
      .send({ email: 'innocent@example.test', password })
      .expect(200);
    expect(innocentRes.body.accessToken).toBeDefined();
  });

  it('handles password reset and rejects token reuse (REQ-AUTH-06)', async () => {
    const oldPassword = 'OldPassword123456!';
    const newPassword = 'NewPassword123456!';
    const passwordHash = await argon2.hash(oldPassword, { type: argon2.argon2id });
    const user = await createUser({ email: 'reset@example.test', passwordHash, role: 'STAFF' });

    // Request reset
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'reset@example.test' })
      .expect(200);

    // Manually create a reset token in DB to test the reset endpoint
    const { randomBytes, createHash } = await import('node:crypto');
    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(resetToken).digest();
    await ownerPrisma.$executeRaw`
      INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
      VALUES (${user.id}::uuid, 'RESET_PASSWORD', ${tokenHash}, NOW() + interval '1 hour')
    `;

    // Reset password
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, newPassword })
      .expect(200);

    // Reusing the same reset token returns 410 Gone
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, newPassword })
      .expect(410);

    // Old password no longer works
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '10.10.10.1')
      .send({ email: 'reset@example.test', password: oldPassword })
      .expect(401);

    // New password works
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '10.10.10.1')
      .send({ email: 'reset@example.test', password: newPassword })
      .expect(200);
    expect(loginRes.body.accessToken).toBeDefined();
  });

  it('immediately denies access to deactivated user with live token (REQ-AUTH-10)', async () => {
    const user = await createUser({ email: 'deactivate@example.test', role: 'STAFF', isActive: true });
    const { bearer } = await import('../helpers/index.js');
    const token = await bearer(user as any);

    // Verify token works on authenticated endpoint
    await request(app.getHttpServer())
      .get('/api/v1/partners')
      .set('Authorization', token)
      .expect(200);

    // Deactivate user in database
    await ownerPrisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    // Same live token immediately returns 401
    await request(app.getHttpServer())
      .get('/api/v1/partners')
      .set('Authorization', token)
      .expect(401);
  });
});
