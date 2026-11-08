import {readFileSync,existsSync} from 'node:fs';
const paths=[
'services/api/migrations/002_phase71_identity.sql',
'services/api/src/phase71/mfa-core.ts',
'services/api/src/phase71/mfa.ts',
'services/api/src/phase71/throttle.ts',
'tests/integration/phase71-mfa.test.mjs',
'tests/unit/phase71-mfa.test.mjs',
'docs/PHASE-7.1-RELEASE.md'
];
for(const path of paths)if(!existsSync(path))throw Error('Phase 7.1 file absent: '+path);
const server=readFileSync('services/api/src/server.ts','utf8');
if(!server.includes("Production requires AUTH_REQUIRE_MFA=true")||!server.includes('loopback'))throw Error('Production API security preflight missing');
const auth=readFileSync('services/api/src/phase6/auth.ts','utf8');
if(!auth.includes('createMfaChallenge')||!auth.includes('allowLogin'))throw Error('MFA login and DB-backed throttling required');
const nginx=readFileSync('infra/nginx/learning-os.conf.example','utf8');
if(!nginx.includes('ssl_certificate')||!nginx.includes('proxy_pass'))throw Error('HTTPS proxy template required');
console.log('Phase 7.1 source contracts PASS; this is NOT a live deployment certificate');
