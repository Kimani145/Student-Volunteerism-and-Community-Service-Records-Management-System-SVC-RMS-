import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

if (process.env.NODE_ENV !== 'production' && process.loadEnvFile) {
  try {
    process.loadEnvFile();
  } catch {}
}

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL_MIGRATE or DATABASE_URL is required for db:migrate');
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS _raw_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const migrationRoot = join(process.cwd(), 'apps', 'api', 'prisma', 'migrations');
const migrations = (await readdir(migrationRoot)).sort();

for (const migration of migrations) {
  const already = await client.query('SELECT 1 FROM _raw_migrations WHERE id = $1', [migration]);
  if (already.rowCount) {
    continue;
  }

  const sql = await readFile(join(migrationRoot, migration, 'migration.sql'), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO _raw_migrations (id) VALUES ($1)', [migration]);
    await client.query('COMMIT');
    console.log(`applied migration ${migration}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

await client.end();
