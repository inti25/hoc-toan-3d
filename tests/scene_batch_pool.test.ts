import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SceneBatchPool } from '../src/world/SceneBatchPool';

test('SceneBatchPool caches materials by (color, roughness, metalness) and reuses primitive geometries', () => {
  const pool = new SceneBatchPool();
  const group = new THREE.Group();

  const matA = pool.material(0xff0000, 0.9, 0);
  const matB = pool.material(0xff0000, 0.9, 0);
  const matC = pool.material(0xff0000, 0.2, 0.8);

  assert.equal(matA, matB, 'Identical material parameters must return cached instance');
  assert.notEqual(matA, matC, 'Different roughness/metalness with same color must not collide');

  const b1 = pool.box(group, 0, 0, 0, 2, 1, 3, 0xff0000);
  const b2 = pool.box(group, 5, 0, 5, 2, 1, 3, 0x00ff00);
  assert.equal(b1.geometry, b2.geometry, 'Identical box dimensions must share BufferGeometry');

  const s1 = pool.sphere(group, 0, 1, 0, 0.5, 0xff0000);
  const s2 = pool.sphere(group, 1, 1, 0, 0.5, 0x00ff00);
  assert.equal(s1.geometry, s2.geometry, 'Identical sphere radii must share BufferGeometry');

  const c1 = pool.cylinder(group, 0, 0, 0, 1, 1, 2, 0xff0000, 12);
  const c2 = pool.cylinder(group, 2, 0, 0, 1, 1, 2, 0x00ff00, 12);
  assert.equal(c1.geometry, c2.geometry, 'Identical cylinder dimensions must share BufferGeometry');

  pool.dispose();
});

test('SceneBatchPool batchStaticTemplates collapses multi-mesh templates into InstancedMesh preserving offsets', () => {
  const pool = new SceneBatchPool();
  const parent = new THREE.Group();

  const template = new THREE.Group();
  template.name = 'SampleBush';
  const partA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  partA.position.set(0, 0.5, 0);
  const partB = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), new THREE.MeshBasicMaterial());
  partB.position.set(0, 1.2, 0);
  template.add(partA, partB);

  const batches = pool.batchStaticTemplates(
    parent,
    [
      { template, position: { x: 10, y: 0, z: -5 }, rotationY: 0, scale: 1 },
      { template, position: { x: -4, y: 0, z: 8 }, rotationY: Math.PI / 2, scale: 2 }
    ],
    { namePrefix: 'test_flora' }
  );

  assert.equal(batches.length, 2, 'Two sub-meshes in template should yield 2 InstancedMesh objects');
  assert.equal(batches[0].count, 2);
  assert.equal(batches[1].count, 2);
  assert.equal(parent.children.length, 2);

  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  batches[1].getMatrixAt(1, m);
  p.setFromMatrixPosition(m);
  // Instance 1 is at (-4, 0, 8) with scale 2 and local partB y=1.2 => y=2.4
  assert.ok(Math.abs(p.x - -4) < 1e-4);
  assert.ok(Math.abs(p.y - 2.4) < 1e-4);
  assert.ok(Math.abs(p.z - 8) < 1e-4);

  pool.dispose();
});

test('SceneBatchPool ring-buffered InstancedMesh effects emit, advance, expire, and dispose cleanly', () => {
  const pool = new SceneBatchPool();
  const scene = new THREE.Scene();
  pool.attachEffects(scene);

  const initialChildren = scene.children.length;
  assert.equal(initialChildren, 5, 'Should attach 1 spark pool + 4 trail pools');

  pool.emitBurst(1, 2, 3);
  pool.emitTrail(0, 0, 0, 'trail_flower');
  pool.emitTrail(0, 0, 0, 'trail_stardust');
  pool.emitTrail(0, 0, 0, 'trail_frost');
  pool.emitTrail(0, 0, 0, 'trail_rainbow');

  // Emitting particles must NOT add extra meshes to scene
  assert.equal(scene.children.length, initialChildren);
  const counts = pool.getActiveEffectCount();
  assert.equal(counts.sparks, 20);
  assert.equal(counts.trails, 5); // 1 flower + 2 stardust + 1 frost + 1 rainbow

  // Advance simulation past max lifetime -> slots expire cleanly
  for (let step = 0; step < 30; step++) {
    pool.updateEffects(0.05);
  }
  const afterExpiry = pool.getActiveEffectCount();
  assert.equal(afterExpiry.sparks, 0);
  assert.equal(afterExpiry.trails, 0);

  pool.dispose();
  assert.equal(scene.children.length, 0);
});
