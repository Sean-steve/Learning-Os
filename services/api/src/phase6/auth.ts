import {randomBytes} from 'node:crypto';
import {allowLogin} from '../phase71/throttle.ts';
import {createMfaChallenge,mfaEnabled} from '../phase71/mfa.ts';
import type {DB} from './db.ts';
import {extractSessionToken,hashPassword,normalizeEmail,parseJson,sessionCookie,tokenDigest,validateOrigin,verifyPassword} from './core.ts';
export interface AuthContext {db:DB;origin:string;secure:boolean;ip:string}
const json=(body:unknown,status=200,extra:HeadersInit={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Content-Type':'application/json',...extra}});
const fail=(message:string,status=400)=>json({error:message},status);
export async function currentUser(req:Request,ctx:AuthContext):Promise<{id:string;email:string}|null>{
  const token=extractSessionToken(req);if(!token)return null;
  const r=await ctx.db.query(`SELECT u.id,u.email FROM los_sessions s JOIN los_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1`,[tokenDigest(token)]);
  return r.rows[0]||null;
}
export async function authRoute(req:Request,ctx:AuthContext):Promise<Response> {
  const path=new URL(req.url).pathname;
  if(req.method==='GET'&&path==='/v1/auth/me')return json({user:await currentUser(req,ctx)});
  if(req.method==='GET'&&path==='/v1/auth/sessions'){
    const user=await currentUser(req,ctx),token=extractSessionToken(req);
    if(!user||!token)return fail('unauthorized',401);
    const rows=await ctx.db.query(
      'SELECT id,created_at AS "createdAt",expires_at AS "expiresAt",token_hash FROM los_sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT 50',[user.id]);
    return json({sessions:rows.rows.map((row:{id:string;createdAt:string;expiresAt:string;token_hash:string})=>
      ({id:row.id,createdAt:row.createdAt,expiresAt:row.expiresAt,current:row.token_hash===tokenDigest(token)}))});
  }
  if(req.method!=='POST')return fail('not_found',404);
  if(!validateOrigin(req,ctx.origin))return fail('invalid_origin_or_intent',403);
  if(!['/v1/auth/register','/v1/auth/login','/v1/auth/logout','/v1/auth/revoke-others','/v1/auth/change-password'].includes(path))return fail('not_found',404);
  if(path==='/v1/auth/revoke-others'||path==='/v1/auth/change-password'){
    const user=await currentUser(req,ctx),token=extractSessionToken(req);
    if(!user||!token)return fail('unauthorized',401);
    if(path==='/v1/auth/revoke-others'){
      const result=await ctx.db.query('DELETE FROM los_sessions WHERE user_id=$1 AND token_hash<>$2',[user.id,tokenDigest(token)]);
      return json({ok:true,revoked:result.rowCount||0});
    }
    try{
      const data=await parseJson(req,2_000);
      const oldPassword=data.currentPassword,newPassword=data.newPassword;
      if(typeof oldPassword!=='string'||typeof newPassword!=='string')return fail('invalid_credentials',400);
      const row=await ctx.db.query('SELECT password_hash FROM los_users WHERE id=$1',[user.id]);
      if(!row.rows[0]||!await verifyPassword(oldPassword,row.rows[0].password_hash))return fail('invalid_credentials',401);
      const updated=await hashPassword(newPassword);
      await ctx.db.query('UPDATE los_users SET password_hash=$2 WHERE id=$1',[user.id,updated]);
      const revoked=await ctx.db.query('DELETE FROM los_sessions WHERE user_id=$1 AND token_hash<>$2',[user.id,tokenDigest(token)]);
      return json({ok:true,revoked:revoked.rowCount||0});
    }catch(err){
      const code=err instanceof Error?err.message:'invalid_credentials';
      if(['weak_password','invalid_json'].includes(code))return fail(code,400);
      if(code==='request_too_large')return fail(code,413);
      return fail('server_unavailable',503);
    }
  }
  if(path==='/v1/auth/logout'){
    const token=extractSessionToken(req);if(token)await ctx.db.query('DELETE FROM los_sessions WHERE token_hash=$1',[tokenDigest(token)]);
    return json({ok:true},200,{'Set-Cookie':sessionCookie('',ctx.secure,true)});
  }
  try {
    const body=await parseJson(req,2_000);
    const email=normalizeEmail(body.email);const password=body.password;
    if(!await allowLogin(ctx.db,ctx.ip,email))return fail('rate_limited',429);
    if(typeof password!=='string'||password.length>128)throw new Error('invalid_credentials');
    let user:{id:string;email:string}|undefined;
    if(path==='/v1/auth/register'){
      const hash=await hashPassword(password);
      const r=await ctx.db.query('INSERT INTO los_users(email,password_hash) VALUES($1,$2) RETURNING id,email',[email,hash]);user=r.rows[0];
    } else {
      const r=await ctx.db.query('SELECT id,email,password_hash FROM los_users WHERE email=$1 LIMIT 1',[email]);
      if(!r.rows.length || !await verifyPassword(password,r.rows[0].password_hash))return fail('invalid_credentials',401);
      user={id:r.rows[0].id,email:r.rows[0].email};
    }
    if(!user)throw new Error('invalid_credentials');
    if(path==='/v1/auth/login'&&await mfaEnabled(ctx.db,user.id))
      return createMfaChallenge(ctx.db,user,ctx.secure);
    const token=randomBytes(32).toString('hex');
    await ctx.db.query(`INSERT INTO los_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')`,[user.id,tokenDigest(token)]);
    return json({user},200,{'Set-Cookie':sessionCookie(token,ctx.secure)});
  } catch(e){const code=e instanceof Error?e.message:'unavailable';
    if((e as {code?:string})?.code==='23505')return fail('email_taken',409);
    if(['invalid_email','weak_password','invalid_json','invalid_credentials'].includes(code))return fail(code,400);
    if(code==='request_too_large')return fail(code,413);
    console.error('Learning OS auth failed:',code);return fail('server_unavailable',503);
  }
}
