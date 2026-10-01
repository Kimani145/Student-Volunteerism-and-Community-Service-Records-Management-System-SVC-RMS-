#!/usr/bin/env bash
set -euo pipefail

SVC_APP_PASSWORD="${SVC_APP_PASSWORD:-svc_app_secret}"
TARGET_URL="${DATABASE_URL_MIGRATE:-${DATABASE_URL:-}}"

if [ -n "$TARGET_URL" ]; then
  psql "$TARGET_URL" -v ON_ERROR_STOP=1 <<-EOSQL
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_app') THEN
        CREATE ROLE svc_app LOGIN PASSWORD '${SVC_APP_PASSWORD}';
      ELSE
        ALTER ROLE svc_app WITH PASSWORD '${SVC_APP_PASSWORD}';
      END IF;
    END \$\$;
EOSQL
  psql "$TARGET_URL" -v ON_ERROR_STOP=0 <<-EOSQL
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM svc_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      users, sessions, email_tokens, schools, students, consents, activity_types,
      community_partners, activities, participations, attendances, certificates,
      record_classes, documents, activity_reports, notifications
    TO svc_app;
    GRANT SELECT, INSERT ON TABLE audit_log TO svc_app;
    GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO svc_app;
EOSQL
else
  DB_NAME="${POSTGRES_DB:-svc_test}"
  DB_USER="${POSTGRES_USER:-postgres}"
  psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_app') THEN
        CREATE ROLE svc_app LOGIN PASSWORD '${SVC_APP_PASSWORD}';
      ELSE
        ALTER ROLE svc_app WITH PASSWORD '${SVC_APP_PASSWORD}';
      END IF;
    END \$\$;
EOSQL
  psql -v ON_ERROR_STOP=0 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM svc_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      users, sessions, email_tokens, schools, students, consents, activity_types,
      community_partners, activities, participations, attendances, certificates,
      record_classes, documents, activity_reports, notifications
    TO svc_app;
    GRANT SELECT, INSERT ON TABLE audit_log TO svc_app;
    GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO svc_app;
EOSQL
fi
