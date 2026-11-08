/** Application-layer MFA; never issues a full learning session before the second factor. */
import {randomBytes} from 'node:crypto';
import type {DB} from '../phase6/db.ts';
import {extractSessionToken,parseJson,tokenDigest,sessionCookie,validateOrigin,verifyPassword} from '../phase6/core.ts';
import {challengeFromRequest,decryptSecret,encryptSecret,generateTotpSecret,mfaChallengeCookie,newRecoveryCodes,normalizeRecovery,otpauthUrl,recoveryDigest,verifyTotp} from './mfa-core.ts';

type Ctx={db:DB;origin:string;secure:boolean;ip:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=(code:string,status=400)=>json({error:code},status);
async function sessionUser(req:Request,db:DB){
  const token=extractSessionToken(req);if(!token)return null;
  const row=await db.query('SELECT u.id,u.email FROM los_sessions s JOIN los_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1',[tokenDigest(token)]);
  return row.rows[0] as {id:string;email:string}|undefined||null;
}
export async function mfaEnabled(db:DB,userId:string):Promise<boolean>{
  const row=await db.query('SELECT enabled FROM los_mfa WHERE user_id=$1',[userId]);return Boolean(row.rows[0]?.enabled);
}
export async function createMfaChallenge(db:DB,user:{id:string;email:string},secure:boolean):Promise<Response>{
  const token=randomBytes(32).toString('hex');
  await db.query("INSERT INTO los_mfa_challenges(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '5 minutes')",[tokenDigest(token),user.id]);
  return new Response(JSON.stringify({mfaRequired:true}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':mfaChallengeCookie(token,secure)}});
}
async function consumeFactor(client:{query:(sql:string,args?:unknown[])=>Promise<{rows:any[];rowCount?:number|null}>},userId:string,code:unknown):Promise<boolean>{
  if(typeof code!=='string')return false;
  const result=await client.query('SELECT secret_enc,last_step FROM los_mfa WHERE user_id=$1 AND enabled=true FOR UPDATE',[userId]);
  if(!result.rows.length)return false;
  const current=result.rows[0];
  const step=verifyTotp(decryptSecret(current.secret_enc),code,Date.now(),Number(current.last_step));
  if(step!==null){
    await client.query('UPDATE los_mfa SET last_step=$2,updated_at=now() WHERE user_id=$1',[userId,step]);
    return true;
  }
  const norm=normalizeRecovery(code);if(!norm)return false;
  const removed=await client.query('DELETE FROM los_mfa_recovery WHERE user_id=$1 AND code_hash=$2',[userId,recoveryDigest(norm)]);
  return Number(removed.rowCount||0)===1;
}
export async function mfaRoute(req:Request,ctx:Ctx):Promise<Response>{
  const path=new URL(req.url).pathname;
  if(req.method==='GET'&&path==='/v1/auth/mfa/status'){
    const user=await sessionUser(req,ctx.db);if(!user)return fail('unauthorized',401);
    return json({enabled:await mfaEnabled(ctx.db,user.id),configurationAvailable:/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY||'')});
  }
  if(req.method!=='POST'||!validateOrigin(req,ctx.origin))return fail('invalid_origin_or_intent',403);
  if(!['/v1/auth/mfa/begin','/v1/auth/mfa/activate','/v1/auth/mfa/disable','/v1/auth/mfa/complete'].includes(path))return fail('not_found',404);
  let payload:Record<string,unknown>;
  try{payload=await parseJson(req,2000);}catch{return fail('invalid_input',400);}
  if(path==='/v1/auth/mfa/complete'){
    const challenge=challengeFromRequest(req);if(!challenge)return fail('mfa_challenge_required',401);
    const client=await ctx.db.connect();
    try{
      await client.query('BEGIN');
      const row=await client.query('SELECT token_hash,user_id,attempts FROM los_mfa_challenges WHERE token_hash=$1 AND expires_at>now() FOR UPDATE',[tokenDigest(challenge)]);
      if(!row.rows.length||row.rows[0].attempts>=5){await client.query('ROLLBACK');return fail('mfa_challenge_expired',401);}
      const userId=row.rows[0].user_id as string;
      const ok=await consumeFactor(client,userId,payload.code);
      if(!ok){
        await client.query('UPDATE los_mfa_challenges SET attempts=attempts+1 WHERE token_hash=$1',[tokenDigest(challenge)]);
        await client.query('COMMIT');return fail('invalid_mfa_code',401);
      }
      const user=await client.query('SELECT id,email FROM los_users WHERE id=$1',[userId]);
      if(!user.rows.length)throw Error('unavailable');
      const token=randomBytes(32).toString('hex');
      await client.query("INSERT INTO los_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",[userId,tokenDigest(token)]);
      await client.query('DELETE FROM los_mfa_challenges WHERE token_hash=$1',[tokenDigest(challenge)]);
      await client.query('COMMIT');
      const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
      headers.append('Set-Cookie',sessionCookie(token,ctx.secure));
      headers.append('Set-Cookie',mfaChallengeCookie('',ctx.secure,true));
      return new Response(JSON.stringify({user:user.rows[0]}),{status:200,headers});
    }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('MFA completion failed:',e instanceof Error?e.message:'unknown');return fail('server_unavailable',503);}
    finally{client.release();}
  }
  const user=await sessionUser(req,ctx.db);
  if(!user)return fail('unauthorized',401);
  if(path==='/v1/auth/mfa/begin'){
    if(await mfaEnabled(ctx.db,user.id))return fail('mfa_already_enabled',409);
    if(typeof payload.password!=='string')return fail('invalid_credentials',401);
    const row=await ctx.db.query('SELECT password_hash FROM los_users WHERE id=$1',[user.id]);
    if(!row.rows[0]||!await verifyPassword(payload.password,row.rows[0].password_hash))return fail('invalid_credentials',401);
    try{
      const secret=generateTotpSecret();
      const encrypted=encryptSecret(secret);
      const result=await ctx.db.query(`INSERT INTO los_mfa(user_id,secret_enc,enabled) VALUES($1,$2,false)
      ON CONFLICT(user_id) DO UPDATE SET secret_enc=EXCLUDED.secret_enc,last_step=-1,updated_at=now() WHERE los_mfa.enabled=false RETURNING user_id`,[user.id,encrypted]);
      if(!result.rowCount)return fail('mfa_already_enabled',409);
      return json({secret,otpauth:otpauthUrl(user.email,secret),message:'Save the secret safely, then enter the current authenticator code.'});
    }catch(e){return fail(e instanceof Error&&e.message==='mfa_encryption_key_unconfigured'?'mfa_not_configured':'server_unavailable',503);}
  }
  if(path==='/v1/auth/mfa/activate'){
    const client=await ctx.db.connect();
    try{
      await client.query('BEGIN');
      const result=await client.query('SELECT secret_enc,last_step FROM los_mfa WHERE user_id=$1 AND enabled=false FOR UPDATE',[user.id]);
      if(!result.rows.length){await client.query('ROLLBACK');return fail('mfa_setup_required',409);}
      const row=result.rows[0],step=verifyTotp(decryptSecret(row.secret_enc),String(payload.code||''),Date.now(),Number(row.last_step));
      if(step===null){await client.query('ROLLBACK');return fail('invalid_mfa_code',401);}
      const codes=newRecoveryCodes();
      await client.query('DELETE FROM los_mfa_recovery WHERE user_id=$1',[user.id]);
      for(const code of codes)await client.query('INSERT INTO los_mfa_recovery(user_id,code_hash) VALUES($1,$2)',[user.id,recoveryDigest(code)]);
      await client.query('UPDATE los_mfa SET enabled=true,last_step=$2,updated_at=now() WHERE user_id=$1',[user.id,step]);
      const token=extractSessionToken(req);
      await client.query('DELETE FROM los_sessions WHERE user_id=$1 AND token_hash<>$2',[user.id,tokenDigest(token||'')]);
      await client.query('COMMIT');
      return json({enabled:true,recoveryCodes:codes,message:'Save recovery codes offline. Each can be used exactly once.'});
    }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('MFA activation failed:',e instanceof Error?e.message:'unknown');return fail('server_unavailable',503);}
    finally{client.release();}
  }
  // Disabling MFA requires both the account password and a valid one-time/recovery code.
  if(typeof payload.password!=='string')return fail('invalid_credentials',401);
  const password=await ctx.db.query('SELECT password_hash FROM los_users WHERE id=$1',[user.id]);
  if(!password.rows.length||!await verifyPassword(payload.password,password.rows[0].password_hash))return fail('invalid_credentials',401);
  const client=await ctx.db.connect();
  try{
    await client.query('BEGIN');
    if(!await consumeFactor(client,user.id,payload.code)){await client.query('ROLLBACK');return fail('invalid_mfa_code',401);}
    await client.query('DELETE FROM los_mfa WHERE user_id=$1',[user.id]);
    await client.query('DELETE FROM los_mfa_recovery WHERE user_id=$1',[user.id]);
    await client.query('DELETE FROM los_mfa_challenges WHERE user_id=$1',[user.id]);
    const token=extractSessionToken(req);
    await client.query('DELETE FROM los_sessions WHERE user_id=$1 AND token_hash<>$2',[user.id,tokenDigest(token||'')]);
    await client.query('COMMIT');
    return json({enabled:false});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});return fail('server_unavailable',503);}
  finally{client.release();}
}
