import { readFileSync, existsSync } from 'node:fs';
const requireFiles=['apps/web/src/phase4/ScheduleCenter.tsx','apps/web/src/phase4/phase4.css','packages/scheduling-core/src/index.ts','services/api/src/google-calendar.ts','services/api/src/google-calendar-core.ts','services/api/src/accountability-ai.ts','tests/e2e/phase4.spec.ts','tests/unit/scheduling-core.test.mjs','tests/unit/google-calendar-core.test.mjs','docs/PHASE-4-ENGINEERING.md'];
for (const path of requireFiles) if(!existsSync(path))throw Error('Phase 4 missing file '+path);
const app=readFileSync('apps/web/src/App.tsx','utf8');const cli=readFileSync('apps/web/src/phase4/ScheduleCenter.tsx','utf8');const server=readFileSync('services/api/src/server.ts','utf8');
for (const term of ["case 'calendar':return <ScheduleCenter", "case 'accountability':return <ScheduleCenter"]){if(!app.includes(term))throw Error('Phase 4 route missing: '+term)}
for (const term of ['Google Calendar & exports','Download calendar','Apply suggested time','coachingNote','Notification.requestPermission'])if(!cli.includes(term))throw Error('UI missing feature '+term);
if(!server.includes('googleCalendarRoute')||!server.includes('aiAccountabilityRoute'))throw Error('Bun private Google/AI routes not wired');
console.log('Phase 4 smart scheduling, calendar bridge and accountability source checks PASS');
