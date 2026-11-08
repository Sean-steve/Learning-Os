/** No credentials, private account identity, or runtime dependencies in shared contracts. */
export const SYNC_KEYS = [
  'los.sources','los.sessions','los.goals','los.phase2.plans','los.phase2.analyses',
  'los.phase2.activePlan','los.completed','los.journal','los.lessonNotes','los.prefs',
  'los.phase3.media.v1','los.phase4.schedule.settings','los.phase5.attempts',
  'los.phase5.evidence','los.phase5.custom-skills','los.phase5.sleep-rating',
] as const;
export type SyncKey = typeof SYNC_KEYS[number];
export interface CloudUser { id:string; email:string }
export interface CloudRecord {key:SyncKey;data:unknown;revision:number;updatedAt:string}
export interface CloudState {mode:'preview'|'connecting'|'active'|'offline'|'conflict';user:CloudUser|null;pending:number;conflicts:string[];error:string}
