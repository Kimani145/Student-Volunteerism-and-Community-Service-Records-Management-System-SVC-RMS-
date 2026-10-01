import { execFileSync } from 'node:child_process';
import request from 'supertest';
import pg from 'pg';
import { createApp } from '../src/main.js';
import { applyTestEnv } from './test-env.js';

const { Client } = pg;
const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDb = hasDatabase ? describe : describe.skip;

describeDb('REQ-AUD-01 / REQ-AUD-02 / REQ-AUD-04', () => {
  beforeAll(() => {
    applyTestEnv();
    execFileSync('node', ['scripts/db-migrate.mjs'], { stdio: 'inherit' });
  });

  it('captures row changes with secret redaction (REQ-AUD-01)', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const idResult = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('aud-redaction@example.test', 'supersecret', 'STAFF')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
    );

    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', ['next-secret', idResult.rows[0].id]);

    const audit = await client.query(
      `SELECT old_data, new_data
       FROM audit_log
       WHERE table_name = 'users'
       ORDER BY id DESC
       LIMIT 1`,
    );

    expect(audit.rows[0].old_data?.password_hash).toBeUndefined();
    expect(audit.rows[0].new_data?.password_hash).toBeUndefined();

    await client.end();
  });

  it('attributes actor identity via request context (REQ-AUD-02)', async () => {
    const app = await createApp();
    await app.init();

    const actorId = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .post('/api/v1/_test/audit-attribution')
      .send({ userId: actorId, email: 'aud-actor@example.test' })
      .expect(201);

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const row = await client.query(
      `SELECT actor_user_id
       FROM audit_log
       WHERE table_name = 'users' AND record_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [actorId],
    );
    expect(row.rows[0]?.actor_user_id).toBe(actorId);

    await client.end();
    await app.close();
  });

  it('enforces append-only audit log and detects tampering (REQ-AUD-04)', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await expect(client.query(`UPDATE audit_log SET event_type = 'tampered' WHERE id = 1`)).rejects.toBeTruthy();

    const ownerMutation = await client.query(
      `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM audit_log WHERE id = 1) THEN
          ALTER TABLE audit_log DISABLE TRIGGER trg_audit_no_mutation;
          UPDATE audit_log SET event_type = 'owner_tamper' WHERE id = 1;
          ALTER TABLE audit_log ENABLE TRIGGER trg_audit_no_mutation;
        END IF;
      END $$;
      `,
    );
    expect(ownerMutation).toBeDefined();

    expect(() =>
      execFileSync('node', ['scripts/audit-verify.mjs'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ).toThrow();

    await client.end();
  });
});
