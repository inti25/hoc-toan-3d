import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMultiplicationChallenge,
  createFlowerChallenge,
  createArchimedesChallenge,
  ChallengeSession
} from '../src/quiz/session';
import { FLOWER_QUESTIONS } from '../src/data/flowerQuestions';

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
  const q = FLOWER_QUESTIONS[0]; // 100
  const challenge = createFlowerChallenge(0);
  assert.equal(challenge.kind, 'flower');
  assert.equal(challenge.answer, '100');

  const session = new ChallengeSession(challenge);

  // Manual hint request
  const hint1 = session.requestHint();
  assert.equal(session.getHintStage(), 1);
  assert.equal(hint1, q.hints[0]);

  // Wrong submission advances hint stage
  const wrongChoice = challenge.options.find(o => o.value !== '100')!.value;
  const resWrong = session.submit(wrongChoice);
  assert.equal(resWrong.isCorrect, false);
  assert.equal(session.getHintStage(), 2);
  assert.equal(resWrong.hint, q.hints[1]);

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
  const challenge = createArchimedesChallenge(0, 0); // Bài 306, step 0
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

