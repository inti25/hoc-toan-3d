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

test('SpatialWorld supports dynamic islands and dynamic portal transits', () => {
  const world = new SpatialWorld(0, 0);

  // Vị trí (300, 300) ban đầu là void, không thể di chuyển
  assert.equal(world.isWithinLand(300, 300), false);
  assert.equal(world.canMove(300, 300), false);

  // Khai báo một Ốc Đảo mới ở (300, 300) với kích thước 30x30
  world.setDynamicData(
    [{ id: 99, name: 'Đảo Mới', center: { x: 300, z: 300 }, width: 30, depth: 30 }],
    [{ x: 300, z: 302 }],
    [{ id: 'hub_to_new', name: 'Đến Đảo Mới', source: { x: 60, z: 10 }, target: { x: 300, z: 295 }, triggerRadius: 1.5 }]
  );

  // Bây giờ vị trí (300, 300) đã là đất liền hợp lệ
  assert.equal(world.isWithinLand(300, 300), true);
  assert.equal(world.canMove(300, 300), true);

  // Kiểm tra nhận diện bia đá trên đảo mới
  world.teleport(300, 301.5);
  assert.equal(world.nearMonolithIndex(), 0);

  // Kiểm tra dịch chuyển qua portal động
  world.teleport(60, 10);
  const transit = world.checkPortalTransit(0.5);
  assert.ok(transit !== null);
  assert.equal(transit?.id, 'hub_to_new');
  assert.equal(world.getPose().x, 300);
  assert.equal(world.getPose().z, 295);
});

test('SpatialWorld supports dynamic PARK_SANCTUARY boundary without static bridge', () => {
  const world = new SpatialWorld(-6, 5);
  assert.equal(world.getCurrentLocationName(), 'Làng Khởi Đầu');

  // Before being configured from Google Sheets, park territory does not exist
  assert.equal(world.isWithinLand(-45, 0), false);
  assert.equal(world.isWithinLand(-24, 0), false); // No static physical bridge
  assert.equal(world.canMove(-45, 0), false);

  // When configured dynamically by Google Sheets
  world.setParkZone(-45, 0, 18.2, 'Công Viên Xanh', 7);

  // Inside dynamic park
  world.teleport(-45, 0);
  assert.equal(world.isWithinLand(-45, 0), true);
  assert.equal(world.getCurrentLocationName(), 'Công Viên Xanh');
  assert.equal(world.canMove(-45, 0), true);

  // Far beyond park perimeter
  assert.equal(world.isWithinLand(-75, 0), false);
  assert.equal(world.canMove(-75, 0), false);

  // Adding park obstacles
  world.addObstacles([{ x: -45, z: 2, radius: 1.0 }]);
  assert.equal(world.canMove(-45, 2), false); // Blocked by obstacle
  assert.equal(world.canMove(-45, 0), true); // Clear area still walkable
});

