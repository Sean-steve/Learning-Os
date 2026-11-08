# Learning OS — Phase 6 Engineering / Local Certification

**Status:** PostgreSQL-backed account and browser-data synchronization implementation. **Not production certified.**

## What is delivered

- Backend stays **TypeScript + Bun**; no Laravel, no Supabase requirement.
- PostgreSQL 17-compatible migrations for `los_users`, `los_sessions`, and `los_records`.
- Opaque 256-bit session token hashed in PostgreSQL; HttpOnly SameSite=Lax cookie with 7-day expiry.
- Per-user ownership check on every record API request and `FORCE ROW LEVEL SECURITY` on the records table.
- `scrypt` password derivation with per-password random salt, constant-time check, registration/login/logout, rate control.
- Explicit-origin and `X-Learning-Intent` request header check on state-changing API calls.
- Bounded allowlist of local learning domains. Each record is versioned, and a stale revision returns HTTP 409.
- `/#account` account workspace. **Explicit user choice** to import browser records or restore server records; no automatic first-time upload.
- Existing pages and modules retain local-first behavior when API is offline. After opting into sync, relevant data changes are queued and saved to PostgreSQL, with manual conflict resolution.
- Same-origin Vite development proxy for `http://localhost:5173/api/v1/*` → Bun service `http://localhost:3005/v1/*`.
- CI: Node 22 unit and PostgreSQL integration tests; desktop/mobile browser checks with a Node test adapter using the same Fetch-based route handlers.
- Static GitHub Pages continues to deploy from `main` **without** bundling a database, password backend, API tokens, or OAuth secrets.

## Ubuntu setup (your existing PostgreSQL; no Docker required)

1. Ensure PostgreSQL is listening on `127.0.0.1:5432`. Check with `pg_isready -h 127.0.0.1 -p 5432`.
2. Provision a dedicated local account and database. Optional helper: `bash scripts/local-postgres.sh`. Its default password is for local development only; replace it before exposing any service.
3. Configure secrets **outside git** in a local `.env`/environment:
   ```env
   DATABASE_URL=postgres://learning_os:REPLACE_WITH_LOCAL_SECRET@127.0.0.1:5432/learning_os
   API_HOST=127.0.0.1
   API_PORT=3005
   WEB_ORIGIN=http://localhost:5173
   ```
4. Run:
   ```bash
   npm ci
   npm run db:migrate
   npm run dev:api      # separate terminal; requires Bun
   npm run dev          # local frontend via Vite
   ```
5. Open `http://localhost:5173/#account`, create a user (12+ character password). Choose **Restore cloud** for a fresh start or **Import this browser** if you explicitly want to upload existing local learning records.
6. Add goals, study sessions, notes and assessments; verify they appear in `los_records` and persist after refreshing/signing back in.
7. To run PostgreSQL tests, point `DATABASE_URL` at an **isolated test database** and run `npm run test:db`. CI automatically provisions an ephemeral Postgres 17 service.

## Security and limitations

- Browser storage is still used as a local cache. **Only use a trusted browser/device**, especially for sensitive journals. Sign-out clears synced browser cache and revokes the authenticated session.
- No self-service password reset, email verification, MFA, device management or external identity provider yet. Production release requires these and independent penetration testing.
- Session tokens are encrypted by HTTPS transport in production; localhost development permits insecure cookies. The frontend and backend should share a first-party HTTPS origin when deployed; cross-site third-party cookie workarounds are deliberately excluded.
- The app database role currently may also own the schema in local development. `FORCE ROW LEVEL SECURITY` provides a failsafe, but production should use distinct migration/admin and restricted app roles.
- Records are versioned JSONB documents keyed by module. This preserves module shapes without data loss, but normalized reporting/search, per-entity mutations, backups, and audit retention are separate hardening tasks.
- Conflict handling requires explicit user selection, not an automatic last-write-wins overwrite.
- Browser-based reminders are still foreground-only; Google Calendar OAuth, AI provider calls and mobile notification workflows remain separately configured and uncertified as live integrations.
- The GitHub Pages frontend cannot access a private laptop PostgreSQL server. It remains a public demo and local-first study tool until a secure HTTPS backend is deployed separately.

## Verification gates

`npm run check:phase6`, `npm run test:core`, `npm run typecheck`, `npm run build`, `npm run test:db`, all Playwright browser tests, and GitHub Pages build verification must pass before merge. Production readiness remains blocked by the missing operational and identity/security requirements listed above.
