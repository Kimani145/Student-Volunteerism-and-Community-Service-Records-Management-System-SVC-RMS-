# Student Volunteerism and Community Service Records Management System (SVC-RMS)

## Quickstart

```bash
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install
pnpm setup:env                     # creates .env with generated dev secrets and a signing key (never overwrites)
docker compose -f ops/docker-compose.yml up -d
pnpm dev:reset                     # creates the svc_dev database, migrates, creates the app role, seeds demo accounts
pnpm dev                           # API on :3001, web on :3000
```

Demo accounts (synthetic, development only; password `Password123!`): `admin@example.test`, `staff.approver@example.test`,
`staff.member@example.test`, `management@example.test`, `student1@example.test` ... `student50@example.test`.
Type emails in lowercase. Five wrong passwords lock an account for 15 minutes (`pnpm db:seed` unlocks all demo accounts).

### Two databases, on purpose
- **`svc_dev`** holds your demo data. `pnpm dev:reset` rebuilds it.
- **`svc_test`** belongs to the test suite and is **wiped on every `pnpm test` run**. The test helpers refuse to run against any database whose
  name does not end in `_test`. Never point `.env` at `svc_test`, or your demo accounts will vanish and login will say "Invalid credentials".
  If your Postgres is not on port 5433, tell the tests where `svc_test` is:
  `export TEST_DATABASE_URL_MIGRATE=postgresql://postgres:postgres@127.0.0.1:<port>/svc_test TEST_DATABASE_URL=postgresql://svc_app:svc_app_secret@127.0.0.1:<port>/svc_test`

### Hosting
See `docs/DEPLOY.md` (Render for the API, Vercel for the web app, `pnpm db:bootstrap` for the first admin).

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
