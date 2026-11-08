import { useEffect, useMemo, useState } from 'react';
import {recordChanged} from '../phase6/cloud-sync';
import type { FormEvent } from 'react';
import { Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Headphones, Moon, Plus, RefreshCw, ShieldCheck, Sparkles, Target, WandSparkles } from 'lucide-react';
import { DEFAULT_RULES, accountability, coachingNote, googleCalendarUrl, icsCalendar, localDateTime, localDay, nextSafeSlot, validatePlacement } from '../../../../packages/scheduling-core/src/index';
import type { BusyInterval, ScheduleRules, ScheduledActivity, LearningMode } from '../../../../packages/scheduling-core/src/index';
import './phase4.css';

type Session = ScheduledActivity;
type Setter<T> = (v: T | ((old: T) => T)) => void;
type Settings = ScheduleRules & { enabled: boolean; sleepQuality: number };
interface Props {
  sessions: Session[];
  setSessions: Setter<Session[]>;
  completed: string[];
  toggle: (id: string) => void;
  notify: (message: string) => void;
  nav: (route: any) => void;
  prefs: { timezone: string; reminders: boolean };
  view?: 'calendar' | 'accountability';
}
const KEY = 'los.phase4.schedule.settings';
const initial: Settings = { ...DEFAULT_RULES, enabled: false, sleepQuality: 7 };
const loadSettings = (): Settings => {
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Settings> | null; return o ? { ...initial, ...o } : initial; } catch { return initial; }
};
const today = () => localDay(new Date());
const prettyDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' });
const mondayOnOrAfter = () => { const d = new Date(); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return localDay(d); };
const localBackend = () => ['127.0.0.1', 'localhost'].includes(location.hostname);
const apiBase = String(import.meta.env.VITE_LEARNING_API_URL || 'http://localhost:3005').replace(/\/$/, '');
function IconMode({ mode }: { mode: LearningMode }) { return mode === 'listen' ? <Headphones size={16} /> : mode === 'read' ? <BookOpen size={16} /> : <Target size={16} />; }
function useSettings(): [Settings, Setter<Settings>] {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(settings));recordChanged(KEY); }, [settings]);
  useEffect(()=>{const hydrate=()=>setSettings(loadSettings());window.addEventListener('los:cloud-hydrate',hydrate);return()=>window.removeEventListener('los:cloud-hydrate',hydrate)},[]);
  useEffect(() => { const onChange = (event: StorageEvent) => { if (event.key === KEY) setSettings(loadSettings()); }; window.addEventListener('storage', onChange); return () => window.removeEventListener('storage', onChange); }, []);
  return [settings, setSettings];
}
function downloadICS(sessions: Session[], lead: number) {
  const url = URL.createObjectURL(new Blob([icsCalendar(sessions, lead)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'learning-os-schedule.ics'; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export default function ScheduleCenter({ sessions, setSessions, completed, toggle, notify, nav, prefs, view = 'calendar' }: Props) {
  const [settings, setSettings] = useSettings();
  const [selectedDay, setSelectedDay] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDay, setNewDay] = useState(mondayOnOrAfter);
  const [newTime, setNewTime] = useState('15:00');
  const [newMinutes, setNewMinutes] = useState(20);
  const [newMode, setNewMode] = useState<LearningMode>('listen');
  const [formError, setFormError] = useState('');
  const [proposal, setProposal] = useState<Session | null>(null);
  const [pendingNew, setPendingNew] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleStatus, setGoogleStatus] = useState('Not connected');
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [aiGuidance, setAiGuidance] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [busyUpdated, setBusyUpdated] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const totals = useMemo(() => accountability(sessions, completed, now), [sessions, completed, now]);
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const sorted = useMemo(() => sessions.slice().sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time)), [sessions]);
  const days = useMemo(() => Array.from({length: 7}, (_, i) => {
    const anchor = new Date(selectedDay + 'T12:00:00'); anchor.setDate(anchor.getDate() + i);
    return localDay(anchor);
  }), [selectedDay]);
  const shown = sorted.filter(s => days.includes(s.day));
  const calm = coachingNote(totals, settings.sleepQuality);

  useEffect(() => {
    if (!settings.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const tick = () => {
      const nowMs = Date.now();
      sessions.forEach(s => {
        if (completedSet.has(s.id)) return;
        try {
          const start = localDateTime(s.day, s.time).getTime();
          const trigger = start - settings.reminderLeadMinutes * 60_000;
          const key = 'los.phase4.notified.' + s.id + '.' + start;
          if (nowMs >= trigger && nowMs < start + 30_000 && !localStorage.getItem(key)) {
            localStorage.setItem(key, String(nowMs));
            new Notification('Learning OS · Your session is coming up', { body: s.title + ' · ' + s.minutes + ' minutes', tag: key });
          }
        } catch { /* Old malformed sessions are ignored by notification loop. */ }
      });
    };
    tick(); const handle = window.setInterval(tick, 20_000); return () => window.clearInterval(handle);
  }, [sessions, completedSet, settings.enabled, settings.reminderLeadMinutes]);

  const askPermission = async () => {
    if (!('Notification' in window)) { notify('This browser does not support notifications. Use calendar reminders instead.'); return; }
    const result = await Notification.requestPermission();
    const enabled = result === 'granted'; setSettings(s => ({ ...s, enabled }));
    notify(enabled ? 'Reminders enabled while Learning OS is open in this browser.' : 'Notifications not enabled. Calendar exports remain available.');
  };
  const cancelProposal = () => { setProposal(null); setPendingNew(false); setFormError(''); };
  const trySave = (event: FormEvent) => {
    event.preventDefault();
    const item: Session = { id:crypto.randomUUID(), title:newTitle.trim(), day:newDay, time:newTime, minutes:newMinutes, mode:newMode };
    try {
      const valid = validatePlacement(item, sessions, settings, busy);
      if (!valid.ok) { setFormError(valid.warnings.join(' · ')); const alt = nextSafeSlot(item, sessions, settings, busy, item.day); setProposal(alt); setPendingNew(true); return; }
      setSessions(prev => [...prev, item]); setNewTitle('');setShowForm(false);cancelProposal();setSelectedDay(item.day);
      notify('Study session saved in this browser. It is not automatically synced to Google.');
    } catch { setFormError('Enter a valid title, date, time and 5–180 minute duration.'); }
  };
  const proposeMove = (session: Session) => {
    const from = session.day < today() ? today() : session.day;
    const moved = nextSafeSlot(session, sessions.filter(x => x.id !== session.id), settings, busy, from);
    if (!moved || (moved.day === session.day && moved.time === session.time)) notify('No better slot found in the next 14 days. Adjust your availability limits.');
    else { setPendingNew(false); setProposal(moved); }
  };
  const acceptProposal = () => {
    if (!proposal) return;
    if (pendingNew) { setSessions(p => [...p, proposal]); setNewTitle(''); setShowForm(false); }
    else setSessions(p => p.map(x => x.id === proposal.id ? proposal : x));
    setSelectedDay(proposal.day);cancelProposal();notify('Suggested time applied locally. Update any separately exported calendar event manually.');
  };
  const dropSession = (id: string) => {
    if (!window.confirm('Remove this local learning session? This will not delete an exported Google event.')) return;
    setSessions(p => p.filter(x => x.id !== id));notify('Local session removed.');
  };
  const moveWeek = (delta: number) => { const d = new Date(selectedDay + 'T12:00:00'); d.setDate(d.getDate() + delta * 7); setSelectedDay(localDay(d)); };

  const getGoogleStatus = async () => {
    if (!localBackend()) return;
    try {
      const resp = await fetch(apiBase + '/v1/google/status', { credentials:'include' });
      const body = await resp.json();
      setGoogleConnected(Boolean(body.connected));
      setGoogleStatus(body.connected ? 'Connected to Google Calendar · local Bun session' : body.enabled ? 'Not connected' : 'Configure Google OAuth in local Bun backend');
    } catch { setGoogleConnected(false); setGoogleStatus('Local Bun API not running'); }
  };
  useEffect(() => { void getGoogleStatus(); }, []);
  const connectGoogle = () => { if (!localBackend()) {notify('Google OAuth connection requires the local Bun API. Pages offers manual export.');return;} window.location.assign(apiBase + '/v1/google/start'); };
  const disconnectGoogle = async () => {
    try { await fetch(apiBase + '/v1/google/disconnect',{method:'POST',credentials:'include',headers:{'X-Learning-Intent':'manual-calendar-sync'}}); await getGoogleStatus();notify('Google Calendar local connection disconnected.'); }
    catch { notify('Disconnect failed. Check the local Bun service.'); }
  };
  const refreshBusy = async () => {
    if (!localBackend() || !googleConnected) {notify('Connect Google Calendar through local Bun first.');return;}
    const a = localDateTime(days[0], '00:00'); const last = localDateTime(days[6], '23:59');
    try {
      const url = new URL(apiBase + '/v1/google/freebusy');url.searchParams.set('start',a.toISOString());url.searchParams.set('end',last.toISOString());
      const res = await fetch(url,{credentials:'include'});if(!res.ok)throw Error('unavailable');
      const json = await res.json();setBusy(Array.isArray(json.busy)?json.busy:[]);setBusyUpdated(true);notify('Google availability refreshed for displayed week.');
    } catch { notify('Could not retrieve Google Calendar availability.'); }
  };
  const syncOne = async (s: Session) => {
    if (!googleConnected || !localBackend()) { window.open(googleCalendarUrl(s), '_blank', 'noopener,noreferrer'); return; }
    if (!window.confirm('Create or update this learning session in your connected Google Calendar?')) return;
    try {
      const start=localDateTime(s.day,s.time),end=new Date(start.getTime()+s.minutes*60_000);
      const resp=await fetch(apiBase+'/v1/google/event', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Learning-Intent':'manual-calendar-sync'},body:JSON.stringify({id:s.id,title:s.title,start:start.toISOString(),end:end.toISOString(),mode:s.mode,reminderMinutes:settings.reminderLeadMinutes})});
      if(!resp.ok)throw Error('google_event_failed');notify('Google event created or updated with a reminder.');
    } catch { notify('Google Calendar sync failed. No local changes were lost.'); }
  };

  const askAI = async () => {
    if (!localBackend()) {notify('Live AI coaching requires the private local Bun API.');return;}
    setAiLoading(true);
    try {
      const response=await fetch(apiBase+'/v1/accountability/ai-review', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({due:totals.due,done:totals.done,missed:totals.missed,upcoming:totals.upcoming,sleepQuality:settings.sleepQuality,dailyLimit:settings.maxDailyMinutes})});
      if(!response.ok) throw Error('ai_unavailable');
      const result=await response.json() as {guidance?:string};
      setAiGuidance(result.guidance || 'No coaching response available.');
    } catch {notify('Live AI coaching unavailable. Your offline guidance is still available.');}
    finally {setAiLoading(false);}
  };
  const weekMinutes = shown.reduce((sum,s)=>sum+s.minutes,0);
  const card = (s: Session) => <article className={'calendar-event p4-event ' + (completedSet.has(s.id)?'p4-event-done':'')} key={s.id}>
    <button type="button" aria-label={'Mark ' + s.title + ' complete'} className="p4-check" onClick={()=>toggle(s.id)}>{completedSet.has(s.id)?<Check size={15}/>:<span/>}</button>
    <div className="p4-event-main"><strong>{s.title}</strong><small>{s.time} · {s.minutes} min · {s.mode} · {prettyDate(s.day)}</small></div>
    <div className="p4-event-actions"><button type="button" title="Find a new time" aria-label={'Reschedule '+s.title} onClick={()=>proposeMove(s)}><RefreshCw size={15}/></button>
    {googleConnected&&localBackend()?<button type="button" title="Synchronize to connected Google Calendar" aria-label={'Sync '+s.title+' to Google Calendar'} onClick={()=>void syncOne(s)}><ExternalLink size={15}/></button>:<a href={googleCalendarUrl(s)} target="_blank" rel="noopener noreferrer" title="Open manual Google Calendar event" aria-label={'Add '+s.title+' to Google Calendar'}><ExternalLink size={15}/></a>}
    <button type="button" title="Remove local session" aria-label={'Remove '+s.title} onClick={()=>dropSession(s.id)}>×</button></div>
  </article>;

  return <div className="p4-shell page-content">
    <div className="p4-heading"><div><span className="p4-eyebrow">LEARNING OS · PHASE 4</span><h1>{view==='accountability'?'Your learning accountability':'Smart learning schedule'}</h1><p>{view==='accountability'?'Progress that respects your real life, energy and sleep.':'Plan short sessions, protect rest, resolve conflicts and export only when you choose.'}</p></div>
      <button className="btn btn-primary" onClick={()=>{setShowForm(true);cancelProposal();}}><Plus size={16}/> Add study session</button></div>
    <div className="p4-statrow"><div className="p4-stat"><span>Completed sessions</span><strong>{totals.done}</strong><small>Recorded locally</small></div><div className="p4-stat"><span>Ready / upcoming</span><strong>{totals.upcoming}</strong><small>Next sessions on your plan</small></div><div className="p4-stat"><span>Past sessions missed</span><strong>{totals.missed}</strong><small>Reschedule only what matters</small></div><div className="p4-stat"><span>Past-session adherence</span><strong>{totals.adherencePercent}%</strong><small>Not a measure of skill mastery</small></div></div>
    <div className="p4-advice" role="status"><Sparkles size={20}/><div><b>Adaptive learning guidance</b><p>{calm}</p></div><button className="btn btn-outline" onClick={()=>setRuleOpen(v=>!v)}>Adjust pace</button></div>
    {ruleOpen&&<section className="p4-rules surface-card"><h2>Learning boundaries</h2><div className="p4-formgrid">
      <label>Quiet hours start<input aria-label="Quiet hours start" type="time" value={settings.quietStart} onChange={e=>setSettings(p=>({...p,quietStart:e.target.value}))}/></label>
      <label>Quiet hours end<input aria-label="Quiet hours end" type="time" value={settings.quietEnd} onChange={e=>setSettings(p=>({...p,quietEnd:e.target.value}))}/></label>
      <label>Daily study limit<select aria-label="Daily study limit" value={settings.maxDailyMinutes} onChange={e=>setSettings(p=>({...p,maxDailyMinutes:Number(e.target.value)}))}>{[30,45,60,75,90,120].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>
      <label>Reminder lead<select aria-label="Reminder lead" value={settings.reminderLeadMinutes} onChange={e=>setSettings(p=>({...p,reminderLeadMinutes:Number(e.target.value)}))}>{[0,5,10,15,30,60].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>
      <label>Sleep quality this week<select aria-label="Sleep quality this week" value={settings.sleepQuality} onChange={e=>setSettings(p=>({...p,sleepQuality:Number(e.target.value)}))}>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1} / 10</option>)}</select></label>
    </div><p className="p4-help">Default rest day is Sunday; review any sessions that exceed your new boundaries. Rules save to this browser only.</p></section>}
    {view==='accountability'&&localBackend()&&<div className="p4-ai-panel surface-card"><b>Optional private AI accountability check-in</b><p>Only numeric progress and sleep-quality ratings are sent to your locally running Bun API when you explicitly request a review. No calendar titles or private journal notes are sent.</p><button className="btn btn-outline" disabled={aiLoading} onClick={()=>void askAI()}>{aiLoading?'Checking…':'Request AI coaching'}</button>{aiGuidance&&<p role="status" className="p4-ai-answer">{aiGuidance}</p>}</div>}
    <div className="p4-grid">
      <section className="surface-card p4-calendar"><div className="p4-section-head"><div><span>7-DAY VIEW</span><h2>Upcoming learning blocks</h2></div><div className="p4-week-controls"><button aria-label="Previous week" onClick={()=>moveWeek(-1)}><ChevronLeft size={18}/></button><button onClick={()=>setSelectedDay(today())}>Today</button><button aria-label="Next week" onClick={()=>moveWeek(1)}><ChevronRight size={18}/></button></div></div>
        <div className="p4-week-days">{days.map(day=><button key={day} className={day===selectedDay?'selected':''} onClick={()=>setSelectedDay(day)}><small>{prettyDate(day)}</small><strong>{day.slice(-2)}</strong><span>{sessions.filter(s=>s.day===day).length} sessions</span></button>)}</div>
        <div className="p4-week-summary"><Clock3 size={17}/> {shown.length} learning sessions · {weekMinutes} min across displayed week</div>
        <div className="p4-events">{shown.length?shown.map(card):<p className="p4-empty">No sessions in this week. Add a 15-minute audio lesson to get started.</p>}</div>
        {proposal&&!pendingNew&&<div className="p4-proposal" role="status"><b>Suggested adjustment · requires your approval</b><p>{proposal.title} → {prettyDate(proposal.day)}, {proposal.time}, {proposal.minutes} min</p><button className="btn btn-primary" onClick={acceptProposal}>Apply suggested time</button><button className="btn btn-outline" onClick={cancelProposal}>Keep original</button></div>}
      </section>
      <aside className="p4-side">
        <section className="surface-card p4-card"><div className="p4-section-head"><div><span>CALENDAR</span><h3>Google Calendar & exports</h3></div><CalendarDays size={20}/></div>
          <p>Google Calendar access connected in ChatGPT does not authorize this separate app.</p><div className="p4-connected"><i className={googleConnected?'on':''}/>{localBackend()?googleStatus:'GitHub Pages: manual export (no OAuth secrets)'}</div>
          {localBackend()&&<div className="p4-stack"><button className="btn btn-outline" onClick={()=>void getGoogleStatus()}>Refresh connection status</button>{googleConnected?<><button className="btn btn-outline" onClick={()=>void refreshBusy()}>Check Google availability</button><button className="btn btn-outline" onClick={()=>void disconnectGoogle()}>Disconnect</button></>:<button className="btn btn-primary" onClick={connectGoogle}>Connect Google · local Bun</button>}</div>}
          {busyUpdated&&<p className="p4-help">{busy.length} occupied intervals received. New scheduling suggestions avoid those times.</p>}
          <button className="btn btn-outline p4-wide" onClick={()=>{downloadICS(sessions,settings.reminderLeadMinutes);notify('Calendar file downloaded. Import it into your calendar to receive reminders.');}}><Download size={16}/> Download calendar (.ics)</button>
          <p className="p4-help">The Google event buttons open an editable Google Calendar event. Saving is your choice; updates are not automatic on Pages.</p>
        </section>
        <section className="surface-card p4-card"><div className="p4-section-head"><div><span>REMINDERS</span><h3>Stay on track</h3></div><Bell size={20}/></div>
          <p>Optional browser alerts are shown while this page is open. Calendar events can provide reminders even when it is closed.</p><button className="btn btn-outline p4-wide" onClick={()=>void askPermission()}>{settings.enabled?'Notifications enabled':'Enable browser reminders'}</button>
          <p className="p4-help"><Moon size={14}/> Quiet hours {settings.quietStart}–{settings.quietEnd} · {settings.maxDailyMinutes} min/day max</p>
          <p className="p4-help">Time displayed is your device's local time. Your saved preference is {prefs.timezone}. If different, adjust your device clock/timezone before exporting.</p>
        </section>
        <section className="surface-card p4-card"><h3>Review your practice</h3><p>Completion means you did the session—not that a skill is mastered. Log evidence in your journal.</p><button className="btn btn-outline p4-wide" onClick={()=>nav('journal')}>Open practice journal</button></section>
      </aside>
    </div>
    {showForm&&<div className="p4-modal-backdrop" onClick={()=>{setShowForm(false);cancelProposal();}}><form className="p4-dialog" onClick={e=>e.stopPropagation()} onSubmit={trySave}>
      <div className="p4-section-head"><h2>Create learning session</h2><button type="button" aria-label="Close session editor" onClick={()=>{setShowForm(false);cancelProposal();}}>×</button></div>
      <label>Learning activity<input required maxLength={140} value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. Listen: lucid dream foundations"/></label>
      <div className="p4-formgrid"><label>Date<input aria-label="Session date" required type="date" value={newDay} onChange={e=>setNewDay(e.target.value)}/></label><label>Time<input aria-label="Session time" required type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}/></label><label>Minutes<input aria-label="Session minutes" required type="number" min={5} max={180} value={newMinutes} onChange={e=>setNewMinutes(Number(e.target.value))}/></label><label>Learning format<select aria-label="Learning format" value={newMode} onChange={e=>setNewMode(e.target.value as LearningMode)}>{(['listen','read','watch','practice'] as LearningMode[]).map(x=><option key={x} value={x}>{x}</option>)}</select></label></div>
      {formError&&<p role="alert" className="p4-error">{formError}</p>}
      {pendingNew&&proposal&&<div role="status" className="p4-proposal"><b>Safer alternative</b><p>{prettyDate(proposal.day)} at {proposal.time}</p><button type="button" className="btn btn-primary" onClick={acceptProposal}>Apply suggested time</button></div>}
      <div className="p4-dialog-actions"><button type="button" className="btn btn-outline" onClick={()=>{setShowForm(false);cancelProposal();}}>Cancel</button><button type="submit" className="btn btn-primary">Add session</button></div>
    </form></div>}
    <p className="p4-disclosure"><ShieldCheck size={16}/> Local-first schedule and heuristic coaching · no cloud AI accountability or background push service · all external calendar changes require approval.</p>
  </div>;
}
