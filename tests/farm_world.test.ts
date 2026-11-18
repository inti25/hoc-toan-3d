import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';
import {
  FARM_ANIMAL_ANCHORS_LOCAL,
  FARM_FENCE_MATERIALS,
  FARM_GROUND_MATERIALS,
  FARM_PEN_CENTER_LOCAL,
  FARM_PEN_ENTRY_LOCAL,
  FARM_RAW_OFFSET,
  FARM_RECOMMENDED_CENTER,
  FARM_REGION_RADIUS,
  FARM_RETURN_PORTAL_LOCAL,
  FARM_SCALE,
  FARM_SHELTER_CENTERS,
  FARM_SOLID_OBSTACLE_MATERIALS,
  FARM_SPAWN_LOCAL,
  FARM_SPEED,
  computeFarmAnchors,
  farmZoneSpawn
} from '../src/data/farmMap';
import { buildFarmTerrainFromMeshTriangles } from '../src/world/farm/FarmTerrain';
import { SpatialWorld } from '../src/world/SpatialWorld';

const FARM_GLTF_PATH = new URL('../public/3dmodel/maps/farm/scene.gltf', import.meta.url);
const FARM_BIN_PATH = new URL('../public/3dmodel/maps/farm/scene.bin', import.meta.url);

function loadRealFarmTerrain(center: { x: number; z: number } = FARM_RECOMMENDED_CENTER) {
  const gltf = JSON.parse(readFileSync(FARM_GLTF_PATH, 'utf8'));
  const bin = readFileSync(FARM_BIN_PATH);

  const readVec3 = (accIdx: number): Float32Array => {
    const acc = gltf.accessors[accIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const stride = bv.byteStride ?? 12;
    const out = new Float32Array(acc.count * 3);
    for (let i = 0; i < acc.count; i++) {
      const o = base + i * stride;
      out[i * 3] = bin.readFloatLE(o);
      out[i * 3 + 1] = bin.readFloatLE(o + 4);
      out[i * 3 + 2] = bin.readFloatLE(o + 8);
    }
    return out;
  };

  const readIdx = (accIdx: number): Uint32Array => {
    const acc = gltf.accessors[accIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const out = new Uint32Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
      out[i] = acc.componentType === 5123 ? bin.readUInt16LE(base + i * 2) : bin.readUInt32LE(base + i * 4);
    }
    return out;
  };

  const nodeMat = (n: any): Matrix4 => {
    const m = new Matrix4();
    if (n.matrix) return m.fromArray(n.matrix);
    return m.compose(
      new Vector3(...(n.translation ?? [0, 0, 0])),
      new Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
      new Vector3(...(n.scale ?? [1, 1, 1]))
    );
  };

  const groundPos: number[] = [];
  const groundIdx: number[] = [];
  const solidTris: number[] = [];
  const fenceTris: number[] = [];
  const v = new Vector3();

  const toWorld = (pt: Vector3) => {
    pt.x = center.x + (pt.x - FARM_RAW_OFFSET.x) * FARM_SCALE;
    pt.y = pt.y * FARM_SCALE;
    pt.z = center.z + (pt.z - FARM_RAW_OFFSET.z) * FARM_SCALE;
  };

  const walk = (ni: number, parentM: Matrix4) => {
    const n = gltf.nodes[ni];
    const m = parentM.clone().multiply(nodeMat(n));
    if (n.mesh !== undefined) {
      const mesh = gltf.meshes[n.mesh];
      for (const p of mesh.primitives) {
        const matName: string = gltf.materials[p.material]?.name ?? '';
        const isGround = FARM_GROUND_MATERIALS.has(matName);
        const isSolid = FARM_SOLID_OBSTACLE_MATERIALS.has(matName);
        const isFence = FARM_FENCE_MATERIALS.has(matName);
        if (!isGround && !isSolid && !isFence) continue;

        const verts = readVec3(p.attributes.POSITION);
        const idxs = p.indices !== undefined ? readIdx(p.indices) : Uint32Array.from({ length: verts.length / 3 }, (_, i) => i);

        if (isGround) {
          const baseV = groundPos.length / 3;
          for (let i = 0; i < verts.length; i += 3) {
            v.set(verts[i], verts[i + 1], verts[i + 2]).applyMatrix4(m);
            toWorld(v);
            groundPos.push(v.x, v.y, v.z);
          }
          for (let k = 0; k < idxs.length; k++) {
            groundIdx.push(baseV + idxs[k]);
          }
        } else {
          const out = isFence ? fenceTris : solidTris;
          for (let k = 0; k + 2 < idxs.length; k += 3) {
            for (const idx of [idxs[k], idxs[k + 1], idxs[k + 2]]) {
              v.set(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]).applyMatrix4(m);
              toWorld(v);
              out.push(v.x, v.y, v.z);
            }
          }
        }
      }
    }
    for (const c of n.children ?? []) walk(c, m);
  };

  walk(0, new Matrix4());

  return buildFarmTerrainFromMeshTriangles({
    positions: Float32Array.from(groundPos),
    indices: Uint32Array.from(groundIdx),
    solidTriangles: Float32Array.from(solidTris),
    fenceTriangles: Float32Array.from(fenceTris)
  });
}

test('scene.gltf: ground surface, colliders, pen, spawn, portal, and all 18 animal anchors are valid and unobstructed', () => {
  const { surface, colliders } = loadRealFarmTerrain(FARM_RECOMMENDED_CENTER);
  assert.ok(surface.triCount > 9000, `Expected > 9000 ground triangles, got ${surface.triCount}`);
  assert.ok(colliders.solidCellCount > 500, `Expected > 500 solid cells, got ${colliders.solidCellCount}`);
  assert.ok(colliders.fenceCellCount > 500, `Expected > 500 fence cells, got ${colliders.fenceCellCount}`);

  const checkSpot = (label: string, lx: number, lz: number) => {
    const wx = FARM_RECOMMENDED_CENTER.x + lx;
    const wz = FARM_RECOMMENDED_CENTER.z + lz;
    const hit = surface.sampleNearest(wx, wz, 2.0);
    assert.ok(hit !== null, `${label} at (${lx}, ${lz}) must sit on walkable terrain`);
    assert.equal(colliders.isBlockedForAnimal(wx, wz), false, `${label} at (${lx}, ${lz}) must be clear of obstacles/fences`);
  };

  checkSpot('FARM_PEN_CENTER_LOCAL', FARM_PEN_CENTER_LOCAL.x, FARM_PEN_CENTER_LOCAL.z);
  checkSpot('FARM_PEN_ENTRY_LOCAL', FARM_PEN_ENTRY_LOCAL.x, FARM_PEN_ENTRY_LOCAL.z);
  checkSpot('FARM_SPAWN_LOCAL', FARM_SPAWN_LOCAL.x, FARM_SPAWN_LOCAL.z);
  checkSpot('FARM_RETURN_PORTAL_LOCAL', FARM_RETURN_PORTAL_LOCAL.x, FARM_RETURN_PORTAL_LOCAL.z);

  for (const [kind, pos] of Object.entries(FARM_SHELTER_CENTERS)) {
    checkSpot(`Shelter:${kind}`, pos.x, pos.z);
  }

  FARM_ANIMAL_ANCHORS_LOCAL.forEach((anchor, i) => {
    checkSpot(`AnimalAnchor#${i + 1}`, anchor.x, anchor.z);
  });
});

test('SpatialWorld conforms to 3D Farm terrain slopes at FARM_SPEED, blocks barns, and allows jumping over wooden fences', () => {
  const { surface, colliders } = loadRealFarmTerrain(FARM_RECOMMENDED_CENTER);
  const spatial = new SpatialWorld();
  const anchors = computeFarmAnchors(FARM_RECOMMENDED_CENTER);

  spatial.enableRegionScoping();
  spatial.setDynamicData([
    {
      id: 9,
      name: 'Nông Trại Vui Vẻ',
      template: 'FARM_SANCTUARY',
      center: FARM_RECOMMENDED_CENTER,
      width: 220,
      depth: 165
    }
  ]);
  spatial.setFarmZones([
    {
      id: 9,
      name: 'Nông Trại Vui Vẻ',
      cx: FARM_RECOMMENDED_CENTER.x,
      cz: FARM_RECOMMENDED_CENTER.z,
      radius: FARM_REGION_RADIUS,
      spawn: anchors.spawn
    }
  ]);
  spatial.setFarmTerrain(9, surface, colliders);
  spatial.setActiveRegion('zone:9');
  spatial.teleport(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y);

  // 1. Verify initial terrain Y matches surface near spawn
  const pose0 = spatial.getPose();
  assert.ok(Math.abs(pose0.y - FARM_SPAWN_LOCAL.y) < 0.25, `Expected spawn Y ~1.31, got ${pose0.y}`);

  // 2. Move west onto sloped meadow/road at FARM_SPEED (yaw = 0 -> W moves toward -Z, yaw = Math.PI/2 -> W moves toward -X)
  const keys = new Set<string>(['w']);
  const dt = 1 / 60;
  for (let i = 0; i < 30; i++) {
    const pose = spatial.tick(dt, { keys, joystick: { x: 0, y: 0 } }, Math.PI / 2);
    assert.ok(pose.moving);
    assert.ok(Math.abs(pose.speed - FARM_SPEED * dt) < 1e-6);
  }
  assert.ok(spatial.getPose().x < pose0.x - 2.5, 'Player should move west across open meadow at FARM_SPEED');

  // 3. Solid barn near East Meadow (local (91, -50)) must block even when airborne
  const barnX = FARM_RECOMMENDED_CENTER.x + 91;
  const barnZ = FARM_RECOMMENDED_CENTER.z - 50;
  assert.equal(colliders.hasSolidAt(barnX, barnZ), true, 'Expected red barn solid footprint at local (91, -50)');
  assert.equal(spatial.canMove(barnX, barnZ), false);

  // 4. Wooden fence line along local (30, -32..16): find a grounded point next to a fence cell
  // Verify fence blocks at ground level and allows crossing while airborne above clearance
  let fenceWx = 0;
  let fenceWz = 0;
  outer: for (let lx = -50; lx <= 50; lx += 0.5) {
    for (let lz = -50; lz <= 50; lz += 0.5) {
      const wx = FARM_RECOMMENDED_CENTER.x + lx;
      const wz = FARM_RECOMMENDED_CENTER.z + lz;
      if (colliders.hasFenceAt(wx, wz, 0) && !colliders.hasSolidAt(wx, wz, 0.5)) {
        const hit = surface.sampleNearest(wx, wz, 2.0);
        if (hit) {
          fenceWx = wx;
          fenceWz = wz;
          break outer;
        }
      }
    }
  }
  assert.ok(fenceWx !== 0, 'Must locate a wooden fence cell on walkable terrain');
  const fenceGroundY = surface.sampleNearest(fenceWx, fenceWz, 2.0)!.y;
  assert.equal(colliders.isBlockedForPlayer(fenceWx, fenceWz, fenceGroundY, fenceGroundY), true, 'Fence blocks at ground height');
  assert.equal(
    colliders.isBlockedForPlayer(fenceWx, fenceWz, fenceGroundY + 0.8, fenceGroundY),
    false,
    'Jumping over wooden fence clears collision'
  );
});

test('SpatialWorld isolates legacy (0, 80) FARM_SANCTUARY cleanly via activeRegionId without leaking into Starter Village or Garden', () => {
  const legacyCenter = { x: 0, z: 80 };
  const { surface, colliders } = loadRealFarmTerrain(legacyCenter);
  const spawn = farmZoneSpawn({ center: legacyCenter });

  const spatial = new SpatialWorld(-6, 6);
  spatial.enableRegionScoping();
  spatial.setDynamicData([
    {
      id: 8,
      name: 'Nông Trại Di Sản',
      template: 'FARM_SANCTUARY',
      center: legacyCenter,
      width: 32,
      depth: 32
    }
  ]);
  spatial.setFarmZones([
    {
      id: 8,
      name: 'Nông Trại Di Sản',
      cx: legacyCenter.x,
      cz: legacyCenter.z,
      radius: FARM_REGION_RADIUS,
      spawn
    }
  ]);
  spatial.setFarmTerrain(8, surface, colliders);

  // While in Core Starter Village, location stays Làng Khởi Đầu
  spatial.setActiveRegion('core');
  assert.equal(spatial.getCurrentLocationName(), 'Làng Khởi Đầu');
  assert.equal(spatial.resolveRegionForPoint(-6, 6), 'core');

  // Inside Farm zone:8, even at overlapping world coordinates (x=15, z=10), stays in Nông Trại Di Sản and not Garden
  spatial.setActiveRegion('zone:8');
  spatial.teleport(15, 10, 1.5);
  assert.equal(spatial.getCurrentLocationName(), 'Nông Trại Di Sản');
  assert.equal(spatial.isInGarden(), false);
});

test('vite.config.ts excludes **/3dmodel/** from Workbox precache', () => {
  const viteCfg = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.match(viteCfg, /globIgnores:\s*\[[^\]]*3dmodel/);
});
