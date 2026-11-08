import { readFileSync,existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const all=['apps/web/src/phase2/Phase2Studio.tsx','apps/web/src/phase2/phase2.css','packages/learning-core/src/index.ts','services/api/src/server.ts','tests/unit/learning-core.test.mjs','.github/workflows/pages.yml'];
all.forEach(path=>assert.ok(existsSync(path),`Missing ${path}`));
const app=readFileSync('apps/web/src/App.tsx','utf8');
for(const component of ['Phase2Planner','Phase2Knowledge','Phase2Programs','Phase2Curriculum'])assert.ok(app.includes(`<${component} {...shared}/>`),`${component} is not wired`);
const vite=readFileSync('apps/web/vite.config.ts','utf8');assert.match(vite,/Learning-Os/);
console.log('Phase 2 structure: PASS (planner + sources + curriculum + tests + Pages)');
