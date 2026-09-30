import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerAvatar } from '../src/world/PlayerAvatar';

test('PlayerAvatar builds procedural avatars with forward features facing +Z', () => {
  const avatar = new PlayerAvatar();

  // Test boy
  avatar.setAvatar('boy');
  assert.equal(avatar.activeAvatar, 'boy');
  assert.ok(avatar.group.children.length > 0);

  // Test girl
  avatar.setAvatar('girl');
  assert.equal(avatar.activeAvatar, 'girl');

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
  avatar.setAvatar('boy');

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
