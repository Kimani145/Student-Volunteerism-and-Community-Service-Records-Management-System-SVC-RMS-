# Deploying SVC-RMS (Render API + Vercel web + hosted Postgres)

Never load real student data until the university has approved the hosting location. Render/Neon regions are outside Kenya
(SRS Appendix A-05 treats Kenyan hosting as a preference, not a legal requirement; the university decides).

## 1. Database
Create a Postgres 16 database (Render or Neon). Copy the **external owner** connection string (add `?sslmode=require` if missing).

```bash
export DATABASE_URL_MIGRATE='<owner connection string>'
pnpm db:migrate
SVC_APP_PASSWORD='<long random password>' bash ops/db-init.sh     # creates the least-privilege svc_app role
```
If role creation is refused by your provider, note it: using the owner URL as `DATABASE_URL` works but removes the database-level
protection of the append-only audit log.

## 2. First admin (and optional demo accounts)
`db:seed` is blocked in production on purpose. Use the bootstrap script:

```bash
pnpm db:bootstrap --admin-email you@example.org --schools "School of A;School of B"
# staging/demo only: also create staff, management and 3 student accounts, each with its own random password
pnpm db:bootstrap --admin-email you@example.org --demo-users
# rotate or unlock accounts later
pnpm db:bootstrap --admin-email you@example.org --demo-users --reset-password
```
Passwords are printed once. `--demo-password '<pw>'` gives all demo accounts one shared password (private/staging sites only).

## 3. API on Render
Create a Blueprint from `render.yaml`. Fill every `sync: false` variable:
- `DATABASE_URL`: the `svc_app` URL (internal host, `sslmode=require`).
- `CERT_SIGNING_PRIVATE_KEY` / `CERT_SIGNING_KEY_ID`: run `node apps/api/src/scripts/gen-cert-key.mjs`.
- `PUBLIC_WEB_ORIGIN`: the Vercel URL. `ALLOWED_STUDENT_EMAIL_DOMAINS`: the real student email domain. `SMTP_URL`, `MAIL_FROM`: a working mail service
  (email verification and password reset depend on it). `SIGNATORY_*`: real names and titles.
- The disk (`/var/data`) stores uploaded records and cached certificate PDFs; it needs a paid plan. Without it they are lost on every deploy.

Check `https://<api>.onrender.com/api/v1/healthz`.

## 4. Web on Vercel
Import the repo, set **Root Directory** to `apps/web` (keep "include source files outside the root directory" on) and set
`API_ORIGIN=https://<api>.onrender.com`. `API_ORIGIN` is read at build time: redeploy after changing it.

## 5. Smoke test
Log in as the admin, create a staff user, run the demo path in `docs/SRS.md` section 10, open a certificate's public verify link logged out.

## Known limits
`must_change_password` is stored but not yet enforced at login: rotate the bootstrap password after first login.
`trustProxy` is on, so a client reaching the API's public URL directly can spoof its IP (rate limits, audit IP). Acceptable for a demo only.
