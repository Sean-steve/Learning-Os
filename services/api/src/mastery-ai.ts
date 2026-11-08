/** Opt-in, loopback-only explanation endpoint. Never accepts journal, skill titles or raw source text. */
const maxPayload=2000;
const usage=new Map<string,{count:number;until:number}>();
const json=(value:unknown,status=200,origin='http://localhost:5173')=>Response.json(value,{status,headers:{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Content-Type':'application/json'}});
function checkedNumber(value:unknown,min:number,max:number):number{
  if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>max)throw Error('invalid_metrics');return value;
}
export async function masteryAiRoute(req:Request, config:{origin:string;hostname:string;apiKey:string;model:string}):Promise<Response>{
  if(!['localhost','127.0.0.1','::1'].includes(config.hostname))return json({error:'private_loopback_only'},403,config.origin);
  if(req.headers.get('origin')&&req.headers.get('origin')!==config.origin)return json({error:'invalid_origin'},403,config.origin);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':config.origin,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}});
  if(req.method!=='POST')return json({error:'not_found'},404,config.origin);
  if(!config.apiKey)return json({error:'ai_not_configured'},503,config.origin);
  const now=Date.now();const prior=usage.get('local')||{count:0,until:now+3600000};
  if(now>prior.until){prior.count=0;prior.until=now+3600000;}if(prior.count>=10)return json({error:'rate_limited'},429,config.origin);prior.count++;usage.set('local',prior);
  let payload:Record<string,number>;
  try{
    const text=await req.text();if(text.length>maxPayload)throw Error('too_large');
    const raw=JSON.parse(text) as Record<string,unknown>;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid');
    const names=['completedSessions','assessmentAttempts','knowledgeShown','practiceRecords','dueReviews','sleepQuality','dailyBudget'];
    if(Object.keys(raw).some(x=>!names.includes(x)))throw Error('unexpected_field');
    payload={completedSessions:checkedNumber(raw.completedSessions,0,100000),assessmentAttempts:checkedNumber(raw.assessmentAttempts,0,100000),knowledgeShown:checkedNumber(raw.knowledgeShown,0,500),practiceRecords:checkedNumber(raw.practiceRecords,0,100000),dueReviews:checkedNumber(raw.dueReviews,0,500),sleepQuality:checkedNumber(raw.sleepQuality,1,10),dailyBudget:checkedNumber(raw.dailyBudget,5,240)};
  }catch{return json({error:'invalid_aggregate_metrics'},400,config.origin)}
  try{
    const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,max_output_tokens:270,input:[{role:'system',content:'You are a low-pressure learning coach. Respond in 2-4 short sentences with clear next action. Metrics are self-reported browser-local aggregates. Never invent mastery, degrees or independent verification. A low sleep rating means protect rest and reduce work. No mental-health diagnosis. Never ask for sensitive personal details or claim to have read private records.'},{role:'user',content:JSON.stringify(payload)}]}),signal:AbortSignal.timeout(25000)});
    if(!upstream.ok)throw Error('ai_service');
    const data=await upstream.json() as {output?:{content?:{type:string;text?:string}[]}[];output_text?:string};
    const output=(data.output_text||data.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('')||'').trim().slice(0,900);
    if(output.length<12)throw Error('invalid_response');
    return json({guidance:output,kind:'optional-ai',automaticChanges:false},200,config.origin);
  }catch{return json({error:'ai_unavailable'},502,config.origin)}
}
