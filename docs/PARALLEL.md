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
