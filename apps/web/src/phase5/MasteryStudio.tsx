import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, BarChart3, BookOpenCheck, BrainCircuit, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, FileCheck2, Headphones, Lightbulb, LockKeyhole, NotebookPen, Plus, RefreshCw, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import { BANKS, DEFAULT_SKILLS, createCustomSkill, createEvidence, gradeAssessment, recommendNext, summarizeProgram, summarizeSkill } from '../../../../packages/mastery-core/src/index';
import type { Attempt, Evidence, EvidenceKind, Skill, CoachAdvice } from '../../../../packages/mastery-core/src/index';
import { DEFAULT_RULES, localDay, nextSafeSlot } from '../../../../packages/scheduling-core/src/index';
import type { ScheduledActivity, ScheduleRules } from '../../../../packages/scheduling-core/src/index';
import './mastery.css';

type View = 'assessments'|'analytics'|'coach';
type Setter<T> = (v:T|((p:T)=>T))=>void;
interface Props {
  view: View;
  nav:(route:any)=>void;
  notify:(message:string)=>void;
  completed:string[];
  sessions:ScheduledActivity[];
  setSessions:Setter<ScheduledActivity[]>;
  journal:{id:string;date:string;title:string}[];
  prefs:{dailyGoal:number;audioFirst:boolean};
}
const PREFIX='los.phase5.';
function stored<T>(key:string,initial:T):[T,Setter<T>]{
  const [value,setValue]=useState<T>(()=>{try{const raw=localStorage.getItem(PREFIX+key);return raw?JSON.parse(raw) as T:initial}catch{return initial}});
  useEffect(()=>{try{localStorage.setItem(PREFIX+key,JSON.stringify(value))}catch{/* browser storage may be blocked */}},[value,key]);
  useEffect(()=>{const listener=(e:StorageEvent)=>{if(e.key!==PREFIX+key||!e.newValue)return;try{setValue(JSON.parse(e.newValue) as T)}catch{/* ignore malformed cross-tab values */}};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener)},[key]);
  return [value,setValue];
}
const localAPI=()=>['localhost','127.0.0.1'].includes(location.hostname);
const apiBase=String(import.meta.env.VITE_LEARNING_API_URL||'http://127.0.0.1:3005').replace(/\/$/,'');
const formatDay=(iso:string)=>{try{return new Date(iso).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}catch{return iso}};
const info=(message:string)=><p className="p5-hint"><ShieldCheck size={16}/>{message}</p>;
const badge=(label:string,tone='neutral')=><span className={'p5-badge p5-badge-'+tone}>{label}</span>;
function SectionHeader({eyebrow,title,description}:{eyebrow:string;title:string;description:string}) {return <div className="p5-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>}

export default function MasteryStudio({view,nav,notify,completed,sessions,setSessions,journal,prefs}:Props){
  const [attempts,setAttempts]=stored<Attempt[]>('attempts',[]);
  const [evidence,setEvidence]=stored<Evidence[]>('evidence',[]);
  const [addedSkills,setAddedSkills]=stored<Skill[]>('custom-skills',[]);
  const [sleepQuality,setSleepQuality]=stored<number>('sleep-rating',7);
  const [bankId,setBankId]=useState(BANKS[0].id);
  const [answers,setAnswers]=useState<Record<string,number>>({});
  const [confidence,setConfidence]=useState(3);
  const [result,setResult]=useState<Attempt|null>(null);
  const [skillId,setSkillId]=useState(DEFAULT_SKILLS[0].id);
  const [evidenceKind,setEvidenceKind]=useState<EvidenceKind>('practice-log');
  const [evidenceText,setEvidenceText]=useState('');
  const [reference,setReference]=useState('');
  const [newSkillName,setNewSkillName]=useState('');
  const [newSkillOutcome,setNewSkillOutcome]=useState('');
  const [evidenceError,setEvidenceError]=useState('');
  const [coachError,setCoachError]=useState('');
  const [aiGuidance,setAiGuidance]=useState('');
  const [askingAI,setAskingAI]=useState(false);
  const skills=useMemo(()=>[...DEFAULT_SKILLS,...addedSkills], [addedSkills]);
  const bank=BANKS.find(b=>b.id===bankId)||BANKS[0];
  const summary=useMemo(()=>summarizeProgram(skills,attempts,evidence,sessions,completed,localDay(new Date())),[skills,attempts,evidence,sessions,completed]);
  const advice=useMemo(()=>recommendNext({skills,attempts,evidence,completedSessions:summary.sessionsDone,scheduledSessions:sessions.length,sleepQuality,dailyBudget:prefs.dailyGoal}),[skills,attempts,evidence,summary.sessionsDone,sessions.length,sleepQuality,prefs.dailyGoal]);
  const relevantAttempts=attempts.filter(a=>a.bankId===bank.id).sort((a,b)=>b.at.localeCompare(a.at));
  const scoreReady=bank.questions.every(q=>answers[q.id]!==undefined);
  const onBank=(id:string)=>{setBankId(id);setResult(null);setAnswers({});setConfidence(3)};
  const submit=(e:FormEvent)=>{e.preventDefault();try{const attempt=gradeAssessment(bank.id,answers,confidence);setAttempts(p=>[...p,attempt]);setResult(attempt);notify('Knowledge check saved in this browser. Mastery requires repeated evidence.')}catch{notify('Answer all questions before submitting.')}};
  const retake=()=>{setAnswers({});setResult(null);setConfidence(3)};
  const addEvidence=(e:FormEvent)=>{e.preventDefault();try{const record=createEvidence({skillId,kind:evidenceKind,description:evidenceText,reference},skills);setEvidence(p=>[...p,record]);setEvidenceText('');setReference('');setEvidenceError('');notify('Self-reported evidence saved; not independently verified.')}catch(error){setEvidenceError(error instanceof Error?error.message:'Invalid practice record')}};
  const addSkill=(e:FormEvent)=>{e.preventDefault();try{const next=createCustomSkill(newSkillName,newSkillOutcome,skills);setAddedSkills(p=>[...p,next]);setSkillId(next.id);setNewSkillName('');setNewSkillOutcome('');setEvidenceError('');notify('Custom skill created. Add practice evidence to track it.')}catch(error){setEvidenceError(error instanceof Error?error.message:'Invalid skill')}};
  const proposeSession=()=>{
    const day=localDay(new Date());
    const start:ScheduledActivity={id:crypto.randomUUID(),day,time:'18:00',minutes:advice.minutes,title:advice.activity.slice(0,125),mode:advice.mode};
    let rules:ScheduleRules={...DEFAULT_RULES};
    try{const v=JSON.parse(localStorage.getItem('los.phase4.schedule.settings')||'null') as Partial<ScheduleRules>|null;if(v){rules={...rules,...v,activeWeekdays:Array.isArray(v.activeWeekdays)?v.activeWeekdays:rules.activeWeekdays}}}catch{/* use safe defaults */}
    const slot=nextSafeSlot(start,sessions,rules,[],day,14);
    if(!slot){setCoachError('No conflict-free study slot found in the next 14 days. Review your limits in Schedule.');return;}
    setSessions(p=>[...p,slot]);setCoachError('');notify(`You approved a ${slot.minutes}-minute ${slot.mode} session on ${slot.day} at ${slot.time}.`);
  };
  const requestAI=async()=>{
    if(!localAPI()){setCoachError('Private AI coaching is available only when Learning OS runs locally with Bun.');return}
    setAskingAI(true);setCoachError('');
    try{
      const payload={completedSessions:summary.sessionsDone,assessmentAttempts:attempts.length,knowledgeShown:summary.knowledgeShown,practiceRecords:summary.practiceRecords,dueReviews:summary.due.length,sleepQuality,dailyBudget:prefs.dailyGoal};
      const response=await fetch(apiBase+'/v1/mastery/ai-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!response.ok)throw Error('AI unavailable');const result=await response.json() as {guidance:string};setAiGuidance(result.guidance||'No AI explanation available.');
    }catch{setCoachError('Private AI coaching unavailable. Offline guidance is still available.')}finally{setAskingAI(false)}
  };
  const skillCard=(s:Skill)=>{const x=summarizeSkill(s.id,attempts,evidence,localDay(new Date()));return <article className="p5-skill" key={s.id}><div className="p5-skill-line"><div><h3>{s.name}</h3><p>{s.outcome}</p></div>{badge(x.label,x.status==='not-assessed'?'neutral':x.status==='in-progress'?'amber':'mint')}</div><div className="p5-skill-stats"><span>{x.attempts} knowledge checks</span><span>{x.practices} practice logs</span><span>{x.passingDays} passing days</span></div>{x.nextReview&&<small className="p5-review-time">Next recall review: {x.nextReview}</small>}{s.evidencePolicy==='extraordinary-claim'&&<p className="p5-caution">Subjective observations are not independent evidence of paranormal phenomena.</p>}</article>};

  if(view==='assessments')return <div className="p5-layout page-content">
    <SectionHeader eyebrow="PHASE 5 · KNOWLEDGE CHECKS" title="Assessments" description="Test your understanding, record confidence, and repeat retrieval on a later day. One perfect quiz never proves skill mastery."/>
    <div className="p5-grid">
      <section className="p5-card p5-main"><div className="p5-card-top"><div><span className="p5-eyebrow">ASSESSMENT BANK</span><h2>{bank.title}</h2><p>{bank.description}</p></div>{badge('Browser-local evidence','violet')}</div>
        <label className="p5-field">Choose knowledge check<select aria-label="Choose knowledge check" value={bankId} onChange={e=>onBank(e.target.value)}>{BANKS.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
        <form onSubmit={submit}><div className="p5-questions">{bank.questions.map((q,index)=><fieldset key={q.id} className="p5-question"><legend><span>QUESTION {String(index+1).padStart(2,'0')}</span>{q.prompt}</legend><div className="p5-answers">{q.choices.map((c,i)=><button type="button" key={c} disabled={Boolean(result)} className={'p5-answer '+(answers[q.id]===i?'selected ':'')+(result&&q.correct===i?'correct ':'')+(result&&answers[q.id]===i&&i!==q.correct?'incorrect':'')} onClick={()=>setAnswers(p=>({...p,[q.id]:i}))}><span>{'ABCD'[i]}</span>{c}</button>)}</div>{result&&<p className="p5-explanation"><Lightbulb size={16}/>{q.explanation}</p>}</fieldset>)}</div>
        <label className="p5-field">Confidence before feedback (1 = guess, 5 = certain)<select aria-label="Confidence rating" value={confidence} onChange={e=>setConfidence(Number(e.target.value))} disabled={Boolean(result)}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>
        <div className="p5-actions">{result?<div className="p5-result" role="status"><strong>{result.correct} / {result.total} correct</strong><span>{result.percent}% · confidence {result.confidence}/5 · saved locally</span><button className="btn btn-outline" type="button" onClick={retake}><RefreshCw size={15}/> Retake assessment</button></div>:<button className="btn btn-primary" disabled={!scoreReady} type="submit"><ClipboardCheck size={17}/> Submit assessment</button>}</div>
        </form>
      </section>
      <aside className="p5-side"><div className="p5-card"><h3>Evidence, not just completion</h3><div className="p5-levels"><div><span>01</span>Completed lesson<small>Activity</small></div><div><span>02</span>Passed twice, separate days<small>Knowledge</small></div><div><span>03</span>Documented practice<small>Self-reported</small></div><div><span>04</span>Independent review<small>Not available yet</small></div></div><p className="p5-tiny">Correct answers demonstrate knowledge of these questions—not the ability to lucid dream or perform paranormal feats.</p><button className="p5-link" onClick={()=>nav('analytics')}>View evidence dashboard <ArrowRight size={15}/></button></div><div className="p5-card"><h3>Previous attempts</h3>{relevantAttempts.length?<div className="p5-attempts">{relevantAttempts.slice(0,8).map(a=><div key={a.id}><b>{a.percent}%</b><span>{formatDay(a.at)} · confidence {a.confidence}/5</span></div>)}</div>:<p className="p5-muted">No recorded attempts for this assessment yet.</p>}<p className="p5-tiny">Repeat a passing assessment on another day before claiming demonstrated knowledge.</p></div></aside>
    </div>{info('Assessment data stays in this browser. Clearing site data removes attempts. This is a learning tool, not an independent certification body.')}
  </div>;

  if(view==='analytics')return <div className="p5-layout page-content">
    <SectionHeader eyebrow="PHASE 5 · ACTUAL PROGRESS" title="Progress & analytics" description="Only logged activity and saved assessment or practice evidence are counted. No simulated progress or invented mastery percentages."/>
    <div className="p5-stats"><article className="p5-stat"><Clock3 size={22}/><strong>{summary.recordedMinutes} min</strong><span>Recorded learning minutes</span></article><article className="p5-stat"><CheckCircle2 size={22}/><strong>{summary.sessionsDone}</strong><span>Completed study sessions</span></article><article className="p5-stat"><ClipboardCheck size={22}/><strong>{summary.attempts}</strong><span>Saved assessment attempts</span></article><article className="p5-stat"><FileCheck2 size={22}/><strong>{summary.knowledgeShown} / {skills.length}</strong><span>Skills with repeated passing days</span></article></div>
    <div className="p5-grid"><section className="p5-card p5-main"><div className="p5-card-top"><div><span className="p5-eyebrow">SKILL-BY-SKILL EVIDENCE</span><h2>Mastery evidence ledger</h2></div>{badge('0 externally verified','amber')}</div><div className="p5-skills">{skills.map(skillCard)}</div></section><aside className="p5-side"><div className="p5-card"><h3>Assessment accuracy</h3><div className="p5-meter-label"><strong>{summary.accuracy===null?'No assessments yet':summary.accuracy+'%'}</strong><span>All graded answers</span></div><div className="p5-meter"><span style={{width:(summary.accuracy||0)+'%'}}/></div><p className="p5-tiny">Accuracy is question recall, not external skill verification.</p></div><div className="p5-card"><h3>Learning evidence</h3><div className="p5-summary-row"><span>Journal entries</span><b>{journal.length}</b></div><div className="p5-summary-row"><span>Practice records</span><b>{summary.practiceRecords}</b></div><div className="p5-summary-row"><span>Unverified external claims</span><b>{summary.externalClaims}</b></div><div className="p5-summary-row"><span>Knowledge checks due</span><b>{summary.due.length}</b></div><button className="p5-link" onClick={()=>nav('coach')}>Review next coaching action <ArrowRight size={15}/></button></div></aside></div>
    <section className="p5-card"><div className="p5-card-top"><div><h2>Recent evidence timeline</h2><p>Actual recorded assessment and practice entries.</p></div>{badge('No simulated activity')}</div><div className="p5-timeline">{[...attempts.map(a=>({id:a.id,at:a.at,description:`${BANKS.find(b=>b.id===a.bankId)?.title||'Knowledge check'} · ${a.correct}/${a.total} correct`,kind:'Knowledge check'})),...evidence.map(e=>({id:e.id,at:e.at,description:`${skills.find(s=>s.id===e.skillId)?.name||'Skill'} · ${e.description}`,kind:e.kind==='external-claim'?'Unverified external claim':'Self-reported practice'}))].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,10).map(e=><div key={e.id}><span>{formatDay(e.at)}</span><b>{e.kind}</b><p>{e.description}</p></div>)}{attempts.length===0&&evidence.length===0&&<p className="p5-muted">No assessment or practice evidence saved yet. Take your first knowledge check to begin.</p>}</div></section>
    {info('Independent verification remains unavailable in the local-only app. Custom notes and quiz scores must not be presented as verified paranormal ability.')}
  </div>;

  return <div className="p5-layout page-content">
    <SectionHeader eyebrow="PHASE 5 · ADAPTIVE LEARNING" title="Learning coach" description="Explainable, evidence-based recommendations shaped by your assessments, documented practice and rest. You approve every schedule change."/>
    <div className="p5-grid"><section className="p5-card p5-main"><div className="p5-card-top"><div><span className="p5-eyebrow">NEXT ACTION · OFFLINE COACHING</span><h2>{advice.headline}</h2></div>{badge('Rules-based · not live AI','violet')}</div>
        <p className="p5-coach-explanation">{advice.reason}</p><div className="p5-suggestion"><span><Headphones size={19}/>{advice.mode.toUpperCase()}</span><p>{advice.activity}</p><b>{advice.minutes} minutes</b></div>
        <label className="p5-field">Sleep/rest quality (1–10)<input type="range" min="1" max="10" value={sleepQuality} aria-label="Sleep quality" onChange={e=>setSleepQuality(Number(e.target.value))}/><span>{sleepQuality} / 10</span></label>
        <div className="p5-actions"><button className="btn btn-primary" onClick={proposeSession}><CalendarDays size={16}/> Approve & schedule next action</button><button className="btn btn-outline" onClick={()=>nav('assessments')}>Open knowledge checks <ArrowRight size={16}/></button></div>{coachError&&<p role="alert" className="p5-error">{coachError}</p>}
        <p className="p5-tiny">Suggested slots use your Schedule quiet hours, weekdays and daily limit. Nothing is added before you click approve. Missed tasks are not piled up.</p>
        {localAPI()&&<div className="p5-ai-box"><b>Optional private AI explanation (local Bun only)</b><p>The request sends numeric aggregate study metrics and your rest rating—no journal text, goal titles or source contents.</p><button disabled={askingAI} className="btn btn-outline" onClick={()=>void requestAI()}>{askingAI?'Requesting…':'Request AI interpretation'}</button>{aiGuidance&&<p role="status">{aiGuidance}</p>}</div>}
      </section><aside className="p5-side"><div className="p5-card"><h3>What informs this suggestion</h3><div className="p5-summary-row"><span>Assessment attempts</span><b>{attempts.length}</b></div><div className="p5-summary-row"><span>Repeated knowledge passes</span><b>{summary.knowledgeShown}</b></div><div className="p5-summary-row"><span>Due retrieval reviews</span><b>{summary.due.length}</b></div><div className="p5-summary-row"><span>Learning sessions finished</span><b>{summary.sessionsDone}</b></div><div className="p5-summary-row"><span>Daily time budget</span><b>{prefs.dailyGoal} min</b></div></div><div className="p5-card"><h3>Learning, not self-diagnosis</h3><p className="p5-muted">If sleep is poor, coaching reduces intensity rather than encouraging late-night practice. It never treats a subjective experience as independently proven.</p></div></aside></div>
    <div className="p5-grid"><section className="p5-card p5-main"><div className="p5-card-top"><div><span className="p5-eyebrow">APPLICATION & TRANSFER</span><h2>Log practical evidence</h2><p>Document specific exercises, artifacts and observed results.</p></div>{badge('Self-reported','amber')}</div><form onSubmit={addEvidence}>
      <label className="p5-field">Skill<select aria-label="Evidence skill" value={skillId} onChange={e=>setSkillId(e.target.value)}>{skills.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="p5-field">Evidence type<select aria-label="Evidence type" value={evidenceKind} onChange={e=>setEvidenceKind(e.target.value as EvidenceKind)}><option value="practice-log">Practice observation</option><option value="artifact-reference">Artifact reference</option><option value="external-claim">Unverified external claim</option></select></label>
      <label className="p5-field">What did you do, observe, and learn?<textarea aria-label="Practice evidence details" rows={4} maxLength={1000} value={evidenceText} onChange={e=>setEvidenceText(e.target.value)} placeholder="Describe the exercise and observable outcome (at least 20 characters)…"/></label>
      <label className="p5-field">Optional reference (private note or URL)<input value={reference} maxLength={500} onChange={e=>setReference(e.target.value)} placeholder="e.g. journal note or artifact link"/></label>
      <button className="btn btn-primary" type="submit"><NotebookPen size={16}/> Save evidence record</button>{evidenceError&&<p role="alert" className="p5-error">{evidenceError.replaceAll('_',' ')}</p>}
      </form></section><aside className="p5-side"><div className="p5-card"><h3>Add your own skill</h3><p className="p5-muted">Track practical progress in programming, languages, business or any other learning goal.</p><form onSubmit={addSkill}><label className="p5-field">Skill name<input aria-label="Custom skill name" value={newSkillName} onChange={e=>setNewSkillName(e.target.value)} placeholder="e.g. Conversational Swahili"/></label><label className="p5-field">Observable outcome<textarea aria-label="Custom skill outcome" rows={3} value={newSkillOutcome} onChange={e=>setNewSkillOutcome(e.target.value)} placeholder="e.g. Complete a five-minute conversation"/></label><button className="btn btn-outline" type="submit"><Plus size={16}/> Add custom skill</button></form></div></aside></div>
    {info('Entries are personal records, not externally verified skill certification. Coaching is offline by default; private optional AI is opt-in and remains a separate backend service.')}
  </div>;
}
