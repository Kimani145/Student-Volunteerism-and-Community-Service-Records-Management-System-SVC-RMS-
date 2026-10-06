#!/usr/bin/env node
/**
 * pnpm dev:reset
 *
 * Drops and recreates the DEVELOPMENT database, then migrates, creates the app role and seeds demo accounts.
 * Refuses to run against a database whose name ends in "_test" (that one belongs to the test suite and is
 * wiped on every test run) or when NODE_ENV=production.
 */
import { spawnSync } from 'node:child_process';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') {
  console.error('dev:reset is blocked when NODE_ENV=production');
  process.exit(1);
}
try {
  process.loadEnvFile();
} catch {}

const ownerUrl = process.env.DATABASE_URL_MIGRATE;
if (!ownerUrl) {
  console.error('DATABASE_URL_MIGRATE is required (run `pnpm setup:env` first).');
  process.exit(1);
}

const url = new URL(ownerUrl);
const dbName = decodeURIComponent(url.pathname.slice(1));
if (!/^[a-z0-9_]+$/i.test(dbName)) {
  console.error(`Unsafe database name: ${dbName}`);
  process.exit(1);
}
if (dbName.endsWith('_test')) {
  console.error(`Refusing to reset "${dbName}": databases ending in _test belong to the test suite. Use a dev database such as svc_dev.`);
  process.exit(1);
}

const adminUrl = new URL(ownerUrl);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [dbName]);
await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
await admin.query(`CREATE DATABASE "${dbName}"`);
await admin.end();
console.log(`Recreated database ${dbName}`);

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    console.error(`Step failed: ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
};
run('node', ['scripts/db-migrate.mjs']);
run('bash', ['ops/db-init.sh']);
run('node', ['scripts/db-seed.mjs']);
console.log('\nDone. Start the apps with `pnpm dev`.');
