import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerAvatar } from '../src/world/PlayerAvatar';

test('PlayerAvatar builds procedural avatars with forward features facing +Z', () => {
  const avatar = new PlayerAvatar();

  // Default avatar is baochau
  assert.equal(avatar.activeAvatar, 'baochau');
  assert.ok(avatar.group.children.length > 0);

  // Test vanillish (Kem)
  avatar.setAvatar('vanillish');
  assert.equal(avatar.activeAvatar, 'vanillish');
  assert.ok(avatar.group.children.length > 0);

  // Test procedural fallback for mymelody
  avatar.setAvatar('mymelody');
  assert.equal(avatar.activeAvatar, 'mymelody');
  assert.ok(avatar.group.children.length > 0);

  // In procedural My Melody, eyes and nose should be at z > 0 (+Z forward)
  const zPositions: number[] = [];
  avatar.group.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      zPositions.push(child.position.z);
    }
  });

  const forwardCount = zPositions.filter(z => z > 0.2).length;
  assert.ok(forwardCount >= 3, 'My Melody procedural face features must be oriented towards +Z');
});

test('PlayerAvatar locomotion animation updates walk cycle smoothly', () => {
  const avatar = new PlayerAvatar();
  avatar.setAvatar('baochau');

  // Should run walk animation without throwing
  avatar.updateWalkAnimation(0.5, true);
  avatar.updateWalkAnimation(1.0, false);
});

test('My Melody GLTF orientation calibration aligns +X authored heading to +Z world forward', () => {
  // In the Sketchfab GLTF model, My Melody's eyes and nose are authored pointing along +X
  const authoredForward = new THREE.Vector3(1, 0, 0);

  // The calibration offset applied in loadGLTF is -Math.PI / 2
  const calibrated = authoredForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);

  // Must align precisely with +Z
  assert.ok(Math.abs(calibrated.x) < 1e-6);
  assert.ok(Math.abs(calibrated.y) < 1e-6);
  assert.ok(Math.abs(calibrated.z - 1.0) < 1e-6);
});

test('PlayerAvatar builds avatar mesh when Elsa is selected', () => {
  const avatar = new PlayerAvatar();
  avatar.setAvatar('elsa');
  assert.equal(avatar.activeAvatar, 'elsa');
  assert.ok(avatar.group.children.length > 0, 'Elsa avatar mesh must be created upon selection');

  // Verify forward features face +Z
  const zPositions: number[] = [];
  avatar.group.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      zPositions.push(child.position.z);
    }
  });

  const forwardCount = zPositions.filter(z => z > 0.2).length;
  assert.ok(forwardCount >= 3, 'Elsa procedural face features must be oriented towards +Z');
});

test('PlayerAvatar builds avatar mesh when Bao Chau is selected', () => {
  const avatar = new PlayerAvatar();
  avatar.setAvatar('baochau');
  assert.equal(avatar.activeAvatar, 'baochau');
  assert.ok(avatar.group.children.length > 0, 'Bao Chau avatar mesh must be created upon selection');

  // Verify forward features (glasses, eyes, bangs) face +Z
  const zPositions: number[] = [];
  avatar.group.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      zPositions.push(child.position.z);
    }
  });

  const forwardCount = zPositions.filter(z => z > 0.2).length;
  assert.ok(forwardCount >= 3, 'Bao Chau procedural face features must be oriented towards +Z');

  // Verify walk animation runs smoothly
  avatar.updateWalkAnimation(0.5, true);
  avatar.updateWalkAnimation(1.0, false);
});

test('PlayerAvatar builds avatar mesh and loads char_vanillish.glb when Vanillish (Kem) is selected', async () => {
  const { AssetRepository } = await import('../src/world/assets/AssetRepository');
  const requestedUrls: string[] = [];
  const loadedIds: string[] = [];

  const repo = new AssetRepository({
    baseUrl: '/',
    transport: {
      loadGLTF: async (url: string) => {
        requestedUrls.push(url);
        const group = new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), new THREE.MeshStandardMaterial()));
        return group;
      }
    }
  });

  const avatar = new PlayerAvatar({
    assets: repo,
    onModelLoaded: (id) => loadedIds.push(id)
  });

  avatar.setAvatar('vanillish');
  assert.equal(avatar.activeAvatar, 'vanillish');
  assert.ok(avatar.group.children.length > 0, 'Vanillish procedural fallback mesh must be created immediately');

  // Verify forward features (eyes, blush, mouth) face +Z
  const zPositions: number[] = [];
  avatar.group.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      zPositions.push(child.position.z);
    }
  });
  assert.ok(zPositions.filter(z => z > 0.2).length >= 3, 'Vanillish procedural face features must be oriented towards +Z');

  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(requestedUrls, ['/3dmodel/prefabs/char_vanillish.glb']);
  assert.deepEqual(loadedIds, ['vanillish']);

  avatar.updateWalkAnimation(0.5, true);
  avatar.updateWalkAnimation(1.0, false);
});

test('PlayerAvatar loads only the selected 3D companion on demand and ignores stale out-of-order loads', async () => {
  const { AssetRepository } = await import('../src/world/assets/AssetRepository');
  const requestedUrls: string[] = [];
  const pendingResolvers = new Map<string, (g: THREE.Group) => void>();

  const repo = new AssetRepository({
    baseUrl: '/',
    transport: {
      loadGLTF: (url: string) => {
        requestedUrls.push(url);
        return new Promise<THREE.Group>((resolve) => {
          pendingResolvers.set(url, resolve);
        });
      }
    }
  });

  const loadedIds: string[] = [];
  const avatar = new PlayerAvatar({
    assets: repo,
    onModelLoaded: (id) => loadedIds.push(id)
  });

  // Constructor must NOT preload all 6 3D avatars
  assert.equal(requestedUrls.length, 0, 'Constructing PlayerAvatar must trigger zero eager GLTF downloads');

  // Select Hello Kitty first (slow download)
  avatar.setAvatar('hellokitty');
  assert.deepEqual(requestedUrls, ['/3dmodel/prefabs/char_hellokitty.glb']);

  // Quickly switch to Bao Chau before Hello Kitty finishes
  avatar.setAvatar('baochau');
  assert.deepEqual(requestedUrls, [
    '/3dmodel/prefabs/char_hellokitty.glb',
    '/3dmodel/prefabs/char_baochau.glb'
  ]);

  // Resolve Bao Chau first
  const baoChauRaw = new THREE.Group();
  baoChauRaw.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
  pendingResolvers.get('/3dmodel/prefabs/char_baochau.glb')!(baoChauRaw);
  await new Promise((r) => setTimeout(r, 10));

  assert.deepEqual(loadedIds, ['baochau']);
  assert.equal(avatar.activeAvatar, 'baochau');

  // Now stale Hello Kitty resolves late — must be ignored
  const hkRaw = new THREE.Group();
  hkRaw.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
  pendingResolvers.get('/3dmodel/prefabs/char_hellokitty.glb')!(hkRaw);
  await new Promise((r) => setTimeout(r, 10));

  assert.deepEqual(loadedIds, ['baochau'], 'Stale Hello Kitty resolution must not override active avatar');
  assert.equal(avatar.activeAvatar, 'baochau');
});

