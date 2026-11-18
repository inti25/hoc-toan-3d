import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { shouldRunRenderLoop, selectLakeSanctuariesToLoad } from '../src/world/World';

test('World animation loop must invoke renderer.render with scene and camera', () => {
  const worldSource = fs.readFileSync(path.resolve('src/world/World.ts'), 'utf-8');
  const hasRenderCall = /this\.renderer\.render\s*\(\s*this\.scene\s*,\s*this\.camera\s*\)/.test(worldSource);
  assert.equal(hasRenderCall, true, 'World animation frame must call renderer.render(this.scene, this.camera) on every active frame');
});

test('shouldRunRenderLoop pauses rendering when inactive, paused, or tab hidden', () => {
  assert.equal(shouldRunRenderLoop(true, false, false), true);
  assert.equal(shouldRunRenderLoop(false, false, false), false);
  assert.equal(shouldRunRenderLoop(true, true, false), false);
  assert.equal(shouldRunRenderLoop(true, false, true), false);
});

test('selectLakeSanctuariesToLoad defers 5 Archimedes lake islands until player enters realm and filters active zones', () => {
  const activeAll = new Set([1, 2, 3, 4, 5]);
  const noneLoaded = new Set<number>();

  // In Starter Village or Flower Garden (x <= 35): zero lake sanctuaries loaded
  assert.deepEqual(selectLakeSanctuariesToLoad(-6, activeAll, noneLoaded), []);
  assert.deepEqual(selectLakeSanctuariesToLoad(22, activeAll, noneLoaded), []);

  // Entering Archimedes Gatehouse (x > 35): loads only active & unloaded sanctuaries
  const partialActive = new Set([1, 3, 5]);
  const alreadyLoaded = new Set([1]);
  const toLoad = selectLakeSanctuariesToLoad(60, partialActive, alreadyLoaded);
  assert.deepEqual(
    toLoad.map((s) => s.id),
    [3, 5]
  );
});
