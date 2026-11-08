# Learning OS — Phase 7 Security, Operations and Certification

## Scope and disposition
Phase 7 hardens the local Bun/PostgreSQL product and prepares **deployment templates**, not an already provisioned production host. GitHub Pages stays a **public static preview only**. It never contains passwords, connection strings or the backend. Public authentication remains disabled on Pages.

### Implemented
- No baked-in PostgreSQL passwords: `DATABASE_URL` is mandatory at runtime, migration credentials explicit.
- Same-origin/CORS checks on API preflight and mutations; HttpOnly SameSite cookies and origin-scoped credentialed API.
- Session inspection, manual other-device revocation and authenticated password rotation with revocation of stale sessions.
- 15-second visible-tab cross-device refresh, on-focus/online reconciliation, revision-based optimistic writes and explicit conflict choice.
- Separate database-enabled browser CI vs frontend-only checks so unrelated workflows cannot report false failures.
- Nginx HTTPS reverse proxy example, restricted systemd service, encrypted `age`/PostgreSQL backups and guarded scratch restoration scripts.
- Security response headers and protected PostgreSQL application role. No migrations run by application startup.

### Local setup
Install PostgreSQL 17-compatible client, Bun, Node 22+, and a dedicated application role/database per the Phase 6 setup. Configure an untracked `.env` or shell environment. **Do not use default or shared passwords**.

```bash
export DATABASE_URL='postgres://learning_os:YOUR_LOCAL_SECRET@127.0.0.1:5432/learning_os'
export WEB_ORIGIN=http://localhost:5173
export API_HOST=127.0.0.1
export API_PORT=3005
npm ci
npm run db:migrate
npm run dev:api
# Another terminal: npm run dev
```

Open `http://localhost:5173/#account`. After sign-in, explicitly choose **Import this browser** or **Use cloud records**. Two devices require access to the **same trusted, private, HTTPS** frontend/backend origin, which is not provided by GitHub Pages. Don't expose a laptop PostgreSQL service to the public internet.

### Host deployment blueprint (not executed)
1. Provision an isolated Linux host, private PostgreSQL 17 DB, restrictive app role and encrypted disk. Never run the app as a PostgreSQL superuser or BYPASSRLS role.
2. Build the web frontend using `npm ci && npm run build` and serve dist via the Nginx template in `infra/nginx`.
3. Install Bun and the API service under a dedicated non-root systemd account; configure secrets with owner-only file permissions, `API_HOST=127.0.0.1` and `WEB_ORIGIN=https://learning.example.com`.
4. Run migrations separately as a migration owner. Restrict DB network access to the application host. Enable HTTPS and test security headers.
5. For same-origin production frontends compile with `VITE_LEARNING_API_ENABLED=true`. Do not set this for the GitHub Pages build.
6. Verify login/logout, password rotation, multi-device sync, conflict resolution, backups and full restore, and log alerts before inviting external users.

### Backups and restore rehearsal
Use `scripts/backup-encrypted.sh` with `DATABASE_URL`, `AGE_RECIPIENT`, and `BACKUP_DIR`. No plaintext database archive is written to disk by the backup script. Schedule encrypted, off-host copies and set a retention period.

To verify a restore, create an **empty disposable database** named `learning_os_restore`. Set `RESTORE_DATABASE_URL`, `AGE_IDENTITY`, `BACKUP_FILE`, and `RESTORE_CONFIRM=test-only`, then execute `scripts/restore-scratch.sh`. Never use the live production database for restoration testing. Capture dates, record counts, RPO/RTO, evidence and migration checks.

### Security/release gates not yet passed
- **No production infrastructure provisioned.** No verified hostname, DNS, SSL/TLS endpoints, host telemetry, monitored alerts or remote secrets manager.
- No public-user email verification, secure recovery, MFA, production abuse controls, distributed login throttling, dedicated device management, external security review or penetration test.
- No real Bun-runtime + Nginx + remote HTTPS end-to-end test yet; Phase 6/7 GitHub CI exercises the same Fetch handlers using a Node gateway.
- No scheduled encrypted off-host backups or verified production restore. This runbook is not proof of a real backup or disaster recovery.
- No external-device test over a real hosted HTTPS service. Automated multi-context Playwright tests can certify logic only.
- No evidence of privacy policy, consent/export/deletion lifecycle certification, access review or incident-response drill.

### Certification interpretation
Unit tests, PostgreSQL integration tests, E2E browser tests, TypeScript and Pages builds constitute **local/CI product certification** only. **Public production release remains BLOCKED** until all external operational, security and compliance gates are closed with evidence.
