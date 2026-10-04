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

test('PrefabCatalog queries and filtering by category and subCategory', async () => {
  const { prefabCatalog } = await import('../src/world/assets/PrefabCatalog');
  const catalogData = await import('../public/data/meshCatalog.json', { with: { type: 'json' } });
  prefabCatalog.setCatalog(catalogData.default as any);

  assert.equal(prefabCatalog.isLoaded(), true);

  const lamp = prefabCatalog.getItem('park_lamp003');
  assert.ok(lamp);
  assert.equal(lamp.category, 'PROP');
  assert.equal(lamp.subCategory, 'lamp');
  assert.equal(lamp.isObstacle, true);
  assert.equal(lamp.obstacleRadius, 0.3);

  const foliage = prefabCatalog.getItemsByCategory('FOLIAGE');
  assert.ok(foliage.length > 50);

  const trees = prefabCatalog.getItemsBySubCategory('tree');
  assert.ok(trees.length > 5);

  const randomTree = prefabCatalog.getRandomItem({ category: 'FOLIAGE', subCategory: 'tree' });
  assert.ok(randomTree);
  assert.equal(randomTree.subCategory, 'tree');
});

test('PrefabCatalog createPlaceholder generates appropriate low-poly fallback geometries', async () => {
  const { prefabCatalog } = await import('../src/world/assets/PrefabCatalog');

  // Foliage tree placeholder (cylinder trunk + cone)
  const treeGroup = prefabCatalog.createPlaceholder({
    category: 'FOLIAGE',
    subCategory: 'tree',
    normalizedBounds: { min: [-1, 0, -1], max: [1, 4, 1], center: [0, 2, 0], size: [2, 4, 2] }
  });
  assert.equal(treeGroup.children.length, 2);

  // Obstacle rock placeholder
  const rockGroup = prefabCatalog.createPlaceholder({
    category: 'OBSTACLE',
    subCategory: 'stone',
    normalizedBounds: { min: [-1, 0, -1], max: [1, 2, 1], center: [0, 1, 0], size: [2, 2, 2] }
  });
  assert.equal(rockGroup.children.length, 1);

  // Prop box placeholder
  const propGroup = prefabCatalog.createPlaceholder({
    category: 'PROP',
    subCategory: 'lamp',
    normalizedBounds: { min: [-0.2, 0, -0.2], max: [0.2, 2, 0.2], center: [0, 1, 0], size: [0.4, 2, 0.4] }
  });
  assert.equal(propGroup.children.length, 1);
});

test('AssetRepository instantiatePrefab positions model and calculates collision obstacles automatically', async () => {
  const repo = new AssetRepository();
  const { prefabCatalog } = await import('../src/world/assets/PrefabCatalog');
  const catalogData = await import('../public/data/meshCatalog.json', { with: { type: 'json' } });
  prefabCatalog.setCatalog(catalogData.default as any);

  // 1. Lamp (solid obstacle)
  const lampRes = await repo.instantiatePrefab('park_lamp003', {
    position: { x: 12.5, y: 0, z: -8.2 },
    rotationY: Math.PI / 2,
    scale: 1.2
  });

  assert.ok(lampRes);
  assert.equal(lampRes.group.position.x, 12.5);
  assert.equal(lampRes.group.position.z, -8.2);
  assert.equal(lampRes.group.rotation.y, Math.PI / 2);
  assert.equal(lampRes.group.scale.x, 1.2);
  assert.ok(lampRes.obstacle);
  assert.equal(lampRes.obstacle.x, 12.5);
  assert.equal(lampRes.obstacle.z, -8.2);
  // Radius = 0.3 * 1.2 = 0.36
  assert.equal(lampRes.obstacle.radius, 0.36);

  // 2. Flower (walk-through, zero obstacle radius)
  const flowerItem = prefabCatalog.getItemsBySubCategory('flower')[0];
  if (flowerItem) {
    const flowerRes = await repo.instantiatePrefab(flowerItem.id, {
      position: { x: 5, z: 5 }
    });
    assert.ok(flowerRes);
    assert.equal(flowerRes.obstacle, undefined);
  }
});

