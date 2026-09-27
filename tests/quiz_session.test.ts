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

test('MultiplicationChallenge session validates answers and advances hints on wrong attempts', () => {
  const challenge = createMultiplicationChallenge(5, 4, 'bridge');
  assert.equal(challenge.kind, 'multiplication');
  assert.equal(challenge.a, 5);
  assert.equal(challenge.b, 4);
  assert.equal(challenge.options.length, 3);

  const session = new ChallengeSession(challenge);
  assert.equal(session.isSolved(), false);
  assert.equal(session.getAttempts(), 0);

  // Wrong answer
  const wrongChoice = challenge.options.find(o => Number(o.value) !== 20)!.value;
  const res1 = session.submit(wrongChoice);

  assert.equal(res1.isCorrect, false);
  assert.equal(res1.attempts, 1);
  assert.equal(res1.hintStage, 1);
  assert(res1.hint.includes('4 nhóm, mỗi nhóm 5 viên đá'));
  assert.equal(session.isSolved(), false);

  // Correct answer
  const res2 = session.submit(20);
  assert.equal(res2.isCorrect, true);
  assert.equal(session.isSolved(), true);
});

test('FlowerChallenge session validates answers and advances through tiered hints', () => {
  const q = flowerSeeds[0]; // 100
  const challenge = createFlowerChallenge(q);
  assert.equal(challenge.kind, 'flower');
  assert.equal(challenge.answer, '100');

  const session = new ChallengeSession(challenge);

  // Manual hint request
  const hint1 = session.requestHint();
  assert.equal(session.getHintStage(), 1);
  assert.equal(hint1, challenge.hints[0]);

  // Wrong submission advances hint stage
  const wrongChoice = challenge.options.find(o => o.value !== '100')!.value;
  const resWrong = session.submit(wrongChoice);
  assert.equal(resWrong.isCorrect, false);
  assert.equal(session.getHintStage(), 2);
  assert.equal(resWrong.hint, challenge.hints[1]);

  // Correct submission completes session
  const resCorrect = session.submit('100');
  assert.equal(resCorrect.isCorrect, true);
  assert.equal(session.isSolved(), true);
});

test('Repeated wrong attempts in multiplication cap at stage 3 and provide full solution', () => {
  const challenge = createMultiplicationChallenge(2, 6, 'practice');
  const session = new ChallengeSession(challenge);

  session.submit(99); // 1
  session.submit(99); // 2
  const res3 = session.submit(99); // 3

  assert.equal(res3.attempts, 3);
  assert.equal(res3.hintStage, 3);
  assert(res3.hint.includes('= 12'));
});

test('ArchimedesChallenge session supports multi-step monoliths, tiered hints, and explanations', () => {
  const m = archSeeds[0];
  const challenge = createArchimedesChallenge(m as any, 0); // Bài 306, step 0
  assert.equal(challenge.kind, 'archimedes');
  assert.equal(challenge.monolithId, 306);
  assert.equal(challenge.answer, '893');

  const session = new ChallengeSession(challenge);
  assert.equal(session.isSolved(), false);

  // Wrong attempt
  const wrongChoice = challenge.options.find(o => o.value !== '893')!.value;
  const resWrong = session.submit(wrongChoice);
  assert.equal(resWrong.isCorrect, false);
  assert.equal(resWrong.hintStage, 1);
  assert.ok(resWrong.hint.length > 0);

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


