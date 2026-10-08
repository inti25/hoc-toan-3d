import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeQuestion, generateQuestion, recordAnswer, validateAnswer, getHint } from '../src/quiz/engine.ts';
import { freshState, parseSave } from '../src/core/state.ts';
import { TABLES, getLevel } from '../src/data/config.ts';
import { FLOWER_QUESTIONS } from '../src/data/flowerQuestions.ts';

test('all 100 questions across tables 1 to 10 have three distinct valid answers in both modes',()=>{
  for(const a of TABLES)for(let b=1;b<=10;b++)for(const mode of ['bridge','practice'] as const){
    const q=makeQuestion(a,b,mode);assert.equal(q.options.length,3);assert.equal(new Set(q.options.map(o=>o.value)).size,3);
    assert.equal(q.options.filter(o=>validateAnswer(q,o.value)).length,1);assert(q.options.every(o=>o.value>=1&&o.value<=100));
    if(mode==='bridge')for(const o of q.options){const [x,y]=o.label.split(' × ').map(Number);assert(x>=1&&x<=10);assert(y>=1&&y<=10);assert.equal(x*y,o.value);}
  }
});
test('answer positions are shuffled rather than fixed',()=>{const positions=new Set<number>();for(let i=0;i<80;i++){const q=makeQuestion(5,5,'bridge');positions.add(q.options.findIndex(o=>o.value===25));}assert.equal(positions.size,3);});
test('wrong answers are queued and tracked without lost XP or coins',()=>{const s=freshState();s.xp=20;s.coins=10;const q=makeQuestion(2,3,'bridge');recordAnswer(s,q,false,3000);assert.equal(s.xp,20);assert.equal(s.coins,10);assert.deepEqual(s.review,['m2_3']);assert.equal(s.questionStats.m2_3.wrong,1);recordAnswer(s,q,true,2000);assert.equal(s.questionStats.m2_3.correct,1);assert.equal(s.questionStats.m2_3.attempts,2);assert.equal(s.review.length,1);});
test('review queue is selected and immediate repetition is avoided',()=>{const s=freshState();s.review=['m5_4'];assert.equal(generateQuestion(s,'practice','',()=>.2).id,'m5_4');assert.notEqual(generateQuestion(s,'practice','m5_4',()=>.2).id,'m5_4');});
test('table filter and hint levels are correct',()=>{const s=freshState();s.table=10;for(let i=0;i<40;i++)assert.equal(generateQuestion(s,'practice').a,10);const q=makeQuestion(5,4,'bridge');assert(!getHint(q,1).includes('20'));assert(getHint(q,1).includes('4 nhóm, mỗi nhóm 5 viên đá'));assert(getHint(q,2).includes('5 + 5 + 5 + 5'));assert(getHint(q,3).includes('= 20'));assert(getHint(q,3).includes('4 nhóm, mỗi nhóm 5 viên đá'));});
test('save roundtrip preserves progression, preferences, and review history',()=>{const s=freshState();s.started=true;s.xp=80;s.coins=45;s.bridge=6;s.questAccepted=true;s.questComplete=true;s.avatar='girl';s.table=5;recordAnswer(s,makeQuestion(5,7,'practice'),false,3210);assert.deepEqual(parseSave(JSON.stringify(s)),s);});
test('corrupted save safely defaults or sanitizes',()=>{assert.deepEqual(parseSave('{oops'),freshState());assert.deepEqual(parseSave('null'),freshState());assert.deepEqual(parseSave('{"version":2}'),freshState());const s=parseSave('{"version":1,"xp":-50,"bridge":99,"coins":"oops","review":["evil","m2_1"],"questComplete":true}');assert.equal(s.xp,0);assert.equal(s.bridge,6);assert.equal(s.coins,0);assert.deepEqual(s.review,['m2_1']);});
test('level thresholds match the game design',()=>{assert.deepEqual([0,99,100,249,250,449,450,699,700].map(getLevel),[1,1,2,2,3,3,4,4,5]);});
