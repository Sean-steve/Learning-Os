# Learning OS — Phase 4: Smart Scheduling, Google Calendar, Reminders & Accountability

## What is delivered

- The existing **Schedule** (`/#calendar`) and **Accountability** (`/#accountability`) pages use a shared, reactive Phase 4 scheduling experience.
- Create/remove/complete study sessions; a rolling seven-day view; schedule limits, overlapping-session detection, protected quiet hours, protected Sunday rest day, collision checks against an optional Google free/busy feed, and safe rescheduling **proposals requiring explicit approval**.
- Manual per-event Google Calendar deep links and downloadable RFC5545 `.ics` with optional popup reminders. Neither sends credentials to Pages.
- Permission-based browser notifications during a live/open tab only. No service worker, OS background task or notification guarantee when tab is closed.
- LocalStorage persists schedule/settings and informs other same-origin tabs (not cross-device sync). Analytics distinguish attendance from skill mastery.
- Optional **local-only** Bun Google Calendar OAuth 2.0 integration with short-lived state, PKCE challenge, `HttpOnly; SameSite=Lax` cookies, server-only credentials and in-memory token cache. Explicitly invoked `freeBusy` reads and idempotent create/update of an individual event. No batch pushes, no event deletion or background sync. Disconnect clears local session and attempts refresh-token revocation.
- Rules-based accountability guidance is the offline fallback. It does not masquerade as an AI-generated judgment. An optional explicit private OpenAI check-in endpoint runs on Bun *only on loopback* when `OPENAI_API_KEY` is configured; it receives numbers only, never event titles or journals. Production rollout requires user identity and rate limiting.

## Calendar OAuth configuration — local Ubuntu development only

Google Calendar OAuth is **disabled by default**. Your ChatGPT Google Calendar connection **does not connect** Learning OS.

1. Enable **Google Calendar API** in your own Google Cloud project.
2. Configure an OAuth consent screen (test users for development) and register a **Web application** client.
3. Register the exact authorized redirect URI `http://localhost:3005/v1/google/callback`.
4. Put secrets in `services/api/.env.local` or your uncommitted local environment, **never** in Vite environment variables, GitHub or the Pages workflow.
5. Use `WEB_ORIGIN=http://localhost:5173`, `API_HOST=127.0.0.1`, `VITE_LEARNING_API_URL=http://localhost:3005`, `GOOGLE_CALENDAR_LOCAL_ENABLED=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:3005/v1/google/callback`.
6. Start the private API with `bun run dev:api` (loads env yourself), then `npm run dev`, and use **Connect Google · local Bun** in Schedule. Confirm permissions yourself in Google's consent screen.
7. Refresh the week’s busy intervals before looking for alternative study times. Push a session individually with its Google icon. Browser/client changes are not automatically propagated to Google.

Only loopback execution is allowed. OAuth state and access/refresh tokens are held solely in server memory; restart **disconnects** the session. `X-Learning-Intent` and strict `Origin` checks protect mutations. Nonproduction integration: before real SaaS users, add OIDC identity, per-user encrypted token storage, revocation/rotation, session-level anti-CSRF tied to identity, audit logging, webhook reconciliation, and a reviewed Google OAuth verification process.

## Pages deploy

`GITHUB_PAGES=true npm run build` creates static content with base `/Learning-Os/`. The Pages version runs the **offline planner, local reminders, `.ics` exports and manual Google Calendar links**. The Bun service is **not deployed** to GitHub Pages. Protected endpoints must not be exposed without user identity and production security.

## Validation

- `npm ci`
- `npm run check:phase4`
- `npm run test:core` (previous learning/media + new schedule and Google payload tests)
- `npm run typecheck`
- `npm run build`
- `GITHUB_PAGES=true npm run build && node scripts/check-pages.mjs`
- `npx playwright install --with-deps chromium && npm run test:e2e` (desktop/mobile suite)
- Bun Google APIs need live credentials, separate network runtime tests, and formal identity review; do **not** claim a real OAuth grant has been verified without this evidence.

### Known limits

- No Google events are created automatically by opening Pages or this calendar UI.
- Google busy/availability only exists after successful explicit local OAuth connection and refresh.
- The user's ChatGPT-linked calendar and this standalone web app are separate authorizations.
- Browser time zone controls actual event timestamps; if user selects a different display timezone, verify the machine settings before export.
- Completion and adherence are behavioral metrics, not verified competence. Avoid shaming users or sacrificing sleep to maintain streaks.
