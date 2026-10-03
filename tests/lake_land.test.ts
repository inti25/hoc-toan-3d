import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAKE_SCALE,
  LAKE_MODEL_CENTER,
  LAKE_WALK_INNER,
  LAKE_WALK_OUTER,
  LAKE_PORTAL_RADIUS,
  LAKE_MONOLITH_RADIUS,
  usesLakeTerrain,
  createLakeLand,
  isWithinLakeLand,
  lakeRotationForZone,
  computeLakeAnchors,
  computeLakeEntityPositions,
  isValidLakePosition
} from '../src/data/lakeLand';

test('usesLakeTerrain identifies GRID_SANCTUARY and CIRCLE_SANCTUARY', () => {
  assert.equal(usesLakeTerrain('GRID_SANCTUARY'), true);
  assert.equal(usesLakeTerrain('CIRCLE_SANCTUARY'), true);
  assert.equal(usesLakeTerrain('PARK_SANCTUARY'), false);
  assert.equal(usesLakeTerrain('FLOWER_BEDS'), false);
  assert.equal(usesLakeTerrain(null), false);
  assert.equal(usesLakeTerrain(undefined), false);
});

test('createLakeLand and isWithinLakeLand allow walking across entire lake up to outer boundary', () => {
  const center = { x: 100, z: -50 };
  const land = createLakeLand(center);

  assert.equal(land.innerRadius, LAKE_WALK_INNER);
  assert.equal(land.outerRadius, LAKE_WALK_OUTER);

  // Center and inner lake water are walkable across the whole island
  assert.equal(isWithinLakeLand(land, center.x, center.z), true, 'Center is walkable');
  assert.equal(isWithinLakeLand(land, center.x + 5, center.z), true, 'Inner lake is walkable');

  // Shore ring midpoint
  const midR = (LAKE_WALK_INNER + LAKE_WALK_OUTER) / 2;
  assert.equal(isWithinLakeLand(land, center.x + midR, center.z), true);
  assert.equal(isWithinLakeLand(land, center.x, center.z + midR), true);
  assert.equal(isWithinLakeLand(land, center.x - midR, center.z), true);

  // Outer boundary check
  assert.equal(isWithinLakeLand(land, center.x + LAKE_WALK_OUTER, center.z), true);
  assert.equal(isWithinLakeLand(land, center.x + LAKE_WALK_OUTER + 0.1, center.z), false);
});

test('computeLakeAnchors positions return portal and arrival on the shore ring', () => {
  const center = { x: 110, z: -60 };
  const anchors = computeLakeAnchors(center);

  // Return portal sits on west side
  assert.equal(anchors.returnPortal.x, 94.3);
  assert.equal(anchors.returnPortal.z, -60);
  assert.equal(anchors.returnPortal.rotationY, -Math.PI / 2);

  // Arrival sits on shore ring
  const arrDist = Math.hypot(anchors.arrival.x - center.x, anchors.arrival.z - center.z);
  assert.ok(
    arrDist >= LAKE_WALK_INNER && arrDist <= LAKE_WALK_OUTER,
    `Arrival dist ${arrDist} must be on walkable ring`
  );
  assert.equal(anchors.arrival.x, 94.5);
  assert.equal(anchors.arrival.z, -62.6);
});

test('computeLakeEntityPositions produces valid ring layouts for CIRCLE and GRID templates', () => {
  const center = { x: 150, z: 60 };

  // 1. CIRCLE_SANCTUARY
  const circlePos = computeLakeEntityPositions('CIRCLE_SANCTUARY', 8, center);
  assert.equal(circlePos.length, 8);
  circlePos.forEach((p) => {
    const dist = Math.hypot(p.x - center.x, p.z - center.z);
    assert.ok(Math.abs(dist - LAKE_MONOLITH_RADIUS) < 0.2, `Radius ${dist} should match ${LAKE_MONOLITH_RADIUS}`);
  });

  // 2. GRID_SANCTUARY (divided into North arc and South arc)
  const gridPos = computeLakeEntityPositions('GRID_SANCTUARY', 8, center);
  assert.equal(gridPos.length, 8);
  const north = gridPos.filter((p) => p.z < center.z);
  const south = gridPos.filter((p) => p.z > center.z);
  assert.equal(north.length, 4);
  assert.equal(south.length, 4);
  gridPos.forEach((p) => {
    const dist = Math.hypot(p.x - center.x, p.z - center.z);
    assert.ok(Math.abs(dist - LAKE_MONOLITH_RADIUS) < 0.2, `Radius ${dist} should match ${LAKE_MONOLITH_RADIUS}`);
  });
});

test('isValidLakePosition checks lake boundaries with outer safety margin', () => {
  const center = { x: 110, z: -60 };

  // Inside water and center are valid
  assert.equal(isValidLakePosition(center, { x: 110, z: -60 }), true);
  assert.equal(isValidLakePosition(center, { x: 110 + 5, z: -60 }), true);
  // Solid walkable shore ring
  assert.equal(isValidLakePosition(center, { x: 110 + LAKE_PORTAL_RADIUS, z: -60 }), true);
  assert.equal(isValidLakePosition(center, { x: 110 + LAKE_MONOLITH_RADIUS, z: -60 }), true);
  // Beyond outer edge
  assert.equal(isValidLakePosition(center, { x: 110 + LAKE_WALK_OUTER + 1.0, z: -60 }), false);
});

test('lakeRotationForZone gives deterministic angle per zone', () => {
  const rot1 = lakeRotationForZone(1);
  const rot2 = lakeRotationForZone(2);
  const rot3 = lakeRotationForZone(3);

  assert.equal(rot1, lakeRotationForZone(1));
  assert.notEqual(rot1, rot2);
  assert.notEqual(rot2, rot3);
  assert.ok(rot1 >= 0 && rot1 < Math.PI * 2);
  assert.ok(rot2 >= 0 && rot2 < Math.PI * 2);
});
