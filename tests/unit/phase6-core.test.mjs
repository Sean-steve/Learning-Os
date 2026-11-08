import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,validRecordKey,validateRecord,normalizeEmail,sessionCookie,extractSessionToken,parseRevision,validateOrigin,tokenDigest} from '../../services/api/src/phase6/core.ts';
test('password hashes are salted and compare with timing-safe derivation',async()=>{
 const a=await hashPassword('three long words safe'),b=await hashPassword('three long words safe');
 assert.notEqual(a,b);assert.equal(await verifyPassword('three long words safe',a),true);assert.equal(await verifyPassword('incorrect password',a),false);
 assert.rejects(()=>hashPassword('short'));
});
test('email normalization and input validation',()=>{
 assert.equal(normalizeEmail(' Me+Demo@Example.com '),'me+demo@example.com');
 assert.throws(()=>normalizeEmail('bad@email'));assert.throws(()=>normalizeEmail('a '.repeat(200)));
});
test('only approved learning keys and bounded JSON content can be persisted',()=>{
 assert.equal(validRecordKey('los.phase5.attempts'),true);assert.equal(validRecordKey('los.sync.owner'),false);assert.equal(validRecordKey('__proto__'),false);
 assert.doesNotThrow(()=>validateRecord('los.journal',[{text:'private'}]));
 assert.throws(()=>validateRecord('los.sync.owner','hello'));assert.throws(()=>validateRecord('los.journal','a'.repeat(500_001)));
});
test('session token is opaque and cookie has HttpOnly and SameSite flags',()=>{
 const token='a'.repeat(64),cookie=sessionCookie(token,false);
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.equal(extractSessionToken(new Request('http://example.com',{headers:{cookie}})),token);
 assert.notEqual(tokenDigest(token),token);
 assert.match(sessionCookie('',true,true),/Max-Age=0/);
});
test('origin checks prevent cross-site state changes',()=>{
 const req=(origin,header)=>new Request('http://localhost:3005',{method:'POST',headers:{...(origin?{Origin:origin}:{}),...(header?{'X-Learning-Intent':header}:{})}});
 assert.equal(validateOrigin(req('http://localhost:5173','manual-sync'),'http://localhost:5173'),true);
 assert.equal(validateOrigin(req('https://evil.example','manual-sync'),'http://localhost:5173'),false);
 assert.equal(validateOrigin(req('http://localhost:5173',null),'http://localhost:5173'),false);
});
test('optimistic revision rejects illegal numbers',()=>{assert.equal(parseRevision(0),0);assert.equal(parseRevision(7),7);assert.throws(()=>parseRevision(-1));assert.throws(()=>parseRevision(1.5));});
