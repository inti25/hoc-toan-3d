import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChallengeDialog } from '../src/quiz/ChallengeDialog';
import { Adventure } from '../src/core/adventure';
import type { ChallengePorts, ChallengeOutcome } from '../src/quiz/types';

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
  const actions: string[] = [];
  const state = {
    openedDialog: null as { title: string; body: string; kind: string } | null,
    closedDialog: false,
    toasts: [] as string[],
    playedCues: [] as string[],
    playerBursts: 0,
    hudUpdates: 0,
    telemetryRecords: [] as any[]
  };

  const adventure = new Adventure();

  const ports: ChallengePorts = {
    ui: {
      openDialog: (title, body, kind) => {
        actions.push(`openDialog:${kind}`);
        state.openedDialog = { title, body, kind };
      },
      closeDialog: () => {
        actions.push('closeDialog');
        state.closedDialog = true;
      },
      toast: (msg) => {
        actions.push(`toast:${msg}`);
        state.toasts.push(msg);
      },
      updateHUD: () => {
        actions.push('updateHUD');
        state.hudUpdates++;
      }
    },
    audio: {
      playCue: (cue) => {
        actions.push(`playCue:${cue}`);
        state.playedCues.push(cue);
      }
    },
    world: {
      burstPlayer: () => {
        actions.push('burstPlayer');
        state.playerBursts++;
      },
      getWorld: () =>
        ({
          setBridge: () => {},
          bloomFlower: () => {},
          activateMonolith: () => {}
        } as any)
    },
    adventure,
    telemetry: {
      logRemoteProgress: async (record) => {
        actions.push(`telemetry:${record.problemId}`);
        state.telemetryRecords.push(record);
      }
    }
  };

  return { ports, state, actions, adventure };
}

test('ChallengeDialog accepts structured ChallengePorts and launches multiplication challenge', async () => {
  const { ports, state, actions } = createMockChallengePorts();
  const challengeDialog = new ChallengeDialog(ports);

  const outcomePromise = challengeDialog.startChallenge({
    type: 'multiplication',
    mode: 'practice'
  });

  assert.ok(state.openedDialog !== null, 'Dialog should be opened');
  assert.equal(state.openedDialog.kind, 'quiz');
  assert.ok(actions.includes('openDialog:quiz'));

  const session = challengeDialog.getSession();
  assert.ok(session, 'Challenge session should be active');

  // Submit correct answer
  const answer = (session as any).challenge.answer;
  (challengeDialog as any).submitMultiplicationAnswer(answer, (session as any).challenge);

  const outcome: ChallengeOutcome = await outcomePromise;

  assert.equal(outcome.status, 'solved');
  assert.equal(outcome.isCorrect, true);
  assert.equal(outcome.attempts, 1);
  assert.ok(outcome.durationMs >= 0);
  assert.equal(outcome.rewards?.xp, 10);
  assert.equal(outcome.rewards?.coins, 5);
  assert.ok(state.playerBursts > 0, 'Should trigger burstPlayer side effect');
});

test('ChallengeDialog startChallenge resolves with dismissed status when dialog session is reset', async () => {
  const { ports } = createMockChallengePorts();
  const challengeDialog = new ChallengeDialog(ports);

  const outcomePromise = challengeDialog.startChallenge({
    type: 'multiplication',
    mode: 'bridge'
  });

  // Player closes the modal without solving
  challengeDialog.resetSession();

  const outcome: ChallengeOutcome = await outcomePromise;

  assert.equal(outcome.status, 'dismissed');
  assert.equal(outcome.isCorrect, false);
  assert.equal(outcome.attempts, 0);
  assert.equal(challengeDialog.getSession(), undefined);
});

test('Starting a new challenge cleanly dismisses previous uncompleted challenge', async () => {
  const { ports } = createMockChallengePorts();
  const challengeDialog = new ChallengeDialog(ports);

  const outcomePromise1 = challengeDialog.startChallenge({
    type: 'multiplication',
    mode: 'bridge'
  });

  // Start second challenge without completing first
  const outcomePromise2 = challengeDialog.startChallenge({
    type: 'flower',
    index: 0
  });

  const outcome1 = await outcomePromise1;
  assert.equal(outcome1.status, 'dismissed', 'First challenge should be dismissed');
  assert.equal(outcome1.spec.type, 'multiplication');

  // Second challenge is now active
  assert.ok(challengeDialog.getSession() !== undefined);
  challengeDialog.resetSession();
  const outcome2 = await outcomePromise2;
  assert.equal(outcome2.status, 'dismissed');
  assert.equal(outcome2.spec.type, 'flower');
});
