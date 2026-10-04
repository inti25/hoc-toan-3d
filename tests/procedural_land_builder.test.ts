import test from 'node:test';
import assert from 'node:assert/strict';
import { ProceduralLandBuilder } from '../src/world/procedural/ProceduralLandBuilder';
import { AssetRepository } from '../src/world/assets/AssetRepository';
import { prefabCatalog } from '../src/world/assets/PrefabCatalog';
import type { RemoteZoneConfig } from '../src/data/remoteTypes';

test('ProceduralLandBuilder builds island with base geometry and portal anchors', async () => {
  const catalogData = await import('../public/data/meshCatalog.json', { with: { type: 'json' } });
  prefabCatalog.setCatalog(catalogData.default as any);

  const builder = new ProceduralLandBuilder();
  const repo = new AssetRepository();

  const mockZone: RemoteZoneConfig = {
    id: 101,
    name: 'Rừng Phép Thuật',
    title: 'Thử Thách Phép Nhân',
    description: 'Vùng đất rừng rậm sinh động tự động',
    template: 'PROCEDURAL_SANCTUARY',
    theme: 'FOREST',
    decorDensity: 'MEDIUM',
    sheetName: 'RungPhepThuat',
    center: { x: 250, z: -50 },
    width: 36,
    depth: 36,
    color: 0x10b981,
    colorHex: '#10b981',
    badge: '🌲 Huy Hiệu Kiểm Lâm'
  };

  const res = await builder.buildLand(mockZone, repo);

  // 1. Group structure
  assert.ok(res.group);
  assert.equal(res.group.name, 'ProceduralLand_Zone_101');
  assert.equal(res.group.position.x, 250);
  assert.equal(res.group.position.z, -50);

  // 2. Portal anchors on the west perimeter
  assert.ok(res.portalAnchors.returnPortal.x < 250);
  assert.equal(res.portalAnchors.returnPortal.z, -50);
  assert.ok(Math.abs(res.portalAnchors.arrival.x - (res.portalAnchors.returnPortal.x + 2.6)) < 1e-4);
  assert.equal(res.portalAnchors.arrival.z, -50);

  // 3. Monoliths
  assert.equal(res.monolithPositions.length, 8);

  // 4. Keep-out zones check: no obstacle should collide with return portal (dist >= 3.0m)
  for (const obs of res.obstacles) {
    const distToPortal = Math.hypot(
      obs.x - res.portalAnchors.returnPortal.x,
      obs.z - res.portalAnchors.returnPortal.z
    );
    assert.ok(distToPortal >= 3.0, `Obstacle at (${obs.x}, ${obs.z}) too close to return portal (${distToPortal}m)`);
  }
});

test('ProceduralLandBuilder respects decorDensity and themes deterministically', async () => {
  const catalogData = await import('../public/data/meshCatalog.json', { with: { type: 'json' } });
  prefabCatalog.setCatalog(catalogData.default as any);

  const builder = new ProceduralLandBuilder();
  const repo = new AssetRepository();

  const baseZone: RemoteZoneConfig = {
    id: 102,
    name: 'Vườn Hoa Mộng Mơ',
    title: 'Vườn Hoa',
    description: '',
    template: 'PROCEDURAL_SANCTUARY',
    theme: 'GARDEN',
    decorDensity: 'LOW',
    sheetName: 'VuonHoa',
    center: { x: 300, z: 100 },
    width: 30,
    depth: 30,
    color: 0xf43f5e,
    colorHex: '#f43f5e',
    badge: '🌸'
  };

  // Run with LOW density
  const lowRes = await builder.buildLand(baseZone, repo);

  // Run with HIGH density
  const highZone = { ...baseZone, id: 103, decorDensity: 'HIGH' as const };
  const highRes = await builder.buildLand(highZone, repo);

  assert.ok(highRes.group.children.length > lowRes.group.children.length);

  // Determinism check: running same zone id twice produces identical obstacle count and coords
  const rerunRes = await builder.buildLand(baseZone, repo);
  assert.equal(lowRes.obstacles.length, rerunRes.obstacles.length);
  for (let i = 0; i < lowRes.obstacles.length; i++) {
    assert.equal(lowRes.obstacles[i].x, rerunRes.obstacles[i].x);
    assert.equal(lowRes.obstacles[i].z, rerunRes.obstacles[i].z);
    assert.equal(lowRes.obstacles[i].radius, rerunRes.obstacles[i].radius);
  }
});
