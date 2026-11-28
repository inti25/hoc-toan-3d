import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChallengeDialog } from '../src/quiz/ChallengeDialog';
import { Adventure } from '../src/core/adventure';
import type { ChallengePorts, ChallengeOutcome } from '../src/quiz/types';
import { FarmRaceHud, formatRaceTimeMs, getRankBadgeText } from '../src/ui/FarmRaceHud';
import { FarmRaceEngine } from '../src/world/farm/FarmRaceLogic';

function createMiniElement(id = '', tag = 'div') {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const listeners = new Map<string, Array<(e?: any) => void>>();
  const children: any[] = [];
  const el: any = {
    id,
    tagName: tag.toUpperCase(),
    hidden: false,
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    children,
    classList: {
      add: (...c: string[]) => c.forEach((x) => classes.add(x)),
      remove: (...c: string[]) => c.forEach((x) => classes.delete(x)),
      toggle: (c: string, force?: boolean) => {
        const next = force !== undefined ? force : !classes.has(c);
        if (next) classes.add(c);
        else classes.delete(c);
        return next;
      },
      contains: (c: string) => classes.has(c)
    },
    setAttribute: (k: string, v: string) => attrs.set(k, String(v)),
    getAttribute: (k: string) => attrs.get(k) ?? null,
    addEventListener: (ev: string, fn: (e?: any) => void) => {
      const arr = listeners.get(ev) ?? [];
      arr.push(fn);
      listeners.set(ev, arr);
    },
    click: () => {
      (listeners.get('click') ?? []).forEach((fn) => fn({ target: el }));
    },
    append: (...nodes: any[]) => children.push(...nodes),
    replaceChildren: (...nodes: any[]) => {
      children.length = 0;
      children.push(...nodes);
    },
    remove: () => {},
    focus: () => {},
    querySelector: (selector: string): any => {
      if (selector.startsWith('#')) {
        const targetId = selector.slice(1);
        const search = (node: any): any => {
          if (node.id === targetId) return node;
          for (const ch of node.children ?? []) {
            const found = search(ch);
            if (found) return found;
          }
          return null;
        };
        return search(el);
      }
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        const search = (node: any): any => {
          if (node.className === cls || node.classList?.contains?.(cls)) return node;
          for (const ch of node.children ?? []) {
            const found = search(ch);
            if (found) return found;
          }
          return null;
        };
        return search(el);
      }
      return null;
    },
    querySelectorAll: () => []
  };
  return el;
}

function setupMockDomForChallengeAndHud() {
  const byId = new Map<string, any>();
  const body = createMiniElement('body', 'body');
  const doc: any = {
    body,
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag: string) => createMiniElement('', tag),
    getElementById: (id: string) => byId.get(id) ?? createMiniElement(id),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  (globalThis as any).document = doc;
  (globalThis as any).window = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  return { byId, doc };
}

test('ChallengeDialog launches farm_race_checkpoint using unified ChallengeSession and awards checkpoint rewards', async () => {
  setupMockDomForChallengeAndHud();
  const adventure = new Adventure();
  let openedKind = '';
  let loggedRecord: any = null;

  const ports: ChallengePorts = {
    ui: {
      openDialog: (_title, _body, kind) => {
        openedKind = kind;
      },
      closeDialog: () => {},
      toast: () => {},
      updateHUD: () => {}
    },
    audio: { playCue: () => {} },
    world: {
      burstPlayer: () => {},
      getWorld: () => ({} as any)
    },
    adventure,
    telemetry: {
      logRemoteProgress: async (rec) => {
        loggedRecord = rec;
      }
    }
  };

  const dialog = new ChallengeDialog(ports);
  const promise = dialog.startChallenge({
    type: 'farm_race_checkpoint',
    zoneId: 10,
    zoneName: 'Đường Đua Nông Trại',
    checkpointIndex: 0,
    totalCheckpoints: 5,
    progressKey: 'farm_race_10_q1',
    animalName: 'Cún Cưng',
    problem: {
      id: 'q1',
      title: 'Trạm Tăng Tốc #1',
      subtitle: 'Bảng cửu chương 6',
      steps: [
        {
          stepId: 'q1_s1',
          prompt: '6 × 7 = ?',
          options: [
            { label: '42', value: '42' },
            { label: '36', value: '36' }
          ],
          answer: '42',
          hints: ['Nhẩm 6 × 7 nhé!'],
          explanation: '6 × 7 = 42'
        }
      ]
    }
  });

  assert.equal(openedKind, 'farmRaceCheckpoint');
  const session = dialog.getSession();
  assert.ok(session);
  const res = session!.submit('42');
  assert.equal(res.isCorrect, true);

  // Trigger unified complete callback directly as UI button does
  (dialog as any).resolveActiveChallenge({
    spec: (dialog as any).activeChallenge.spec,
    status: 'solved',
    isCorrect: true,
    attempts: session!.getAttempts(),
    durationMs: session!.getDurationMs()
  });

  const outcome: ChallengeOutcome = await promise;
  assert.equal(outcome.status, 'solved');
  assert.equal(outcome.isCorrect, true);
  assert.equal(outcome.attempts, 1);

  // Verify Adventure checkpoint helper records state cleanly
  const cpDelta = adventure.solveFarmRaceCheckpoint({
    zoneId: 10,
    progressKey: 'farm_race_10_q1',
    firstTry: true
  });
  assert.equal(cpDelta.xpGained, 25);
  assert.equal(adventure.isProblemSolved('farm_race_10_q1', 10), true);
  void loggedRecord;
});

test('FarmRaceHud renders rank, boost progressbar, off-track alert, leaderboard, and compact toggle safely', () => {
  setupMockDomForChallengeAndHud();

  const root = createMiniElement('farm-race-hud', 'section');
  root.hidden = true;
  const ids = [
    'farm-race-rank',
    'farm-race-checkpoints',
    'farm-race-timer',
    'farm-race-boost-fill',
    'farm-race-boost-track',
    'farm-race-boost-label',
    'farm-race-offtrack',
    'farm-race-recover-btn',
    'farm-race-gate-alert',
    'farm-race-gate-alert-text',
    'farm-race-gate-return-btn',
    'farm-race-side',
    'farm-race-side-toggle',
    'farm-race-side-body',
    'farm-race-compass-arrow',
    'farm-race-target-name',
    'farm-race-direction-cue',
    'farm-race-target-dist',
    'farm-race-progress-badge',
    'farm-race-leaderboard',
    'farm-race-side-recover-btn',
    'farm-race-lobby-btn',
    'farm-race-countdown',
    'farm-race-countdown-value'
  ];
  for (const id of ids) {
    root.append(createMiniElement(id));
  }

  let recoverClicks = 0;
  let lobbyClicks = 0;
  const hud = new FarmRaceHud(root, {
    onRecoverToTrack: () => recoverClicks++,
    onOpenLobby: () => lobbyClicks++
  });

  const engine = new FarmRaceEngine(10);
  engine.startCountdown();
  for (let i = 0; i < 30; i++) {
    engine.update(0.1, { x: 13, z: 63.5 });
  }
  const cp0Pos = engine.checkpoints[0];
  engine.rawTrackDistance = cp0Pos.distance;
  engine.resumeAfterQuiz(true, true, 0);
  const offPos = { x: cp0Pos.x, z: cp0Pos.z - 12 }; // 12m off-track near cp0, still before cp1
  engine.update(0.1, offPos);

  const snap = engine.buildHudSnapshot(offPos, 0);
  hud.sync(snap);

  assert.equal(root.hidden, false);
  assert.equal(root.querySelector('#farm-race-rank').textContent, getRankBadgeText(snap.rank, 5));
  assert.equal(root.querySelector('#farm-race-checkpoints').textContent, '🔒 Trạm 1/10');
  assert.equal(root.querySelector('#farm-race-boost-track').getAttribute('aria-valuenow'), '98');
  assert.equal(root.querySelector('#farm-race-offtrack').hidden, false);
  assert.equal(root.querySelector('#farm-race-gate-alert').hidden, true);
  assert.equal(root.querySelector('#farm-race-leaderboard').children.length, 5);
  assert.equal(formatRaceTimeMs(65000), '01:05');

  // Skipping ahead shows gate alert; solving all unlocks finish badge
  const gateEngine = new FarmRaceEngine(10, [
    { id: 'g1', title: 'Trạm 1', subtitle: '', steps: [{ stepId: 'g1_1', prompt: '1+1=?', options: [{ label: '2', value: '2' }], answer: '2', hints: [], explanation: '' }] },
    { id: 'g2', title: 'Trạm 2', subtitle: '', steps: [{ stepId: 'g2_1', prompt: '2+2=?', options: [{ label: '4', value: '4' }], answer: '4', hints: [], explanation: '' }] }
  ]);
  gateEngine.startCountdown();
  for (let i = 0; i < 30; i++) {
    gateEngine.update(0.1, { x: 13, z: 63.5 });
  }
  const cp0 = gateEngine.checkpoints[0];
  const pastCp0 = gateEngine.track.sampleAtDistance(cp0.distance + 22, 0);
  gateEngine.rawTrackDistance = cp0.distance + 22;
  gateEngine.update(0.05, { x: pastCp0.x, z: pastCp0.z });
  hud.sync(gateEngine.buildHudSnapshot({ x: pastCp0.x, z: pastCp0.z }, 0));
  assert.equal(root.querySelector('#farm-race-gate-alert').hidden, false);
  assert.ok(root.querySelector('#farm-race-gate-alert-text').textContent.includes('Trạm #1'));

  gateEngine.resumeAfterQuiz(true, true, 0);
  gateEngine.resumeAfterQuiz(true, true, 1);
  hud.sync(gateEngine.buildHudSnapshot({ x: pastCp0.x, z: pastCp0.z }, 0));
  assert.equal(root.querySelector('#farm-race-gate-alert').hidden, true);
  assert.equal(root.querySelector('#farm-race-checkpoints').textContent, '🔓 Đủ 2/2 · Về đích!');
  assert.equal(root.classList.contains('is-finish-unlocked'), true);

  // Toggle collapse updates aria-expanded
  const toggleBtn = root.querySelector('#farm-race-side-toggle');
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'true');
  toggleBtn.click();
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'false');
  assert.equal(root.querySelector('#farm-race-side-body').hidden, true);

  root.querySelector('#farm-race-recover-btn').click();
  root.querySelector('#farm-race-lobby-btn').click();
  assert.equal(recoverClicks, 1);
  assert.equal(lobbyClicks, 1);

  hud.hide();
  assert.equal(root.hidden, true);
  hud.dispose();
});
