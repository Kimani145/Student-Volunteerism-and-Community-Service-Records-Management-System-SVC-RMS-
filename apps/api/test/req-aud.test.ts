import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import request from 'supertest';
import pg from 'pg';
import { createApp } from '../src/main.js';
import { applyTestEnv } from './test-env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuditContextStorage } from '../src/prisma/audit-context.storage.js';

const { Client } = pg;
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const dbMigrateScript = join(repoRoot, 'scripts/db-migrate.mjs');
const auditVerifyScript = join(repoRoot, 'scripts/audit-verify.mjs');

const isCI = Boolean(process.env.CI && process.env.CI !== 'false');
const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDb = hasDatabase || isCI ? describe : describe.skip;

describeDb('REQ-AUD-01 / REQ-AUD-02 / REQ-AUD-04', () => {
  beforeAll(() => {
    if (isCI && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set in CI for database tests (skipping is not allowed)');
    }
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

  it('attributes actor identity via request context and normal prisma.student.create calls (REQ-AUD-02)', async () => {
    const app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // 1. Through HTTP endpoint using ALS context without manual tx wrapper
    const actorId = '11111111-1111-4111-8111-111111111111';
    const httpRes = await request(app.getHttpServer())
      .post('/api/v1/_test/audit-attribution')
      .send({ userId: actorId, email: `aud-actor-${Date.now()}@example.test` })
      .expect(201);

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const row = await client.query(
      `SELECT actor_user_id, host(actor_ip) AS actor_ip, request_id
       FROM audit_log
       WHERE table_name = 'students' AND record_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [httpRes.body.studentId],
    );
    expect(row.rows[0]?.actor_user_id).toBe(actorId);
    expect(row.rows[0]?.actor_ip).toBe('127.0.0.1');
    expect(row.rows[0]?.request_id).toBeDefined();

    // 2. Direct normal prisma.student.create(...) call through Prisma client extension
    const prisma = app.get(PrismaService);
    const storage = app.get(AuditContextStorage);

    const directActorId = '22222222-2222-4222-8222-222222222222';
    const school = await prisma.school.findFirst();
    const directUser = await prisma.user.create({
      data: {
        email: `direct-student-user-${Date.now()}@example.test`,
        passwordHash: 'dummy',
        role: 'STUDENT',
      },
    });

    const student = await storage.run(
      { userId: directActorId, clientIp: '10.20.30.40', requestId: 'req-direct-aud-02' },
      async () => {
        return prisma.student.create({
          data: {
            user_id: directUser.id,
            reg_number: `REG-DIR-${Date.now()}`,
            full_name: 'Direct Extension Student',
            school_id: school!.id,
            programme: 'BSc Software Engineering',
            year_of_study: 2,
          },
        });
      },
    );

    const directRow = await client.query(
      `SELECT actor_user_id, host(actor_ip) AS actor_ip, request_id
       FROM audit_log
       WHERE table_name = 'students' AND record_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [student.id],
    );
    expect(directRow.rows[0]?.actor_user_id).toBe(directActorId);
    expect(directRow.rows[0]?.actor_ip).toBe('10.20.30.40');
    expect(directRow.rows[0]?.request_id).toBe('req-direct-aud-02');

    // 3. Proves that writes without audit context throw in production
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      await expect(
        prisma.user.create({
          data: {
            email: `unauthorized-audit-${Date.now()}@example.test`,
            passwordHash: 'dummy',
            role: 'STUDENT',
          },
        }),
      ).rejects.toThrow('Audit context required for write operations');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }

    await client.end();
    await app.close();
  });

  it('supports runAsSystem for background jobs and seeds with system audit event (REQ-AUD-02)', async () => {
    const app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const prisma = app.get(PrismaService);

    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const createdUser = await prisma.runAsSystem('seed_job', async (txPrisma) => {
        return txPrisma.user.create({
          data: {
            email: `system-created-${Date.now()}@example.test`,
            passwordHash: 'dummy',
            role: 'STUDENT',
          },
        });
      });
      expect(createdUser.id).toBeDefined();

      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const sysEvent = await client.query(
        `SELECT event_type, source, request_id, actor_user_id
         FROM audit_log
         WHERE event_type = 'system.seed_job'
         ORDER BY id DESC LIMIT 1`,
      );
      expect(sysEvent.rows[0]?.source).toBe('APP');
      expect(sysEvent.rows[0]?.actor_user_id).toBeNull();
      await client.end();
    } finally {
      process.env.NODE_ENV = prevEnv;
      await app.close();
    }
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
      await adminClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [mainDbName],
      );
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
      await adminClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [throwawayDb],
      );
      await adminClient.query(`DROP DATABASE IF EXISTS ${throwawayDb}`);
      await adminClient.end();
    }
  }, 30000);
});
