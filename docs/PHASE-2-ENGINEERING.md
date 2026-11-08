# Learning OS — Phase 2: Curriculum, Knowledge and Intelligent Planning

## Delivered

- **Plan engine**: pure TypeScript package at `packages/learning-core/src/index.ts`;
  validates timeline, session time, learning formats and start date. Creates 30/60/90/180-day
  plans with four prerequisite/evidence stages, weekly listening/reading blocks, rest days,
  explicit source IDs and no silent catch-up stacking.
- **Knowledge engine**: users may save source URLs. URLs are **not fetched**; text is analyzed
  only when supplied by the user or extracted from a local PDF/TXT/MD. Excerpts retain
  input IDs for traceability. The output is not an independent fact check or source summary.
- **Client PDF extraction**: `pdfjs-dist` processes selectable-text PDFs in the browser,
  limited to 10MB/60 pages/200K characters. Scanned-image PDFs require OCR in a future phase.
- **Adaptive review**: completion count, remaining study time, difficulty and sleep quality
  produce a recommendation. A learner must explicitly apply a reduced load to the next week.
- **AI enhancement API**: Bun TypeScript endpoint `/v1/plans/ai-generate` uses the Responses API
  only when `OPENAI_API_KEY` is configured server-side. It proposes staged guidance and weekly
  focus. Model output is validated; no invented quotes, automatic URL reads or claims that
  extraordinary abilities are established.
- **GitHub Pages**: Vite uses `/Learning-Os/` on Pages; deploy workflow uses `GITHUB_PAGES=true`
  and Actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`).

## Trust boundaries

GitHub Pages is **static only**. It runs the offline planner and browser-local source import.
The optional Bun API runs separately on `127.0.0.1:3005` by default; it never lives on Pages.
A real hosted API, user identity, database, document storage and authentication belong to later
phases. Do NOT expose the local Bun API publicly or put API tokens in Vite env variables.

All generated schedules and extracted-source excerpts are in localStorage, and thus visible to
other users of the same browser profile. Use a private profile for sensitive journals and
avoid importing confidential files on public computers.

## Run locally

```bash
npm ci
npm run dev
# optional in a separate terminal:
OPENAI_API_KEY=... npm run dev:api
```

When running the optional AI API, set `VITE_LEARNING_API_URL=http://127.0.0.1:3005` in an
uncommitted `.env.local` inside `apps/web/`. Never set `OPENAI_API_KEY` in a client variable.

## Validation

```bash
npm run check:phase1
npm run check:phase2
npm run test:core
npm run typecheck
npm run build
npm run test:e2e
GITHUB_PAGES=true npm run build
node scripts/check-pages.mjs
```

## Pages activation (one-time)

Go to GitHub repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
After enabling, a push to `main` triggers `.github/workflows/pages.yml`. Public site URL
is expected to be `https://sean-steve.github.io/Learning-Os/` only after GitHub confirms
successful deployment. The AI service and database are not available on that Pages site.

## Phase 2 readiness gates

- Generate and save an audio-first 90-day plan in browser.
- Validate weekly sessions and stage evidence gates.
- Paste transcripts or import a local text-based PDF and inspect anchored excerpts.
- Unprocessed links stay unprocessed and are not cited as reviewed teaching material.
- Adaptive recommendations do not automatically change plans.
- Optional AI API requires a private server key and validates model output.
- Frontend compiles, all Phase 1 routes still render, Playwright checks pass, Pages base passes.
- Public deployment is verified independently after Pages is enabled.
