#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SVC_APP_PASSWORD:-}" ]; then
  echo "Error: SVC_APP_PASSWORD environment variable is required" >&2
  exit 1
fi

TARGET_URL="${DATABASE_URL_MIGRATE:-${DATABASE_URL:-}}"

PSQL_ARGS=("-v" "ON_ERROR_STOP=1" "-v" "pw=$SVC_APP_PASSWORD")
if [ -n "$TARGET_URL" ]; then
  PSQL_ARGS+=("$TARGET_URL")
else
  PSQL_ARGS+=("--username" "${POSTGRES_USER:-postgres}" "--dbname" "${POSTGRES_DB:-svc_test}")
fi

psql "${PSQL_ARGS[@]}" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_app') THEN
      CREATE ROLE svc_app LOGIN;
    END IF;
  END \$\$;
  ALTER ROLE svc_app WITH PASSWORD :'pw';
EOSQL
