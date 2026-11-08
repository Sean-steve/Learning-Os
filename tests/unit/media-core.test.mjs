import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeEmbed, isSafeExternalUrl, normalizedProgress, upsertProgress, addBookmark, readMediaState, stableTextId, emptyMediaState } from '../../apps/web/src/phase3/media-core.ts';

test('YouTube watch, short, shorts, playlist links parse without fetching content', () => {
  assert.equal(parseYouTubeEmbed('https://youtube.com/watch?v=dQw4w9WgXcQ')?.id, 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeEmbed('https://youtu.be/dQw4w9WgXcQ?t=30')?.type, 'video');
  assert.equal(parseYouTubeEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.type, 'video');
  assert.equal(parseYouTubeEmbed('https://youtube.com/playlist?list=PLCetVV-Qpsq-GiWZVlKndpMQE3AQ34XVc')?.type, 'playlist');
  assert.match(parseYouTubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.embedUrl ?? '', /youtube-nocookie/);
});
test('reject host-spoofing, unsafe URLs, channel and malformed media ids', () => {
  for (const url of ['https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'http://youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/@AstralDoorway', 'https://www.youtube.com/watch?v=bad']) assert.equal(parseYouTubeEmbed(url), null);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl('https://example.org/library'), true);
});
test('normalize audio time and 100 percent completion deterministically', () => {
  const x = normalizedProgress({ mediaId: 'audio:1', kind: 'audio', position: 30, total: 120, updatedAt: '2026-11-08' });
  assert.equal(x.percent, 25); assert.equal(x.completed, false);
  assert.equal(normalizedProgress({ mediaId: 'audio:1', kind: 'audio', position: 500, total: 120 }).percent, 100);
  assert.equal(normalizedProgress({ mediaId: 'video:1', kind: 'video', position: 0, total: 0 }).percent, 0);
  assert.equal(normalizedProgress({ mediaId: 'pdf:1', kind: 'pdf', position: NaN, total: 10 }).position, 0);
});
test('bookmarks and progress remain independent and durable in JSON', () => {
  const one = upsertProgress(emptyMediaState(), normalizedProgress({ mediaId:'pdf:demo', kind:'pdf', position:3, total:9 }));
  const two = addBookmark(one, { mediaId:'pdf:demo', kind:'pdf', position:3, title:'Key passage', note:'Review later' }, 'test-mark');
  const restored = readMediaState(JSON.stringify(two));
  assert.equal(restored.progress['pdf:demo'].percent,33);
  assert.equal(restored.bookmarks[0].note,'Review later');
  assert.equal(restored.bookmarks[0].position,3);
});
test('malformed stored values are rejected', () => {
  assert.deepEqual(readMediaState('{bad'),emptyMediaState());
  assert.deepEqual(readMediaState(JSON.stringify({ version: 2, progress:{},bookmarks:[] })),emptyMediaState());
  assert.equal(readMediaState(JSON.stringify({ version:1,progress:{},bookmarks:[{bad:true}] })).bookmarks.length,0);
});
test('stable text ids are content sensitive',()=>{
  assert.equal(stableTextId('A lesson'),stableTextId('A lesson'));
  assert.notEqual(stableTextId('A lesson'),stableTextId('Different lesson'));
});
