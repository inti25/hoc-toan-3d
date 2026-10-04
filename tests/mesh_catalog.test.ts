import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyMeshSemantic, scanModelsDirectory, find3DModelFiles } from '../scripts/modelScanner';
import type { MeshCatalog } from '../src/data/meshCatalogTypes';

test('classifyMeshSemantic classifies characters accurately', () => {
  const elsa = classifyMeshSemantic('elsa', 'public/3dmodel/elsa/scene.gltf', [1.0, 1.8, 0.5]);
  assert.equal(elsa.category, 'CHARACTER');
  assert.equal(elsa.subCategory, 'hero');
  assert.equal(elsa.isObstacle, true);
  assert.equal(elsa.obstacleRadius, 0.4);

  const kuromi = classifyMeshSemantic('kuromi', 'public/3dmodel/kuromi/scene.gltf', [0.8, 1.0, 0.5]);
  assert.equal(kuromi.category, 'CHARACTER');
  assert.equal(kuromi.subCategory, 'companion');
  assert.equal(kuromi.isObstacle, true);
});

test('classifyMeshSemantic classifies terrain and environment correctly', () => {
  const island = classifyMeshSemantic('Island_01', 'maps/cozy_lake.glb', [400, 20, 400]);
  assert.equal(island.category, 'TERRAIN');
  assert.equal(island.subCategory, 'island');
  assert.equal(island.isObstacle, false);
  assert.equal(island.obstacleRadius, 0);

  const water = classifyMeshSemantic('Lake_Water', 'maps/cozy_lake.glb', [200, 2, 200]);
  assert.equal(water.category, 'TERRAIN');
  assert.equal(water.subCategory, 'water');
  assert.equal(water.isObstacle, false);

  const cloud = classifyMeshSemantic('Cloud01', 'maps/cozy_lake.glb', [20, 10, 20]);
  assert.equal(cloud.category, 'ENVIRONMENT');
  assert.equal(cloud.isObstacle, false);
});

test('classifyMeshSemantic classifies foliage and handles walk-through vs solid', () => {
  // Trees are solid obstacles
  const tree = classifyMeshSemantic('Tree_Dense_01', 'maps/cozy_lake.glb', [10, 20, 10]);
  assert.equal(tree.category, 'FOLIAGE');
  assert.equal(tree.subCategory, 'tree');
  assert.equal(tree.isObstacle, true);
  assert.ok(tree.obstacleRadius > 0);

  const pine = classifyMeshSemantic('Pine002', 'maps/park.glb', [2.5, 6.0, 2.5]);
  assert.equal(pine.category, 'FOLIAGE');
  assert.equal(pine.subCategory, 'pine');
  assert.equal(pine.isObstacle, true);

  // Grass and flowers are walk-through (zero obstacle radius)
  const grass = classifyMeshSemantic('Grass002', 'maps/park.glb', [1.0, 0.3, 1.0]);
  assert.equal(grass.category, 'FOLIAGE');
  assert.equal(grass.subCategory, 'grass');
  assert.equal(grass.isObstacle, false);
  assert.equal(grass.obstacleRadius, 0);

  const flower = classifyMeshSemantic('Flowers003', 'maps/park.glb', [0.8, 0.4, 0.8]);
  assert.equal(flower.category, 'FOLIAGE');
  assert.equal(flower.subCategory, 'flower');
  assert.equal(flower.isObstacle, false);
  assert.equal(flower.obstacleRadius, 0);
});

test('classifyMeshSemantic classifies props and stone obstacles', () => {
  const lamp = classifyMeshSemantic('Lamp003', 'maps/park.glb', [0.4, 2.0, 0.4]);
  assert.equal(lamp.category, 'PROP');
  assert.equal(lamp.subCategory, 'lamp');
  assert.equal(lamp.isObstacle, true);
  assert.equal(lamp.obstacleRadius, 0.3);

  const stone = classifyMeshSemantic('Stone1_01', 'maps/cozy_lake.glb', [4.0, 2.0, 4.0]);
  assert.equal(stone.category, 'OBSTACLE');
  assert.equal(stone.subCategory, 'stone');
  assert.equal(stone.isObstacle, true);
  assert.ok(stone.obstacleRadius >= 1.0);
});

test('find3DModelFiles recursively finds all GLB and GLTF models', () => {
  const files = find3DModelFiles('public/3dmodel');
  assert.ok(files.length >= 7);
  const exts = files.map((f) => path.extname(f).toLowerCase());
  assert.ok(exts.includes('.glb'));
  assert.ok(exts.includes('.gltf'));
});

test('scanModelsDirectory creates valid MeshCatalog with correct bounds and categories', async () => {
  const tmpOut = path.join(process.cwd(), 'public/data/meshCatalog.test.json');

  const catalog: MeshCatalog = await scanModelsDirectory({
    modelDir: 'public/3dmodel',
    outputPath: tmpOut
  });

  try {
    assert.equal(catalog.version, '1.0.0');
    assert.ok(catalog.sourceCount >= 7);
    assert.ok(catalog.totalItems > 100);

    // Categories all exist in summary
    assert.ok(catalog.byCategory.TERRAIN > 0);
    assert.ok(catalog.byCategory.FOLIAGE > 0);
    assert.ok(catalog.byCategory.PROP > 0);
    assert.ok(catalog.byCategory.OBSTACLE > 0);
    assert.ok(catalog.byCategory.CHARACTER >= 5);

    // Verify written file matches returned object
    assert.ok(fs.existsSync(tmpOut));
    const saved = JSON.parse(fs.readFileSync(tmpOut, 'utf-8')) as MeshCatalog;
    assert.equal(saved.totalItems, catalog.totalItems);

    // Inspect items
    for (const item of catalog.items) {
      assert.ok(item.id.length > 0);
      assert.ok(item.name.length > 0);
      assert.ok(item.bounds.size[0] >= 0);
      assert.ok(item.bounds.size[1] >= 0);
      assert.ok(item.bounds.size[2] >= 0);

      // Normalized bounds must be ground-level (min Y = 0, center X = 0, center Z = 0)
      assert.equal(item.normalizedBounds.min[1], 0);
      assert.equal(item.normalizedBounds.center[0], 0);
      assert.equal(item.normalizedBounds.center[2], 0);

      if (item.isObstacle) {
        assert.ok(item.obstacleRadius > 0);
      } else {
        assert.equal(item.obstacleRadius, 0);
      }
    }
  } finally {
    if (fs.existsSync(tmpOut)) {
      fs.unlinkSync(tmpOut);
    }
  }
});
