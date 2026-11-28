import {
  fetchRemoteData,
  getAppsScriptUrl,
  getCachedRemoteData,
  isZoneVisible,
  loadZonesAndQuestions,
  resolveZoneProblemsWithPositions
} from '../core/sheetsClient';
import type { RemoteProblem, RemoteZoneConfig } from '../data/remoteTypes';
import type {
  RemoteContentPayload,
  RemoteContentSnapshot,
  WorldHandle,
  WorldLaunchOptions,
  WorldSessionPorts
} from './types';

export type ZoneTemplateKind = 'flower' | 'park' | 'farm' | 'farm_race' | 'qhmj' | 'monolith';

/**
 * Single source of truth classifying how a zone renders its challenges.
 */
export function classifyZoneTemplate(zone: Pick<RemoteZoneConfig, 'id' | 'template' | 'sheetName'>): ZoneTemplateKind {
  if (zone.template === 'FLOWER_BEDS' || zone.id === 6 || zone.sheetName === 'VuonHoa') {
    return 'flower';
  }
  if (zone.template === 'PARK_SANCTUARY' || zone.id === 7 || zone.sheetName === 'CongVienXanh') {
    return 'park';
  }
  if (zone.template === 'FARM_RACE') {
    return 'farm_race';
  }
  if (zone.template === 'FARM_SANCTUARY') {
    return 'farm';
  }
  if (zone.template === 'QHMJ_SANCTUARY') {
    return 'qhmj';
  }
  return 'monolith';
}

export function zoneSpawnsMonoliths(zone: Pick<RemoteZoneConfig, 'id' | 'template' | 'sheetName'>): boolean {
  return classifyZoneTemplate(zone) === 'monolith';
}

export function zoneCountsForBadges(zone: Pick<RemoteZoneConfig, 'id' | 'template' | 'sheetName'>): boolean {
  return classifyZoneTemplate(zone) !== 'flower';
}

/**
 * Deep module owning the 3D engine lifecycle, Unified Batch Ingestion,
 * zone classification, and Deferred Spawn coordination.
 */
export class WorldSession {
  private modulePromise: Promise<{ World: new (canvas: HTMLCanvasElement) => WorldHandle }> | null = null;
  private bootSyncPromise: Promise<RemoteContentSnapshot> | null = null;
  private _isLoaded = false;
  private _isLoading = false;
  private _world: WorldHandle | null = null;

  private _zones: RemoteZoneConfig[] = [];
  private _questionsBySheet: Record<string, RemoteProblem[]> = {};
  private _monolithProblems: RemoteProblem[] = [];
  private _badgeZones: RemoteZoneConfig[] = [];
  private deferredSpawnPosition: { x: number; y?: number; z: number } | null = null;

  private readonly importWorld: () => Promise<{ World: new (canvas: HTMLCanvasElement) => WorldHandle }>;
  private readonly loadZones: (onFreshData?: (data: RemoteContentPayload) => void) => Promise<RemoteContentPayload>;
  private readonly fetchRemote: (scriptUrl: string) => Promise<RemoteContentPayload | null>;
  private readonly resolveScriptUrl: () => string;
  private readonly readCache: () => { data: RemoteContentPayload | null; isExpired: boolean; cachedAt: number };

  constructor(private readonly ports: WorldSessionPorts) {
    this.importWorld = ports.importWorldModule ?? (() => import('../world/World') as Promise<any>);
    this.loadZones = ports.loadZonesAndQuestions ?? loadZonesAndQuestions;
    this.fetchRemote = ports.fetchRemoteData ?? fetchRemoteData;
    this.resolveScriptUrl = ports.getAppsScriptUrl ?? getAppsScriptUrl;
    this.readCache = ports.getCachedRemoteData ?? getCachedRemoteData;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get world(): WorldHandle | null {
    return this._world;
  }

  get zones(): RemoteZoneConfig[] {
    return this._zones;
  }

  get questionsBySheet(): Record<string, RemoteProblem[]> {
    return this._questionsBySheet;
  }

  get monolithProblems(): RemoteProblem[] {
    return this._monolithProblems;
  }

  get badgeZones(): RemoteZoneConfig[] {
    return this._badgeZones;
  }

  get hasPendingDeferredSpawn(): boolean {
    return this.deferredSpawnPosition !== null;
  }

  clearDeferredSpawn(): void {
    this.deferredSpawnPosition = null;
  }

  getQuestionsForSheet(sheetName: string): RemoteProblem[] {
    const existing = this._questionsBySheet[sheetName];
    if (existing && existing.length > 0) {
      return existing;
    }
    const cached = this.readCache().data;
    const cachedList = cached?.questionsBySheet?.[sheetName];
    if (cachedList && cachedList.length > 0) {
      this._questionsBySheet[sheetName] = cachedList;
      return cachedList;
    }
    return existing || [];
  }

  /**
   * Preloads the 3D Engine chunk in the background without blocking the App Shell.
   */
  preloadEngine(): Promise<void> {
    if (this._isLoaded && this.modulePromise) {
      return Promise.resolve();
    }

    if (!this.modulePromise) {
      this._isLoading = true;
      this.modulePromise = this.importWorld()
        .then((m) => {
          this._isLoaded = true;
          this._isLoading = false;
          return m;
        })
        .catch((err) => {
          this.modulePromise = null;
          this._isLoaded = false;
          this._isLoading = false;
          throw err;
        });
    }

    return this.modulePromise.then(() => undefined);
  }

  /**
   * Runs Unified Batch Ingestion once at boot (deduplicating concurrent callers).
   */
  bootSync(): Promise<RemoteContentSnapshot> {
    if (!this.bootSyncPromise) {
      this.bootSyncPromise = (async () => {
        const data = await this.loadZones((fresh) => {
          void this.applyRemotePayload(fresh, 'fresh');
        });
        return this.applyRemotePayload(data, 'boot');
      })().catch((err) => {
        this.bootSyncPromise = null;
        throw err;
      });
    }
    return this.bootSyncPromise;
  }

  /**
   * Forces an immediate remote fetch (Manual Hot Sync) and applies fresh data.
   */
  async refreshFromRemote(): Promise<RemoteContentSnapshot | null> {
    const url = this.resolveScriptUrl().trim();
    if (!url) {
      throw new Error('Chưa cấu hình URL Google Apps Script');
    }
    const fresh = await this.fetchRemote(url);
    if (!fresh) return null;
    const snapshot = await this.applyRemotePayload(fresh, 'manual');
    this.bootSyncPromise = Promise.resolve(snapshot);
    return snapshot;
  }

  /**
   * Filters visible zones, resolves monolith positions, reconciles progress,
   * updates the 3D World if launched, and completes any waiting Deferred Spawn.
   */
  async applyRemotePayload(
    data: RemoteContentPayload,
    source: 'boot' | 'fresh' | 'manual' = 'boot'
  ): Promise<RemoteContentSnapshot> {
    const visibleZones = data.zones.filter((z) => isZoneVisible(z));
    const monolithProblems: RemoteProblem[] = [];

    visibleZones.forEach((z) => {
      if (!zoneSpawnsMonoliths(z)) return;
      const list = data.questionsBySheet[z.sheetName] || [];
      monolithProblems.push(...resolveZoneProblemsWithPositions(z, list));
    });

    this._zones = visibleZones;
    this._questionsBySheet = { ...data.questionsBySheet };
    this._monolithProblems = monolithProblems;
    this._badgeZones = visibleZones.filter((z) => zoneCountsForBadges(z));

    const changed = this.ports.adventure.reconcileZoneProgress(data.zones, data.questionsBySheet);
    if (changed) {
      this.ports.onSyncQueue?.(false);
    }

    if (this._world) {
      await this.syncPayloadIntoWorld(this._world);
    }

    const snapshot: RemoteContentSnapshot = {
      zones: this._zones,
      questionsBySheet: this._questionsBySheet,
      monolithProblems: this._monolithProblems,
      badgeZones: this._badgeZones
    };
    this.ports.onContentUpdated?.(snapshot, source);
    return snapshot;
  }

  /**
   * Launches the 3D World engine once, wires progression state & callbacks,
   * and schedules or resolves Deferred Spawn.
   */
  async launch(options: WorldLaunchOptions): Promise<WorldHandle> {
    if (this._world) {
      return this._world;
    }

    await this.preloadEngine();
    const { World } = await this.modulePromise!;

    const world = new World(options.canvas);
    const state = this.ports.adventure.getState();

    world.setBridge(state.bridge);
    world.setFlowersBloomed(state.flowers);
    world.setMonolithsActivated((id) => this.isMonolithDone(id));
    world.setAvatar(state.avatar);
    world.syncAwakenedParkTrees(state.parkTrees || []);
    world.setFarmRescued?.(state.farmRescued || {});
    if (state.equippedTrail) {
      world.setEquippedTrail(state.equippedTrail);
    }
    world.isParkTreeAwakened = (idx) => this.ports.adventure.isParkTreeAwakened(idx);
    world.isQhmjNodeSolved = (progressKey) => this.ports.adventure.isProblemSolved(progressKey);

    if (options.onTeleport) world.onTeleport = options.onTeleport;
    if (options.onJump) world.onJump = options.onJump;
    if (options.onSceneClick) world.onSceneClick = options.onSceneClick;
    if (options.onFlowerClick) world.onFlowerClick = options.onFlowerClick;
    if (options.onMonolithClick) world.onMonolithClick = options.onMonolithClick;
    if (options.onParkTreeClick) world.onParkTreeClick = options.onParkTreeClick;
    if (options.onPortalClick) world.onPortalClick = options.onPortalClick;
    if (options.onShopClick) world.onShopClick = options.onShopClick;
    if (options.onFarmAnimalClick) world.onFarmAnimalClick = options.onFarmAnimalClick;
    if (options.onFarmRaceCheckpointTrigger) world.onFarmRaceCheckpointTrigger = options.onFarmRaceCheckpointTrigger;
    if (options.onFarmRaceFinished) world.onFarmRaceFinished = options.onFarmRaceFinished;
    if (options.onFarmRaceFinishBlocked) world.onFarmRaceFinishBlocked = options.onFarmRaceFinishBlocked;
    if (options.onQhmjNodeClick) world.onQhmjNodeClick = options.onQhmjNodeClick;
    if (options.onFrame) world.onFrame = options.onFrame;

    if (options.initialPosition) {
      const safe = world.spatial.resolveSafeSpawn(options.initialPosition.x, options.initialPosition.z);
      if (safe) {
        await world.activateRegionAt?.(safe.x, safe.z);
        world.setInitialPosition(safe.x, safe.z, options.initialPosition.y);
        if (safe.x !== options.initialPosition.x || safe.z !== options.initialPosition.z) {
          this.ports.adventure.savePosition(safe.x, safe.z, options.initialPosition.y);
          options.onTeleport?.(safe.x, safe.z);
        }
      } else {
        this.deferredSpawnPosition = { ...options.initialPosition };
      }
    }

    this._world = world;

    if (this._zones.length > 0) {
      await this.syncPayloadIntoWorld(world);
    }

    return world;
  }

  private isMonolithDone(id: number | string): boolean {
    const state = this.ports.adventure.getState();
    return (
      this.ports.adventure.isProblemSolved(id) ||
      (typeof id === 'number' &&
        id >= 306 &&
        id < 306 + state.monoliths.length &&
        state.monoliths[id - 306] === true)
    );
  }

  private async syncPayloadIntoWorld(world: WorldHandle): Promise<void> {
    await world.renderDynamicZones(
      this._zones,
      this._monolithProblems.map((p) => ({
        id: p.id,
        position: p.position!,
        color: p.color,
        title: p.title
      })),
      this._questionsBySheet
    );

    world.setMonolithsActivated((id) => this.isMonolithDone(id));

    if (this.deferredSpawnPosition) {
      const safe = world.spatial.resolveSafeSpawn(this.deferredSpawnPosition.x, this.deferredSpawnPosition.z);
      if (safe) {
        const savedY = this.deferredSpawnPosition.y;
        await world.activateRegionAt?.(safe.x, safe.z);
        world.teleport(safe.x, safe.z, savedY);
        this.ports.adventure.savePosition(safe.x, safe.z, world.player.position.y);
        this.deferredSpawnPosition = null;
        this.ports.onDeferredSpawn?.(safe);
      }
    }
  }
}
