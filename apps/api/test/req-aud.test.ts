import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import request from 'supertest';
import pg from 'pg';
import { createApp } from '../src/main.js';
import { applyTestEnv } from './test-env.js';

const { Client } = pg;
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const dbMigrateScript = join(repoRoot, 'scripts/db-migrate.mjs');
const auditVerifyScript = join(repoRoot, 'scripts/audit-verify.mjs');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDb = hasDatabase ? describe : describe.skip;

describeDb('REQ-AUD-01 / REQ-AUD-02 / REQ-AUD-04', () => {
  beforeAll(() => {
    applyTestEnv();
    execFileSync('node', [dbMigrateScript], { cwd: repoRoot, stdio: 'inherit' });
    execFileSync('bash', [join(repoRoot, 'ops/db-init.sh')], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    });
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
    await app.getHttpAdapter().getInstance().ready();

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
    const mainDbUrl = process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL!;
    const client = new Client({ connectionString: mainDbUrl });
    await client.connect();

    // Ensure audit_log is non-empty
    let countRes = await client.query('SELECT count(*) FROM audit_log');
    if (Number(countRes.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ('aud04-seed@example.test', 'hash', 'STAFF')
      `);
      countRes = await client.query('SELECT count(*) FROM audit_log');
    }
    expect(Number(countRes.rows[0].count)).toBeGreaterThan(0);

    // (a) verify passes on an untampered non-empty log
    const verifyOutput = execFileSync('node', [auditVerifyScript], {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: mainDbUrl, DATABASE_URL_MIGRATE: mainDbUrl },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(verifyOutput).toContain('audit chain verified');

    // (b) as svc_app, UPDATE/DELETE/TRUNCATE on audit_log are denied
    await client.query('SET ROLE svc_app');
    await expect(client.query("UPDATE audit_log SET event_type = 'denied' WHERE id = 1")).rejects.toThrow();
    await expect(client.query('DELETE FROM audit_log WHERE id = 1')).rejects.toThrow();
    await expect(client.query('TRUNCATE audit_log')).rejects.toThrow();
    await client.query('RESET ROLE');
    await client.end();

    // (c) tampering as owner makes verify fail and name the row (in throwaway db dropped afterwards)
    const parsedMain = new URL(mainDbUrl);
    const mainDbName = parsedMain.pathname.slice(1);
    const throwawayDb = `svc_throwaway_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const adminUrlPostgres = new URL(mainDbUrl);
    adminUrlPostgres.pathname = '/postgres';
    let adminClient: pg.Client;
    try {
      adminClient = new Client({ connectionString: adminUrlPostgres.toString() });
      await adminClient.connect();
    } catch {
      const adminUrlTemplate = new URL(mainDbUrl);
      adminUrlTemplate.pathname = '/template1';
      adminClient = new Client({ connectionString: adminUrlTemplate.toString() });
      await adminClient.connect();
    }

    try {
      await adminClient.query(`CREATE DATABASE ${throwawayDb} TEMPLATE ${mainDbName}`);
      const throwawayUrl = new URL(mainDbUrl);
      throwawayUrl.pathname = `/${throwawayDb}`;
      const throwawayClient = new Client({ connectionString: throwawayUrl.toString() });
      await throwawayClient.connect();

      try {
        const rowRes = await throwawayClient.query('SELECT id FROM audit_log ORDER BY id LIMIT 1');
        const targetId = rowRes.rows[0].id;

        await throwawayClient.query(`
          ALTER TABLE audit_log DISABLE TRIGGER trg_audit_no_mutation;
          UPDATE audit_log SET event_type = 'owner_tamper' WHERE id = ${targetId};
          ALTER TABLE audit_log ENABLE TRIGGER trg_audit_no_mutation;
        `);

        let threw = false;
        let verifyErrOutput = '';
        try {
          execFileSync('node', [auditVerifyScript], {
            cwd: repoRoot,
            env: {
              ...process.env,
              DATABASE_URL: throwawayUrl.toString(),
              DATABASE_URL_MIGRATE: throwawayUrl.toString(),
            },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
        } catch (err: unknown) {
          threw = true;
          const execErr = err as { stdout?: string | Buffer; stderr?: string | Buffer };
          verifyErrOutput = `${execErr.stdout?.toString() ?? ''}\n${execErr.stderr?.toString() ?? ''}`;
        }

        expect(threw).toBe(true);
        expect(verifyErrOutput).toContain(`audit chain verification failed at row id ${targetId}`);
      } finally {
        await throwawayClient.end();
      }
    } finally {
      await adminClient.query(`DROP DATABASE IF EXISTS ${throwawayDb}`);
      await adminClient.end();
    }
  });
});
