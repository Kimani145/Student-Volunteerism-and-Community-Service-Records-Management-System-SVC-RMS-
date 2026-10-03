import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_MIGRATE is required for audit:verify');
}

const { Client } = pg;
const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const result = await client.query(`
    WITH chain AS (
      SELECT
        id,
        prev_hash,
        row_hash,
        LAG(row_hash) OVER (ORDER BY id) AS expected_prev_hash,
        sha256(convert_to(
          coalesce(encode(prev_hash, 'hex'), '') || occurred_at::text || source || event_type ||
          coalesce(table_name, '') || coalesce(record_id, '') || coalesce(operation, '') ||
          coalesce(old_data::text, '') || coalesce(new_data::text, '') ||
          coalesce(actor_user_id::text, ''), 'UTF8'
        )) AS expected_row_hash
      FROM audit_log
    )
    SELECT id
    FROM chain
    WHERE (expected_prev_hash IS NOT NULL AND prev_hash IS DISTINCT FROM expected_prev_hash)
       OR (expected_prev_hash IS NULL AND prev_hash IS NOT NULL)
       OR (row_hash IS DISTINCT FROM expected_row_hash)
    ORDER BY id
    LIMIT 1
  `);

  if (result.rows.length > 0) {
    console.error(`audit chain verification failed at row id ${result.rows[0].id}`);
    process.exitCode = 1;
  } else {
    console.log('audit chain verified');
  }
} finally {
  await client.end();
}
