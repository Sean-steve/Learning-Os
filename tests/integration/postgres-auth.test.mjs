import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../../services/api/src/phase6/db.ts';
import {phase6Route} from '../../services/api/src/phase6/routes.ts';

const ORIGIN='http://localhost:5173';
const ctx={db:pool,origin:ORIGIN,ip:'127.0.0.1',secure:false};
const salt=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const emailA=`phase6-a-${salt}@example.test`,emailB=`phase6-b-${salt}@example.test`;
const password='correct horse password 2026';
const request=(path,method='GET',data=null,cookie='',origin=ORIGIN,intent='manual-sync')=>new Request('http://127.0.0.1:3005'+path,{method,headers:{...(data===null?{}:{'Content-Type':'application/json'}),...(origin?{'Origin':origin}:{}),...(intent?{'X-Learning-Intent':intent}:{}),...(cookie?{'Cookie':cookie}:{})},...(data===null?{}:{body:JSON.stringify(data)})});
const api=(path,method='GET',data=null,cookie='',origin=ORIGIN,intent='manual-sync')=>phase6Route(request(path,method,data,cookie,origin,intent),ctx);
async function register(email){const r=await api('/v1/auth/register','POST',{email,password});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.ok(cookie?.includes('HttpOnly'));return {cookie,user:(await r.json()).user};}

test('PostgreSQL auth, user isolation, RLS, optimistic sync and revocable session',async()=>{
 let a,b;
 try{
  a=await register(emailA);b=await register(emailB);
  assert.notEqual(a.user.id,b.user.id);
  const duplicate=await api('/v1/auth/register','POST',{email:emailA,password});assert.equal(duplicate.status,409);
  const weak=await api('/v1/auth/register','POST',{email:'weak-'+emailA,password:'short'});assert.equal(weak.status,400);
  const invalidOrigin=await api('/v1/auth/login','POST',{email:emailA,password},'', 'https://not-my-site.example');assert.equal(invalidOrigin.status,403);
  const invalidIntent=await api('/v1/auth/login','POST',{email:emailA,password},'',ORIGIN,null);assert.equal(invalidIntent.status,403);
  const badPassword=await api('/v1/auth/login','POST',{email:emailA,password:'wrong-password'});assert.equal(badPassword.status,401);
  const noCookie=await api('/v1/records','PUT',{key:'los.journal',data:[{private:true}],revision:0});assert.equal(noCookie.status,401);
  const valid=await api('/v1/records','PUT',{key:'los.journal',data:[{sensitive:'private evidence'}],revision:0},a.cookie);
  assert.equal(valid.status,200);assert.equal((await valid.json()).record.revision,1);
  const unchanged=await api('/v1/records','PUT',{key:'los.journal',data:[{sensitive:'stale update'}],revision:0},a.cookie);assert.equal(unchanged.status,409);
  const newRec=await api('/v1/records','PUT',{key:'los.journal',data:[{sensitive:'second revision'}],revision:1},a.cookie);
  assert.equal(newRec.status,200);assert.equal((await newRec.json()).record.revision,2);
  const badKey=await api('/v1/records','PUT',{key:'los.sync.owner',data:'should_not_write',revision:0},a.cookie);assert.equal(badKey.status,400);
  const badOrigin=await api('/v1/records','PUT',{key:'los.journal',data:[1],revision:2},a.cookie,'https://evil.example');assert.equal(badOrigin.status,403);
  const gotA=await api('/v1/records','GET',null,a.cookie);const docsA=(await gotA.json()).records;assert.equal(docsA.length,1);assert.equal(docsA[0].data[0].sensitive,'second revision');
  const gotB=await api('/v1/records','GET',null,b.cookie);assert.equal((await gotB.json()).records.length,0);
  const accessWithoutRlsScope=await pool.query('SELECT record_key FROM los_records WHERE user_id=$1',[a.user.id]);assert.equal(accessWithoutRlsScope.rows.length,0);
  const manualLogin=await api('/v1/auth/login','POST',{email:emailA,password});assert.equal(manualLogin.status,200);
  const logout=await api('/v1/auth/logout','POST',{},a.cookie);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  const accessRevoked=await api('/v1/records','GET',null,a.cookie);assert.equal(accessRevoked.status,401);
 }finally{
  await pool.query('DELETE FROM los_users WHERE email=$1 OR email=$2',[emailA,emailB]);
 }
});
