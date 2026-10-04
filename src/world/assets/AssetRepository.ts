import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AssetKey, AssetRepositorySeam, AssetPostProcessOptions, PrefabInstanceResult } from './types';
import { prefabCatalog } from './PrefabCatalog';
import type { MeshCatalogItem } from '../../data/meshCatalogTypes';

export class AssetRepository implements AssetRepositorySeam {
  private loader: GLTFLoader | null = null;
  private cache = new Map<AssetKey, THREE.Group>();
  private pending = new Map<AssetKey, Promise<THREE.Group | null>>();

  private getLoader(): GLTFLoader {
    if (!this.loader) {
      this.loader = new GLTFLoader();
    }
    return this.loader;
  }

  private resolveUrl(path: string): string {
    const baseUrl = import.meta.env?.BASE_URL ?? '/';
    return `${baseUrl}${path.startsWith('/') ? path.slice(1) : path}`;
  }

  private getAssetConfig(key: AssetKey): { path: string; options: AssetPostProcessOptions } {
    if (key === 'map:cozy_lake') {
      return {
        path: '3dmodel/maps/cozy_lake.glb',
        options: {
          junkPrefixes: ['cloud', 'psolid', 'pcube', 'psphere', 'pcylinder', 'polysurface', 'box003'],
          levelingNormal: { x: 0.0083827, y: 0.9999342, z: 0.0078334 },
          enableShadows: true,
          isSkinned: false
        }
      };
    }

    if (key === 'map:park') {
      return {
        path: '3dmodel/maps/park.glb',
        options: {
          targetSurfaceArea: 1040, // 26 * 40 m^2 match village area
          enableShadows: true,
          isSkinned: false
        }
      };
    }

    if (key.startsWith('avatar:')) {
      const avatarId = key.replace('avatar:', '');
      return {
        path: `3dmodel/${avatarId}/scene.gltf`,
        options: {
          isSkinned: true,
          enableShadows: true,
          rotationY: avatarId === 'mymelody' ? -Math.PI / 2 : undefined
        }
      };
    }

    if (key.startsWith('prefab:')) {
      const prefabId = key.replace('prefab:', '');
      const item = this.getPrefabItem(prefabId);
      const prefabPath = item?.prefabPath || `3dmodel/prefabs/${prefabId}.glb`;
      return {
        path: prefabPath,
        options: {
          enableShadows: true,
          isSkinned: false
        }
      };
    }

    throw new Error(`Unknown asset key: ${key}`);
  }

  has(key: AssetKey): boolean {
    return this.cache.has(key);
  }

  async loadPrefabCatalog(): Promise<void> {
    if (prefabCatalog.isLoaded()) return;
    const url = this.resolveUrl('data/meshCatalog.json');
    await prefabCatalog.load(url);
  }

  getPrefabItem(id: string): MeshCatalogItem | undefined {
    return prefabCatalog.getItem(id);
  }

  async preload(key: AssetKey): Promise<void> {
    if (this.cache.has(key)) return;
    if (this.pending.has(key)) {
      await this.pending.get(key);
      return;
    }

    if (typeof window === 'undefined') {
      if (key.startsWith('prefab:')) {
        const item = this.getPrefabItem(key.replace('prefab:', ''));
        const placeholder = prefabCatalog.createPlaceholder(item);
        this.cache.set(key, placeholder);
      }
      return;
    }

    const config = this.getAssetConfig(key);
    const url = this.resolveUrl(config.path);

    const promise = new Promise<THREE.Group | null>((resolve) => {
      this.getLoader().load(
        url,
        (gltf) => {
          const raw = gltf.scene;
          this.applyPostProcessing(raw, config.options, key);
          this.cache.set(key, raw);
          this.pending.delete(key);
          resolve(raw);
        },
        undefined,
        (err) => {
          console.warn(`[AssetRepository] Không thể nạp ${key} (${url}):`, err);
          // Fallback tạo placeholder nếu là prefab để không crash game
          if (key.startsWith('prefab:')) {
            const item = this.getPrefabItem(key.replace('prefab:', ''));
            const placeholder = prefabCatalog.createPlaceholder(item);
            this.applyPostProcessing(placeholder, config.options, key);
            this.cache.set(key, placeholder);
            this.pending.delete(key);
            resolve(placeholder);
            return;
          }
          this.pending.delete(key);
          resolve(null);
        }
      );
    });

    this.pending.set(key, promise);
    await promise;
  }

  async instantiate(key: AssetKey): Promise<THREE.Group | null> {
    if (!this.cache.has(key)) {
      await this.preload(key);
    }

    const cached = this.cache.get(key);
    if (!cached) return null;

    const config = this.getAssetConfig(key);
    if (config.options.isSkinned) {
      return SkeletonUtils.clone(cached) as THREE.Group;
    }

    // Static environmental meshes share geometries and materials to conserve VRAM
    return cached.clone(true);
  }

  async instantiatePrefab(
    id: string,
    transform?: {
      position?: { x: number; y?: number; z: number };
      rotationY?: number;
      scale?: number;
    }
  ): Promise<PrefabInstanceResult | null> {
    const key: AssetKey = `prefab:${id}`;
    let item = this.getPrefabItem(id);

    if (!item && !prefabCatalog.isLoaded()) {
      await this.loadPrefabCatalog();
      item = this.getPrefabItem(id);
    }

    let group = await this.instantiate(key);
    if (!group) {
      // Graceful fallback nếu không instantiate được
      group = prefabCatalog.createPlaceholder(item);
    }

    const posX = transform?.position?.x ?? 0;
    const posY = transform?.position?.y ?? 0;
    const posZ = transform?.position?.z ?? 0;
    const rotY = transform?.rotationY ?? 0;
    const scale = transform?.scale ?? 1;

    group.position.set(posX, posY, posZ);
    group.rotation.y = rotY;
    if (scale !== 1) {
      group.scale.setScalar(scale);
    }

    let obstacle: { x: number; z: number; radius: number } | undefined;
    if (item?.isObstacle && item.obstacleRadius > 0) {
      obstacle = {
        x: Number(posX.toFixed(2)),
        z: Number(posZ.toFixed(2)),
        radius: Number((item.obstacleRadius * scale).toFixed(2))
      };
    }

    const resolvedItem: MeshCatalogItem = item || {
      id,
      name: id,
      sourceFile: '',
      category: 'PROP',
      subCategory: 'decor',
      nodePath: [id],
      meshNames: [id],
      primitiveCount: 1,
      vertexCount: 0,
      triangleCount: 0,
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], center: [0, 0.5, 0], size: [1, 1, 1] },
      normalizedBounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], center: [0, 0.5, 0], size: [1, 1, 1] },
      obstacleRadius: 0.5,
      isObstacle: true,
      materials: [],
      tags: []
    };

    return {
      group,
      item: resolvedItem,
      obstacle
    };
  }

  prefetchForPortal(portalId: string): void {
    if (portalId.includes('park') || portalId.includes('village')) {
      if (!this.has('map:park')) {
        void this.preload('map:park');
      }
    }
    if (portalId.includes('lake')) {
      if (!this.has('map:cozy_lake')) {
        void this.preload('map:cozy_lake');
      }
    }
  }

  private applyPostProcessing(model: THREE.Group, options: AssetPostProcessOptions, key: AssetKey): void {
    // 1. Remove unwanted junk prefixes if defined
    if (options.junkPrefixes && options.junkPrefixes.length > 0) {
      const toRemove: THREE.Object3D[] = [];
      model.traverse((child) => {
        const name = (child.name || '').toLowerCase();
        if (options.junkPrefixes!.some((p) => name.startsWith(p))) {
          toRemove.push(child);
        }
      });
      toRemove.forEach((child) => child.parent?.remove(child));
    }

    // 2. Normal leveling (e.g. water plane normal)
    if (options.levelingNormal) {
      const normal = new THREE.Vector3(
        options.levelingNormal.x,
        options.levelingNormal.y,
        options.levelingNormal.z
      ).normalize();
      const levelQuat = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 1, 0));
      model.applyQuaternion(levelQuat);
    }

    // 3. Scaling to match target area
    if (options.targetSurfaceArea) {
      const initialBox = new THREE.Box3().setFromObject(model);
      const initialSize = new THREE.Vector3();
      initialBox.getSize(initialSize);
      const initialRadius = Math.max(initialSize.x, initialSize.z) / 2;
      const initialArea = Math.PI * (initialRadius ** 2);
      if (initialArea > 0) {
        const scaleFactor = Math.sqrt(options.targetSurfaceArea / initialArea);
        model.scale.setScalar(scaleFactor);
      }
    }

    // 4. Calibration rotation
    if (options.rotationY !== undefined) {
      model.rotation.y = options.rotationY;
    }

    // 5. Special rigging for avatars (e.g. Elsa rest arm pose)
    if (key === 'avatar:elsa') {
      model.traverse((c) => {
        if (c.name === 'Bip001_L_UpperArm_060' && (c as THREE.Bone).isBone) {
          c.rotation.y += 0.60;
        }
        if (c.name === 'Bip001_R_UpperArm_070' && (c as THREE.Bone).isBone) {
          c.rotation.y -= 0.60;
        }
      });
    }

    // 6. Shadow traversal
    if (options.enableShadows) {
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.isGLTF = true;
        }
      });
    }

    model.updateMatrixWorld(true);
  }

  dispose(key?: AssetKey): void {
    const disposeGroup = (group: THREE.Group) => {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              this.disposeMaterial(mat);
            });
          } else if (mesh.material) {
            this.disposeMaterial(mesh.material);
          }
        }
      });
    };

    if (key) {
      const item = this.cache.get(key);
      if (item) {
        disposeGroup(item);
        this.cache.delete(key);
      }
    } else {
      for (const item of this.cache.values()) {
        disposeGroup(item);
      }
      this.cache.clear();
      this.pending.clear();
    }
  }

  private disposeMaterial(mat: THREE.Material): void {
    mat.dispose();
    for (const val of Object.values(mat)) {
      if (val && typeof val === 'object' && 'isTexture' in val && (val as THREE.Texture).isTexture) {
        (val as THREE.Texture).dispose();
      }
    }
  }
}
