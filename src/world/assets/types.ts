import type * as THREE from 'three';
import type { MeshCatalog, MeshCatalogItem } from '../../data/meshCatalogTypes';

export type AssetKey =
  | 'map:park'
  | 'map:cozy_lake'
  | 'map:farm'
  | 'map:farm_world'
  | 'map:qhmj'
  | `avatar:${string}`
  | `prefab:${string}`;

export interface PrefabInstanceResult {
  group: THREE.Group;
  item: MeshCatalogItem;
  obstacle?: { x: number; z: number; radius: number };
}

export interface AssetPostProcessOptions {
  /** Remove unwanted/junk objects matching name prefixes */
  junkPrefixes?: string[];
  /** Hide embedded lights and cameras inside library scenes */
  hideLightsAndCameras?: boolean;
  /** Level surface normal to face upright (0, 1, 0) */
  levelingNormal?: { x: number; y: number; z: number };
  /** Target surface area to scale model against (in m^2) */
  targetSurfaceArea?: number;
  /** Target vertical height in meters (uniformly scales model) */
  targetHeight?: number;
  /** Center X/Z at 0 and rest base on Y=0 inside a wrapper group */
  centerOnGround?: boolean;
  /** Enable castShadow and receiveShadow for all child meshes */
  enableShadows?: boolean;
  /** Calibration Y rotation in radians */
  rotationY?: number;
  /** Whether the model contains skinned bones (requires SkeletonUtils) */
  isSkinned?: boolean;
}

export interface AssetTransportAdapter {
  loadGLTF(url: string): Promise<THREE.Group>;
  fetchCatalog?(url: string): Promise<MeshCatalog | null>;
}

export interface AssetRepositorySeam {
  /** Preloads 3D asset into memory cache */
  preload(key: AssetKey): Promise<void>;

  /** Creates or clones an optimized instance ready for scene graph */
  instantiate(key: AssetKey): Promise<THREE.Group | null>;

  /** Registers an already-parsed 3D mesh catalog */
  setCatalog(catalog: MeshCatalog): void;

  /** Instantiates and positions a prefab alongside auto-calculated collision obstacle */
  instantiatePrefab(
    id: string,
    transform?: {
      position?: { x: number; y?: number; z: number };
      rotationY?: number;
      scale?: number;
    }
  ): Promise<PrefabInstanceResult | null>;

  /** Automatic proximity prefetching when approaching a portal */
  prefetchForPortal(portalId: string, targetTemplate?: string): void;

  /** Checks if asset is already cached */
  has(key: AssetKey): boolean;

  /** Disposes all cached GPU resources (geometries, textures, materials) at session teardown */
  dispose(): void;
}
