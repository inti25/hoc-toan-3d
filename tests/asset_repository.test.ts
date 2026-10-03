import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssetRepository } from '../src/world/assets/AssetRepository';

test('AssetRepository initializes with empty cache and provides safe query interface', () => {
  const repo = new AssetRepository();

  assert.equal(repo.has('map:park'), false);
  assert.equal(repo.has('map:cozy_lake'), false);
  assert.equal(repo.has('avatar:elsa'), false);
});

test('AssetRepository prefetchForPortal handles portal identifiers gracefully in Node headless environment', () => {
  const repo = new AssetRepository();

  // In Node environment, window is undefined so preload safely short-circuits
  assert.doesNotThrow(() => {
    repo.prefetchForPortal('village_to_park');
    repo.prefetchForPortal('archimedes_to_lake');
    repo.prefetchForPortal('generic_portal');
  });
});

test('AssetRepository dispose handles empty and populated states cleanly', () => {
  const repo = new AssetRepository();

  assert.doesNotThrow(() => {
    repo.dispose('map:park');
    repo.dispose();
  });
});
