/** Pure local-first Learning OS scheduling and accountability rules.
 * No OAuth secrets, background jobs, or remote dependencies belong here.
 */
export type LearningMode = 'listen' | 'read' | 'watch' | 'practice';
export type ScheduledActivity = {
  id: string;
  day: string;     // YYYY-MM-DD in the learner's LOCAL timezone
  time: string;    // HH:mm local wall-clock time
  minutes: number;
  title: string;
  mode: LearningMode;
};
export type BusyInterval = { start: string; end: string };
export type ScheduleRules = {
  quietStart: string;
  quietEnd: string;
  maxDailyMinutes: number;
  reminderLeadMinutes: number;
  activeWeekdays: number[]; // 0 = Sunday ... 6 = Saturday
};
export const DEFAULT_RULES: ScheduleRules = {
  quietStart: '22:00', quietEnd: '06:00', maxDailyMinutes: 90,
  reminderLeadMinutes: 15, activeWeekdays: [1, 2, 3, 4, 5, 6],
};
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
const ymd = /^\d{4}-\d{2}-\d{2}$/;
export const minutesOf = (clock: string): number => {
  if (!hhmm.test(clock)) throw new Error('invalid_time');
  const [hh, mm] = clock.split(':').map(Number);
  return hh * 60 + mm;
};
export const timeOf = (value: number) =>
  String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
export function validDate(day: string) {
  if (!ymd.test(day)) return false;
  const date = new Date(day + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
export function localDay(date: Date): string {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}
export function localDateTime(day: string, time: string) {
  if (!validDate(day)) throw new Error('invalid_day');
  minutesOf(time);
  const date = new Date(day + 'T' + time + ':00');
  if (Number.isNaN(date.getTime()) || localDay(date) !== day || date.getHours() * 60 + date.getMinutes() !== minutesOf(time)) throw new Error('invalid_local_datetime');
  return date;
}
export function validateActivity(activity: ScheduledActivity): void {
  if (!activity.id || activity.id.length > 90 || !activity.title.trim() || activity.title.length > 140) throw new Error('invalid_activity');
  if (!Number.isInteger(activity.minutes) || activity.minutes < 5 || activity.minutes > 180) throw new Error('invalid_minutes');
  if (!['listen', 'read', 'watch', 'practice'].includes(activity.mode)) throw new Error('invalid_mode');
  localDateTime(activity.day, activity.time);
  if (minutesOf(activity.time) + activity.minutes > 1440) throw new Error('cross_midnight_not_supported');
}
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
export function isQuietPeriod(activity: ScheduledActivity, rules = DEFAULT_RULES): boolean {
  const start = minutesOf(activity.time), end = start + activity.minutes;
  const quietStart = minutesOf(rules.quietStart), quietEnd = minutesOf(rules.quietEnd);
  // Quiet spans midnight (e.g. 22:00–06:00) or a daytime period.
  if (quietStart > quietEnd) return start < quietEnd || end > quietStart;
  return overlaps(start, end, quietStart, quietEnd);
}
export function validatePlacement(activity: ScheduledActivity, existing: ScheduledActivity[], rules = DEFAULT_RULES, busy: BusyInterval[] = []) {
  validateActivity(activity);
  const why: string[] = [];
  if (!rules.activeWeekdays.includes(localDateTime(activity.day, '12:00').getDay())) why.push('Rest day is protected');
  if (isQuietPeriod(activity, rules)) why.push('Protected sleep/quiet hours');
  const today = existing.filter(e => e.day === activity.day && e.id !== activity.id);
  const total = today.reduce((n, s) => n + s.minutes, 0) + activity.minutes;
  if (total > rules.maxDailyMinutes) why.push('Daily learning budget exceeded');
  const from = minutesOf(activity.time), to = from + activity.minutes;
  if (today.some(s => overlaps(from, to, minutesOf(s.time), minutesOf(s.time) + s.minutes))) why.push('Overlaps another learning session');
  const fromMs = localDateTime(activity.day, activity.time).getTime(), toMs = fromMs + activity.minutes * 60_000;
  if (busy.some(x => {
    const a = Date.parse(x.start), b = Date.parse(x.end);
    return Number.isFinite(a) && Number.isFinite(b) && overlaps(fromMs, toMs, a, b);
  })) why.push('Conflicts with a Google Calendar busy interval');
  return { ok: why.length === 0, warnings: why, dayTotalMinutes: total };
}
export function nextSafeSlot(activity: ScheduledActivity, existing: ScheduledActivity[], rules = DEFAULT_RULES, busy: BusyInterval[] = [], startDay = activity.day, maxDays = 14): ScheduledActivity | null {
  if (!validDate(startDay)) throw new Error('invalid_start_day');
  const anchors = ['06:30', '08:00', '12:30', '18:00', '20:30', '09:00', '15:00', '19:30'];
  for (let d = 0; d < Math.min(60, Math.max(1, maxDays)); d++) {
    const date = new Date(startDay + 'T12:00:00'); date.setDate(date.getDate() + d);
    const day = localDay(date);
    for (const time of anchors) {
      const proposal = { ...activity, day, time };
      if (validatePlacement(proposal, existing, rules, busy).ok) return proposal;
    }
  }
  return null;
}
export type Accountability = { done: number; due: number; missed: number; upcoming: number; adherencePercent: number; onTrack: boolean };
export function accountability(sessions: ScheduledActivity[], completed: string[], now = new Date()): Accountability {
  const completedSet = new Set(completed);
  let due = 0, done = 0, missed = 0, upcoming = 0;
  for (const s of sessions) {
    const isDone = completedSet.has(s.id);
    const ending = localDateTime(s.day, s.time).getTime() + s.minutes * 60_000;
    if (isDone) done++;
    if (ending <= now.getTime()) {
      due++;
      if (!isDone) missed++;
    } else upcoming++;
  }
  return { done, due, missed, upcoming, adherencePercent: due ? Math.round(100 * Math.max(0, due - missed) / due) : 100, onTrack: missed < 3 };
}
export function coachingNote(a: Accountability, restQuality: number): string {
  if (restQuality <= 4) return 'Protect sleep first. Shorten tomorrow’s learning block; never make up sessions by staying awake.';
  if (a.missed > 0) return 'You missed a few sessions. Choose one small session to reschedule; the missed work does not need to pile up.';
  if (!a.due) return 'Your program is ready. Try a short audio session to begin.';
  return 'Your practice is consistent. Keep the schedule realistic and review what you can demonstrate.';
}
export function googleCalendarUrl(activity: ScheduledActivity): string {
  validateActivity(activity);
  const start = localDateTime(activity.day, activity.time);
  const end = new Date(start.getTime() + activity.minutes * 60_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({action:'TEMPLATE', text:'Learning OS: ' + activity.title, dates:f(start) + '/' + f(end), details:'Planned learning session. Manually created from Learning OS; it will not sync changes back.'});
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
const icsEscape = (x: string) => x.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
export function icsCalendar(sessions: ScheduledActivity[], leadMinutes = 15, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const f = (d: Date) => d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Learning OS//Study Schedule//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for (const s of sessions) {
    validateActivity(s);
    const start = localDateTime(s.day, s.time);
    const end = new Date(start.getTime() + s.minutes * 60_000);
    lines.push('BEGIN:VEVENT','UID:' + s.id.replace(/[^A-Za-z0-9._-]/g,'') + '@learning-os.local', 'DTSTAMP:' + stamp,
      'DTSTART:' + f(start),'DTEND:' + f(end),'SUMMARY:' + icsEscape('Learning OS: ' + s.title),
      'DESCRIPTION:Learning mode: ' + s.mode + '. Exported manually from Learning OS.');
    if (leadMinutes > 0) lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Learning OS reminder','TRIGGER:-PT' + Math.round(leadMinutes) + 'M','END:VALARM');
    lines.push('END:VEVENT');
  }
  return [...lines,'END:VCALENDAR',''].join('\r\n');
}
