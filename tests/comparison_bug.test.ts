import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, ChallengeSession } from '../src/quiz/session';
import { sanitizeRemoteProblems } from '../src/core/sheetsClient';

describe('Diagnosing bugs: Comparison operators (>=, <=, =, <, >) and Google Sheets #ERROR!', () => {
  test('parseAnswer correctly identifies >= and <= as comparison operators', () => {
    const parsedGte = parseAnswer('>=');
    assert.equal(parsedGte.type, 'comparison', '">=" should be parsed as comparison type');
    assert.equal(parsedGte.expectedChar, '>=');

    const parsedLte = parseAnswer('<=');
    assert.equal(parsedLte.type, 'comparison', '"<=" should be parsed as comparison type');
    assert.equal(parsedLte.expectedChar, '<=');

    const parsedUnicodeGte = parseAnswer('≥');
    assert.equal(parsedUnicodeGte.type, 'comparison', '"≥" should be parsed as comparison type');

    const parsedUnicodeLte = parseAnswer('≤');
    assert.equal(parsedUnicodeLte.type, 'comparison', '"≤" should be parsed as comparison type');
  });

  test('ChallengeSession validates >= and <= answers correctly', () => {
    const session = new ChallengeSession({
      id: 'arch_test_gte',
      kind: 'archimedes',
      prompt: 'Điền dấu thích hợp: x + 2 [ ? ] 10',
      options: [
        { label: '>=', value: '>=' },
        { label: '<=', value: '<=' },
        { label: '=', value: '=' }
      ],
      answer: '>=',
      hints: ['Gợi ý 1'],
      explanation: 'Giải thích'
    });

    const res = session.submit('>=');
    assert.equal(res.isCorrect, true, 'Submitting ">=" for answer ">=" should be correct');

    const sessionLte = new ChallengeSession({
      id: 'arch_test_lte',
      kind: 'archimedes',
      prompt: 'Điền dấu thích hợp: x - 2 [ ? ] 5',
      options: [
        { label: '>=', value: '>=' },
        { label: '<=', value: '<=' },
        { label: '=', value: '=' }
      ],
      answer: '<=',
      hints: ['Gợi ý 1'],
      explanation: 'Giải thích'
    });

    const resLte = sessionLte.submit('<=');
    assert.equal(resLte.isCorrect, true, 'Submitting "<=" for answer "<=" should be correct');
  });

  test('sanitizeRemoteProblems recovers #ERROR! caused by Google Sheets formula parsing', () => {
    const rawSheetProblem = {
      id: 308,
      title: 'Bài 308: Điền dấu so sánh thích hợp',
      steps: [
        {
          stepId: '308_1',
          prompt: 'Điền dấu thích hợp: 890 + 3 [ ? ] 800 + 90 + 3',
          options: [
            { label: '#ERROR!', value: '#ERROR!' },
            { label: '>', value: '>' },
            { label: '<', value: '<' }
          ],
          answer: '#ERROR!',
          hints: ['Tính vế trái', 'Tính vế phải']
        }
      ]
    };

    const sanitized = sanitizeRemoteProblems([rawSheetProblem]);
    assert.equal(sanitized.length, 1);
    const step = sanitized[0].steps[0];

    assert.equal(step.answer, '=', 'Sanitizer should heal "#ERROR!" back to "=" in comparison questions');
    const hasEqualOption = step.options.some(o => o.value === '=');
    assert.equal(hasEqualOption, true, 'Options should have "=" restored instead of "#ERROR!"');
    const hasErrorOption = step.options.some(o => o.value === '#ERROR!');
    assert.equal(hasErrorOption, false, 'Options should no longer contain "#ERROR!"');
  });
});
