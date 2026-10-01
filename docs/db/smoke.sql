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
