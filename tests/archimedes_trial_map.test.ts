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
import seedData from '../src/data/seedData.json';

const seedMonoliths = Object.entries(seedData.questionsBySheet)
  .filter(([sheet]) => sheet.startsWith('Zone_'))
  .flatMap(([, list]) => list);
const sortedMonoliths = [...seedMonoliths].sort((a: any, b: any) => a.id - b.id);

test('ArchimedesTrialMap runtime bundle has 0 hardcoded monoliths, while seedData contains all 40 monoliths corresponding to pages 128 to 139', () => {
  assert.equal(ARCHIMEDES_MONOLITHS.length, 0, 'FE bundle must have 0 hardcoded monoliths');
  assert.equal(sortedMonoliths.length, 40, 'Must have exactly 40 monoliths in seed data (Bài 306 - 345)');

  // Verify IDs are consecutive 306 to 345
  for (let i = 0; i < 40; i++) {
    const expectedId = 306 + i;
    assert.equal(sortedMonoliths[i].id, expectedId, `Index ${i} must have id ${expectedId}`);
  }
});

test('ArchimedesTrialMap zones partition all 40 monoliths correctly in seedData', () => {
  assert.equal(ARCHIMEDES_ZONES.length, 5, 'Must have 5 thematic zones');

  const zone1 = seedData.questionsBySheet['Zone_1_Archimedes'];
  const zone2 = seedData.questionsBySheet['Zone_2_Archimedes'];
  const zone3 = seedData.questionsBySheet['Zone_3_Archimedes'];
  const zone4 = seedData.questionsBySheet['Zone_4_Archimedes'];
  const zone5 = seedData.questionsBySheet['Zone_5_Archimedes'];

  assert.equal(zone1.length, 10, 'Zone 1 (Tính toán & Đại lượng) has 10 monoliths');
  assert.equal(zone2.length, 6, 'Zone 2 (Tính nhanh & Dãy số) has 6 monoliths');
  assert.equal(zone3.length, 7, 'Zone 3 (Thời gian & Cân đĩa) has 7 monoliths');
  assert.equal(zone4.length, 13, 'Zone 4 (Hình học & Gấp khúc) has 13 monoliths');
  assert.equal(zone5.length, 4, 'Zone 5 (Đỉnh núi tư duy sao) has 4 monoliths');

  const total = zone1.length + zone2.length + zone3.length + zone4.length + zone5.length;
  assert.equal(total, 40, 'All 40 monoliths belong to exactly one zone');
});

test('Seam 1: ArchimedesTrialMap zones and monoliths are compact within the 5 sanctuary islands', () => {
  const expectedCenters: Record<number, { x: number; z: number }> = {
    1: { x: 110, z: -60 },
    2: { x: 150, z: -60 },
    3: { x: 110, z: 60 },
    4: { x: 150, z: 60 },
    5: { x: 190, z: 0 }
  };

  for (const zone of ARCHIMEDES_ZONES) {
    const expected = expectedCenters[zone.id];
    assert.deepEqual(zone.center, expected, `Zone ${zone.id} must be centered at compact island (${expected.x}, ${expected.z})`);

    const monoliths = (seedData.questionsBySheet as any)[zone.sheetName] || [];
    for (const m of monoliths) {
      if (m.position) {
        const distToCenter = Math.hypot(m.position.x - zone.center.x, m.position.z - zone.center.z);
        assert.ok(
          distToCenter <= 13.5,
          `Monolith ${m.id} at (${m.position.x}, ${m.position.z}) must be within 13.5m radius of Zone ${zone.id} center (${zone.center.x}, ${zone.center.z}), actual: ${distToCenter.toFixed(1)}m`
        );
      }
    }
  }
});

test('Every Archimedes monolith has valid structure, options, hints, and correct answers in seed data', () => {
  for (const monolith of seedMonoliths) {
    assert.ok(monolith.title.length > 0, `Monolith ${monolith.id} has title`);
    if (monolith.page !== undefined) {
      assert.ok(monolith.page >= 128 && monolith.page <= 139, `Monolith ${monolith.id} has valid page (${monolith.page})`);
    }
    assert.ok(monolith.steps.length >= 1, `Monolith ${monolith.id} has at least 1 step`);

    for (let sIdx = 0; sIdx < monolith.steps.length; sIdx++) {
      const step = monolith.steps[sIdx];
      assert.ok(step.prompt.length > 0, `Monolith ${monolith.id} step ${sIdx} has non-empty prompt`);
      assert.ok(step.options.length >= 3, `Monolith ${monolith.id} step ${sIdx} has at least 3 options`);
      
      const optionValues = step.options.map((o: any) => o.value);
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

test('Seam 2: SpatialWorld permits movement on compact islands and blocks void between islands', () => {
  const world = new SpatialWorld();
  world.setBridgeBuilt(6);

  // 1. Starter Village and Flower Garden
  assert.equal(world.canMove(-6, 6), true, 'Can move in Starter Village');
  assert.equal(world.canMove(18, 0), true, 'Can move in Flower Garden');

  // 2. Archimedes Gatehouse Hub
  assert.equal(world.canMove(60, 0), true, 'Can move on Gatehouse Hub');
  assert.equal(world.canMove(52, 0), true, 'Can move near Gatehouse return portal');

  // 3. 5 Compact Sanctuary Islands
  assert.equal(world.canMove(110, -60), true, 'Can move in Sanctuary 1 (Thung Lũng Tính Toán)');
  assert.equal(world.canMove(150, -60), true, 'Can move in Sanctuary 2 (Suối Nguồn Dãy Số)');
  assert.equal(world.canMove(110, 60), true, 'Can move in Sanctuary 3 (Đồi Thời Gian)');
  assert.equal(world.canMove(150, 60), true, 'Can move in Sanctuary 4 (Rừng Hình Học)');
  assert.equal(world.canMove(190, 0), true, 'Can move in Sanctuary 5 (Đỉnh Núi Tư Duy Sao)');

  // 4. Void / Cloud Sea between islands must be blocked
  assert.equal(world.canMove(82, 0), false, 'Void between Hub and Sanctuary 5 must be blocked');
  assert.equal(world.canMove(130, 0), false, 'Void between northern and southern sanctuaries must be blocked');
  assert.equal(world.canMove(110, 0), false, 'Void between Sanctuary 1 and 3 must be blocked');
  assert.equal(world.canMove(150, 0), false, 'Void between Sanctuary 2 and 4 must be blocked');

  // 5. Monolith proximity on compact layout
  world.setDynamicData(
    ARCHIMEDES_ZONES,
    seedMonoliths.filter((m: any) => m.position).map((m: any) => m.position)
  );
  // Monolith 306 is at (104, -65)
  world.teleport(104, -65);
  assert.equal(world.nearMonolithIndex(), 0, 'Standing right next to Monolith 306 in Sanctuary 1');

  // Teleport to center of Hub (no monoliths there)
  world.teleport(60, 0);
  assert.equal(world.nearMonolithIndex(), -1, 'No monolith near Gatehouse Hub center');
});

test('Seam 3: Walk-through portal transit transports player between islands with cooldown', () => {
  const world = new SpatialWorld();
  world.setBridgeBuilt(6);

  // 1. Player in garden near (30, 0) - not yet touching portal at (32, 0)
  world.teleport(30, 0);
  assert.equal(world.checkPortalTransit(0.016), null, 'No transit when outside portal trigger radius');

  // 2. Step into Garden -> Hub portal at (32, 0)
  world.teleport(32, 0);
  const t1 = world.checkPortalTransit(0.016);
  assert.ok(t1, 'Transit triggered when stepping into Garden portal');
  assert.equal(t1?.id, 'garden_to_hub');
  assert.equal(world.getPose().x, 55);
  assert.equal(world.getPose().z, 0);
  assert.equal(world.getCurrentLocationName(), 'Đền Cổng Archimedes');

  // 3. Cooldown prevents immediate re-triggering
  const cooldownCheck = world.checkPortalTransit(0.016);
  assert.equal(cooldownCheck, null, 'Cooldown blocks consecutive triggers');

  // 4. Walk to Hub -> Zone 1 portal at (68, -8) after cooldown expires
  world.teleport(68, -8);
  const t2 = world.checkPortalTransit(1.5); // 1.5s passes, cooldown expired
  assert.ok(t2, 'Transit triggered from Hub to Sanctuary 1');
  assert.equal(t2?.id, 'hub_to_z1');
  assert.equal(world.getPose().x, 102);
  assert.equal(world.getPose().z, -60);
  assert.equal(world.getCurrentLocationName(), 'Thung Lũng Tính Toán');

  // 5. Walk into Sanctuary 1 return portal at (100, -60)
  world.teleport(100, -60);
  const t3 = world.checkPortalTransit(1.5);
  assert.ok(t3, 'Transit triggered from Sanctuary 1 back to Hub');
  assert.equal(t3?.id, 'z1_to_hub');
  assert.equal(world.getPose().x, 65);
  assert.equal(world.getPose().z, -8);
  assert.equal(world.getCurrentLocationName(), 'Đền Cổng Archimedes');
});


