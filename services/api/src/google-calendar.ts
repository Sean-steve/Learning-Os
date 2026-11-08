/** Explicit single-user local development integration only.
 * OAuth credentials and tokens NEVER travel to GitHub Pages or Vite bundle.
 * Do not expose this API publicly until first-party login/identity and encrypted storage exist.
 */
import { googleEventId, googleLocalMode, googlePayload, validateGoogleEvent } from './google-calendar-core.ts';
import type { GoogleLearningEvent } from './google-calendar-core.ts';
const env=process.env;
const webOrigin=env.WEB_ORIGIN||'http://localhost:5173';
const redirectUri=env.GOOGLE_REDIRECT_URI||'';
const clientId=env.GOOGLE_CLIENT_ID||'';
const clientSecret=env.GOOGLE_CLIENT_SECRET||'';
const configured=googleLocalMode(env);
const scope=['https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar.freebusy'];
type Tokens={access:string;refresh?:string;expiresAt:number;lastUsed:number};
const states=new Map<string,{verifier:string;created:number}>();
const sessions=new Map<string,Tokens>();
const rates=new Map<string,{times:number[]}>();
const apiHeaders={'Access-Control-Allow-Origin':webOrigin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type, X-Learning-Intent','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:apiHeaders});
const err=(message:string,status:number)=>json({error:message},status);
const cookie=(name:string,req:Request)=>req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
const validOrigin=(req:Request)=>req.headers.get('Origin')===webOrigin;
const cleanup=()=>{
 const now=Date.now();for(const [k,v] of states)if(now-v.created>600_000)states.delete(k);
 for(const [k,v] of sessions)if(now-v.lastUsed>43_200_000)sessions.delete(k);
};
async function codeChallenge(v:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
async function exchange(fields:URLSearchParams){
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fields,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('google_token_exchange_failed');
 return await response.json() as {access_token?:string;refresh_token?:string;expires_in?:number};
}
async function token(session:Tokens){
 if(Date.now()<session.expiresAt-60_000)return session.access;
 if(!session.refresh)throw Error('google_reconnect_required');
 const payload=await exchange(new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:session.refresh,grant_type:'refresh_token'}));
 if(!payload.access_token)throw Error('google_reconnect_required');
 session.access=payload.access_token;session.expiresAt=Date.now()+(payload.expires_in||3600)*1000;return session.access;
}
async function calendarFetch(session:Tokens,endpoint:string,method='GET',data?:unknown){
 const t=await token(session);
 const response=await fetch('https://www.googleapis.com/calendar/v3'+endpoint,{
  method,headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)
 });return response;
}
function throttle(sessionId:string){const now=Date.now(),times=(rates.get(sessionId)?.times||[]).filter(t=>now-t<60_000);if(times.length>=15)return false;times.push(now);rates.set(sessionId,{times});return true;}
async function body(req:Request){if(Number(req.headers.get('content-length')||0)>10000)throw Error('too_large');const text=await req.text();if(text.length>10000)throw Error('too_large');return JSON.parse(text) as unknown;}
function finishRedirect(url:string,cookies:string[]){const h=new Headers({'Location':url,'Referrer-Policy':'no-referrer','Cache-Control':'no-store'});cookies.forEach(c=>h.append('Set-Cookie',c));return new Response(null,{status:302,headers:h});}
export async function googleCalendarRoute(req:Request):Promise<Response>{
 cleanup();const url=new URL(req.url),path=url.pathname;
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:apiHeaders});
 if(path==='/v1/google/status'){
  if(req.method!=='GET')return err('method_not_allowed',405);
  const sid=cookie('los_google_sid',req);return json({enabled:configured,connected:configured&&sessions.has(sid),storage:'server-memory-only',productionReady:false});
 }
 if(!configured)return err('google_calendar_not_configured_for_local_development',503);
 if(path==='/v1/google/start'&&req.method==='GET'){
  if(states.size>=50)return err('too_many_pending_connections',429);
  const state=random(),verifier=random();states.set(state,{verifier,created:Date.now()});
  const params=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:scope.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:await codeChallenge(verifier),code_challenge_method:'S256'});
  return finishRedirect('https://accounts.google.com/o/oauth2/v2/auth?'+params.toString(),['los_google_state='+state+'; HttpOnly; SameSite=Lax; Path=/v1/google; Max-Age=600']);
 }
 if(path==='/v1/google/callback'&&req.method==='GET'){
  const state=url.searchParams.get('state')||'';
  const pending=states.get(state);states.delete(state);
  if(!state||cookie('los_google_state',req)!==state||!pending||Date.now()-pending.created>600_000)return err('invalid_oauth_state',403);
  if(url.searchParams.has('error'))return finishRedirect(webOrigin+'/#calendar',['los_google_state=; HttpOnly; SameSite=Lax; Path=/v1/google; Max-Age=0']);
  const code=url.searchParams.get('code')||'';if(!code)return err('missing_oauth_code',400);
  try{
   const result=await exchange(new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:pending.verifier}));
   if(!result.access_token)throw Error('missing_access_token');
   const sid=random();sessions.set(sid,{access:result.access_token,refresh:result.refresh_token,expiresAt:Date.now()+(result.expires_in||3600)*1000,lastUsed:Date.now()});
   return finishRedirect(webOrigin+'/#calendar',['los_google_state=; HttpOnly; SameSite=Lax; Path=/v1/google; Max-Age=0','los_google_sid='+sid+'; HttpOnly; SameSite=Lax; Path=/v1/google; Max-Age=43200']);
  }catch{return err('google_authentication_failed',502);}
 }
 const sid=cookie('los_google_sid',req),session=sessions.get(sid);
 if(!session)return err('connect_google_calendar_first',401);
 session.lastUsed=Date.now();
 if(path==='/v1/google/freebusy'&&req.method==='GET'){
  if(!validOrigin(req))return err('forbidden_origin',403);
  const start=url.searchParams.get('start')||'',end=url.searchParams.get('end')||'';
  const a=Date.parse(start),b=Date.parse(end);if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>15*86_400_000)return err('invalid_time_range',400);
  try{
   const response=await calendarFetch(session,'/freeBusy','POST',{timeMin:new Date(a).toISOString(),timeMax:new Date(b).toISOString(),items:[{id:'primary'}]});
   if(!response.ok)return err('google_availability_unavailable',502);
   const data=await response.json() as {calendars?:{primary?:{busy?:{start:string;end:string}[]}}};return json({busy:data.calendars?.primary?.busy||[]});
  }catch{return err('google_availability_unavailable',502);}
 }
 if(req.method!=='POST'||!validOrigin(req)||req.headers.get('X-Learning-Intent')!=='manual-calendar-sync')return err('forbidden_action',403);
 if(!throttle(sid))return err('rate_limited',429);
 if(path==='/v1/google/disconnect'){
  sessions.delete(sid);rates.delete(sid);
  if(session.refresh)void fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:session.refresh}),signal:AbortSignal.timeout(5000)}).catch(()=>{});
  const h=new Headers(apiHeaders);h.append('Set-Cookie','los_google_sid=; HttpOnly; SameSite=Lax; Path=/v1/google; Max-Age=0');return Response.json({connected:false},{headers:h});
 }
 if(path==='/v1/google/event'){
  let event:GoogleLearningEvent;
  try{event=validateGoogleEvent(await body(req));}catch{return err('invalid_event',400);}
  try{
   const eventId=await googleEventId(event.id),payload=googlePayload(event,eventId);
   const existing=await calendarFetch(session,'/calendars/primary/events/'+eventId);
   if(existing.status!==404){
    if(!existing.ok)return err('google_event_lookup_failed',502);
    const value=await existing.json() as {extendedProperties?:{private?:{learningOsSessionId?:string}}};
    if(value.extendedProperties?.private?.learningOsSessionId!==event.id)return err('calendar_event_id_conflict',409);
   }
   const isNew=existing.status===404;
   const sent=await calendarFetch(session,isNew?'/calendars/primary/events':'/calendars/primary/events/'+eventId,isNew?'POST':'PUT',payload);
   if(!sent.ok)return err('google_event_sync_failed',502);
   const result=await sent.json() as {id?:string;htmlLink?:string};return json({synced:true,id:result.id,url:result.htmlLink||null,created:isNew});
  }catch{return err('google_event_sync_failed',502);}
 }
 return err('not_found',404);
}
