/** Learning OS Phase 3 media domain. Browser-local state; never interpreted as server sync. */
export type MediaKind = 'video' | 'pdf' | 'audio' | 'text';
export interface MediaProgress { mediaId: string; kind: MediaKind; position: number; total: number; percent: number; completed: boolean; updatedAt: string }
export interface MediaBookmark { id: string; mediaId: string; kind: MediaKind; position: number; title: string; note: string; createdAt: string }
export interface MediaState { version: 1; progress: Record<string, MediaProgress>; bookmarks: MediaBookmark[] }
export const MEDIA_STORAGE_KEY = 'los.phase3.media.v1';
export const emptyMediaState = (): MediaState => ({ version: 1, progress: {}, bookmarks: [] });

const safeNumber = (value: number, fallback = 0) => Number.isFinite(value) ? Math.max(0, value) : fallback;
export const clamp = (value: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, Number.isFinite(value) ? value : lower));
export const stableTextId = (text: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `text:${(hash >>> 0).toString(16)}`;
};

export type YouTubeEmbed = { type: 'video' | 'playlist'; id: string; canonicalUrl: string; embedUrl: string };
const ytVideo = /^[A-Za-z0-9_-]{11}$/;
const ytList = /^[A-Za-z0-9_-]{10,}$/;
export function parseYouTubeEmbed(input: string): YouTubeEmbed | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const isYouTube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host);
    const isShort = host === 'youtu.be' || host === 'www.youtu.be';
    if (!isYouTube && !isShort) return null;
    let video = isShort ? u.pathname.split('/')[1] : '';
    if (isYouTube) {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'watch') video = u.searchParams.get('v') ?? '';
      else if (['shorts', 'embed', 'live'].includes(parts[0])) video = parts[1] ?? '';
    }
    if (ytVideo.test(video)) {
      const id = video;
      return { type: 'video', id, canonicalUrl: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    const list = u.searchParams.get('list') ?? '';
    if (isYouTube && (u.pathname === '/playlist' || u.pathname === '/watch') && ytList.test(list)) {
      return { type: 'playlist', id: list, canonicalUrl: `https://www.youtube.com/playlist?list=${list}`, embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}` };
    }
    return null;
  } catch { return null; }
}
export function isSafeExternalUrl(value: string): boolean {
  try { const u = new URL(value); return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname); }
  catch { return false; }
}
export function normalizedProgress(input: { mediaId: string; kind: MediaKind; position: number; total: number; completed?: boolean; updatedAt?: string }): MediaProgress {
  const total = safeNumber(input.total);
  const position = total > 0 ? clamp(input.position, 0, total) : safeNumber(input.position);
  const completed = Boolean(input.completed) || (total > 0 && position >= total);
  const percent = completed ? 100 : total > 0 ? Math.round(clamp(100 * position / total, 0, 100)) : 0;
  return { mediaId: input.mediaId, kind: input.kind, position, total, percent, completed, updatedAt: input.updatedAt ?? new Date().toISOString() };
}
export function upsertProgress(state: MediaState, progress: MediaProgress): MediaState {
  if (!progress.mediaId) return state;
  return { ...state, progress: { ...state.progress, [progress.mediaId]: progress } };
}
export function addBookmark(state: MediaState, data: { mediaId: string; kind: MediaKind; position: number; title: string; note?: string }, id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): MediaState {
  if (!data.mediaId || !data.title.trim()) return state;
  const mark: MediaBookmark = { id, mediaId: data.mediaId, kind: data.kind, position: safeNumber(data.position), title: data.title.trim().slice(0, 120), note: (data.note ?? '').trim().slice(0, 500), createdAt: new Date().toISOString() };
  return { ...state, bookmarks: [mark, ...state.bookmarks].slice(0, 300) };
}
export function readMediaState(json: string | null): MediaState {
  if (!json || json.length > 500_000) return emptyMediaState();
  try {
    const data: unknown = JSON.parse(json);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('progress' in data) || !('bookmarks' in data)) return emptyMediaState();
    const record = data as MediaState;
    return { version: 1, progress: record.progress && typeof record.progress === 'object' && !Array.isArray(record.progress) ? record.progress : {}, bookmarks: Array.isArray(record.bookmarks) ? record.bookmarks.filter(m => m && typeof m.mediaId === 'string' && typeof m.title === 'string').slice(0, 300) : [] };
  } catch { return emptyMediaState(); }
}
