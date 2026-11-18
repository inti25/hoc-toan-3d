import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AssetRepository } from '../src/world/assets/AssetRepository';
import type { AssetTransportAdapter } from '../src/world/assets/types';

test('AssetRepository initializes with empty cache and handles portal prefetch safely in headless Node', () => {
  const repo = new AssetRepository();

  assert.equal(repo.has('map:park'), false);
  assert.equal(repo.has('map:cozy_lake'), false);
  assert.equal(repo.has('map:farm'), false);
  assert.equal(repo.has('avatar:elsa'), false);

  assert.doesNotThrow(() => {
    repo.prefetchForPortal('village_to_park');
    repo.prefetchForPortal('archimedes_to_lake');
    repo.prefetchForPortal('village_to_farm');
    repo.prefetchForPortal('generic_portal');
  });
});

test('AssetRepository deduplicates concurrent in-flight loads for the same asset key', async () => {
  let loadCalls = 0;
  let resolveLoad!: (g: THREE.Group) => void;

  const transport: AssetTransportAdapter = {
    loadGLTF: () => {
      loadCalls++;
      return new Promise<THREE.Group>((resolve) => {
        resolveLoad = resolve;
      });
    }
  };

  const repo = new AssetRepository({ transport, baseUrl: '/' });

  const p1 = repo.instantiate('prefab:park_lamp003');
  const p2 = repo.instantiate('prefab:park_lamp003');

  assert.equal(loadCalls, 1, 'Concurrent requests for same key must share one transport call');

  const raw = new THREE.Group();
  raw.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
  resolveLoad(raw);

  const [inst1, inst2] = await Promise.all([p1, p2]);
  assert.ok(inst1 && inst2);
  assert.notEqual(inst1, inst2, 'Each instantiate call must return an independent Group instance');
  assert.equal(repo.has('prefab:park_lamp003'), true);
});

test('AssetRepository normalizes 3D companion avatars via char_*.glb and attaches Cinnamoroll face', async () => {
  const loadedUrls: string[] = [];

  const transport: AssetTransportAdapter = {
    loadGLTF: async (url: string) => {
      loadedUrls.push(url);
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
      group.add(mesh);

      if (url.includes('char_elsa.glb')) {
        const leftArm = new THREE.Bone();
        leftArm.name = 'Bip001_L_UpperArm_060';
        const rightArm = new THREE.Bone();
        rightArm.name = 'Bip001_R_UpperArm_070';
        group.add(leftArm, rightArm);
      }
      return group;
    }
  };

  const repo = new AssetRepository({ transport, baseUrl: '/' });

  // 1. Elsa: height normalized to 3.6m, grounded at Y=0, arms lowered from A-pose
  const elsa = await repo.instantiate('avatar:elsa');
  assert.ok(elsa);
  assert.equal(loadedUrls[0], '/3dmodel/prefabs/char_elsa.glb');
  const elsaBox = new THREE.Box3().setFromObject(elsa);
  const elsaSize = elsaBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(elsaSize.y - 3.6) < 0.05, `Expected Elsa height ~3.6, got ${elsaSize.y}`);
  assert.ok(Math.abs(elsaBox.min.y) < 0.05, `Expected Elsa grounded at Y=0, got ${elsaBox.min.y}`);
  const leftBone = elsa.getObjectByName('Bip001_L_UpperArm_060');
  assert.ok(leftBone && Math.abs(leftBone.rotation.y - 0.6) < 1e-4);

  // 2. Bao Chau: unified char_baochau.glb, height normalized to 2.2m
  const baochau = await repo.instantiate('avatar:baochau');
  assert.ok(baochau);
  assert.equal(loadedUrls[1], '/3dmodel/prefabs/char_baochau.glb');
  const bcBox = new THREE.Box3().setFromObject(baochau);
  assert.ok(Math.abs(bcBox.getSize(new THREE.Vector3()).y - 2.2) < 0.05);

  // 3. My Melody: calibrated rotation -Math.PI / 2
  const mymelody = await repo.instantiate('avatar:mymelody');
  assert.ok(mymelody);
  assert.equal(loadedUrls[2], '/3dmodel/prefabs/char_mymelody.glb');
  const innerModel = mymelody.children[0];
  assert.ok(Math.abs(innerModel.rotation.y - (-Math.PI / 2)) < 1e-4);

  // 4. Cinnamoroll: procedural face group attached
  const cinnamoroll = await repo.instantiate('avatar:cinnamoroll');
  assert.ok(cinnamoroll);
  assert.equal(cinnamoroll.children.length, 2, 'Cinnamoroll wrapper should contain model + faceGroup');

  // 5. Vanillish (Kem): unified char_vanillish.glb, height normalized to 2.2m, grounded at Y=0
  const vanillish = await repo.instantiate('avatar:vanillish');
  assert.ok(vanillish);
  assert.equal(loadedUrls[4], '/3dmodel/prefabs/char_vanillish.glb');
  const vanillishBox = new THREE.Box3().setFromObject(vanillish);
  const vanillishSize = vanillishBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(vanillishSize.y - 2.2) < 0.05, `Expected Vanillish height ~2.2, got ${vanillishSize.y}`);
  assert.ok(Math.abs(vanillishBox.min.y) < 0.05, `Expected Vanillish grounded at Y=0, got ${vanillishBox.min.y}`);
});

test('AssetRepository hides embedded lights/cameras on map:farm and disposes all GPU resources cleanly', async () => {
  let disposedGeo = 0;
  let disposedMat = 0;

  const transport: AssetTransportAdapter = {
    loadGLTF: async () => {
      const group = new THREE.Group();
      const light = new THREE.PointLight();
      const cam = new THREE.PerspectiveCamera();
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const origGeoDispose = geo.dispose.bind(geo);
      geo.dispose = () => {
        disposedGeo++;
        origGeoDispose();
      };
      const mat = new THREE.MeshStandardMaterial();
      const origMatDispose = mat.dispose.bind(mat);
      mat.dispose = () => {
        disposedMat++;
        origMatDispose();
      };
      group.add(light, cam, new THREE.Mesh(geo, mat));
      return group;
    }
  };

  const repo = new AssetRepository({ transport, baseUrl: '/' });
  const farm = await repo.instantiate('map:farm');
  assert.ok(farm);

  let hiddenLights = 0;
  let hiddenCams = 0;
  farm.traverse((obj) => {
    if ((obj as any).isLight && !obj.visible) hiddenLights++;
    if ((obj as any).isCamera && !obj.visible) hiddenCams++;
  });
  assert.equal(hiddenLights, 1);
  assert.equal(hiddenCams, 1);

  repo.dispose();
  assert.equal(repo.has('map:farm'), false);
  assert.equal(disposedGeo, 1);
  assert.equal(disposedMat, 1);
});

test('AssetRepository instantiatePrefab positions model, calculates obstacles, and falls back to placeholder on load failure', async () => {
  const catalogData = await import('../public/data/meshCatalog.json', { with: { type: 'json' } });
  const repo = new AssetRepository({
    catalog: catalogData.default as any,
    transport: {
      loadGLTF: async () => {
        throw new Error('Offline simulated error');
      }
    }
  });

  // 1. Lamp (solid obstacle, placeholder fallback)
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
  assert.equal(lampRes.obstacle.radius, 0.36);

  // 2. Flower (walk-through, zero obstacle radius)
  const flowerItem = (catalogData.default as any).items.find((i: any) => i.subCategory === 'flower');
  if (flowerItem) {
    const flowerRes = await repo.instantiatePrefab(flowerItem.id, {
      position: { x: 5, z: 5 }
    });
    assert.ok(flowerRes);
    assert.equal(flowerRes.obstacle, undefined);
  }
});
