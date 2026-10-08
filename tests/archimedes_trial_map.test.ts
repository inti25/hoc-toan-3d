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

  // 3. 5 Compact Sanctuary Islands (Cozy Lake shore ring: d between 13.5 and 18.0)
  assert.equal(world.canMove(94.5, -60), true, 'Can move on shore ring in Sanctuary 1 (Thung Lũng Tính Toán)');
  assert.equal(world.canMove(134.5, -60), true, 'Can move on shore ring in Sanctuary 2 (Suối Nguồn Dãy Số)');
  assert.equal(world.canMove(94.5, 60), true, 'Can move on shore ring in Sanctuary 3 (Đồi Thời Gian)');
  assert.equal(world.canMove(134.5, 60), true, 'Can move on shore ring in Sanctuary 4 (Rừng Hình Học)');
  assert.equal(world.canMove(174.5, 0), true, 'Can move on shore ring in Sanctuary 5 (Đỉnh Núi Tư Duy Sao)');
  assert.equal(world.canMove(110, -55), true, 'Can move in lake water in Sanctuary 1 (Thung Lũng Tính Toán)');
  assert.equal(world.canMove(110, -60), false, 'Central monument obstacle in Sanctuary 1 is non-walkable');

  // 4. Void / Cloud Sea between islands must be blocked
  assert.equal(world.canMove(82, 0), false, 'Void between Hub and Sanctuary 5 must be blocked');
  assert.equal(world.canMove(130, 0), false, 'Void between northern and southern sanctuaries must be blocked');
  assert.equal(world.canMove(110, 0), false, 'Void between Sanctuary 1 and 3 must be blocked');
  assert.equal(world.canMove(150, 0), false, 'Void between Sanctuary 2 and 4 must be blocked');

  // 5. Monolith proximity on compact layout
  world.setDynamicData(
    ARCHIMEDES_ZONES,
    [{ x: 104, z: -65 }]
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
  assert.equal(world.getPose().x, 94.5);
  assert.equal(world.getPose().z, -62.6);
  assert.equal(world.getCurrentLocationName(), 'Thung Lũng Tính Toán');

  // 5. Walk into Sanctuary 1 return portal at (94.3, -60)
  world.teleport(94.3, -60);
  const t3 = world.checkPortalTransit(1.5);
  assert.ok(t3, 'Transit triggered from Sanctuary 1 back to Hub');
  assert.equal(t3?.id, 'z1_to_hub');
  assert.equal(world.getPose().x, 65);
  assert.equal(world.getPose().z, -8);
  assert.equal(world.getCurrentLocationName(), 'Đền Cổng Archimedes');
});


