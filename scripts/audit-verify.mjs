import { createHash } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for audit:verify');
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const rows = await client.query(`
  SELECT id, occurred_at, source, event_type, table_name, record_id, operation, old_data, new_data, actor_user_id,
         encode(prev_hash, 'hex') AS prev_hash_hex,
         encode(row_hash, 'hex') AS row_hash_hex
  FROM audit_log
  ORDER BY id ASC
`);

let prevHex = null;
for (const row of rows.rows) {
  const material =
    `${prevHex ?? ''}${row.occurred_at}${row.source}${row.event_type}` +
    `${row.table_name ?? ''}${row.record_id ?? ''}${row.operation ?? ''}` +
    `${row.old_data ? JSON.stringify(row.old_data) : ''}${row.new_data ? JSON.stringify(row.new_data) : ''}` +
    `${row.actor_user_id ?? ''}`;

  const expected = createHash('sha256').update(material, 'utf8').digest('hex');
  if (row.prev_hash_hex !== prevHex || row.row_hash_hex !== expected) {
    console.error(`audit chain verification failed at row id ${row.id}`);
    process.exitCode = 1;
    break;
  }
  prevHex = row.row_hash_hex;
}

if (process.exitCode !== 1) {
  console.log('audit chain verified');
}

await client.end();
