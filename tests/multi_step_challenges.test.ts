import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlowerChallenge } from '../src/quiz/session';
import type { RemoteProblem } from '../src/data/remoteTypes';

test('createFlowerChallenge extracts requested stepIndex and totalSteps correctly', () => {
  const multiStepProblem: RemoteProblem = {
    id: '221_1',
    title: 'Phép Nhân Nhiều Bước',
    subtitle: 'Công Viên Phép Nhân',
    steps: [
      {
        stepId: '221_1_1',
        prompt: 'Bước 1: Tính 3 x 4',
        options: [{ label: '12', value: '12' }, { label: '14', value: '14' }],
        answer: '12',
        hints: ['3 nhân 4 bằng 12'],
        explanation: '3 x 4 = 12'
      },
      {
        stepId: '221_1_2',
        prompt: 'Bước 2: Tính 12 x 2',
        options: [{ label: '24', value: '24' }, { label: '20', value: '20' }],
        answer: '24',
        hints: ['12 gấp đôi lên'],
        explanation: '12 x 2 = 24'
      },
      {
        stepId: '221_1_3',
        prompt: 'Bước 3: Tính 24 + 6',
        options: [{ label: '30', value: '30' }, { label: '28', value: '28' }],
        answer: '30',
        hints: ['24 cộng thêm 6'],
        explanation: '24 + 6 = 30'
      },
      {
        stepId: '221_1_4',
        prompt: 'Bước 4: Tính 30 : 5',
        options: [{ label: '6', value: '6' }, { label: '5', value: '5' }],
        answer: '6',
        hints: ['30 chia cho 5'],
        explanation: '30 : 5 = 6'
      }
    ]
  };

  // Test Step 0
  const c0 = createFlowerChallenge(multiStepProblem, 0);
  assert.equal(c0.totalSteps, 4);
  assert.equal(c0.stepIndex, 0);
  assert.equal(c0.prompt, 'Bước 1: Tính 3 x 4');
  assert.equal(c0.answer, '12');

  // Test Step 2
  const c2 = createFlowerChallenge(multiStepProblem, 2);
  assert.equal(c2.totalSteps, 4);
  assert.equal(c2.stepIndex, 2);
  assert.equal(c2.prompt, 'Bước 3: Tính 24 + 6');
  assert.equal(c2.answer, '30');

  // Test Step 3 (Last step)
  const c3 = createFlowerChallenge(multiStepProblem, 3);
  assert.equal(c3.totalSteps, 4);
  assert.equal(c3.stepIndex, 3);
  assert.equal(c3.prompt, 'Bước 4: Tính 30 : 5');
  assert.equal(c3.answer, '6');

  // Out of bounds step clamps to last step
  const c99 = createFlowerChallenge(multiStepProblem, 99);
  assert.equal(c99.stepIndex, 3);
  assert.equal(c99.prompt, 'Bước 4: Tính 30 : 5');
});

test('Multi-step challenge string IDs like 221_1 are properly matched in questions array', () => {
  const parkProblems: RemoteProblem[] = [
    {
      id: '221_1',
      title: 'Bài 221_1',
      steps: [
        { stepId: 'step1', prompt: 'P1', options: [{ label: 'A', value: 'A' }], answer: 'A', hints: [], explanation: '' },
        { stepId: 'step2', prompt: 'P2', options: [{ label: 'B', value: 'B' }], answer: 'B', hints: [], explanation: '' },
        { stepId: 'step3', prompt: 'P3', options: [{ label: 'C', value: 'C' }], answer: 'C', hints: [], explanation: '' },
        { stepId: 'step4', prompt: 'P4', options: [{ label: 'D', value: 'D' }], answer: 'D', hints: [], explanation: '' }
      ]
    }
  ];

  // Match by string ID or index fallback
  const targetId = '221_1';
  const found =
    parkProblems.find((p) => String(p.id) === String(targetId)) ||
    parkProblems.find((p) => Number(p.id) === Number(targetId)) ||
    parkProblems[0];

  assert.ok(found);
  assert.equal(found.id, '221_1');
  assert.equal(found.steps?.length, 4);
});
