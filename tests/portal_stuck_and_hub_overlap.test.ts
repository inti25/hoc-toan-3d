import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SpatialWorld,
  PORTAL_LINKS,
  type PortalLink
} from '../src/world/SpatialWorld';
import {
  allocateDynamicHubPortalSlot,
  computePortalPillarObstacles,
  isWithinPortalKeepOut,
  STATIC_HUB_PORTAL_POSITIONS
} from '../src/world/ArchimedesZoneBuilder';
import { computeLakeAnchors } from '../src/data/lakeLand';
import { ProceduralLandBuilder } from '../src/world/procedural/ProceduralLandBuilder';
import { AssetRepository } from '../src/world/assets/AssetRepository';
import {
  computeProceduralEntityPositions,
  computeZonePortalAnchors,
  sanitizeZoneEntityPosition,
  type RemoteZoneConfig
} from '../src/data/remoteTypes';

function simulateWalkToPortal(
  spatial: SpatialWorld,
  startX: number,
  startZ: number,
  targetPortal: PortalLink,
  maxSteps = 220
) {
  spatial.teleport(startX, startZ);
  let steps = 0;
  while (steps < maxSteps) {
    spatial.tick(0.05, {
      keys: new Set(),
      joystick: { x: 0, y: 0 },
      destination: { x: targetPortal.source.x, z: targetPortal.source.z }
    });
    const transit = spatial.checkPortalTransit(0.05, { deferTeleport: true });
    if (transit) {
      return { reached: true, transitId: transit.id, steps, pose: spatial.getPose() };
    }
    steps++;
  }
  const pose = spatial.getPose();
  return {
    reached: false,
    transitId: null,
    steps,
    pose,
    distRemaining: Math.hypot(pose.x - targetPortal.source.x, pose.z - targetPortal.source.z)
  };
}

test('Dynamic Hub portal slots never overlap static portals, each other, or the central monument', () => {
  const occupied: Array<{ x: number; z: number }> = [];
  const slots = [];

  for (let i = 0; i < 12; i++) {
    const slot = allocateDynamicHubPortalSlot(i, occupied);
    slots.push(slot);
    occupied.push({ x: slot.x, z: slot.z });

    // Must stay cleanly inside Hub walkable island [49..71, -11..11]
    assert.ok(slot.x >= 50.5 && slot.x <= 69.5, `Slot ${i} x=${slot.x} out of safe Hub bounds`);
    assert.ok(Math.abs(slot.z) <= 10.0, `Slot ${i} z=${slot.z} out of safe Hub bounds`);

    // Must keep >= 3.6m center separation from central compass monument (60, 0)
    const distToCenter = Math.hypot(slot.x - 60, slot.z);
    assert.ok(distToCenter >= 3.6, `Slot ${i} too close to compass monument (${distToCenter.toFixed(2)}m)`);

    // Must keep >= 3.6m separation from every static Hub portal
    for (const sp of STATIC_HUB_PORTAL_POSITIONS) {
      const distToStatic = Math.hypot(slot.x - sp.x, slot.z - sp.z);
      assert.ok(
        distToStatic >= 3.6,
        `Dynamic slot ${i} (${slot.x}, ${slot.z}) overlaps static portal ${sp.id} (${sp.x}, ${sp.z}) dist=${distToStatic.toFixed(2)}m`
      );
    }

    // Must keep >= 3.6m separation from every previously allocated dynamic slot
    for (let j = 0; j < i; j++) {
      const distToDyn = Math.hypot(slot.x - slots[j].x, slot.z - slots[j].z);
      assert.ok(
        distToDyn >= 3.6,
        `Dynamic slot ${i} overlaps dynamic slot ${j} dist=${distToDyn.toFixed(2)}m`
      );
    }

    // Return target lands safely in front of the arch toward center (outside 1.5m triggerRadius)
    const retDistToSource = Math.hypot(slot.returnTarget.x - slot.x, slot.returnTarget.z - slot.z);
    assert.ok(retDistToSource >= 2.2, `Return target too close to source portal (${retDistToSource.toFixed(2)}m)`);
  }
});

test('Walking from Hub center to every static and dynamic Hub portal succeeds without pillar jamming', () => {
  const spatial = new SpatialWorld(60, 0);
  const hubObstacles: Array<{ x: number; z: number; radius: number }> = [
    { x: 60, z: 0, radius: 1.5 }
  ];

  // Static Hub portals
  const staticHubMeta = [
    { id: 'hub_to_garden', x: 52, z: 0, rot: 0 },
    { id: 'hub_to_z1', x: 68, z: -8, rot: Math.PI / 4 },
    { id: 'hub_to_z2', x: 70, z: -4, rot: Math.PI / 6 },
    { id: 'hub_to_z3', x: 70, z: 0, rot: 0 },
    { id: 'hub_to_z4', x: 70, z: 4, rot: -Math.PI / 6 },
    { id: 'hub_to_z5', x: 68, z: 8, rot: -Math.PI / 4 }
  ];
  for (const sp of staticHubMeta) {
    hubObstacles.push(...computePortalPillarObstacles(sp.x, sp.z, sp.rot));
  }

  const staticZonesStub: RemoteZoneConfig[] = [1, 2, 3, 4, 5].map((id) => ({
    id,
    name: `Vùng ${id}`,
    title: `Vùng ${id}`,
    description: '',
    template: 'GRID_SANCTUARY',
    theme: 'RUINS',
    decorDensity: 'LOW',
    sheetName: `Z${id}`,
    center: { x: 110 + (id - 1) * 20, z: 0 },
    width: 24,
    depth: 24,
    color: 0x38bdf8,
    colorHex: '#38bdf8',
    badge: '🏆'
  }));
  const dynZones: RemoteZoneConfig[] = [...staticZonesStub];
  const customPortals: PortalLink[] = [];
  const occupied: Array<{ x: number; z: number }> = [];

  for (let idx = 0; idx < 8; idx++) {
    const id = 7 + idx;
    const slot = allocateDynamicHubPortalSlot(idx, occupied);
    occupied.push({ x: slot.x, z: slot.z });
    hubObstacles.push(...computePortalPillarObstacles(slot.x, slot.z, slot.rotationY));
    const cx = 130 + idx * 60;
    const cz = 120;
    const anchors = computeLakeAnchors({ x: cx, z: cz });
    dynZones.push({
      id,
      name: idx === 0 ? 'Vườn Tinh Thể Phép Nhân' : `Vùng Đất ${id}`,
      title: 'Thử thách',
      description: '',
      template: 'CIRCLE_SANCTUARY',
      theme: 'CRYSTAL',
      decorDensity: 'MEDIUM',
      sheetName: `Zone${id}`,
      center: { x: cx, z: cz },
      width: 22,
      depth: 24,
      color: 0xa855f7,
      colorHex: '#a855f7',
      badge: '💎'
    });
    customPortals.push(
      {
        id: `hub_to_z${id}`,
        name: `Đến Vùng ${id}`,
        source: { x: slot.x, z: slot.z },
        target: anchors.arrival,
        triggerRadius: 1.5,
        targetRegionId: `zone:${id}`
      },
      {
        id: `z${id}_to_hub`,
        name: 'Về Đền Cổng Archimedes',
        source: { x: anchors.returnPortal.x, z: anchors.returnPortal.z },
        target: slot.returnTarget,
        triggerRadius: 1.5,
        targetRegionId: 'hub'
      }
    );
  }

  spatial.setDynamicData(dynZones, [], customPortals, []);
  spatial.setRegionObstacles('hub', hubObstacles);
  spatial.setActiveRegion('hub');

  // Verify all static Hub portals (from near Hub center)
  for (const sp of staticHubMeta) {
    spatial.checkPortalTransit(3.0);
    const p = PORTAL_LINKS.find((l) => l.id === sp.id)!;
    const startX = sp.x < 60 ? 57.5 : 62.5;
    const startZ = sp.z === 0 ? 0 : Math.sign(sp.z) * 2;
    const res = simulateWalkToPortal(spatial, startX, startZ, p);
    assert.equal(res.reached, true, `Should reach ${sp.id}, got stuck at ${JSON.stringify(res)}`);
    assert.equal(res.transitId, sp.id);
  }

  // Verify all dynamic Hub portals (clear cooldown between walks)
  for (const dp of customPortals.filter((p) => p.id.startsWith('hub_to_z'))) {
    spatial.checkPortalTransit(3.0);
    const angle = Math.atan2(dp.source.z, dp.source.x - 60);
    const startX = 60 + Math.cos(angle) * 2.5;
    const startZ = Math.sin(angle) * 2.5;
    const res = simulateWalkToPortal(spatial, startX, startZ, dp);
    assert.equal(res.reached, true, `Should reach ${dp.id}, got stuck at ${JSON.stringify(res)}`);
    assert.equal(res.transitId, dp.id);
  }
});

test('Entering return portal inside Crystal Lake zone (CIRCLE_SANCTUARY) works from arrival, North, South, and East approaches', () => {
  const spatial = new SpatialWorld();
  const center = { x: 140, z: 120 };
  const anchors = computeLakeAnchors(center);

  const crystalZone: RemoteZoneConfig = {
    id: 7,
    name: 'Vườn Tinh Thể Phép Nhân',
    title: 'Vườn Tinh Thể Phép Nhân',
    description: '',
    template: 'CIRCLE_SANCTUARY',
    theme: 'CRYSTAL',
    decorDensity: 'MEDIUM',
    sheetName: 'VuonTinhThe',
    center,
    width: 22,
    depth: 24,
    color: 0xa855f7,
    colorHex: '#a855f7',
    badge: '💎'
  };

  const retPortal: PortalLink = {
    id: 'z7_to_hub',
    name: 'Về Đền Cổng Archimedes',
    source: { x: anchors.returnPortal.x, z: anchors.returnPortal.z },
    target: { x: 60, z: -6.7 },
    triggerRadius: 1.5,
    targetRegionId: 'hub'
  };

  spatial.setDynamicData([crystalZone], [], [retPortal], []);
  spatial.setRegionObstacles(
    'zone:7',
    computePortalPillarObstacles(anchors.returnPortal.x, anchors.returnPortal.z, anchors.returnPortal.rotationY)
  );
  spatial.setActiveRegion('zone:7');

  const approaches = [
    { name: 'arrival (SW shore)', x: anchors.arrival.x, z: anchors.arrival.z },
    { name: 'North shore', x: anchors.returnPortal.x, z: anchors.returnPortal.z - 3.5 },
    { name: 'South shore', x: anchors.returnPortal.x, z: anchors.returnPortal.z + 3.5 },
    { name: 'East (inside lake)', x: anchors.returnPortal.x + 3.5, z: anchors.returnPortal.z }
  ];

  for (const app of approaches) {
    spatial.checkPortalTransit(3.0);
    const res = simulateWalkToPortal(spatial, app.x, app.z, retPortal);
    assert.equal(res.reached, true, `Should enter returnPortal from ${app.name}, got stuck: ${JSON.stringify(res)}`);
    assert.equal(res.transitId, 'z7_to_hub');
  }
});

test('Custom FLOWER_BEDS zone (id > 6) resolves to zone:{id}, and portal keep-out clears CRYSTAL scenery', () => {
  const spatial = new SpatialWorld();
  const flowerZone: RemoteZoneConfig = {
    id: 8,
    name: 'Vườn Hoa Tinh Thể',
    title: 'Vườn Hoa',
    description: '',
    template: 'FLOWER_BEDS',
    theme: 'CRYSTAL',
    decorDensity: 'MEDIUM',
    sheetName: 'VuonHoa8',
    center: { x: 180, z: -120 },
    width: 24,
    depth: 32,
    color: 0xa855f7,
    colorHex: '#a855f7',
    badge: '💎'
  };

  spatial.setDynamicData([flowerZone], [], [], []);
  assert.equal(spatial.resolveRegionForPoint(180, -120), 'zone:8');
  assert.equal(spatial.isWithinLand(180 - 12 + 3, -120), true);

  // Portal keep-out rejects crystal placed right at returnPortal (cx - halfW + 3, cz)
  const portal = { x: 180 - 12 + 3, z: -120 };
  const arrival = { x: portal.x + 2.5, z: -120 };
  assert.equal(isWithinPortalKeepOut(180 - 12 + 3.2, -120, portal, arrival), true);
  assert.equal(isWithinPortalKeepOut(180 + 8.8, -120, portal, arrival), false);
});

test('ProceduralLandBuilder places prefab children relative to group.position matching world obstacles, and asymmetric bounds are walkable', async () => {
  const catalogData = await import('../public/data/meshCatalog.json', { with: { type: 'json' } });
  const builder = new ProceduralLandBuilder();
  const repo = new AssetRepository({ catalog: catalogData.default as any });

  const asymZone: RemoteZoneConfig = {
    id: 109,
    name: 'Vườn Tinh Thể Phép Nhân',
    title: 'Phép Nhân',
    description: '',
    template: 'PROCEDURAL_SANCTUARY',
    theme: 'CRYSTAL',
    decorDensity: 'HIGH',
    sheetName: 'TinhThe',
    center: { x: 260, z: -140 },
    width: 22,
    depth: 36,
    color: 0x38bdf8,
    colorHex: '#38bdf8',
    badge: '💎'
  };

  const built = await builder.buildLand(asymZone, repo);
  assert.equal(built.group.position.x, 260);
  assert.equal(built.group.position.z, -140);

  // Child prefab meshes must be in local space (near 0, not shifted by another +cx, +cz)
  const prefabChildren = built.group.children.slice(1); // skip terrain base group
  assert.ok(prefabChildren.length > 0, 'Expected procedural prefabs to spawn');
  for (const child of prefabChildren) {
    const localDist = Math.hypot(child.position.x, child.position.z);
    assert.ok(
      localDist <= 22,
      `Prefab child position (${child.position.x}, ${child.position.z}) looks double-offset (localDist=${localDist.toFixed(1)})`
    );
  }

  // Asymmetric width/depth: circular returnPortal must still be inside SpatialWorld.isWithinLand
  const spatial = new SpatialWorld();
  spatial.setDynamicData([asymZone], [], [], built.obstacles);
  assert.equal(
    spatial.isWithinLand(built.portalAnchors.returnPortal.x, built.portalAnchors.returnPortal.z),
    true,
    'PROCEDURAL_SANCTUARY returnPortal must lie inside circular isWithinLand'
  );
});

test('FLOWER_BEDS / Crystal zone sanitizes monolith positions away from returnPortal, arrival, and island bevel edges', () => {
  const zone: RemoteZoneConfig = {
    id: 9,
    name: 'Vườn Tinh thể Phép nhân',
    title: 'Vườn Tinh thể Phép nhân',
    description: '',
    template: 'FLOWER_BEDS',
    theme: 'CRYSTAL',
    decorDensity: 'MEDIUM',
    sheetName: 'VuonTinhThe',
    center: { x: 140, z: -120 },
    width: 22,
    depth: 18,
    color: 0x10b981,
    colorHex: '#10b981',
    badge: '🌸 Tinh Thế Vườn Hoa'
  };

  const anchors = computeZonePortalAnchors(zone);
  // 1. Procedural FLOWER_BEDS positions must stay inside border & clear of portal
  const generated = computeProceduralEntityPositions('FLOWER_BEDS', 10, zone.center, zone.width, zone.depth);
  for (const p of generated) {
    assert.ok(Math.abs(p.x - zone.center.x) <= zone.width / 2 - 2.0, `x=${p.x} too close to border`);
    assert.ok(Math.abs(p.z - zone.center.z) <= zone.depth / 2 - 2.0, `z=${p.z} too close to border`);
    assert.ok(
      Math.hypot(p.x - anchors.returnPortal.x, p.z - anchors.returnPortal.z) >= 3.4,
      `Generated monolith (${p.x}, ${p.z}) overlaps portal (${anchors.returnPortal.x}, ${anchors.returnPortal.z})`
    );
  }

  // 2. Even if Sheet supplies bad manual PosX/PosZ right on the portal or island rim, sanitizeZoneEntityPosition pushes it clear
  const badSheetPositions = [
    { x: anchors.returnPortal.x + 1.0, z: anchors.returnPortal.z - 1.2 }, // right next to portal pillar (screenshot trap!)
    { x: zone.center.x - zone.width / 2, z: zone.center.z - zone.depth / 2 }, // overhanging cliff corner
    { x: anchors.arrival.x, z: anchors.arrival.z } // right on arrival spot
  ];
  for (const bad of badSheetPositions) {
    const fixed = sanitizeZoneEntityPosition(zone, bad, generated[0]);
    assert.ok(
      Math.hypot(fixed.x - anchors.returnPortal.x, fixed.z - anchors.returnPortal.z) >= 3.4,
      `Sanitized monolith (${fixed.x}, ${fixed.z}) still too close to returnPortal`
    );
    assert.ok(
      Math.hypot(fixed.x - anchors.arrival.x, fixed.z - anchors.arrival.z) >= 2.5,
      `Sanitized monolith (${fixed.x}, ${fixed.z}) still too close to arrival`
    );
    assert.ok(
      Math.abs(fixed.x - zone.center.x) <= zone.width / 2 - 1.8 &&
        Math.abs(fixed.z - zone.center.z) <= zone.depth / 2 - 1.8,
      `Sanitized monolith (${fixed.x}, ${fixed.z}) still near island rim`
    );
  }
});

test('FLOWER_BEDS / Crystal returnPortal allows entering cleanly from behind, side pillar, arrival, and even when partially wedged', () => {
  const spatial = new SpatialWorld();
  const zone: RemoteZoneConfig = {
    id: 9,
    name: 'Vườn Tinh thể Phép nhân',
    title: 'Vườn Tinh thể Phép nhân',
    description: '',
    template: 'FLOWER_BEDS',
    theme: 'CRYSTAL',
    decorDensity: 'MEDIUM',
    sheetName: 'VuonTinhThe',
    center: { x: 140, z: -120 },
    width: 26,
    depth: 20,
    color: 0x10b981,
    colorHex: '#10b981',
    badge: '🌸 Tinh Thế Vườn Hoa'
  };

  const anchors = computeZonePortalAnchors(zone);
  const retPortal: PortalLink = {
    id: 'z9_to_hub',
    name: 'Về Đền Cổng Archimedes',
    source: { x: anchors.returnPortal.x, z: anchors.returnPortal.z },
    target: { x: 60, z: -6.7 },
    triggerRadius: 1.85,
    targetRegionId: 'hub'
  };

  spatial.setDynamicData([zone], [], [retPortal], []);
  spatial.setRegionObstacles(
    'zone:9',
    computePortalPillarObstacles(anchors.returnPortal.x, anchors.returnPortal.z, anchors.returnPortal.rotationY)
  );
  spatial.setActiveRegion('zone:9');

  const startSpots = [
    { name: 'arrival', x: anchors.arrival.x, z: anchors.arrival.z },
    { name: 'north-side near pillar', x: anchors.returnPortal.x + 0.4, z: anchors.returnPortal.z - 2.6 },
    { name: 'south-side near pillar', x: anchors.returnPortal.x + 0.4, z: anchors.returnPortal.z + 2.6 },
    { name: 'west back edge of portal', x: anchors.returnPortal.x - 1.5, z: anchors.returnPortal.z - 1.9 },
    { name: 'slightly overlapping pillar boundary', x: anchors.returnPortal.x + 0.1, z: anchors.returnPortal.z - 1.9 }
  ];

  for (const s of startSpots) {
    spatial.checkPortalTransit(3.0);
    const res = simulateWalkToPortal(spatial, s.x, s.z, retPortal);
    assert.equal(res.reached, true, `Should enter portal from ${s.name}, got stuck: ${JSON.stringify(res)}`);
    assert.equal(res.transitId, 'z9_to_hub');
  }
});
