# SVC-RMS Agent Codebase Guide

This document is the technical architecture manual and development guide for AI coding agents and engineers working on the Student Volunteerism and Community Service Records Management System (SVC-RMS).

---

## 1. Mission & Order of Precedence

1. **`docs/SRS.md` is the immutable contract**: All architectural decisions (ADR-01 through ADR-08), database schema designs (§5.3), entity relationships, API endpoint specs (§7), and acceptance criteria take absolute priority. If code and the SRS conflict, STOP and report the conflict.
2. **`AGENTS.md` defines repository rules**: Monorepo scripts, frozen file lists, ownership boundaries, denial-by-default rules, zero-mock database mandates, and QA gates.
3. **`docs/AGENT-README.md` is the map**: Structural breakdown, conventions, recipes, and concrete code patterns.

---

## 2. Repository Map

### Monorepo Structure

| Directory | Responsibility | Primary Stack / Files |
|---|---|---|
| `apps/api` | Fastify-based NestJS API backend | NestJS 11, Fastify 5, Prisma 5, Pino |
| `apps/web` | Next.js App Router frontend application | Next.js 16, React 19, Tailwind CSS v4 |
| `packages/shared` | Shared TypeScript types, enums, error codes, and Zod schemas | Zod 3, TS 5 |
| `docs/` | System specifications, database migrations, runbooks | `SRS.md`, `RUNBOOK.md`, `db/` |
| `ops/` | Deployment, containerization, and database scripts | `docker-compose.*`, `Caddyfile`, `db-init.sh` |
| `scripts/` | Tooling scripts executed via root pnpm commands | `db-migrate.mjs`, `db-seed.mjs`, `audit-verify.mjs`, `trace-check.mjs` |

### API Domain Modules (`apps/api/src/`)

| Module Path | Responsibility | SRS Reqs | Key Files |
|---|---|---|---|
| `src/activities/` | Activity lifecycle state machine, capacity enforcement | `ACT-01`..`08` | `activities.controller.ts`, `activities.service.ts`, `state-machine.ts`, `dto.ts` |
| `src/attendance/` | TOTP dynamic QR check-in, manual roster overrides, geofence check | `ATT-01`..`06`, `UI-02`, `UI-04` | `attendance.controller.ts`, `attendance.service.ts`, `token.util.ts`, `dto/attendance.dto.ts` |
| `src/audit/` | Audit log querying, attribution capture, audit events | `AUD-01`..`05` | `audit.controller.ts`, `audit-events.service.ts`, `audit.module.ts` |
| `src/auth/` | Authentication, Argon2id, JWT cookies, lockout, guards | `AUTH-01`..`10`, `PRIV-05` | `auth.controller.ts`, `auth.service.ts`, `jwt-auth.guard.ts`, `route-policy.guard.ts`, `ownership.ts` |
| `src/certificates/` | Ed25519 signing, CVID generation, PDF delivery, revocation | `CRT-01`..`09` | `certificates.controller.ts`, `certificates.service.ts`, `dto/issue-certificates.dto.ts`, `dto/revoke-certificate.dto.ts` |
| `src/csv/` | Streaming CSV export with formula neutralization (`=`, `+`, `-`, `@`) | `RPT-03`, `RPT-05` | `csv.service.ts`, `csv.module.ts` |
| `src/health/` | Liveness and readiness endpoints (`/healthz`, `/readyz`) | `OPS-01` | `health.controller.ts`, `health.service.ts` |
| `src/mail/` | Transactional email delivery via SMTP (Nodemailer) | `AUTH-02`, `AUTH-04` | `mail.service.ts` |
| `src/notifications/`| User notifications, mark as read, student broadcast helper | `NTF-01` | `notifications.controller.ts`, `notifications.service.ts` |
| `src/participations/`| Activity registration, double-booking locks, cancellations | `REG-01`..`05`, `STU-03`, `STU-04` | `participations.controller.ts`, `participations.service.ts` |
| `src/partners/` | Community partner registry and contact management | `ACT-04` | `partners.controller.ts`, `partners.service.ts` |
| `src/pdf/` | Landscape A4 PDFKit certificate generation with vector QR | `CRT-04` | `pdf.service.ts`, `pdf.module.ts` |
| `src/prisma/` | Database client, audit context extension, `AsyncLocalStorage` | `AUD-02`, `OPS-03` | `prisma.service.ts`, `audit-context.storage.ts`, `prisma.module.ts` |
| `src/privacy/` | Personal data export (PRIV-03) and retention compliance | `PRIV-01`..`04` | `privacy.controller.ts`, `privacy.module.ts` |
| `src/public/` | Public certificate verification portal and key discovery | `CRT-05`, `CRT-07` | `public.controller.ts`, `public.service.ts` |
| `src/records/` | Magic-byte MIME detection, streaming upload, retention lock | `REC-01`..`05` | `records.controller.ts`, `records.service.ts`, `multipart-parser.ts` |
| `src/reports/` | Database aggregation summaries (hours, partners, schools) | `RPT-01`..`05` | `reports.controller.ts`, `reports.service.ts` |
| `src/signing/` | Ed25519 signatures, canonical JSON formatting, Crockford CVID | `CRT-02`, `CRT-03` | `signing.service.ts`, `canonical.ts`, `crockford.ts` |
| `src/storage/` | Secure disk storage management with collision-free keys | `REC-01` | `storage.service.ts`, `storage.module.ts` |
| `src/students/` | Student profile self-service view/update and staff search | `STU-01`, `STU-02` | `students.controller.ts`, `students.service.ts`, `zod-validation.pipe.ts` |
| `src/users/` | Administrative user CRUD, approver delegation, last-admin lock | `AUTH-09`, `AUTH-10` | `users.controller.ts`, `users.service.ts` |

### Web Application Routes (`apps/web/src/app/`)

| Route Path | Description | Access / Role |
|---|---|---|
| `/login`, `/register` | User authentication and student registration | Public |
| `/verify-email`, `/reset-password` | Account verification and password recovery flows | Public |
| `/check-in` | Mobile QR scanner and manual token entry | `STUDENT` |
| `/my/certificates` | Student certificate downloads | `STUDENT` |
| `/staff/activities/[id]/attendance` | Live coordinator QR rotation and manual roster overrides | `STAFF`, `ADMIN` |
| `/staff/certificates` | Certificate issuance and revocation controls | `STAFF`, `ADMIN` |
| `/staff/records` | Document ingestion, classification, and retention review | `STAFF`, `ADMIN` |
| `/staff/reports` | Activity summaries and sanitized CSV exports | `STAFF`, `ADMIN` |
| `/management` | Institutional aggregate volunteer metrics dashboard | `MANAGEMENT`, `ADMIN` |
| `/admin/users` | User administration and approver privileges management | `ADMIN` |
| `/admin/audit` | Tamper-evident audit log review | `ADMIN` |
| `/notifications` | In-app notifications inbox | Authenticated |
| `/verify/[cvid]` | Public certificate verification portal | Public |

---

## 3. Request Lifecycle & Audit Attribution

Every API request follows a deterministic pipeline:

```text
HTTP Request
  │
  ▼
JwtAuthGuard (apps/api/src/auth/jwt-auth.guard.ts)
  │ Reads Bearer token or cookie, verifies JWT signature.
  │ Loads User & Student records.
  │ Enters AsyncLocalStorage via AuditContextStorage.enterWith({
  │   userId: user?.id,
  │   clientIp: req.ip,
  │   requestId: req.headers['x-request-id'] || randomUUID()
  │ })
  ▼
RoutePolicyGuard (apps/api/src/auth/route-policy.guard.ts)
  │ Deny-by-default global guard.
  │ Reads @Public() or @Roles(...UserRole[]).
  │ If neither is declared -> throws 500 INTERNAL_ERROR (Route policy metadata missing).
  │ If not public and user missing -> throws 401 UNAUTHENTICATED.
  │ If role not included -> throws 403 FORBIDDEN.
  ▼
ZodValidationPipe / Custom Pipes
  │ Parses body, query, or params against strict Zod schemas (.strict()).
  │ Unknown keys are rejected with 400 BAD_REQUEST.
  ▼
Controller & Service
  │ Invokes business logic.
  │ Enforces ownership: assertOwns(student.userId === currentUser.id).
  ▼
PrismaService Extended Client (apps/api/src/prisma/prisma.service.ts)
  │ Intercepts write operations (create, update, delete, upsert, raw writes).
  │ Validates presence of audit context (throws in non-test environments if missing).
  │ Runs write inside a transaction and sets transaction-local session configs:
  │   SELECT set_config('app.user_id', $1, true),
  │          set_config('app.client_ip', $2, true),
  │          set_config('app.request_id', $3, true)
  ▼
PostgreSQL Triggers (docs/db/0001_baseline.sql)
  │ Triggers capture BEFORE/AFTER changes into immutable audit_log.
```

### System Escape Hatch (`runAsSystem`)
When background jobs, seeds, or system processes run without an active HTTP session, they must invoke `PrismaService.runAsSystem(label, callback)`:
```typescript
await prisma.runAsSystem('scheduled_reminder', async (client) => {
  // Sets userId to '', clientIp to '127.0.0.1', writes an auditLog entry with eventType 'system.scheduled_reminder',
  // and executes the callback within that attribution context.
});
```

---

## 4. Database Schema & Enforcements

### Model & Table Catalog

The schema in `apps/api/prisma/schema.prisma` was introspected from the raw SQL baseline (`docs/db/0001_baseline.sql`).

> [!WARNING]
> **Prisma Model Naming Gotcha**:
> Models use mixed casing:
> - **PascalCase models**: `User` (`@@map("users")`), `Student` (`@@map("students")`), `School` (`@@map("schools")`), `RecordClass` (`@@map("record_classes")`), `ActivityType` (`@@map("activity_types")`), `AuditLog` (`@@map("audit_log")`).
> - **lowercase models**: `activities`, `participations`, `attendances`, `certificates`, `community_partners`, `documents`, `notifications`, `sessions`, `consents`, `email_tokens`, `activity_reports`, `raw_migrations`.
> - **Field casing**: Some fields are camelCase (`passwordHash`, `canApprove`, `isActive`, `createdAt`), while others are snake_case (`email_verified_at`, `must_change_password`, `failed_login_count`, `locked_until`, `retention_years`).
> Always inspect `apps/api/prisma/schema.prisma` before writing Prisma queries.

### Enums
- `UserRole`: `STUDENT`, `STAFF`, `MANAGEMENT`, `ADMIN`
- `activity_status`: `DRAFT`, `PUBLISHED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `attendance_method`: `QR_SELF`, `MANUAL_STAFF`
- `certificate_status`: `ISSUED`, `REVOKED`
- `document_status`: `ACTIVE`, `DISPOSED`, `RETENTION_LOCKED`
- `participation_status`: `REGISTERED`, `CANCELLED`, `ATTENDED`, `ABSENT`

### Database-Enforced Invariants
1. **Append-Only Audit Log**:
   - `trg_audit_chain`: BEFORE INSERT serializes writes using `pg_advisory_xact_lock(7001)` and computes the SHA-256 hash chain over `(prev_hash, occurred_at, source, event_type, table_name, record_id, operation, old_data, new_data, actor_user_id)`.
   - `trg_audit_no_mutation`: BEFORE UPDATE OR DELETE triggers an uncatchable exception.
   - `trg_audit_no_truncate`: BEFORE TRUNCATE triggers an exception.
2. **Audit Grants for `svc_app`**:
   - Least-privilege role `svc_app` has `SELECT` and `INSERT` on `audit_log`, but NO `UPDATE`, `DELETE`, or `TRUNCATE` permissions.
3. **Certificate Edit-Lock**:
   - `trg_lock_participations` and `trg_lock_attendances`: BEFORE UPDATE OR DELETE prevents modifying participation or attendance records once a certificate is in `ISSUED` status.
4. **Partial Unique Indexes**:
   - `ux_certificates_one_active`: `UNIQUE (participation_id) WHERE status = 'ISSUED'`.
   - `ix_notifications_user_unread`: `(user_id, created_at DESC) WHERE read_at IS NULL`.
5. **CHECK Constraints**:
   - Email is lowercase: `email = lower(email)`.
   - Segregation of duties: `NOT can_approve OR role IN ('STAFF', 'ADMIN')`.
   - Activity publishing: `approved_by <> organizer_id`.

---

## 5. Implementation Recipes

### 1. Adding an Endpoint
File: `apps/api/src/activities/activities.controller.ts`
```typescript
import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserRole, ErrorCode } from '@svc-rms/shared';
import { assertOwns } from '../auth/ownership.js';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod.pipe.js';

const updateSchema = z.object({
  title: z.string().min(3).max(255),
}).strict();

@Controller('activities')
export class ActivitiesController {
  @Post(':id')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSchema)) dto: z.infer<typeof updateSchema>,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    // Ownership or authorization assertions return 404 to avoid IDOR leaks
    assertOwns(user.role === UserRole.ADMIN || user.id === activity.organizer_id);
    return this.service.update(id, dto);
  }
}
```

### 2. Adding a Raw SQL Migration
Migrations are forward-only and live in `docs/db/`.
File: `docs/db/0003_example_change.sql`
- Never edit existing applied migrations (`0001_baseline.sql`, `0002_grants.sql`).
- Apply via `pnpm db:migrate` (executes as database owner using `DATABASE_URL_MIGRATE`).

### 3. Adding an Integration Test
File: `apps/api/test/activities/req-act.test.ts`
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../helpers/app.js';
import { createUser, createActivity, getAuthHeaders } from '../helpers/index.js';
import { UserRole } from '@svc-rms/shared';
import request from 'supertest';

describe('REQ-ACT-01: Activity Creation', () => {
  it('REQ-ACT-01: staff member creates a valid draft activity', async () => {
    const app = await createTestApp();
    const staff = await createUser({ role: UserRole.STAFF });
    const headers = await getAuthHeaders(staff);

    const res = await request(app.getHttpServer())
      .post('/api/v1/activities')
      .set(headers)
      .send({ title: 'Campus Clean-up', capacity: 50, service_hours: 4 });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Campus Clean-up');
  });
});
```

### 4. Writing an Audit Event
File: `apps/api/src/audit/audit-events.service.ts`
```typescript
@Injectable()
export class AuditEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(eventType: string, details?: Record<string, unknown>): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        source: 'APP',
        eventType,
        newData: details ? (details as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
```

### 5. Dispatching a Notification
File: `apps/api/src/notifications/notifications.service.ts`
```typescript
await this.notificationsService.notify(
  student.userId,
  'Activity Published',
  'A new activity matching your interests is now open for registration.',
  `/activities/${activity.id}`,
);
```

### 6. Calling API from Frontend
File: `apps/web/src/app/my/activities/page.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { RoleGate } from '@/lib/auth';
import { UserRole } from '@svc-rms/shared';

export default function MyActivitiesPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<any[]>('/participations/me').then(setItems).catch(console.error);
  }, []);

  return (
    <RoleGate roles={[UserRole.STUDENT]}>
      <div>{items.map((item) => <div key={item.id}>{item.activity.title}</div>)}</div>
    </RoleGate>
  );
}
```

---

## 6. Coding Conventions & Invariants

1. **ESM Imports**: All relative import paths in TypeScript must include the `.js` file extension (e.g. `import { PrismaService } from '../prisma/prisma.service.js'`).
2. **Error Responses**: All API errors conform to RFC 9457 `application/problem+json` using standard codes defined in `packages/shared/src/errors.ts` (`ErrorCode`).
3. **No Concatenated SQL**: Writes must use Prisma delegates or `$executeRaw` / `$executeRawUnsafe`. Tagged `$queryRaw` is permitted for complex queries with row locks (`SELECT ... FOR UPDATE`), but NEVER string concatenation.
4. **Zod Strictness**: Always append `.strict()` to request body schemas to disallow unknown parameter injection.
5. **No Database Mocking**: All tests must run against real PostgreSQL instances. Do not mock Prisma or database queries.

---

## 7. Critical Gotchas Observed

1. **Node.js Ed25519 Signatures**:
   In Node.js, Ed25519 is an Edwards-curve signature algorithm without separate digest calculation. Calling `createSign('Ed25519')` throws `Error: Digest method not supported`.
   - **Correct**: Use `crypto.sign(null, dataBuffer, privateKey)` and `crypto.verify(null, dataBuffer, publicKey, signatureBuffer)`.
2. **Fastify Plugin Registration**:
   `@fastify/cookie` and `@fastify/multipart` must be registered on the Fastify instance in `main.ts` before route invocation.
3. **Quoting Secrets in YAML**:
   In Docker Compose or CI YAML, pure numeric strings (e.g. `01234567890123456789`) parse as integers. Always quote secret values.
4. **Prisma Client Pre-generation**:
   `prisma generate` must run prior to `tsc --noEmit`. The root `pnpm install` handles this via workspace `postinstall`.
5. **Database Isolation in Tests**:
   Parallel test workers must execute against separate database names (`svc_<area>`) to avoid lock collisions on the advisory lock `pg_advisory_xact_lock(7001)`.

---

## 8. Definition of Done (DoD)

Before declaring any slice or feature complete:
- [ ] Every requirement ID appears in test descriptions (`describe('REQ-XYZ-01', ...)`).
- [ ] Tests verify database state mutations, not just HTTP response codes.
- [ ] `pnpm typecheck` passes with zero errors across all workspaces.
- [ ] `pnpm lint` passes with zero errors and zero warnings.
- [ ] `pnpm trace:check` confirms all requirement IDs have matching tests.
- [ ] `pnpm audit:verify` verifies cryptographic hash-chain integrity.
- [ ] No real personal data exists in fixtures, seeds, or mock files.
- [ ] No secrets are committed to the repository.

---

## 9. Gap Tracking

Refer to:
- `docs/slices.json`: Tracks completion status for slices S0 through S6.
- `docs/KNOWN-GAPS.md` (when created): High-level operational and feature punch list.

---
Verified against commit 2909e9d
