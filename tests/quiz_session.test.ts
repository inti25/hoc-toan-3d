import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMultiplicationChallenge,
  createFlowerChallenge,
  createArchimedesChallenge,
  ChallengeSession,
  parseAnswer
} from '../src/quiz/session';
import seedData from '../src/data/seedData.json';

const flowerSeeds = seedData.questionsBySheet['VuonHoa'];
const archSeeds = seedData.questionsBySheet['Zone_1_Archimedes'];

test('MultiplicationChallenge session validates answers and advances hints on demand', () => {
  const challenge = createMultiplicationChallenge(5, 4, 'bridge');
  assert.equal(challenge.kind, 'multiplication');
  assert.equal(challenge.a, 5);
  assert.equal(challenge.b, 4);
  assert.equal(challenge.options.length, 3);

  const session = new ChallengeSession(challenge);
  assert.equal(session.isSolved(), false);
  assert.equal(session.getAttempts(), 0);

  // Wrong answer does NOT advance hint stage automatically
  const wrongChoice = challenge.options.find(o => Number(o.value) !== 20)!.value;
  const res1 = session.submit(wrongChoice);

  assert.equal(res1.isCorrect, false);
  assert.equal(res1.attempts, 1);
  assert.equal(res1.hintStage, 0);
  assert.equal(res1.hint, '');
  assert.equal(session.isSolved(), false);

  // User manually requests hint
  const hint1 = session.requestHint();
  assert.equal(session.getHintStage(), 1);
  assert(hint1.includes('4 nhóm, mỗi nhóm 5 viên đá'));

  // Correct answer
  const res2 = session.submit(20);
  assert.equal(res2.isCorrect, true);
  assert.equal(session.isSolved(), true);
});

test('FlowerChallenge session validates answers and advances through tiered hints on request', () => {
  const q = flowerSeeds[0]; // 100
  const challenge = createFlowerChallenge(q);
  assert.equal(challenge.kind, 'flower');
  assert.equal(challenge.answer, '100');

  const session = new ChallengeSession(challenge);

  // Manual hint request
  const hint1 = session.requestHint();
  assert.equal(session.getHintStage(), 1);
  assert.equal(hint1, challenge.hints[0]);

  // Wrong submission does NOT advance hint stage
  const wrongChoice = challenge.options.find(o => o.value !== '100')!.value;
  const resWrong = session.submit(wrongChoice);
  assert.equal(resWrong.isCorrect, false);
  assert.equal(session.getHintStage(), 1);
  assert.equal(resWrong.hint, '');

  // Second hint request advances stage
  const hint2 = session.requestHint();
  assert.equal(session.getHintStage(), 2);
  assert.equal(hint2, challenge.hints[1]);

  // Correct submission completes session
  const resCorrect = session.submit('100');
  assert.equal(resCorrect.isCorrect, true);
  assert.equal(session.isSolved(), true);
});

test('Repeated manual hint requests in multiplication cap at stage 3', () => {
  const challenge = createMultiplicationChallenge(2, 6, 'practice');
  const session = new ChallengeSession(challenge);

  // Wrong attempts do not change hint stage
  session.submit(99);
  session.submit(99);
  session.submit(99);
  assert.equal(session.getAttempts(), 3);
  assert.equal(session.getHintStage(), 0);

  // Manual requests advance up to stage 3
  session.requestHint(); // 1
  session.requestHint(); // 2
  const hint3 = session.requestHint(); // 3
  assert.equal(session.getHintStage(), 3);
  assert.equal(session.isMaxHintStage(), true);
  assert(hint3.includes('= 12'));
});

test('ArchimedesChallenge session supports multi-step monoliths, tiered hints, and explanations on demand', () => {
  const m = archSeeds[0];
  const challenge = createArchimedesChallenge(m as any, 0); // Bài 306, step 0
  assert.equal(challenge.kind, 'archimedes');
  assert.equal(challenge.monolithId, 306);
  assert.equal(challenge.answer, '893');

  const session = new ChallengeSession(challenge);
  assert.equal(session.isSolved(), false);

  // Wrong attempt does not increment hint stage
  const wrongChoice = challenge.options.find(o => o.value !== '893')!.value;
  const resWrong = session.submit(wrongChoice);
  assert.equal(resWrong.isCorrect, false);
  assert.equal(resWrong.hintStage, 0);
  assert.equal(resWrong.hint, '');

  // Manual hint request
  const hint = session.requestHint();
  assert.equal(session.getHintStage(), 1);
  assert.ok(hint.length > 0);

  // Correct attempt
  const resCorrect = session.submit('893');
  assert.equal(resCorrect.isCorrect, true);
  assert.equal(session.isSolved(), true);
  assert.ok(resCorrect.explanation && resCorrect.explanation.includes('893'));
});

test('parseAnswer correctly separates numeric values, units, comparisons, and textual choices', () => {
  // Pure numbers
  assert.deepEqual(parseAnswer('100'), { type: 'numeric', raw: '100', expectedNumber: 100, unit: '' });
  assert.deepEqual(parseAnswer(42), { type: 'numeric', raw: '42', expectedNumber: 42, unit: '' });

  // Numbers with units
  assert.deepEqual(parseAnswer('22kg'), { type: 'numeric', raw: '22kg', expectedNumber: 22, unit: 'kg' });
  assert.deepEqual(parseAnswer('707 kg'), { type: 'numeric', raw: '707 kg', expectedNumber: 707, unit: 'kg' });
  assert.deepEqual(parseAnswer('470 ℓ'), { type: 'numeric', raw: '470 ℓ', expectedNumber: 470, unit: 'ℓ' });
  assert.deepEqual(parseAnswer('50 quyển'), { type: 'numeric', raw: '50 quyển', expectedNumber: 50, unit: 'quyển' });
  assert.deepEqual(parseAnswer('12 cm'), { type: 'numeric', raw: '12 cm', expectedNumber: 12, unit: 'cm' });

  // Comparison operators
  assert.deepEqual(parseAnswer('<'), { type: 'comparison', raw: '<', expectedChar: '<' });
  assert.deepEqual(parseAnswer('>'), { type: 'comparison', raw: '>', expectedChar: '>' });
  assert.deepEqual(parseAnswer('='), { type: 'comparison', raw: '=', expectedChar: '=' });

  // Textual choices
  assert.equal(parseAnswer('Thứ Tư').type, 'choice');
  assert.equal(parseAnswer('Anh Hiếu').type, 'choice');
  assert.equal(parseAnswer('5 hình chữ nhật').type, 'choice');
  assert.equal(parseAnswer('Ngày 28 tháng 5').type, 'choice');
});

test('Bridge mode validates missing factor as well as product', () => {
  const challenge = createMultiplicationChallenge(3, 4, 'bridge');
  assert.equal(challenge.a, 3);
  assert.equal(challenge.b, 4);
  assert.equal(challenge.answer, 12);
  assert.equal(challenge.expectedInput, 4);

  // Submitting the missing factor 4 is correct
  const s1 = new ChallengeSession(challenge);
  assert.equal(s1.submit(4).isCorrect, true);

  // Submitting the product 12 is also accepted for backwards compatibility
  const s2 = new ChallengeSession(challenge);
  assert.equal(s2.submit(12).isCorrect, true);

  // Submitting wrong number fails
  const s3 = new ChallengeSession(challenge);
  assert.equal(s3.submit(5).isCorrect, false);
});

test('FlowerChallenge accepts typed number for questions with units', () => {
  const flower1 = createFlowerChallenge(flowerSeeds[1]); // Bài 2: answer '22kg'
  const session = new ChallengeSession(flower1);

  // Typing pure number 22
  assert.equal(session.submit('22').isCorrect, true);

  const flower3 = createFlowerChallenge(flowerSeeds[3]); // Bài 4: answer '50 quyển'
  const session2 = new ChallengeSession(flower3);
  assert.equal(session2.submit(50).isCorrect, true);
});

test('ArchimedesChallenge accepts comparison operators and typed numbers with units', () => {
  // Bài 307 step 0: answer '707 kg'
  const arch1 = createArchimedesChallenge(archSeeds[1] as any, 0);
  assert.equal(arch1.answer, '707 kg');
  const s1 = new ChallengeSession(arch1);
  assert.equal(s1.submit(707).isCorrect, true);

  // Bài 308 step 0: answer '='
  const archComp = createArchimedesChallenge(archSeeds[2] as any, 0);
  assert.equal(archComp.answer, '=');
  const s2 = new ChallengeSession(archComp);
  assert.equal(s2.submit('=').isCorrect, true);
  assert.equal(s2.submit('>').isCorrect, false);
});

test('parseAnswer handles multi-slot answers with delimiter |', () => {
  const parsed = parseAnswer('88|100');
  assert.equal(parsed.type, 'multi');
  assert.equal(parsed.raw, '88|100');
  assert.deepEqual(parsed.expectedAnswers, ['88', '100']);
  assert.equal(parsed.slots?.length, 2);
  assert.equal(parsed.slots![0].type, 'numeric');
  assert.equal(parsed.slots![0].expectedNumber, 88);
  assert.equal(parsed.slots![1].type, 'numeric');
  assert.equal(parsed.slots![1].expectedNumber, 100);

  // Mixed slot types
  const parsedMixed = parseAnswer('12 cm | > | 40');
  assert.equal(parsedMixed.type, 'multi');
  assert.equal(parsedMixed.slots?.length, 3);
  assert.equal(parsedMixed.slots![0].type, 'numeric');
  assert.equal(parsedMixed.slots![0].unit, 'cm');
  assert.equal(parsedMixed.slots![1].type, 'comparison');
  assert.equal(parsedMixed.slots![1].expectedChar, '>');
  assert.equal(parsedMixed.slots![2].type, 'numeric');
  assert.equal(parsedMixed.slots![2].expectedNumber, 40);
});

test('ChallengeSession validates multi-slot answers with slotResults array', () => {
  const challenge = {
    id: 'test_multi',
    kind: 'archimedes' as const,
    monolithId: 310,
    monolithIndex: 4,
    stepIndex: 0,
    totalSteps: 1,
    title: 'Bài 310',
    zoneName: 'Khu 1',
    page: 25,
    badge: 'Đá Cổ',
    color: 0x3b82f6,
    prompt: 'Theo sơ đồ: 80 ➔ (+8) ➔ [ Lục giác ] ➔ (+12) ➔ [ Tam giác ]',
    options: [],
    answer: '88|100',
    hints: ['Tính 80 + 8 trước', 'Tính tiếp + 12'],
    explanation: '80 + 8 = 88; 88 + 12 = 100',
    monolith: {} as any,
    step: {} as any
  };

  const session = new ChallengeSession(challenge);

  // Partial match: slot 0 correct, slot 1 wrong
  const res1 = session.submit(['88', '99']);
  assert.equal(res1.isCorrect, false);
  assert.deepEqual(res1.slotResults, [true, false]);
  assert.equal(session.isSolved(), false);

  // Both wrong
  const res2 = session.submit(['50', '60']);
  assert.equal(res2.isCorrect, false);
  assert.deepEqual(res2.slotResults, [false, false]);

  // Both correct via array
  const res3 = session.submit(['88', '100']);
  assert.equal(res3.isCorrect, true);
  assert.deepEqual(res3.slotResults, [true, true]);
  assert.equal(session.isSolved(), true);

  // Also accepts pipe-delimited string
  const session2 = new ChallengeSession(challenge);
  const resStr = session2.submit('88|100');
  assert.equal(resStr.isCorrect, true);
  assert.deepEqual(resStr.slotResults, [true, true]);
});


