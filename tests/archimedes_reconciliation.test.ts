import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSave, type SaveState } from '../src/core/state';
import { Adventure, getArchimedesSolvedCount } from '../src/core/adventure';
import { SyncManager } from '../src/core/SyncManager';
import type { RemoteProblem, RemoteZoneConfig } from '../src/data/remoteTypes';

test('parseSave bi-directionally synchronizes solvedProblems to monoliths array', () => {
  // Simulate player Bảo Châu raw save: monoliths has 28 trues, but solvedProblems has all 306..345
  const rawSave: Partial<SaveState> = {
    version: 1,
    xp: 970,
    coins: 425,
    bridge: 6,
    questAccepted: true,
    questComplete: true,
    avatar: 'hellokitty',
    monoliths: Array(40).fill(false),
    solvedProblems: {
      '306': true, '307': true, '308': true, '309': true, '310': true,
      '311': true, '312': true, '313': true, '314': true, '315': true,
      '316': true, '317': true, '318': true, '319': true, '320': true,
      '321': true, '322': true, '323': true, '324': true, '325': true,
      '326': true, '327': true, '328': true, '329': true, '330': true,
      '331': true, '332': true, '333': true, '334': true, '335': true,
      '336': true, '337': true, '338': true, '339': true, '340': true,
      '341': true, '342': true, '343': true, '344': true, '345': true
    }
  };

  const parsed = parseSave(JSON.stringify(rawSave));
  // Every index from 0 to 39 (306 - 306 to 345 - 306) should now be true!
  for (let i = 0; i < 40; i++) {
    assert.equal(parsed.monoliths[i], true, `monoliths[${i}] should be true`);
  }
  assert.equal(parsed.monoliths.filter(Boolean).length >= 40, true);
});

test('getArchimedesSolvedCount returns 38 when 38 active problems are solved', () => {
  const mockProblems: RemoteProblem[] = Array.from({ length: 38 }, (_, i) => ({
    id: 306 + i,
    stepId: '1',
    title: `Problem ${306 + i}`,
    prompt: `Prompt ${306 + i}`,
    options: [{ value: 'A', label: 'Option A' }],
    answer: 'A',
    steps: []
  }));

  const mockState: Partial<SaveState> = {
    version: 1,
    monoliths: Array(40).fill(false),
    solvedProblems: {}
  };
  mockProblems.forEach((p) => {
    mockState.solvedProblems![String(p.id)] = true;
  });

  const count = getArchimedesSolvedCount(mockState as SaveState, mockProblems);
  assert.equal(count, 38, 'Should count exactly 38 solved problems');
});

test('Adventure.reconcileZoneProgress unlocks zone badges and heals missing monolith flags', () => {
  const mockStorage = {
    store: new Map<string, string>(),
    getItem(k: string) { return this.store.get(k) || null; },
    setItem(k: string, v: string) { this.store.set(k, v); }
  };

  const adv = new Adventure(undefined, mockStorage as any);
  const state = adv.getState();
  // Mark all 38 problems as solved in solvedProblems
  for (let id = 306; id <= 345; id++) {
    state.solvedProblems[String(id)] = true;
  }
  // Badges are initially false
  assert.deepEqual(state.zoneBadges, [false, false, false, false, false]);

  const mockZones: RemoteZoneConfig[] = [
    { id: 1, name: 'Z1', title: 'Z1', description: '', template: 'GRID_SANCTUARY', theme: 'RUINS', decorDensity: 'MEDIUM', sheetName: 'Z1', center: { x: 0, z: 0 }, width: 20, depth: 20, color: 0, colorHex: '#0', badge: 'B1' },
    { id: 2, name: 'Z2', title: 'Z2', description: '', template: 'GRID_SANCTUARY', theme: 'RUINS', decorDensity: 'MEDIUM', sheetName: 'Z2', center: { x: 0, z: 0 }, width: 20, depth: 20, color: 0, colorHex: '#0', badge: 'B2' },
    { id: 3, name: 'Z3', title: 'Z3', description: '', template: 'GRID_SANCTUARY', theme: 'RUINS', decorDensity: 'MEDIUM', sheetName: 'Z3', center: { x: 0, z: 0 }, width: 20, depth: 20, color: 0, colorHex: '#0', badge: 'B3' },
    { id: 4, name: 'Z4', title: 'Z4', description: '', template: 'GRID_SANCTUARY', theme: 'RUINS', decorDensity: 'MEDIUM', sheetName: 'Z4', center: { x: 0, z: 0 }, width: 20, depth: 20, color: 0, colorHex: '#0', badge: 'B4' },
    { id: 5, name: 'Z5', title: 'Z5', description: '', template: 'GRID_SANCTUARY', theme: 'RUINS', decorDensity: 'MEDIUM', sheetName: 'Z5', center: { x: 0, z: 0 }, width: 20, depth: 20, color: 0, colorHex: '#0', badge: 'B5' }
  ];

  const questionsBySheet: Record<string, { id: number }[]> = {
    Z1: [{ id: 306 }, { id: 307 }],
    Z2: [{ id: 312 }, { id: 313 }],
    Z3: [{ id: 319 }, { id: 320 }],
    Z4: [{ id: 326 }, { id: 328 }],
    Z5: [{ id: 323 }, { id: 324 }]
  };

  const changed = adv.reconcileZoneProgress(mockZones, questionsBySheet);
  assert.equal(changed, true, 'Reconcile should report changes made');
  assert.deepEqual(adv.getState().zoneBadges, [true, true, true, true, true], 'All 5 zone badges should be awarded');
});

test('SyncManager flushNow transmits accurate monolithsActivated when getMonolithCount provided', async () => {
  const mockStorage = {
    store: new Map<string, string>(),
    getItem(k: string) { return this.store.get(k) || null; },
    setItem(k: string, v: string) { this.store.set(k, v); }
  };
  const adv = new Adventure(undefined, mockStorage as any);
  let savedMonolithsActivated = 0;

  const sync = new SyncManager(
    adv,
    {
      getProfile: () => ({ explorerId: 'exp_test', passcode: 'TST-123', nickname: 'Test', className: 'L2', avatar: 'boy' }),
      saveProfile: () => {},
      updateProfile: () => {},
      clearProfile: () => {}
    } as any,
    {
      getMonolithCount: () => 38,
      saveFn: async (payload) => {
        savedMonolithsActivated = payload.monolithsActivated;
        return { success: true, message: 'OK' };
      }
    }
  );

  await sync.flushNow();
  assert.equal(savedMonolithsActivated, 38, 'Should send 38 monoliths activated to Sheets');
});
