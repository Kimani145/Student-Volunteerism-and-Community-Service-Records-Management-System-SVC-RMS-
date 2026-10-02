# Student Volunteerism and Community Service Records Management System (SVC-RMS)

## Quickstart

```bash
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install
cp .env.example .env
docker compose -f ops/docker-compose.yml up -d
pnpm db:migrate
./ops/db-init.sh
pnpm db:seed
pnpm dev
```

## Database Roles & Least Privilege

- `DATABASE_URL_MIGRATE`: Database owner credentials (`postgres`), used for raw migrations (`pnpm db:migrate`), seeding (`pnpm db:seed`), and audit verification (`pnpm audit:verify`).
- `DATABASE_URL`: Application credentials (`svc_app`), used at runtime by the API and tests with least-privilege access (no UPDATE/DELETE/TRUNCATE on `audit_log`).
- `ops/db-init.sh`: Sets the `svc_app` password from `SVC_APP_PASSWORD` (table and sequence grants are managed by migration `0002_grants`).

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit:verify
pnpm trace:check
```
