import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { sliceCatalogItem, slicePrefabs } from '../scripts/prefabSlicer';
import type { MeshCatalog, MeshCatalogItem } from '../src/data/meshCatalogTypes';

test('sliceCatalogItem isolates park_lamp003 and bakes normalized bottom pivot', async () => {
  const tmpDir = path.join(process.cwd(), 'public/3dmodel/prefabs_test');
  fs.mkdirSync(tmpDir, { recursive: true });

  const catalogPath = path.resolve('public/data/meshCatalog.json');
  const catalog: MeshCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const lampItem = catalog.items.find((i) => i.id === 'park_lamp003');
  assert.ok(lampItem, 'Lamp item must exist in catalog');

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const docCache = new Map();

  try {
    const res = await sliceCatalogItem(lampItem, docCache, io, tmpDir);
    assert.equal(res.success, true);
    assert.ok(res.filePath && fs.existsSync(res.filePath));
    assert.ok(res.bytes && res.bytes > 0 && res.bytes < 100_000); // < 100 KB vs 6.7 MB source

    // Verify GLB structure and normalized bounds
    const prefabDoc = await io.read(res.filePath);
    assert.equal(prefabDoc.getRoot().listMeshes().length, 1);

    const box = new THREE.Box3();
    for (const mesh of prefabDoc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        assert.ok(pos);
        for (let i = 0; i < pos.getCount(); i++) {
          const el = pos.getElement(i, []);
          box.expandByPoint(new THREE.Vector3(el[0], el[1], el[2]));
        }
      }
    }

    // Pivot bottom at Y=0, X and Z centered near 0
    assert.ok(Math.abs(box.min.y) < 0.001, 'Bottom must be at Y = 0');
    const center = new THREE.Vector3();
    box.getCenter(center);
    assert.ok(Math.abs(center.x) < 0.001, 'X must be centered at 0');
    assert.ok(Math.abs(center.z) < 0.001, 'Z must be centered at 0');
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
});

test('slicePrefabs handles category filtering and limit correctly', async () => {
  const tmpDir = path.join(process.cwd(), 'public/3dmodel/prefabs_filter_test');
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const res = await slicePrefabs({
      outDir: tmpDir,
      categories: ['PROP'],
      limit: 2
    });

    assert.equal(res.totalProcessed, 2);
    assert.equal(res.totalSuccess, 2);
    assert.ok(res.totalBytes > 0);

    const files = fs.readdirSync(tmpDir);
    assert.equal(files.length, 2);
    for (const file of files) {
      assert.ok(file.endsWith('.glb'));
    }
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
});
