import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REMOTE_CACHE_KEY,
  REMOTE_CACHE_TTL_MS,
  safeStorage,
  saveRemoteDataToCache,
  getCachedRemoteData,
  loadZonesAndQuestions,
  fetchRemoteData
} from '../src/core/sheetsClient';

test('REMOTE_CACHE_TTL_MS is 30 minutes', () => {
  assert.equal(REMOTE_CACHE_TTL_MS, 30 * 60 * 1000);
});

test('saveRemoteDataToCache stores wrapped payload with timestamp', () => {
  const dummyData = {
    zones: [
      {
        id: 1,
        name: 'Zone Test',
        title: 'Title',
        description: 'Desc',
        template: 'GRID_SANCTUARY' as const,
        sheetName: 'Zone_1',
        center: { x: 0, z: 0 },
        width: 20,
        depth: 20,
        color: 0x38bdf8,
        colorHex: '#38bdf8',
        badge: '🏅'
      }
    ],
    questionsBySheet: {
      Zone_1: []
    }
  };

  const before = Date.now();
  saveRemoteDataToCache(dummyData);
  const after = Date.now();

  const cached = getCachedRemoteData();
  assert.equal(cached.isExpired, false);
  assert.ok(cached.cachedAt >= before && cached.cachedAt <= after);
  assert.deepEqual(cached.data?.zones[0].name, 'Zone Test');
});

test('getCachedRemoteData marks cache as expired after 30 minutes', () => {
  const expiredPayload = {
    timestamp: Date.now() - (31 * 60 * 1000), // 31 phút trước
    data: {
      zones: [],
      questionsBySheet: {}
    }
  };
  safeStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(expiredPayload));

  const result = getCachedRemoteData();
  assert.equal(result.isExpired, true);
  assert.ok(result.data !== null);
});

test('getCachedRemoteData handles legacy cache without timestamp as expired for auto-upgrade', () => {
  const legacyPayload = {
    zones: [],
    questionsBySheet: {}
  };
  safeStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(legacyPayload));

  const result = getCachedRemoteData();
  assert.equal(result.isExpired, true);
  assert.ok(result.data !== null);
  assert.equal(result.cachedAt, 0);
});

test('loadZonesAndQuestions does NOT fetch when cache is fresh within 30 minutes', async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error('Should not be called when cache is fresh');
  }) as any;

  try {
    const freshPayload = {
      timestamp: Date.now() - (5 * 60 * 1000), // Mới 5 phút trước
      data: {
        zones: [
          {
            id: 99,
            name: 'Fresh Zone',
            title: 'T',
            description: 'D',
            template: 'GRID_SANCTUARY' as const,
            sheetName: 'Fresh_Sheet',
            center: { x: 0, z: 0 },
            width: 10,
            depth: 10,
            color: 0xffffff,
            colorHex: '#ffffff',
            badge: '🌟'
          }
        ],
        questionsBySheet: {}
      }
    };
    safeStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(freshPayload));

    const result = await loadZonesAndQuestions();
    assert.equal(fetchCalled, false, 'Network fetch should not be called within 30 minutes');
    assert.equal(result.zones[0].name, 'Fresh Zone');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchRemoteData deduplicates concurrent in-flight requests for the same scriptUrl', async () => {
  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    networkCalls++;
    await new Promise((r) => setTimeout(r, 15));
    return {
      ok: true,
      json: async () => ({
        status: 'success',
        zones: [{ ZoneId: '1', ZoneName: 'Z1', Template: 'GRID_SANCTUARY', SheetName: 'S1' }],
        questions: { S1: [] }
      })
    } as any;
  }) as any;

  try {
    const [r1, r2] = await Promise.all([
      fetchRemoteData('https://example.test/dedupe'),
      fetchRemoteData('https://example.test/dedupe')
    ]);
    assert.equal(networkCalls, 1, 'Concurrent fetchRemoteData calls must coalesce into 1 HTTP request');
    assert.equal(r1?.zones[0].name, 'Z1');
    assert.equal(r2?.zones[0].name, 'Z1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
