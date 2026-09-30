import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ExplorerProfileManager,
  FRIENDLY_NICKNAMES,
  EXPLORER_PROFILE_KEY
} from '../src/core/profile';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  };
}

test('ExplorerProfileManager generates friendly default profile when storage is empty', () => {
  const storage = createMemoryStorage();
  const manager = new ExplorerProfileManager(storage);
  const profile = manager.getProfile();

  assert.equal(profile.nickname, 'Dũng Sĩ Tí Hon');
  assert.equal(profile.className, 'Lớp 2');
  assert.equal(profile.isAnonymous, true);
});

test('ExplorerProfileManager persists and sanitizes updated profile', () => {
  const storage = createMemoryStorage();
  const manager = new ExplorerProfileManager(storage);

  const updated = manager.saveProfile({
    nickname: '  Bé An 3A  ',
    className: '  3A1  '
  });

  assert.equal(updated.nickname, 'Bé An 3A');
  assert.equal(updated.className, '3A1');
  assert.equal(updated.isAnonymous, false);

  // Verify reload from storage
  const reloaded = manager.getProfile();
  assert.deepEqual(reloaded, updated);
});

test('ExplorerProfileManager falls back to random nickname if saved with empty nickname', () => {
  const storage = createMemoryStorage();
  const manager = new ExplorerProfileManager(storage);

  const saved = manager.saveProfile({
    nickname: '   ',
    className: '3B'
  });

  assert.ok(saved.nickname.length > 0);
  assert.ok(FRIENDLY_NICKNAMES.includes(saved.nickname as any));
  assert.equal(saved.className, '3B');
  assert.equal(saved.isAnonymous, true);
});

test('ExplorerProfileManager gracefully handles corrupted JSON in storage', () => {
  const storage = createMemoryStorage();
  storage.setItem(EXPLORER_PROFILE_KEY, '{invalid json!!');
  const manager = new ExplorerProfileManager(storage);

  const profile = manager.getProfile();
  assert.equal(profile.nickname, 'Dũng Sĩ Tí Hon');
  assert.equal(profile.className, 'Lớp 2');
  assert.equal(profile.isAnonymous, true);
});

test('ExplorerProfileManager gracefully handles throwing storage (private browsing / quota error)', () => {
  const throwingStorage = {
    getItem: () => {
      throw new Error('Access denied (SecurityError)');
    },
    setItem: () => {
      throw new Error('Quota exceeded');
    }
  };

  const manager = new ExplorerProfileManager(throwingStorage as any);
  const profile = manager.getProfile();
  assert.ok(profile.nickname.length > 0);

  // Saving should not throw
  const saved = manager.saveProfile({
    nickname: 'Nhà Thám Hiểm VIP',
    className: '3A'
  });
  assert.equal(saved.nickname, 'Nhà Thám Hiểm VIP');

  // Manager in-memory fallback preserves saved state
  const fetchedAgain = manager.getProfile();
  assert.equal(fetchedAgain.nickname, 'Nhà Thám Hiểm VIP');
  assert.equal(fetchedAgain.className, '3A');
  assert.equal(fetchedAgain.isAnonymous, false);
});

test('ExplorerProfileManager formatTelemetryPayload formats full telemetry record', () => {
  const storage = createMemoryStorage();
  const manager = new ExplorerProfileManager(storage);
  manager.saveProfile({
    nickname: 'Thám Hiểm Nhí',
    className: '3C'
  });

  const payload = manager.formatTelemetryPayload({
    zoneId: 1,
    problemId: 'M1',
    stepId: 'step_1',
    isCorrect: true,
    score: 20,
    details: { timeSpentMs: 4500 }
  });

  assert.equal(payload.action, 'logProgress');
  assert.equal(payload.explorerName, 'Thám Hiểm Nhí');
  assert.equal(payload.className, '3C');
  assert.equal(payload.zoneId, 1);
  assert.equal(payload.problemId, 'M1');
  assert.equal(payload.stepId, 'step_1');
  assert.equal(payload.isCorrect, true);
  assert.equal(payload.score, 20);
  assert.deepEqual(payload.details, { timeSpentMs: 4500 });
});
