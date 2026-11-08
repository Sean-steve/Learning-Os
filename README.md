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
