# Browser QA Report (Phase 6)

## 1. Methodology
- **Browser:** Chromium via Playwright / Chrome DevTools (browser_subagent)
- **Environment:** `localhost:3000` (Web) -> `localhost:3001` (API)
- **Coverage:** Tested across unauthenticated state and authenticated states (STUDENT, STAFF, ADMIN)
- **Scope:** Error states, UI/UX consistency, loading states, empty states, and role gating.

## 2. Tested Accounts
- **STUDENT:** `student1@example.test` / `Password123!`
- **STAFF (Approver):** `staff.approver@example.test` / `Password123!`
- **ADMIN:** `admin@example.test` / `Password123!`

## 3. Findings per Route

### A. Unauthenticated / Public
| Route | Status | Notes / Observations |
|---|---|---|
| `/login` | TBD | |
| `/register` | TBD | |
| `/verify/[cvid]` | TBD | |

### B. STUDENT Role (`student1@example.test`)
| Route | Status | Notes / Observations |
|---|---|---|
| `/activities` | TBD | |
| `/activities/[id]` | TBD | |
| `/check-in` | TBD | |
| `/my/history` | TBD | |
| `/my/certificates` | TBD | |

### C. STAFF Role (`staff.approver@example.test`)
| Route | Status | Notes / Observations |
|---|---|---|
| `/staff/activities` | TBD | |
| `/staff/activities/[id]/attendance` | TBD | |
| `/staff/partners` | TBD | |
| `/staff/records` | TBD | |
| `/staff/reports` | TBD | |
| `/staff/certificates` | TBD | |

### D. ADMIN Role (`admin@example.test`)
| Route | Status | Notes / Observations |
|---|---|---|
| `/admin/users` | TBD | |
| `/admin/audit` | TBD | |

## 4. UI/UX Consistency Checks
- [ ] `useApi` is handling errors properly
- [ ] Loading and Empty states are visually cohesive
- [ ] No uncaught promise rejections or console.error in normal flow
- [ ] Role gates enforce correct routing

*(This report will be populated post-QA run)*
