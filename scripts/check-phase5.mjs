import { readFileSync,existsSync } from 'node:fs';
const must=[
  'packages/mastery-core/src/index.ts',
  'apps/web/src/phase5/MasteryStudio.tsx',
  'apps/web/src/phase5/mastery.css',
  'services/api/src/mastery-ai.ts',
  'tests/unit/mastery-core.test.mjs',
  'tests/e2e/phase5.spec.ts',
  'docs/PHASE-5-ENGINEERING.md'
];
for(const p of must){if(!existsSync(p))throw Error(`Missing ${p}`)}
const app=readFileSync('apps/web/src/App.tsx','utf8');
for(const str of ["import MasteryStudio from './phase5/MasteryStudio'","case 'assessments':return <MasteryStudio","case 'analytics':return <MasteryStudio","case 'coach':return <MasteryStudio"]){if(!app.includes(str))throw Error(`Phase 5 App integration missing: ${str}`)}
const src=readFileSync('services/api/src/server.ts','utf8');
if(!src.includes('masteryAiRoute(req'))throw Error('Private mastery AI route not registered');
const pages=readFileSync('.github/workflows/pages.yml','utf8');
if(!pages.includes('check:phase5'))throw Error('Pages missing Phase 5 gate');
console.log('Phase 5 source, API and Pages structural checks PASS');
