import type {AuthContext} from './auth.ts';
import {currentUser} from './auth.ts';
import {getRecords,putRecord,VersionConflict} from './db.ts';
import {parseJson,validateOrigin,validRecordKey,validateRecord,parseRevision} from './core.ts';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function recordsRoute(req:Request,ctx:AuthContext):Promise<Response>{
  const user=await currentUser(req,ctx);
  if(!user)return json({error:'unauthorized'},401);
  const path=new URL(req.url).pathname;
  if(req.method==='GET'&&path==='/v1/records')return json({records:await getRecords(ctx.db,user.id),user:{id:user.id,email:user.email}});
  if(req.method!=='PUT'||path!=='/v1/records')return json({error:'not_found'},404);
  if(!validateOrigin(req,ctx.origin))return json({error:'invalid_origin_or_intent'},403);
  try {
    const body=await parseJson(req);
    validateRecord(body.key,body.data);const version=parseRevision(body.revision);
    if(!validRecordKey(body.key))return json({error:'invalid_key'},400);
    const record=await putRecord(ctx.db,user.id,body.key,body.data,version);
    return json({record});
  }catch(e){
    if(e instanceof VersionConflict || (e as {code?:string}).code==='23505')return json({error:'revision_conflict'},409);
    if(e instanceof Error && ['invalid_record_key','invalid_record_data','record_too_large','invalid_revision','invalid_json'].includes(e.message))return json({error:e.message},400);
    if(e instanceof Error && e.message==='request_too_large')return json({error:'request_too_large'},413);
    console.error('Learning OS record save failed:',e instanceof Error?e.message:'unknown');return json({error:'server_unavailable'},503);
  }
}
