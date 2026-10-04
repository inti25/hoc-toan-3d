import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateExplorerPasscode,
  generateExplorerId,
  normalizePasscode,
  PASSCODE_ALPHABET,
  ExplorerProfileManager
} from '../src/core/profile';
import { sanitizeSaveState, freshState } from '../src/core/state';
import { Adventure } from '../src/core/adventure';
import { SAVE_KEY } from '../src/data/config';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  };
}

test('generateExplorerPasscode produces friendly MTH-XXX format without ambiguous chars', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateExplorerPasscode();
    assert.match(code, /^MTH-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/);
    // Không bao giờ chứa 0, O, 1, I, l
    assert.equal(code.includes('0'), false);
    assert.equal(code.includes('O'), false);
    assert.equal(code.includes('1'), false);
    assert.equal(code.includes('I'), false);
  }
});

test('generateExplorerId generates unique non-empty IDs', () => {
  const id1 = generateExplorerId();
  const id2 = generateExplorerId();
  assert.ok(id1.startsWith('exp_'));
  assert.ok(id2.startsWith('exp_'));
  assert.notEqual(id1, id2);
});

test('normalizePasscode standardizes user input forgivingly', () => {
  // Chuẩn hóa viết thường sang viết hoa
  assert.equal(normalizePasscode('mth-882'), 'MTH-882');
  assert.equal(normalizePasscode('  mth-9kp  '), 'MTH-9KP');

  // Tự động thêm tiền tố MTH- nếu học sinh chỉ gõ 3 ký tự đuôi
  assert.equal(normalizePasscode('882'), 'MTH-882');
  assert.equal(normalizePasscode('9kp'), 'MTH-9KP');
  assert.equal(normalizePasscode('mth882'), 'MTH-882');

  // Giữ nguyên các mã tùy chỉnh khác
  assert.equal(normalizePasscode('ho-con-123'), 'HO-CON-123');
  assert.equal(normalizePasscode(''), '');
});

test('ExplorerProfileManager auto-assigns passcode and explorerId on first load', () => {
  const storage = createMemoryStorage();
  const manager = new ExplorerProfileManager(storage);

  const profile = manager.getProfile();
  assert.ok(profile.passcode);
  assert.ok(profile.passcode.startsWith('MTH-'));
  assert.ok(profile.explorerId);
  assert.ok(profile.explorerId.startsWith('exp_'));

  // Tải lại phải giữ nguyên passcode và explorerId ban đầu (không bị thay đổi)
  const reloaded = manager.getProfile();
  assert.equal(reloaded.passcode, profile.passcode);
  assert.equal(reloaded.explorerId, profile.explorerId);
});

test('ExplorerProfileManager preserves and updates passcode during profile save and restoration', () => {
  const storage = createMemoryStorage();
  const manager = new ExplorerProfileManager(storage);

  const initial = manager.getProfile();
  const originalCode = initial.passcode;

  // Cập nhật tên và lớp học không làm mất passcode
  const updated = manager.saveProfile({
    nickname: 'Bé Na',
    className: '3A'
  });
  assert.equal(updated.nickname, 'Bé Na');
  assert.equal(updated.passcode, originalCode);

  // Khôi phục tài khoản từ thiết bị khác với passcode mới
  const restored = manager.saveProfile({
    nickname: 'Hổ Con',
    className: '3B',
    avatar: 'girl',
    explorerId: 'exp_cloud_777',
    passcode: 'mth-777',
    isAnonymous: false
  });
  assert.equal(restored.nickname, 'Hổ Con');
  assert.equal(restored.explorerId, 'exp_cloud_777');
  assert.equal(restored.passcode, 'MTH-777');
  assert.equal(restored.avatar, 'girl');
});

test('Adventure.restoreState and sanitizeSaveState correctly reconstitute game world progress', () => {
  const storage = createMemoryStorage();
  const adventure = new Adventure(freshState(), storage);

  assert.equal(adventure.getState().xp, 0);
  assert.equal(adventure.getState().coins, 0);
  assert.equal(adventure.getState().bridge, 0);

  // Dữ liệu từ đám mây (có thể chứa trường thiếu hoặc dạng raw JSON)
  const cloudData = {
    version: 1,
    xp: 580,
    coins: 95,
    bridge: 6,
    avatar: 'elsa',
    flowers: [true, true, true, false, false, false, false, false, false, false],
    monoliths: [true, true, false, false],
    questComplete: true
  };

  const sanitized = sanitizeSaveState(cloudData);
  assert.equal(sanitized.xp, 580);
  assert.equal(sanitized.coins, 95);
  assert.equal(sanitized.bridge, 6);
  assert.equal(sanitized.avatar, 'elsa');
  assert.equal(sanitized.flowers.filter(Boolean).length, 3);
  assert.equal(sanitized.questComplete, true);

  // Phục hồi vào Adventure
  adventure.restoreState(sanitized);
  assert.equal(adventure.getState().xp, 580);
  assert.equal(adventure.getState().coins, 95);
  assert.equal(adventure.getState().bridge, 6);
  assert.equal(adventure.getState().avatar, 'elsa');

  // Kiểm tra lưu vào storage
  const savedRaw = storage.getItem(SAVE_KEY);
  assert.ok(savedRaw);
  assert.ok(savedRaw.includes('"xp":580'));
});


