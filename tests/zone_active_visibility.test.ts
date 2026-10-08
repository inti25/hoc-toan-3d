import test from 'node:test';
import assert from 'node:assert/strict';
import { isZoneVisible, sanitizeRemoteZones } from '../src/core/sheetsClient';
import { SpatialWorld } from '../src/world/SpatialWorld';
import type { RemoteZoneConfig } from '../src/data/remoteTypes';

test('isZoneVisible filters out inactive zones with varied Vietnamese and English values', () => {
  const activeZone = { active: true };
  const inactiveZoneBool = { active: false };
  const inactiveZoneStr = sanitizeRemoteZones([
    { ZoneId: '1', Name: 'Zone 1', Active: 'FALSE' },
    { ZoneId: '2', Name: 'Zone 2', Active: 'false' },
    { ZoneId: '3', Name: 'Zone 3', Active: '0' },
    { ZoneId: '4', Name: 'Zone 4', Active: 'KHONG' },
    { ZoneId: '5', Name: 'Zone 5', Active: 'KHÔNG' },
    { ZoneId: '6', Name: 'Zone 6', Active: 'ẨN' },
    { ZoneId: '7', Name: 'Zone 7', Active: 'an' },
    { ZoneId: '8', Name: 'Zone 8', Active: 'TẮT' },
    { ZoneId: '9', Name: 'Zone 9', Active: 'OFF' },
    { ZoneId: '10', Name: 'Zone 10', Active: 'DISABLE' }
  ]);

  assert.equal(isZoneVisible(activeZone), true);
  assert.equal(isZoneVisible(inactiveZoneBool), false);
  for (const z of inactiveZoneStr) {
    assert.equal(isZoneVisible(z), false, `Zone ${z.id} with active=${z.active} should not be visible`);
  }
});

test('SpatialWorld respects dynamic visibility of zones 1 to 5 when set to active=false', () => {
  const spatial = new SpatialWorld();

  // Initially before filtering, or with only active zones (e.g. Zone 1 is inactive)
  const visibleZones: RemoteZoneConfig[] = [
    {
      id: 6,
      name: 'Vườn Hoa Tri Thức',
      title: 'Vườn Hoa',
      description: 'Hoa',
      template: 'FLOWER_BEDS',
      sheetName: 'VuonHoa',
      center: { x: 22, z: 0 },
      width: 26,
      depth: 20,
      color: 0xec4899,
      colorHex: '#ec4899',
      badge: '🌸 Vườn Hoa',
      active: true,
      startAt: ''
    }
    // Note: Zones 1, 2, 3, 4, 5 are NOT in visibleZones (they were set to Active: FALSE)
  ];

  spatial.setDynamicData(visibleZones);

  // Check portal to Zone 1: should NOT be active when Zone 1 is inactive!
  spatial.teleport(68, -8);
  const transitZ1 = spatial.checkPortalTransit(0.016);
  assert.equal(
    transitZ1?.id === 'hub_to_z1',
    false,
    'hub_to_z1 portal should NOT be active when Zone 1 is inactive'
  );

  // Zone 1 coordinates (110, -60) should NOT be within land when Zone 1 is inactive
  assert.equal(
    spatial.isWithinLand(110, -60),
    false,
    'Zone 1 (110, -60) should NOT be considered walkable land when Zone 1 is inactive'
  );

  // resolveSafeSpawn should NOT spawn on inactive zone 1
  assert.equal(
    spatial.resolveSafeSpawn(110, -60),
    null,
    'resolveSafeSpawn should return null for coordinates on inactive zone 1'
  );

  // getCurrentLocationName should NOT return Zone 1 name
  spatial.teleport(110, -60);
  assert.notEqual(
    spatial.getCurrentLocationName(),
    'Thung Lũng Tính Toán',
    'Inactive Zone 1 should not show its sanctuary name'
  );
});

test('SpatialWorld removes park and farm portals and boundaries when zones are inactive', () => {
  const spatial = new SpatialWorld();

  // Suppose previously Park (Zone 7) was active
  spatial.setParkZones([
    { id: 7, name: 'Công Viên Xanh', cx: -45, cz: 0, radius: 18.2 }
  ]);
  assert.equal(spatial.isWithinLand(-45, 0), true);

  // Now Park becomes inactive: visibleZones has no PARK_SANCTUARY
  spatial.setParkZones([]);
  assert.equal(
    spatial.isWithinLand(-45, 0),
    false,
    'Park sanctuary should not be within land when parkZones is empty'
  );
});

test('SpatialWorld dynamically re-enables zone 1 when it becomes active again', () => {
  const spatial = new SpatialWorld();

  // First Zone 1 is inactive
  spatial.setDynamicData([]);
  assert.equal(spatial.isWithinLand(110, -60), false);

  // Then Zone 1 becomes active in Sheets
  spatial.setDynamicData([
    {
      id: 1,
      name: 'Thung Lũng Tính Toán',
      center: { x: 110, z: -60 },
      width: 24,
      depth: 32,
      active: true
    } as any
  ]);

  assert.equal(spatial.isWithinLand(110, -60), true, 'Zone 1 should become walkable when active again');
  spatial.teleport(68, -8);
  const transitZ1 = spatial.checkPortalTransit(0.016);
  assert.equal(transitZ1?.id, 'hub_to_z1', 'hub_to_z1 portal should activate when zone 1 is active');
});
