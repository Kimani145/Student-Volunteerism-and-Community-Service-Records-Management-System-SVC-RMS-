# Phase 5: Frontend Build, Browser QA, and Bug Tracking

## 1. Assumptions
1. **Ports and Network**: API server runs on `http://localhost:3001` (proxied by Next.js via `/api/:path*` rewrite on `http://localhost:3000`).
2. **Authentication State**: Access token is stored in memory via `_accessToken` in `api-client.ts`, with refresh token in HttpOnly `Secure; SameSite=Lax` cookie at `/api/v1/auth`. Initial user load checks `GET /api/v1/auth/me`.
3. **QR Scanning vs Manual Code**: In the browser test environment where a real camera is unavailable, QR check-in flows are validated using the 10-character alphanumeric manual code entry path (REQ-ATT-06).
4. **Seed Credentials**: Synthetic test accounts are seeded with known credentials (`admin@example.test`, `staff.approver@example.test`, `staff.member@example.test`, `management@example.test`, `student1@example.test`), all using `Password123!`.
5. **Frozen Files Rule**: Kept strict compliance with `AGENTS.md` frozen files list (`package.json`, `pnpm-lock.yaml`, `schema.prisma`, existing migrations, `docs/slices.json`, `app.module.ts`, `packages/shared/src/index.ts`).
6. **Activity Selection on Check-In**: `/check-in` allows student to select their registered active activity or receive it via `?activity=<id>` query parameter, and submit the 10-character code.

## 2. Bug Tracker
| Bug ID | Screen / Journey | Severity | Status | Description | Reproduction | Resolution |
|---|---|---|---|---|---|---|
| BUG-001 | `/login`, All Pages | Blocker | Fixed | Missing `AuthProvider` in `RootLayout` caused prerender crash on client components calling `useAuth()`. | `pnpm --filter web build` | Created `Providers` component and wrapped layout body in `apps/web/src/app/layout.tsx`. |
| BUG-002 | Build / Modules | Blocker | Fixed | Relative `.js` extension imports in `apps/web` failed under Next.js Turbopack resolver. | `pnpm --filter web build` | Replaced relative `.js` imports in `login`, `register`, `admin/users`, `forgot-password`, `reset-password`, `verify-email`, `auth/index.tsx` with `@/lib/...` alias. |
| BUG-003 | Routing | Medium | Fixed | Directory typo `[id/]` inside `apps/web/src/app/staff/activities` caused invalid routing conflict. | `find apps/web/src/app -name "page.tsx"` | Removed accidental directory `apps/web/src/app/staff/activities/[id`. |
| BUG-004 | Seed / Auth | High | Fixed | `scripts/db-seed.mjs` seeded users with placeholder string `'seed_password_hash'` and unverified email, preventing login in browser. | Attempt login with seeded user | Updated `db-seed.mjs` with Argon2id hash of `Password123!` and `email_verified_at = NOW()`. |
