import {readFileSync, existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const file='apps/web/dist/index.html';assert.ok(existsSync(file),'Build missing');
const text=readFileSync(file,'utf8');
assert.ok(text.includes('/Learning-Os/assets/'),'GitHub Pages base path not present');
assert.ok(!text.includes('OPENAI_API_KEY'),'Never emit OpenAI keys in public assets');
assert.ok(!text.includes('localhost:3005'),'Pages must not bake in a local API');
console.log('Pages static build: PASS — project base path and no backend key');
