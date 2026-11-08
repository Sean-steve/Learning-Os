import { SYNC_KEYS } from '../../../../packages/sync-contract/src/index';
import type { CloudUser, CloudRecord, CloudState, SyncKey } from '../../../../packages/sync-contract/src/index';
/** The Pages preview has no backend. Local development uses Vite's same-origin /api proxy. */
export const cloudAvailable = () =>
  ['localhost','127.0.0.1'].includes(location.hostname) ||
  (import.meta.env.VITE_LEARNING_API_ENABLED === 'true' && location.protocol === 'https:' && !location.hostname.endsWith('.github.io'));
const ORIGIN = '/api/v1';
const OWNER='los.sync.owner', ENABLED='los.sync.enabled', VERSIONS='los.sync.versions', HASHES='los.sync.hashes';
const KEYS = new Set<string>(SYNC_KEYS);
let state:CloudState={mode:'preview',user:null,pending:0,conflicts:[],error:''};
let inFlight=false,active=false;let timer:number|undefined;
let revisions:Record<string,number>={},hashes:Record<string,string>={};
const pending=new Set<string>();const conflicts=new Set<string>();
function read<T>(key:string,defaultValue:T):T {try{return JSON.parse(localStorage.getItem(key)||'') as T}catch{return defaultValue}}
function publish(){state={...state,pending:pending.size,conflicts:[...conflicts]};window.dispatchEvent(new CustomEvent('los:sync-state',{detail:state}));}
export function cloudState(){return {...state,conflicts:[...state.conflicts]};}
export const listenCloud=(f:()=>void)=>{window.addEventListener('los:sync-state',f);return ()=>window.removeEventListener('los:sync-state',f)};
function checksum(value:string){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return (h>>>0).toString(16)}
async function api(path:string,init?:RequestInit){const res=await fetch(ORIGIN+path,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Learning-Intent':'manual-sync',...init?.headers}}); const payload=await res.json().catch(()=>({error:'unexpected_response'}));if(!res.ok)throw new Error(payload.error||`http_${res.status}`);return payload;}
export async function authMe():Promise<CloudUser|null>{if(!cloudAvailable())return null;const a=await api('/auth/me');return a.user||null}
export async function createAccount(email:string,password:string,mode:'login'|'register'):Promise<CloudUser|{mfaRequired:true}>{
  const body=await api('/auth/'+mode,{method:'POST',body:JSON.stringify({email,password})});
  if(body.mfaRequired===true)return {mfaRequired:true};
  state={...state,mode:'preview',user:body.user,error:''};publish();return body.user as CloudUser;
}
export async function finishMfaLogin(code:string):Promise<CloudUser>{
  const result=await api('/auth/mfa/complete',{method:'POST',body:JSON.stringify({code})});
  state={...state,mode:'preview',user:result.user,error:''};publish();return result.user as CloudUser;
}
export async function getMfaStatus():Promise<{enabled:boolean;configurationAvailable:boolean}>{
  return api('/auth/mfa/status');
}
export async function startMfa(password:string):Promise<{secret:string;otpauth:string}>{
  return api('/auth/mfa/begin',{method:'POST',body:JSON.stringify({password})});
}
export async function activateMfa(code:string):Promise<{enabled:boolean;recoveryCodes:string[]}>{
  return api('/auth/mfa/activate',{method:'POST',body:JSON.stringify({code})});
}

export async function cloudRecords():Promise<CloudRecord[]>{const r=await api('/records');return r.records as CloudRecord[];}
export type AccountSession={id:string;createdAt:string;expiresAt:string;current:boolean};
export async function listAccountSessions():Promise<AccountSession[]>{
  const response=await api('/auth/sessions');return response.sessions as AccountSession[];
}
export async function revokeOtherSessions():Promise<number>{
  const response=await api('/auth/revoke-others',{method:'POST',body:'{}'});
  return Number(response.revoked||0);
}
export async function rotatePassword(currentPassword:string,newPassword:string):Promise<number>{
  const response=await api('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});
  return Number(response.revoked||0);
}
function persistMeta(){try{localStorage.setItem(VERSIONS,JSON.stringify(revisions));localStorage.setItem(HASHES,JSON.stringify(hashes))}catch{/* storage unavailable */}}
function hydrate(records:CloudRecord[]){
  for(const key of SYNC_KEYS)localStorage.removeItem(key);
  for(const record of records)if(KEYS.has(record.key))localStorage.setItem(record.key,JSON.stringify(record.data));
  window.dispatchEvent(new Event('los:cloud-hydrate'));
}
export async function activateCloud(user:CloudUser,mode:'import'|'restore') {
  if(!cloudAvailable())throw new Error('local_backend_required');
  const server=await cloudRecords(); const v=Object.fromEntries(server.map(r=>[r.key,Number(r.revision)]));
  if(mode==='import'){
    const keys=SYNC_KEYS.filter(key=>localStorage.getItem(key)!==null);
    for(const key of keys){const local=localStorage.getItem(key);if(!local)continue;
      const saved=await api('/records',{method:'PUT',body:JSON.stringify({key,data:JSON.parse(local),revision:v[key]||0})});
      v[key]=saved.record.revision;
    }
    localStorage.removeItem('los.sync.emptyMode');
  }else{
    localStorage.setItem('los.sync.emptyMode','1');
    hydrate(server);
  }
  revisions=v;hashes={};for(const key of SYNC_KEYS){const raw=localStorage.getItem(key);if(raw!==null)hashes[key]=checksum(raw);}
  pending.clear();conflicts.clear();active=true;
  localStorage.setItem(OWNER,user.id);localStorage.setItem(ENABLED,'1');persistMeta();
  state={mode:'connecting',user,pending:0,conflicts:[],error:''};publish();
  // Hooks are browser-local; reload to initialize all screens against restored state.
  location.reload();
}
function clearLocal(){for(const key of SYNC_KEYS)localStorage.removeItem(key);for(const key of [OWNER,ENABLED,VERSIONS,HASHES])localStorage.removeItem(key);localStorage.setItem('los.sync.emptyMode','1');}
export async function logoutCloud(){
  await api('/auth/logout',{method:'POST',body:'{}'});clearLocal();active=false;pending.clear();conflicts.clear();state={mode:'preview',user:null,pending:0,conflicts:[],error:''};publish();location.reload();
}
async function refreshRemote(){
  if(!active||!state.user)return;
  const records=await cloudRecords();
  for(const r of records){
    if(!KEYS.has(r.key))continue;
    const key=r.key,remoteRev=r.revision,knownRev=revisions[key]||0;
    if(remoteRev===knownRev)continue;
    const raw=localStorage.getItem(key);const unmodified=raw===null||checksum(raw)===hashes[key];
    if(unmodified&&!pending.has(key)){
      localStorage.setItem(key,JSON.stringify(r.data));hashes[key]=checksum(JSON.stringify(r.data));
      revisions[key]=remoteRev;
      window.dispatchEvent(new Event('los:cloud-hydrate'));
    }else{conflicts.add(key);state={...state,mode:'conflict'};}
  }
  persistMeta();publish();
}
let recovery:Promise<void>|null=null;
export async function resumeCloud():Promise<void> {
  if(recovery)return recovery;
  recovery=resumeCloudOnce();
  try { await recovery; } finally { recovery=null; }
}
async function resumeCloudOnce() {
  if(!cloudAvailable()||!localStorage.getItem(ENABLED))return;
  state={...state,mode:'connecting'};publish();
  try{
    const user=await authMe();
    if(!user){clearLocal();state={mode:'preview',user:null,pending:0,conflicts:[],error:'Signed out; local account cache cleared.'};publish();location.reload();return;}
    if(localStorage.getItem(OWNER)!==user.id){clearLocal();state={mode:'preview',user,pending:0,conflicts:[],error:'Account changed; previous local data cleared.'};publish();location.reload();return;}
    revisions=read(VERSIONS,{});hashes=read(HASHES,{});
    active=true;state={mode:'connecting',user,pending:0,conflicts:[],error:''};publish();
    await refreshRemote();
    // Recover edits made during a temporary offline period or before authentication finished.
    // Conflicting remote edits remain blocked for explicit human resolution.
    for(const key of SYNC_KEYS){if(!conflicts.has(key))recordChanged(key);}
    state={...state,mode:conflicts.size?'conflict':'active',error:''};publish();
  }catch(e){state={...state,mode:'offline',error:'Backend unreachable. Changes remain in this browser.'};publish()}
}
export function isCloudActive(){return active;}
export function recordChanged(key:string) {
  if(!KEYS.has(key)||!active||conflicts.has(key))return;
  const raw=localStorage.getItem(key);if(raw===null||checksum(raw)===hashes[key])return;
  pending.add(key);publish();clearTimeout(timer);timer=window.setTimeout(()=>void flushCloud(),800);
}
export async function flushCloud() {
  if(inFlight||!active||!state.user)return;
  inFlight=true;
  try{
    while(pending.size){
      const key=pending.values().next().value as SyncKey;pending.delete(key);
      if(conflicts.has(key))continue;
      const raw=localStorage.getItem(key);if(raw===null)continue;
      const hash=checksum(raw);if(hashes[key]===hash)continue;
      try{const result=await api('/records',{method:'PUT',body:JSON.stringify({key,data:JSON.parse(raw),revision:revisions[key]||0})});
        revisions[key]=result.record.revision;hashes[key]=hash;persistMeta();
        state={...state,mode:'active',error:''};
      }catch(e){
        if(e instanceof Error && e.message==='revision_conflict'){conflicts.add(key);state={...state,mode:'conflict',error:'Cloud version changed. Choose how to resolve conflicts.'};}
        else {pending.add(key);state={...state,mode:'offline',error:'Sync paused. Changes are safe in this browser.'};break;}
      }
      publish();
    }
  }finally{inFlight=false;publish();}
}
export async function resolveConflict(key:string,action:'keep-local'|'use-remote'){
  if(!conflicts.has(key)||!state.user)throw new Error('no_conflict');
  const server=await cloudRecords(),record=server.find(r=>r.key===key);
  if(action==='use-remote'){
    if(record){localStorage.setItem(key,JSON.stringify(record.data));revisions[key]=record.revision;hashes[key]=checksum(JSON.stringify(record.data));}
    else{localStorage.removeItem(key);revisions[key]=0;delete hashes[key];}
    window.dispatchEvent(new Event('los:cloud-hydrate'));
  }else{
    const raw=localStorage.getItem(key);if(raw!==null){const saved=await api('/records',{method:'PUT',body:JSON.stringify({key,data:JSON.parse(raw),revision:record?.revision||0})});
      revisions[key]=saved.record.revision;hashes[key]=checksum(raw);}
  }
  conflicts.delete(key);state={...state,mode:conflicts.size?'conflict':'active',error:''};persistMeta();publish();
}

/** Same-origin reconciliation only. No background service worker or server polling on GitHub Pages. */
let checking:Promise<void>|null=null;
export function refreshCloud():Promise<void>{
  if(checking)return checking;
  checking=(async()=>{
    if(!active||!state.user)return;
    try{
      await refreshRemote();
      for(const key of SYNC_KEYS)if(!conflicts.has(key))recordChanged(key);
      if(pending.size)await flushCloud();
      if(conflicts.size)state={...state,mode:'conflict'};
      else if(!pending.size)state={...state,mode:'active',error:''};
      publish();
    }catch{
      state={...state,mode:'offline',error:'Remote update check failed. Edits remain in this browser.'};
      publish();
    }
  })();
  return checking.finally(()=>{checking=null;});
}
export function startCloudReconciliation():()=>void{
  if(!cloudAvailable())return ()=>{};
  const check=()=>{if(document.visibilityState==='visible' && navigator.onLine)void refreshCloud();};
  const onStorage=(event:StorageEvent)=>{
    if(event.key && KEYS.has(event.key) && active)recordChanged(event.key);
  };
  const interval=window.setInterval(check,15_000);
  document.addEventListener('visibilitychange',check);
  window.addEventListener('online',check);
  window.addEventListener('focus',check);
  window.addEventListener('storage',onStorage);
  return ()=>{
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange',check);
    window.removeEventListener('online',check);
    window.removeEventListener('focus',check);
    window.removeEventListener('storage',onStorage);
  };
}
