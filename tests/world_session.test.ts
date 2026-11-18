import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Adventure } from '../src/core/adventure';
import { WorldSession, classifyZoneTemplate, zoneSpawnsMonoliths, zoneCountsForBadges } from '../src/boot/WorldSession';
import type { RemoteContentPayload, WorldHandle } from '../src/boot/types';
import type { RemoteZoneConfig } from '../src/data/remoteTypes';

function createFakeWorld(spatialRules?: {
  initiallyValid?: boolean;
  validAfterDynamicRender?: boolean;
}) {
  let dynamicRendered = false;
  let initialPos: { x: number; z: number } | null = null;
  let teleportedTo: { x: number; z: number } | null = null;
  let wiredBridge = -1;
  let wiredAvatar = '';
  let renderCalls = 0;

  const fakeWorld: WorldHandle = {
    active: false,
    paused: false,
    equippedTrail: '',
    keys: new Set(),
    joystick: { x: 0, y: 0 },
    player: { position: { x: -6, y: 0, z: 6 } },
    portalPos: { x: 32, y: 0, z: 0 },
    spatial: {
      resolveSafeSpawn(x, z) {
        if (x === -6 && z === 6) return { x, z };
        if (dynamicRendered && spatialRules?.validAfterDynamicRender !== false) {
          return { x, z };
        }
        if (!dynamicRendered && spatialRules?.initiallyValid) {
          return { x, z };
        }
        return null;
      },
      getCurrentLocationName: () => 'Làng Khởi Đầu',
      getNearPortal: () => null
    },
    assets: {
      prefetchForPortal: () => {}
    },
    flowers: [],
    parkTrees: [],
    setBridge(count) {
      wiredBridge = count;
    },
    setFlowersBloomed() {},
    setMonolithsActivated() {},
    setAvatar(id) {
      wiredAvatar = id;
    },
    syncAwakenedParkTrees() {},
    setFarmRescued() {},
    setEquippedTrail(t) {
      this.equippedTrail = t;
    },
    setInitialPosition(x, z) {
      initialPos = { x, z };
      this.player.position = { x, y: 0, z };
    },
    teleport(x, z) {
      teleportedTo = { x, z };
      this.player.position = { x, y: 0, z };
      this.onTeleport?.(x, z);
    },
    async renderDynamicZones() {
      renderCalls++;
      await new Promise((r) => setTimeout(r, 5));
      dynamicRendered = true;
    },
    burstPlayer() {},
    jump() {},
    clearInput() {},
    resetCamera() {},
    project: () => ({ x: 0, y: 0, visible: true }),
    bloomFlower() {},
    activateMonolith() {},
    wakeParkTree() {}
  };

  return {
    fakeWorld,
    getState: () => ({ initialPos, teleportedTo, wiredBridge, wiredAvatar, renderCalls })
  };
}

function sampleZones(): RemoteZoneConfig[] {
  return [
    {
      id: 6,
      name: 'Vườn Hoa Tri Thức',
      title: 'Vườn Hoa',
      description: '',
      template: 'FLOWER_BEDS',
      sheetName: 'VuonHoa',
      center: { x: 22, z: 0 },
      width: 24,
      depth: 40,
      color: 0xf43f5e,
      colorHex: '#f43f5e',
      badge: '🌸',
      active: true
    },
    {
      id: 7,
      name: 'Công Viên Xanh',
      title: 'Công Viên',
      description: '',
      template: 'PARK_SANCTUARY',
      sheetName: 'CongVienXanh',
      center: { x: -50, z: 0 },
      width: 30,
      depth: 30,
      color: 0x10b981,
      colorHex: '#10b981',
      badge: '🌳',
      active: true
    },
    {
      id: 8,
      name: 'Nông Trại Vui Vẻ',
      title: 'Nông Trại',
      description: '',
      template: 'FARM_SANCTUARY',
      sheetName: 'NongTrai',
      center: { x: -10, z: 60 },
      width: 32,
      depth: 32,
      color: 0x84cc16,
      colorHex: '#84cc16',
      badge: '🏡',
      active: true
    },
    {
      id: 10,
      name: 'Đảo Rừng Thử Thách',
      title: 'Rừng Phép Nhân',
      description: '',
      template: 'PROCEDURAL_SANCTUARY',
      sheetName: 'DaoRung',
      center: { x: 140, z: 20 },
      width: 36,
      depth: 36,
      color: 0x38bdf8,
      colorHex: '#38bdf8',
      badge: '🌲',
      active: true
    },
    {
      id: 11,
      name: 'Vùng Đang Ẩn',
      title: 'Ẩn',
      description: '',
      template: 'GRID_SANCTUARY',
      sheetName: 'VungAn',
      center: { x: 200, z: 20 },
      width: 24,
      depth: 24,
      color: 0x38bdf8,
      colorHex: '#38bdf8',
      badge: '🔒',
      active: false
    }
  ];
}

test('classifyZoneTemplate centralizes non-monolith exclusion and badge rules', () => {
  const zones = sampleZones();
  assert.equal(classifyZoneTemplate(zones[0]), 'flower');
  assert.equal(classifyZoneTemplate(zones[1]), 'park');
  assert.equal(classifyZoneTemplate(zones[2]), 'farm');
  assert.equal(classifyZoneTemplate(zones[3]), 'monolith');

  assert.equal(zoneSpawnsMonoliths(zones[0]), false);
  assert.equal(zoneSpawnsMonoliths(zones[1]), false);
  assert.equal(zoneSpawnsMonoliths(zones[2]), false);
  assert.equal(zoneSpawnsMonoliths(zones[3]), true);

  assert.equal(zoneCountsForBadges(zones[0]), false);
  assert.equal(zoneCountsForBadges(zones[3]), true);
});

test('WorldSession deduplicates concurrent bootSync calls and tracks preloadEngine state', async () => {
  const adventure = new Adventure();
  let loadCalls = 0;

  const payload: RemoteContentPayload = {
    zones: sampleZones(),
    questionsBySheet: {
      VuonHoa: [{ id: 1, title: 'F1', subtitle: '', position: null, steps: [{ stepId: '1_1', prompt: '1+1', options: [], answer: '2', hints: [], explanation: '' }] }],
      CongVienXanh: [{ id: 201, title: 'P1', subtitle: '', position: null, steps: [{ stepId: '201_1', prompt: '2+2', options: [], answer: '4', hints: [], explanation: '' }] }],
      NongTrai: [{ id: 501, title: 'FA1', subtitle: '', position: null, steps: [{ stepId: '501_1', prompt: '3+3', options: [], answer: '6', hints: [], explanation: '' }] }],
      DaoRung: [{ id: 601, title: 'M1', subtitle: '', position: null, steps: [{ stepId: '601_1', prompt: '4+4', options: [], answer: '8', hints: [], explanation: '' }] }],
      VungAn: [{ id: 701, title: 'Hidden', subtitle: '', position: null, steps: [{ stepId: '701_1', prompt: '5+5', options: [], answer: '10', hints: [], explanation: '' }] }]
    }
  };

  const session = new WorldSession({
    adventure,
    importWorldModule: async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { World: class {} as any };
    },
    loadZonesAndQuestions: async () => {
      loadCalls++;
      await new Promise((r) => setTimeout(r, 5));
      return payload;
    }
  });

  assert.equal(session.isLoaded, false);
  const pPreload = session.preloadEngine();
  assert.equal(session.isLoading, true);
  await pPreload;
  assert.equal(session.isLoaded, true);
  assert.equal(session.isLoading, false);

  // Calling bootSync twice (boot + start) must share a single loadZonesAndQuestions call
  const [snap1, snap2] = await Promise.all([session.bootSync(), session.bootSync()]);
  assert.equal(loadCalls, 1);
  assert.equal(snap1.zones.length, 4, 'Inactive zone 11 must be filtered out');
  assert.equal(snap2.monolithProblems.length, 1, 'Only DaoRung spawns monoliths');
  assert.equal(snap2.monolithProblems[0].id, 601);
  assert.equal(snap2.badgeZones.length, 3, 'VuonHoa is excluded from badgeZones');
});

test('WorldSession launch wires state and completes Deferred Spawn after dynamic zones render', async () => {
  const adventure = new Adventure();
  adventure.setAvatar('elsa');
  adventure.acceptQuest();
  adventure.recordQuizResult({ isCorrect: true, isBridgeMode: true }); // bridge = 1

  const { fakeWorld, getState } = createFakeWorld({
    initiallyValid: false,
    validAfterDynamicRender: true
  });

  const deferredNotifications: Array<{ x: number; z: number }> = [];
  const payload: RemoteContentPayload = {
    zones: sampleZones(),
    questionsBySheet: {
      DaoRung: [{ id: 601, title: 'M1', subtitle: '', position: null, steps: [{ stepId: '601_1', prompt: '4+4', options: [], answer: '8', hints: [], explanation: '' }] }]
    }
  };

  const session = new WorldSession({
    adventure,
    importWorldModule: async () => ({
      World: function () {
        return fakeWorld;
      } as any
    }),
    loadZonesAndQuestions: async () => payload,
    onDeferredSpawn: (pos) => deferredNotifications.push(pos)
  });

  const mockCanvas = {} as HTMLCanvasElement;
  const world = await session.launch({
    canvas: mockCanvas,
    initialPosition: { x: 140, z: 20 }
  });

  assert.equal(world, fakeWorld);
  assert.equal(getState().wiredBridge, 1);
  assert.equal(getState().wiredAvatar, 'elsa');
  assert.equal(session.hasPendingDeferredSpawn, true, 'Remote island coordinates should wait for dynamic zones');

  // Now remote content finishes syncing -> awaits renderDynamicZones -> resolves Deferred Spawn
  await session.bootSync();

  assert.equal(session.hasPendingDeferredSpawn, false);
  assert.deepEqual(getState().teleportedTo, { x: 140, z: 20 });
  assert.deepEqual(deferredNotifications, [{ x: 140, z: 20 }]);
  assert.equal(getState().renderCalls, 1);
});

test('WorldSession refreshFromRemote performs manual hot sync and updates world', async () => {
  const adventure = new Adventure();
  const { fakeWorld, getState } = createFakeWorld({ initiallyValid: true });

  const session = new WorldSession({
    adventure,
    importWorldModule: async () => ({
      World: function () {
        return fakeWorld;
      } as any
    }),
    getAppsScriptUrl: () => 'https://example.test/exec',
    fetchRemoteData: async () => ({
      zones: sampleZones(),
      questionsBySheet: {
        DaoRung: [{ id: 601, title: 'Fresh M1', subtitle: '', position: null, steps: [{ stepId: '601_1', prompt: '1+1', options: [], answer: '2', hints: [], explanation: '' }] }]
      }
    })
  });

  await session.launch({ canvas: {} as HTMLCanvasElement });
  const snap = await session.refreshFromRemote();

  assert.ok(snap);
  assert.equal(snap.monolithProblems[0].title, 'Fresh M1');
  assert.equal(getState().renderCalls, 1);
});
