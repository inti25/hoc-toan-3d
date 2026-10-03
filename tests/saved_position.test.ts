import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, parseSave } from '../src/core/state';
import { Adventure } from '../src/core/adventure';
import { SpatialWorld } from '../src/world/SpatialWorld';

// In-memory fake storage adapter for testing
function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val)
  };
}

test('SaveState persists and sanitizes player coordinates to 2 decimal places', () => {
  const s = freshState();
  assert.equal(s.position, undefined);

  s.position = { x: 12.3482, z: -5.9281 };
  const json = JSON.stringify(s);
  const loaded = parseSave(json);

  assert.ok(loaded.position);
  assert.equal(loaded.position.x, 12.35);
  assert.equal(loaded.position.z, -5.93);
});

test('Adventure.savePosition updates state and commits to storage adapter', () => {
  const storage = createMemoryStorage();
  const adv = new Adventure(freshState(), storage);

  adv.savePosition(15.6789, 4.321);
  const pos = adv.getPosition();
  assert.ok(pos);
  assert.equal(pos.x, 15.68);
  assert.equal(pos.z, 4.32);

  // Re-instantiate adventure from storage
  const reloaded = new Adventure(undefined, storage);
  assert.deepEqual(reloaded.getPosition(), { x: 15.68, z: 4.32 });
});

test('Adventure.resetProgress clears saved position', () => {
  const storage = createMemoryStorage();
  const adv = new Adventure(freshState(), storage);

  adv.savePosition(110, -60);
  assert.ok(adv.getPosition());

  adv.resetProgress();
  assert.equal(adv.getPosition(), undefined);

  const reloaded = new Adventure(undefined, storage);
  assert.equal(reloaded.getPosition(), undefined);
});

test('SpatialWorld validates positions and handles deferred spawn logic', () => {
  const spatial = new SpatialWorld();

  // Initially only starter village is valid (without bridge completed)
  // Coordinates on Sanctuary 1 (both shore ring and lake water) are within land footprint
  assert.equal(spatial.isWithinLand(94.5, -60), true, 'Lake shore ring coordinate is valid');
  assert.equal(spatial.isWithinLand(110, -60), true, 'Lake center is within land boundary');
  // Coordinates outside the lake island footprint clamp to lake arrival anchor
  const outsideLake = { x: 110 + 19.0, z: -60 }; // 129, -60 is outside 18m boundary
  assert.equal(spatial.isWithinLand(outsideLake.x, outsideLake.z), false, 'Outside lake island boundary');
  const safeSpawn = spatial.resolveSafeSpawn(outsideLake.x, outsideLake.z);
  assert.ok(safeSpawn !== null);
  assert.equal(safeSpawn?.x, 94.5);
  assert.equal(safeSpawn?.z, -62.6);

  // Dynamic custom island (e.g. Zone 7 at 120, 120) is NOT valid yet
  assert.equal(spatial.isWithinLand(120, 120), false, 'Custom island not valid before loading dynamic data');

  // Load dynamic island data
  spatial.setDynamicData([
    {
      id: 7,
      name: 'Đảo Kỳ Bí',
      center: { x: 120, z: 120 },
      width: 40,
      depth: 40
    }
  ]);

  // Now coordinates on Zone 7 become valid (deferred spawn unblocked)
  assert.equal(spatial.isWithinLand(120, 120), true, 'Custom island is valid after loading dynamic data');
});
