# Phase 1.1 — Repository Setup, Local Build Verification and UI Certification

## Source
Original Phase 1 ZIP: `learning-os-phase1.zip` provided in the associated ChatGPT conversation.
The archive contains React 19/TypeScript/Vite web UI, 18 navigation views, CSS,
Bun/TypeScript API stub, shared contracts, docs, and static route checks.

## Verified locally on 2026-11-08
- The archive is present and readable (58 KB compressed).
- Node v22.16.0 and npm v10.9.2 are available.
- `node scripts/check-phase1.mjs` **PASS**:
  18 routes, styling foundations, reference timeline, Bun API stub and docs.
- `npm install` timed out due to network restrictions.
- `npm install --offline` failed because the required npm packages are not cached.
- Bun is not installed in the validation container.
- Browser walkthrough, responsiveness, keyboard navigation, a11y and video/audio/PDF journeys: NOT VERIFIED.

## Repository status
- Target: Sean-steve/Learning-Os
- Branch: `phase/1.1-repository-ui-certification`
- A gated GitHub Actions workflow is defined. The complete Phase 1 archive source has
  **not yet been imported**; this workflow is expected to fail its source gate
  until the source and generated `package-lock.json` are committed.
- Do not merge to `main` or claim certification before the gates are green.

## Acceptance gates
1. Import archive contents into repository root (remove outer `learning-os-phase1/`).
2. Run `npm install` and commit generated package-lock.json.
3. Run `npm run check:phase1`, `npm run typecheck`, `npm run build`.
4. Launch `npm run dev` and inspect all 18 routes on mobile and desktop.
5. Verify keyboard focus, accessible labels, contrast and reduced-motion behavior.
6. Test learning goal wizard, journaling, media playback, PDF upload and scheduling
   with representative demo data.
7. Record bugs with reproduction steps, severity, screenshots and retest evidence.
8. Confirm GitHub Actions checks and review PR before merging.

## Architecture guardrails
Frontend: React/TypeScript/Vite. Backend: TypeScript/Bun.
Do not introduce Laravel; PostgreSQL and HOS integration are later phases.
Demo data must be visibly distinguishable from durable persistence.
