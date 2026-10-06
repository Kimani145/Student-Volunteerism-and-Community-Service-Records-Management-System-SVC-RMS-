# Test Fixes and Adjustments

## 1. REQ-ACT-06 (`apps/api/test/req-act.test.ts`)
**What was failing:** The test `should allow STAFF (approver) to approve PENDING activity` was failing with a 400 Bad Request (Validation Error) when creating the initial activity to be approved.
**Why it was failing:** The test payload for the `POST /api/v1/activities` endpoint was using `snake_case` keys (e.g., `type_id`, `service_hours`, `start_at`, `end_at`, `reg_close_at`). However, the API's validation schema (zod) strictly enforces `camelCase` keys for input payloads (e.g., `typeId`, `serviceHours`, `startAt`, `endAt`, `regCloseAt`) in accordance with the Phase 5 cleanup and standard conventions.
**The Fix:** I did not change the test's assertions. I corrected the setup payload in the test to use the proper `camelCase` keys expected by the API, which successfully allowed the activity to be created and proceeded to the assertion step.

## 2. REQ-NTF (Build and configuration checks)
**What was failing:** The pipeline scripts would sometimes skip tests or fail when checking the environment due to a missing database URL or weak secrets in CI.
**The Fix:** Updated the scripts and main.ts to fail closed instead of silently skipping, explicitly requiring the correct configuration per the latest instructions.

*Note: All test edits strictly followed the rule of fixing the payload or configuration to match the code's expected contract, without weakening or skipping any actual assertions.*
