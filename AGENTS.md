# SVC-RMS — Agent Prompt Pack

Companion to `docs/SRS.md`. Plan: **GitHub Copilot cloud agent** builds slice S0 (foundation) from the scaffold prompt below; you pull the PR; **Antigravity (IDE or CLI)** continues with slices S1–S6 using the slice template; a **separate fresh agent session** runs the QA review prompt after each slice. Never let the agent that wrote a slice be the only one that reviews it.

## 0. Setup checklist (do once, before prompting)
1. Create the GitHub repo. Add `docs/SRS.md` (the SRS) and `AGENTS.md` (§1 below). Copy `AGENTS.md` to `.github/copilot-instructions.md` too.
2. Add `.github/workflows/copilot-setup-steps.yml` (§2) so the cloud agent can run tests against a real Postgres. Check GitHub's current docs for the exact job name and file location, since the product has been renamed recently.
3. Create an issue titled **"S0 Foundation"**, paste prompt P-S0 (§3) as the body, assign it to Copilot.
4. Review the PR yourself with the human gate (§6) before merging.
5. In Antigravity, if it does not pick up `AGENTS.md` automatically, paste §1 as a workspace rule.

---

## 1. `AGENTS.md` (repo rules for every agent)

```markdown
# Agent rules — SVC-RMS

## Source of truth
- `docs/SRS.md` is the contract. Do not contradict it. If a change is needed, edit the SRS in the same PR and say why.
- Stack and architecture decisions (SRS §4) are final. Do not swap frameworks or libraries.
- When the SRS is silent, use the default in Appendix A and note it in the PR. When two parts of the SRS conflict, STOP and list the conflict instead of guessing.

## Commands (must exist and pass before any PR)
pnpm install · pnpm lint · pnpm typecheck · pnpm test · pnpm db:migrate · pnpm audit:verify · pnpm trace:check

## Non-negotiables
1. TypeScript strict. No `any` without a one-line justification comment.
2. Every API route is deny-by-default: it declares `@Roles(...)` or `@Public()`. Student-owned objects go through the ownership helper; foreign objects return 404.
3. Validate every input with zod; reject unknown keys. Never build SQL by string concatenation; use Prisma or tagged `$queryRaw`. All database writes must use Prisma model delegates or `$executeRaw` / `$executeRawUnsafe`; writes via `$queryRaw` or `$queryRawUnsafe` are strictly prohibited.
4. All writes happen inside the request's audit-context transaction so `app.user_id`, `app.client_ip`, `app.request_id` are set.
5. Errors are RFC 9457 problem+json using the codes in `packages/shared`.
6. Never log passwords, tokens, cookies or request bodies. Never commit secrets. `.env.example` has placeholders only.
7. No real personal data anywhere: fixtures, seeds and screenshots are synthetic.
8. Migrations are forward-only. Triggers, grants, partial indexes and generated columns live in raw SQL migrations.
9. Tests: every requirement ID appears in a test name (`describe('REQ-ATT-02', ...)`). Tests hit a real Postgres (Testcontainers). Assert on database state, not only on status codes. Write the failing test first.
10. Scope discipline: implement only the requirement IDs named in the task. No extra features, no drive-by refactors.

## Pull requests
Title `[Sx] short summary`. Body: requirement IDs implemented · tests that prove them · Appendix A defaults used · deviations (should be none) · how to run the demo path.
```

---

## 2. `.github/workflows/copilot-setup-steps.yml`
```yaml
name: "Copilot Setup Steps"
on: workflow_dispatch
jobs:
  copilot-setup-steps:
    runs-on: ubuntu-latest
    permissions: { contents: read }
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: svc_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
```

---

## 3. Prompt P-S0 — Scaffold (paste as the GitHub issue body for Copilot cloud agent)

```markdown
# S0 Foundation — scaffold SVC-RMS

Read `AGENTS.md` and `docs/SRS.md` (all of §4 and §5, and the requirement tables for OPS, AUD and AUTH-07) before writing code.

## Goal
Create the complete project skeleton, database layer, audit machinery, CI and test harness so later slices only add features. Do NOT implement any feature endpoint other than health.

## Tasks
1. **Monorepo** per SRS §4.1: pnpm workspaces `apps/api`, `apps/web`, `packages/shared`; Node 24 (`.nvmrc`, `engines`); strict TypeScript; ESLint + Prettier; root scripts: `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`, `audit:verify`, `trace:check`.
2. **packages/shared**: role enum, error code enum, problem+json type, zod helpers.
3. **apps/api** (NestJS on Fastify):
   - config module validating env with zod; refuse to boot on missing or weak secrets (OPS-03);
   - pino structured logging with redaction and request id (OPS-04, PRIV-05);
   - global deny-by-default guard with `@Public()` and `@Roles()` decorators (AUTH-07), plus a test that enumerates every route and fails if one lacks either;
   - global problem+json exception filter; `@nestjs/throttler`; security headers (SRS NFR-SEC-02);
   - `GET /healthz` and `GET /readyz` (OPS-01).
4. **Database**:
   - Prisma schema mirroring SRS §5.3. A validated SQL baseline is provided at `docs/db/0001_baseline.sql` (use it as the raw migration; do not rewrite it) and `docs/db/smoke.sql` (port these checks into the integration tests);
   - raw SQL migrations for everything Prisma cannot express: audit functions and triggers, hash chain, append-only triggers, edit-lock triggers, generated `search_tsv`, partial unique index, check constraints, grants;
   - role setup: migrations run as owner; the app connects as `svc_app` with exactly the grants in §5.3 (no UPDATE/DELETE/TRUNCATE on `audit_log`).
5. **Audit-context Prisma extension** using `AsyncLocalStorage`: every query runs in a transaction that first calls `set_config('app.user_id'|'app.client_ip'|'app.request_id', …, true)` (AUD-02). Add a tiny internal test-only route or service call to prove attribution.
6. **Seed** (`pnpm db:seed`, refuses to run when `NODE_ENV=production`): activity types (TREE_PLANTING, FUNDRAISING, CLEANUP, DONATION, MENTORSHIP, OTHER), placeholder schools, placeholder record classes with 7-year retention marked `PLACEHOLDER`, and synthetic dev users (1 ADMIN, 2 STAFF of which one `can_approve`, 1 MANAGEMENT, 50 STUDENTS, all `@example.test`).
7. **Scripts**: `audit:verify` recomputes the hash chain and exits non-zero naming the first bad row (AUD-04). `trace:check` reads the requirement tables in `docs/SRS.md`, reads `docs/slices.json` (`{ "S0": { "status": "active", "reqs": [...] }, … }`) and fails if a requirement of a slice marked `done` or `active` has no test whose name contains its ID.
8. **apps/web**: Next.js App Router + Tailwind skeleton: layout, a placeholder `/login` page, role-aware nav shell, typed API client using `packages/shared`. No business logic.
9. **ops**: `docker-compose.yml` (postgres 16, mailpit), `docker-compose.prod.yml` + `Caddyfile` (web at `/`, API at `/api`, one origin), `backup.sh` / `restore.sh` stubs with TODOs, `.env.example`, README quickstart.
10. **CI** (`.github/workflows/ci.yml`): install, lint, typecheck, test with a Postgres service, apply migrations on an empty DB, dependency audit, secret scan (gitleaks), `trace:check`.

## Tests required in this PR (names must contain the IDs)
`REQ-OPS-01`, `REQ-OPS-03`, `REQ-OPS-04`, `REQ-AUD-01` (INSERT/UPDATE/DELETE captured, secrets redacted), `REQ-AUD-02` (actor attribution), `REQ-AUD-04` (UPDATE/DELETE/TRUNCATE on `audit_log` rejected for `svc_app`; hash chain verified; tampering detected by `audit:verify`), `REQ-AUTH-07` (route enumeration).

## Acceptance
- `pnpm install && pnpm lint && pnpm typecheck && pnpm test` pass from a clean checkout.
- `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` runs the API and web.
- Migrations apply on an empty database in CI.
- No feature endpoints beyond health.

## Out of scope
Auth flows, activities, registration, attendance, certificates, records, reports, notifications, real UI.

## PR description must list
Appendix A defaults used, anything in the SRS that looked contradictory (stop and report instead of guessing), and exact commands to run locally.
```

---

## 4. Prompt template for slices S1–S6 (Antigravity IDE or CLI)

```text
You are implementing slice {SLICE} of SVC-RMS.

READ FIRST: AGENTS.md; docs/SRS.md §4, §5, and the requirement tables for: {MODULES}; §9 (verification rules); Appendix C.2 (past defects, do not reintroduce).

SCOPE: implement ONLY these requirement IDs: {REQ_IDS}.
Also deliver the web screens listed in UI-01 that these requirements need.

METHOD:
1. List each requirement's acceptance criteria as test cases. Write the failing tests first, named with the requirement ID.
2. Implement the smallest correct code. Respect ADR decisions; do not add libraries unless unavoidable (justify in the PR).
3. Run lint, typecheck, test, trace:check, audit:verify. Fix until green.
4. Self-check against adversarial charter items {CHARTER} in SRS §9.3 and add tests for each.
5. Update docs/slices.json (set {SLICE} to "done") and docs/RUNBOOK.md if operations change.

SLICE NOTES: {NOTES}

DO NOT: add features outside scope; weaken or skip a test; mock the database; log personal data; hard-code secrets; edit migrations that already shipped (add a new one).

IF BLOCKED OR THE SRS CONFLICTS WITH ITSELF: stop, state the conflict and the options, and wait.

OUTPUT: a pull request following AGENTS.md (requirement IDs, tests, defaults used, demo steps).
```

### Slice parameters
| Slice | `{MODULES}` | `{REQ_IDS}` | `{CHARTER}` | `{NOTES}` |
|---|---|---|---|---|
| **S1 Identity** | AUTH, STU, PRIV | AUTH-01…10, PRIV-01, PRIV-02, PRIV-05, STU-01, STU-02, UI-05, AUD-03 (auth events) | 1–4, 11, 15, 18 | Argon2id with at least the OWASP-recommended minimum parameters. Refresh cookie `HttpOnly; Secure; SameSite=Lax`, path `/api/v1/auth`. Identical 401 body and comparable timing for unknown email vs wrong password (run a dummy hash). Account lockout counter is per account. Implement one `assertOwns()` helper and use it everywhere student-owned data is read. Email sending through a mail service interface; Mailpit in dev. Consent notice text from a versioned constant. |
| **S2 Activities and registration** | ACT, REG, STU-03 | ACT-01…08, REG-01…05, STU-03, STU-04 | 5, 6 | Capacity: inside one transaction `SELECT … FROM activities WHERE id = $1 FOR UPDATE` (tagged `$queryRaw`), then count `REGISTERED`+`ATTENDED`. Double-booking: `pg_advisory_xact_lock(hashtext(studentId))` before the overlap query. Race tests use real parallel requests (`Promise.all`, 200 students). Publish rule: approver and not organizer. State machine in one pure, unit-tested function. |
| **S3 Attendance** | ATT, UI-02, UI-04 | ATT-01…06, UI-02, UI-04, AUD-03 (failed check-ins) | 7 | Implement the exact token algorithm in ATT-01 as a pure function with unit tests (window boundaries, previous-window acceptance, wrong activity). Use `crypto.timingSafeEqual`. QR scanning with a maintained library, plus manual code entry (ATT-06). Coordinator page polls every 25 s. `COMPLETED` transition marks remaining `REGISTERED` as `ABSENT` (ATT-04). |
| **S4 Certificates** | CRT | CRT-01…09, AUD-03 (staff downloads, integrity alerts) | 12, 14 | Canonical JSON function with unit tests (key order, unicode, numbers). Ed25519 via Node `crypto`; keys from env; `GET /public/keys` lists every key id ever used. CVID from CSPRNG in Crockford base32. PDFKit landscape A4; draw the QR as vector rectangles from `QRCode.create()` modules; embed no remote assets. Lazy PDF generation, cached with SHA-256, verified on download. Public verify returns exactly the keys in SRS §7.3. Public page `/verify/[cvid]`. |
| **S5 Records, reports, notifications** | REC, RPT, NTF | REC-01…05, RPT-01…05, NTF-01, AUD-05, PRIV-03, AUD-03 (exports, retention blocks); REC-06 and REC-08 only if time permits | 8, 9, 10, 17 | Detect file type with magic bytes (for example the `file-type` package), not the client MIME. Stream-hash while writing. Store under random keys; never use client filenames in paths. Full-text search with `websearch_to_tsquery('simple', $1)`. Dashboard SQL must aggregate in the database and return no student rows. One shared CSV writer that neutralises formulas. Disposal removes the file but keeps the metadata row. |
| **S6 Hardening** | all | Run everything; add OPS-02, UI-03, NFR-* evidence | all | Run the whole charter and fix findings. k6 scripts in `ops/perf/` using the performance seed; axe-core on the pages in UI-03; backup and restore drill with `audit:verify` after restore; `docs/RUNBOOK.md` (deploy, secrets and key rotation, backup, restore, incident and breach steps); `docs/asvs.md` checklist; final README with the demo path from SRS §10. |

---

## 5. QA review prompt (run in a fresh agent session after each slice; the reviewer does not edit code)

```text
You are a hostile, senior QA engineer reviewing slice {SLICE} of SVC-RMS. You do not write or change code. You find defects and prove them.

INPUTS: AGENTS.md; docs/SRS.md; the pull request diff; the test suite.

STEPS
1. For every requirement ID in {REQ_IDS}, locate its test(s). Mark each: COVERED / WEAK / MISSING. A test is WEAK if it only checks a status code and not database state, if it would still pass with the behaviour removed, or if it lacks the negative case from the acceptance criteria.
2. Run: pnpm lint, typecheck, test, trace:check, audit:verify. Report any failure or skipped test.
3. Execute adversarial charter items {CHARTER} (SRS §9.3) against a running instance. Report each as PASS or FAIL with exact reproduction.
4. Review the diff for: missing role guards, missing ownership checks, raw SQL string building, writes outside the audit-context transaction, missing indexes, N+1 queries, missing transactions or locks, secrets or personal data in logs or fixtures, unvalidated input, unknown keys accepted, error responses that leak existence or stack traces.
5. Regression check against SRS Appendix C.2: confirm none of the 18 past defects has returned.
6. Check scope: list anything implemented that is not in {REQ_IDS}.

OUTPUT (markdown, nothing else)
- Verdict: ACCEPT / ACCEPT WITH FIXES / REJECT
- Coverage table: Req | Status | Evidence
- Defects table: # | Severity (Blocker/High/Medium/Low) | Req or charter item | What is wrong | Reproduction | Suggested fix
- Out-of-scope changes
- Questions for the product owner
Be specific. Quote file paths and line numbers. Do not praise; do not pad.
```

---

## 6. Human QA gate (you, before merging each PR; about 10 minutes)
```bash
git pull && pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test
pnpm db:migrate && pnpm db:seed && pnpm audit:verify && pnpm trace:check
```
Then check by hand:
- Open the PR's test list: does every requirement ID in the slice appear in a test name?
- Skim the diff for `any`, `TODO`, `skip`, `console.log`, and string-built SQL.
- Run the slice's demo step from SRS §10 on a phone, not only on desktop.
- Confirm no real names, registration numbers or emails entered the repo.
- Paste the QA review prompt (§5) into a fresh agent session and read its report before approving.

## 7. Recovery prompts

**Agent drifted from the spec**
```text
Stop. Re-read AGENTS.md and docs/SRS.md §{section}. List every place your last change deviates from the SRS, one line each with the requirement ID. Revert the deviations; do not add new work. Then re-run lint, typecheck, test and report.
```

**A test fails and the agent wants to change the test**
```text
Do not edit the test. The test encodes SRS requirement {ID}. Explain which behaviour of the implementation is wrong, fix the implementation, and re-run. Only if you believe the test contradicts the SRS, stop and quote both passages.
```

**Migration problem**
```text
Do not edit any migration that has already been applied. Add a new forward-only migration. Show the SQL, apply it on an empty database and on the current one, and run the full test suite including audit:verify.
```

**Review a single risky file**
```text
Review {path} only. List every way an authenticated STUDENT could read or change another student's data through it, and every code path that writes without the audit-context transaction. Provide failing tests for each finding before proposing fixes.
```
# PARALLEL RULES

## Frozen Files
The following files are strictly frozen during the parallel build wave. Agents must not edit them:
- `package.json` and `pnpm-lock.yaml` (Dependencies are already installed. If one is missing, STOP and report.)
- `schema.prisma` and existing migrations (All tables exist. Never rename models or fields.)
- `docs/slices.json`
- `apps/api/src/app.module.ts`
- `packages/shared/src/index.ts`
- Anything outside the paths explicitly owned by the agent.

## Database & Ports
- **One database per agent**: E.g., `svc_identity`, `svc_activities`. Do not use the default `svc_test` database.
- Each agent must use its own port for dev servers if started concurrently.

## Owned Paths

| Agent | API (`apps/api/src/…`, tests `apps/api/test/<area>/`) | Web (`apps/web/src/app/…`, `…/lib/…`) |
|---|---|---|
| A identity | `auth/` (except the Wave 0 files), `users/`, `students/`, `mail/` | `login`, `register`, `verify-email`, `forgot-password`, `reset-password`, `admin/users`, `lib/auth/`, `lib/time.ts` |
| B activities | `activities/`, `participations/`, `partners/` | `activities`, `my/history`, `staff/activities`, `staff/partners` |
| C attendance | `attendance/` | `check-in`, `staff/activities/[id]/attendance` |
| D certificates | `certificates/`, `public/`, `signing/`, `pdf/`, `scripts/gen-cert-key.mjs` | `verify`, `my/certificates`, `staff/certificates` |
| E1 records | `records/`, `storage/`, `privacy/`, `audit/audit.controller.ts` | `staff/records`, `admin/audit` |
| E2 reports | `reports/`, `notifications/`, `csv/` | `management`, `staff/reports`, `notifications` |

## Push small and often
Commit small and `git push origin feat/<area>` after every requirement group (never leave work only on disk). 

## Stop Rule
When you have used about 60% of your available time or quota, stop adding Should/Could items and finish and push what is green. Priority: Must first, then Should.

## Codebase map
See `docs/AGENT-README.md` for the repository map, architecture patterns, request lifecycle, database conventions, recipes, and gotchas.
