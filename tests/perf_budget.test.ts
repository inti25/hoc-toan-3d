import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { SceneBatchPool } from '../src/world/SceneBatchPool';
import { ArchimedesZoneBuilder } from '../src/world/ArchimedesZoneBuilder';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { HudPresenter } from '../src/world/loop/HudPresenter';
import { FarmAnimalEntity } from '../src/world/farm/FarmAnimalEntity';
import { FarmSanctuary } from '../src/world/farm/FarmSanctuary';
import { RoadSurface } from '../src/world/qhmj/RoadSurface';
import { FARM_ANIMAL_ANCHORS_LOCAL } from '../src/data/farmMap';

test('Performance Budget: FarmAnimalEntity shares hitbox and beacon GPU geometries and materials', () => {
  const sourceGlb = new THREE.Group();
  const cowMesh = new THREE.Group();
  cowMesh.name = 'cow';
  sourceGlb.add(cowMesh);

  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const root = new THREE.Group();

  for (let i = 0; i < 18; i++) {
    const animal = new FarmAnimalEntity(`farm_cow_${i}`, i, 'cow', sourceGlb);
    root.add(animal.root);
  }

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      geos.add(mesh.geometry);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => mats.add(m));
      } else {
        mats.add(mesh.material);
      }
    }
  });

  // 18 animals * 3 helper meshes (hitbox + orb + ring) must share <= 3 geometries & 3 materials
  assert.ok(geos.size <= 3, `Expected <= 3 shared geometries across 18 animals, got ${geos.size}`);
  assert.ok(mats.size <= 3, `Expected <= 3 shared materials across 18 animals, got ${mats.size}`);
});

test('Performance Budget: Headless CPU frame loop (SpatialWorld + Archimedes + FX + HUD) p95 < 2.0ms', () => {
  const scene = new THREE.Scene();
  const pool = new SceneBatchPool();
  pool.attachEffects(scene);

  const spatial = new SpatialWorld(-6, 6);
  spatial.enableRegionScoping();
  spatial.setActiveRegion('core');

  const arch = new ArchimedesZoneBuilder(scene, pool, []);
  const core = new THREE.Group();
  const hub = new THREE.Group();
  const zones = new Map<number, THREE.Group>();
  scene.add(core);
  arch.createArchimedesPortals({
    coreParent: core,
    hubParent: hub,
    getZoneParent: (id) => {
      let g = zones.get(id);
      if (!g) {
        g = new THREE.Group();
        zones.set(id, g);
      }
      return g;
    }
  });
  arch.createArchimedesMonoliths();

  const els = new Map<string, any>();
  const hud = new HudPresenter((id) => {
    let el = els.get(id);
    if (!el) {
      el = {
        textContent: '',
        innerHTML: '',
        hidden: false,
        style: { transform: '' },
        classList: { toggle() {} }
      };
      els.set(id, el);
    }
    return el;
  });

  const keys = new Set<string>(['w']);
  const joystick = { x: 0, y: 0 };

  // Warmup
  for (let i = 0; i < 60; i++) {
    spatial.tick(1 / 60, { keys, joystick }, 0.57);
    arch.updateAnimations(1 / 60, i / 60);
    pool.updateEffects(1 / 60);
  }

  const samples: number[] = [];
  for (let i = 0; i < 600; i++) {
    const t0 = performance.now();
    const pose = spatial.tick(1 / 60, { keys, joystick }, 0.57);
    arch.updateAnimations(1 / 60, i / 60);
    pool.updateEffects(1 / 60);
    if (i % 3 === 0) {
      hud.renderSnapshot(
        {
          active: true,
          paused: false,
          fps: 60,
          playerPosition: { x: pose.x, y: pose.y, z: pose.z },
          activeRegionId: 'core',
          cameraYaw: 0.57,
          locationName: spatial.getCurrentLocationName(),
          inGarden: spatial.isInGarden(),
          inArchimedes: spatial.isInArchimedesRealm(),
          nearMilo: spatial.isNearMilo(),
          crossedRiver: spatial.hasCrossedRiver(),
          nearFlowerIndex: spatial.nearFlowerIndex(),
          nearMonolithIndex: spatial.nearMonolithIndex(),
          nearParkTreeIndex: spatial.nearParkTreeIndex(),
          nearShop: spatial.isNearShop(),
          nearFarmAnimalId: null,
          nearQhmjNodeIndex: -1,
          nearPortal: spatial.getNearPortal(),
          hudPoses: {
            miloPose: { x: 200 + (i % 5), y: 200, visible: true },
            bridgePose: { x: 400, y: 300, visible: true },
            portalPose: { x: 600, y: 320, visible: true }
          }
        },
        { subLabel: 'KHÁM PHÁ', arrowHtml: '->' }
      );
    }
    samples.push(performance.now() - t0);
  }

  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0;
  assert.ok(p95 < 2.0, `Expected headless frame p95 < 2.0ms, got ${p95.toFixed(4)}ms`);
});

test('Performance Budget: FarmSanctuary 18-animal simulation p95 < 2.0ms', () => {
  const pos: number[] = [];
  const idx: number[] = [];
  const N = 20;
  for (let z = 0; z <= N; z++) {
    for (let x = 0; x <= N; x++) {
      pos.push(x * 10 - 100, Math.sin(x * 0.3) * 0.5, z * 10 - 100);
    }
  }
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const a = z * (N + 1) + x;
      const b = a + 1;
      const c = a + (N + 1);
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const surface = new RoadSurface(new Float32Array(pos), new Uint32Array(idx));

  const sourceGlb = new THREE.Group();
  const cowMesh = new THREE.Group();
  cowMesh.name = 'cow';
  sourceGlb.add(cowMesh);

  const sanctuary = new FarmSanctuary();
  sanctuary.terrainSurface = surface;
  for (let i = 0; i < 18; i++) {
    const anchor = FARM_ANIMAL_ANCHORS_LOCAL[i % FARM_ANIMAL_ANCHORS_LOCAL.length];
    const entity = new FarmAnimalEntity(`farm_cow_${i}`, i, 'cow', sourceGlb);
    entity.root.position.set(anchor.x, 0, anchor.z);
    entity.roamAnchor = entity.root.position.clone();
    entity.state = i % 3 === 0 ? 'RESTING' : 'ROAMING';
    sanctuary.animals.push(entity);
  }

  const playerPos = new THREE.Vector3(60, 1.3, -36);
  for (let i = 0; i < 60; i++) sanctuary.update(1 / 60, playerPos);

  const samples: number[] = [];
  for (let i = 0; i < 600; i++) {
    const t0 = performance.now();
    sanctuary.update(1 / 60, playerPos);
    samples.push(performance.now() - t0);
  }

  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0;
  assert.ok(p95 < 2.0, `Expected FarmSanctuary 18-animal p95 < 2.0ms, got ${p95.toFixed(4)}ms`);
});

test('Performance Budget: World.ts batches static foliage/clouds/ripples and caps pixelRatio & shadow map', () => {
  const worldSource = fs.readFileSync(path.resolve('src/world/World.ts'), 'utf-8');
  assert.match(worldSource, /village_tree/);
  assert.match(worldSource, /river_ripples_batch/);
  assert.match(worldSource, /village_clouds_batch/);
  assert.match(worldSource, /hub_cloud_sea_batch/);
  assert.match(worldSource, /lastPrefetchedPortalKey/);
  assert.match(worldSource, /isCompactGpu\s*\?\s*1024\s*:\s*1536/);
});
