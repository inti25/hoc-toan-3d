import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeArchipelagoOrbitalPosition, type RemoteZoneConfig } from '../src/data/remoteTypes';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { sanitizeRemoteZones } from '../src/core/sheetsClient';

test('computeArchipelagoOrbitalPosition distributes custom islands in orbital ring around Archimedes Hub', () => {
  const total = 5;
  const positions: Array<{ x: number; z: number }> = [];

  for (let i = 0; i < total; i++) {
    const pos = computeArchipelagoOrbitalPosition(i, total);
    positions.push(pos);

    // Distance from Kingdom Center (0, 0) should be in range [110, 175]
    const distFromCenter = Math.hypot(pos.x, pos.z);
    assert.ok(
      distFromCenter >= 105 && distFromCenter <= 180,
      `Island ${i} distance ${distFromCenter} should be between 105 and 180`
    );
  }

  // Ensure all 5 islands have distinct positions
  for (let i = 0; i < total; i++) {
    for (let j = i + 1; j < total; j++) {
      const dist = Math.hypot(positions[i].x - positions[j].x, positions[i].z - positions[j].z);
      assert.ok(dist > 30, `Islands ${i} and ${j} should be at least 30m apart, was ${dist}`);
    }
  }
});

test('sanitizeRemoteZones parses themes, densities, and applies orbital placement for zero coordinates', () => {
  const rawRows: Record<string, string | number>[] = [
    {
      ZoneId: '7',
      ZoneName: 'Đảo Nấm Lùn',
      Badge: '🍄 Dũng Sĩ Rừng Nấm',
      SheetName: 'DaoNam',
      ColorHex: '#10b981',
      CenterX: '0',
      CenterZ: '0',
      Width: '40',
      Depth: '40',
      Theme: 'FOREST',
      DecorDensity: 'HIGH'
    },
    {
      ZoneId: '8',
      ZoneName: 'Thành Phố Pha Lê',
      Badge: '💎 Học Giả Pha Lê',
      SheetName: 'ThanhPhoPhaLe',
      ColorHex: '#6366f1',
      // Missing CenterX/CenterZ, Theme, DecorDensity
      Width: '50',
      Depth: '50'
    }
  ];

  const zones = sanitizeRemoteZones(rawRows);
  assert.equal(zones.length, 2);

  // Zone 7
  assert.equal(zones[0].id, 7);
  assert.equal(zones[0].theme, 'FOREST');
  assert.equal(zones[0].decorDensity, 'HIGH');
  // Since CenterX/Z were 0, orbital position should be computed
  assert.notEqual(zones[0].center.x, 0);
  assert.notEqual(zones[0].center.z, 0);

  // Zone 8 (defaults)
  assert.equal(zones[1].id, 8);
  assert.equal(zones[1].theme, 'RUINS');
  assert.equal(zones[1].decorDensity, 'MEDIUM');
  assert.notEqual(zones[1].center.x, 0);
  assert.notEqual(zones[1].center.z, 0);
});

test('SpatialWorld collision physics prevents walking into dynamic obstacles on custom islands', () => {
  const spatial = new SpatialWorld();

  const customZone: RemoteZoneConfig = {
    id: 7,
    name: 'Đảo Kỳ Bí',
    title: 'Đảo Kỳ Bí',
    badge: '🏆 Kỳ Bí',
    sheetName: 'DaoKyBi',
    color: 0x38bdf8,
    colorHex: '#38bdf8',
    center: { x: 120, z: 120 },
    width: 40,
    depth: 40,
    theme: 'VILLAGE',
    decorDensity: 'MEDIUM'
  };

  // Register a solid house obstacle at (125, 125) with radius 2.2m
  const dynamicObstacles = [{ x: 125, z: 125, radius: 2.2 }];
  spatial.setDynamicData([customZone], [], [], dynamicObstacles);

  // Position player near the custom island
  spatial.teleport(120, 120);
  assert.equal(spatial.getCurrentLocationName(), 'Đảo Kỳ Bí');

  // Player should be able to walk in free ground
  assert.equal(spatial.canMove(121, 121), true);

  // Player should be BLOCKED when attempting to step into the house at (125, 125)
  // Distance from (125, 125) is 0 < 2.2 + 0.35 (Milo radius)
  assert.equal(spatial.canMove(125, 125), false);
  assert.equal(spatial.canMove(124.5, 124.5), false);

  // Player should be able to walk around the obstacle
  assert.equal(spatial.canMove(120, 125), true);
});

test('SpatialWorld recognizes custom dynamic portal transit between Gatehouse Hub and custom island', () => {
  const spatial = new SpatialWorld();

  const customPortals = [
    {
      id: 'hub_to_z7',
      name: 'Đến Đảo Kỳ Bí',
      source: { x: 68, z: 5 },
      target: { x: 105, z: 120 },
      triggerRadius: 1.5
    },
    {
      id: 'z7_to_hub',
      name: 'Về Đền Cổng Archimedes',
      source: { x: 103, z: 120 },
      target: { x: 65, z: 5 },
      triggerRadius: 1.5
    }
  ];

  spatial.setDynamicData([], [], customPortals, []);

  // Player walks into hub portal source
  spatial.teleport(68, 5);
  const transit = spatial.checkPortalTransit(0.016);
  assert.ok(transit !== null, 'Transit should trigger at portal source');
  assert.equal(transit?.name, 'Đến Đảo Kỳ Bí');

  // Player position is updated to island target
  assert.equal(spatial.x, 105);
  assert.equal(spatial.z, 120);
});
