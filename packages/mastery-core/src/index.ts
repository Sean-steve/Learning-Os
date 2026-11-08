/** Phase 5: evidence-aware progress engine. No external dependencies or invented mastery scores. */
export type SkillId = string;
export type EvidenceKind = 'practice-log' | 'artifact-reference' | 'external-claim';
export type Skill = { id: SkillId; name: string; outcome: string; category: 'template' | 'custom'; evidencePolicy: 'ordinary' | 'extraordinary-claim' };
export type Question = { id: string; prompt: string; choices: readonly string[]; correct: number; explanation: string };
export type Bank = { id: string; skillId: SkillId; title: string; description: string; questions: readonly Question[] };
export type Attempt = { id: string; bankId: string; skillId: SkillId; at: string; answers: Record<string, number>; correct: number; total: number; percent: number; confidence: number };
export type Evidence = { id: string; skillId: SkillId; at: string; kind: EvidenceKind; description: string; reference: string; verification: 'self-reported' | 'unverified-external-claim' };
export type SkillStatus = 'not-assessed' | 'in-progress' | 'knowledge-demonstrated' | 'practice-documented';
export type SkillSummary = { skillId: SkillId; status: SkillStatus; attempts: number; lastPercent: number | null; passingDays: number; practices: number; claims: number; verified: false; nextReview: string | null; label: string };
export type CoachingInput = { skills: readonly Skill[]; attempts: readonly Attempt[]; evidence: readonly Evidence[]; completedSessions: number; scheduledSessions: number; sleepQuality: number; dailyBudget: number; now?: string };
export type CoachAdvice = { id: string; skillId: string; mode: 'listen' | 'read' | 'practice'; minutes: number; headline: string; reason: string; activity: string; date: string; needsApproval: true; offline: true };

export const DEFAULT_SKILLS: readonly Skill[] = [
  {id:'foundations',name:'Learning foundations',outcome:'Understand recall, assessment and evidence boundaries',category:'template',evidencePolicy:'ordinary'},
  {id:'dream-recall',name:'Dream recall practice',outcome:'Consistently log remembered dreams without compromising rest',category:'template',evidencePolicy:'ordinary'},
  {id:'evidence-literacy',name:'Evidence literacy',outcome:'Distinguish observation from a scientifically verified claim',category:'template',evidencePolicy:'ordinary'},
  {id:'sleep-exploration',name:'Sleep-transition observations',outcome:'Record subjective experiences carefully; do not infer objective proof',category:'template',evidencePolicy:'extraordinary-claim'}
];

export const BANKS: readonly Bank[] = [
  {id:'foundation-check',skillId:'foundations',title:'Foundation check · Week 01',description:'Three short questions on good learning habits.',questions:[
    {id:'f1',prompt:'What should you do first after waking to improve dream recall?',choices:['Immediately check social media','Remain still and reconstruct the dream','Perform an intense workout','Skip recording short fragments'],correct:1,explanation:'Recall and record fragments before turning to distractions.'},
    {id:'f2',prompt:'Which is the strongest early progress indicator for this program?',choices:['A claim of guaranteed telekinesis','Number of videos opened','Consistently recorded dream recall','Hours of sleep sacrificed'],correct:2,explanation:'Recorded, repeatable observations are more informative than video counts or claims.'},
    {id:'f3',prompt:'Why do we label source material “unverified” until reviewed?',choices:['To separate claims and provenance from evidence','To avoid using any outside sources','Because transcripts are always wrong','Because every source has the same accuracy'],correct:0,explanation:'A source description is not evidence that an extraordinary claim is true.'}
  ]},
  {id:'recall-protocol',skillId:'dream-recall',title:'Dream recall protocol',description:'Check the practical steps and sleep-safe habits.',questions:[
    {id:'d1',prompt:'What is useful if you remember only one dream detail?',choices:['Discard it','Record the fragment without embellishment','Force yourself to stay awake all night'],correct:1,explanation:'Small, consistent entries can make recall easier to track.'},
    {id:'d2',prompt:'Which approach protects healthy sleep?',choices:['Increase awakenings every night','Stop all rest','Keep a stable sleep routine and ease off when tired'],correct:2,explanation:'Sleep quality comes before a training target.'},
    {id:'d3',prompt:'How should an unusual dream sensation be logged?',choices:['As a proven external event','As a subjective experience with context','As guaranteed telekinesis'],correct:1,explanation:'Describe the experience without converting it into unsupported proof.'}
  ]},
  {id:'evidence-check',skillId:'evidence-literacy',title:'Evaluating extraordinary claims',description:'Separate source claims, subjective experience and controlled testing.',questions:[
    {id:'e1',prompt:'What does a vivid out-of-body experience prove by itself?',choices:['A subjective experience was reported','Physical separation of consciousness','Telekinesis is established'],correct:0,explanation:'The experience may be meaningful, but does not independently establish a paranormal mechanism.'},
    {id:'e2',prompt:'What helps reduce bias in a hidden-target experiment?',choices:['Reveal targets before guessing','Select only successful trials','Pre-register rules and use blinded targets'],correct:2,explanation:'Blind protocols and pre-specified outcomes make conclusions more reliable.'},
    {id:'e3',prompt:'What is required for an independent verification claim?',choices:['A self-reported note','A completed video','Reviewable, independent evidence beyond this browser'],correct:2,explanation:'A personal note, screenshot or quiz score is not an independently verified paranormal result.'}
  ]}
];

const dayRe = /^\d{4}-\d{2}-\d{2}$/;
export function safeDay(day: string): string {
  if(!dayRe.test(day) || !Number.isFinite(Date.parse(day+'T12:00:00Z')) || new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day) throw new Error('invalid_day');
  return day;
}
export function dayFromISO(at: string): string { if(!Number.isFinite(Date.parse(at)))throw new Error('invalid_date');return new Date(at).toISOString().slice(0,10); }
export function dayAdd(day: string, count: number): string {safeDay(day);if(!Number.isSafeInteger(count)||Math.abs(count)>3650)throw new Error('invalid_days');const d = new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
export function gradeAssessment(bankId:string, answers:Record<string,number>, confidence:number, at=new Date().toISOString(), id?:string):Attempt {
  const bank=BANKS.find(b=>b.id===bankId);if(!bank)throw new Error('unknown_bank');
  if(!Number.isInteger(confidence)||confidence<1||confidence>5)throw new Error('invalid_confidence');
  dayFromISO(at);
  if(bank.questions.some(q=>!Number.isInteger(answers[q.id]) || answers[q.id]<0 || answers[q.id]>=q.choices.length))throw new Error('incomplete_answers');
  const correct=bank.questions.filter(q=>answers[q.id]===q.correct).length;
  return {id:id||globalThis.crypto.randomUUID(),bankId,skillId:bank.skillId,at,answers:Object.fromEntries(bank.questions.map(q=>[q.id,answers[q.id]])),correct,total:bank.questions.length,percent:Math.round(correct/bank.questions.length*100),confidence};
}
export function createEvidence(input:{skillId:string;kind:EvidenceKind;description:string;reference?:string;at?:string;id?:string},knownSkills:readonly Skill[]=DEFAULT_SKILLS):Evidence {
  if(!knownSkills.some(s=>s.id===input.skillId))throw new Error('unknown_skill');
  const desc=input.description.trim();if(desc.length<20||desc.length>1000)throw new Error('evidence_description_20_to_1000_chars');
  const reference=(input.reference||'').trim();if(reference.length>500)throw new Error('reference_too_long');
  const kinds:readonly EvidenceKind[]=['practice-log','artifact-reference','external-claim'];if(!kinds.includes(input.kind))throw new Error('invalid_evidence_kind');
  const at=input.at||new Date().toISOString();dayFromISO(at);
  return {id:input.id||globalThis.crypto.randomUUID(),skillId:input.skillId,kind:input.kind,description:desc,reference,at,verification:input.kind==='external-claim'?'unverified-external-claim':'self-reported'};
}
export function createCustomSkill(name:string,outcome:string,existing:readonly Skill[],id?:string):Skill {
  name=name.trim();outcome=outcome.trim();if(name.length<3||name.length>80||outcome.length<12||outcome.length>240)throw new Error('invalid_skill');
  if(existing.some(s=>s.name.toLowerCase()===name.toLowerCase()))throw new Error('duplicate_skill');
  return {id:id||globalThis.crypto.randomUUID(),name,outcome,category:'custom',evidencePolicy:'ordinary'};
}
/** Two passing retrievals on DIFFERENT UTC dates are needed to show knowledge; never infer independent verification. */
export function summarizeSkill(skillId:string,attempts:readonly Attempt[],evidence:readonly Evidence[],nowDay=dayFromISO(new Date().toISOString())):SkillSummary {
  safeDay(nowDay);
  const relevant=attempts.filter(a=>a.skillId===skillId && a.total>0 && a.correct>=0 && a.correct<=a.total).sort((a,b)=>a.at.localeCompare(b.at));
  const passingDays=new Set(relevant.filter(a=>a.percent>=80 && a.correct/a.total>=.8).map(a=>dayFromISO(a.at))).size;
  const records=evidence.filter(e=>e.skillId===skillId);
  const practices=records.filter(e=>e.kind!=='external-claim').length;
  const claims=records.length-practices;
  const knowledge=passingDays>=2;
  const status:SkillStatus=knowledge&&practices>0?'practice-documented':knowledge?'knowledge-demonstrated':relevant.length||practices?'in-progress':'not-assessed';
  const latest=relevant.at(-1);
  const lag=passingDays===0?1:passingDays===1?2:passingDays===2?4:Math.min(21,7+passingDays*2);
  const nextReview=latest?dayAdd(dayFromISO(latest.at),lag):null;
  const label=status==='practice-documented'?'Knowledge + self-reported practice':status==='knowledge-demonstrated'?'Repeated knowledge checks':status==='in-progress'?'Progress in progress':'Not assessed';
  return {skillId,status,attempts:relevant.length,lastPercent:latest?.percent??null,passingDays,practices,claims,verified:false,nextReview,label};
}
export function summarizeProgram(skills:readonly Skill[],attempts:readonly Attempt[],evidence:readonly Evidence[],sessions:readonly {id:string;day:string;minutes:number}[],completed:readonly string[],nowDay=dayFromISO(new Date().toISOString())){
  const completedSet=new Set(completed); const skillSummaries=skills.map(s=>summarizeSkill(s.id,attempts,evidence,nowDay));
  const done=sessions.filter(s=>completedSet.has(s.id));
  const due=skillSummaries.filter(s=>s.nextReview!==null && s.nextReview<=nowDay);
  const accuracy=attempts.length?Math.round(attempts.reduce((total,a)=>total+a.correct,0)/attempts.reduce((total,a)=>total+a.total,0)*100):null;
  return {sessionsDone:done.length,recordedMinutes:done.reduce((n,s)=>n+s.minutes,0),attempts:attempts.length,practiceRecords:evidence.filter(e=>e.kind!=='external-claim').length,externalClaims:evidence.filter(e=>e.kind==='external-claim').length,accuracy,knowledgeShown:skillSummaries.filter(s=>s.passingDays>=2).length,verified:0,due,skillSummaries};
}
/** Deterministic explainable coaching, no clinical advice, automatic grades or calendar modification. */
export function recommendNext(input:CoachingInput):CoachAdvice {
  const now=dayFromISO(input.now||new Date().toISOString());safeDay(now);
  const summaries=input.skills.map(s=>({skill:s,summary:summarizeSkill(s.id,input.attempts,input.evidence,now)}));
  const due=summaries.find(s=>s.summary.nextReview!==null && s.summary.nextReview<=now);
  const weak=summaries.find(s=>s.summary.lastPercent!==null && s.summary.lastPercent<80);
  const candidate=due||weak||summaries.find(s=>s.summary.attempts===0)||summaries[0];
  const skill=candidate?.skill||DEFAULT_SKILLS[0];
  const current=candidate?.summary||summarizeSkill(skill.id,[],[],now);
  const sleep=Number(input.sleepQuality);
  const budget=Number(input.dailyBudget);
  if(!Number.isFinite(sleep)||sleep<1||sleep>10||!Number.isFinite(budget)||budget<5||budget>240)throw new Error('invalid_coaching_input');
  const safeMinutes=sleep<=4?10:Math.min(20,Math.max(10,Math.floor(budget/2)));
  const mode:'listen'|'read'|'practice'=sleep<=4?'listen':current.attempts>0?'practice':'listen';
  const headline=sleep<=4?'Protect your rest; take a light learning day':due?'Review a due learning skill':weak?'Revisit a weak knowledge check':current.attempts===0?'Begin with one short foundation review':'Turn knowledge into practice';
  const reason=sleep<=4?'Low rest rating takes priority; avoid adding night work.':due?`${skill.name} is due for recall review.`:weak?`${skill.name} has a latest score below 80%.`:current.attempts===0?`${skill.name} has no knowledge-check evidence yet.`:'Quiz completion alone is not proof of applied mastery.';
  const activity=mode==='listen'?`Listen to a short lesson about ${skill.name} and note one takeaway.`:`Practice ${skill.name} and record one specific observation.`;
  return {id:'coach-'+skill.id+'-'+now,skillId:skill.id,mode,minutes:safeMinutes,headline,reason,activity,date:now,needsApproval:true,offline:true};
}
