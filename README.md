# Learning OS · Phase 1

An audio-first, goal-driven learning workspace. **React + TypeScript** frontend; **Bun + TypeScript** backend foundation; planned **local PostgreSQL** persistence in a later phase.

## Quick start (Ubuntu)

Requirements: Node.js 20+ and npm; Bun is optional for Phase 1 backend health check.

```bash
unzip learning-os-phase1.zip
cd learning-os-phase1
npm install
npm run dev
```

Open **http://localhost:5173**.

If Bun is installed, in another terminal:

```bash
npm run dev:api
curl http://localhost:3005/health
```

The API returns a health response only. **Phase 1 runs without the API**; the UI is a local prototype.

Optional checks after `npm install`:

```bash
npm run typecheck
npm run build
npm run check:phase1
```

## What exists

- 18 responsive route screens, navigable from the sidebar or global search.
- Day-one dashboard and goal/program roadmap.
- Three-step curriculum-planning wizard (deterministic preview; no live AI).
- Saved source URLs with clear ingestion/review status (no transcript scraping).
- Text-to-speech player for original sample lesson text.
- PDF in-browser preview (local file, not uploaded).
- Calendar with editable local study sessions and completion tracking.
- Focus timer, dream/practice journal, lesson notes, short assessment.
- Analytics computed from recorded completions; no fabricated metrics.
- Scripted coach preview, accountability settings, HOS/integration placeholders.
- LocalStorage persistence for prototype changes.
- TypeScript contracts and Bun health endpoint for future backend work.

## Important limitations

**This is not production-ready and is not connected to your GitHub, PostgreSQL, YouTube, Google Calendar, or OpenAI account.** It also has no authentication, backups, cloud sync, payment functionality, or actual content-ingestion service. The current coach uses **scripted responses**, not a model. Clearing browser storage deletes saved prototype changes. The sample learning curriculum is illustrative and does not guarantee lucid dreaming, astral projection, or psychic capabilities.

**Do not store sensitive health, family or financial information in this prototype.** Browser local storage is not secured server persistence.

## Architecture

```
learning-os/
  apps/web/             React 19 + Vite + TypeScript
  services/api/         Bun + TypeScript (health + metadata only)
  packages/contracts/   Shared domain types
  docs/                 Phase 1 inventory, acceptance, future roadmap
  scripts/              Dependency-free consistency checks
```

Backend direction has been updated from the original Laravel suggestion to **Bun/TypeScript**, aligned with HOS. Add PostgreSQL and RBAC in the backend phase. TanStack Start compatibility can be evaluated at the integration boundary; Phase 1 itself does not require TanStack Start.

## Development workflow

Use `feature/learning-os-phase-1` when publishing to a new GitHub repository. The user's connected GitHub account did not expose a Learning OS repository at the time this package was created. Review and commit before merging.

## Quick visual reference

Open `preview.html` as a **static** dashboard preview. It does not run the React interactions. The actual UI requires the `npm install` + `npm run dev` steps above.

## Phase 1.1 — Verified frontend UI

Source has been imported into GitHub and the Node 22 / Playwright pipeline verifies
all 18 routes on Chromium desktop and mobile. See
[Phase 1.1 Certification](docs/PHASE-1.1-CERTIFICATION.md).

```bash
npm ci
npm run check:phase1
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The UI still uses demo lessons and browser-local data. Postgres, AI and Calendar
app integration belong to later phases.

## Phase 2 — Knowledge and Intelligent Planning

- Generate 30/60/90/180-day curricula with an audio-first split, rest days and milestone gates.
- Paste transcripts or import local text-based PDFs; linked-only media is never treated as analyzed.
- Save adaptive learning programs in browser-local storage. Actual backend persistence comes later.
- Optional Bun API offers AI stage and weekly curriculum enhancement with `OPENAI_API_KEY` server-side.
- See [Phase 2 Engineering Notes](docs/PHASE-2-ENGINEERING.md).

**GitHub Pages:** Vite is configured for `/Learning-Os/` and an Actions deployment runs on `main`.
If this is the repository's first Pages release, select **Settings → Pages → Source → GitHub Actions** once.

```bash
npm ci
npm run check:phase2
npm run test:core
npm run typecheck
npm run build
npm run dev
# Optional private server: OPENAI_API_KEY=... bun services/api/src/server.ts
```

## Phase 3 — Multimedia Studio

The **Media Studio** (`/#studio`) combines YouTube video/playlist embeds, privacy-conscious local PDF rendering, local audio lessons, browser text-to-speech, and source-specific bookmarks. Position/progress synchronize across same-origin browser tabs using localStorage events. No media bytes, video watch-time, or bookmarks are synced to a server or other devices. YouTube video completion is manually checked. See [Phase 3 engineering notes](docs/PHASE-3-ENGINEERING.md).

```bash
npm ci
npm run check:phase3
npm run test:media
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

## Phase 4 — Smart Schedule, Google Calendar & Accountability

The Schedule and Accountability screens now share a conflict-aware, sleep-safe, audio-first local planner, helpful check-ins, browser reminders while the tab is open, and optional `.ics`/manual Google Calendar event creation. All schedule editing requires explicit action. In a **local-only** Bun development session you can optionally connect your own Google OAuth client; secrets and tokens are never shipped to Pages. An optional AI accountability check-in sends only aggregate metrics and sleep ratings when requested. The GitHub Pages build has no active OAuth session or background notification worker.

See [Phase 4 integration, privacy and tests](docs/PHASE-4-ENGINEERING.md).

```bash
npm ci
npm run check:phase4
npm run test:core
npm run typecheck
npm run build
npm run dev
```

## Phase 5 — Evidence-based assessment, progress, mastery and adaptive coaching

The existing **Assessments**, **Progress & analytics** and **Learning coach** routes now use a shared evidence ledger. Assessments save actual graded answers and confidence; repeat passes on separate days are required for the knowledge gate; practice records are explicitly self-reported; independent verification is **not** offered. Progress analytics reflect only recorded completions. The offline coach recommends short, sleep-safe learning actions and requires manual approval before adding a local session. Optional private AI explanations are only available against a separately configured local Bun server and send numeric aggregate data.

Review [Phase 5 engineering and limitations](docs/PHASE-5-ENGINEERING.md).

```bash
npm ci
npm run check:phase5
npm run test:core
npm run typecheck
npm run build
npm run test:e2e
```
