import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { BRIDGE_PARTS } from '../src/data/config';

test('SpatialWorld prevents player from walking into river when bridge is unbuilt', () => {
  const world = new SpatialWorld(3.5, 0); // Just west of the river
  assert.equal(world.canMove(5.0, 0), false); // Cannot enter river
  assert.equal(world.canMove(3.2, 0), true); // Can move backwards
});

test('SpatialWorld allows player to cross bridge when 6 parts are built', () => {
  const world = new SpatialWorld(3.5, 0);
  assert.equal(world.canMove(5.0, 0), false);

  world.setBridgeBuilt(BRIDGE_PARTS);
  assert.equal(world.canMove(5.0, 0), true); // Can cross on bridge center
  assert.equal(world.canMove(5.0, 3.0), false); // Cannot walk on water outside bridge bounds
});

test('SpatialWorld detects proximity to Milo and Flowers accurately', () => {
  const world = new SpatialWorld(-6, 6);
  assert.equal(world.isNearMilo(), false);
  assert.equal(world.nearFlowerIndex(), -1);

  // Teleport near Milo (-3, 1.5)
  world.teleport(-3.2, 1.6);
  assert.equal(world.isNearMilo(), true);

  // Teleport near Flower 0 (14, -6.0)
  world.teleport(14.2, -5.9);
  assert.equal(world.nearFlowerIndex(), 0);
  assert.equal(world.isNearMilo(), false);
  assert.equal(world.isInGarden(), true);
});

test('SpatialWorld handles movement and jump physics headlessly', () => {
  const world = new SpatialWorld(-6, 6);
  assert.equal(world.getPose().y, 0);

  // Jump
  const jumped = world.jump();
  assert.equal(jumped, true);

  // Tick physics forward
  world.tick(0.1, { keys: new Set(), joystick: { x: 0, y: 0 } });
  assert(world.getPose().y > 0);

  // Tick forward until landed
  for (let i = 0; i < 20; i++) {
    world.tick(0.05, { keys: new Set(), joystick: { x: 0, y: 0 } });
  }
  assert.equal(world.getPose().y, 0);
});

test('SpatialWorld obstacle collision prevents moving through houses and objects', () => {
  const world = new SpatialWorld(-10, -6);
  // House at (-12, -6) has radius ~2.9
  assert.equal(world.canMove(-12, -6), false);
});

test('SpatialWorld responds accurately to mobile and tablet wheel joystick input', () => {
  const world = new SpatialWorld(-6, 6);
  const initialZ = world.getPose().z;

  // Move forward with wheel joystick (y = -1) with zero camera yaw
  const poseForward = world.tick(0.2, { keys: new Set(), joystick: { x: 0, y: -1 } }, 0);
  assert.equal(poseForward.moving, true, 'Player moves with joystick active');
  assert.ok(poseForward.z < initialZ, 'Player moves forward along -z');

  // Move right with wheel joystick (x = 1)
  const initialX = world.getPose().x;
  const poseRight = world.tick(0.2, { keys: new Set(), joystick: { x: 1, y: 0 } }, 0);
  assert.equal(poseRight.moving, true);
  assert.ok(poseRight.x > initialX, 'Player moves right along +x');
});

