import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIMEDES_MONOLITHS,
  ARCHIMEDES_ZONES,
  getMonolithById,
  getMonolithsByZone,
  type ArchimedesMonolith
} from '../src/data/archimedesTrialMap';
import { Adventure } from '../src/core/Adventure';
import { freshState, parseSave } from '../src/core/state';
import { SpatialWorld } from '../src/world/SpatialWorld';


test('ArchimedesTrialMap contains all 40 monoliths corresponding to pages 128 to 139', () => {
  assert.equal(ARCHIMEDES_MONOLITHS.length, 40, 'Must have exactly 40 monoliths (Bài 306 - 345)');

  // Verify IDs are consecutive 306 to 345
  for (let i = 0; i < 40; i++) {
    const expectedId = 306 + i;
    assert.equal(ARCHIMEDES_MONOLITHS[i].id, expectedId, `Index ${i} must have id ${expectedId}`);
  }
});

test('ArchimedesTrialMap zones partition all 40 monoliths correctly', () => {
  assert.equal(ARCHIMEDES_ZONES.length, 5, 'Must have 5 thematic zones');

  const zone1 = getMonolithsByZone(1);
  const zone2 = getMonolithsByZone(2);
  const zone3 = getMonolithsByZone(3);
  const zone4 = getMonolithsByZone(4);
  const zone5 = getMonolithsByZone(5);

  assert.equal(zone1.length, 10, 'Zone 1 (Tính toán & Đại lượng) has 10 monoliths');
  assert.equal(zone2.length, 6, 'Zone 2 (Tính nhanh & Dãy số) has 6 monoliths');
  assert.equal(zone3.length, 7, 'Zone 3 (Thời gian & Cân đĩa) has 7 monoliths');
  assert.equal(zone4.length, 13, 'Zone 4 (Hình học & Gấp khúc) has 13 monoliths');
  assert.equal(zone5.length, 4, 'Zone 5 (Đỉnh núi tư duy sao) has 4 monoliths');

  const total = zone1.length + zone2.length + zone3.length + zone4.length + zone5.length;
  assert.equal(total, 40, 'All 40 monoliths belong to exactly one zone');
});

test('Every Archimedes monolith has valid structure, options, hints, and correct answers', () => {
  for (const monolith of ARCHIMEDES_MONOLITHS) {
    assert.ok(monolith.title.length > 0, `Monolith ${monolith.id} has title`);
    assert.ok(monolith.page >= 128 && monolith.page <= 139, `Monolith ${monolith.id} has valid page (${monolith.page})`);
    assert.ok(monolith.position && typeof monolith.position.x === 'number' && typeof monolith.position.z === 'number', `Monolith ${monolith.id} has 3D coords`);
    assert.ok(monolith.steps.length >= 1, `Monolith ${monolith.id} has at least 1 step`);

    for (let sIdx = 0; sIdx < monolith.steps.length; sIdx++) {
      const step = monolith.steps[sIdx];
      assert.ok(step.prompt.length > 0, `Monolith ${monolith.id} step ${sIdx} has non-empty prompt`);
      assert.ok(step.options.length >= 3, `Monolith ${monolith.id} step ${sIdx} has at least 3 options`);
      
      const optionValues = step.options.map(o => o.value);
      const uniqueValues = new Set(optionValues);
      assert.equal(uniqueValues.size, optionValues.length, `Monolith ${monolith.id} step ${sIdx} options must be unique`);
      assert.ok(optionValues.includes(step.answer), `Monolith ${monolith.id} step ${sIdx} answer '${step.answer}' must be in options [${optionValues.join(', ')}]`);
      assert.ok(step.hints.length >= 2, `Monolith ${monolith.id} step ${sIdx} must have at least 2 hints`);
      assert.ok(step.explanation.length > 0, `Monolith ${monolith.id} step ${sIdx} has explanation`);
    }
  }
});

test('Adventure handles monolith activation, persistence, and zone badge milestones', () => {
  const memoryStore: Record<string, string> = {};
  const mockStorage = {
    getItem: (k: string) => memoryStore[k] ?? null,
    setItem: (k: string, v: string) => { memoryStore[k] = v; }
  };

  const adv = new Adventure(undefined, mockStorage);
  assert.equal(adv.getState().monoliths.length, 40);
  assert.ok(adv.getState().monoliths.every(v => v === false));

  // Activate first monolith (Bài 306)
  const delta1 = adv.activateMonolith(0);
  assert.equal(delta1.alreadyActivated, false);
  assert.equal(delta1.monolithIndex, 0);
  assert.ok(delta1.xpGained >= 15);
  assert.ok(delta1.coinsGained >= 5);
  assert.equal(adv.getState().monoliths[0], true);

  // Activating again is idempotent
  const delta2 = adv.activateMonolith(0);
  assert.equal(delta2.alreadyActivated, true);
  assert.equal(delta2.xpGained, 0);

  // Persistence roundtrip
  const reloaded = new Adventure(undefined, mockStorage);
  assert.equal(reloaded.getState().monoliths[0], true);
  assert.equal(reloaded.getState().monoliths[1], false);
});

test('SpatialWorld allows navigation into Archimedes Realm and detects nearby monoliths', () => {
  const world = new SpatialWorld();
  world.setBridgeBuilt(6);


  // Player can move past the portal gate into Archimedes Realm
  assert.equal(world.canMove(38, 0), true, 'Can move on connecting avenue');
  assert.equal(world.canMove(70, 0), true, 'Can move to central compass plaza');
  assert.equal(world.canMove(110, -60), true, 'Can move to Zone 1 monolith area');

  // Fast-travel teleport to Monolith 306 (pos: x: 110, z: -60)
  world.teleport(110, -60);
  assert.equal(world.getPose().x, 110);
  assert.equal(world.getPose().z, -60);
  assert.equal(world.nearMonolithIndex(), 0, 'Standing right next to monolith 0 (Bài 306)');

  // Teleport far away from any monolith
  world.teleport(60, 0);
  assert.equal(world.nearMonolithIndex(), -1, 'No monolith near central plaza');
});

