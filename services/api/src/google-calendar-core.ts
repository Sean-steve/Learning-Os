/** Server-side Google Calendar event validation. No browser-facing OAuth secrets. */
export type GoogleLearningEvent = {
  id: string; title: string; start: string; end: string; mode: 'listen'|'read'|'watch'|'practice'; reminderMinutes: number;
};
const validInstant=(s:string)=> typeof s==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s) && Number.isFinite(Date.parse(s));
export function validateGoogleEvent(o:unknown):GoogleLearningEvent {
  if(!o || typeof o!=='object' || Array.isArray(o))throw Error('invalid_event');
  const e=o as Partial<GoogleLearningEvent>;
  if(typeof e.id!=='string'||!/^[-\w]{2,90}$/.test(e.id))throw Error('invalid_id');
  if(typeof e.title!=='string'||!e.title.trim()||e.title.length>140)throw Error('invalid_title');
  if(!validInstant(e.start||'')||!validInstant(e.end||''))throw Error('invalid_dates');
  const min=(Date.parse(e.end!)-Date.parse(e.start!))/60000;
  if(min<5||min>180)throw Error('invalid_duration');
  if(!['listen','read','watch','practice'].includes(e.mode||''))throw Error('invalid_mode');
  if(!Number.isInteger(e.reminderMinutes) || (e.reminderMinutes??0)<0 || (e.reminderMinutes??0)>120)throw Error('invalid_reminder');
  return e as GoogleLearningEvent;
}
export async function googleEventId(localSessionId:string):Promise<string>{
  if(!/^[-\w]{2,90}$/.test(localSessionId))throw Error('invalid_id');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('learning-os/v1/'+localSessionId));
  const hex=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return 'los'+hex.slice(0,28); // Google requires base32hex: 0-9 and a-v, hexadecimal is a subset.
}
export function googlePayload(e:GoogleLearningEvent,id:string){
  return {id,summary:'Learning OS: '+e.title,
    description:'Learning mode: '+e.mode+' · Scheduled explicitly from Learning OS.',
    start:{dateTime:e.start}, end:{dateTime:e.end}, visibility:'private',
    extendedProperties:{private:{learningOsSessionId:e.id}},
    reminders:{useDefault:false,overrides:e.reminderMinutes?[{method:'popup',minutes:e.reminderMinutes}]:[]}
  };
}
export function googleLocalMode(env:Record<string,string|undefined>){
  const hostname=env.API_HOST||'127.0.0.1';
  const origin=env.WEB_ORIGIN||'http://localhost:5173';
  const redirect=env.GOOGLE_REDIRECT_URI||'';
  return env.GOOGLE_CALENDAR_LOCAL_ENABLED==='true'
    && ['localhost','127.0.0.1'].includes(hostname)
    && /^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(origin)
    && /^http:\/\/(localhost|127\.0\.0\.1):\d+\/v1\/google\/callback$/.test(redirect)
    && Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
}
