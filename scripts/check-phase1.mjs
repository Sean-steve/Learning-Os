import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const app = readFileSync('apps/web/src/App.tsx','utf8');
const css = readFileSync('apps/web/src/styles.css','utf8');
const api = readFileSync('services/api/src/server.ts','utf8');
const pkg = JSON.parse(readFileSync('apps/web/package.json','utf8'));
const screens=['overview','goals','builder','programs','curriculum','lesson','library','audio','reader','calendar','focus','journal','assessments','analytics','coach','accountability','integrations','settings'];
for(const name of screens){assert.ok(app.includes(`case '${name}':`), `Missing route ${name}`)}
for(const item of ['@media (max-width:740px)','sidebar','hero-card','audio-hero','calendar-week','reader-paper','focus-room'])assert.ok(css.includes(item), `Missing style ${item}`);
for(const item of ['Bun.serve','/health','/v1/meta'])assert.ok(api.includes(item), `Missing API ${item}`);
assert.ok(pkg.dependencies.react&&pkg.dependencies['lucide-react']);
assert.ok(app.includes("'2026-11-09'"));
assert.ok(existsSync('docs/PHASE-1-REVIEW.md'));
console.log('PASS: 18 routes, style foundations, reference timeline, Bun API stub, docs.');
console.log('NOTE: This static check is not a full typecheck/build/browser acceptance test.');