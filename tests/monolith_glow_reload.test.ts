import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GeometryBuilder } from '../src/world/geom';
import { ArchimedesZoneBuilder, type Obstacle } from '../src/world/ArchimedesZoneBuilder';
import { Adventure } from '../src/core/adventure';
import { freshState, parseSave } from '../src/core/state';

test('Monoliths retain glowing activation state after page reload with saved progress', () => {
  // 1. Player starts adventure and solves Monolith 306
  const state = freshState();
  const adventure = new Adventure(state);

  // Activate monolith 306 (index 0)
  adventure.activateMonolith(0, 306, 1);
  assert.equal(adventure.isProblemSolved(306), true, 'Problem 306 should be solved');
  assert.equal(adventure.getState().monoliths[0], true, 'State monoliths[0] should be true');

  // Simulate save to storage (JSON serialization)
  const savedJson = JSON.stringify(adventure.getState());

  // 2. SIMULATE PAGE RELOAD:
  const reloadedState = parseSave(savedJson);
  const reloadedAdventure = new Adventure(reloadedState);
  assert.equal(reloadedAdventure.isProblemSolved(306), true, 'Reloaded adventure has problem 306 solved');

  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const zoneBuilder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  // Dynamic content loads and creates entities
  const monolithItem306 = zoneBuilder.createMonolithEntity(306, 100, -60, 0x38bdf8, 'Bia Đá 306');
  const monolithItem307 = zoneBuilder.createMonolithEntity(307, 105, -60, 0x38bdf8, 'Bia Đá 307');

  // Sync activation state using reloaded adventure
  zoneBuilder.setMonolithsActivated((id, index) => {
    return reloadedAdventure.isProblemSolved(id) ||
      (typeof id === 'number' && id >= 306 && reloadedAdventure.getState().monoliths[id - 306] === true) ||
      reloadedAdventure.getState().monoliths[index] === true;
  });

  assert.equal(monolithItem306.activated, true, 'Monolith 306 must be glowing');
  assert.equal(monolithItem306.beam?.visible, true, 'Celestial beam 306 must be visible');
  const mat306 = monolithItem306.crystal.material as THREE.MeshStandardMaterial;
  assert.equal(mat306.emissiveIntensity, 0.8, 'Crystal 306 emissive intensity must be 0.8');

  // Unsolved monolith 307 remains unlit
  assert.equal(monolithItem307.activated, false, 'Monolith 307 must be unlit');
  assert.equal(monolithItem307.beam?.visible, false, 'Beam 307 must be hidden');
  const mat307 = monolithItem307.crystal.material as THREE.MeshStandardMaterial;
  assert.equal(mat307.emissiveIntensity, 0, 'Crystal 307 emissive intensity must be 0');
});

test('ArchimedesZoneBuilder.activateMonolith works with both ID (e.g. 306) and array index (e.g. 0)', () => {
  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const zoneBuilder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  const m306 = zoneBuilder.createMonolithEntity(306, 100, -60, 0x38bdf8, 'Bia Đá 306');
  const m307 = zoneBuilder.createMonolithEntity(307, 105, -60, 0x38bdf8, 'Bia Đá 307');

  // Activate by ID 307
  zoneBuilder.activateMonolith(307);
  assert.equal(m307.activated, true, 'Activating by ID 307 should light up m307');
  assert.equal(m307.beam?.visible, true);

  // Activate by index 0 (which is m306)
  zoneBuilder.activateMonolith(0);
  assert.equal(m306.activated, true, 'Activating by index 0 should light up m306');
  assert.equal(m306.beam?.visible, true);
});

test('ArchimedesZoneBuilder.setMonolithsActivated supports SaveState object directly', () => {
  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const zoneBuilder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  const m306 = zoneBuilder.createMonolithEntity(306, 100, -60, 0x38bdf8, 'Bia Đá 306');
  const m307 = zoneBuilder.createMonolithEntity(307, 105, -60, 0x38bdf8, 'Bia Đá 307');

  const state = freshState();
  state.solvedProblems['306'] = true;

  zoneBuilder.setMonolithsActivated(state);
  assert.equal(m306.activated, true);
  assert.equal(m307.activated, false);
});
