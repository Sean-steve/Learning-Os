import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSourceText, createPlan, proposeAdjustment, isSafeUrl, checkPreferences } from '../../packages/learning-core/src/index.ts';
const prefs={days:90,minutesPerDay:45,listeningShare:.7,readingBlockMinutes:15,daysPerWeek:6,practiceMinutes:10,startDate:'2026-11-09'};
const sources=[{id:'s1',name:'Lecture source',kind:'video'}];
const transcript='Step 1: Remember the dream when waking. Step 2: Record a practical observation with clear details. Step 3: Repeat this every day to build recall. Remember to practice awareness and log what you notice.';
const analysis=analyzeSourceText({id:'s1',title:'Lecture source',kind:'video',origin:'pasted',text:transcript,now:'2026-11-08T00:00:00Z'});
test('source insights preserve provenance and actual excerpts',()=>{
 assert.equal(analysis.id,'s1');assert.ok(analysis.excerpts.length>0);
 assert.equal(analysis.takeaways[0].excerptId,analysis.excerpts[0].id);
 assert.ok(analysis.warnings.some(w=>w.includes('no automatic URL')));
});
test('extraordinary claims are not marked scientific fact',()=>{
 const a=analyzeSourceText({id:'s2',title:'Speculative notes',kind:'book',origin:'pasted',text:'Telekinesis is guaranteed by this technique, according to a personal claim. This statement has not been independently proven.'});
 assert.equal(a.verification,'unverified-claim');assert.ok(a.warnings.some(w=>w.includes('extraordinary')));
});
test('source links are validated without fetching arbitrary URLs',()=>{
 assert.equal(isSafeUrl('https://example.org/lesson'),true);assert.equal(isSafeUrl('javascript:alert(1)'),false);assert.equal(isSafeUrl('file:///etc/passwd'),false);
});
test('reject invalid source text lengths and missing titles',()=>{
 assert.throws(()=>analyzeSourceText({id:'x',title:'',kind:'video',origin:'pasted',text:transcript}));
 assert.throws(()=>analyzeSourceText({id:'x',title:'Known',kind:'video',origin:'pasted',text:'Too short.'}));
});
test('90-day audio-first plan has 90 dated entries, 4 gates and rest days',()=>{
 const plan=createPlan({title:'Lucid dreaming',outcome:'Recall 5 mornings a week',preferences:prefs,sources,sourceAnalyses:[analysis],id:'check'});
 assert.equal(plan.tasks.length,90);assert.equal(plan.tasks[0].date,'2026-11-09');assert.equal(plan.tasks[89].date,'2027-02-06');
 assert.equal(plan.stages.length,4);assert.ok(plan.tasks.some(t=>t.mode==='rest'));
 assert.ok(plan.tasks.some(t=>t.sourceId==='s1'));assert.ok(plan.tasks.every(t=>t.minutes<=45));
 assert.equal(plan.generator,'structured-offline');
});
test('unprocessed video references never become assigned learning content',()=>{
 const plan=createPlan({title:'Learn TypeScript',outcome:'Build a typed app',preferences:{...prefs,days:30},sources});
 assert.equal(plan.sources[0].analyzed,false);assert.ok(plan.tasks.every(t=>!t.sourceId));
});
test('15-minute reading block remains short',()=>{
 const plan=createPlan({title:'Learn TypeScript',outcome:'Build a typed app',preferences:prefs});
 assert.ok(plan.tasks.some(t=>t.mode==='read'&&t.minutes<=45));
 assert.ok(plan.tasks.some(t=>t.mode==='listen'));
});
test('invalid dates, probabilities and minutes are rejected',()=>{
 assert.throws(()=>checkPreferences({...prefs,startDate:'2026-02-30'}));
 assert.throws(()=>checkPreferences({...prefs,listeningShare:1.8}));
 assert.throws(()=>checkPreferences({...prefs,minutesPerDay:0}));
});
test('adaptive check-in reduces intensity without stacking missed lessons',()=>{
 const plan=createPlan({title:'Learn TypeScript',outcome:'Build typed apps',preferences:prefs});
 const adjustment=proposeAdjustment(plan,{complete:2,scheduled:6,availableMinutes:25,sleepQuality:4,difficulty:'difficult'});
 assert.ok(adjustment.nextMinutes<=25);assert.equal(adjustment.keepSleep,true);assert.match(adjustment.reason,/sleep/i);
});
test('invalid check-ins are rejected',()=>{
 const plan=createPlan({title:'Learn TypeScript',outcome:'Build typed apps',preferences:prefs});
 assert.throws(()=>proposeAdjustment(plan,{complete:8,scheduled:6,availableMinutes:30,sleepQuality:6,difficulty:'easy'}));
});
