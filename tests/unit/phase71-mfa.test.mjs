import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateTotpSecret,totpAt,verifyTotp,encryptSecret,decryptSecret,newRecoveryCodes,recoveryDigest,normalizeRecovery,mfaChallengeCookie} from '../../services/api/src/phase71/mfa-core.ts';
process.env.MFA_ENCRYPTION_KEY='1'.repeat(64);
test('TOTP generator and verifier match step, tolerance and deny replays',()=>{
  const secret=generateTotpSecret();assert.match(secret,/^[A-Z2-7]{32}$/);
  const t=1_730_000_000_000,step=Math.floor(t/30000),code=totpAt(secret,step);
  assert.equal(verifyTotp(secret,code,t),step);
  assert.equal(verifyTotp(secret,code,t,step),null);
  assert.equal(verifyTotp(secret,code,t+120_000),null);
  assert.equal(verifyTotp(secret,'invalid',t),null);
});
test('AES GCM keeps MFA secrets encrypted and rejects tampering',()=>{
  const secret=generateTotpSecret(),encrypted=encryptSecret(secret);
  assert.ok(!encrypted.includes(secret));assert.equal(decryptSecret(encrypted),secret);
  assert.throws(()=>decryptSecret(encrypted.slice(0,-2)+'ff'));
});
test('recovery tokens are high-entropy, unique, and hashed',()=>{
  const codes=newRecoveryCodes();assert.equal(codes.length,8);
  assert.equal(new Set(codes).size,8);
  assert.ok(codes.every(c=>/^(?:[0-9a-f]{4}-){5}[0-9a-f]{4}$/.test(c)));
  assert.equal(recoveryDigest(codes[0]),recoveryDigest(normalizeRecovery(codes[0])||''));
});
test('temporary MFA challenge cookie is HttpOnly and tightly scoped',()=>{
  const cookie=mfaChallengeCookie('a'.repeat(64),true);
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Path=\/api\/v1\/auth\/mfa/);
});
