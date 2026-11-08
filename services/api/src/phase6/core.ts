/** Pure auth and document-boundary rules for a private Learning OS PostgreSQL backend. */
import { randomBytes, scrypt as scryptCb, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);
import { SYNC_KEYS } from '../../../../packages/sync-contract/src/index.ts';
export const RECORD_KEYS = SYNC_KEYS;
export type RecordKey = typeof RECORD_KEYS[number];
const allowed = new Set<string>(RECORD_KEYS);
export function validRecordKey(key: unknown): key is RecordKey {
  return typeof key === 'string' && allowed.has(key);
}
export function validateRecord(key: unknown, value: unknown): asserts key is RecordKey {
  if (!validRecordKey(key)) throw new Error('invalid_record_key');
  if (value === undefined || value === null || !['object','string','number','boolean'].includes(typeof value)) throw new Error('invalid_record_data');
  if (typeof value === 'object' && Array.isArray(value) && value.length > 10000) throw new Error('record_too_large');
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (!bytes || bytes > 500_000) throw new Error('record_too_large');
}
export function normalizeEmail(input: unknown): string {
  if (typeof input !== 'string') throw new Error('invalid_email');
  const email = input.trim().toLowerCase();
  if (!/^[^\s@<>]{1,64}@[^\s@<>]{1,185}\.[a-z]{2,}$/i.test(email) || email.length > 254) throw new Error('invalid_email');
  return email;
}
export function validatePassword(pw: unknown): asserts pw is string {
  if (typeof pw !== 'string' || pw.length < 12 || pw.length > 128 || !/\S/.test(pw)) throw new Error('weak_password');
}
export async function hashPassword(pw: string) {
  validatePassword(pw);
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(pw, Buffer.from(salt,'hex'), 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(pw: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const a = Buffer.from(parts[2],'hex');
    if (a.length !== 64) return false;
    const b = (await scrypt(pw, Buffer.from(parts[1],'hex'),64)) as Buffer;
    return timingSafeEqual(a,b);
  } catch { return false; }
}
export const tokenDigest = (token:string)=>createHash('sha256').update(token).digest('hex');
export function extractSessionToken(req:Request) {
  const pair=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('los_session='));
  const token=pair?.slice('los_session='.length)||'';
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function sessionCookie(token:string, secure:boolean, expire=false) {
  return `los_session=${expire?'':token}; Path=/; HttpOnly; SameSite=Lax; ${secure?'Secure; ':''}Max-Age=${expire?0:60*60*24*7}`;
}
export function validateOrigin(req:Request, origin:string):boolean {
  const actual=req.headers.get('origin');
  if (!actual || actual !== origin) return false;
  return req.headers.get('x-learning-intent') === 'manual-sync';
}
export function parseRevision(rev: unknown):number {
  if (!Number.isInteger(rev) || (rev as number)<0 || (rev as number)>2_000_000_000) throw new Error('invalid_revision');
  return rev as number;
}
export async function parseJson(req:Request,max=600_000):Promise<Record<string,unknown>> {
  if(Number(req.headers.get('content-length')||0)>max)throw new Error('request_too_large');
  const body=await req.text(); if(Buffer.byteLength(body)>max)throw new Error('request_too_large');
  let result:unknown;
  try {result=JSON.parse(body);}catch {throw new Error('invalid_json');}
  if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('invalid_json');
  return result as Record<string,unknown>;
}
