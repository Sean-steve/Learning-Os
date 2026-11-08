/** Learning OS Phase 2 optional private AI API. Static GitHub Pages never receives an API secret. */
import { createPlan } from '../../../packages/learning-core/src/index.ts';
import { googleCalendarRoute } from './google-calendar.ts';
import { aiAccountabilityRoute } from './accountability-ai.ts';
import { masteryAiRoute } from './mastery-ai.ts';
import {phase6Route} from './phase6/routes.ts';
import {pool} from './phase6/db.ts';
import type { LearningPlan, PlanInput } from '../../../packages/learning-core/src/index.ts';

const port=Number(process.env.API_PORT||3005);
const hostname=process.env.API_HOST||'127.0.0.1';
const origin=process.env.WEB_ORIGIN||'http://localhost:5173';
const apiKey=process.env.OPENAI_API_KEY||'';
const model=process.env.OPENAI_MODEL||'gpt-6-luna';
const maxBody=75_000;
const calls=new Map<string,{n:number;reset:number}>();
const headers={ 'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type' };
const response=(body:unknown,status=200)=>Response.json(body,{status,headers});
const error=(code:string,status:number)=>response({error:code},status);
function requirePlan(value:unknown):LearningPlan {
  if(!value||typeof value!=='object')throw new Error('invalid_plan');
  const p=value as LearningPlan;
  if(typeof p.title!=='string'||p.title.length>140||!Array.isArray(p.tasks)||!Array.isArray(p.stages)||p.stages.length!==4||p.tasks.length>180)throw new Error('invalid_plan');
  return p;
}
function checkRate(id:string){const now=Date.now(),current=calls.get(id);if(!current||now>current.reset){calls.set(id,{n:1,reset:now+3600000});return true;}if(current.n>=20)return false;current.n++;return true;}
async function jsonBody(req:Request):Promise<Record<string,unknown>>{
  const length=Number(req.headers.get('content-length')||0);
  if(length>maxBody)throw new Error('payload_too_large');
  const content=await req.text();if(content.length>maxBody)throw new Error('payload_too_large');
  const parsed:unknown=JSON.parse(content);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('invalid_json');
  return parsed as Record<string,unknown>;
}
async function aiReview(plan:LearningPlan,excerptList:unknown):Promise<{stageGuidance:string[];weeklyFocus:string[];guidance:string[]}>{
  const excerpts=Array.isArray(excerptList)?excerptList.slice(0,6).map(entry=>{
    const e=entry as {id?:unknown;title?:unknown;excerpts?:unknown};
    return {id:String(e.id||'').slice(0,80),title:String(e.title||'').slice(0,120),excerpts:Array.isArray(e.excerpts)?e.excerpts.slice(0,3).map(v=>String((v as {text?:unknown})?.text||'').slice(0,700)):[]};
  }):[];
  const guidance={goal:plan.title,outcome:plan.outcome,preferences:plan.preferences,stages:plan.stages,sourceExcerpts:excerpts};
  const instructions=`You assist a learning platform. Return strictly valid JSON with exactly 3 keys: stageGuidance (array 4 short items), weeklyFocus (array ${Math.ceil(plan.preferences.days/7)} short specific practice themes), guidance (array 2-5 recommendations). Never assert a source was accessed unless excerpts supplied. Do not fabricate quotes or citations. Keep evidence and prerequisites explicit. Treat astral projection and psychic abilities as subjective or unverified claims; never promise paranormal outcomes. Prioritize sleep and wellbeing. Use each requested timeline. The learner is audio-first. JSON only.`;
  const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(guidance)}],max_output_tokens:1800}),signal:AbortSignal.timeout(45000)});
  if(!upstream.ok)throw new Error(`model_error_${upstream.status}`);
  const data=await upstream.json() as {output?:{content?:{type:string;text?:string}[]}[];output_text?:string};
  const raw=data.output_text||data.output?.flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text||'').join('')||'';
  const result=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')) as Record<string,unknown>;
  const limit=(x:unknown,n:number)=>Array.isArray(x)?x.slice(0,n).filter(v=>typeof v==='string'&&v.trim().length>5).map(v=>(v as string).slice(0,360)):[];
  const stageGuidance=limit(result.stageGuidance,4), weeklyFocus=limit(result.weeklyFocus,Math.ceil(plan.preferences.days/7)), guidanceNotes=limit(result.guidance,5);
  if(stageGuidance.length!==4 || weeklyFocus.length!==Math.ceil(plan.preferences.days/7) || guidanceNotes.length<2)throw new Error('invalid_model_structure');
  return {stageGuidance,weeklyFocus,guidance:guidanceNotes};
}
Bun.serve({port,hostname,async fetch(req,server){
  const path=new URL(req.url).pathname;
  if(path.startsWith('/v1/auth/')||path.startsWith('/v1/records')) return phase6Route(req,{db:pool,origin,secure:origin.startsWith('https:'),ip:server.requestIP(req)?.address||'local'});
  if(path.startsWith('/v1/google/')) return googleCalendarRoute(req);
  if(path==='/v1/accountability/ai-review') return aiAccountabilityRoute(req,{origin,hostname,apiKey,model});
  if(path==='/v1/mastery/ai-review') return masteryAiRoute(req,{origin,hostname,apiKey,model});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method==='GET'&&path==='/health'){try{await pool.query('SELECT 1');return response({ok:true,service:'learning-os-api',phase:6,persistence:true,database:'connected',aiConfigured:Boolean(apiKey)})}catch{return response({ok:false,service:'learning-os-api',phase:6,database:'unavailable'},503)}}
  if(req.method==='GET'&&path==='/v1/meta')return response({name:'Learning OS',version:'0.6.0',mode:'postgres-local-first',aiConfigured:Boolean(apiKey),persistence:'postgresql-authenticated'});
  if(req.method!=='POST')return error('not_found',404);
  if(path!=='/v1/plans/ai-generate')return error('not_found',404);
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return error('forbidden_origin',403);
  if(!apiKey)return error('ai_not_configured',503);
  if(!checkRate(server.requestIP(req)?.address||'local'))return error('rate_limited',429);
  try{
    const body=await jsonBody(req);
    const plan=requirePlan(body.plan);
    const result=await aiReview(plan,body.sourceAnalyses);
    return response({...result,generator:'ai-reviewed'});
  }catch(e){const msg=e instanceof Error?e.message:'unavailable';
    if(msg==='payload_too_large')return error(msg,413);
    if(msg==='invalid_plan'||msg==='invalid_json'||e instanceof SyntaxError)return error('invalid_input',400);
    console.error('AI curriculum call failed:',msg);return error('ai_generation_failed',502);
  }
}});
console.log(`Learning OS Bun API at http://${hostname}:${port} (AI ${apiKey?'configured':'not configured'})`);
