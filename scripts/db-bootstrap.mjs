#!/usr/bin/env node
/**
 * Production bootstrap for SVC-RMS (db:seed is blocked in production on purpose).
 *
 * Creates, idempotently:
 *   - reference data (activity types, schools, record classes) with ON CONFLICT DO NOTHING
 *   - ONE admin account with a RANDOM password, printed once to this terminal
 *
 * It never creates demo users and never overwrites existing reference data.
 *
 * Usage (run from your laptop against the hosted database, owner/admin connection string):
 *   DATABASE_URL_MIGRATE='postgres://owner:***@host:5432/db' \
 *   node scripts/db-bootstrap.mjs --admin-email you@example.org \
 *        [--schools "School of A;School of B"] [--reset-password]
 *
 *   --admin-email     required (or env ADMIN_EMAIL)
 *   --schools         semicolon-separated real school names (or env SCHOOLS). If omitted and the
 *                     schools table is empty, clearly named placeholders are inserted.
 *   --reset-password  rotate the password of existing target accounts (otherwise existing accounts are left untouched)
 *   --demo-users      also create demo accounts (staff approver, staff, management, 3 students) with RANDOM passwords
 *   --demo-password   OPT-IN: give every demo account this one shared password instead of random ones.
 *                     Only do this on a private/staging site; a known password on a public site is a risk.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import pg from 'pg';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const databaseUrl = process.env.DATABASE_URL_MIGRATE;
if (!databaseUrl) {
  console.error('DATABASE_URL_MIGRATE (owner connection string) is required.');
  process.exit(1);
}

const adminEmail = (opt('admin-email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  console.error('A valid --admin-email (or ADMIN_EMAIL) is required.');
  process.exit(1);
}

const schoolsArg = opt('schools') ?? process.env.SCHOOLS ?? '';
const schools = schoolsArg
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

// argon2 is a dependency of apps/api only; resolve it from there with the same parameters the API uses.
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const argon2 = require('argon2');

const ssl = /sslmode=(require|verify-full|verify-ca)/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined;
const client = new pg.Client({ connectionString: databaseUrl, ssl });
await client.connect();

const created = [];
const untouched = [];

try {
  await client.query('BEGIN');

  for (const [code, name] of [
    ['TREE_PLANTING', 'Tree Planting'],
    ['FUNDRAISING', 'Fundraising'],
    ['CLEANUP', 'Cleanup'],
    ['DONATION', 'Donation'],
    ['MENTORSHIP', 'Mentorship'],
    ['OTHER', 'Other'],
  ]) {
    await client.query('INSERT INTO activity_types (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING', [code, name]);
  }

  // Retention periods are PLACEHOLDERS until DCOLAP confirms them (SRS Appendix A-03).
  for (const [code, name] of [
    ['ATTENDANCE_REGISTER', 'Attendance Register'],
    ['APPROVAL_LETTER', 'Approval Letter'],
    ['PHOTO', 'Photo'],
    ['FINANCIAL', 'Financial'],
    ['ACTIVITY_REPORT', 'Activity Report'],
  ]) {
    await client.query(
      'INSERT INTO record_classes (code, name, retention_years) VALUES ($1, $2, 7) ON CONFLICT (code) DO NOTHING',
      [code, `${name} PLACEHOLDER`],
    );
  }

  if (schools.length > 0) {
    for (const name of schools) {
      await client.query('INSERT INTO schools (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }
  } else {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM schools');
    if (rows[0].n === 0) {
      for (const name of ['Placeholder School A', 'Placeholder School B', 'Placeholder School C']) {
        await client.query('INSERT INTO schools (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
      }
      console.warn('WARNING: inserted placeholder schools. Re-run with --schools "Real School 1;Real School 2" before real use.');
    }
  }

  const sharedDemoPassword = opt('demo-password');
  const targets = [{ email: adminEmail, role: 'ADMIN', canApprove: true, demo: false }];
  if (flag('demo-users')) {
    targets.push(
      { email: 'staff.approver@example.test', role: 'STAFF', canApprove: true, demo: true },
      { email: 'staff.member@example.test', role: 'STAFF', canApprove: false, demo: true },
      { email: 'management@example.test', role: 'MANAGEMENT', canApprove: false, demo: true },
      ...[1, 2, 3].map((n) => ({ email: `student${n}@example.test`, role: 'STUDENT', canApprove: false, demo: true, studentNo: n })),
    );
  }

  const school = await client.query('SELECT id FROM schools ORDER BY id LIMIT 1');
  if (flag('demo-users') && school.rowCount === 0) throw new Error('No schools exist; cannot create demo students.');

  for (const t of targets) {
    const existing = await client.query('SELECT id, role FROM users WHERE email = $1', [t.email]);
    const password = t.demo && sharedDemoPassword ? sharedDemoPassword : randomBytes(18).toString('base64url');

    if (existing.rowCount === 0) {
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      const id = randomUUID();
      await client.query(
        `INSERT INTO users (id, email, password_hash, role, can_approve, email_verified_at, must_change_password)
         VALUES ($1, $2, $3, $4::user_role, $5, NOW(), $6)`,
        [id, t.email, hash, t.role, t.canApprove, !t.demo],
      );
      if (t.role === 'STUDENT') {
        await client.query(
          `INSERT INTO students (user_id, reg_number, full_name, school_id, programme, year_of_study)
           VALUES ($1, $2, $3, $4, 'BSc Demo Programme', 3)`,
          [id, `TUK/DEMO/${String(t.studentNo).padStart(3, '0')}`, `Demo Student ${t.studentNo}`, school.rows[0].id],
        );
      }
      created.push({ email: t.email, role: t.role, password });
    } else if (flag('reset-password')) {
      if (existing.rows[0].role !== t.role) {
        throw new Error(`User ${t.email} exists with role ${existing.rows[0].role}, expected ${t.role}; refusing to reset.`);
      }
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      await client.query(
        `UPDATE users SET password_hash = $2, failed_login_count = 0, locked_until = NULL, is_active = TRUE,
                email_verified_at = COALESCE(email_verified_at, NOW()), must_change_password = $3
         WHERE id = $1`,
        [existing.rows[0].id, hash, !t.demo],
      );
      created.push({ email: t.email, role: t.role, password });
    } else {
      untouched.push(t.email);
    }
  }

  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Bootstrap failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

if (process.exitCode !== 1) {
  console.log('Bootstrap complete.');
  if (created.length > 0) {
    console.log('\n  Accounts created or reset (passwords are shown ONCE; store them now):\n');
    for (const a of created) console.log(`  ${a.role.padEnd(10)} ${a.email.padEnd(32)} ${a.password}`);
    console.log('');
  }
  if (untouched.length > 0) {
    console.log(`Already existing, left unchanged (use --reset-password to rotate): ${untouched.join(', ')}`);
  }
}
