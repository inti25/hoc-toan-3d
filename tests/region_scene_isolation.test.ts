import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { AssetRepository } from '../src/world/assets/AssetRepository';
import type { AssetTransportAdapter } from '../src/world/assets/types';
import { WorldSession } from '../src/boot/WorldSession';
import { Adventure } from '../src/core/adventure';
import type { RemoteContentPayload, WorldHandle } from '../src/boot/types';
import type { RemoteZoneConfig } from '../src/data/remoteTypes';

test('SpatialWorld.resolveRegionForPoint partitions core, hub, lakes, park, farm, and procedural zones', () => {
  const spatial = new SpatialWorld(-6, 6);
  spatial.setBridgeBuilt(6);

  const zones: RemoteZoneConfig[] = [
    {
      id: 1,
      name: 'Thung Lũng Tính Toán',
      title: 'Khu 1',
      description: '',
      template: 'GRID_SANCTUARY',
      sheetName: 'Zone_1_Archimedes',
      center: { x: 110, z: -60 },
      width: 24,
      depth: 32,
      color: 0x42a5f5,
      colorHex: '#42a5f5',
      badge: '🏆',
      active: true
    },
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
      color: 0xec4899,
      colorHex: '#ec4899',
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
      center: { x: -45, z: 0 },
      width: 36,
      depth: 36,
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
      title: 'Đảo Rừng',
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
    }
  ];

  spatial.setDynamicData(zones);
  spatial.setParkZones([{ id: 7, name: 'Công Viên Xanh', cx: -45, cz: 0, radius: 18.2 }]);

  assert.equal(spatial.resolveRegionForPoint(-6, 6), 'core');
  assert.equal(spatial.resolveRegionForPoint(7, 0), 'core');
  assert.equal(spatial.resolveRegionForPoint(22, 0), 'core', 'Flower Garden (id 6) stays inside core region');
  assert.equal(spatial.resolveRegionForPoint(60, 0), 'hub');
  assert.equal(spatial.resolveRegionForPoint(94.5, -62.6), 'zone:1');
  assert.equal(spatial.resolveRegionForPoint(-33.5, 0), 'zone:7');
  assert.equal(spatial.resolveRegionForPoint(-18, 70), 'zone:8');
  assert.equal(spatial.resolveRegionForPoint(140, 20), 'zone:10');
});

test('SpatialWorld.checkPortalTransit with deferTeleport keeps player in source region until loading completes and isolates region obstacles', () => {
  const spatial = new SpatialWorld(32, 0);
  spatial.enableRegionScoping();
  spatial.setActiveRegion('core');
  spatial.setRegionObstacles('zone:99', [{ x: 10, z: 0, radius: 2 }]);

  // Obstacle in zone:99 must NOT block movement while player is in 'core'
  assert.equal(spatial.canMove(10, 0), true);

  // Step into Garden -> Hub portal at (32, 0) with deferTeleport: true
  const transit = spatial.checkPortalTransit(1.5, { deferTeleport: true });
  assert.ok(transit);
  assert.equal(transit?.id, 'garden_to_hub');
  assert.deepEqual(transit?.target, { x: 55, z: 0 });
  // Player coordinates must remain at (32, 0) until async loading mounts Hub and calls teleport()
  assert.equal(spatial.getPose().x, 32);
  assert.equal(spatial.getPose().z, 0);
});

test('AssetRepository.prefetchForPortal targets exact destination assets and avoids false-positive park loads on return portals', () => {
  const requestedUrls: string[] = [];
  const transport: AssetTransportAdapter = {
    loadGLTF: async (url: string) => {
      requestedUrls.push(url);
      return new THREE.Group();
    }
  };
  const repo = new AssetRepository({ transport, baseUrl: '/' });

  // 1. Archimedes Hub -> Zone 1 lake portal must prefetch cozy_lake.glb
  repo.prefetchForPortal('hub_to_z1');
  assert.ok(requestedUrls.includes('/3dmodel/maps/cozy_lake.glb'));

  // 2. Return portal from farm to village must NOT preload park.glb
  requestedUrls.length = 0;
  repo.prefetchForPortal('z8_to_village_farm');
  repo.prefetchForPortal('z7_to_village');
  assert.equal(requestedUrls.includes('/3dmodel/maps/park.glb'), false);

  // 3. Farm entrance portal preloads both countryside scene.gltf and farm.glb (no old park prefabs)
  requestedUrls.length = 0;
  repo.prefetchForPortal('village_to_farm');
  assert.ok(requestedUrls.includes('/3dmodel/maps/farm/scene.gltf'));
  assert.ok(requestedUrls.includes('/3dmodel/maps/farm.glb'));
  assert.equal(requestedUrls.some((u) => u.includes('park_')), false);

  // 4. Park entrance portal preloads park.glb
  requestedUrls.length = 0;
  repo.prefetchForPortal('village_to_park');
  assert.ok(requestedUrls.includes('/3dmodel/maps/park.glb'));
});

test('WorldSession Deferred Spawn calls activateRegionAt before teleporting to remote island', async () => {
  const adventure = new Adventure();
  const callOrder: string[] = [];
  let dynamicRendered = false;

  const fakeWorld: WorldHandle = {
    active: false,
    paused: false,
    equippedTrail: '',
    keys: new Set(),
    joystick: { x: 0, y: 0 },
    player: { position: { x: -6, y: 0, z: 6 } },
    portalPos: { x: 32, y: 0, z: 0 },
    spatial: {
      resolveSafeSpawn: (x, z) => (dynamicRendered ? { x, z } : null),
      getCurrentLocationName: () => 'Làng Khởi Đầu',
      getNearPortal: () => null
    },
    assets: { prefetchForPortal: () => {} },
    flowers: [],
    parkTrees: [],
    setBridge() {},
    setFlowersBloomed() {},
    setMonolithsActivated() {},
    setAvatar() {},
    syncAwakenedParkTrees() {},
    setEquippedTrail() {},
    setInitialPosition(x, z) {
      this.player.position = { x, y: 0, z };
    },
    async activateRegionAt(x, z) {
      callOrder.push(`activate:${x},${z}`);
      return 'zone:10';
    },
    teleport(x, z) {
      callOrder.push(`teleport:${x},${z}`);
      this.player.position = { x, y: 0, z };
    },
    async renderDynamicZones() {
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

  const payload: RemoteContentPayload = {
    zones: [
      {
        id: 10,
        name: 'Đảo Rừng Thử Thách',
        title: 'Đảo Rừng',
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
      }
    ],
    questionsBySheet: {}
  };

  const session = new WorldSession({
    adventure,
    importWorldModule: async () => ({ World: function () { return fakeWorld; } as any }),
    loadZonesAndQuestions: async () => payload
  });

  await session.launch({ canvas: {} as HTMLCanvasElement, initialPosition: { x: 140, z: 20 } });
  await session.bootSync();

  assert.deepEqual(callOrder, ['activate:140,20', 'teleport:140,20']);
});
