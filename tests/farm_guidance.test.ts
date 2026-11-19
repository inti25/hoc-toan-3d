import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FARM_ANIMAL_ANCHORS_LOCAL,
  FARM_PEN_CENTER_LOCAL,
  FARM_RETURN_PORTAL_LOCAL
} from '../src/data/farmMap';
import {
  buildFarmTrackerSnapshot,
  computeCompassGuidance,
  describeFarmArea,
  orderTrackedAnimals,
  type FarmAnimalTrackerSource
} from '../src/world/farm/FarmGuidance';
import {
  PinchOrbitController,
  computePinchZoomDistance,
  computeWheelZoomDistance
} from '../src/world/cameraZoom';
import { FarmSanctuary } from '../src/world/farm/FarmSanctuary';

test('describeFarmArea returns Vietnamese landmark hints for pen and all 18 animal anchors', () => {
  assert.equal(
    describeFarmArea(FARM_PEN_CENTER_LOCAL.x, FARM_PEN_CENTER_LOCAL.z),
    'Gần Khu Chuồng Trại'
  );
  assert.equal(describeFarmArea(54, -56), 'Đồng cỏ Đông Bắc');
  assert.equal(describeFarmArea(46, 8), 'Đường thẳng phía Đông');
  assert.equal(describeFarmArea(56, 50), 'Cánh đồng lúa Đông Nam');
  assert.equal(describeFarmArea(-56, -56), 'Đường vòng Tây Bắc');
  assert.equal(describeFarmArea(-72, 6), 'Lối đá cuội phía Tây');
  assert.equal(describeFarmArea(-46, 62), 'Khúc cua Tây Nam');
  assert.equal(describeFarmArea(18, 62), 'Đường thẳng phía Nam');
  assert.equal(describeFarmArea(10, -8), 'Bãi cỏ trung tâm');

  for (const anchor of FARM_ANIMAL_ANCHORS_LOCAL) {
    const label = describeFarmArea(anchor.x, anchor.z);
    assert.ok(label.length > 0, `Anchor (${anchor.x}, ${anchor.z}) must have an area hint`);
  }
});

test('computeCompassGuidance aligns with cameraYaw forward/right axes and distance cues', () => {
  const player = { x: 0, z: 0 };

  // yaw = 0 => camera forward is (0, -1), right is (1, 0)
  const ahead = computeCompassGuidance(player, 0, { x: 0, z: -20 });
  assert.ok(Math.abs(ahead.arrowDeg) < 0.01);
  assert.equal(ahead.distanceMeters, 20);
  assert.equal(ahead.directionText, 'Đi thẳng');
  assert.equal(ahead.isNear, false);

  const right = computeCompassGuidance(player, 0, { x: 20, z: 0 });
  assert.ok(Math.abs(right.arrowDeg - 90) < 0.01);
  assert.equal(right.directionText, 'Rẽ phải');

  const left = computeCompassGuidance(player, 0, { x: -20, z: 0 });
  assert.ok(Math.abs(left.arrowDeg + 90) < 0.01);
  assert.equal(left.directionText, 'Rẽ trái');

  const behind = computeCompassGuidance(player, 0, { x: 0, z: 20 });
  assert.ok(Math.abs(Math.abs(behind.arrowDeg) - 180) < 0.01);
  assert.equal(behind.directionText, 'Quay lại');

  // yaw = +PI/2 => camera forward is (-1, 0), right is (0, -1)
  const rotatedAhead = computeCompassGuidance(player, Math.PI / 2, { x: -15, z: 0 });
  assert.ok(Math.abs(rotatedAhead.arrowDeg) < 0.01);
  assert.equal(rotatedAhead.directionText, 'Đi thẳng');

  const rotatedRight = computeCompassGuidance(player, Math.PI / 2, { x: 0, z: -15 });
  assert.ok(Math.abs(rotatedRight.arrowDeg - 90) < 0.01);
  assert.equal(rotatedRight.directionText, 'Rẽ phải');

  // Within arrival radius (< 6m)
  const near = computeCompassGuidance(player, 0, { x: 3, z: -4 });
  assert.equal(near.distanceMeters, 5);
  assert.equal(near.isNear, true);
  assert.equal(near.directionText, '✨ Đã tới gần!');
});

test('buildFarmTrackerSnapshot handles sorting stability, pin/unpin, auto-advance, and all-rescued return portal', () => {
  const sampleAnimals: FarmAnimalTrackerSource[] = [
    { id: 'farm_cow_0', index: 0, kind: 'cow', localPos: { x: 10, z: 0 }, rescued: false, problemTitle: 'Bài 1' },
    { id: 'farm_pig_1', index: 1, kind: 'pig', localPos: { x: 30, z: 0 }, rescued: false, problemTitle: 'Giải cứu Heo Ốm' },
    { id: 'farm_chicken_2', index: 2, kind: 'chicken', localPos: { x: 5, z: 0 }, rescued: true }
  ];

  // 1. Auto-selects nearest unrescued animal (farm_cow_0)
  const s1 = buildFarmTrackerSnapshot({
    animals: sampleAnimals,
    playerLocalPos: { x: 0, z: 0 },
    cameraYaw: 0,
    pinnedAnimalId: null,
    guideToPortal: false,
    previousOrderIds: [],
    allowResort: true
  });
  assert.equal(s1.totalCount, 3);
  assert.equal(s1.remainingCount, 2);
  assert.equal(s1.focusedAnimalId, 'farm_cow_0');
  assert.equal(s1.target.kind, 'animal');
  assert.equal(s1.remainingAnimals[0].shortTitle, undefined, '"Bài 1" generic title is omitted');
  assert.equal(s1.remainingAnimals[1].shortTitle, 'Giải cứu Heo Ốm');

  // 2. Hysteresis prevents jittering when adjacent distances only change within 2m
  const swappedSlightly = orderTrackedAnimals(
    [
      { id: 'a', index: 0, distanceMeters: 10.6 },
      { id: 'b', index: 1, distanceMeters: 9.8 }
    ],
    ['a', 'b'],
    true,
    2.0
  );
  assert.equal(swappedSlightly.didResort, false);
  assert.deepEqual(
    swappedSlightly.ordered.map((x) => x.id),
    ['a', 'b']
  );

  // When gap exceeds 2m tolerance and allowResort is true, order updates cleanly
  const swappedClearly = orderTrackedAnimals(
    [
      { id: 'a', index: 0, distanceMeters: 13.0 },
      { id: 'b', index: 1, distanceMeters: 9.0 }
    ],
    ['a', 'b'],
    true,
    2.0
  );
  assert.equal(swappedClearly.didResort, true);
  assert.deepEqual(
    swappedClearly.ordered.map((x) => x.id),
    ['b', 'a']
  );

  // 3. Pinning further animal overrides nearest focus
  const sPinned = buildFarmTrackerSnapshot({
    animals: sampleAnimals,
    playerLocalPos: { x: 0, z: 0 },
    cameraYaw: 0,
    pinnedAnimalId: 'farm_pig_1',
    guideToPortal: false,
    previousOrderIds: s1.orderedIds,
    allowResort: false
  });
  assert.equal(sPinned.focusedAnimalId, 'farm_pig_1');
  assert.equal(sPinned.effectivePinnedId, 'farm_pig_1');
  assert.equal(sPinned.target.isPinned, true);

  // 4. Rescuing pinned animal clears pin & auto-advances to next nearest unrescued animal
  const afterRescuePinned = sampleAnimals.map((a) =>
    a.id === 'farm_pig_1' ? { ...a, rescued: true } : a
  );
  const sAdvanced = buildFarmTrackerSnapshot({
    animals: afterRescuePinned,
    playerLocalPos: { x: 0, z: 0 },
    cameraYaw: 0,
    pinnedAnimalId: 'farm_pig_1',
    guideToPortal: false,
    previousOrderIds: s1.orderedIds,
    allowResort: true
  });
  assert.equal(sAdvanced.effectivePinnedId, null);
  assert.equal(sAdvanced.focusedAnimalId, 'farm_cow_0');
  assert.equal(sAdvanced.remainingCount, 1);

  // 5. Explicit guideToPortal suppresses 3D animal focus and targets Return Portal
  const sPortal = buildFarmTrackerSnapshot({
    animals: sampleAnimals,
    playerLocalPos: { x: 0, z: 0 },
    cameraYaw: 0,
    pinnedAnimalId: 'farm_cow_0',
    guideToPortal: true,
    previousOrderIds: s1.orderedIds,
    allowResort: false
  });
  assert.equal(sPortal.focusedAnimalId, null);
  assert.equal(sPortal.target.kind, 'portal');
  assert.deepEqual(sPortal.target.localPos, {
    x: FARM_RETURN_PORTAL_LOCAL.x,
    z: FARM_RETURN_PORTAL_LOCAL.z
  });

  // 6. All animals rescued automatically switches to Return Portal celebration guidance
  const allDoneAnimals = sampleAnimals.map((a) => ({ ...a, rescued: true }));
  const sAllDone = buildFarmTrackerSnapshot({
    animals: allDoneAnimals,
    playerLocalPos: { x: 65, z: -20 },
    cameraYaw: 0,
    pinnedAnimalId: 'farm_cow_0',
    guideToPortal: false,
    previousOrderIds: s1.orderedIds,
    allowResort: true
  });
  assert.equal(sAllDone.allRescued, true);
  assert.equal(sAllDone.remainingCount, 0);
  assert.equal(sAllDone.focusedAnimalId, null);
  assert.equal(sAllDone.target.kind, 'portal');
});

test('FarmSanctuary displays 3D sky focus beam only on the focused unrescued animal and hides on rescue', () => {
  const farm = new FarmSanctuary();
  const mockLibrary = new THREE.Group();
  for (const kind of ['cow', 'chicken', 'pig', 'duck', 'calf', 'piglet', 'chick', 'duckling', 'dog']) {
    const node = new THREE.Group();
    node.name = kind;
    mockLibrary.add(node);
  }

  farm.setupFromLibrary(mockLibrary, {});
  const firstAnimal = farm.animals[0];
  assert.ok(firstAnimal, 'Expected at least 1 spawned animal');
  assert.equal(farm.focusBeamGroup, null, 'Focus beam should stay inactive until focused');

  farm.setFocusedAnimal(firstAnimal.id);
  assert.ok(farm.focusBeamGroup, 'Focus beam should be constructed on focus');
  assert.equal(farm.focusBeamGroup.visible, true);
  assert.equal(farm.focusBeamGroup.position.x, firstAnimal.root.position.x);
  assert.equal(farm.focusBeamGroup.position.z, firstAnimal.root.position.z);

  // Move animal slightly and tick update -> beam tracks new coordinates
  firstAnimal.targetPos = firstAnimal.root.position.clone().add(new THREE.Vector3(3, 0, 0));
  farm.update(0.5, new THREE.Vector3(0, 0, 0));
  assert.equal(farm.focusBeamGroup.position.x, firstAnimal.root.position.x);
  assert.equal(farm.focusBeamGroup.position.z, firstAnimal.root.position.z);

  // Clearing focus hides the beam
  farm.setFocusedAnimal(null);
  assert.equal(farm.focusBeamGroup.visible, false);

  // Re-focusing shows it, and rescuing hides it immediately
  farm.setFocusedAnimal(firstAnimal.id);
  assert.equal(farm.focusBeamGroup.visible, true);
  farm.onAnimalRescued(firstAnimal.id);
  assert.equal(farm.focusBeamGroup.visible, false);

  farm.dispose();
});

test('cameraZoom pinch math and PinchOrbitController support kingdom-wide zoom without accidental orbit or tap', () => {
  // 1. Spreading fingers zooms in (decreases distance), pinching zooms out (increases distance)
  const closeZoomIn = computePinchZoomDistance(4.2, 100, 200, true);
  assert.ok(closeZoomIn < 4.2, 'Spreading fingers should zoom in');

  const closeZoomOut = computePinchZoomDistance(4.2, 200, 100, true);
  assert.ok(closeZoomOut > 4.2, 'Pinching fingers should zoom out');

  // Clamping in Close Exploration Camera [0.35, 14]
  assert.equal(computePinchZoomDistance(0.5, 100, 1000, true), 0.35);
  assert.equal(computePinchZoomDistance(12, 1000, 100, true), 14);
  const escapeFromMin = computePinchZoomDistance(0.35, 200, 100, true);
  assert.ok(escapeFromMin > 0.35, 'Pinch out from minimum distance 0.35m must smoothly exit');

  // Clamping in Isometric Camera [23, 60]
  assert.equal(computePinchZoomDistance(25, 100, 1000, false), 23);
  assert.equal(computePinchZoomDistance(55, 1000, 100, false), 60);
  const isoZoomIn = computePinchZoomDistance(45, 100, 150, false);
  assert.equal(isoZoomIn, 30);

  // Trackpad/wheel scaling
  assert.ok(Math.abs(computeWheelZoomDistance(4.2, -100, true, false) - 3.4) < 1e-9);
  assert.equal(computeWheelZoomDistance(45, 1000, false, false), 60);

  // 2. PinchOrbitController state transitions
  const ctrl = new PinchOrbitController();

  // Single-finger tap
  ctrl.pointerDown(1, 100, 100);
  assert.deepEqual(ctrl.pointerMove(1, 101, 100), { kind: 'orbit', dx: 1, dy: 0 });
  assert.deepEqual(ctrl.pointerUp(1, 101, 100), { shouldTap: true, x: 101, y: 100 });

  // Single-finger drag suppresses tap
  ctrl.pointerDown(1, 100, 100);
  assert.deepEqual(ctrl.pointerMove(1, 120, 110), { kind: 'orbit', dx: 20, dy: 10 });
  assert.deepEqual(ctrl.pointerUp(1, 120, 110), { shouldTap: false, x: 120, y: 110 });

  // Two-finger pinch locks orbit until all fingers lift and suppresses tap on release
  ctrl.pointerDown(1, 100, 100);
  ctrl.pointerDown(2, 200, 100);
  assert.equal(ctrl.isPinching(), true);
  assert.deepEqual(ctrl.pointerMove(2, 250, 100), {
    kind: 'pinch',
    prevSpan: 100,
    nextSpan: 150
  });
  // Lifting one finger does NOT trigger orbit or tap while second finger remains down
  assert.deepEqual(ctrl.pointerUp(2, 250, 100), { shouldTap: false, x: 250, y: 100 });
  assert.deepEqual(ctrl.pointerMove(1, 140, 140), { kind: 'none' });
  // Lifting last finger completes gesture with shouldTap = false and unlocks next gesture
  assert.deepEqual(ctrl.pointerUp(1, 140, 140), { shouldTap: false, x: 140, y: 140 });
  assert.equal(ctrl.getActivePointerCount(), 0);

  // Subsequent fresh single finger orbits normally again
  ctrl.pointerDown(3, 50, 50);
  assert.deepEqual(ctrl.pointerMove(3, 70, 55), { kind: 'orbit', dx: 20, dy: 5 });
  ctrl.reset();
  assert.equal(ctrl.getActivePointerCount(), 0);
});
