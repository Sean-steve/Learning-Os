/** TOTP (RFC 6238) and recovery-code primitives; secrets are NEVER persisted as plaintext. */
import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {tokenDigest} from '../phase6/core.ts';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes:Uint8Array):string {
  let bits=0,value=0,out='';
  for(const byte of bytes){value=(value<<8)|byte;bits+=8;
    while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}
  }
  if(bits>0)out+=alphabet[(value<<(5-bits))&31];
  return out;
}
function decode32(value:string):Buffer {
  if(!/^[A-Z2-7]{16,64}$/.test(value))throw new Error('invalid_mfa_secret');
  let buffer=0,bits=0;const out:number[]=[];
  for(const char of value){buffer=(buffer<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){out.push((buffer>>>(bits-8))&255);bits-=8;}}
  return Buffer.from(out);
}
export function generateTotpSecret():string{return base32(randomBytes(20));}
export function totpAt(secret:string,step:number):string {
  if(!Number.isSafeInteger(step)||step<0)throw new Error('invalid_step');
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
  const mac=createHmac('sha1',decode32(secret)).update(counter).digest();
  const offset=mac[mac.length-1]&0x0f;
  const n=(mac.readUInt32BE(offset)&0x7fffffff)%1_000_000;
  return n.toString().padStart(6,'0');
}
export function verifyTotp(secret:string,code:string,at=Date.now(),lastStep=-1):number|null {
  if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))return null;
  const current=Math.floor(at/30_000);
  for(let step=current-1;step<=current+1;step++){
    if(step<=lastStep||step<0)continue;
    const value=totpAt(secret,step);
    if(timingSafeEqual(Buffer.from(value),Buffer.from(code)))return step;
  }
  return null;
}
function getKey():Buffer {
  const value=process.env.MFA_ENCRYPTION_KEY||'';
  if(!/^[a-f0-9]{64}$/i.test(value))throw new Error('mfa_encryption_key_unconfigured');
  return Buffer.from(value,'hex');
}
export function encryptSecret(secret:string):string {
  decode32(secret);
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',getKey(),iv);
  const data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return [iv.toString('hex'),data.toString('hex'),cipher.getAuthTag().toString('hex')].join(':');
}
export function decryptSecret(encrypted:string):string {
  const [ivHex,dataHex,tagHex,...rest]=encrypted.split(':');
  if(rest.length||!ivHex||!dataHex||!tagHex||ivHex.length!==24||tagHex.length!==32)throw new Error('invalid_encrypted_secret');
  const cipher=createDecipheriv('aes-256-gcm',getKey(),Buffer.from(ivHex,'hex'));
  cipher.setAuthTag(Buffer.from(tagHex,'hex'));
  const plain=Buffer.concat([cipher.update(Buffer.from(dataHex,'hex')),cipher.final()]).toString('utf8');
  decode32(plain);return plain;
}
export function newRecoveryCodes():string[] {
  return Array.from({length:8},()=>randomBytes(12).toString('hex').match(/.{1,4}/g)!.join('-'));
}
export function normalizeRecovery(code:unknown):string|null {
  if(typeof code!=='string')return null;
  const compact=code.toLowerCase().replace(/-/g,'');
  return /^[a-f0-9]{24}$/.test(compact)?compact:null;
}
export function recoveryDigest(code:string):string {
  const norm=normalizeRecovery(code);if(!norm)throw new Error('invalid_recovery_code');
  return tokenDigest('los-recovery-v1:'+norm);
}
export function mfaChallengeCookie(token:string,secure:boolean,expire=false):string {
  return `los_mfa_challenge=${expire?'':token}; Path=/api/v1/auth/mfa; HttpOnly; SameSite=Strict; ${secure?'Secure; ':''}Max-Age=${expire?0:300}`;
}
export function challengeFromRequest(req:Request):string|null {
  const pair=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('los_mfa_challenge='));
  const value=pair?.slice('los_mfa_challenge='.length)||'';
  return /^[a-f0-9]{64}$/.test(value)?value:null;
}
export function otpauthUrl(email:string,secret:string):string {
  const label=encodeURIComponent(`Learning OS:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Learning OS')}&algorithm=SHA1&digits=6&period=30`;
}
