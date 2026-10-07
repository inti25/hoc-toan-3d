import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('World animation loop must invoke renderer.render with scene and camera', () => {
  const worldSource = fs.readFileSync(path.resolve('src/world/World.ts'), 'utf-8');
  const hasRenderCall = /this\.renderer\.render\s*\(\s*this\.scene\s*,\s*this\.camera\s*\)/.test(worldSource);
  assert.equal(hasRenderCall, true, 'World animation frame must call renderer.render(this.scene, this.camera) on every frame');
});
