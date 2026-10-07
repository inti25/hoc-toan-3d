import type { World } from '../world/World';

export interface WorldLaunchOptions {
  canvas: HTMLCanvasElement;
  avatar: any;
  bridge: number;
  flowers: boolean[];
  monolithChecker: (id: string | number, index: number) => boolean;
  parkTrees: boolean[];
  initialPosition?: { x: number; z: number } | null;
  onTeleport?: (x: number, z: number) => void;
  onJump?: () => void;
  onSceneClick?: () => void;
  onFlowerClick?: (idx: number) => void;
  onMonolithClick?: (idx: number) => void;
  onParkTreeClick?: (idx: number) => void;
  onPortalClick?: () => void;
  onShopClick?: () => void;
  equippedTrail?: string;
  onFrame?: (
    isNear: boolean,
    crossed: boolean,
    fps: number,
    nearFlowerIdx: number,
    isNearPortal: boolean,
    nearMonolithIdx: number,
    nearParkTreeIdx: number,
    isNearShop: boolean
  ) => void;
}

export interface WorldLoaderSeam {
  preload(): Promise<void>;
  launch(options: WorldLaunchOptions): Promise<World>;
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
}
