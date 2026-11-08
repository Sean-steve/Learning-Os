import { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, CloudOff, Download, LockKeyhole, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react';
import { SYNC_KEYS } from '../../../../packages/sync-contract/src/index';
import type { CloudState, CloudUser } from '../../../../packages/sync-contract/src/index';
import {activateCloud,authMe,cloudAvailable,cloudRecords,cloudState,createAccount,flushCloud,listenCloud,logoutCloud,resolveConflict,resumeCloud,refreshCloud,startCloudReconciliation,listAccountSessions,revokeOtherSessions,rotatePassword,finishMfaLogin,getMfaStatus,startMfa,activateMfa} from './cloud-sync';
import './cloud.css';
const statusText=(s:CloudState)=>s.mode==='active'?'Connected · PostgreSQL':s.mode==='conflict'?'Needs conflict resolution':s.mode==='offline'?'Offline · unsynced':s.mode==='connecting'?'Connecting…':'Browser preview';
function useStatus(){const [state,setState]=useState(cloudState);useEffect(()=>listenCloud(()=>setState(cloudState())),[]);return state;}
export function CloudBadge({open}:{open:()=>void}){
  const status=useStatus();
  return <button type="button" title="Manage Learning OS PostgreSQL sync" className={'cloud-badge mode-'+status.mode} onClick={open} aria-label={'Learning records: '+statusText(status)}>{status.mode==='active'?<Cloud size={15}/>:<CloudOff size={15}/>}<span>{statusText(status)}</span>{status.pending>0&&<b>{status.pending}</b>}</button>;
}
export function CloudStartup(){useEffect(()=>{void resumeCloud();return startCloudReconciliation()},[]);return null;}
export default function CloudAccount(){
  const [deviceCount,setDeviceCount]=useState<number|null>(null),[currentPassword,setCurrentPassword]=useState(''),[nextPassword,setNextPassword]=useState('');
  const [mfaRequired,setMfaRequired]=useState(false),[mfaCode,setMfaCode]=useState(''),[mfaEnabled,setMfaEnabled]=useState<boolean|null>(null);
  const [mfaConfigured,setMfaConfigured]=useState(false),[enrollmentPassword,setEnrollmentPassword]=useState(''),[setupSecret,setSetupSecret]=useState(''),[setupUri,setSetupUri]=useState(''),[recoveryCodes,setRecoveryCodes]=useState<string[]>([]);
  const state=useStatus(),[remote,setRemote]=useState(0),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState<'login'|'register'>('login'),[working,setWorking]=useState(false),[error,setError]=useState(''),[user,setUser]=useState<CloudUser|null>(null),[choice,setChoice]=useState(false),[overwrite,setOverwrite]=useState(false),[localCount,setLocalCount]=useState(0);
  useEffect(()=>{
    setLocalCount(SYNC_KEYS.filter(k=>localStorage.getItem(k)!==null).length);
    if(cloudAvailable())void authMe().then(u=>{if(u){
      setUser(u);
      void cloudRecords().then(r=>setRemote(r.length)).catch(()=>{});
      void getMfaStatus().then(x=>{setMfaEnabled(x.enabled);setMfaConfigured(x.configurationAvailable)}).catch(()=>{});
      if(state.mode==='preview')setChoice(true);
    }}).catch(()=>{});
  },[]);
  const attempt=async(action:()=>Promise<unknown>)=>{setWorking(true);setError('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Unable to reach the backend')}finally{setWorking(false)}};
  const afterLogin=async(who:CloudUser)=>{setUser(who);setChoice(true);
    const status=await getMfaStatus();setMfaEnabled(status.enabled);setMfaConfigured(status.configurationAvailable);
    const records=await cloudRecords().catch(()=>[]);setRemote(records.length);
  };
  const login=async(e:React.FormEvent)=>{e.preventDefault();await attempt(async()=>{
    const who=await createAccount(email,password,mode);setPassword('');
    if('mfaRequired' in who){setMfaRequired(true);return;}
    await afterLogin(who);
  })};
  const completeMfa=async(e:React.FormEvent)=>{e.preventDefault();await attempt(async()=>{
    const who=await finishMfaLogin(mfaCode);setMfaCode('');setMfaRequired(false);
    await afterLogin(who);
  })};
  const beginMfa=()=>attempt(async()=>{
    const setup=await startMfa(enrollmentPassword);setEnrollmentPassword('');
    setSetupSecret(setup.secret);setSetupUri(setup.otpauth);setRecoveryCodes([]);
  });
  const confirmMfa=()=>attempt(async()=>{
    const result=await activateMfa(mfaCode);setMfaCode('');setSetupSecret('');setSetupUri('');
    setRecoveryCodes(result.recoveryCodes);setMfaEnabled(true);
  });
  const selection=async(verb:'import'|'restore')=>attempt(async()=>{if(!user)throw Error('Sign in first');await activateCloud(user,verb)});
  const logout=async()=>attempt(async()=>{await logoutCloud()});
  if(!cloudAvailable())return <div className="page-content cloud-page"><div className="cloud-intro"><CloudOff size={42}/><h1>Account & cloud records</h1><p>GitHub Pages runs the **local-first preview**. Passwords and learning data are never sent to GitHub Pages. To use PostgreSQL login and sync, run the Bun backend and Vite frontend on your Ubuntu machine.</p><a href="https://github.com/Sean-steve/Learning-Os/blob/main/docs/PHASE-6-ENGINEERING.md" target="_blank" rel="noreferrer">Local backend setup guide ↗</a></div></div>;
  return <div className="page-content cloud-page">
    <div className="cloud-header"><span>LEARNING OS · PHASE 7.1</span><h1>Account & durable records</h1><p>Keep your learning progress under your own PostgreSQL account. Changes only sync after your explicit choice.</p></div>
    <div className="cloud-columns"><section className="surface-card cloud-card">
      <div className="cloud-label"><LockKeyhole size={20}/><div><b>{state.user?'Signed in to local PostgreSQL':'Private learning account'}</b><p>{state.user?.email||user?.email||'Create an account or sign in'}</p></div></div>
      {mfaRequired&&<form className="cloud-form" onSubmit={e=>void completeMfa(e)}>
        <h2>Authenticator verification</h2><p>Enter a current six-digit authenticator code or an unused recovery code. Password-only login never opens your learning records when MFA is enabled.</p>
        <label>Authenticator / recovery code<input type="text" autoComplete="one-time-code" aria-label="MFA verification code" required value={mfaCode} onChange={e=>setMfaCode(e.target.value.trim())}/></label>
        <button className="btn btn-primary" disabled={working} type="submit">Verify MFA and sign in</button>
      </form>}
      {!mfaRequired&&!user&&!state.user&&<form className="cloud-form" onSubmit={e=>void login(e)}><div className="cloud-tabs"><button type="button" className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Sign in</button><button type="button" className={mode==='register'?'selected':''} onClick={()=>setMode('register')}>Create account</button></div><label>Email <input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" /></label><label>Password <input type="password" required minLength={mode==='register'?12:1} autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} /></label><p>Use at least 12 characters when registering. Authentication cookies are HttpOnly; passwords are never saved by the frontend.</p><button className="btn btn-primary" disabled={working} type="submit">{working?'Checking…':mode==='register'?'Create private account':'Sign in to PostgreSQL'}</button></form>}
      {(user||state.user)&&mfaEnabled===false&&mfaConfigured&&<section className="surface-card cloud-card cloud-mfa">
        <h2>Protect your learning account</h2>
        <p>Enable a time-based authenticator before accessing private records on a production deployment. Save the recovery codes offline.</p>
        {!setupSecret&&<form className="cloud-form" onSubmit={e=>{e.preventDefault();void beginMfa()}}>
          <label>Confirm account password<input type="password" autoComplete="current-password" aria-label="Confirm password for MFA" required value={enrollmentPassword} onChange={e=>setEnrollmentPassword(e.target.value)}/></label>
          <button className="btn btn-outline" type="submit" disabled={working}>Begin MFA setup</button>
        </form>}
        {setupSecret&&<div className="cloud-form">
          <p>Enter this key in your authenticator. It is shown only during setup; do not share it.</p>
          <code data-testid="mfa-secret">{setupSecret}</code>
          <p><small>Authenticator URI: <span className="cloud-uri">{setupUri}</span></small></p>
          <label>Six-digit authenticator code<input type="text" autoComplete="one-time-code" aria-label="Confirm MFA setup code" value={mfaCode} onChange={e=>setMfaCode(e.target.value.trim())}/></label>
          <button className="btn btn-primary" type="button" disabled={working||!mfaCode} onClick={()=>void confirmMfa()}>Activate MFA</button>
        </div>}
      </section>}
      {(user||state.user)&&mfaEnabled===true&&<section className="surface-card cloud-card cloud-mfa"><h2>Authenticator protection active</h2><p>Other devices require your password and authenticator or one unused recovery code.</p></section>}
      {recoveryCodes.length>0&&<section className="surface-card cloud-card cloud-mfa"><h2>Save these eight one-time recovery codes</h2><p>Each is valid once. Store them offline; they will not be displayed again.</p><pre data-testid="mfa-recovery">{recoveryCodes.join('\n')}</pre><button className="btn btn-outline" type="button" onClick={()=>setRecoveryCodes([])}>I saved my recovery codes</button></section>}
      {(user||state.user)&&choice&&state.mode!=='active'&&<div className="cloud-choose"><h2>Choose where to begin</h2><p><strong>{remote} records in PostgreSQL</strong> · {localCount} local browser records. No upload has occurred.</p><button className="btn btn-outline" disabled={working} onClick={()=>void selection('restore')}><Download size={17}/> Use cloud records on this device</button><label className="cloud-check"><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/> I understand importing replaces matching records already in my cloud account.</label><button className="btn btn-primary" disabled={!overwrite||working} onClick={()=>void selection('import')}><UploadCloud size={17}/> Import this browser's learning records</button><p>Cloud restore replaces this browser's existing saved learning data. Import overwrites matching cloud records. Neither action is automatic.</p></div>}
      {state.user&&state.mode==='active'&&<div className="cloud-signed"><div className="cloud-info"><CheckCircle2 size={20}/> <span>{statusText(state)} · {state.pending} pending</span></div><button className="btn btn-outline" disabled={working} onClick={()=>void attempt(async()=>{await flushCloud();await refreshCloud()})}><RefreshCw size={16}/> Check for changes on other devices</button><button className="btn btn-outline" disabled={working} onClick={()=>void attempt(async()=>{const r=await cloudRecords();setRemote(r.length)})}>Check server record count</button><button className="btn btn-outline" disabled={working} onClick={()=>void logout()}>Sign out and clear local account cache</button></div>}
      {state.user&&state.mode==='active'&&<div className="surface-card cloud-card cloud-device-card">
        <h2>Account security</h2>
        <p>Use these controls to revoke other device sessions or rotate your password. Your current session stays signed in.</p>
        <button className="btn btn-outline" type="button" disabled={working} onClick={()=>void attempt(async()=>{const found=await listAccountSessions();setDeviceCount(found.length)})}>Review active sessions</button>
        {deviceCount!==null&&<p role="status">Active sessions: {deviceCount} (including this browser).</p>}
        <button className="btn btn-outline" type="button" disabled={working} onClick={()=>void attempt(async()=>{const revoked=await revokeOtherSessions();setDeviceCount(1);setError(`Revoked ${revoked} other sessions.`)})}>Sign out other devices</button>
        <form className="cloud-form" onSubmit={e=>{e.preventDefault();void attempt(async()=>{const revoked=await rotatePassword(currentPassword,nextPassword);setCurrentPassword('');setNextPassword('');setDeviceCount(1);setError(`Password updated; revoked ${revoked} other sessions.`)})}}>
          <label>Current password<input aria-label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required /></label>
          <label>New password (12+ characters)<input aria-label="New password" type="password" minLength={12} autoComplete="new-password" value={nextPassword} onChange={e=>setNextPassword(e.target.value)} required /></label>
          <button className="btn btn-outline" type="submit" disabled={working}>Update password & revoke other sessions</button>
        </form>
      </div>}
      {state.conflicts.length>0&&<div className="cloud-conflicts"><h3>Resolve sync conflicts manually</h3><p>Another device or tab updated these records. No version is overwritten without your permission.</p>{state.conflicts.map(key=><div className="cloud-conflict" key={key}><b>{key}</b><button disabled={working} onClick={()=>void attempt(()=>resolveConflict(key,'use-remote'))}>Use cloud version</button><button disabled={working} onClick={()=>void attempt(()=>resolveConflict(key,'keep-local'))}>Overwrite cloud with local</button></div>)}</div>}
      {(error||state.error)&&<p role="alert" className="cloud-error">{error||state.error}</p>}
    </section><aside className="cloud-aside"><div className="surface-card cloud-card"><ShieldCheck size={28}/><h3>What is durable?</h3><p>Goals, plans, sources, study sessions, completion history, journal notes, multimedia bookmarks, assessments, and progress evidence.</p><p>Each account owns its own rows. The database applies row-level security and the API checks access on every request.</p><strong>Local PostgreSQL only — no Supabase required.</strong></div><div className="surface-card cloud-card"><h3>Security & limitations</h3><p>Browser-side data is still cached locally after login. Use a trusted device and sign out to clear the account cache. Password rotation and session revocation are available. Email verification, MFA, password recovery, and hosted API still require separate activation.</p></div></aside></div>
  </div>;
}
