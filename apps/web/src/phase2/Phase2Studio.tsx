import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AudioLines, BookOpen, BrainCircuit, CalendarCheck2, CheckCircle2, ClipboardList, FileText, Headphones, Library, PlayCircle, Plus, RefreshCw, SearchCheck, ShieldCheck, Sparkles, UploadCloud, WandSparkles, X } from 'lucide-react';
import { analyzeSourceText, createPlan, isSafeUrl, proposeAdjustment } from '../../../../packages/learning-core/src/index';
import type { LearningPlan, PlanPreferences, SourceAnalysis, ResourceKind, LearningMode, Adjustment } from '../../../../packages/learning-core/src/index';
import './phase2.css';

type Source={id:string;name:string;kind:ResourceKind;url:string;source:string;status:string;length:string};
type Goal={id:string;title:string;description:string;duration:number;daily:number;mode:LearningMode;status:string};
type Update<T>=(v:T|((prev:T)=>T))=>void;
type Nav=(route:'goals'|'programs'|'curriculum'|'library'|'builder'|'calendar'|'overview')=>void;
export interface StudioProps {
  nav:Nav;
  notify:(message:string)=>void;
  goals:Goal[];setGoals:Update<Goal[]>;
  sources:Source[];setSources:Update<Source[]>;
  plans:LearningPlan[];setPlans:Update<LearningPlan[]>;
  analyses:SourceAnalysis[];setAnalyses:Update<SourceAnalysis[]>;
  activePlanId:string;setActivePlanId:Update<string>;
}
const apiBase=String(import.meta.env.VITE_LEARNING_API_URL||'').replace(/\/$/,'');
const dateToday=()=>new Date().toLocaleDateString('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'});
const modeIcon=(kind:string)=>kind==='video'||kind==='playlist'?<PlayCircle size={20}/>:kind==='pdf'?<FileText size={20}/>:<BookOpen size={20}/>;
const Heading=({label,title,body}:{label:string;title:string;body:string})=><div className="p2-heading"><span>{label}</span><h1>{title}</h1><p>{body}</p></div>;
const Badge=({children,variant='mint'}:{children:React.ReactNode;variant?:'mint'|'neutral'|'amber'|'violet'})=><span className={`p2-pill ${variant}`}>{children}</span>;
const loadPdfText=async(file:File):Promise<string>=>{
  if(file.size>10_000_000)throw new Error('PDF limit is 10 MB. Split it into smaller files.');
  const [{getDocument,GlobalWorkerOptions},{default:workerSrc}]=await Promise.all([
    import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  GlobalWorkerOptions.workerSrc=workerSrc;
  const doc=await getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(doc.numPages>60)throw new Error('Maximum 60 PDF pages per import. Split longer documents.');
  const pages:string[]=[];
  for(let pageNum=1;pageNum<=doc.numPages;pageNum++){
    const page=await doc.getPage(pageNum);const content=await page.getTextContent();
    const words=content.items.flatMap(item=>('str' in item)?[String(item.str)]:[]).join(' ');
    pages.push(`Page ${pageNum}\n${words}`);
    if(pages.join('\n').length>200_000)throw new Error('PDF text exceeds 200,000 character limit.');
  }
  const text=pages.join('\n\n');
  if(text.trim().length<40)throw new Error('No selectable text found. Scanned PDFs need OCR, which is not available in this phase.');
  return text;
};
export function Phase2Knowledge({sources,setSources,analyses,setAnalyses,notify,nav}:StudioProps){
  const [title,setTitle]=useState('');const [url,setUrl]=useState('');const [kind,setKind]=useState<ResourceKind>('video');
  const [text,setText]=useState('');const [inputKind,setInputKind]=useState<'paste'|'upload'>('paste');
  const [fileName,setFileName]=useState('');const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<string>('');const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');
  const analyzed=useMemo(()=>new Map(analyses.map(a=>[a.id,a])),[analyses]);
  const activeAnalysis=analyzed.get(selected)||null;
  const onFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];if(!f)return;setBusy(true);setError('');
    try{
      if(!/\.(pdf|txt|md)$/i.test(f.name))throw new Error('Choose a PDF, TXT or Markdown file.');
      const extracted=f.name.toLowerCase().endsWith('.pdf')?await loadPdfText(f):await f.text();
      if(extracted.length>200_000)throw new Error('Text exceeds 200,000 characters; split your document.');
      setText(extracted);setFileName(f.name);setKind(f.name.endsWith('.pdf')?'pdf':'book');
      if(!title.trim())setTitle(f.name.replace(/\.(pdf|txt|md)$/i,''));
      notify('Text extracted locally. Review it before processing.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to read file.');}finally{setBusy(false);}
  };
  const add=(e:FormEvent)=>{e.preventDefault();setError('');
    if(title.trim().length<3){setError('Enter a source title.');return;}
    if(url.trim()&&!isSafeUrl(url)){setError('Enter a valid http(s) URL or leave it blank.');return;}
    if(!url.trim()&&text.trim().length<40){setError('Paste at least 40 characters of content, or provide a source URL.');return;}
    const id=crypto.randomUUID();
    try{
      const analysis=text.trim().length>=40?analyzeSourceText({id,title,kind,url:url||undefined,text,origin:inputKind==='paste'?'pasted':fileName.endsWith('.pdf')?'pdf-extracted':'text-file'}):null;
      const source:Source={id,name:title.trim(),kind,url:url.trim(),source:inputKind==='upload'?'Local file':'User reference',status:analysis?'Excerpted · User-provided':'URL saved · Not analyzed',length:analysis?`${analysis.excerpts.length} extracts`:'Link only'};
      setSources(p=>[source,...p]);if(analysis){setAnalyses(p=>[analysis,...p]);setSelected(id);}
      setTitle('');setUrl('');setText('');setFileName('');setInputKind('paste');notify(analysis?'Source analyzed locally with anchored excerpts.':'Link saved. Paste source content to analyze it.');
    }catch(e){setError(e instanceof Error?e.message:'Source could not be processed.');}
  };
  return <div className="page-content p2-page">
    <Heading label="PHASE 2 · KNOWLEDGE ENGINE" title="Source intelligence" body="Bring your own videos, books, PDF text and transcripts. Every extracted idea keeps a source reference."/>
    <div className="p2-banner"><div><Badge>LOCAL-FIRST · SOURCE-AWARE</Badge><h2>Collect. Examine. Learn deliberately.</h2><p>URLs are bookmarks—not transcripts. Paste authorized text or open a local PDF to extract actual content. No hidden scraping or unsupported fact checks.</p><button className="btn btn-primary" onClick={()=>nav('builder')}><WandSparkles size={17}/> Build a program from sources</button></div><div className="p2-hero-icon"><Library size={88}/></div></div>
    <div className="p2-two-col"><form className="p2-card p2-import" onSubmit={add}>
      <div className="p2-card-head"><h2>Add / analyze source</h2><Badge variant="neutral">Browser-local</Badge></div>
      <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Dream awareness — lecture 1" required/></label>
      <div className="p2-input-row"><label>Type<select value={kind} onChange={e=>setKind(e.target.value as ResourceKind)}>{(['video','playlist','pdf','book','audio','website'] as const).map(k=><option key={k} value={k}>{k}</option>)}</select></label><label>Source URL (optional)<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label></div>
      <div className="p2-tabs"><button type="button" className={inputKind==='paste'?'selected':''} onClick={()=>setInputKind('paste')}>Paste notes / transcript</button><button type="button" className={inputKind==='upload'?'selected':''} onClick={()=>setInputKind('upload')}>Import document</button></div>
      {inputKind==='upload'&&<label className="p2-file"><UploadCloud size={20}/><span>{fileName||'Choose a PDF, TXT or MD file (local processing)'}</span><input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={onFile} aria-label="Upload learning document"/></label>}
      <label>Content for analysis<textarea rows={8} value={text} onChange={e=>setText(e.target.value)} placeholder="Paste a video transcript, book notes, article excerpt or your own study notes..."/></label>
      <p className="p2-caption">Text is processed in this browser. We save excerpts and labels locally, not the original file. No recording or video is downloaded.</p>
      {error&&<div role="alert" className="p2-error">{error}</div>}
      <button className="btn btn-primary" disabled={busy} type="submit"><Plus size={17}/>{busy?'Reading file…':text.trim().length>=40?'Extract source insights':'Save source link'}</button>
    </form><section className="p2-card p2-inventory"><div className="p2-card-head"><h2>Your source inventory</h2><Badge variant="violet">{sources.length} saved</Badge></div>
      <div className="p2-search-row"><SearchCheck size={17}/><select aria-label="Filter source type" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All source types</option>{['video','playlist','pdf','book','audio','website'].map(k=><option value={k} key={k}>{k}</option>)}</select></div>
      <div className="p2-sources">{sources.filter(s=>filter==='all'||s.kind===filter).map(s=><button key={s.id} className={`p2-source ${selected===s.id?'active':''}`} onClick={()=>setSelected(s.id)}><span className="p2-source-icon">{modeIcon(s.kind)}</span><span><strong>{s.name}</strong><small>{analyzed.has(s.id)?`${analyzed.get(s.id)?.excerpts.length} traceable excerpts`:'Linked only · No content imported'}</small></span><Badge variant={analyzed.has(s.id)?'mint':'amber'}>{analyzed.has(s.id)?'Extracted':'Pending'}</Badge></button>)}</div>
      {activeAnalysis?<div className="p2-excerpts"><div className="p2-card-head"><h3>{activeAnalysis.title}</h3><Badge variant="amber">{activeAnalysis.verification}</Badge></div><p>{activeAnalysis.contentLength.toLocaleString()} characters · {activeAnalysis.excerpts.length} anchored excerpts · {activeAnalysis.takeaways.length} candidate takeaways</p><div className="p2-scroll-snippets">{(activeAnalysis.takeaways.length?activeAnalysis.takeaways:activeAnalysis.excerpts.slice(0,4).map(e=>({text:e.text,excerptId:e.id}))).slice(0,6).map(item=><blockquote key={item.excerptId}>{item.text}<small>Source excerpt · {item.excerptId}</small></blockquote>)}</div>{activeAnalysis.warnings.map(w=><p key={w} className="p2-warning"><ShieldCheck size={15}/>{w}</p>)}</div>:<p className="p2-caption">Choose an extracted source to inspect evidence-linked snippets. Links without transcripts remain clearly unprocessed.</p>}
    </section></div></div>;
}
function defaultPrefs():PlanPreferences{return {days:90,minutesPerDay:45,listeningShare:0.7,readingBlockMinutes:15,daysPerWeek:6,practiceMinutes:10,startDate:dateToday()}}
export function Phase2Planner({nav,notify,goals,setGoals,sources,analyses,plans,setPlans,setActivePlanId}:StudioProps){
  const [title,setTitle]=useState('');const [outcome,setOutcome]=useState('');const [prefs,setPrefs]=useState(defaultPrefs);
  const [preview,setPreview]=useState<LearningPlan|null>(null);const [error,setError]=useState('');const [aiBusy,setAiBusy]=useState(false);
  const change=<K extends keyof PlanPreferences>(key:K,value:PlanPreferences[K])=>{setPrefs(p=>({...p,[key]:value}));setPreview(null);};
  const generate=()=>{setError('');try{setPreview(createPlan({title,outcome,preferences:prefs,sources,sourceAnalyses:analyses}));}catch(e){setError(e instanceof Error?e.message:'Unable to build plan.');}};
  const aiReview=async()=>{if(!preview||!apiBase)return;setAiBusy(true);setError('');try{const r=await fetch(`${apiBase}/v1/plans/ai-generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:preview,sourceAnalyses:analyses.slice(0,8).map(a=>({id:a.id,title:a.title,excerpts:a.excerpts.slice(0,4)}))})});const result=await r.json();if(!r.ok)throw new Error(result.error||'AI service unavailable.');if(!Array.isArray(result.guidance)||!Array.isArray(result.stageGuidance)||!Array.isArray(result.weeklyFocus))throw new Error('AI service returned invalid structure.');setPreview(p=>p?{...p,generator:'ai-reviewed',aiGuidance:result.guidance.slice(0,8),stages:p.stages.map((s,i)=>({...s,outcome:String(result.stageGuidance[i]||s.outcome)})),tasks:p.tasks.map(t=>t.mode==='rest'?t:{...t,description:`${String(result.weeklyFocus[t.week-1]||'Guided practice')}. ${t.description}`})}:p);}catch(e){setError(e instanceof Error?e.message:'Unable to reach AI service.');}finally{setAiBusy(false);}};
  const save=()=>{if(!preview)return;setPlans(p=>[preview,...p]);setActivePlanId(preview.id);
    setGoals(p=>[{id:preview.id,title:preview.title,description:preview.outcome,duration:preview.preferences.days,daily:preview.preferences.minutesPerDay,mode:'listen',status:'Planned'},...p]);notify('Learning plan saved locally, with dated study blocks.');nav('programs');};
  const firstWeek=preview?.tasks.filter(t=>t.week===1)||[];
  return <div className="page-content p2-page">
    <Heading label="PHASE 2 · INTELLIGENT PLANNING" title="Design your learning journey" body="Generate a realistic 30–180 day program with evidence gates, source assignments, listening blocks and short reading sessions."/>
    <div className="p2-banner p2-banner-blue"><div><Badge>70% LISTEN · 30% READ · CONFIGURABLE</Badge><h2>A plan built around your actual routine.</h2><p>Start with an auditable offline curriculum. Connect a private Bun API for optional AI review—never put an API key in GitHub Pages.</p></div><div className="p2-hero-icon"><BrainCircuit size={82}/></div></div>
    <div className="p2-two-col"><section className="p2-card p2-builder"><div className="p2-card-head"><h2>Your learning brief</h2><Badge variant="neutral">Step 1 of 2</Badge></div>
      <label>Goal<input aria-label="Learning goal" value={title} onChange={e=>{setTitle(e.target.value);setPreview(null)}} placeholder="e.g. Learn to lucid dream or master TypeScript" maxLength={140}/></label>
      <label>What would measurable success look like?<textarea aria-label="Measurable outcome" rows={3} value={outcome} onChange={e=>{setOutcome(e.target.value);setPreview(null)}} placeholder="Example: recall dreams 5 mornings/week, complete structured exercises and review evidence..." maxLength={600}/></label>
      <div className="p2-input-row"><label>Timeline<select aria-label="Timeline" value={prefs.days} onChange={e=>change('days',Number(e.target.value) as PlanPreferences['days'])}>{[30,60,90,180].map(n=><option key={n} value={n}>{n} days</option>)}</select></label><label>Study minutes/day<input aria-label="Study minutes per day" type="number" min={15} max={180} value={prefs.minutesPerDay} onChange={e=>change('minutesPerDay',Number(e.target.value))}/></label></div>
      <div className="p2-input-row"><label>Listening share <strong>{Math.round(prefs.listeningShare*100)}%</strong><input aria-label="Listening share" type="range" min="0" max="100" step="10" value={Math.round(prefs.listeningShare*100)} onChange={e=>change('listeningShare',Number(e.target.value)/100)}/></label><label>Reading block (min)<input aria-label="Reading block minutes" type="number" min={5} max={45} value={prefs.readingBlockMinutes} onChange={e=>change('readingBlockMinutes',Number(e.target.value))}/></label></div>
      <div className="p2-input-row"><label>Active days/week<select aria-label="Days per week" value={prefs.daysPerWeek} onChange={e=>change('daysPerWeek',Number(e.target.value))}>{[3,4,5,6,7].map(n=><option key={n} value={n}>{n} days</option>)}</select></label><label>Practice/day (min)<input aria-label="Practice minutes" type="number" min={0} max={90} value={prefs.practiceMinutes} onChange={e=>change('practiceMinutes',Number(e.target.value))}/></label></div>
      <label>Start date<input type="date" aria-label="Plan start date" value={prefs.startDate} onChange={e=>change('startDate',e.target.value)}/></label>
      <div className="p2-source-note"><Library size={18}/><span>{sources.length} saved sources · <b>{analyses.length} with actual extracted text</b>. Only processed sources are assigned as learning material.</span></div>
      {error&&<p role="alert" className="p2-error">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={generate}><WandSparkles size={17}/> Generate structured plan</button>
    </section><section className="p2-card p2-results"><div className="p2-card-head"><h2>Plan preview</h2><Badge variant={preview?'mint':'neutral'}>{preview?'Ready for review':'Not generated'}</Badge></div>
      {!preview?<div className="p2-empty"><Sparkles size={46}/><h3>Your roadmap starts here</h3><p>Fill in the brief and generate a plan. You’ll see stages, source coverage, daily blocks and progress gates before saving anything.</p></div>:<>
      <div className="p2-plan-summary"><strong>{preview.title}</strong><span>{preview.preferences.days} days · {Math.ceil(preview.preferences.days/7)} weeks · {preview.tasks.filter(t=>t.mode!=='rest').length} planned sessions</span><div><Badge variant="mint">Structured offline</Badge><Badge variant="neutral">{preview.sources.filter(s=>s.analyzed).length} processed sources</Badge></div></div>
      <div className="p2-stages">{preview.stages.map(s=><div key={s.index}><span>{String(s.index).padStart(2,'0')}</span><div><strong>{s.name}</strong><small>{s.days} · {s.gate}</small></div></div>)}</div>
      <h3>First seven days</h3><div className="p2-week-list">{firstWeek.map(t=><div key={t.id}><span className={`p2-mode p2-mode-${t.mode}`}>{t.mode==='listen'?<Headphones size={15}/>:t.mode==='rest'?<CalendarCheck2 size={15}/>:<BookOpen size={15}/>}</span><span><b>{t.date}</b><small>{t.title}</small></span><em>{t.minutes?`${t.minutes}m`:'Rest'}</em></div>)}</div>
      {preview.aiGuidance&&<div className="p2-ai-guidance"><Badge variant="violet">AI reviewed · User confirmation required</Badge>{preview.aiGuidance.map((g,i)=><p key={i}>• {g}</p>)}</div>}
      {apiBase?<button disabled={aiBusy} className="btn btn-outline" onClick={aiReview}><BrainCircuit size={17}/>{aiBusy?'Consulting private API…':'Enhance curriculum with AI'}</button>:<p className="p2-caption">AI review unavailable on static Pages. Run the local Bun API with OPENAI_API_KEY and VITE_LEARNING_API_URL to enable it securely.</p>}
      <button className="btn btn-primary" onClick={save}><CheckCircle2 size={17}/> Save full learning program</button>
      </>}
    </section></div>
  </div>;
}
export function Phase2Programs({nav,plans,setActivePlanId}:StudioProps){
  return <div className="page-content p2-page"><Heading label="PHASE 2 · LEARNING PROGRAMS" title="Your learning programs" body="Keep goals, planned study blocks and assessment gates in one place. Plans are stored in this browser until PostgreSQL integration."/>
    <div className="p2-card"><div className="p2-card-head"><h2>Saved programs</h2><button className="btn btn-primary" onClick={()=>nav('builder')}><Plus size={16}/> New curriculum</button></div>
      {plans.length===0?<div className="p2-empty"><ClipboardList size={44}/><h3>No generated programs yet</h3><p>Start with a goal, choose an audio-first rhythm, then generate and save your dated plan.</p><button className="btn btn-primary" onClick={()=>nav('builder')}>Create your first plan</button></div>:<div className="p2-program-grid">{plans.map(plan=><article key={plan.id} className="p2-program-card"><Badge variant={plan.generator==='ai-reviewed'?'violet':'mint'}>{plan.generator==='ai-reviewed'?'AI reviewed':'Structured offline'}</Badge><h3>{plan.title}</h3><p>{plan.outcome}</p><div className="p2-stat-row"><span><CalendarCheck2 size={16}/>{plan.preferences.days} days</span><span><Headphones size={16}/>{Math.round(plan.preferences.listeningShare*100)}% listening</span><span><BookOpen size={16}/>{plan.sources.filter(s=>s.analyzed).length} processed sources</span></div><div className="p2-program-actions"><button className="btn btn-primary" onClick={()=>{setActivePlanId(plan.id);nav('curriculum')}}>Open roadmap</button></div></article>)}</div>}
    </div></div>;
}
export function Phase2Curriculum({nav,plans,activePlanId,setActivePlanId,setPlans,notify}:StudioProps){
  const plan=plans.find(p=>p.id===activePlanId)||plans[0];
  const [week,setWeek]=useState(1);const [check,setCheck]=useState({complete:3,scheduled:6,availableMinutes:30,sleepQuality:7,difficulty:'balanced' as const});const [adjustment,setAdjustment]=useState<Adjustment|null>(null);
  if(!plan)return <div className="page-content p2-page"><Heading label="PHASE 2 · ROADMAP" title="No active curriculum" body="Generate a structured learning plan first."/><button className="btn btn-primary" onClick={()=>nav('builder')}>Build a plan</button></div>;
  const weeks=Math.ceil(plan.preferences.days/7);const tasks=plan.tasks.filter(t=>t.week===week);
  const doCheck=()=>{try{setAdjustment(proposeAdjustment(plan,check));}catch(e){notify(e instanceof Error?e.message:'Invalid check-in.');}};
  const apply=()=>{if(!adjustment)return;const nextWeek=Math.min(weeks,week+1);
    setPlans(prev=>prev.map(p=>p.id!==plan.id?p:{...p,tasks:p.tasks.map(t=>t.week===nextWeek&&t.mode!=='rest'?{...t,minutes:Math.min(t.minutes,adjustment.nextMinutes),description:`${t.description} Adaptive review: ${adjustment.reason}`}:t)}));
    notify(`Next week's learning blocks adjusted. No missed sessions were stacked.`);setWeek(nextWeek);setAdjustment(null);
  };
  return <div className="page-content p2-page"><Heading label="PHASE 2 · ADAPTIVE ROADMAP" title="Your learning roadmap" body="Review one week at a time. Practice gates require evidence; completing dates alone is not proof of mastery."/>
    <div className="p2-card"><div className="p2-card-head"><div><h2>{plan.title}</h2><p>{plan.outcome}</p></div><Badge variant={plan.generator==='ai-reviewed'?'violet':'mint'}>{plan.generator}</Badge></div><label className="p2-picker">Choose program<select aria-label="Choose program" value={plan.id} onChange={e=>{setActivePlanId(e.target.value);setWeek(1);setAdjustment(null)}}>{plans.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}</select></label>
      <div className="p2-stages">{plan.stages.map(s=><div key={s.index}><span>{s.index}</span><div><strong>{s.name} · {s.days}</strong><small>Gate: {s.gate}</small></div></div>)}</div>
      <div className="p2-week-toolbar"><button className="btn btn-outline" disabled={week===1} onClick={()=>setWeek(w=>w-1)}>Previous</button><strong>Week {week} of {weeks}</strong><button className="btn btn-outline" disabled={week===weeks} onClick={()=>setWeek(w=>w+1)}>Next</button></div>
      <div className="p2-task-grid">{tasks.map(t=><article className="p2-task" key={t.id}><span className="p2-date">{t.date}</span><Badge variant={t.mode==='rest'?'neutral':t.mode==='listen'?'mint':'violet'}>{t.mode}</Badge><h3>{t.title}</h3><p>{t.description}</p><div><b>{t.minutes?`${t.minutes} minutes`:'Rest day'}</b><small>{t.evidence}</small></div></article>)}</div>
    </div>
    <section className="p2-card"><div className="p2-card-head"><h2>Weekly adaptive check-in</h2><Badge variant="amber">Review before applying</Badge></div><p>Enter what happened this week. The engine may reduce intensity, but never automatically sacrifices sleep or claims skill mastery.</p>
      <div className="p2-input-row"><label>Completed sessions<input aria-label="Completed sessions" type="number" min="0" value={check.complete} onChange={e=>setCheck(p=>({...p,complete:Number(e.target.value)}))}/></label><label>Planned sessions<input aria-label="Planned sessions" type="number" min="1" value={check.scheduled} onChange={e=>setCheck(p=>({...p,scheduled:Number(e.target.value)}))}/></label></div>
      <div className="p2-input-row"><label>Time available/day<input aria-label="Available minutes" type="number" min="15" value={check.availableMinutes} onChange={e=>setCheck(p=>({...p,availableMinutes:Number(e.target.value)}))}/></label><label>Sleep quality (1–10)<input aria-label="Sleep quality" type="number" min="1" max="10" value={check.sleepQuality} onChange={e=>setCheck(p=>({...p,sleepQuality:Number(e.target.value)}))}/></label></div>
      <button className="btn btn-outline" onClick={doCheck}><RefreshCw size={16}/> Get adaptive recommendation</button>
      {adjustment&&<div className="p2-adjustment" role="status"><h3>{adjustment.recommendation}</h3><p>{adjustment.reason} Suggested maximum next week: {adjustment.nextMinutes} minutes per study day.</p><button className="btn btn-primary" onClick={apply}>Apply to following week</button></div>}
    </section><p className="p2-caption">Source attribution applies only to supplied excerpts. Assessments, learning mastery and external verification require separate evidence records.</p>
  </div>;
}
