# Learning OS — Phase 7.1 | Live Infrastructure & Identity Release Gate

## Decision: application hardening prepared; public live launch BLOCKED

Target: **TypeScript/Bun backend, private PostgreSQL 17, HTTPS reverse proxy**, React web UI. GitHub Pages stays a STATIC PREVIEW and never receives user passwords or an API key. No live host, domain, SSL certificate, transactional email provider or off-host backup destination has been supplied or provisioned in this phase. Do not claim otherwise.

### Delivered application controls
- RFC 6238 TOTP enrollment with encrypted secrets (AES-256-GCM) using `MFA_ENCRYPTION_KEY`, first-factor session required to initiate enrollment, password re-confirmation, one-time setup code.
- Eight random recovery codes, SHA-256 digests stored in PostgreSQL, one-time atomic consumption. Recovery codes shown exactly once after enrollment.
- MFA login challenge with HttpOnly SameSite=Strict cookie, short expiry, attempt lockout, no authenticated session until factor verified. OTP time-step replay prevention, explicit logout/session revocation.
- PostgreSQL-backed, shared login throttling by IP (120/15min) and account (12/15min). Users should be warned that abusive attempts can temporarily block sign-in.
- `AUTH_REQUIRE_MFA=true` denies record endpoints for accounts not enrolled; still permits limited first-factor login to enable an authenticator.
- `APP_ENV=production` server guards: HTTPS `WEB_ORIGIN`, loopback `API_HOST`, mandatory MFA enforcement and encryption key.
- Active sessions, password rotation, same-origin and CSRF intent, RLS and optimistic cross-device sync remain from Phases 6–7.

### Deployment blueprint — NOT executed
1. Provision Linux host, DNS, TLS with certificate renewal, private PostgreSQL, locked-down firewall, encrypted storage and least-privilege app/migration DB roles.
2. Create root-owned `/etc/learning-os/api.env` (0600), with `APP_ENV=production`, `AUTH_REQUIRE_MFA=true`, `MFA_ENCRYPTION_KEY` generated using `openssl rand -hex 32`, `DATABASE_URL`, `WEB_ORIGIN=https://<approved-host>`, `API_HOST=127.0.0.1`, `API_PORT=3005`. **Never commit values.** Keep encryption key in secure backup; rotation requires a migration strategy.
3. Install Node/Bun/PG clients, `npm ci`, separately run `npm run db:migrate` as migration owner, deploy Nginx `infra/nginx/learning-os.conf.example` after adjusting the real hostname/TLS paths, and start the non-root systemd service. The frontend must be built with `VITE_LEARNING_API_ENABLED=true` on the same host. GitHub Pages must not enable it.
4. Provide real transactional email for verified account ownership, password reset/recovery and notifications. **None is wired yet**. Consider a managed OIDC provider with MFA for public SaaS rather than relying solely on the current custom identity.
5. Provision encrypted off-host backups, a retention policy, automated alerts, log forwarding, time synchronization, certificate renewals, and perform a documented disposable restore drill.
6. Run `bash scripts/verify-live.sh https://<approved-host>`, independently verify registration, MFA login and recovery, revoked sessions, two physical devices and rollback. Complete `docs/release-evidence.example.json` as a private operator artifact; execute `RELEASE_EVIDENCE=<path> node scripts/check-release-evidence.mjs`.

### Production evidence — acceptance gates
| Gate | Verification | Current status |
| --- | --- | --- |
| DNS/HTTPS/TLS/HSTS | external HTTPS certificate and DNS check | NOT ACTIVATED |
| API and frontend | real Bun service, HTTPS reverse proxy, readiness/uptime logs | NOT ACTIVATED |
| PostgreSQL | dedicated host, least-privilege, migrations, tested RLS | CI ONLY |
| Strong identity | MFA login, recovery, throttling tests | CI IMPLEMENTED; public email verification/reset pending |
| Privacy & deletion | consent, export/delete support, retention policies | NOT CERTIFIED |
| Backup & restore | encrypted off-host copy, timed recovery drill and RPO/RTO | NOT VERIFIED LIVE |
| Observability | error/latency, uptime, intrusion alerts, on-call and incident drill | NOT ACTIVATED |
| Multi-device | real remote HTTPS devices, revocation and conflict workflow | CI SIMULATED |
| Security review | dependency audit, independent pentest, MFA/CSRF threat test | NOT CERTIFIED |
| Public release | owner approval after all evidence | BLOCKED |

### Local test
```bash
# Local test values must be kept outside Git; use dedicated passwords.
export DATABASE_URL='postgres://learning_os_app:YOUR_LOCAL_SECRET@127.0.0.1:5432/learning_os'
export MIGRATION_DATABASE_URL='postgres://learning_os_owner:YOUR_MIGRATION_SECRET@127.0.0.1:5432/learning_os'
export WEB_ORIGIN=http://localhost:5173
export API_HOST=127.0.0.1
export MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
npm ci
npm run db:migrate
npm run test:db
npm run dev:api
# Other terminal: npm run dev
```
The local user must be able to read/write the identity tables. Production must use separate migration and restricted app accounts; never use a superuser for requests.

**Do not enable PUBLIC registration on a production host** until transactional email verification/reset, monitoring, recovery controls and all mandatory release evidence have passed.
