import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../../services/api/src/phase6/db.ts';
import {phase6Route} from '../../services/api/src/phase6/routes.ts';
import {totpAt} from '../../services/api/src/phase71/mfa-core.ts';
const old=process.env.MFA_ENCRYPTION_KEY;
process.env.MFA_ENCRYPTION_KEY='1'.repeat(64);
const ORIGIN='http://localhost:5173';
const ctx={db:pool,origin:ORIGIN,secure:false,ip:'198.51.100.112'};
const email='mfa7-'+Date.now().toString(36)+'@example.test',password='a sufficiently long test password 2026';
function call(path,method='GET',data=null,cookie='',origin=ORIGIN,intent='manual-sync'){
  return phase6Route(new Request('http://localhost:3005'+path,{
    method,headers:{origin,...(intent?{'X-Learning-Intent':intent}:{}),...(cookie?{cookie}:{}),...(data!==null?{'content-type':'application/json'}:{})},
    ...(data!==null?{body:JSON.stringify(data)}:{})
  }),ctx);
}
test('PostgreSQL MFA activation, password-only denial, recovery and session controls',async()=>{
  try{
    const signup=await call('/v1/auth/register','POST',{email,password});
    assert.equal(signup.status,200);
    const cookie=signup.headers.get('set-cookie');
    const begin=await call('/v1/auth/mfa/begin','POST',{password},cookie);
    assert.equal(begin.status,200);
    const setup=await begin.json();assert.match(setup.secret,/^[A-Z2-7]{32}$/);
    const code=totpAt(setup.secret,Math.floor(Date.now()/30000));
    const badActivate=await call('/v1/auth/mfa/activate','POST',{code:'000000'},cookie);
    // Probability that 000000 equals the real code is negligible, but tests avoid relying on it:
    if(code!=='000000')assert.equal(badActivate.status,401);
    const activated=await call('/v1/auth/mfa/activate','POST',{code},cookie);
    assert.equal(activated.status,200);
    const codes=(await activated.json()).recoveryCodes;assert.equal(codes.length,8);
    const login=await call('/v1/auth/login','POST',{email,password});
    assert.equal(login.status,200);assert.equal((await login.json()).mfaRequired,true);
    assert.equal(login.headers.get('set-cookie')?.includes('los_session='),false);
    const challenge=login.headers.get('set-cookie');
    const noFactor=await call('/v1/auth/mfa/complete','POST',{code:'123'},challenge);
    assert.equal(noFactor.status,401);
    const recovery=await call('/v1/auth/mfa/complete','POST',{code:codes[0]},challenge);
    assert.equal(recovery.status,200);
    const secondCookie=recovery.headers.get('set-cookie');
    assert.match(secondCookie,/los_session=/);
    const records=await call('/v1/records','GET',null,secondCookie);
    assert.equal(records.status,200);
    const secondLogin=await call('/v1/auth/login','POST',{email,password});
    const challenge2=secondLogin.headers.get('set-cookie');
    const replay=await call('/v1/auth/mfa/complete','POST',{code:codes[0]},challenge2);
    assert.equal(replay.status,401);
    const valid=await call('/v1/auth/mfa/complete','POST',{code:codes[1]},challenge2);
    assert.equal(valid.status,200);
    const wrongOrigin=await call('/v1/auth/mfa/disable','POST',{password,code:codes[2]},secondCookie,'https://forged.test');
    assert.equal(wrongOrigin.status,403);
    const disabled=await call('/v1/auth/mfa/disable','POST',{password,code:codes[2]},secondCookie);
    assert.equal(disabled.status,200);
    const after=await call('/v1/auth/login','POST',{email,password});
    assert.ok((await after.json()).user);
  }finally{
    await pool.query('DELETE FROM los_users WHERE email=$1',[email]);
    process.env.MFA_ENCRYPTION_KEY=old;
  }
});
