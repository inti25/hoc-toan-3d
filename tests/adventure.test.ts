import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Adventure } from '../src/core/adventure';
import { freshState } from '../src/core/state';
import { BRIDGE_PARTS } from '../src/data/config';

// In-memory fake storage adapter for testing
function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val)
  };
}

test('Adventure starts with initial state and provides read-only state', () => {
  const storage = createMemoryStorage();
  const adv = new Adventure(freshState(), storage);
  const state = adv.getState();

  assert.equal(state.xp, 0);
  assert.equal(state.coins, 0);
  assert.equal(state.bridge, 0);
  assert.equal(state.questComplete, false);
});

test('recordQuizResult correctly awards XP, coins, advances bridge, and triggers level up', () => {
  const storage = createMemoryStorage();
  const adv = new Adventure(freshState(), storage);

  // Correct answer in bridge mode
  const delta1 = adv.recordQuizResult({
    isCorrect: true,
    questionId: 'm2_3',
    isBridgeMode: true,
    firstTry: true,
    responseTimeMs: 1500
  });

  assert.equal(delta1.isCorrect, true);
  assert.equal(delta1.xpGained, 10);
  assert.equal(delta1.coinsGained, 5);
  assert.equal(delta1.bridge, 1);
  assert.equal(delta1.combo, 1);
  assert.equal(delta1.bridgeCompleted, false);

  assert.equal(adv.getState().xp, 10);
  assert.equal(adv.getState().coins, 5);
  assert.equal(adv.getState().bridge, 1);
});

test('completing 6 bridge segments triggers bridgeCompleted', () => {
  const storage = createMemoryStorage();
  const adv = new Adventure(freshState(), storage);

  let lastDelta;
  for (let i = 0; i < BRIDGE_PARTS; i++) {
    lastDelta = adv.recordQuizResult({
      isCorrect: true,
      questionId: `m2_${i + 1}`,
      isBridgeMode: true,
      firstTry: true
    });
  }

  assert.equal(lastDelta?.bridge, 6);
  assert.equal(lastDelta?.bridgeCompleted, true);
  assert.equal(adv.getState().bridge, 6);
});

test('river crossing awards quest completion once only', () => {
  const storage = createMemoryStorage();
  const adv = new Adventure({ ...freshState(), bridge: BRIDGE_PARTS }, storage);

  const cross1 = adv.completeRiverCrossing();
  assert.equal(cross1.completed, true);
  assert.equal(cross1.xpGained, 50);
  assert.equal(cross1.coinsGained, 10);
  assert.equal(adv.getState().questComplete, true);

  // Crossing again does not award duplicate rewards
  const cross2 = adv.completeRiverCrossing();
  assert.equal(cross2.completed, false);
  assert.equal(cross2.xpGained, 0);
  assert.equal(cross2.coinsGained, 0);
});

test('blooming flowers awards XP and triggers grand garden reward on 10th flower', () => {
  const storage = createMemoryStorage();
  const adv = new Adventure(freshState(), storage);

  // Bloom first 9 flowers
  for (let i = 0; i < 9; i++) {
    const res = adv.bloomFlower(i);
    assert.equal(res.alreadyBloomed, false);
    assert.equal(res.xpGained, 15);
    assert.equal(res.coinsGained, 5);
    assert.equal(res.allFlowersCompleted, false);
  }

  // 10th flower should trigger grand reward (+100 XP, +30 coins)
  const res10 = adv.bloomFlower(9);
  assert.equal(res10.alreadyBloomed, false);
  assert.equal(res10.allFlowersCompleted, true);
  assert.equal(res10.xpGained, 115); // 15 + 100
  assert.equal(res10.coinsGained, 35); // 5 + 30
  assert.equal(res10.totalBloomed, 10);

  // Re-blooming an already bloomed flower does not give duplicate rewards
  const repeat = adv.bloomFlower(0);
  assert.equal(repeat.alreadyBloomed, true);
  assert.equal(repeat.xpGained, 0);
  assert.equal(repeat.coinsGained, 0);
});
