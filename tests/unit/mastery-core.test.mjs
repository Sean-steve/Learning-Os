import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANKS, DEFAULT_SKILLS, createCustomSkill, createEvidence, dayAdd, gradeAssessment, recommendNext, summarizeProgram, summarizeSkill } from '../../packages/mastery-core/src/index.ts';
const sample={f1:1,f2:2,f3:0};
const stamp='2026-11-08T11:00:00.000Z';
const attempt=gradeAssessment('foundation-check',sample,4,stamp,'a1');
const passing2=gradeAssessment('foundation-check',sample,4,'2026-11-09T11:00:00.000Z','a2');
test('grades an actual answered quiz rather than invented progress',()=>{assert.equal(attempt.correct,3);assert.equal(attempt.total,3);assert.equal(attempt.percent,100);assert.equal(attempt.confidence,4);assert.equal(attempt.skillId,'foundations')});
test('rejects empty, invalid or out-of-range answers and confidence',()=>{
  assert.throws(()=>gradeAssessment('foundation-check',{},3),/incomplete/);
  assert.throws(()=>gradeAssessment('foundation-check',{...sample,f1:99},3),/incomplete/);
  assert.throws(()=>gradeAssessment('foundation-check',sample,6),/confidence/);
  assert.throws(()=>gradeAssessment('not-bank',sample,3),/unknown_bank/);
});
test('a single passing quiz is not mastery',()=>{
  const s=summarizeSkill('foundations',[attempt],[],'2026-11-08');assert.equal(s.status,'in-progress');assert.equal(s.passingDays,1);assert.equal(s.verified,false);assert.equal(s.nextReview,'2026-11-10');
});
test('retakes on one date cannot bypass the separate-day knowledge gate',()=>{
  const extra={...attempt,id:'retake',at:'2026-11-08T18:00:00Z'};const s=summarizeSkill('foundations',[attempt,extra],[],'2026-11-08');assert.equal(s.passingDays,1);assert.notEqual(s.status,'knowledge-demonstrated');
});
test('two passing days show repeatable knowledge but never external verification',()=>{
  const s=summarizeSkill('foundations',[attempt,passing2],[],'2026-11-09');assert.equal(s.status,'knowledge-demonstrated');assert.equal(s.verified,false);assert.equal(s.nextReview,'2026-11-13');
});
test('practice evidence requires meaningful description and records provenance as self reported',()=>{
  assert.throws(()=>createEvidence({skillId:'foundations',kind:'practice-log',description:'did it'}));
  const e=createEvidence({skillId:'foundations',kind:'practice-log',description:'Recorded specific steps and compared what happened to my earlier notes.',at:stamp,id:'ev1'});
  const s=summarizeSkill('foundations',[attempt,passing2],[e],'2026-11-09');assert.equal(s.status,'practice-documented');assert.equal(s.practices,1);assert.equal(s.verified,false);assert.equal(e.verification,'self-reported');
});
test('user-entered external claims remain unverified',()=>{
  const e=createEvidence({skillId:'sleep-exploration',kind:'external-claim',description:'A surprising subjective experience was reported during training.',at:stamp,id:'unverified'});
  assert.equal(e.verification,'unverified-external-claim');const s=summarizeSkill('sleep-exploration',[],[e]);assert.equal(s.claims,1);assert.equal(s.practices,0);assert.equal(s.verified,false);
});
test('multiple learning goals can have custom skills without inventing assessment passes',()=>{
  const s=createCustomSkill('Conversational Swahili','Speak with a shopkeeper for five minutes',DEFAULT_SKILLS,'custom1');assert.equal(s.category,'custom');assert.equal(s.id,'custom1');assert.throws(()=>createCustomSkill('conversational swahili','Speak clearly', [...DEFAULT_SKILLS,s]),/duplicate/);
  assert.equal(summarizeSkill(s.id,[],[]).status,'not-assessed');
});
test('program summary counts only completed study sessions and actual quiz attempts',()=>{
  const sessions=[{id:'session1',day:'2026-11-09',minutes:20},{id:'session2',day:'2026-11-10',minutes:30}];
  const p=summarizeProgram(DEFAULT_SKILLS,[attempt],[],sessions,['session1'],'2026-11-10');assert.equal(p.sessionsDone,1);assert.equal(p.recordedMinutes,20);assert.equal(p.accuracy,100);assert.equal(p.knowledgeShown,0);assert.equal(p.verified,0);
});
test('AI-free coaching is explainable and reduces study with poor sleep',()=>{
  const p=recommendNext({skills:DEFAULT_SKILLS,attempts:[attempt],evidence:[],completedSessions:2,scheduledSessions:7,sleepQuality:3,dailyBudget:60,now:'2026-11-11T11:00:00Z'});
  assert.equal(p.mode,'listen');assert.equal(p.minutes,10);assert.match(p.headline,/rest/i);assert.equal(p.needsApproval,true);assert.equal(p.offline,true);
});
test('due reviews are prioritized before untouched skills',()=>{
  const a=recommendNext({skills:DEFAULT_SKILLS,attempts:[attempt],evidence:[],completedSessions:1,scheduledSessions:3,sleepQuality:8,dailyBudget:45,now:'2026-11-11T11:00:00Z'});
  assert.equal(a.skillId,'foundations');assert.match(a.headline,/due/i);
});
test('date arithmetic remains calendar-safe over month boundaries',()=>{assert.equal(dayAdd('2026-11-30',2),'2026-12-02');assert.throws(()=>dayAdd('2026-02-30',1))});
test('default question bank remains compatible with existing UI regression',()=>{assert.equal(BANKS[0].questions.length,3);assert.ok(BANKS[0].questions[0].choices.includes('Remain still and reconstruct the dream'));assert.ok(BANKS[0].questions[2].choices.includes('To separate claims and provenance from evidence'))});
