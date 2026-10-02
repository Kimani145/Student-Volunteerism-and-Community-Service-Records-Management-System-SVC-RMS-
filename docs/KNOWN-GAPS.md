# SVC-RMS Known Gaps & Requirement Status

This document records the current status of requirements across SVC-RMS following the completion of Phases 1–4 and entering Phase 5.

## 1. Verified & Implemented Requirements
The test suite (`apps/api/test/`) verifies the following requirements against PostgreSQL with strict assertions:

- **AUTH (Authentication & Identity)**:
  - `REQ-AUTH-01`: Email/password registration with student domain validation.
  - `REQ-AUTH-02`: Email verification token generation, expiration, and single-use.
  - `REQ-AUTH-03`: Argon2id password verification, uniform error timing/messages for unknown user vs invalid password.
  - `REQ-AUTH-04`: JWT access tokens and rotating refresh tokens with reuse detection.
  - `REQ-AUTH-05`: Account lockout (5 consecutive failed attempts) per-account without IP denial-of-service.
  - `REQ-AUTH-06`: Password reset token lifecycle and invalidation on use.
  - `REQ-AUTH-07`: Global deny-by-default route enforcement (`@Roles` or `@Public`).
  - `REQ-AUTH-08`: Ownership and tenant isolation (`assertOwns()`), returning 404 on foreign student objects.
  - `REQ-AUTH-09`: Admin user management: account creation, role assignment, deactivation, and self-deactivation prevention for the last active ADMIN.
  - `REQ-AUTH-10`: Immediate session invalidation upon deactivation.

- **ACT & REG (Activities & Registration)**:
  - `REQ-ACT-01` through `REQ-ACT-08`: Activity lifecycle, approval constraints (approver cannot be organizer), date validations, status transitions, pagination, and search filters.
  - `REQ-REG-01` through `REQ-REG-05`: Registration rules, eligibility checks (`year_of_study` matching `eligible_years`), schedule overlap detection via advisory locks, 200-parallel capacity race condition (strictly capped), re-registration reactivation after cancellation, cancellation window enforcement (`before start_at`).
  - `REQ-STU-03`, `REQ-STU-04`: Student participation history and hours aggregation.

- **ATT (Attendance & Verification)**:
  - `REQ-ATT-01` through `REQ-ATT-06`: Rotating HMAC-SHA256 tokens, timing-safe verification, coordinator live check-in monitoring, manual 10-character code entry, automated transition of remaining registered participants to `ABSENT` upon `COMPLETED`.

- **CRT (Certificates & Cryptography)**:
  - `REQ-CRT-01` through `REQ-CRT-09`: Ed25519 digital signature of canonical JSON, Crockford Base32 CVID generation, lazy vector PDF rendering, public verification endpoint without PII leakage, tamper detection.

- **AUD & PRIV (Audit & Privacy)**:
  - `REQ-AUD-01` through `REQ-AUD-04`: Immutable append-only audit trail, SHA-256 hash chaining, context-bound actor attribution, tamper detection via `audit:verify`.
  - `REQ-PRIV-01`, `REQ-PRIV-02`: Explicit consent tracking with versioning, optional privacy fields.
  - `REQ-PRIV-05`: Strict redaction of secrets, tokens, and authorization headers in structured logs.

- **REC, RPT, NTF (Records, Reports, Notifications)**:
  - `REQ-REC-01` through `REQ-REC-05`: Magic bytes validation for uploads, streamed SHA-256 calculation, metadata preservation on disposal.
  - `REQ-RPT-01` through `REQ-RPT-05`: Aggregated reporting without student PII exposure, formula injection neutralizing CSV export.
  - `REQ-NTF-01`: Notification service dispatching transactional events.

## 2. Known Gaps & Deferred Items

1. **REC-06 (Disposal Schedule Execution)**:
   - *Status*: Optional per SRS S5 scope notes ("REC-06 and REC-08 only if time permits").
   - *Detail*: Automated cron/batch job to trigger retention policy disposals for expired record classes. Manual disposal API exists.

2. **REC-08 (Cold Storage / Batch Archive Export)**:
   - *Status*: Optional per SRS S5 scope notes.
   - *Detail*: Bulk S3/archive batch export for compliance handoff.

3. **OPS-02 (Performance & Stress Drill with k6)**:
   - *Status*: Scheduled for S6 Hardening.
   - *Detail*: Performance drill scripts (`ops/perf/`) verifying p95 latency under high concurrency.

4. **UI-03 (Automated Accessibility / axe-core Auditing)**:
   - *Status*: Scheduled for S6 Hardening.
   - *Detail*: Running full axe-core a11y automated sweeps across all frontend pages.

5. **`docs/slices.json` Synchronization**:
   - *Status*: Maintained as frozen.
   - *Detail*: Per the `AGENTS.md` Parallel Rules ("The following files are strictly frozen during the parallel build wave... docs/slices.json"), `docs/slices.json` was kept unchanged so as not to break parallel workspace contracts, while the test harness and `trace:check` enforce S0 requirements and the comprehensive test suite validates all subsequent requirement IDs.
