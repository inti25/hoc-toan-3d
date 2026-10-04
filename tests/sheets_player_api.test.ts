import test from 'node:test';
import assert from 'node:assert/strict';
import {
  savePlayerProgressToSheets,
  loadPlayerProgressFromSheets,
  type SavePlayerProgressPayload,
  type RemotePlayerProgress
} from '../src/core/sheetsClient';

test('savePlayerProgressToSheets requires either explorerId or passcode', async () => {
  const result = await savePlayerProgressToSheets({
    explorerId: '',
    passcode: '',
    nickname: 'Bé Na',
    className: '3A',
    avatar: 'girl',
    level: 2,
    totalXP: 150,
    totalCoins: 20,
    bridgeParts: 3,
    flowersBloomed: 2,
    monolithsActivated: 1,
    treesAwakened: 0,
    saveData: { coins: 20 }
  });

  assert.equal(result.success, false);
  assert.match(result.message, /Cần explorerId hoặc passcode/i);
});

test('savePlayerProgressToSheets sends valid POST request and returns success response', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedOptions: any = null;

  try {
    globalThis.fetch = (async (url: string, options: any) => {
      interceptedUrl = url;
      interceptedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          message: 'Đã lưu tiến trình học sinh thành công',
          passcode: 'RONG-VANG-789',
          lastActiveAt: '03/10/2026, 21:50:00'
        })
      } as any;
    }) as any;

    const payload: SavePlayerProgressPayload = {
      explorerId: 'exp_abc123',
      passcode: 'RONG-VANG-789',
      nickname: 'Bé Na',
      className: '3A',
      avatar: 'girl',
      level: 3,
      totalXP: 450,
      totalCoins: 80,
      bridgeParts: 6,
      flowersBloomed: 5,
      monolithsActivated: 4,
      treesAwakened: 2,
      saveData: { completedProblems: ['1_1', '1_2'], coins: 80 }
    };

    const res = await savePlayerProgressToSheets(payload, 'https://script.google.com/test');
    assert.equal(res.success, true);
    assert.equal(res.passcode, 'RONG-VANG-789');
    assert.ok(res.lastActiveAt);

    // Kiểm tra cấu trúc request gửi đi
    assert.equal(interceptedUrl, 'https://script.google.com/test');
    assert.equal(interceptedOptions.method, 'POST');
    assert.equal(interceptedOptions.headers['Content-Type'], 'text/plain');

    const parsedBody = JSON.parse(interceptedOptions.body);
    assert.equal(parsedBody.action, 'savePlayerProgress');
    assert.equal(parsedBody.explorerId, 'exp_abc123');
    assert.equal(parsedBody.passcode, 'RONG-VANG-789');
    assert.equal(parsedBody.nickname, 'Bé Na');
    assert.equal(parsedBody.level, 3);
    assert.deepEqual(parsedBody.saveData, { completedProblems: ['1_1', '1_2'], coins: 80 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('savePlayerProgressToSheets handles network errors gracefully without throwing', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      throw new Error('Network timeout / Mất kết nối internet');
    }) as any;

    const payload: SavePlayerProgressPayload = {
      explorerId: 'exp_abc123',
      passcode: 'RONG-VANG-789',
      nickname: 'Bé Na',
      className: '3A',
      avatar: 'girl',
      level: 1,
      totalXP: 0,
      totalCoins: 0,
      bridgeParts: 0,
      flowersBloomed: 0,
      monolithsActivated: 0,
      treesAwakened: 0,
      saveData: {}
    };

    const res = await savePlayerProgressToSheets(payload, 'https://script.google.com/test');
    assert.equal(res.success, false);
    assert.match(res.message, /Mất kết nối|Network timeout/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loadPlayerProgressFromSheets validates identifier and loads player profile', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';

  try {
    // 1. Kiểm tra validation rỗng
    const emptyRes = await loadPlayerProgressFromSheets('', 'https://script.google.com/test');
    assert.equal(emptyRes.success, false);
    assert.match(emptyRes.message || '', /Mã Thám Hiểm hoặc ExplorerId không hợp lệ/i);

    // 2. Mock thành công
    globalThis.fetch = (async (url: string) => {
      interceptedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          player: {
            explorerId: 'exp_999',
            passcode: 'HO-CON-123',
            nickname: 'Hổ Con',
            className: '3B',
            avatar: 'boy',
            level: 4,
            totalXP: 600,
            totalCoins: 120,
            bridgeParts: 6,
            flowersBloomed: 8,
            monolithsActivated: 5,
            treesAwakened: 3,
            lastActiveAt: '03/10/2026, 21:55:00',
            saveData: { coins: 120, level: 4 }
          }
        })
      } as any;
    }) as any;

    const res = await loadPlayerProgressFromSheets('ho-con-123', 'https://script.google.com/test');
    assert.equal(res.success, true);
    assert.ok(res.player);
    assert.equal(res.player.passcode, 'HO-CON-123');
    assert.equal(res.player.nickname, 'Hổ Con');
    assert.equal(res.player.level, 4);
    assert.deepEqual(res.player.saveData, { coins: 120, level: 4 });

    // Kiểm tra query parameter
    assert.ok(interceptedUrl.includes('action=loadPlayerProgress'));
    assert.ok(interceptedUrl.includes('identifier=HO-CON-123'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loadPlayerProgressFromSheets handles not_found and network error responses', async () => {
  const originalFetch = globalThis.fetch;

  try {
    // 1. Not found
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'not_found',
        message: 'Không tìm thấy Mã Thám Hiểm: KHONG-CO'
      })
    })) as any;

    const notFoundRes = await loadPlayerProgressFromSheets('KHONG-CO', 'https://script.google.com/test');
    assert.equal(notFoundRes.success, false);
    assert.match(notFoundRes.message || '', /Không tìm thấy/i);

    // 2. HTTP 500 error
    globalThis.fetch = (async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })) as any;

    const errorRes = await loadPlayerProgressFromSheets('HO-CON-123', 'https://script.google.com/test');
    assert.equal(errorRes.success, false);
    assert.match(errorRes.message || '', /Lỗi kết nối máy chủ/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
