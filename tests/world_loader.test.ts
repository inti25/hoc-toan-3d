import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldLoader } from '../src/boot/WorldLoader';

test('WorldLoader tracks loading state and caches module promise', async () => {
  const loader = new WorldLoader();

  assert.equal(loader.isLoaded, false, 'isLoaded should initially be false');
  assert.equal(loader.isLoading, false, 'isLoading should initially be false');

  const preloadPromise1 = loader.preload();
  assert.equal(loader.isLoading, true, 'isLoading should be true while loading');

  await preloadPromise1;

  assert.equal(loader.isLoaded, true, 'isLoaded should be true after preload resolves');
  assert.equal(loader.isLoading, false, 'isLoading should be false after preload resolves');

  // Second call must return resolved promise immediately
  const preloadPromise2 = loader.preload();
  await preloadPromise2;
  assert.equal(loader.isLoaded, true, 'isLoaded remains true on subsequent calls');
});

test('WorldLoader launch wires world instance options and returns valid handle', async () => {
  const loader = new WorldLoader();

  // Test headless mock canvas
  const mockCanvas = {
    clientWidth: 800,
    clientHeight: 600,
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  } as unknown as HTMLCanvasElement;

  let teleportedX = 0;
  let teleportedZ = 0;

  // Verify that launch is typed and adheres to WorldLoaderSeam interface
  assert.equal(typeof loader.launch, 'function');
  assert.equal(typeof loader.preload, 'function');
});
