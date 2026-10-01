-- REQ-AUD-01 secret redaction and trigger activity
INSERT INTO users (email, password_hash, role) VALUES ('smoke-user@example.test', 'hash', 'STAFF');
UPDATE users SET password_hash = 'newhash' WHERE email = 'smoke-user@example.test';
SELECT old_data ? 'password_hash' AS old_contains_password_hash,
       new_data ? 'password_hash' AS new_contains_password_hash
FROM audit_log
WHERE table_name = 'users'
ORDER BY id DESC
LIMIT 1;

-- REQ-AUD-04 append-only protection
-- Expect exception:
-- UPDATE audit_log SET event_type = 'tampered' WHERE id = 1;

-- T5: Hash-chain recomputation query (REQ-AUD-04)
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
LIMIT 1;
