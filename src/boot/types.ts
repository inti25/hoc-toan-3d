import type { AvatarId } from '../data/characters';
import type { RemoteProblem, RemoteZoneConfig } from '../data/remoteTypes';
import type { SaveState } from '../core/state';
import type { WorldFrameSnapshot } from '../world/loop/types';

export interface RemoteContentPayload {
  zones: RemoteZoneConfig[];
  questionsBySheet: Record<string, RemoteProblem[]>;
}

export interface RemoteContentSnapshot {
  zones: RemoteZoneConfig[];
  questionsBySheet: Record<string, RemoteProblem[]>;
  monolithProblems: RemoteProblem[];
  badgeZones: RemoteZoneConfig[];
}

/**
 * Minimal runtime seam satisfied by `World` in production and fake world adapters in Node tests.
 */
export interface WorldHandle {
  active: boolean;
  paused: boolean;
  equippedTrail: string;
  readonly keys: Set<string>;
  joystick: { x: number; y: number };
  readonly player: { position: { x: number; y: number; z: number } };
  readonly portalPos: { x: number; y: number; z: number };
  readonly spatial: {
    resolveSafeSpawn(x: number, z: number): { x: number; z: number } | null;
    getCurrentLocationName(): string;
    getNearPortal(): { id: string; name: string; requiresSelection?: boolean; source: { x: number; z: number } } | null;
  };
  readonly assets: {
    prefetchForPortal(portalId: string): void;
  };
  readonly farmSanctuary?: {
    animals: Array<{ id: string; kind: string; state: string; root: { position: { x: number; y: number; z: number } } }>;
    getInteractTriggers(): Array<{ animalId: string; isActive: boolean; problemData?: any }>;
  } | null;
  readonly flowers: Array<{ position: { x: number; y: number; z: number } }>;
  readonly parkTrees: Array<{ position: { x: number; y: number; z: number } }>;

  setBridge(count: number, animate?: boolean): void;
  setFlowersBloomed(bloomedList: boolean[]): void;
  setMonolithsActivated(
    checker:
      | boolean[]
      | ((id: number | string, index: number) => boolean)
      | { monoliths?: boolean[]; solvedProblems?: Record<string, boolean> }
  ): void;
  setAvatar(avatarId: AvatarId): void;
  syncAwakenedParkTrees(awakenedList: boolean[]): void;
  setFarmRescued?(rescued: Record<string, boolean>): void;
  setEquippedTrail(trailId: string): void;
  setInitialPosition(x: number, z: number): void;
  teleport(x: number, z: number): void;
  renderDynamicZones(
    zones: RemoteZoneConfig[],
    positionedMonoliths?: Array<{ id: number | string; position: { x: number; z: number }; color?: number; title?: string }>,
    questionsBySheet?: Record<string, RemoteProblem[]>
  ): Promise<void> | void;
  burstPlayer(offsetY?: number): void;
  jump(): void;
  clearInput(): void;
  resetCamera(): void;
  project(point: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
  bloomFlower(index: number): void;
  activateMonolith(ref: number | string): void;
  wakeParkTree(index: number): void;

  onTeleport?: (x: number, z: number) => void;
  onJump?: () => void;
  onSceneClick?: (near: boolean) => void;
  onFlowerClick?: (index: number) => void;
  onMonolithClick?: (index: number, id?: number | string) => void;
  onParkTreeClick?: (index: number) => void;
  onPortalClick?: () => void;
  onShopClick?: () => void;
  onFarmAnimalClick?: (animalId: string) => void;
  isParkTreeAwakened?: (index: number) => boolean;
  onFrame?: (snapshot: WorldFrameSnapshot) => void;
}

export interface WorldLaunchOptions {
  canvas: HTMLCanvasElement;
  initialPosition?: { x: number; z: number } | null;
  onTeleport?: (x: number, z: number) => void;
  onJump?: () => void;
  onSceneClick?: () => void;
  onFlowerClick?: (idx: number) => void;
  onMonolithClick?: (idx: number, id?: number | string) => void;
  onParkTreeClick?: (idx: number) => void;
  onPortalClick?: () => void;
  onShopClick?: () => void;
  onFarmAnimalClick?: (animalId: string) => void;
  onFrame?: WorldHandle['onFrame'];
}

export interface WorldSessionAdventurePort {
  getState(): SaveState;
  isProblemSolved(id: number | string): boolean;
  isParkTreeAwakened(index: number): boolean;
  reconcileZoneProgress(zones: RemoteZoneConfig[], questionsBySheet: Record<string, RemoteProblem[]>): boolean;
  savePosition(x: number, z: number): void;
}

export interface WorldSessionPorts {
  adventure: WorldSessionAdventurePort;
  importWorldModule?: () => Promise<{ World: new (canvas: HTMLCanvasElement) => WorldHandle }>;
  loadZonesAndQuestions?: (onFreshData?: (data: RemoteContentPayload) => void) => Promise<RemoteContentPayload>;
  fetchRemoteData?: (scriptUrl: string) => Promise<RemoteContentPayload | null>;
  getAppsScriptUrl?: () => string;
  getCachedRemoteData?: () => { data: RemoteContentPayload | null; isExpired: boolean; cachedAt: number };
  onSyncQueue?: (isMilestone: boolean) => void;
  onContentUpdated?: (snapshot: RemoteContentSnapshot, source: 'boot' | 'fresh' | 'manual') => void;
  onDeferredSpawn?: (pos: { x: number; z: number }) => void;
}
