/** Database-backed login throttling, shared by all Bun workers and hosts. */
import {tokenDigest} from '../phase6/core.ts';
import type {DB} from '../phase6/db.ts';
async function hit(db:DB,bucket:string,limit:number,seconds=900):Promise<boolean>{
  const key=tokenDigest('los-auth-v1:'+bucket);
  const r=await db.query(`INSERT INTO los_auth_limits(bucket_hash,attempts,reset_at) VALUES($1,1,now()+($2::integer*interval '1 second'))
   ON CONFLICT(bucket_hash) DO UPDATE SET attempts=CASE WHEN los_auth_limits.reset_at<=now() THEN 1 ELSE los_auth_limits.attempts+1 END,
     reset_at=CASE WHEN los_auth_limits.reset_at<=now() THEN now()+($2::integer*interval '1 second') ELSE los_auth_limits.reset_at END
   RETURNING attempts`,[key,seconds]);
  return Number(r.rows[0]?.attempts||9999)<=limit;
}
export async function allowLogin(db:DB,ip:string,email:string):Promise<boolean>{
  const ipAllowed=await hit(db,'ip:'+ip,120);
  const emailAllowed=await hit(db,'email:'+email.toLowerCase(),12);
  return ipAllowed&&emailAllowed;
}
