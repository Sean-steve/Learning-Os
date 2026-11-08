/** Learning OS Phase 2 — deterministic, auditable learning engine. No model or network dependency. */
export type LearningMode = 'listen'|'read'|'watch'|'practice';
export type ResourceKind = 'video'|'playlist'|'pdf'|'book'|'audio'|'website';
export type ContentOrigin = 'pasted'|'pdf-extracted'|'text-file';
export type Verification = 'user-provided'|'unverified-claim'|'requires-review';

export interface SourceAnalysis {
  id: string;
  title: string;
  kind: ResourceKind;
  url?: string;
  origin: ContentOrigin;
  contentLength: number;
  excerpts: { id: string; text: string; locator: string }[];
  takeaways: { text: string; excerptId: string }[];
  warnings: string[];
  processedAt: string;
  verification: Verification;
}
export interface PlanPreferences {
  days: 30|60|90|180;
  minutesPerDay: number;
  listeningShare: number;
  readingBlockMinutes: number;
  daysPerWeek: number;
  practiceMinutes: number;
  startDate: string;
}
export interface PlanTask {
  id: string;
  date: string;
  week: number;
  day: number;
  mode: LearningMode|'rest';
  minutes: number;
  title: string;
  description: string;
  sourceId?: string;
  evidence: string;
}
export interface PlanStage { index: number; name: string; days: string; outcome: string; gate: string; }
export interface LearningPlan {
  id: string;
  title: string;
  outcome: string;
  createdAt: string;
  generator: 'structured-offline'|'ai-reviewed';
  preferences: PlanPreferences;
  stages: PlanStage[];
  tasks: PlanTask[];
  sources: { id: string; name: string; analyzed: boolean }[];
  caveats: string[];
  aiGuidance?: string[];
}
export interface PlanInput { title: string; outcome: string; preferences: PlanPreferences; sourceAnalyses?: SourceAnalysis[]; sources?: {id:string;name:string;kind:ResourceKind}[]; id?:string; }
export interface CheckIn { complete: number; scheduled: number; availableMinutes: number; sleepQuality: number; difficulty: 'easy'|'balanced'|'difficult'; }
export interface Adjustment { recommendation: string; nextMinutes: number; suggestedMode: LearningMode; reason: string; keepSleep: boolean; }

const bounded = (n:number,min:number,max:number) => Math.min(max,Math.max(min,Math.round(n)));
function utcDate(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Enter a valid start date in YYYY-MM-DD format.');
  const d = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==day) throw new Error('Invalid start date.');
  return d;
}
function dateAt(day:string, offset:number): string { const d=utcDate(day); d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10); }
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
export function checkPreferences(p:PlanPreferences):PlanPreferences {
  if (![30,60,90,180].includes(p.days)) throw new Error('Timeline must be 30, 60, 90 or 180 days.');
  if (!Number.isFinite(p.minutesPerDay)||p.minutesPerDay<15||p.minutesPerDay>180) throw new Error('Daily minutes must be 15–180.');
  if (!Number.isFinite(p.listeningShare)||p.listeningShare<0||p.listeningShare>1) throw new Error('Listening share must be 0–1.');
  if (!Number.isFinite(p.readingBlockMinutes)||p.readingBlockMinutes<5||p.readingBlockMinutes>45) throw new Error('Reading block must be 5–45 minutes.');
  if (!Number.isFinite(p.daysPerWeek)||p.daysPerWeek<3||p.daysPerWeek>7) throw new Error('Days/week must be 3–7.');
  if (!Number.isFinite(p.practiceMinutes)||p.practiceMinutes<0||p.practiceMinutes>90) throw new Error('Practice minutes must be 0–90.');
  utcDate(p.startDate);
  return p;
}

/** Extract only what the user pasted or a local-file parser supplied. Never claim external verification. */
export function analyzeSourceText(input:{id:string;title:string;kind:ResourceKind;url?:string;text:string;origin:ContentOrigin;now?:string;}):SourceAnalysis {
  const title=clean(input.title);
  if (!title || title.length>160) throw new Error('Source title must be 1–160 characters.');
  if (input.url && !isSafeUrl(input.url)) throw new Error('Source URL must be an http(s) link.');
  if (!input.text || clean(input.text).length<40) throw new Error('Supply at least 40 characters of text or transcript.');
  if (input.text.length>200_000) throw new Error('Content exceeds the 200,000 character local processing limit.');
  const normalized=input.text.replace(/\r\n?/g,'\n').trim();
  // Each excerpt retains exact user-supplied wording (only surrounding whitespace collapsed).
  const blocks=normalized.split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/g).map(clean).filter(Boolean);
  const excerpts:{id:string;text:string;locator:string}[]=[];
  for(const block of blocks){
    let remaining=block;
    while (remaining.length){
      const chunk=remaining.slice(0,600);
      const excerptId=`${input.id}-e${excerpts.length+1}`;
      excerpts.push({id:excerptId,text:chunk,locator:`Extract ${excerpts.length+1}`});
      remaining=remaining.slice(600);
      if(excerpts.length>=100)break;
    }
    if(excerpts.length>=100)break;
  }
  const takeaways=excerpts.filter(e=>/\b(learn|practice|remember|important|step|focus|habit|repeat|observe|review|exercise|technique|method)\b/i.test(e.text)).slice(0,8).map(e=>({text:e.text.slice(0,220),excerptId:e.id}));
  const unverified=/\b(telekinesis|psychokinesis|psychic|astral|out.of.body|guaranteed|supernatural|manifestation)\b/i.test(normalized);
  const warnings=['User-supplied material only: no automatic URL, video or publisher verification.','Quoted excerpts are not a scientific fact-check.'];
  if(unverified)warnings.push('This material discusses extraordinary or potentially unverified claims. Keep experiences separate from objective evidence.');
  if(excerpts.length===100)warnings.push('Content was truncated for local review; import in smaller sections for full coverage.');
  return {id:input.id,title,kind:input.kind,url:input.url,origin:input.origin,contentLength:normalized.length,excerpts,takeaways,warnings,verification:unverified?'unverified-claim':'user-provided',processedAt:input.now||new Date().toISOString()};
}
export function isSafeUrl(url:string):boolean {try {const p=new URL(url);return ['https:','http:'].includes(p.protocol) && Boolean(p.hostname);}catch{return false;}}

const stageDefs:[string,string,string][]=[
  ['Foundations','Build a baseline, vocabulary, and a repeatable routine.','Record baseline evidence and explain fundamentals.'],
  ['Guided practice','Practice in short, structured sessions with feedback.','Demonstrate several consistent sessions and identify mistakes.'],
  ['Independent application','Perform authentic exercises with less guidance.','Complete a practical demonstration with a recorded result.'],
  ['Review & verification','Retest, review source claims and plan the next cycle.','Complete a final assessment and distinguish evidence from opinion.']
];
function stageFor(day:number,days:number):number {return Math.min(3,Math.floor((day-1)*4/days));}
export function createPlan(input:PlanInput):LearningPlan {
  const title=clean(input.title).slice(0,140),outcome=clean(input.outcome).slice(0,600);
  if(title.length<3)throw new Error('Enter a learning goal of at least 3 characters.');
  const p=checkPreferences(input.preferences);const analyses=input.sourceAnalyses||[];
  const sources=(input.sources||[]).slice(0,30);
  const vetted=sources.filter(s=>analyses.some(a=>a.id===s.id && a.excerpts.length));
  const stages=stageDefs.map(([name,outcome,gate],index)=>{
    const first=Math.floor((p.days*index)/4)+1;
    const last=Math.floor((p.days*(index+1))/4);
    return {index:index+1,name,days:`Days ${first}–${last}`,outcome,gate};
  });
  const tasks:PlanTask[]=[];
  // Spread active days inside the week; after a missed day, do not silently stack tasks.
  for(let i=0;i<p.days;i++){
    const day=i+1,week=Math.floor(i/7)+1,date=dateAt(p.startDate,i),slot=i%7;
    const active=slot < p.daysPerWeek;
    if(!active){tasks.push({id:`t-${day}`,date,week,day,mode:'rest',minutes:0,title:'Rest & optional light review',description:'Protect recovery. No catching up by sacrificing sleep.',evidence:'No completion required.'});continue;}
    const indexInWeek=slot;
    const listenQuota=Math.round(p.daysPerWeek*p.listeningShare);
    const audio=indexInWeek < listenQuota;
    const mode:LearningMode=audio?'listen':'read';
    const readMinutes=bounded(Math.min(p.minutesPerDay,p.readingBlockMinutes),5,45);
    const studyMinutes=audio?Math.max(5,p.minutesPerDay-Math.min(p.practiceMinutes,p.minutesPerDay-5)):readMinutes;
    const practiceMinutes=audio?Math.min(p.practiceMinutes,p.minutesPerDay-studyMinutes):Math.min(p.practiceMinutes,p.minutesPerDay-readMinutes);
    const src=vetted.length?vetted[(day-1)%vetted.length]:undefined;
    const phase=stageDefs[stageFor(day,p.days)][0];
    const sourceTitle=src?.name;
    const action=mode==='listen'?'Listen and explain the main idea aloud':'Read a short section and note the key idea';
    const claimCaution=/astral|psychic|telekinesis|consciousness|lucid/i.test(title)
      ?'Separate subjective experience from objective evidence. Keep normal sleep.'
      :'Compare claimed outcomes with observable practice results.';
    tasks.push({id:`t-${day}`,date,week,day,mode,minutes:studyMinutes+practiceMinutes,
      title:`${phase} · ${mode==='listen'?'Listen':'Read'} + practice`,
      description:`${sourceTitle?`${action} from ${sourceTitle}. `:`${action} from your own notes or verified course material. `}Then spend ${practiceMinutes} min applying one concept. ${claimCaution}`,
      sourceId:src?.id,evidence:'Log one takeaway, one practical action, and a measurable result.'});
  }
  return {id:input.id||`lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,title,outcome:outcome||'Demonstrate progress through practical tasks and recorded assessments.',createdAt:new Date().toISOString(),generator:'structured-offline',preferences:{...p},stages,tasks,sources:sources.map(s=>({id:s.id,name:s.name,analyzed:vetted.some(v=>v.id===s.id)})),caveats:['This is a structured offline curriculum, not an AI-generated or professionally verified course.','Adding a YouTube URL does not import or validate its transcript.','Milestones are progress checks, not guaranteed outcomes.']};
}
export function proposeAdjustment(plan:LearningPlan,checkIn:CheckIn):Adjustment {
  if(!Number.isFinite(checkIn.scheduled)||checkIn.scheduled<=0||checkIn.complete<0||checkIn.complete>checkIn.scheduled)throw new Error('Check-in counts are invalid.');
  const p=plan.preferences,ratio=checkIn.complete/checkIn.scheduled;
  const sleepLow=checkIn.sleepQuality<5;
  const reduce=ratio<0.6||checkIn.difficulty==='difficult'||sleepLow;
  const nextMinutes=bounded(Math.min(checkIn.availableMinutes,reduce?Math.max(15,p.minutesPerDay-15):p.minutesPerDay),15,180);
  return {recommendation:reduce?'Use shorter sessions next week; keep missed lessons optional.':'Keep your routine; advance only if your milestone evidence supports it.',nextMinutes,
    suggestedMode:p.listeningShare>=0.5?'listen':'read',
    reason:sleepLow?'Protect sleep first.':ratio<0.6?'Adherence below 60%; reduce session load.':checkIn.difficulty==='difficult'?'Learner reported high difficulty.':'Current practice load is sustainable.',keepSleep:true};
}
