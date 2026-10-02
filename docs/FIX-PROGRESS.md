# SVC-RMS Fix Progress (branch: fix/ci-and-blockers)

Track progress of CI and blocker fixes as specified in the prompt.

## Phase 1: Make the test harness trustworthy
- [x] 1.1 ci.yml and copilot-setup-steps.yml: quote EVERY env value. In apps/api/test/test-env.ts assign secrets with `=` (not `??=`) so bad CI values cannot leak into tests.
- [x] 1.2 Add a vitest globalSetup (`apps/api/test/setup/global.ts`, owner connection) that idempotently inserts reference data with `ON CONFLICT DO NOTHING`: one school, activity_types (TREE_PLANTING, CLEANUP, OTHER), record_classes (ATTENDANCE_REGISTER, PHOTO with retention_years 7). Export the ids from a helper.
- [x] 1.3 Rewrite `test/helpers/factories.ts` against the REAL schema (read `schema.prisma` and `docs/db/0001_baseline.sql`): uppercase reg numbers like `TUK/<random>/2026`; `school_id` from the seeded school; `createActivity` with `type_id`, `venue`, `registration_closes_at`, `start_at`, `end_at`, `capacity`, `service_hours`, `organizer_id` and, for any status other than DRAFT or CANCELLED, `approved_by` (a different user) and `approved_at`. Add `createParticipation`, `createAttendance`, `createCertificate`. Fix `test/req-rec.test.ts` and every other test to use these factories.
- [x] 1.4 `common/problem-json.filter.ts`: log message and stack (never bodies or secrets) for every 5xx; map Prisma P2003 to 422 and malformed UUID path params to 422 (keep existing mappings). Registering with an unknown schoolId must return 422, not 500.
- [x] 1.5 Diagnose the register/login 500s and the REQ-NTF-01 401 from the new logs and fix the cause (report each).

## Phase 2: Runtime blockers
- [x] 2.1 `main.ts`: register `@fastify/cookie` and `@fastify/multipart` (fileSize = MAX_UPLOAD_BYTES, files: 1). Delete `records/multipart-parser.ts`. Stream uploads through `StorageService`, hash while streaming, 413 when too large, 415 when magic bytes (`file-type`) are not PDF/PNG/JPEG, per SRS REC-01. Test with a real multipart request.
- [x] 2.2 `signing/signing.service.ts`: sign with `crypto.sign(null, Buffer.from(canonical), privateKey)` and verify with `crypto.verify(null, …)`. Remove the `return true` stubs. Store signature consistently with BYTEA column and decode it when verifying. Test: change one character of stored payload and verification must fail (charter #12).
- [x] 2.3 `public/*`: map ISSUED to VALID (REVOKED stays), response keys exactly per SRS §7.3 (no registration number, school or contact), clear INVALID_SIGNATURE response, `GET /public/keys` listing every key id ever used. Keep 30/min throttle and `Cache-Control: no-store`. Update web verify page to match.
- [x] 2.4 Replace every `expect(true)` in `test/certificates/req-crt.test.ts` with real tests for CRT-01…09. Generate Ed25519 key at runtime and set env before creating app (CI uses placeholder key).
- [x] 2.5 Secrets and auth: remove hard-coded fallback secrets in `auth/jwt-auth.guard.ts` and `attendance/attendance.service.ts` (read validated env; fail closed); pin `jwtVerify` to algorithms `['HS256']`; add per-IP login throttle of 30 attempts per 10 minutes. Write real tests: REQ-AUTH-04 (rotation and reuse detection), REQ-AUTH-05 (account lockout; shared IP cannot lock other accounts), REQ-AUTH-06 (reset), REQ-AUTH-10 (deactivated user with live token gets 401).

## Phase 3: Activities, registration, attendance
- [x] 3.1 Call `markRemainingAsAbsent` from COMPLETED transition inside same transaction (ATT-04).
- [x] 3.2 `participations.service.ts`: re-registering after CANCELLED reactivates existing row (REG-04); add `eligible_years` check (NOT_ELIGIBLE 403); replace plain-message exceptions with stable codes from `packages/shared` (ALREADY_REGISTERED, CAPACITY_FULL, SCHEDULE_CONFLICT, REGISTRATION_CLOSED); cancellation only until `start_at`.
- [x] 3.2b `activities.service.ts`: approver and organizer violations return 403; wrap transitions in a transaction; validate dates on update; add pagination and filters (type, date range, text) to list.
- [x] 3.3 attendance: 0 <= hours <= service_hours; unknown participation id returns 404; unknown activity returns 404 (not 409); never store submitted token in `audit_log`.
- [x] 3.4 Write real tests: REQ-ACT-01…05, 07, 08; REQ-REG-01…04 including 200-parallel capacity race (capacity 50: exactly 50 succeed) and double-booking race with real parallel requests; REQ-ATT-04, 06; REQ-STU-03.

## Phase 4: Gates and cleanup
- [x] 4.1 IDOR sweep test (SRS §9.3 #1): enumerate every route with an `:id` param (use router, not hand-written list) and call it as another student, with a random UUID, and with a malformed id (expect 404, 404, 422). Add mass-assignment test (extra keys on every write return 422, charter #11).
- [x] 4.2 Real tests for REQ-AUTH-08, 09; REQ-PRIV-01, 02, 05; REQ-AUD-03 (audit events written by auth, attendance, certificates and records).
- [x] 4.3 `docs/slices.json`: preserved frozen per Parallel Rules. Deleted `test-fastify.ts`. Written `docs/KNOWN-GAPS.md` listing every requirement not done, partial or untested.
- [x] 4.4 Final: confirmed local test & check pipeline is fully green: lint, typecheck, prisma validate, test, audit:verify, trace:check, pnpm audit.
