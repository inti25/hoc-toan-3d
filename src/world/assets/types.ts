import type * as THREE from 'three';

export type AssetKey =
  | 'map:park'
  | 'map:cozy_lake'
  | `avatar:${string}`;

export interface AssetPostProcessOptions {
  /** Remove unwanted/junk objects matching name prefixes */
  junkPrefixes?: string[];
  /** Level surface normal to face upright (0, 1, 0) */
  levelingNormal?: { x: number; y: number; z: number };
  /** Target surface area to scale model against (in m^2) */
  targetSurfaceArea?: number;
  /** Enable castShadow and receiveShadow for all child meshes */
  enableShadows?: boolean;
  /** Calibration Y rotation in radians */
  rotationY?: number;
  /** Whether the model contains skinned bones (requires SkeletonUtils) */
  isSkinned?: boolean;
}

export interface AssetRepositorySeam {
  /** Preloads 3D asset into memory cache */
  preload(key: AssetKey): Promise<void>;

  /** Creates or clones an optimized instance ready for scene graph */
  instantiate(key: AssetKey): Promise<THREE.Group | null>;

  /** Automatic proximity prefetching when approaching a portal */
  prefetchForPortal(portalId: string): void;

  /** Checks if asset is already cached */
  has(key: AssetKey): boolean;

  /** Disposes GPU resources (geometries, textures, materials) */
  dispose(key?: AssetKey): void;
}
