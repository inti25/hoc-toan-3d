import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GeometryBuilder } from '../src/world/geom';
import { ArchimedesZoneBuilder, type Obstacle } from '../src/world/ArchimedesZoneBuilder';

test('ArchimedesZoneBuilder creates portal arches and registers spatial obstacles', () => {
  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const builder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  assert.equal(builder.portalGroups.length, 0);
  assert.equal(obstacles.length, 0);

  const portal = builder.createPortalArch(10, 20, 0x38bdf8, 0);
  assert.equal(builder.portalGroups.length, 1);
  assert.equal(portal.position.x, 10);
  assert.equal(portal.position.z, 20);
  // Each portal arch registers 2 pillar obstacles for player collision
  assert.equal(obstacles.length, 2);
  assert.ok(scene.children.includes(portal));
});

test('ArchimedesZoneBuilder createArchimedesPortals builds full set of realm portals', () => {
  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const builder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  builder.createArchimedesPortals();
  // 1 Garden->Hub + 1 Hub->Garden + 5 Hub->Zones + 5 Return portals = 12 portals
  assert.equal(builder.portalGroups.length, 12);
  assert.equal(obstacles.length, 24); // 2 pillars per portal
});

test('ArchimedesZoneBuilder creates monoliths, manages activation states and beams', () => {
  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const builder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  builder.createMonolithEntity(301, 10, 20, 0x38bdf8, 'Bia Đá 301');
  builder.createMonolithEntity(302, 15, 25, 0xf59e0b, 'Bia Đá 302');
  assert.equal(builder.monoliths.length, 2);

  // Initially unactivated
  const first = builder.monoliths[0];
  assert.equal(first.activated, false);
  assert.equal(first.beam?.visible, false);

  // Activate first monolith
  let burstPosition: THREE.Vector3 | null = null;
  builder.activateMonolith(0, (pos) => {
    burstPosition = pos;
  });

  assert.equal(first.activated, true);
  assert.equal(first.beam?.visible, true);
  assert.ok(burstPosition);
  assert.equal((burstPosition as THREE.Vector3).x, first.position.x);

  // Batch sync activation state
  builder.setMonolithsActivated([false, true]);
  assert.equal(builder.monoliths[0].activated, false);
  assert.equal(builder.monoliths[0].beam?.visible, false);
  assert.equal(builder.monoliths[1].activated, true);
  assert.equal(builder.monoliths[1].beam?.visible, true);
});

test('ArchimedesZoneBuilder animation loop advances crystal rotations and floating heights without errors', () => {
  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const builder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  builder.createArchimedesPortals();
  builder.createMonolithEntity(301, 10, 20, 0x38bdf8, 'Bia Đá 301');
  builder.activateMonolith(0);

  const initialRot = builder.monoliths[0].crystal.rotation.y;

  builder.updateAnimations(0.016, 1.0);

  assert.notEqual(builder.monoliths[0].crystal.rotation.y, initialRot);
});

test('ArchimedesZoneBuilder removes garden monoliths cleanly', () => {
  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const builder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  // Create monoliths with id 1..5 (garden) and 301..305
  builder.createMonolithEntity(1, 0, 0, 0xff0000);
  builder.createMonolithEntity(2, 5, 5, 0x00ff00);
  builder.createMonolithEntity(301, 10, 10, 0x0000ff);

  assert.equal(builder.monoliths.length, 3);
  builder.removeGardenMonoliths();
  assert.equal(builder.monoliths.length, 1);
  assert.equal(builder.monoliths[0].id, 301);
});
