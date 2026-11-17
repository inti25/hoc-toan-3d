import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { MeshCatalog, MeshCatalogItem } from '../../data/meshCatalogTypes';
import type {
  AssetKey,
  AssetPostProcessOptions,
  AssetRepositorySeam,
  AssetTransportAdapter,
  PrefabInstanceResult
} from './types';

class HeadlessTransportError extends Error {
  constructor() {
    super('Headless environment: browser GLTF transport unavailable');
    this.name = 'HeadlessTransportError';
  }
}

function createBrowserTransport(): AssetTransportAdapter {
  let loader: GLTFLoader | null = null;
  return {
    async loadGLTF(url: string): Promise<THREE.Group> {
      if (typeof window === 'undefined') {
        throw new HeadlessTransportError();
      }
      if (!loader) {
        loader = new GLTFLoader();
      }
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    },
    async fetchCatalog(url: string): Promise<MeshCatalog | null> {
      if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        return null;
      }
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[AssetRepository] Không thể tải catalog từ ${url}: HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as MeshCatalog;
    }
  };
}

export interface AssetRepositoryOptions {
  transport?: AssetTransportAdapter;
  catalog?: MeshCatalog;
  baseUrl?: string;
}

/**
 * Deep module owning all 3D GLTF/GLB asset loading, mesh catalog indexing,
 * post-processing normalization, request deduplication, placeholder fallbacks,
 * and session-wide GPU resource disposal.
 */
export class AssetRepository implements AssetRepositorySeam {
  private readonly transport: AssetTransportAdapter;
  private readonly baseUrl: string;
  private cache = new Map<AssetKey, THREE.Group>();
  private pending = new Map<AssetKey, Promise<THREE.Group | null>>();
  private catalog: MeshCatalog | null = null;
  private catalogItems = new Map<string, MeshCatalogItem>();
  private catalogPending: Promise<MeshCatalog | null> | null = null;

  constructor(options?: AssetRepositoryOptions) {
    this.transport = options?.transport ?? createBrowserTransport();
    const rawBase = options?.baseUrl ?? (import.meta.env?.BASE_URL ?? '/');
    this.baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    if (options?.catalog) {
      this.setCatalog(options.catalog);
    }
  }

  has(key: AssetKey): boolean {
    return this.cache.has(key);
  }

  setCatalog(catalog: MeshCatalog): void {
    this.catalog = catalog;
    this.catalogItems.clear();
    for (const item of catalog.items) {
      this.catalogItems.set(item.id, item);
    }
  }

  async preload(key: AssetKey): Promise<void> {
    if (this.cache.has(key)) return;
    const existing = this.pending.get(key);
    if (existing) {
      await existing;
      return;
    }

    const promise = this.loadAndCache(key);
    this.pending.set(key, promise);
    try {
      await promise;
    } finally {
      this.pending.delete(key);
    }
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
    let item = this.catalogItems.get(id);

    if (!item && !this.catalog) {
      await this.ensureCatalogLoaded();
      item = this.catalogItems.get(id);
    }

    let group = await this.instantiate(key);
    if (!group) {
      group = this.createPlaceholder(item);
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
    if (portalId.includes('farm')) {
      if (!this.has('map:farm')) {
        void this.preload('map:farm');
      }
    }
  }

  dispose(): void {
    for (const group of this.cache.values()) {
      this.disposeGroup(group);
    }
    this.cache.clear();
    this.pending.clear();
  }

  // ─── Private: Loading, Catalog & Post-Processing ──────────────────────────

  private resolveUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path.slice(1) : path}`;
  }

  private async ensureCatalogLoaded(): Promise<MeshCatalog | null> {
    if (this.catalog) return this.catalog;
    if (this.catalogPending) return this.catalogPending;
    if (!this.transport.fetchCatalog) return null;

    this.catalogPending = (async () => {
      try {
        const data = await this.transport.fetchCatalog!(this.resolveUrl('data/meshCatalog.json'));
        if (data) {
          this.setCatalog(data);
        }
        return data;
      } catch (err) {
        if (!(err instanceof HeadlessTransportError)) {
          console.warn('[AssetRepository] Lỗi khi nạp meshCatalog.json:', err);
        }
        return null;
      } finally {
        this.catalogPending = null;
      }
    })();

    return this.catalogPending;
  }

  private async loadAndCache(key: AssetKey): Promise<THREE.Group | null> {
    const config = this.getAssetConfig(key);
    const url = this.resolveUrl(config.path);

    try {
      const raw = await this.transport.loadGLTF(url);
      const processed = this.applyPostProcessing(raw, config.options, key);
      this.cache.set(key, processed);
      return processed;
    } catch (err) {
      if (!(err instanceof HeadlessTransportError)) {
        console.warn(`[AssetRepository] Không thể nạp ${key} (${url}):`, err);
      }
      if (key.startsWith('prefab:')) {
        const item = this.catalogItems.get(key.replace('prefab:', ''));
        const placeholder = this.applyPostProcessing(this.createPlaceholder(item), config.options, key);
        this.cache.set(key, placeholder);
        return placeholder;
      }
      return null;
    }
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

    if (key === 'map:farm') {
      return {
        path: '3dmodel/maps/farm.glb',
        options: {
          hideLightsAndCameras: true,
          enableShadows: true,
          isSkinned: false
        }
      };
    }

    if (key.startsWith('avatar:')) {
      const avatarId = key.replace('avatar:', '');
      return {
        path: `3dmodel/prefabs/char_${avatarId}.glb`,
        options: {
          isSkinned: true,
          enableShadows: true,
          rotationY: avatarId === 'mymelody' ? -Math.PI / 2 : undefined,
          targetHeight: avatarId === 'elsa' ? 3.6 : 2.2,
          centerOnGround: true
        }
      };
    }

    if (key.startsWith('prefab:')) {
      const prefabId = key.replace('prefab:', '');
      const item = this.catalogItems.get(prefabId);
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

  private applyPostProcessing(
    model: THREE.Group,
    options: AssetPostProcessOptions,
    key: AssetKey
  ): THREE.Group {
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

    // 2. Hide embedded lights & cameras in library scenes
    if (options.hideLightsAndCameras) {
      model.traverse((child) => {
        if ((child as any).isLight || (child as any).isCamera) {
          child.visible = false;
        }
      });
    }

    // 3. Normal leveling (e.g. water plane normal)
    if (options.levelingNormal) {
      const normal = new THREE.Vector3(
        options.levelingNormal.x,
        options.levelingNormal.y,
        options.levelingNormal.z
      ).normalize();
      const levelQuat = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 1, 0));
      model.applyQuaternion(levelQuat);
    }

    // 4. Calibration rotation (before bounding-box measurement)
    if (options.rotationY !== undefined) {
      model.rotation.y = options.rotationY;
      model.updateMatrixWorld(true);
    }

    // 5. Special rest rigging for avatars (e.g. Elsa rest arm pose)
    if (key === 'avatar:elsa') {
      model.traverse((c) => {
        if (c.name === 'Bip001_L_UpperArm_060' && (c as THREE.Bone).isBone) {
          c.rotation.y += 0.60;
        }
        if (c.name === 'Bip001_R_UpperArm_070' && (c as THREE.Bone).isBone) {
          c.rotation.y -= 0.60;
        }
      });
      model.updateMatrixWorld(true);
    }

    // 6. Scaling to match target surface area or target height
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
    } else if (options.targetHeight) {
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = options.targetHeight / (size.y > 0 ? size.y : 1);
      model.scale.setScalar(scale);
      model.updateMatrixWorld(true);
    }

    // 7. Shadow traversal
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

    // 8. Center on X/Z and rest base on Y=0 inside a wrapper (keeps root transform clean for animation)
    let result: THREE.Group = model;
    if (options.centerOnGround) {
      const scaledBox = new THREE.Box3().setFromObject(model);
      model.position.x = -(scaledBox.min.x + scaledBox.max.x) / 2;
      model.position.y = -scaledBox.min.y;
      model.position.z = -(scaledBox.min.z + scaledBox.max.z) / 2;

      const wrapper = new THREE.Group();
      wrapper.add(model);
      wrapper.userData.isGLTF = true;
      if (key === 'avatar:cinnamoroll') {
        this.attachCinnamorollFace(wrapper);
      }
      result = wrapper;
    }

    result.updateMatrixWorld(true);
    return result;
  }

  private attachCinnamorollFace(wrapper: THREE.Group): void {
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.5 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });

    const geomEye = new THREE.SphereGeometry(0.08, 12, 12);
    geomEye.scale(0.85, 1.1, 0.4);
    const geomShine = new THREE.SphereGeometry(0.028, 8, 8);
    const geomBlush = new THREE.SphereGeometry(0.1, 12, 12);
    geomBlush.scale(1.3, 0.65, 0.3);
    const geomNose = new THREE.SphereGeometry(0.03, 8, 8);
    geomNose.scale(1.2, 0.7, 0.5);

    const leftEye = new THREE.Mesh(geomEye, eyeMat);
    leftEye.position.set(-0.24, 1.48, 0.48);
    const leftShine = new THREE.Mesh(geomShine, shineMat);
    leftShine.position.set(-0.21, 1.51, 0.51);

    const rightEye = new THREE.Mesh(geomEye, eyeMat);
    rightEye.position.set(0.24, 1.48, 0.48);
    const rightShine = new THREE.Mesh(geomShine, shineMat);
    rightShine.position.set(0.27, 1.51, 0.51);

    const leftBlush = new THREE.Mesh(geomBlush, blushMat);
    leftBlush.position.set(-0.38, 1.38, 0.44);
    const rightBlush = new THREE.Mesh(geomBlush, blushMat);
    rightBlush.position.set(0.38, 1.38, 0.44);

    const nose = new THREE.Mesh(geomNose, noseMat);
    nose.position.set(0, 1.42, 0.50);

    const faceGroup = new THREE.Group();
    faceGroup.add(leftEye, leftShine, rightEye, rightShine, leftBlush, rightBlush, nose);
    faceGroup.traverse((child) => {
      child.userData.isGLTF = true;
    });
    wrapper.add(faceGroup);
  }

  private createPlaceholder(item?: Partial<MeshCatalogItem>): THREE.Group {
    const group = new THREE.Group();
    const size = item?.normalizedBounds?.size || [1, 2, 1];
    const [w, h, d] = size;
    const cat = item?.category;

    if (cat === 'FOLIAGE') {
      const isTreeOrPine = item?.subCategory === 'tree' || item?.subCategory === 'pine';
      if (isTreeOrPine) {
        const trunkGeo = new THREE.CylinderGeometry(w * 0.1, w * 0.15, h * 0.4, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = h * 0.2;
        group.add(trunk);

        const foliageGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.5, h * 0.7, 7);
        const foliageMat = new THREE.MeshLambertMaterial({
          color: item?.subCategory === 'pine' ? 0x1b5e20 : 0x2e7d32
        });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = h * 0.65;
        group.add(foliage);
      } else {
        const bushGeo = new THREE.SphereGeometry(Math.max(w, d) * 0.5, 6, 5);
        const bushMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.y = h * 0.5;
        group.add(bush);
      }
    } else if (cat === 'OBSTACLE') {
      const rockRadius = Math.max(w, d, h) * 0.45;
      const rockGeo = new THREE.DodecahedronGeometry(rockRadius, 0);
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x78909c, flatShading: true });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.y = rockRadius;
      group.add(rock);
    } else {
      const boxGeo = new THREE.BoxGeometry(w, h, d);
      const boxMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = h * 0.5;
      group.add(box);
    }

    return group;
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => this.disposeMaterial(mat));
        } else if (mesh.material) {
          this.disposeMaterial(mesh.material);
        }
      }
    });
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
