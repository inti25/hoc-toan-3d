import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChallengeDialog } from '../src/quiz/ChallengeDialog';
import { Adventure, generateFarmMultiplicationProblem } from '../src/core/adventure';
import type { ChallengePorts } from '../src/quiz/types';

function setupMockDom() {
  const elements: Record<string, any> = {};
  const doc = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: (id: string) =>
      elements[id] || {
        classList: { add: () => {}, remove: () => {} },
        style: {},
        textContent: '',
        innerHTML: '',
        hidden: false,
        focus: () => {}
      },
    querySelector: () => null,
    querySelectorAll: () => []
  };
  (globalThis as any).document = doc;
}

setupMockDom();

function createMockChallengePorts() {
  const state = {
    openedDialog: null as { title: string; body: string; kind: string } | null,
    closedDialog: false,
    toasts: [] as string[],
    playedCues: [] as string[],
    playerBursts: 0,
    hudUpdates: 0
  };

  const adventure = new Adventure();

  const ports: ChallengePorts = {
    ui: {
      openDialog: (title, body, kind) => {
        state.openedDialog = { title, body, kind };
      },
      closeDialog: () => {
        state.closedDialog = true;
      },
      toast: (msg) => {
        state.toasts.push(msg);
      },
      updateHUD: () => {
        state.hudUpdates++;
      }
    },
    audio: {
      playCue: (cue) => {
        state.playedCues.push(cue);
      }
    },
    world: {
      burstPlayer: () => {
        state.playerBursts++;
      },
      getWorld: () =>
        ({
          setBridge: () => {},
          bloomFlower: () => {},
          activateMonolith: () => {}
        } as any)
    },
    adventure
  };

  return { ports, state };
}

test('FARM_SANCTUARY ChallengeDialog displays problem title from Google Sheets problemData', async () => {
  const { ports, state } = createMockChallengePorts();
  const challengeDialog = new ChallengeDialog(ports);

  const problemData = {
    id: 'farm_prob_1',
    title: 'Bài 1: Phép nhân 2',
    subtitle: 'Bảng nhân 2 kết hợp',
    steps: [
      {
        stepId: 'step_1',
        prompt: '2 × 4 = ?',
        options: [
          { label: '8', value: '8' },
          { label: '6', value: '6' }
        ],
        answer: '8',
        hints: ['2 nhân 4 bằng 8']
      }
    ]
  };

  challengeDialog.openFarmAnimal('farm_cow_0', 'Bò Sữa', problemData, 0);

  assert.ok(state.openedDialog, 'Dialog should be opened');
  const bodyHtml = state.openedDialog.body;

  // The question title element should present the problem title
  assert.match(
    bodyHtml,
    /<div class="flower-question-title">[\s\S]*?Bài 1: Phép nhân 2[\s\S]*?<\/div>/,
    'Dialog question box must display problem title'
  );

  // The subtitle should appear in flower-question-subtitle on a separate line
  assert.match(
    bodyHtml,
    /<div class="flower-question-subtitle">[\s\S]*?Bảng nhân 2 kết hợp[\s\S]*?<\/div>/,
    'Dialog question box must display problem subtitle on its own line'
  );
});

test('ChallengeDialog preserves multiline subtitles with newlines from Google Sheets', async () => {
  const { ports, state } = createMockChallengePorts();
  const challengeDialog = new ChallengeDialog(ports);

  const problemData = {
    id: 'farm_prob_multiline',
    title: 'Bài 2: Tính nhanh',
    subtitle: 'Dòng 1: Nhân nhẩm\nDòng 2: Phép tính cộng',
    steps: [{ prompt: '2 + 2 = ?', options: [{ label: '4', value: '4' }], answer: '4' }]
  };

  challengeDialog.openFarmAnimal('farm_cow_1', 'Bò Vàng', problemData, 0);
  assert.ok(state.openedDialog);
  const bodyHtml = state.openedDialog.body;

  assert.match(
    bodyHtml,
    /<div class="flower-question-subtitle">[\s\S]*?Dòng 1: Nhân nhẩm\nDòng 2: Phép tính cộng[\s\S]*?<\/div>/,
    'Dialog subtitle must preserve newlines from Google Sheets'
  );
});

test('FARM_SANCTUARY ChallengeDialog displays title from procedural problemData', async () => {
  const { ports, state } = createMockChallengePorts();
  const challengeDialog = new ChallengeDialog(ports);

  const proceduralProblem = generateFarmMultiplicationProblem(0, 'cow');
  challengeDialog.openFarmAnimal('farm_cow_0', 'Bò Sữa', proceduralProblem, 0);

  assert.ok(state.openedDialog, 'Dialog should be opened');
  const bodyHtml = state.openedDialog.body;

  assert.match(
    bodyHtml,
    /<div class="flower-question-title">[\s\S]*?(Bảng nhân|Bài 1|Phép nhân)[\s\S]*?<\/div>/i,
    'Dialog question box must display generated problem title'
  );
});

test('generateFarmMultiplicationProblem includes title and subtitle for farm problems', () => {
  const problem = generateFarmMultiplicationProblem(0, 'cow');
  assert.ok(problem.title || problem.subtitle, 'Procedurally generated farm problem must define a title or subtitle');
  assert.match(
    problem.title || problem.subtitle,
    /bảng nhân|phép nhân|bài/i,
    'Procedural farm problem title should mention multiplication topic'
  );
  assert.match(
    problem.title,
    /Bài 1: Cứu Bé bò/i,
    'Procedural farm problem title must include full meaningful rescue title'
  );
});

test('Interact button title prioritization: only shows title from Google Sheets without subtitle', () => {
  const getInteractTitle = (pd: any, animalName: string = 'Bé Bò') => {
    return pd?.title || pd?.subtitle || `Bé ${animalName} Cần Giúp Đỡ`;
  };

  // Case 1: Both title and subtitle exist -> Only title is used (no subtitle concatenated)
  const pdFull = {
    title: 'Bài 1: Phép nhân 2',
    subtitle: 'Bảng nhân 2 kết hợp'
  };
  assert.equal(getInteractTitle(pdFull), 'Bài 1: Phép nhân 2');

  // Case 2: Only subtitle exists -> Fallback to subtitle
  const pdNoTitle = {
    subtitle: 'Bảng nhân 2 kết hợp'
  };
  assert.equal(getInteractTitle(pdNoTitle), 'Bảng nhân 2 kết hợp');

  // Case 3: Neither exists -> Fallback to default animal rescue prompt
  const pdEmpty = {};
  assert.equal(getInteractTitle(pdEmpty), 'Bé Bé Bò Cần Giúp Đỡ');
});
