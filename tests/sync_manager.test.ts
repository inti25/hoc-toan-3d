import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates, SyncManager, type SyncStatus } from '../src/core/SyncManager';
import { freshState, type SaveState } from '../src/core/state';
import { Adventure } from '../src/core/adventure';
import { ExplorerProfileManager } from '../src/core/profile';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  };
}

test('mergeStates applies Union-Max to numerical progress and element-wise union to booleans', () => {
  const stateA: SaveState = {
    ...freshState(),
    xp: 300,
    coins: 50,
    bridge: 3,
    questAccepted: true,
    questComplete: false,
    combo: 5,
    flowers: [true, false, true, false, false, false, false, false, false, false],
    monoliths: [true, false, false, false],
    zoneBadges: [true, false, false, false, false],
    parkTrees: [true, false, false, false],
    solvedProblems: { '1_1': true, 'flower_1': true },
    questionStats: {
      'm2_1': {
        attempts: 2,
        correct: 1,
        wrong: 1,
        lastAnsweredAt: '2026-10-01T10:00:00Z',
        responseTime: 3500
      }
    }
  };

  const stateB: SaveState = {
    ...freshState(),
    xp: 450, // Higher XP
    coins: 40, // Lower coins
    bridge: 6, // Bridge complete!
    questAccepted: true,
    questComplete: true,
    combo: 8, // Higher combo
    flowers: [false, true, true, false, false, false, false, false, false, false], // Flower 2 & 3
    monoliths: [false, true, false, false], // Monolith 2
    zoneBadges: [false, true, false, false, false], // Badge 2
    parkTrees: [false, true, false, false], // Tree 2
    solvedProblems: { '1_2': true, 'flower_2': true },
    questionStats: {
      'm2_1': {
        attempts: 4,
        correct: 3,
        wrong: 1,
        lastAnsweredAt: '2026-10-02T10:00:00Z', // Later timestamp
        responseTime: 2100 // Faster response time
      },
      'm2_2': {
        attempts: 1,
        correct: 1,
        wrong: 0,
        lastAnsweredAt: '2026-10-02T10:05:00Z',
        responseTime: 1800
      }
    }
  };

  const merged = mergeStates(stateA, stateB);

  // 1. Max của chỉ số định lượng
  assert.equal(merged.xp, 450);
  assert.equal(merged.coins, 50);
  assert.equal(merged.bridge, 6);
  assert.equal(merged.combo, 8);
  assert.equal(merged.questComplete, true);

  // 2. Phép hợp mảng hoa (0, 1, 2 đều nở)
  assert.equal(merged.flowers[0], true);
  assert.equal(merged.flowers[1], true);
  assert.equal(merged.flowers[2], true);
  assert.equal(merged.flowers[3], false);

  // 3. Phép hợp mảng bia đá (0 và 1 đều kích hoạt)
  assert.equal(merged.monoliths[0], true);
  assert.equal(merged.monoliths[1], true);
  assert.equal(merged.monoliths[2], false);

  // 4. Phép hợp cây công viên (0 và 1 đều thức tỉnh)
  assert.equal(merged.parkTrees[0], true);
  assert.equal(merged.parkTrees[1], true);

  // 5. Phép hợp huy chương vùng đất (0 và 1 đều đạt)
  assert.equal(merged.zoneBadges[0], true);
  assert.equal(merged.zoneBadges[1], true);

  // 6. Gộp từ điển solvedProblems
  assert.equal(merged.solvedProblems['1_1'], true);
  assert.equal(merged.solvedProblems['1_2'], true);
  assert.equal(merged.solvedProblems['flower_1'], true);
  assert.equal(merged.solvedProblems['flower_2'], true);

  // 7. Hợp nhất QuestionStats
  const stat2_1 = merged.questionStats['m2_1'];
  assert.equal(stat2_1.correct, 3);
  assert.equal(stat2_1.wrong, 1);
  assert.ok(stat2_1.attempts >= 4);
  assert.equal(stat2_1.lastAnsweredAt, '2026-10-02T10:00:00Z');
  assert.equal(stat2_1.responseTime, 2100);

  const stat2_2 = merged.questionStats['m2_2'];
  assert.equal(stat2_2.correct, 1);
});

test('SyncManager throttles multiple rapid queueSync calls into single sync after debounce', async () => {
  const storage = createMemoryStorage();
  const adventure = new Adventure(freshState(), storage);
  const profileMgr = new ExplorerProfileManager(storage);

  profileMgr.saveProfile({
    nickname: 'Bé Na',
    className: '3A',
    passcode: 'MTH-882'
  });

  let saveCount = 0;
  let lastPayload: any = null;

  const syncManager = new SyncManager(adventure, profileMgr, {
    debounceMs: 50, // 50ms cho unit test
    saveFn: async (payload) => {
      saveCount++;
      lastPayload = payload;
      return { success: true, message: 'OK', passcode: payload.passcode };
    }
  });

  // Gọi 5 lần liên tiếp dồn dập
  syncManager.queueSync();
  syncManager.queueSync();
  syncManager.queueSync();
  syncManager.queueSync();
  syncManager.queueSync();

  assert.equal(saveCount, 0, 'Chưa được gọi ngay khi đang trong thời gian debounce');

  // Chờ hết thời gian debounce 50ms
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(saveCount, 1, 'Chỉ được gọi duy nhất 1 lần sau khi hết debounce');
  assert.equal(lastPayload.passcode, 'MTH-882');
  assert.equal(lastPayload.nickname, 'Bé Na');

  syncManager.dispose();
});

test('SyncManager milestone flush bypasses debounce and triggers immediate sync', async () => {
  const storage = createMemoryStorage();
  const adventure = new Adventure(freshState(), storage);
  const profileMgr = new ExplorerProfileManager(storage);

  profileMgr.saveProfile({
    nickname: 'Milo',
    className: 'Lớp 2',
    passcode: 'MTH-111'
  });

  let saveCount = 0;
  const syncManager = new SyncManager(adventure, profileMgr, {
    debounceMs: 5000, // 5 giây (quá dài nếu chờ)
    saveFn: async () => {
      saveCount++;
      return { success: true, message: 'OK' };
    }
  });

  // Gửi mốc quan trọng (isMilestone = true)
  syncManager.queueSync(true);

  // Phải kích hoạt ngay lập tức
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(saveCount, 1, 'Milestone phải kích hoạt đồng bộ ngay lập tức');

  syncManager.dispose();
});

test('SyncManager notifies status changes: idle -> syncing -> synced', async () => {
  const storage = createMemoryStorage();
  const adventure = new Adventure(freshState(), storage);
  const profileMgr = new ExplorerProfileManager(storage);

  profileMgr.saveProfile({
    nickname: 'Chiến Binh',
    className: '3B',
    passcode: 'MTH-333'
  });

  const statuses: SyncStatus[] = [];

  const syncManager = new SyncManager(adventure, profileMgr, {
    debounceMs: 10,
    saveFn: async () => {
      return { success: true, message: 'OK' };
    }
  });

  syncManager.onStatusChange((status) => {
    statuses.push(status);
  });

  await syncManager.flushNow();

  assert.ok(statuses.includes('syncing'));
  assert.ok(statuses.includes('synced'));
  assert.equal(syncManager.getStatus(), 'synced');
  assert.ok(syncManager.getLastSyncedAt());

  syncManager.dispose();
});

test('SyncManager pullAndMerge merges remote state with local state via mergeStates', async () => {
  const storage = createMemoryStorage();
  const adventure = new Adventure({
    ...freshState(),
    xp: 200,
    coins: 30,
    bridge: 2,
    flowers: [true, false, false, false, false, false, false, false, false, false]
  }, storage);

  const profileMgr = new ExplorerProfileManager(storage);
  profileMgr.saveProfile({
    nickname: 'Bé Hổ',
    className: '3C',
    passcode: 'MTH-777'
  });

  const remoteSaveState: SaveState = {
    ...freshState(),
    xp: 500, // Remote cao hơn
    coins: 10,
    bridge: 5, // Remote cầu dài hơn
    flowers: [false, true, false, false, false, false, false, false, false, false] // Hoa thứ 2
  };

  const syncManager = new SyncManager(adventure, profileMgr, {
    loadFn: async (id) => {
      assert.equal(id, 'MTH-777');
      return {
        success: true,
        player: {
          explorerId: 'exp_remote_777',
          passcode: 'MTH-777',
          nickname: 'Bé Hổ',
          className: '3C',
          avatar: 'boy',
          level: 3,
          totalXP: 500,
          totalCoins: 10,
          bridgeParts: 5,
          flowersBloomed: 1,
          monolithsActivated: 0,
          treesAwakened: 0,
          saveData: remoteSaveState
        }
      };
    }
  });

  const success = await syncManager.pullAndMerge();
  assert.equal(success, true);

  // Tiến trình Adventure phải là hợp nhất cực đại
  const currentState = adventure.getState();
  assert.equal(currentState.xp, 500);
  assert.equal(currentState.coins, 30); // Giữ coins cao hơn của local
  assert.equal(currentState.bridge, 5); // Giữ bridge cao hơn của remote
  assert.equal(currentState.flowers[0], true); // Hoa 1 của local
  assert.equal(currentState.flowers[1], true); // Hoa 2 của remote

  syncManager.dispose();
});
