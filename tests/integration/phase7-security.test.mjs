import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../../services/api/src/phase6/db.ts';
import {phase6Route} from '../../services/api/src/phase6/routes.ts';

const origin='http://localhost:5173';
const ctx={db:pool,origin,ip:'198.51.100.78',secure:false};
const email='phase7-'+Date.now().toString(36)+'@example.test';
const password='the original safe passphrase 2026';
const updated='the new secure passphrase 2026';
const call=(path,method='GET',data=null,cookie='',from=origin,intent='manual-sync')=>
  phase6Route(new Request('http://127.0.0.1:3005'+path,{
    method,headers:{Origin:from,...(intent?{'X-Learning-Intent':intent}:{}),
      ...(cookie?{Cookie:cookie}:{}),...(data===null?{}:{'Content-Type':'application/json'})},
    ...(data===null?{}:{body:JSON.stringify(data)})
  }),ctx);

test('session inspection, revoke-other-devices, password rotation, and origin boundaries', async()=>{
  try {
    const register=await call('/v1/auth/register','POST',{email,password});
    assert.equal(register.status,200);
    const first=register.headers.get('set-cookie');
    assert.ok(first?.includes('HttpOnly'));
    const secondLogin=await call('/v1/auth/login','POST',{email,password});
    assert.equal(secondLogin.status,200);
    const second=secondLogin.headers.get('set-cookie');
    assert.notEqual(first,second);
    const anonymous=await call('/v1/auth/sessions');
    assert.equal(anonymous.status,401);
    const list=await call('/v1/auth/sessions','GET',null,second);
    assert.equal(list.status,200);
    const rows=(await list.json()).sessions;
    assert.equal(rows.length,2);
    assert.equal(rows.filter(s=>s.current).length,1);
    assert.ok(rows.every(s=>!('token_hash' in s)));
    const badPreflight=await call('/v1/auth/login','OPTIONS',null,'','https://attacker.example');
    assert.equal(badPreflight.status,403);
    const validPreflight=await call('/v1/auth/login','OPTIONS');
    assert.equal(validPreflight.status,204);
    const forged=await call('/v1/auth/revoke-others','POST',{},second,'https://attacker.example');
    assert.equal(forged.status,403);
    const revoked=await call('/v1/auth/revoke-others','POST',{},second);
    assert.equal(revoked.status,200);
    assert.equal((await revoked.json()).revoked,1);
    assert.equal((await call('/v1/auth/me','GET',null,first)).status,200);
    assert.equal((await (await call('/v1/auth/me','GET',null,first)).json()).user,null);
    assert.ok((await (await call('/v1/auth/me','GET',null,second)).json()).user);
    const wrong=await call('/v1/auth/change-password','POST',{currentPassword:'incorrect',newPassword:updated},second);
    assert.equal(wrong.status,401);
    const short=await call('/v1/auth/change-password','POST',{currentPassword:password,newPassword:'weak'},second);
    assert.equal(short.status,400);
    const changed=await call('/v1/auth/change-password','POST',{currentPassword:password,newPassword:updated},second);
    assert.equal(changed.status,200);
    assert.equal((await call('/v1/auth/login','POST',{email,password})).status,401);
    assert.equal((await call('/v1/auth/login','POST',{email,password:updated})).status,200);
    const protectedRequest=await call('/v1/records','PUT',{key:'los.journal',data:[],revision:0},second,'https://attacker.example');
    assert.equal(protectedRequest.status,403);
  } finally {
    await pool.query('DELETE FROM los_users WHERE email=$1',[email]);
  }
});
