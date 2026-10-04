import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimeAgo,
  getSyncStatusLabel,
  hasLocalProgress,
  runLocalStorageMigration,
  MIGRATION_KEY,
  SyncManager
} from '../src/core/SyncManager';
import { freshState } from '../src/core/state';
import { Adventure } from '../src/core/adventure';
import { ExplorerProfileManager } from '../src/core/profile';

function createMemoryStorage(initialData: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialData));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  };
}

test('formatTimeAgo handles various timestamps accurately in Vietnamese', () => {
  assert.equal(formatTimeAgo(null), 'Chưa đồng bộ');

  const now = Date.now();
  assert.equal(formatTimeAgo(now - 3000), 'Vừa xong');
  assert.equal(formatTimeAgo(now - 25000), '25 giây trước');
  assert.equal(formatTimeAgo(now - 150000), '2 phút trước');
  assert.equal(formatTimeAgo(now - 7500000), '2 giờ trước');

  const twoDaysAgo = now - 2 * 24 * 3600 * 1000;
  const formatted = formatTimeAgo(twoDaysAgo);
  assert.match(formatted, /\d{1,2}\/\d{1,2}\/\d{4}/);
});

test('getSyncStatusLabel formats labels with expressive emojis for all statuses', () => {
  const now = Date.now();
  assert.equal(getSyncStatusLabel('synced', now), '☁️ Đã lưu lên đám mây');
  assert.equal(getSyncStatusLabel('syncing', now), '🔄 Đang đồng bộ...');
  assert.equal(getSyncStatusLabel('offline', now), '⚡ Offline (Chờ mạng)');
  assert.match(getSyncStatusLabel('error', now, 'Mất kết nối mạng'), /⚠️ Lỗi kết nối \(Mất kết nối mạng\)/);
  assert.equal(getSyncStatusLabel('idle', null), '☁️ Sẵn sàng đồng bộ');
});

test('hasLocalProgress identifies whether student has made progress', () => {
  const empty = freshState();
  assert.equal(hasLocalProgress(empty), false);

  assert.equal(hasLocalProgress({ ...empty, xp: 50 }), true);
  assert.equal(hasLocalProgress({ ...empty, coins: 5 }), true);
  assert.equal(hasLocalProgress({ ...empty, bridge: 1 }), true);
  assert.equal(hasLocalProgress({ ...empty, started: true }), true);

  const flowersBloomed = [...empty.flowers];
  flowersBloomed[2] = true;
  assert.equal(hasLocalProgress({ ...empty, flowers: flowersBloomed }), true);

  assert.equal(hasLocalProgress({ ...empty, solvedProblems: { 'flower_1': true } }), true);
});

test('runLocalStorageMigration skips when migration flag is already present', async () => {
  const storage = createMemoryStorage({ [MIGRATION_KEY]: '2026-10-01T00:00:00Z' });
  const profileMgr = new ExplorerProfileManager(storage);
  const adventure = new Adventure({ storageAdapter: storage as any });

  let saveCalled = false;
  const syncManager = new SyncManager(adventure, profileMgr, {
    saveFn: async () => {
      saveCalled = true;
      return { success: true, message: 'ok' };
    }
  });

  const res = await runLocalStorageMigration(adventure, profileMgr, syncManager, storage);
  assert.equal(res.migrated, false);
  assert.equal(res.reason, 'already_migrated');
  assert.equal(saveCalled, false);
  syncManager.dispose();
});

test('runLocalStorageMigration marks flag without upload for brand new players', async () => {
  const storage = createMemoryStorage();
  const profileMgr = new ExplorerProfileManager(storage);
  const adventure = new Adventure({ storageAdapter: storage as any });

  let saveCalled = false;
  const syncManager = new SyncManager(adventure, profileMgr, {
    saveFn: async () => {
      saveCalled = true;
      return { success: true, message: 'ok' };
    }
  });

  const res = await runLocalStorageMigration(adventure, profileMgr, syncManager, storage);
  assert.equal(res.migrated, false);
  assert.equal(res.reason, 'no_local_progress');
  assert.equal(saveCalled, false);
  assert.ok(storage.getItem(MIGRATION_KEY));
  syncManager.dispose();
});

test('runLocalStorageMigration detects existing progress and successfully migrates to cloud', async () => {
  const storage = createMemoryStorage();
  const profileMgr = new ExplorerProfileManager(storage);
  const adventure = new Adventure({ storageAdapter: storage as any });

  // Giả lập người chơi cũ đã có 2 nhịp cầu và 120 XP
  adventure.restoreState({
    ...freshState(),
    xp: 120,
    coins: 30,
    bridge: 2,
    questAccepted: true
  });

  let uploadedPayload: any = null;
  const syncManager = new SyncManager(adventure, profileMgr, {
    saveFn: async (payload) => {
      uploadedPayload = payload;
      return {
        success: true,
        message: 'Lưu tiến trình thành công',
        passcode: payload.passcode
      };
    }
  });

  let notifiedMessage = '';
  const res = await runLocalStorageMigration(
    adventure,
    profileMgr,
    syncManager,
    storage,
    (msg) => {
      notifiedMessage = msg;
    }
  );

  assert.equal(res.migrated, true);
  assert.equal(res.reason, 'uploaded');
  assert.ok(res.passcode.startsWith('MTH-'));
  assert.ok(uploadedPayload);
  assert.equal(uploadedPayload.totalXP, 120);
  assert.equal(uploadedPayload.bridgeParts, 2);
  assert.ok(storage.getItem(MIGRATION_KEY));
  assert.match(notifiedMessage, /Mã:/);

  // Chạy lần 2: phải bỏ qua vì đã di chuyển
  const secondRun = await runLocalStorageMigration(adventure, profileMgr, syncManager, storage);
  assert.equal(secondRun.migrated, false);
  assert.equal(secondRun.reason, 'already_migrated');
  syncManager.dispose();
});

test('runLocalStorageMigration does not mark flag if cloud upload fails', async () => {
  const storage = createMemoryStorage();
  const profileMgr = new ExplorerProfileManager(storage);
  const adventure = new Adventure({ storageAdapter: storage as any });

  adventure.restoreState({
    ...freshState(),
    xp: 200,
    bridge: 3
  });

  const syncManager = new SyncManager(adventure, profileMgr, {
    saveFn: async () => {
      return {
        success: false,
        message: 'Lỗi timeout kết nối máy chủ'
      };
    }
  });

  const res = await runLocalStorageMigration(adventure, profileMgr, syncManager, storage);
  assert.equal(res.migrated, false);
  assert.equal(res.reason, 'upload_failed');
  assert.equal(storage.getItem(MIGRATION_KEY), null);
  syncManager.dispose();
});
