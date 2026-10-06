# Student Volunteerism and Community Service Records Management System (SVC-RMS)

The Student Volunteerism and Community Service Records Management System (SVC-RMS) is an enterprise recordkeeping and certification platform developed for the Directorate of Community Outreach, Partnerships and Linkages (DCOLAP) at the Technical University of Kenya (TUK). It provides an authoritative, tamper-evident system for managing community service activities, recording verified student attendance, issuing cryptographically verifiable certificates, and preserving institutional volunteerism history.

The platform serves four primary user roles:
- **STUDENT**: Registers an account, manages profile details, enrolls in published volunteer activities, checks in on-site via dynamic QR tokens, and downloads verifiable PDF certificates.
- **STAFF**: Creates activities, manages community partner listings, tracks rosters, executes manual attendance overrides, and initiates certificate issuance. Segregated approvers (`can_approve = true`) review and publish activities or revoke issued certificates.
- **MANAGEMENT**: Accesses high-level aggregated dashboards and statistical summaries (hours served, partner engagement, school metrics) without access to individual student records.
- **ADMIN**: Administers user accounts and approver rights, configures record retention classes, executes privacy exports (DPA compliance), and audits system operations.

---

## Feature Area Status

| Feature Area | Status | Implementation Notes |
|---|---|---|
| **Identity & Access** | Partial | Argon2id password hashing, session tokens, account lockout, role-based guard, and profile CRUD implemented; database test runner fixtures are undergoing schema alignment. |
| **Activities & Registration** | Partial | Activity state machine, `SELECT FOR UPDATE` capacity locking, double-booking advisory locks, participations, and community partner CRUD implemented. |
| **Attendance** | Working / Partial | ATT-01 Crockford Base32 30-second token algorithm with timing-safe validation verified by unit tests (9/9 passed); self-scan check-in and bulk staff roster endpoints implemented. |
| **Certificates** | Working / Partial | Ed25519 canonical JSON signatures, Crockford Base32 CVID generator, A4 landscape PDFKit generation with vector QR codes, and public verification endpoints implemented. |
| **Records & Retention** | Partial | Stream upload with magic-byte MIME detection, SHA-256 stream hashing, retention locking, disposal tracking, and PRIV-03 data export endpoint implemented. |
| **Reports & CSV** | Partial | Database aggregations returning summary metrics without student rows, CSV streaming export with formula-injection neutralization (`=`, `+`, `-`, `@`), and notifications. |
| **Notifications** | Working / Partial | In-app user notification queries, mark-as-read updates, and broadcast helper routines implemented. |
| **Audit Trail** | Working | PostgreSQL append-only hash-chain triggers, row-level change capture with secret redaction, and offline verification via `pnpm audit:verify` passing. |

---

## Architecture & Tech Stack

```mermaid
flowchart TD
    Client["Client Browser (Next.js 16 + React 19)"]
    Proxy["Reverse Proxy (Caddy :80/:443)"]
    API["API Gateway / Backend (NestJS 11 + Fastify 5)"]
    DB[("PostgreSQL 16\n(svc_app least privilege;\nOwner: postgres)")]
    Storage[("Local Disk Storage\n(/app/storage)")]

    Client -->|HTTPS| Proxy
    Proxy -->|/api/*| API
    Proxy -->|/*| Client
    API -->|Prisma 5 + AsyncLocalStorage Audit Context| DB
    API -->|Encrypted/Hashed Files & PDFs| Storage
```

- **Runtime & Tooling**: Node.js `>=24.0.0` (per `.nvmrc` and `engines`), pnpm `10.14.0` (`packageManager`)
- **Frontend**: Next.js `16.3.8` (App Router), React `19.2.8`, Tailwind CSS `^4.0.0`, `@yudiel/react-qr-scanner` `^2.6.0`, `date-fns` `^4.4.0`
- **Backend**: NestJS `^11.1.18`, Fastify `>=5.12.5`, `@fastify/cookie` `^11.1.2`, `@fastify/multipart` `^10.1.2`, `@fastify/helmet` `^13.1.1`, Pino `^9.4.0`, Zod `^3.23.8`
- **Database**: PostgreSQL 16, Prisma ORM `^5.20.0` with raw SQL migrations for triggers, check constraints, and hash chains
- **Security & Media**: Argon2id (`argon2` `^0.45.1`), Ed25519 / HMAC SHA-256 (`node:crypto`), Jose `^6.2.12`, PDFKit `^0.20.2`, QRCode `^1.5.4`, `file-type` `^22.1.1`

---

## Quickstart

### Prerequisites
- Node.js `>=24.0.0` (check with `node -v`)
- pnpm `10.14.0` (check with `pnpm -v`)
- Docker & Docker Compose

### 1. Clone & Install
```bash
git clone <repo-url> && cd SVC-RMS
pnpm install --frozen-lockfile
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Launch Services & Prepare Database
```bash
# Start PostgreSQL 16 and Mailpit
docker compose -f ops/docker-compose.yml up -d

# Run forward-only SQL migrations (runs as DB owner via DATABASE_URL_MIGRATE)
pnpm db:migrate

# Create runtime application role 'svc_app' and assign password
SVC_APP_PASSWORD=svc_app_secret bash ops/db-init.sh

# Seed reference data and synthetic dev accounts
pnpm db:seed
```

### 4. Run Development Servers
```bash
# Starts API on http://localhost:3001 and Web on http://localhost:3000
pnpm dev
```

### Seeded Synthetic Dev Accounts
The dev seed (`scripts/db-seed.mjs`, blocked when `NODE_ENV=production`) provisions synthetic accounts using the placeholder password hash `seed_password_hash`:
- **ADMIN**: `admin@example.test` (`canApprove: true`)
- **STAFF Approver**: `staff.approver@example.test` (`canApprove: true`)
- **STAFF Member**: `staff.member@example.test` (`canApprove: false`)
- **MANAGEMENT**: `management@example.test` (`canApprove: false`)
- **STUDENTS**: `student1@example.test` through `student50@example.test` (`REG0001`–`REG0050`)

---

## Environment Variables

Validated via Zod schema in `apps/api/src/config/env.ts`:

| Variable Name | Purpose | Required | Example / Default | Generation / Source |
|---|---|---|---|---|
| `DATABASE_URL` | Runtime DB connection string for `svc_app` | Yes | `postgresql://svc_app:secret@127.0.0.1:5432/svc_test` | App least-privilege credentials |
| `DATABASE_URL_MIGRATE` | Migration & seed connection string for DB owner | Yes (scripts) | `postgresql://postgres:postgres@127.0.0.1:5432/svc_test` | Superuser / owner credentials |
| `SVC_APP_PASSWORD` | Password for PostgreSQL role `svc_app` | Yes (db-init) | `svc_app_secret` | Used by `ops/db-init.sh` |
| `JWT_ACCESS_SECRET` | Secret key for access JWTs (min 32 chars) | Yes | `replace-with-32-plus-byte-secret` | CSPRNG: `openssl rand -hex 32` |
| `REFRESH_TOKEN_PEPPER` | HMAC pepper for refresh tokens (min 16 chars) | Yes | `replace-with-secret-pepper` | CSPRNG: `openssl rand -hex 16` |
| `QR_MASTER_SECRET` | Master key for TOTP QR check-in (min 32 chars) | Yes | `replace-with-32-plus-byte-secret` | CSPRNG: `openssl rand -hex 32` |
| `CERT_SIGNING_PRIVATE_KEY` | Ed25519 PKCS8 PEM private key for certificates | Yes | PEM string | `node apps/api/src/scripts/gen-cert-key.mjs` |
| `CERT_SIGNING_KEY_ID` | Identifier for the active certificate signing key | Yes | `k_d407cf05c20ca2de` | Generated alongside key |
| `PUBLIC_WEB_ORIGIN` | Public web origin URL for CORS and QR links | Yes | `http://localhost:3000` | Deployment hostname |
| `ALLOWED_STUDENT_EMAIL_DOMAINS` | Allowed email domain for student self-registration | Yes | `example.test` | University email domain |
| `SMTP_URL` | SMTP connection string for transactional mail | Yes | `smtp://localhost:1025` | Mailpit (dev) or production SMTP |
| `MAIL_FROM` | Sender address for transactional emails | Yes | `noreply@example.test` | System email address |
| `STORAGE_ROOT` | Filesystem path for uploaded documents and PDFs | Yes | `./storage` | Local or mounted volume path |
| `MAX_UPLOAD_BYTES` | Maximum allowable file upload size in bytes | No | `10485760` (10 MB) | Integer byte count |
| `ISSUER_NAME` | Organization name on issued certificates | Yes | `SVC-RMS` / `TUK DCOLAP` | Institutional label |
| `SIGNATORY_1_NAME` / `TITLE` | Name and title of first certificate signatory | Yes | `Prof. Jane Doe` / `Director` | Designated authority |
| `SIGNATORY_2_NAME` / `TITLE` | Name and title of second certificate signatory | Yes | `Dr. John Smith` / `Dean` | Designated authority |
| `LOG_LEVEL` | Pino logger minimum level | No | `info` | `fatal`, `error`, `warn`, `info`, `debug` |
| `NODE_ENV` | Runtime environment | No | `development` | `development`, `test`, `production` |

---

## Running Verification & Tests

```bash
pnpm typecheck   # Typecheck TypeScript across all packages (PASS)
pnpm lint        # Run ESLint across all workspaces (PASS)
pnpm trace:check # Verify tests map to docs/SRS.md requirement IDs (PASS)
pnpm audit:verify # Verify PostgreSQL cryptographic audit hash chain (PASS with DB)
pnpm test        # Run unit and integration tests (requires PostgreSQL)
```

- **Database Rules**: Tests hit a real PostgreSQL instance; running tests concurrently requires independent databases (e.g., `svc_identity`, `svc_activities`) to prevent transaction interference.
- **Traceability**: Every requirement ID appears directly in test names (`REQ-<ID>`) and is checked by `pnpm trace:check`.

---

## Demonstration Walkthrough (SRS §10)

1. **Registration**: Student registers with university email (`@example.test`), receives verification token, and validates account.
2. **Activity Creation & Segregated Approval**: Staff member creates an activity in `DRAFT`; a distinct approver publishes it to `PUBLISHED`.
3. **Registration & Capacity Enforcement**: Students register; `SELECT FOR UPDATE` capacity locking prevents oversubscription.
4. **Attendance via Dynamic QR**: Coordinator starts activity (`IN_PROGRESS`); student scans rotating 30s token on mobile device.
5. **Completion & Certification**: Coordinator concludes activity (`COMPLETED`); system transitions unattended slots to `ABSENT` and issues certificates.
6. **Certificate Verification**: Student downloads PDF; camera scans vector QR linking to `/verify/[cvid]`, displaying `VALID`.
7. **Revocation**: Approver revokes certificate with logged justification; public verification immediately shows `REVOKED`.
8. **Audit Verification**: Administrator inspects immutable audit log containing actor attribution (`app.user_id`, `app.client_ip`).
9. **Management Reporting**: Management dashboard displays aggregate summaries without disclosing individual student records.

---

## Security Model

- **Deny-by-Default Authorization**: API routes must explicitly declare `@Roles(...)` or `@Public()`. Missing metadata triggers a 500 configuration error.
- **Ownership Checks**: Student-owned resources use `assertOwns(...)`. Unauthorized access attempts return `404 Not Found` rather than `403 Forbidden` to prevent object enumeration.
- **Immutable Audit Hash Chain**: PostgreSQL triggers compute a SHA-256 hash chain on every write inside a transaction lock (`pg_advisory_xact_lock(7001)`). Updates or deletions to `audit_log` are blocked at trigger and grant level.
- **Cryptographic Signatures**: Certificates are signed with Ed25519 over canonical JSON representations.
- **Synthetic Data**: Repository contains exclusively synthetic fixtures, seeds, and test records.

---

## Deployment & Production Operations

- **Production Compose**: Defined in `ops/docker-compose.prod.yml` with separate services for `postgres`, one-shot `migrate`, `api`, `web`, and `caddy` reverse proxy (`ops/Caddyfile`).
- **Backup & Restore**: `ops/backup.sh` and `ops/restore.sh` are currently stubs with TODO markers; operational drill procedures are documented in `docs/RUNBOOK.md`.
- **TLS**: Terminated automatically by Caddy (:80/:443) or an upstream ingress.

---

## Troubleshooting

- **Unquoted All-Digit Secrets**: In YAML/env files, secrets containing only digits (e.g. `0123456789`) are parsed as numbers and will fail length validation in `apps/api/src/config/env.ts`. Always quote secret strings.
- **Prisma Engine Download on Restricted Networks**: When running `prisma generate` behind institutional firewalls or proxies, engine downloads may fail. Configure `PRISMA_ENGINES_MIRROR` if needed.
- **Node.js Version Mismatch**: Engine requirements specify Node.js `>=24.0.0` (matching `.nvmrc`). Node 20 or 22 will emit engine warnings and may exhibit subtle crypto differences.
- **Database Role / Password Errors**: Running `ops/db-init.sh` requires `SVC_APP_PASSWORD` to be explicitly exported in the environment.

---

## Documentation & Regulatory Compliance

- [System Requirements Specification](docs/SRS.md)
- [Operational Runbook](docs/RUNBOOK.md)
- [Agent Codebase Guide](docs/AGENT-README.md)

> [!IMPORTANT]
> **Kenya Data Protection Act (2019) Compliance Notice**:
> Prior to processing real student data in a production environment, TUK must complete the three statutory go-live gates specified in SRS §8.1:
> 1. Data Controller registration with the Office of the Data Protection Commissioner (ODPC).
> 2. Formal Data Protection Impact Assessment (DPIA) sign-off.
> 3. University approval of the records retention and disposal schedule.

---
Verified against commit 2909e9d
