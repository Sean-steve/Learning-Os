# Phase 1 ZIP — Import provenance
The Phase 1 source was imported into this repository on the `phase/1.1-repository-ui-certification` branch.
The original archive `learning-os-phase1.zip` is stored in the prior ChatGPT delivery,
and its web app, Bun server stub, shared contracts, preview and documentation were preserved
as editable source files in their original paths.

To run locally:
```bash
git clone https://github.com/Sean-steve/Learning-Os.git
cd Learning-Os
git switch phase/1.1-repository-ui-certification
npm ci
npm run check:phase1
npm run typecheck
npm run build
npm run dev
```
Visit `http://localhost:5173`. These routes are browser-local demos;
there is no real AI, backend persistence, calendar sync, or HOS connection yet.
