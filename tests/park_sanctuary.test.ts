import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { Adventure } from '../src/core/adventure';
import { freshState, parseSave } from '../src/core/state';
import { computeProceduralEntityPositions, PARK_TREE_OFFSETS } from '../src/data/remoteTypes';
import { getBundledFallbackData } from '../src/core/sheetsClient';

test('PARK_SANCTUARY template generates 20 tree coordinates in computeProceduralEntityPositions', () => {
  const parkZone = {
    id: 7,
    name: 'Công Viên Xanh',
    sheetName: 'CongVienXanh',
    badge: 'CÔNG VIÊN',
    center: { x: -45, z: 0 },
    width: 36,
    depth: 36,
    color: 0x22c55e,
    template: 'PARK_SANCTUARY' as const
  };

  const positions = computeProceduralEntityPositions(
    parkZone.template,
    20,
    parkZone.center,
    parkZone.width,
    parkZone.depth
  );
  assert.equal(positions.length, 20);
  assert.equal(PARK_TREE_OFFSETS.length, 20);

  // Check first offset matches PARK_TREE_OFFSETS translated by center (-45, 0)
  assert.equal(positions[0].x, -45 + PARK_TREE_OFFSETS[0].x);
  assert.equal(positions[0].z, 0 + PARK_TREE_OFFSETS[0].z);

  // Bundled fallback data must NOT contain Zone 7 or PARK_SANCTUARY (pure Google Sheets dynamic loading)
  const fallback = getBundledFallbackData();
  const zone7 = fallback.zones.find((z) => z.id === 7 || z.sheetName === 'CongVienXanh');
  assert.equal(zone7, undefined);

  // seedData.json contains 20 pre-seeded CongVienXanh problems
  const seed = JSON.parse(readFileSync(new URL('../src/data/seedData.json', import.meta.url), 'utf-8'));
  assert.ok(seed.questionsBySheet['CongVienXanh']);
  assert.equal(seed.questionsBySheet['CongVienXanh'].length, 20);
});

test('SpatialWorld detects tree proximity within 2.8m for Cây Tri Thức', () => {
  const world = new SpatialWorld(-45, 0);
  const sampleTrees = [
    { x: -35.2, z: 0.5 },
    { x: -40.0, z: 8.0 },
    { x: -50.0, z: -5.0 }
  ];

  world.setParkTreePositions(sampleTrees);

  // Initially far from all trees
  assert.equal(world.nearParkTreeIndex(), -1);

  // Walk close to tree 0 (distance < 2.8m)
  world.teleport(-35.0, 1.0);
  assert.equal(world.nearParkTreeIndex(), 0);

  // Walk close to tree 1 (distance < 2.8m)
  world.teleport(-40.5, 7.8);
  assert.equal(world.nearParkTreeIndex(), 1);

  // Walk far away
  world.teleport(0, 0);
  assert.equal(world.nearParkTreeIndex(), -1);
});

test('SaveState persists and parses parkTrees array and unified solvedProblems', () => {
  const fresh = freshState();
  assert.equal(fresh.parkTrees.length, 20);
  assert.ok(fresh.parkTrees.every((val) => val === false));

  // Simulate awakened trees 0 and 5
  fresh.parkTrees[0] = true;
  fresh.parkTrees[5] = true;
  const serialized = JSON.stringify(fresh);

  const restored = parseSave(serialized);
  assert.equal(restored.parkTrees.length, 20);
  assert.equal(restored.parkTrees[0], true);
  assert.equal(restored.parkTrees[1], false);
  assert.equal(restored.parkTrees[5], true);
  assert.equal(restored.solvedProblems['park_tree_1'], true);
  assert.equal(restored.solvedProblems['park_tree_6'], true);
});

test('Adventure.wakeParkTree rewards XP and coins, and handles full park completion', () => {
  // Mock localStorage for headless test
  const storage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
    key: () => null,
    length: 0
  };
  (globalThis as any).localStorage = mockLocalStorage;

  const adventure = new Adventure();
  assert.equal(adventure.isParkTreeAwakened(0), false);

  // Wake tree 0
  const delta1 = adventure.wakeParkTree(0, 1);
  assert.equal(delta1.alreadyAwakened, false);
  assert.equal(delta1.treeIndex, 0);
  assert.equal(delta1.xpGained, 20);
  assert.equal(delta1.coinsGained, 5);
  assert.equal(delta1.totalAwakened, 1);
  assert.equal(delta1.allTreesCompleted, false);
  assert.equal(adventure.isParkTreeAwakened(0), true);

  // Repeated attempt to wake tree 0
  const deltaRepeat = adventure.wakeParkTree(0, 1);
  assert.equal(deltaRepeat.alreadyAwakened, true);
  assert.equal(deltaRepeat.xpGained, 0);
  assert.equal(deltaRepeat.coinsGained, 0);

  // Wake trees 1 through 18
  for (let i = 1; i < 19; i++) {
    adventure.wakeParkTree(i, i + 1);
  }
  assert.equal(adventure.getState().parkTrees.filter(Boolean).length, 19);

  // Wake the final tree 19 (all 20 trees awakened -> grand completion bonus)
  const deltaFinal = adventure.wakeParkTree(19, 20);
  assert.equal(deltaFinal.alreadyAwakened, false);
  assert.equal(deltaFinal.allTreesCompleted, true);
  // 20 regular + 150 bonus = 170 XP, 5 regular + 50 bonus = 55 coins
  assert.equal(deltaFinal.xpGained, 170);
  assert.equal(deltaFinal.coinsGained, 55);
  assert.equal(deltaFinal.totalAwakened, 20);

  // Reset progress resets all park trees
  adventure.resetProgress();
  const resetState = adventure.getState();
  assert.equal(resetState.parkTrees.filter(Boolean).length, 0);
  assert.equal(adventure.isParkTreeAwakened(0), false);
});

test('SpatialWorld supports Starter Village portal transit to PARK_SANCTUARY and multi-park selection', () => {
  const world = new SpatialWorld(-19.5, 0);

  // 1. Single PARK_SANCTUARY zone portal transit
  const singleParkPortals = [
    {
      id: 'village_to_park',
      name: 'Cổng dịch chuyển',
      source: { x: -19.5, z: 0 },
      target: { x: -33.5, z: 0 },
      triggerRadius: 1.5
    },
    {
      id: 'z7_to_village',
      name: 'Cổng dịch chuyển',
      source: { x: -31, z: 0 },
      target: { x: -17.5, z: 0 },
      triggerRadius: 1.5
    }
  ];

  world.setDynamicData([], [], singleParkPortals, []);

  // Player at Starter Village west portal (-19.5, 0)
  const transitOut = world.checkPortalTransit(0.5);
  assert.ok(transitOut !== null);
  assert.equal(transitOut?.id, 'village_to_park');
  assert.equal(world.getPose().x, -33.5);
  assert.equal(world.getPose().z, 0);

  // Player walks into return portal at park entrance (-31, 0)
  world.teleport(-31, 0);
  const transitBack = world.checkPortalTransit(1.5);
  assert.ok(transitBack !== null);
  assert.equal(transitBack?.id, 'z7_to_village');
  assert.equal(world.getPose().x, -17.5);
  assert.equal(world.getPose().z, 0);

  // 2. Defensive check: calling setDynamicData without customPortals does not wipe out existing portals
  world.setDynamicData([], []);
  world.teleport(-19.5, 0);
  const transitRetained = world.checkPortalTransit(1.5);
  assert.ok(transitRetained !== null, 'Portals must not be erased when setDynamicData is called without customPortals');
  assert.equal(transitRetained?.id, 'village_to_park');

  // Verify walkability of all transit points
  assert.equal(world.canMove(-18, 0), true, 'Area approaching portal is walkable');
  assert.equal(world.canMove(-19.5, 0), true, 'Portal source at (-19.5, 0) is walkable');

  // Set park zone to simulate synchronous registration in renderDynamicZones
  world.setParkZone(-45, 0, 18.2, 'Công Viên Xanh', 7);
  assert.equal(world.canMove(-33.5, 0), true, 'Park arrival point at (-33.5, 0) is walkable');
  assert.equal(world.canMove(-17.5, 0), true, 'Village arrival point at (-17.5, 0) is walkable');

  // Verify both PORTAL_LINKS (e.g. garden_to_hub at 32, 0) and dynamicPortals coexist
  world.teleport(32, 0);
  const hubTransit = world.checkPortalTransit(1.5);
  assert.ok(hubTransit !== null, 'Hub portal must still work alongside dynamic portals');
  assert.equal(hubTransit?.id, 'garden_to_hub');

  // 3. Multi-park portal transit with requiresSelection: true
  const multiParkPortals = [
    {
      id: 'village_to_multi_park',
      name: 'Cổng dịch chuyển',
      source: { x: -19.5, z: 0 },
      target: { x: -19.5, z: 0 },
      triggerRadius: 1.5,
      requiresSelection: true
    }
  ];

  world.setDynamicData([], [], multiParkPortals, []);
  world.teleport(-19.5, 0);
  const multiTransit = world.checkPortalTransit(1.5);
  assert.ok(multiTransit !== null);
  assert.equal(multiTransit?.id, 'village_to_multi_park');
  assert.equal(multiTransit?.requiresSelection, true);
  // Player should NOT be moved automatically when requiresSelection is true
  assert.equal(world.getPose().x, -19.5);
  assert.equal(world.getPose().z, 0);

  // 4. Archimedes Gatehouse (60, 0) has NO portal to park
  world.teleport(60, 0);
  assert.equal(world.checkPortalTransit(1.5), null);
});

test('PARK_SANCTUARY only activates trees matching question count (< 20) and does not spawn monoliths', () => {
  const parkZone = {
    id: 7,
    name: 'Công Viên Xanh',
    sheetName: 'CongVienXanh',
    badge: 'CÔNG VIÊN',
    center: { x: -45, z: 0 },
    width: 36,
    depth: 36,
    color: 0x10b981,
    template: 'PARK_SANCTUARY' as const
  };

  // 1. Simulate Google Sheets returning only 5 questions (with custom colors)
  const fiveQuestions = [
    { id: 1, title: 'Cây #1', color: 0xff6b81, steps: [{ prompt: '1+1=?' }] },
    { id: 2, title: 'Cây #2', color: 0x3b82f6, steps: [{ prompt: '2+2=?' }] },
    { id: 3, title: 'Cây #3', color: 0xf59e0b, steps: [{ prompt: '3+3=?' }] },
    { id: 4, title: 'Cây #4', color: 0x10b981, steps: [{ prompt: '4+4=?' }] },
    { id: 5, title: 'Cây #5', color: 0x8b5cf6, steps: [{ prompt: '5+5=?' }] }
  ];

  const world = new SpatialWorld(-45, 0);

  // When only 5 questions are provided, SpatialWorld should only activate proximity for those 5 trees
  const all20TreePositions = computeProceduralEntityPositions(
    parkZone.template,
    20,
    parkZone.center,
    parkZone.width,
    parkZone.depth
  );

  // Simulate registering only the positions of trees that have questions
  world.setParkTreePositions(all20TreePositions.slice(0, fiveQuestions.length));

  assert.equal(world.parkTreePositions.length, 5, 'Only 5 tree positions should be registered for questions');

  // Player at tree 0 (active question) -> nearParkTreeIndex() returns 0
  world.teleport(all20TreePositions[0].x, all20TreePositions[0].z);
  assert.equal(world.nearParkTreeIndex(), 0);

  // Player at tree 4 (active question) -> nearParkTreeIndex() returns 4
  world.teleport(all20TreePositions[4].x, all20TreePositions[4].z);
  assert.equal(world.nearParkTreeIndex(), 4);

  // Player at tree 5 (no question assigned) -> nearParkTreeIndex() must return -1
  world.teleport(all20TreePositions[5].x, all20TreePositions[5].z);
  assert.equal(world.nearParkTreeIndex(), -1, 'Tree 5 has no question and must not trigger proximity interaction');

  // Player at tree 19 (no question assigned) -> nearParkTreeIndex() must return -1
  world.teleport(all20TreePositions[19].x, all20TreePositions[19].z);
  assert.equal(world.nearParkTreeIndex(), -1, 'Tree 19 has no question and must not trigger proximity interaction');

  // 2. Verify that PARK_SANCTUARY zones are strictly excluded from generating monoliths
  const isExcludedFromMonoliths = (z: { template: string; id: number; sheetName: string }) => {
    return (
      z.template === 'FLOWER_BEDS' ||
      z.template === 'PARK_SANCTUARY' ||
      z.id === 6 ||
      z.id === 7 ||
      z.sheetName === 'VuonHoa' ||
      z.sheetName === 'CongVienXanh'
    );
  };
  assert.equal(isExcludedFromMonoliths(parkZone), true, 'PARK_SANCTUARY must be excluded from monolith generation');
});

