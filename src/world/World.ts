import * as THREE from 'three';
import { AssetRepository } from './assets/AssetRepository';
import { BRIDGE_PARTS, WORLD } from '../data/config';
import { type AvatarId } from '../data/characters';
import { FLOWER_QUESTIONS } from '../data/flowerQuestions';
import { SpatialWorld, type PortalLink } from './SpatialWorld';
import { PlayerAvatar } from './PlayerAvatar';
import { SceneBatchPool, type StaticPlacement } from './SceneBatchPool';
import {
  ArchimedesZoneBuilder,
  allocateDynamicHubPortalSlot,
  computePortalPillarObstacles,
  isWithinPortalKeepOut,
  type MonolithItem,
  type Obstacle
} from './ArchimedesZoneBuilder';
import {
  computeZonePortalAnchors,
  sanitizeZoneEntityPosition,
  type RemoteZoneConfig,
  type RemoteProblem
} from '../data/remoteTypes';
import {
  LAKE_SCALE,
  LAKE_MODEL_CENTER,
  LAKE_FALLBACK_RADIUS,
  computeLakeAnchors,
  computeLakeEntityPositions,
  lakeRotationForZone,
  usesLakeTerrain
} from '../data/lakeLand';
import { proceduralLandBuilder } from './procedural/ProceduralLandBuilder';
import { FarmSanctuary } from './farm/FarmSanctuary';
import type { PortalSummary, WorldFrameSnapshot } from './loop/types';
import { buildQhmjRegion, syncQhmjSolvedState, updateQhmjAnimation, type QhmjRegionBuild } from './qhmj/QhmjRegion';
import type { QhmjNodeSpec } from './qhmj/QhmjLayout';
import { generateQhmjProblems } from '../core/qhmjQuestions';
import {
  QHMJ_REGION_RADIUS,
  QHMJ_VILLAGE_PORTAL,
  QHMJ_VILLAGE_RETURN_TARGET,
  computeQhmjAnchors
} from '../data/qhmjMap';
import {
  FARM_CAMERA_DEFAULTS,
  FARM_REGION_RADIUS,
  FARM_VILLAGE_PORTAL,
  FARM_VILLAGE_RETURN_TARGET,
  computeFarmAnchors
} from '../data/farmMap';
import {
  PinchOrbitController,
  computePinchZoomDistance,
  computeWheelZoomDistance
} from './cameraZoom';

export { type MonolithItem, ArchimedesZoneBuilder };

export const STATIC_LAKE_SANCTUARIES: ReadonlyArray<{
  id: number;
  center: { x: number; z: number };
  template: 'GRID_SANCTUARY' | 'CIRCLE_SANCTUARY';
}> = [
  { id: 1, center: { x: 110, z: -60 }, template: 'GRID_SANCTUARY' },
  { id: 2, center: { x: 150, z: -60 }, template: 'GRID_SANCTUARY' },
  { id: 3, center: { x: 110, z: 60 }, template: 'CIRCLE_SANCTUARY' },
  { id: 4, center: { x: 150, z: 60 }, template: 'GRID_SANCTUARY' },
  { id: 5, center: { x: 190, z: 0 }, template: 'CIRCLE_SANCTUARY' }
];

export function shouldRunRenderLoop(active: boolean, paused: boolean, hidden = false): boolean {
  return active && !paused && !hidden;
}

export function selectLakeSanctuariesToLoad(
  playerX: number,
  activeZoneIds: ReadonlySet<number>,
  loadedIds: ReadonlySet<number>
) {
  if (playerX <= 35) return [];
  return STATIC_LAKE_SANCTUARIES.filter(
    (s) => activeZoneIds.has(s.id) && !loadedIds.has(s.id)
  );
}

/**
 * Builds portal links connecting Starter Village to dynamic FARM_SANCTUARY zones.
 */
export function buildFarmPortalLinks(farmZones: RemoteZoneConfig[]): PortalLink[] {
  if (farmZones.length === 0) return [];
  const portals: PortalLink[] = [];
  const firstAnchors = computeFarmAnchors(farmZones[0].center);

  if (farmZones.length === 1) {
    const fz = farmZones[0];
    portals.push({
      id: 'village_to_farm',
      name: fz.name ? `Đến ${fz.name}` : 'Cổng Nông Trại',
      source: { ...FARM_VILLAGE_PORTAL },
      target: { x: firstAnchors.spawn.x, z: firstAnchors.spawn.z },
      triggerRadius: 1.85,
      targetRegionId: `zone:${fz.id}`
    });
  } else {
    portals.push({
      id: 'village_to_multi_farm',
      name: 'Cổng Nông Trại',
      source: { ...FARM_VILLAGE_PORTAL },
      target: { x: firstAnchors.spawn.x, z: firstAnchors.spawn.z },
      triggerRadius: 1.85,
      targetRegionId: `zone:${farmZones[0].id}`
    });
  }

  for (const z of farmZones) {
    const anchors = computeFarmAnchors(z.center);
    portals.push({
      id: `z${z.id}_to_village_farm`,
      name: 'Về Làng Khởi Đầu',
      source: { x: anchors.returnPortal.x, z: anchors.returnPortal.z },
      target: { ...FARM_VILLAGE_RETURN_TARGET },
      triggerRadius: 1.85,
      targetRegionId: 'core'
    });
  }

  return portals;
}

export interface FlowerItem {
  id: number;
  position: THREE.Vector3;
  group: THREE.Group;
  bud: THREE.Group;
  bloom: THREE.Group;
  beacon: THREE.Mesh;
  bloomed: boolean;
  bloomAnim: number;
  animating: boolean;
}

export interface ParkTreeEntity {
  index: number;
  id: number;
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material;
  grayMaterial: THREE.Material;
  coloredMaterial?: THREE.Material;
  position: THREE.Vector3;
  beacon?: THREE.Mesh;
  topY: number;
  awakened: boolean;
  hasQuestion: boolean;
  questionColor?: number;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, .1, 480);
  readonly player = new THREE.Group();
  readonly avatar: PlayerAvatar;
  readonly milo = new THREE.Group();
  readonly bridge = new THREE.Group();
  readonly flowers: FlowerItem[] = [];
  readonly archimedes: ArchimedesZoneBuilder;
  public farmSanctuary: FarmSanctuary | null = null;
  private farmRescued: Record<string, boolean> = {};
  private latestFarmQuestions?: RemoteProblem[];
  readonly goal = new THREE.Vector3(16, 0, 0);
  readonly keys = new Set<string>();
  readonly spatial = new SpatialWorld(-6, 6);
  private geom = new SceneBatchPool();
  private obstacles: Obstacle[] = [];
  private rippleMesh!: THREE.InstancedMesh;
  private rippleSlots: Array<{ x: number; z: number; sx: number }> = [];
  private cloudMesh!: THREE.InstancedMesh;
  private cloudGroupX: number[] = [];
  private cloudSlots: Array<{ groupIdx: number; ox: number; oy: number; oz: number; sx: number; sy: number; sz: number }> = [];
  private disposableInstancedMeshes: THREE.InstancedMesh[] = [];
  private miloBeacon?: THREE.Mesh;
  private lastPrefetchedPortalKey = '';
  private readonly instDummy = new THREE.Object3D();
  private readonly scratchWanted = new THREE.Vector3();
  private readonly scratchProj = new THREE.Vector3();
  private readonly scratchRay = new THREE.Raycaster();
  private readonly scratchPointer = new THREE.Vector2();
  private readonly scratchRayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly scratchHit = new THREE.Vector3();
  private readonly scratchLocalHit = new THREE.Vector3();
  private readonly shopWorldPos = new THREE.Vector3(-12.4, 0, -3.5);
  private windmill = new THREE.Group();
  private water: THREE.Mesh;
  private clock = new THREE.Clock();
  private target = new THREE.Vector3(-5, 1.35, 0);
  private jumpVelocity = 0;
  private yaw = .57;
  private pitch = .42;
  private distance = 13.5;
  private bridgeCount = 0;
  private time = 0;
  private observer: ResizeObserver;
  private frame = 0;
  private idleFrame = 0;
  private _active = false;
  private _paused = false;
  private hudFrameTick = 0;
  private pendingPortalTransit: PortalSummary | null = null;
  joystick = { x: 0, y: 0 };
  onFrame?: (snapshot: WorldFrameSnapshot) => void;
  onJump?: () => void;
  onSceneClick?: (near: boolean) => void;
  onFlowerClick?: (index: number) => void;
  onMonolithClick?: (index: number, id?: number | string) => void;
  onParkTreeClick?: (index: number) => void;
  onPortalClick?: () => void;
  onShopClick?: () => void;
  onFarmAnimalClick?: (animalId: string) => void;
  onQhmjNodeClick?: (zoneId: number, nodeIndex: number) => void;
  onTeleport?: (x: number, z: number) => void;
  isParkTreeAwakened?: (index: number) => boolean;
  isQhmjNodeSolved?: (progressKey: string) => boolean;
  private shopBeacon?: THREE.Mesh;
  private trailTimer = 0;
  equippedTrail = '';
  readonly parkTrees: ParkTreeEntity[] = [];
  readonly parkModels: Map<number, THREE.Group> = new Map();
  readonly lakeModels: Map<number, THREE.Group> = new Map();
  private lakeFallbackDiscs: Map<number, THREE.Object3D> = new Map();
  private sanctuaryLandmarkGroups: Map<number, THREE.Group> = new Map();
  private hubTrailGroups: Map<number, THREE.Group> = new Map();
  private dynamicIslandGroups: Map<number, THREE.Object3D[]> = new Map();
  private dynamicPortalArches: Map<number, THREE.Group[]> = new Map();
  private activeZoneIds: Set<number> = new Set([1, 2, 3, 4, 5]);
  readonly assets = new AssetRepository();
  private readonly FIXED_DT = 1 / 60;
  private readonly MAX_SUB_STEPS = 3;
  private accumulator = 0;
  private villageParkPortalArch?: THREE.Group;
  private villageFarmPortalArch?: THREE.Group;
  readonly portalPos = new THREE.Vector3(32, 0, 0);
  private readonly coreRegionGroup = new THREE.Group();
  private readonly hubRegionGroup = new THREE.Group();
  private readonly zoneRegionGroups = new Map<number, THREE.Group>();
  private activeRegionId = 'core';
  private activeMountedGroup: THREE.Group;
  private readonly loadedZoneRegions = new Set<number>();
  private readonly pendingZoneLoads = new Map<number, Promise<void>>();
  private dynamicZones: RemoteZoneConfig[] = [];
  private dynamicZoneById = new Map<number, RemoteZoneConfig>();
  private dynamicQuestionsBySheet: Record<string, RemoteProblem[]> = {};
  private pendingMonoliths: Array<{ id: number | string; position: { x: number; z: number }; color?: number; title?: string }> = [];
  private monolithActivationChecker?: Parameters<ArchimedesZoneBuilder['setMonolithsActivated']>[0];
  private dynamicHubPortalCount = 0;
  private readonly qhmjBuilds = new Map<number, QhmjRegionBuild>();
  private villageQhmjPortalArch?: THREE.Group;
  private cameraMode: 'isometric' | 'qhmj' | 'farm' = 'isometric';
  private readonly pointerController = new PinchOrbitController();
  private sun: THREE.DirectionalLight;

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    if (this._active === value) return;
    this._active = value;
    this.syncRenderLoopState();
  }

  get paused(): boolean {
    return this._paused;
  }

  set paused(value: boolean) {
    if (this._paused === value) return;
    this._paused = value;
    if (value) this.pointerController.reset();
    this.syncRenderLoopState();
  }

  get monoliths(): MonolithItem[] {
    return this.archimedes.monoliths;
  }

  get portalGroups(): THREE.Group[] {
    return this.archimedes.portalGroups;
  }

  constructor(readonly canvas: HTMLCanvasElement) {
    const isCompactGpu =
      typeof window !== 'undefined' &&
      ((typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
        Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 760);
    const maxPixelRatio = isCompactGpu ? 1.25 : 1.5;
    const shadowMapSize = isCompactGpu ? 1024 : 1536;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0xc7ebea);
    this.coreRegionGroup.name = 'Region_Core_Village_Garden';
    this.hubRegionGroup.name = 'Region_Archimedes_Hub';
    this.activeMountedGroup = this.coreRegionGroup;
    this.scene.add(this.coreRegionGroup);

    this.scene.fog = new THREE.Fog(0xc7ebea, 95, 310);
    this.scene.add(new THREE.HemisphereLight(0xf6fbff, 0x7b9868, 1.35));
    this.sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
    this.sun.position.set(-18, 45, 12); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.sun.shadow.normalBias = .045; this.sun.shadow.bias = -.0003;
    this.scene.add(this.sun, this.sun.target);

    this.spatial.enableRegionScoping();
    this.terrain();
    this.water = this.box(this.coreRegionGroup, 7, -.05, 0, 6, .18, 40, 0x48b8cf);
    this.water.castShadow = false;
    this.water.receiveShadow = true;
    this.freezeStatic(this.water);

    this.rippleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.025, 0.07), this.material(0xb5f4ed), 28);
    this.rippleMesh.name = 'river_ripples_batch';
    this.rippleMesh.castShadow = false;
    this.rippleMesh.receiveShadow = false;
    for (let i = 0; i < 28; i++) {
      const slot = {
        x: 4.7 + (i % 4) * 1.35,
        z: -18 + (i * 2.17) % 37,
        sx: 0.35 + (i % 3) * 0.2
      };
      this.rippleSlots.push(slot);
      this.instDummy.position.set(slot.x, 0.05, slot.z);
      this.instDummy.rotation.set(0, 0, 0);
      this.instDummy.scale.set(slot.sx, 1, 1);
      this.instDummy.updateMatrix();
      this.rippleMesh.setMatrixAt(i, this.instDummy.matrix);
    }
    this.rippleMesh.instanceMatrix.needsUpdate = true;
    this.disposableInstancedMeshes.push(this.rippleMesh);
    this.coreRegionGroup.add(this.rippleMesh);
    this.village();
    this.geom.attachEffects(this.scene);
    this.avatar = new PlayerAvatar({
      assets: this.assets,
      onModelLoaded: () => {
        this.burstPlayer(1.2);
      },
    });
    this.player.add(this.avatar.group);
    this.archimedes = new ArchimedesZoneBuilder(this.scene, this.geom, this.obstacles);
    this.createMilo();
    this.createBridge();
    this.createFlowers();
    this.archimedes.createArchimedesPortals({
      coreParent: this.coreRegionGroup,
      hubParent: this.hubRegionGroup,
      getZoneParent: (id) => this.getOrCreateZoneGroup(id)
    });
    this.archimedes.createArchimedesMonoliths();
    this.decorate();
    this.scene.add(this.player);
    this.coreRegionGroup.add(this.milo, this.bridge);
    this.player.position.set(-6, 0, 6); this.milo.position.set(-3, 0, 1.5);
    this.obstacles.push({ x: -3, z: 1.5, radius: .85 });
    this.spatial.addRegionObstacles('core', [
      { x: 32, z: -1.5, radius: .45 },
      { x: 32, z: 1.5, radius: .45 }
    ]);
    this.spatial.addRegionObstacles('hub', [
      { x: 52, z: -1.5, radius: .45 }, { x: 52, z: 1.5, radius: .45 },
      { x: 68 - (-1.5) * Math.sin(Math.PI / 4), z: -8 + (-1.5) * Math.cos(Math.PI / 4), radius: .45 },
      { x: 68 - 1.5 * Math.sin(Math.PI / 4), z: -8 + 1.5 * Math.cos(Math.PI / 4), radius: .45 },
      { x: 70 - (-1.5) * Math.sin(Math.PI / 6), z: -4 + (-1.5) * Math.cos(Math.PI / 6), radius: .45 },
      { x: 70 - 1.5 * Math.sin(Math.PI / 6), z: -4 + 1.5 * Math.cos(Math.PI / 6), radius: .45 },
      { x: 70, z: -1.5, radius: .45 }, { x: 70, z: 1.5, radius: .45 },
      { x: 70 - (-1.5) * Math.sin(-Math.PI / 6), z: 4 + (-1.5) * Math.cos(-Math.PI / 6), radius: .45 },
      { x: 70 - 1.5 * Math.sin(-Math.PI / 6), z: 4 + 1.5 * Math.cos(-Math.PI / 6), radius: .45 },
      { x: 68 - (-1.5) * Math.sin(-Math.PI / 4), z: 8 + (-1.5) * Math.cos(-Math.PI / 4), radius: .45 },
      { x: 68 - 1.5 * Math.sin(-Math.PI / 4), z: 8 + 1.5 * Math.cos(-Math.PI / 4), radius: .45 }
    ]);
    this.updateShadowBoundsForRegion('core');
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas.parentElement!); this.resize();
    canvas.addEventListener('pointerdown', e => {
      if (!this._active || this._paused) return;
      this.pointerController.pointerDown(e.pointerId, e.clientX, e.clientY);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore browsers/tests where pointer capture is unavailable
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!this._active || this._paused) return;
      const move = this.pointerController.pointerMove(e.pointerId, e.clientX, e.clientY);
      if (move.kind === 'none') return;
      const isCloseCam = this.isCloseExplorationCamera();
      const zoomMode = isCloseCam ? true : ('third_person' as const);
      if (move.kind === 'pinch') {
        this.distance = computePinchZoomDistance(
          this.distance,
          move.prevSpan,
          move.nextSpan,
          zoomMode
        );
        return;
      }
      this.yaw -= move.dx * .006;
      const minPitch = isCloseCam ? -0.25 : 0.15;
      const maxPitch = isCloseCam ? 0.85 : 1.05;
      this.pitch = THREE.MathUtils.clamp(this.pitch + move.dy * .003, minPitch, maxPitch);
    });
    const handlePointerEnd = (e: PointerEvent) => {
      const res = this.pointerController.pointerUp(
        e.pointerId,
        e.clientX,
        e.clientY,
        e.type === 'pointercancel'
      );
      if (res.shouldTap && this._active && !this._paused) {
        this.interactAtScreen(res.x, res.y);
      }
    };
    canvas.addEventListener('pointerup', handlePointerEnd);
    canvas.addEventListener('pointercancel', handlePointerEnd);
    canvas.addEventListener(
      'touchmove',
      e => {
        if (e.touches.length >= 2) e.preventDefault();
      },
      { passive: false }
    );
    canvas.addEventListener(
      'gesturestart',
      e => {
        e.preventDefault();
      },
      { passive: false }
    );
    canvas.addEventListener(
      'gesturechange',
      e => {
        e.preventDefault();
      },
      { passive: false }
    );
    canvas.addEventListener('wheel', e => {
      if (!this._active || this._paused) return;
      e.preventDefault();
      const zoomMode = this.isCloseExplorationCamera() ? true : ('third_person' as const);
      this.distance = computeWheelZoomDistance(
        this.distance,
        e.deltaY,
        zoomMode,
        e.ctrlKey
      );
    }, { passive: false });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.renderFrame(0);
  }

  private material(color: number) { return this.geom.material(color); }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number) { return this.geom.box(parent, x, y, z, w, h, d, color); }
  private sphere(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: number) { return this.geom.sphere(parent, x, y, z, r, color); }
  private cylinder(parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, h: number, color: number, segments = 8) { return this.geom.cylinder(parent, x, y, z, top, bottom, h, color, segments); }
  private freezeStatic(obj: THREE.Object3D) {
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
  }

  private createStoneTrail(x1: number, z1: number, x2: number, z2: number, count = 12, parent: THREE.Object3D = this.scene) {
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = THREE.MathUtils.lerp(x1, x2, t);
      const z = THREE.MathUtils.lerp(z1, z2, t);
      const stone = this.box(parent, x, .05, z, 1.8, .06, 1.8, 0xead5a3);
      stone.rotation.y = (i * 0.3) % Math.PI;
      stone.castShadow = false;
      this.freezeStatic(stone);
    }
  }

  private getOrCreateZoneGroup(zoneId: number): THREE.Group {
    let group = this.zoneRegionGroups.get(zoneId);
    if (!group) {
      group = new THREE.Group();
      group.name = `Region_Zone_${zoneId}`;
      this.zoneRegionGroups.set(zoneId, group);
    }
    return group;
  }

  getActiveRegionId(): string {
    return this.activeRegionId;
  }

  /** Build QHMJ của vùng đang hoạt động (nếu người chơi đang ở vùng QHMJ đã nạp). */
  private activeQhmjBuild(): QhmjRegionBuild | undefined {
    if (!this.activeRegionId.startsWith('zone:')) return undefined;
    return this.qhmjBuilds.get(Number(this.activeRegionId.slice(5)));
  }

  getQhmjNodes(zoneId: number): ReadonlyArray<QhmjNodeSpec> {
    return this.qhmjBuilds.get(zoneId)?.nodeSpecs ?? [];
  }

  syncQhmjSolved(zoneId: number): void {
    const build = this.qhmjBuilds.get(zoneId);
    if (!build) return;
    const lockedIds = syncQhmjSolvedState(build, (key) => this.isQhmjNodeSolved?.(key) ?? false);
    this.spatial.setQhmjLockedLinks(zoneId, lockedIds);
  }

  private isCloseExplorationCamera(): boolean {
    return this.cameraMode !== 'isometric';
  }

  private resolveCameraModeForRegion(regionId: string): 'isometric' | 'qhmj' | 'farm' {
    if (!regionId.startsWith('zone:')) return 'isometric';
    const tpl = this.dynamicZoneById.get(Number(regionId.slice(5)))?.template;
    if (tpl === 'QHMJ_SANCTUARY') return 'qhmj';
    if (tpl === 'FARM_SANCTUARY') return 'farm';
    return 'isometric';
  }

  /** Đồng bộ cấu hình camera giữa Góc Nhìn Đẳng Cự và Góc Nhìn Khám Phá Gần (QHMJ / Nông Trại). */
  private syncCameraModeForRegion(regionId: string): void {
    const nextMode = this.resolveCameraModeForRegion(regionId);
    if (nextMode === this.cameraMode) return;
    this.cameraMode = nextMode;

    const fog = this.scene.fog as THREE.Fog | null;
    if (nextMode === 'qhmj') {
      this.yaw = Math.PI / 2;
      this.pitch = 0.14;
      this.distance = 2.4;
      this.camera.fov = 58;
      this.camera.far = 700;
      if (fog) {
        fog.near = 170;
        fog.far = 560;
      }
    } else if (nextMode === 'farm') {
      this.yaw = FARM_CAMERA_DEFAULTS.yaw;
      this.pitch = FARM_CAMERA_DEFAULTS.pitch;
      this.distance = FARM_CAMERA_DEFAULTS.distance;
      this.camera.fov = FARM_CAMERA_DEFAULTS.fov;
      this.camera.far = FARM_CAMERA_DEFAULTS.far;
      if (fog) {
        fog.near = FARM_CAMERA_DEFAULTS.fogNear;
        fog.far = FARM_CAMERA_DEFAULTS.fogFar;
      }
    } else {
      this.yaw = 0.57;
      this.pitch = 0.42;
      this.distance = 13.5;
      this.avatar.group.visible = true;
      this.camera.fov = 48;
      this.camera.far = 480;
      if (fog) {
        fog.near = 95;
        fog.far = 310;
      }
    }
    this.camera.updateProjectionMatrix();
  }

  private updateShadowBoundsForRegion(regionId: string) {
    let cx = 6;
    let cz = 0;
    let halfW = 36;
    let halfH = 28;
    let sunHeight = 45;
    let shadowFar = 160;

    if (regionId === 'hub') {
      cx = 60;
      cz = 0;
      halfW = 24;
      halfH = 24;
    } else if (regionId.startsWith('zone:')) {
      const zoneId = Number(regionId.slice(5));
      const dynZone = this.dynamicZoneById.get(zoneId);
      const staticLake = STATIC_LAKE_SANCTUARIES.find((s) => s.id === zoneId);
      if (dynZone) {
        cx = dynZone.center.x;
        cz = dynZone.center.z;
        const radius = dynZone.template === 'FARM_SANCTUARY' ? 90 : Math.max(28, Math.max(dynZone.width, dynZone.depth) * 0.75);
        halfW = radius;
        halfH = radius;
        if (dynZone.template === 'FARM_SANCTUARY') {
          sunHeight = 90;
          shadowFar = 280;
        } else if (dynZone.template === 'QHMJ_SANCTUARY') {
          cx = dynZone.center.x + 4;
          cz = dynZone.center.z - 10;
          halfW = 84;
          halfH = 64;
          sunHeight = 110;
          shadowFar = 320;
        }
      } else if (staticLake) {
        cx = staticLake.center.x;
        cz = staticLake.center.z;
        halfW = 26;
        halfH = 26;
      }
    }

    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx - 24, sunHeight, cz + 12);
    Object.assign(this.sun.shadow.camera, {
      left: -halfW,
      right: halfW,
      top: halfH,
      bottom: -halfH,
      near: 1,
      far: shadowFar
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld();
  }

  private terrain() {
    // 1. Starter Village & 2. Flower Garden -> Core Region
    this.createSingleIsland({ cx: -9, cz: 0, w: 26, d: 40, grassColor: 0x8ec963, soilColor: 0xb7976d }, this.coreRegionGroup);
    this.createSingleIsland({ cx: 22, cz: 0, w: 24, d: 40, grassColor: 0x8ec963, soilColor: 0xb7976d }, this.coreRegionGroup);
    // 3. Archimedes Gatehouse Hub -> Hub Region
    this.createSingleIsland({ cx: 60, cz: 0, w: 22, d: 22, grassColor: 0x85c158, soilColor: 0x93a388 }, this.hubRegionGroup);

    // 5 Sanctuaries (Cozy Lake fallback discs until region is visited & glTF loads)
    const sanctuaryFallbacks = [
      { id: 1, cx: 110, cz: -60, color: 0x94c973 },
      { id: 2, cx: 150, cz: -60, color: 0x82c47c },
      { id: 3, cx: 110, cz: 60, color: 0x8ec963 },
      { id: 4, cx: 150, cz: 60, color: 0x78ba65 },
      { id: 5, cx: 190, cz: 0, color: 0x6aa85b }
    ];
    for (const s of sanctuaryFallbacks) {
      this.createLakeFallback(s.id, s.cx, s.cz, s.color, this.getOrCreateZoneGroup(s.id));
    }

    // Paths in starter village (flat terrain overlays don't cast shadows)
    const p1 = this.box(this.coreRegionGroup, -7, .055, 1, 21, .08, 3.2, 0xead5a3);
    p1.castShadow = false; this.freezeStatic(p1);
    const p2 = this.box(this.coreRegionGroup, -10, .055, -4, 3.1, .08, 20, 0xead5a3);
    p2.castShadow = false; this.freezeStatic(p2);
    const plaza = this.cylinder(this.coreRegionGroup, -6, .07, 5, 4.5, 4.5, .1, 0xead5a3, 24);
    plaza.castShadow = false; plaza.receiveShadow = true; this.freezeStatic(plaza);

    // Paths in Vườn Hoa Tri Thức (new land)
    const p3 = this.box(this.coreRegionGroup, 21.5, .055, 0, 23, .08, 3.2, 0xead5a3);
    p3.castShadow = false; this.freezeStatic(p3);
    const p4 = this.box(this.coreRegionGroup, 22, .055, 0, 3.2, .08, 18, 0xead5a3);
    p4.castShadow = false; this.freezeStatic(p4);
    const gardenPlaza = this.cylinder(this.coreRegionGroup, 22, .07, 0, 4.5, 4.5, .1, 0xead5a3, 24);
    gardenPlaza.castShadow = false; gardenPlaza.receiveShadow = true; this.freezeStatic(gardenPlaza);

    const steppingMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.65, .08, .4), this.material(0xf5e9ca), 15);
    steppingMesh.name = 'village_stepping_stones_batch';
    steppingMesh.castShadow = false;
    steppingMesh.receiveShadow = true;
    for (let i = 0; i < 15; i++) {
      this.instDummy.position.set(-16 + i * 1.3, .12, 1 + Math.sin(i) * .8);
      this.instDummy.rotation.set(0, i, 0);
      this.instDummy.scale.set(1, 1, 1);
      this.instDummy.updateMatrix();
      steppingMesh.setMatrixAt(i, this.instDummy.matrix);
    }
    steppingMesh.instanceMatrix.needsUpdate = true;
    steppingMesh.computeBoundingSphere();
    this.freezeStatic(steppingMesh);
    this.disposableInstancedMeshes.push(steppingMesh);
    this.coreRegionGroup.add(steppingMesh);

    // Đền Cổng Archimedes (Gatehouse Hub at x: 60, z: 0)
    const hubPlaza = this.cylinder(this.hubRegionGroup, 60, .07, 0, 7.5, 7.5, .1, 0xdfd6c0, 24);
    hubPlaza.castShadow = false; hubPlaza.receiveShadow = true; this.freezeStatic(hubPlaza);
    const hubRing = this.cylinder(this.hubRegionGroup, 60, .14, 0, 5.5, 5.5, .06, 0x93a388, 8);
    hubRing.castShadow = false; this.freezeStatic(hubRing);

    // Central Compass Monument at x: 60, z: 0
    const monument = new THREE.Group();
    monument.position.set(60, 0, 0);
    this.cylinder(monument, 0, 0.6, 0, 0.9, 1.1, 1.2, 0x76876c, 8);
    this.cylinder(monument, 0, 2.2, 0, 0.45, 0.55, 2.2, 0x93a388, 8);
    const globe = this.sphere(monument, 0, 3.6, 0, 0.6, 0xffd54f);
    globe.userData.archimedesGlobe = true;
    for (let a = 0; a < 4; a++) {
      const ring = this.box(monument, 0, 3.6, 0, 1.5, 0.08, 1.5, 0x38bdf8);
      ring.rotation.x = a * Math.PI / 4;
    }
    this.hubRegionGroup.add(monument);
    this.obstacles.push({ x: 60, z: 0, radius: 1.5 });

    // Paths connecting Hub center to portals
    this.box(this.hubRegionGroup, 56, .055, 0, 8, .08, 2.8, 0xd5cbb2);
    const trail1 = new THREE.Group();
    this.createStoneTrail(60, 0, 68, -8, 5, trail1);
    this.hubRegionGroup.add(trail1);
    this.hubTrailGroups.set(1, trail1);

    const trail2 = new THREE.Group();
    this.createStoneTrail(60, 0, 70, -4, 5, trail2);
    this.hubRegionGroup.add(trail2);
    this.hubTrailGroups.set(2, trail2);

    const trail3 = new THREE.Group();
    this.createStoneTrail(60, 0, 70, 0, 5, trail3);
    this.hubRegionGroup.add(trail3);
    this.hubTrailGroups.set(3, trail3);

    const trail4 = new THREE.Group();
    this.createStoneTrail(60, 0, 70, 4, 5, trail4);
    this.hubRegionGroup.add(trail4);
    this.hubTrailGroups.set(4, trail4);

    const trail5 = new THREE.Group();
    this.createStoneTrail(60, 0, 68, 8, 5, trail5);
    this.hubRegionGroup.add(trail5);
    this.hubTrailGroups.set(5, trail5);

    // Landmarks and Paving for 5 Sanctuaries (mounted inside their dedicated zone groups):
    // 1. Zone 1: Thung Lũng Tính Toán (x: 110, z: -60)
    const z1Group = new THREE.Group();
    this.cylinder(z1Group, 110, .07, -60, 4.5, 4.5, .1, 0xecd9b5, 16);
    this.cylinder(z1Group, 110, 1.6, -60, 0.7, 0.9, 3.2, 0xc49a6c, 6);
    this.box(z1Group, 113, 0.6, -58, 1.4, 1.2, 1.4, 0x9a7b56);
    this.getOrCreateZoneGroup(1).add(z1Group);
    this.sanctuaryLandmarkGroups.set(1, z1Group);
    this.obstacles.push({ x: 110, z: -60, radius: 1.3 });

    // 2. Zone 2: Suối Nguồn Dãy Số (x: 150, z: -60)
    const z2Group = new THREE.Group();
    this.cylinder(z2Group, 150, .07, -60, 4.5, 4.5, .1, 0xd8eaf4, 16);
    for (let s = 0; s < 4; s++) {
      this.cylinder(z2Group, 144 + s * 4, 0.1 + s * 0.04, -60, 0.75, 0.75, 0.12, 0xf8fafc, 8);
    }
    this.cylinder(z2Group, 154, 1.5, -55, 0.1, 0.5, 2.8, 0x7dd3fc, 5);
    this.getOrCreateZoneGroup(2).add(z2Group);
    this.sanctuaryLandmarkGroups.set(2, z2Group);
    this.obstacles.push({ x: 154, z: -55, radius: 1.0 });

    // 3. Zone 3: Đồi Thời Gian (x: 110, z: 60)
    const z3Group = new THREE.Group();
    this.cylinder(z3Group, 110, .07, 60, 5.0, 5.0, .1, 0xe2e8f0, 24);
    this.cylinder(z3Group, 110, 0.4, 60, 2.2, 2.4, 0.8, 0x94a3b8, 16);
    const gnomon = this.box(z3Group, 110, 1.2, 60, 0.14, 1.2, 1.2, 0xd97706);
    gnomon.rotation.x = 0.5;
    for (let h = 0; h < 12; h++) {
      const a = h * Math.PI / 6;
      this.box(z3Group, 110 + Math.cos(a) * 1.8, 0.45, 60 + Math.sin(a) * 1.8, 0.25, 0.08, 0.25, 0xf59e0b);
    }
    this.getOrCreateZoneGroup(3).add(z3Group);
    this.sanctuaryLandmarkGroups.set(3, z3Group);
    this.obstacles.push({ x: 110, z: 60, radius: 2.3 });

    // 4. Zone 4: Rừng Hình Học (x: 150, z: 60)
    const z4Group = new THREE.Group();
    this.cylinder(z4Group, 150, .07, 60, 5.0, 5.0, .1, 0xdcfce7, 16);
    this.cylinder(z4Group, 150, 1.8, 56, 0, 1.6, 3.5, 0x10b981, 4);
    this.box(z4Group, 146, 1.0, 64, 1.8, 1.8, 1.8, 0x059669);
    this.sphere(z4Group, 154, 1.5, 64, 1.1, 0x34d399);
    this.getOrCreateZoneGroup(4).add(z4Group);
    this.sanctuaryLandmarkGroups.set(4, z4Group);
    this.obstacles.push({ x: 150, z: 56, radius: 1.6 });

    // 5. Zone 5: Đỉnh Núi Tư Duy Sao (x: 190, z: 0)
    const z5Group = new THREE.Group();
    this.cylinder(z5Group, 190, 0.25, 0, 5.5, 5.8, 0.5, 0x334155, 16);
    this.cylinder(z5Group, 190, 0.55, 0, 3.8, 4.0, 0.3, 0x475569, 8);
    this.cylinder(z5Group, 190, 1.8, 0, 0.55, 0.65, 2.5, 0xf59e0b, 8);
    this.sphere(z5Group, 190, 3.5, 0, 0.6, 0xfef08a);
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2;
      this.sphere(z5Group, 190 + Math.cos(a) * 2.2, 1.2, Math.sin(a) * 2.2, 0.3, 0x67e8f9);
    }
    this.getOrCreateZoneGroup(5).add(z5Group);
    this.sanctuaryLandmarkGroups.set(5, z5Group);
    this.obstacles.push({ x: 190, z: 0, radius: 1.5 });

    // Celestial Sea of Clouds under void around Hub (batched into 1 InstancedMesh)
    const sanctuaryFootprints = [
      { cx: 110, cz: -60 },
      { cx: 150, cz: -60 },
      { cx: 110, cz: 60 },
      { cx: 150, cz: 60 },
      { cx: 190, cz: 0 }
    ];
    const cloudPlacements: Array<{ x: number; y: number; z: number; r: number }> = [];
    for (let c = 0; c < 36; c++) {
      const cx = 35 + ((c * 19) % 170);
      const cz = -75 + ((c * 23) % 150);
      const insideSanctuary = sanctuaryFootprints.some((s) => Math.hypot(cx - s.cx, cz - s.cz) < 24);
      if (!this.spatial.isWithinLand(cx, cz) && !insideSanctuary) {
        cloudPlacements.push({ x: cx, y: -1.8 + Math.sin(c) * 0.7, z: cz, r: 4.5 + (c % 4) });
      }
    }
    if (cloudPlacements.length > 0) {
      const cloudSeaMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), this.material(0xffffff), cloudPlacements.length);
      cloudSeaMesh.name = 'hub_cloud_sea_batch';
      cloudSeaMesh.castShadow = false;
      cloudSeaMesh.receiveShadow = false;
      for (let i = 0; i < cloudPlacements.length; i++) {
        const cp = cloudPlacements[i];
        this.instDummy.position.set(cp.x, cp.y, cp.z);
        this.instDummy.rotation.set(0, 0, 0);
        this.instDummy.scale.set(1.4 * cp.r, 0.6 * cp.r, 1.4 * cp.r);
        this.instDummy.updateMatrix();
        cloudSeaMesh.setMatrixAt(i, this.instDummy.matrix);
      }
      cloudSeaMesh.instanceMatrix.needsUpdate = true;
      cloudSeaMesh.computeBoundingSphere();
      this.freezeStatic(cloudSeaMesh);
      this.disposableInstancedMeshes.push(cloudSeaMesh);
      this.hubRegionGroup.add(cloudSeaMesh);
    }
  }

  public createSingleIsland(
    isl: { cx: number; cz: number; w: number; d: number; grassColor: number; soilColor?: number },
    parent: THREE.Object3D = this.coreRegionGroup
  ): THREE.Group {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    const left = -isl.w / 2, right = isl.w / 2, t = -isl.d / 2, b = isl.d / 2, r = 2;
    shape.moveTo(left + r, t);
    shape.lineTo(right - r, t);
    shape.quadraticCurveTo(right, t, right, t + r);
    shape.lineTo(right, b - r);
    shape.quadraticCurveTo(right, b, right - r, b);
    shape.lineTo(left + r, b);
    shape.quadraticCurveTo(left, b, left, b - r);
    shape.lineTo(left, t + r);
    shape.quadraticCurveTo(left, t, left + r, t);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .35, bevelThickness: .2 });
    geo.rotateX(-Math.PI / 2);
    const soil = new THREE.Mesh(geo, [this.material(isl.cx > 35 ? (isl.soilColor || 0x6e964b) : 0x88bb52), this.material(isl.soilColor || 0xb7976d)]);
    // Bevel dày 0.2 ở hai đầu đẩy đỉnh khối lên +2.7 -> đặt y = -2.7 để mặt trên nằm đúng y = 0 bên dưới lớp cỏ
    soil.position.set(isl.cx, -2.7, isl.cz);
    soil.receiveShadow = true;
    soil.castShadow = false;
    this.freezeStatic(soil);
    group.add(soil);

    const grass = new THREE.ShapeGeometry(shape);
    grass.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(grass, this.material(isl.grassColor));
    top.position.set(isl.cx, .025, isl.cz);
    top.receiveShadow = true;
    top.castShadow = false;
    this.freezeStatic(top);
    group.add(top);

    parent.add(group);
    return group;
  }

  private house(x: number, z: number, color: number, size = 1, rotate = 0, isShop = false, parent: THREE.Object3D = this.coreRegionGroup) {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.scale.setScalar(size); h.rotation.y = rotate;
    this.box(h, 0, 1.5, 0, 3.6, 3, 3, 0xfff0ce);
    const roof = this.cylinder(h, 0, 3.5, 0, 0, 3.1, 2, color, 4); roof.rotation.y = Math.PI / 4; roof.scale.z = .95;
    this.box(h, -.85, 4.15, -.65, .5, 1.5, .6, 0xe9c6a0);
    this.box(h, -.35, .95, 1.53, .9, 1.9, .15, 0x835b41);
    this.sphere(h, -.08, .98, 1.65, .06, 0xf8d55c);
    this.box(h, 1, 1.55, 1.53, .8, .8, .12, 0x4d95a3);
    this.box(h, 1, 1.55, 1.61, .08, .84, .07, 0xffffff); this.box(h, 1, 1.55, 1.61, .84, .08, .07, 0xffffff);
    this.box(h, 1, 1.02, 1.7, 1.1, .22, .4, 0x9e6a44);
    for (let i = 0; i < 4; i++) this.sphere(h, .63 + i * .25, 1.23, 1.7, .18, i % 2 ? 0xffce58 : 0xf18e81);
    this.box(h, 0, .12, 1.85, 2.3, .25, .8, 0xd6c4a1);

    if (isShop) {
      // 1. Mái hiên sọc đỏ - trắng phong cách hoạt hình (Striped Awning)
      const awning = new THREE.Group();
      awning.position.set(-.35, 2.05, 1.7);
      awning.rotation.x = 0.25;
      for (let s = 0; s < 5; s++) {
        const stripeColor = s % 2 === 0 ? 0xe11d48 : 0xfffbeb;
        this.box(awning, -0.6 + s * 0.3, 0, 0, 0.28, 0.08, 0.9, stripeColor);
      }
      h.add(awning);

      // 2. Bảng hiệu gỗ treo "TIỆM TẠP HÓA" với viền mạ vàng
      this.box(h, -.35, 2.45, 1.65, 1.5, 0.42, 0.1, 0x6b3f1f);
      this.box(h, -.35, 2.45, 1.71, 1.4, 0.32, 0.05, 0xfbbf24);
      this.sphere(h, -.35, 2.45, 1.76, 0.1, 0xd97706);

      // 3. Đèn lồng cổng ấm áp
      this.box(h, .25, 1.9, 1.65, .06, .45, .06, 0x334155);
      const lantern = this.cylinder(h, .25, 1.75, 1.75, .11, .09, .22, 0xfde047);
      lantern.castShadow = false;

      // 4. Thảm chào mừng trước cửa tiệm
      this.box(h, -.35, .13, 2.0, 1.35, .03, .65, 0xf59e0b);
      this.box(h, -.35, .135, 2.0, 1.15, .035, .45, 0xd97706);

      // 5. Cột mốc lơ lửng / Biểu tượng đồng xu vàng xoay trên nóc nhà
      const shopBeacon = this.cylinder(h, 0, 4.8, 0, .4, .4, .1, 0xfbbf24, 16);
      shopBeacon.rotation.x = Math.PI / 2;
      this.shopBeacon = shopBeacon;
    }

    parent.add(h); this.obstacles.push({ x, z, radius: 2.35 * size });
  }

  private buildTreeTemplate(variant: number): THREE.Group {
    const tree = new THREE.Group();
    tree.name = `tree_tpl_${variant % 3}_${variant % 4 === 0 ? 'fruit' : 'plain'}`;
    this.cylinder(tree, 0, 1.1, 0, .18, .26, 2.2, 0x946b43);
    const greens = [0x3c9360, 0x56a45d, 0x76b351];
    if (variant % 3 === 0) {
      this.cylinder(tree, 0, 2.35, 0, 0, 1.35, 2.3, greens[variant % 3]); this.cylinder(tree, 0, 3.35, 0, 0, 1, 1.9, 0x61ad69);
    } else {
      this.sphere(tree, 0, 2.7, 0, 1.35, greens[variant % 3]); this.sphere(tree, -.7, 2.25, .25, .9, greens[(variant + 1) % 3]); this.sphere(tree, .6, 2.7, .3, .8, 0x81bf62);
      if (variant % 4 === 0) for (let i = 0; i < 4; i++) this.sphere(tree, Math.cos(i * 2) * .8, 2.4 + Math.sin(i) * .4, .85, .17, 0xf3a444);
    }
    return tree;
  }

  private tree(x: number, z: number, size: number, variant = 0, parent: THREE.Object3D = this.coreRegionGroup) {
    const tree = this.buildTreeTemplate(variant);
    tree.position.set(x, 0, z);
    tree.scale.setScalar(size);
    parent.add(tree);
    this.obstacles.push({ x, z, radius: .45 * size });
  }

  private village() {
    this.house(-12, -6, 0xd88c55, 1.25, 0, true); this.house(-17, 6, 0x528f91, .9, .25); this.house(-4, -11, 0xbd7063, 1);
    const mill = new THREE.Group(); mill.position.set(-15, 0, -14);
    this.cylinder(mill, 0, 2, 0, 1.2, 1.6, 4, 0xf1dfb3); this.cylinder(mill, 0, 4.7, 0, 0, 1.8, 1.9, 0x53918d);
    this.windmill.position.set(0, 3.2, 1.65);
    for (let i = 0; i < 4; i++) { const sail = new THREE.Group(); sail.rotation.z = i * Math.PI / 2; this.box(sail, 0, 1.6, 0, .18, 3, .18, 0x8c7049); this.box(sail, .4, 1.85, 0, .75, 1.7, .12, 0xfff1cb); this.windmill.add(sail); }
    this.sphere(this.windmill, 0, 0, .1, .25, 0xeab65b); mill.add(this.windmill); this.coreRegionGroup.add(mill); this.obstacles.push({ x: -15, z: -14, radius: 1.8 });

    // Trees encircling village and flower garden perimeter (batched via SceneBatchPool InstancedMesh)
    const treeTemplates = new Map<string, THREE.Group>();
    const treePlacements: StaticPlacement[] = [];
    const treeCoords: Array<[number, number, number]> = [
      [-20,-14,1.3],[-20,-8,1],[-20,-3.8,1.1],[-20,3.8,1.1],[-20,13,1.3],[-14,14,1.1],[-7,16,1.4],[-2,13,1.1],[1,17,1.2],[0,-16,1.5],[1,-8,1],[-8,-17,1.2],
      [13,-15,1.3],[18,-17,1.5],[25,-16,1.2],[32,-12,1.3],[33,-5,1.1],[33,5,1.1],[32,12,1.3],[25,16,1.2],[18,17,1.5],[13,15,1.3]
    ];
    for (let i = 0; i < treeCoords.length; i++) {
      const [x, z, s] = treeCoords[i];
      const tplKey = i % 3 === 0 ? 'conifer' : `${i % 3}_${i % 4 === 0 ? 'fruit' : 'plain'}`;
      let tpl = treeTemplates.get(tplKey);
      if (!tpl) {
        tpl = this.buildTreeTemplate(i);
        treeTemplates.set(tplKey, tpl);
      }
      treePlacements.push({ template: tpl, position: { x, y: 0, z }, rotationY: 0, scale: s });
      this.obstacles.push({ x, z, radius: .45 * s });
    }
    this.geom.batchStaticTemplates(this.coreRegionGroup, treePlacements, {
      namePrefix: 'village_tree',
      castShadow: true,
      receiveShadow: true
    });

    // 1. Entrance Flower Arch at x = 11.2, z = 0
    const arch = new THREE.Group(); arch.position.set(11.2, 0, 0);
    this.cylinder(arch, 0, 1.8, -2.2, .22, .26, 3.6, 0xc8baa0);
    this.sphere(arch, 0, 3.7, -2.2, .3, 0xe89758);
    this.cylinder(arch, 0, 1.8, 2.2, .22, .26, 3.6, 0xc8baa0);
    this.sphere(arch, 0, 3.7, 2.2, .3, 0xe89758);
    this.box(arch, 0, 3.6, 0, .45, .32, 4.8, 0x8d6e4f);
    this.box(arch, 0, 4.2, 0, .25, .8, 3.6, 0xfce9bf);
    for (let s = -1.8; s <= 1.8; s += .6) {
      this.sphere(arch, 0, 3.8 + Math.sin(s * 2) * .12, s, .16, 0x5aab59);
      this.sphere(arch, .15, 3.9 + Math.sin(s * 3) * .1, s, .12, 0xf48fb1);
    }
    this.coreRegionGroup.add(arch);
    this.obstacles.push({ x: 11.2, z: -2.2, radius: .5 }, { x: 11.2, z: 2.2, radius: .5 });

    // 2. Central Fountain of Knowledge at x = 22, z = 0
    const fountain = new THREE.Group(); fountain.position.set(22, 0, 0);
    this.cylinder(fountain, 0, .3, 0, 2.3, 2.4, .6, 0xcfc2a3, 20);
    this.cylinder(fountain, 0, .48, 0, 2.1, 2.1, .15, 0x4fc3f7, 20);
    this.cylinder(fountain, 0, 1.1, 0, .45, .6, 1.4, 0x9e8a6d, 12);
    this.cylinder(fountain, 0, 1.8, 0, 1.1, 1.2, .35, 0xcfc2a3, 16);
    this.cylinder(fountain, 0, 1.9, 0, .95, .95, .1, 0x81d4fa, 16);
    this.sphere(fountain, 0, 2.3, 0, .28, 0xffd54f);
    this.coreRegionGroup.add(fountain);
    this.obstacles.push({ x: 22, z: 0, radius: 2.3 });

    // 3. Garden Benches around Fountain
    [[-2.5, -2.5], [-2.5, 2.5], [2.5, -2.5], [2.5, 2.5]].forEach(([bx, bz]) => {
      const bxW = 22 + bx, bzW = bz;
      this.box(this.coreRegionGroup, bxW, .35, bzW, 1.6, .1, .55, 0xdcd1b8);
      this.box(this.coreRegionGroup, bxW - .55, .17, bzW, .15, .35, .45, 0x9e8a6d);
      this.box(this.coreRegionGroup, bxW + .55, .17, bzW, .15, .35, .45, 0x9e8a6d);
      this.obstacles.push({ x: bxW, z: bzW, radius: .7 });
    });

    // 4. Lantern posts in the garden
    [[14.5, -2.5], [14.5, 2.5], [29.5, -2.5], [29.5, 2.5]].forEach(([lx, lz]) => {
      this.cylinder(this.coreRegionGroup, lx, 1.5, lz, .06, .08, 3.0, 0x615243);
      this.box(this.coreRegionGroup, lx, 3.1, lz, .36, .45, .36, 0xffdf80);
      this.cylinder(this.coreRegionGroup, lx, 3.45, lz, 0, .3, .25, 0x4a3b2c, 4);
      this.obstacles.push({ x: lx, z: lz, radius: .3 });
    });

    const sign = new THREE.Group(); sign.position.set(.4, 0, 3.4); this.box(sign, 0, .7, 0, .17, 1.4, .17, 0x8c6947); this.box(sign, 0, 1.45, 0, 1.5, .65, .2, 0xb78a54); this.coreRegionGroup.add(sign);
  }

  private createFlowers() {
    const FLOWER_COORDS: [number, number][] = [
      [14, -6.0], [18, -6.0], [22, -8.5], [26, -6.0], [30, -6.0],
      [14, 6.0], [18, 6.0], [22, 8.5], [26, 6.0], [30, 6.0]
    ];
    const FLOWER_PALETTE = [0xf06292, 0xffb300, 0x42a5f5, 0xe91e63, 0xab47bc, 0xff7043, 0x26a69a, 0xffa726, 0x5c6bc0, 0xffd54f];
    FLOWER_COORDS.forEach(([x, z], i) => {
      const q = FLOWER_QUESTIONS[i];
      const flowerColor = q?.color ?? FLOWER_PALETTE[i % FLOWER_PALETTE.length];
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Elevated flowerbed pedestal
      const bedRim = this.cylinder(group, 0, .14, 0, 1.35, 1.45, .28, 0xd4c7a5, 16);
      bedRim.castShadow = false;
      const bedSoil = this.cylinder(group, 0, .26, 0, 1.2, 1.2, .08, 0x422f1d, 16);
      bedSoil.castShadow = false;

      // Small stone path connecting to main walk
      const connZ = z < 0 ? 1.4 : -1.4;
      const conn = this.box(group, 0, .05, connZ, 1.2, .08, 1.5, 0xead5a3);
      conn.castShadow = false;

      // Wooden signpost beside the flower with number
      const sign = new THREE.Group();
      sign.position.set(.85, 0, .85);
      this.cylinder(sign, 0, .45, 0, .05, .05, .9, 0x8a623f, 6);
      this.box(sign, 0, .85, 0, .45, .32, .08, 0xfce9bf);
      const signDot = this.sphere(sign, 0, 1.1, 0, .1, flowerColor);
      signDot.castShadow = false;
      group.add(sign);

      // Stem & Leaves
      this.cylinder(group, 0, .95, 0, .09, .13, 1.5, 0x3d8e35, 8);
      const leaf1 = this.box(group, .32, .75, 0, .45, .06, .22, 0x5cb85c);
      leaf1.rotation.z = .45;
      leaf1.castShadow = false;
      const leaf2 = this.box(group, -.32, 1.05, 0, .45, .06, .22, 0x5cb85c);
      leaf2.rotation.z = -.45;
      leaf2.castShadow = false;

      // Bud (unbloomed state)
      const bud = new THREE.Group();
      bud.position.set(0, 1.75, 0);
      this.cylinder(bud, 0, 0, 0, .22, .08, .3, 0x43a047, 6).castShadow = false;
      const budBall = this.sphere(bud, 0, .18, 0, .28, flowerColor);
      budBall.scale.y = 1.3;
      budBall.castShadow = false;
      const beacon = this.sphere(bud, 0, .75, 0, .13, 0xffd54f);
      beacon.castShadow = false;
      beacon.userData.beacon = true;
      group.add(bud);

      // Bloom (radiant flower when answered)
      const bloom = new THREE.Group();
      bloom.position.set(0, 1.8, 0);
      bloom.scale.setScalar(0.001);
      this.sphere(bloom, 0, .06, 0, .32, 0xffd54f).castShadow = false;
      for (let p = 0; p < 8; p++) {
        const angle = p * Math.PI / 4;
        const petal = this.box(bloom, Math.cos(angle) * .55, .02, Math.sin(angle) * .55, .36, .08, .55, flowerColor);
        petal.rotation.y = -angle;
        petal.rotation.x = .15;
        petal.castShadow = false;
      }
      group.add(bloom);

      this.coreRegionGroup.add(group);
      this.obstacles.push({ x, z, radius: 1.15 });

      this.flowers.push({
        id: i,
        position: new THREE.Vector3(x, 0, z),
        group,
        bud,
        bloom,
        beacon,
        bloomed: false,
        bloomAnim: 0,
        animating: false
      });
    });
  }

  createPortalArch(x: number, z: number, color: number, rotationY = 0, parent: THREE.Object3D = this.scene) {
    return this.archimedes.createPortalArch(x, z, color, rotationY, parent);
  }

  public createMonolithEntity(
    id: number | string,
    x: number,
    z: number,
    color: number,
    title?: string,
    parent: THREE.Object3D = this.scene
  ): MonolithItem {
    return this.archimedes.createMonolithEntity(id, x, z, color, title, parent);
  }

  private dynamicIslandIds = new Set<number>();
  private dynamicObstacles: Obstacle[] = [];
  private dynamicIslandPortals = new Map<number, PortalLink[]>();
  private occupiedHubPortalPositions = new Map<number, { x: number; z: number }>();
  private zoneObstaclesMap = new Map<number, Obstacle[]>();
  private parkTreesByZone = new Map<number, ParkTreeEntity[]>();
  private parkTreePositionsByZone = new Map<number, { x: number; z: number }[]>();

  private createIslandScenery(z: {
    id: number;
    name: string;
    theme?: string;
    decorDensity?: string;
    center: { x: number; z: number };
    width: number;
    depth: number;
    color: number;
  }, parent: THREE.Object3D = this.scene): { decorGroup: THREE.Group; obstacles: Obstacle[] } {
    const obstacles: Obstacle[] = [];
    const theme = (z.theme || 'RUINS').toUpperCase();
    const density = (z.decorDensity || 'MEDIUM').toUpperCase();
    const countMult = density === 'HIGH' ? 1.4 : (density === 'LOW' ? 0.6 : 1.0);

    const halfW = z.width / 2;
    const halfD = z.depth / 2;
    const cx = z.center.x;
    const cz = z.center.z;
    const portalAnchor = { x: cx - halfW + 3, z: cz };
    const arrivalAnchor = { x: portalAnchor.x + 2.5, z: cz };

    const decorGroup = new THREE.Group();
    decorGroup.position.set(cx, 0, cz);

    if (theme === 'GARDEN') {
      // 1. Đài phun nước nhỏ ở giữa
      const fountain = new THREE.Group();
      fountain.position.set(0, 0, 0);
      this.cylinder(fountain, 0, .25, 0, 1.6, 1.8, .5, 0xdcd1b8, 16);
      this.cylinder(fountain, 0, .42, 0, 1.4, 1.4, .12, 0x38bdf8, 16);
      this.cylinder(fountain, 0, 1.0, 0, .3, .45, 1.1, 0x8a7051, 10);
      this.sphere(fountain, 0, 1.6, 0, .22, 0xfacc15);
      decorGroup.add(fountain);
      obstacles.push({ x: cx, z: cz, radius: 1.8 });

      // 2. Viền hoa xung quanh mép đảo
      const flowerCount = Math.round(12 * countMult);
      const flowerColors = [0xf43f5e, 0xec4899, 0xa855f7, 0x38bdf8, 0xfbbf24];
      for (let i = 0; i < flowerCount; i++) {
        const angle = (i / flowerCount) * Math.PI * 2;
        const fx = Math.cos(angle) * (halfW - 2.5);
        const fz = Math.sin(angle) * (halfD - 2.5);
        if (isWithinPortalKeepOut(cx + fx, cz + fz, portalAnchor, arrivalAnchor)) continue;
        const col = flowerColors[i % flowerColors.length];
        this.sphere(decorGroup, fx, .2, fz, .35, col);
        this.sphere(decorGroup, fx, .1, fz, .45, 0x22c55e);
      }
    } else if (theme === 'RUINS') {
      // 1. Hàng cột đá cổ Hy Lạp ở 4 góc
      const colCorners = [
        [-halfW + 3.5, -halfD + 3.5],
        [halfW - 3.5, -halfD + 3.5],
        [-halfW + 3.5, halfD - 3.5],
        [halfW - 3.5, halfD - 3.5]
      ];
      colCorners.forEach(([ox, oz]) => {
        if (isWithinPortalKeepOut(cx + ox, cz + oz, portalAnchor, arrivalAnchor)) return;
        const pillar = new THREE.Group();
        pillar.position.set(ox, 0, oz);
        this.cylinder(pillar, 0, .2, 0, .9, 1.0, .35, 0x94a3b8, 10);
        this.cylinder(pillar, 0, 1.8, 0, .38, .45, 3.2, 0xcfd8dc, 8);
        this.cylinder(pillar, 0, 3.5, 0, .55, .42, .25, 0x94a3b8, 8);
        this.box(pillar, 0, 3.75, 0, 1.2, .25, 1.2, 0xe2e8f0);
        decorGroup.add(pillar);
        obstacles.push({ x: cx + ox, z: cz + oz, radius: 1.0 });
      });

      // 2. Tảng đá rêu phong
      const rockCount = Math.round(6 * countMult);
      for (let i = 0; i < rockCount; i++) {
        const angle = (i / rockCount) * Math.PI * 2 + 0.3;
        const rx = Math.cos(angle) * (halfW - 3);
        const rz = Math.sin(angle) * (halfD - 3);
        if (isWithinPortalKeepOut(cx + rx, cz + rz, portalAnchor, arrivalAnchor)) continue;
        const stone = this.box(decorGroup, rx, .4, rz, 1.4, .8, 1.1, 0x64748b);
        stone.rotation.y = angle;
        obstacles.push({ x: cx + rx, z: cz + rz, radius: .9 });
      }
    } else if (theme === 'FOREST') {
      // 1. Cây cối xung quanh đảo
      const treeCount = Math.round(8 * countMult);
      for (let i = 0; i < treeCount; i++) {
        const angle = (i / treeCount) * Math.PI * 2;
        const tx = Math.cos(angle) * (halfW - 3.0);
        const tz = Math.sin(angle) * (halfD - 3.0);
        if (isWithinPortalKeepOut(cx + tx, cz + tz, portalAnchor, arrivalAnchor)) continue;
        this.tree(cx + tx, cz + tz, 1.2, i, parent);
        obstacles.push({ x: cx + tx, z: cz + tz, radius: .6 });
      }

      // 2. Nấm ma thuật phát sáng
      const shroomCount = Math.round(10 * countMult);
      const shroomColors = [0xef4444, 0xa855f7, 0xf97316];
      for (let i = 0; i < shroomCount; i++) {
        const angle = (i / shroomCount) * Math.PI * 2 + 0.4;
        const sx = Math.cos(angle) * (halfW * 0.6);
        const sz = Math.sin(angle) * (halfD * 0.6);
        if (isWithinPortalKeepOut(cx + sx, cz + sz, portalAnchor, arrivalAnchor)) continue;
        this.cylinder(decorGroup, sx, .2, sz, .08, .12, .4, 0xf1f5f9, 6);
        this.sphere(decorGroup, sx, .45, sz, .28, shroomColors[i % shroomColors.length]);
      }
    } else if (theme === 'CRYSTAL') {
      // 1. Khối pha lê phát sáng
      const crystalCount = Math.round(8 * countMult);
      const crystalColors = [0x22d3ee, 0xc084fc, 0xf472b6, 0x38bdf8];
      for (let i = 0; i < crystalCount; i++) {
        const angle = (i / crystalCount) * Math.PI * 2;
        const kx = Math.cos(angle) * (halfW - 3.2);
        const kz = Math.sin(angle) * (halfD - 3.2);
        if (isWithinPortalKeepOut(cx + kx, cz + kz, portalAnchor, arrivalAnchor)) continue;
        const cCol = crystalColors[i % crystalColors.length];

        const cGroup = new THREE.Group();
        cGroup.position.set(kx, 0, kz);
        this.cylinder(cGroup, 0, .15, 0, .8, .9, .3, 0x1e293b, 8);
        const cMesh = this.cylinder(cGroup, 0, 1.2, 0, 0, .35, 2.2, cCol, 6);
        cMesh.rotation.z = (i % 2 === 0 ? 0.15 : -0.15);
        decorGroup.add(cGroup);
        obstacles.push({ x: cx + kx, z: cz + kz, radius: .8 });
      }
    } else if (theme === 'VILLAGE') {
      // 1. Nhà gỗ nhỏ ở góc đảo
      const hx = -halfW + 5.5;
      const hz = -halfD + 5.5;
      if (!isWithinPortalKeepOut(cx + hx, cz + hz, portalAnchor, arrivalAnchor)) {
        this.house(cx + hx, cz + hz, 0xd97706, 0.85, 0, false, parent);
        obstacles.push({ x: cx + hx, z: cz + hz, radius: 2.0 });
      }

      // 2. Hàng rào gỗ
      const fenceCount = Math.round(5 * countMult);
      for (let i = 0; i < fenceCount; i++) {
        const fx = halfW - 3;
        const fz = -halfD + 4 + i * 2.5;
        if (isWithinPortalKeepOut(cx + fx, cz + fz, portalAnchor, arrivalAnchor)) continue;
        this.box(decorGroup, fx, .5, fz, .15, .8, 2.2, 0x854d0e);
        this.box(decorGroup, fx, .3, fz, .2, .15, 2.4, 0xa16207);
        obstacles.push({ x: cx + fx, z: cz + fz, radius: .5 });
      }
    }

    parent.add(decorGroup);
    return { decorGroup, obstacles };
  }

  private getStaticCenterpieceObstacles(zoneId: number): Obstacle[] {
    switch (zoneId) {
      case 1: return [{ x: 110, z: -60, radius: 1.35 }];
      case 2: return [{ x: 154, z: -55, radius: 1.0 }, { x: 150, z: -60, radius: 1.2 }];
      case 3: return [{ x: 110, z: 60, radius: 2.3 }];
      case 4: return [{ x: 150, z: 56, radius: 1.6 }];
      case 5: return [{ x: 190, z: 0, radius: 1.5 }];
      default: return [];
    }
  }


  private createZoneMonoliths(zoneId: number, zoneGroup: THREE.Group): Obstacle[] {
    const addedObs: Obstacle[] = [];
    const existingIds = new Set(this.monoliths.map((m) => String(m.id)));
    const dynZone = this.dynamicZoneById.get(zoneId);
    for (const pm of this.pendingMonoliths) {
      if (!pm.position || pm.id === undefined || pm.id === null) continue;
      if (this.spatial.resolveRegionForPoint(pm.position.x, pm.position.z) !== `zone:${zoneId}`) continue;
      const strId = String(pm.id);
      if (!existingIds.has(strId)) {
        const pos = dynZone ? sanitizeZoneEntityPosition(dynZone, pm.position) : pm.position;
        pm.position = pos;
        this.createMonolithEntity(pm.id, pos.x, pos.z, pm.color || 0x38bdf8, pm.title, zoneGroup);
        existingIds.add(strId);
        addedObs.push({ x: pos.x, z: pos.z, radius: 1.35 });
      }
    }
    if (this.monolithActivationChecker) {
      this.archimedes.setMonolithsActivated(this.monolithActivationChecker);
    }
    return addedObs;
  }

  private async ensureZoneRegionLoaded(zoneId: number): Promise<void> {
    if (this.loadedZoneRegions.has(zoneId)) return;
    const inflight = this.pendingZoneLoads.get(zoneId);
    if (inflight) {
      await inflight;
      return;
    }

    const loadTask = (async () => {
      const zoneGroup = this.getOrCreateZoneGroup(zoneId);
      const zoneObs: Obstacle[] = [...this.getStaticCenterpieceObstacles(zoneId)];
      const dynZone = this.dynamicZoneById.get(zoneId);
      const staticLake = STATIC_LAKE_SANCTUARIES.find((s) => s.id === zoneId);

      if (dynZone?.template === 'PARK_SANCTUARY') {
        const parkQuestions = this.dynamicQuestionsBySheet[dynZone.sheetName];
        const obs = await this.loadParkMap(dynZone, parkQuestions, zoneGroup);
        zoneObs.push(...obs);
        const retX = dynZone.center.x + 14;
        const retZ = dynZone.center.z;
        this.createPortalArch(retX, retZ, 0x38bdf8, 0, zoneGroup);
        zoneObs.push(...computePortalPillarObstacles(retX, retZ, 0));
      } else if (dynZone?.template === 'FARM_SANCTUARY') {
        const farmQuestions = this.dynamicQuestionsBySheet[dynZone.sheetName];
        const obs = await this.loadFarmMap(dynZone, farmQuestions, zoneGroup);
        zoneObs.push(...obs);
        const anchors = computeFarmAnchors(dynZone.center);
        const retY =
          this.farmSanctuary?.terrainSurface?.sampleNearest(
            anchors.returnPortal.x,
            anchors.returnPortal.z,
            anchors.returnPortal.y
          )?.y ?? anchors.returnPortal.y;
        const retArch = this.createPortalArch(anchors.returnPortal.x, anchors.returnPortal.z, 0x38bdf8, 0, zoneGroup);
        retArch.position.y = retY;
        zoneObs.push(...computePortalPillarObstacles(anchors.returnPortal.x, anchors.returnPortal.z, 0));
      } else if (dynZone?.template === 'QHMJ_SANCTUARY') {
        const sheetProblems = this.dynamicQuestionsBySheet[dynZone.sheetName];
        const qhmjProblems = Array.isArray(sheetProblems) && sheetProblems.length > 0
          ? sheetProblems
          : generateQhmjProblems(zoneId, 12);
        const build = await buildQhmjRegion(
          this.assets,
          dynZone,
          zoneGroup,
          qhmjProblems,
          (key) => this.isQhmjNodeSolved?.(key) ?? false
        );
        if (build) {
          this.qhmjBuilds.set(zoneId, build);
          const lockedIds = build.entities.getLockedLinkIds();
          this.spatial.setQhmjRoad(
            zoneId,
            build.surface,
            build.links,
            build.nodeSpecs.map((s) => ({ index: s.index, x: s.position.x, y: s.position.y, z: s.position.z })),
            lockedIds
          );
        }
        const anchors = computeQhmjAnchors(dynZone.center);
        const retArch = this.createPortalArch(anchors.returnPortal.x, anchors.returnPortal.z, 0x38bdf8, 0, zoneGroup);
        retArch.position.y = anchors.returnPortal.y;
        zoneObs.push(...computePortalPillarObstacles(anchors.returnPortal.x, anchors.returnPortal.z, 0));
      } else if (dynZone?.template === 'PROCEDURAL_SANCTUARY') {
        const res = await proceduralLandBuilder.buildLand(dynZone, this.assets);
        zoneGroup.add(res.group);
        this.dynamicIslandGroups.set(zoneId, [res.group]);
        this.dynamicObstacles.push(...res.obstacles);
        zoneObs.push(...res.obstacles);

        const retArch = this.createPortalArch(
          res.portalAnchors.returnPortal.x,
          res.portalAnchors.returnPortal.z,
          0x38bdf8,
          res.portalAnchors.returnPortal.rotationY,
          zoneGroup
        );
        const existingArches = this.dynamicPortalArches.get(zoneId) ?? [];
        existingArches.push(retArch);
        this.dynamicPortalArches.set(zoneId, existingArches);
        zoneObs.push(
          ...computePortalPillarObstacles(
            res.portalAnchors.returnPortal.x,
            res.portalAnchors.returnPortal.z,
            res.portalAnchors.returnPortal.rotationY
          )
        );
      } else if (staticLake || usesLakeTerrain(dynZone?.template)) {
        const targetZone = dynZone ?? {
          id: staticLake!.id,
          center: staticLake!.center,
          template: staticLake!.template
        };
        if (dynZone && dynZone.id > 5 && !this.lakeFallbackDiscs.has(dynZone.id) && !this.lakeModels.has(dynZone.id)) {
          const disc = this.createLakeFallback(dynZone.id, dynZone.center.x, dynZone.center.z, dynZone.color, zoneGroup);
          this.dynamicIslandGroups.set(dynZone.id, [disc]);
        }
        const lakeObs = await this.loadLakeMap(targetZone, zoneGroup);
        zoneObs.push(...lakeObs);
        const anchors = computeLakeAnchors(targetZone.center);
        if (targetZone.id > 5) {
          const retArch = this.createPortalArch(
            anchors.returnPortal.x,
            anchors.returnPortal.z,
            0x38bdf8,
            anchors.returnPortal.rotationY,
            zoneGroup
          );
          const existingArches = this.dynamicPortalArches.get(zoneId) ?? [];
          existingArches.push(retArch);
          this.dynamicPortalArches.set(zoneId, existingArches);
        }
        zoneObs.push(
          ...computePortalPillarObstacles(
            anchors.returnPortal.x,
            anchors.returnPortal.z,
            anchors.returnPortal.rotationY
          )
        );
      } else if (dynZone) {
        const islandGroup = this.createSingleIsland({
          cx: dynZone.center.x,
          cz: dynZone.center.z,
          w: dynZone.width,
          d: dynZone.depth,
          grassColor: dynZone.color,
          soilColor: 0x93a388
        }, zoneGroup);
        const { decorGroup, obstacles: islandObs } = this.createIslandScenery(dynZone, zoneGroup);
        this.dynamicObstacles.push(...islandObs);
        this.dynamicIslandGroups.set(zoneId, [islandGroup, decorGroup]);
        zoneObs.push(...islandObs);

        const retX = dynZone.center.x - dynZone.width / 2 + 3;
        const retZ = dynZone.center.z;
        const retArch = this.createPortalArch(retX, retZ, 0x38bdf8, 0, zoneGroup);
        const existingArches = this.dynamicPortalArches.get(zoneId) ?? [];
        existingArches.push(retArch);
        this.dynamicPortalArches.set(zoneId, existingArches);
        zoneObs.push(...computePortalPillarObstacles(retX, retZ, 0));
      }

      const monolithObs = this.createZoneMonoliths(zoneId, zoneGroup);
      zoneObs.push(...monolithObs);

      this.zoneObstaclesMap.set(zoneId, zoneObs);
      this.spatial.setRegionObstacles(`zone:${zoneId}`, zoneObs);
      this.loadedZoneRegions.add(zoneId);
    })();

    this.pendingZoneLoads.set(zoneId, loadTask);
    try {
      await loadTask;
    } finally {
      this.pendingZoneLoads.delete(zoneId);
    }
  }

  public async activateRegionAt(x: number, z: number, explicitRegionId?: string): Promise<string> {
    const regionId = explicitRegionId ?? this.spatial.resolveRegionForPoint(x, z);

    if (regionId.startsWith('zone:')) {
      const zoneId = Number(regionId.slice(5));
      if (!Number.isNaN(zoneId)) {
        await this.ensureZoneRegionLoaded(zoneId);
        const dynZone = this.dynamicZoneById.get(zoneId);
        if (dynZone?.template === 'PARK_SANCTUARY') {
          const cachedTrees = this.parkTreesByZone.get(zoneId);
          const cachedPositions = this.parkTreePositionsByZone.get(zoneId);
          if (cachedTrees) {
            this.parkTrees.splice(0, this.parkTrees.length, ...cachedTrees);
          }
          if (cachedPositions) {
            this.spatial.setParkTreePositions(cachedPositions);
          }
        }
      }
    }

    let nextGroup: THREE.Group = this.coreRegionGroup;
    if (regionId === 'hub') {
      nextGroup = this.hubRegionGroup;
    } else if (regionId.startsWith('zone:')) {
      const zoneId = Number(regionId.slice(5));
      nextGroup = this.getOrCreateZoneGroup(zoneId);
    }

    if (nextGroup !== this.activeMountedGroup) {
      if (typeof this.renderer.compileAsync === 'function') {
        try {
          await this.renderer.compileAsync(nextGroup, this.camera, this.scene);
        } catch {
          // Safe fallback in headless or restricted WebGL contexts
        }
      }
      this.scene.remove(this.activeMountedGroup);
      this.scene.add(nextGroup);
      this.activeMountedGroup = nextGroup;
    }

    this.activeRegionId = regionId;
    this.spatial.setActiveRegion(regionId);
    this.syncCameraModeForRegion(regionId);
    this.updateShadowBoundsForRegion(regionId);
    this.requestIdleRender();
    return regionId;
  }

  public async renderDynamicZones(
    zones: RemoteZoneConfig[],
    positionedMonoliths: Array<{ id: number | string; position: { x: number; z: number }; color?: number; title?: string }> = [],
    questionsBySheet?: Record<string, RemoteProblem[]>
  ): Promise<void> {
    this.dynamicZones = zones;
    this.dynamicZoneById = new Map(zones.map((z) => [z.id, z]));
    this.dynamicQuestionsBySheet = questionsBySheet ?? {};
    this.pendingMonoliths = positionedMonoliths;

    const customPortals: PortalLink[] = [];

    // 0. Đồng bộ trạng thái hiển thị cho các Đền Cổng và Vùng Đất Archimedes 1-5
    const activeZoneIds = new Set(zones.map((z) => z.id));
    this.activeZoneIds = activeZoneIds;
    this.archimedes.setSanctuaryPortalsVisible(activeZoneIds);

    for (let id = 1; id <= 5; id++) {
      const visible = activeZoneIds.has(id);
      const lm = this.sanctuaryLandmarkGroups.get(id);
      if (lm) lm.visible = visible;
      const trail = this.hubTrailGroups.get(id);
      if (trail) trail.visible = visible;
      const lakeModel = this.lakeModels.get(id);
      if (lakeModel) lakeModel.visible = visible;
      const fallback = this.lakeFallbackDiscs.get(id);
      if (fallback) fallback.visible = visible;
    }

    // 1. Đăng ký các vùng đất Công Viên (PARK_SANCTUARY) kết nối từ bờ tây Làng Khởi Đầu (nạp GLB lười khi vào vùng)
    const parkZones = zones.filter((z) => z.template === 'PARK_SANCTUARY');
    const hasPark = parkZones.length > 0;
    if (this.villageParkPortalArch) {
      this.villageParkPortalArch.visible = hasPark;
    }
    this.parkModels.forEach((m) => (m.visible = hasPark));
    this.parkTrees.forEach((t) => {
      if (t.beacon) t.beacon.visible = hasPark && t.hasQuestion && !t.awakened;
    });
    if (!hasPark) {
      this.spatial.setParkZones([]);
    }

    if (parkZones.length > 0) {
      if (!this.villageParkPortalArch) {
        this.villageParkPortalArch = this.createPortalArch(
          -19.5,
          0,
          parkZones.length === 1 ? (parkZones[0].color || 0x10b981) : 0x10b981,
          0,
          this.coreRegionGroup
        );
        this.spatial.addRegionObstacles('core', computePortalPillarObstacles(-19.5, 0, 0));
      }

      if (parkZones.length === 1) {
        const pz = parkZones[0];
        customPortals.push({
          id: 'village_to_park',
          name: pz.name ? `Đến ${pz.name}` : 'Cổng dịch chuyển',
          source: { x: -19.5, z: 0 },
          target: { x: pz.center.x + 11.5, z: pz.center.z },
          triggerRadius: 1.85,
          targetRegionId: `zone:${pz.id}`
        });
      } else {
        customPortals.push({
          id: 'village_to_multi_park',
          name: 'Cổng dịch chuyển',
          source: { x: -19.5, z: 0 },
          target: { x: -19.5, z: 0 },
          triggerRadius: 1.85,
          requiresSelection: true
        });
      }

      this.spatial.setParkZones(
        parkZones.map((pz) => ({
          id: pz.id,
          name: pz.name,
          cx: pz.center.x,
          cz: pz.center.z,
          radius: 18.2
        }))
      );

      parkZones.forEach((z) => {
        const parkQuestions = questionsBySheet?.[z.sheetName];
        if (this.loadedZoneRegions.has(z.id) && parkQuestions && parkQuestions.length > 0) {
          this.syncParkQuestions(parkQuestions, z.color, z.id);
        }

        const retX = z.center.x + 14;
        const retZ = z.center.z;
        customPortals.push({
          id: `z${z.id}_to_village`,
          name: 'Về Làng Khởi Đầu',
          source: { x: retX, z: retZ },
          target: { x: -17.5, z: 0 },
          triggerRadius: 1.85,
          targetRegionId: 'core'
        });
      });
    }

    // 1b. Đăng ký các vùng đất Nông Trại (FARM_SANCTUARY) kết nối từ bờ sông Làng Khởi Đầu
    const farmZones = zones.filter((z) => z.template === 'FARM_SANCTUARY');
    const hasFarm = farmZones.length > 0;
    if (this.villageFarmPortalArch) {
      this.villageFarmPortalArch.visible = hasFarm;
    }
    if (this.farmSanctuary) {
      this.farmSanctuary.group.visible = hasFarm;
    }
    this.spatial.setFarmZones(
      farmZones.map((z) => ({
        id: z.id,
        name: z.name,
        cx: z.center.x,
        cz: z.center.z,
        radius: FARM_REGION_RADIUS,
        spawn: computeFarmAnchors(z.center).spawn
      }))
    );

    if (farmZones.length > 0) {
      if (!this.villageFarmPortalArch) {
        this.villageFarmPortalArch = this.createPortalArch(
          FARM_VILLAGE_PORTAL.x,
          FARM_VILLAGE_PORTAL.z,
          farmZones.length === 1 ? (farmZones[0].color || 0x84cc16) : 0x84cc16,
          0,
          this.coreRegionGroup
        );
        this.spatial.addRegionObstacles('core', computePortalPillarObstacles(FARM_VILLAGE_PORTAL.x, FARM_VILLAGE_PORTAL.z, 0));
      }

      customPortals.push(...buildFarmPortalLinks(farmZones));

      farmZones.forEach((z) => {
        const farmQuestions = questionsBySheet?.[z.sheetName];
        this.latestFarmQuestions = farmQuestions;
        if (this.loadedZoneRegions.has(z.id) && this.farmSanctuary && farmQuestions && farmQuestions.length > 0) {
          this.farmSanctuary.syncQuestions(farmQuestions);
        }
      });
    }

    // 1c. Đăng ký vùng QHMJ (map_qhmj.glb): cổng vào đặt tại Làng Khởi Đầu, mặt đường nạp khi dịch chuyển tới
    const qhmjZones = zones.filter((z) => z.template === 'QHMJ_SANCTUARY');
    if (this.villageQhmjPortalArch) {
      this.villageQhmjPortalArch.visible = qhmjZones.length > 0;
    }
    this.qhmjBuilds.forEach((b, id) => {
      b.model.visible = activeZoneIds.has(id);
    });
    this.spatial.setQhmjZones(
      qhmjZones.map((z) => ({
        id: z.id,
        name: z.name,
        cx: z.center.x,
        cz: z.center.z,
        radius: QHMJ_REGION_RADIUS,
        spawn: computeQhmjAnchors(z.center).spawn
      }))
    );
    if (qhmjZones.length > 0) {
      const first = qhmjZones[0];
      if (!this.villageQhmjPortalArch) {
        this.villageQhmjPortalArch = this.createPortalArch(
          QHMJ_VILLAGE_PORTAL.x,
          QHMJ_VILLAGE_PORTAL.z,
          qhmjZones.length === 1 ? (first.color || 0xe74c3c) : 0xe74c3c,
          0,
          this.coreRegionGroup
        );
        this.spatial.addRegionObstacles('core', computePortalPillarObstacles(QHMJ_VILLAGE_PORTAL.x, QHMJ_VILLAGE_PORTAL.z, 0));
      }
      const spawn = computeQhmjAnchors(first.center).spawn;
      customPortals.push({
        id: 'village_to_qhmj',
        name: first.name ? `Đến ${first.name}` : 'Cổng Con Đường Bậc Thang',
        source: { x: QHMJ_VILLAGE_PORTAL.x, z: QHMJ_VILLAGE_PORTAL.z },
        target: { x: spawn.x, z: spawn.z },
        triggerRadius: 1.85,
        targetRegionId: `zone:${first.id}`
      });
      for (const z of qhmjZones) {
        if (this.loadedZoneRegions.has(z.id)) {
          this.syncQhmjSolved(z.id);
        }
        const ret = computeQhmjAnchors(z.center).returnPortal;
        customPortals.push({
          id: `z${z.id}_to_village_qhmj`,
          name: 'Về Làng Khởi Đầu',
          source: { x: ret.x, z: ret.z },
          target: { x: QHMJ_VILLAGE_RETURN_TARGET.x, z: QHMJ_VILLAGE_RETURN_TARGET.z },
          triggerRadius: 1.85,
          targetRegionId: 'core'
        });
      }
    }

    // 2. Đăng ký metadata cổng cho các hòn đảo động khác (chỉ dựng đảo 3D khi người chơi dịch chuyển tới)
    const otherZones = zones.filter((z) => z.id > 5 && z.id !== 6 && z.template !== 'PARK_SANCTUARY' && z.template !== 'FARM_SANCTUARY' && z.template !== 'QHMJ_SANCTUARY');
    otherZones.forEach((z) => {
      if (!this.dynamicIslandIds.has(z.id)) {
        this.dynamicIslandIds.add(z.id);

        const hubSlot = allocateDynamicHubPortalSlot(
          this.dynamicHubPortalCount++,
          Array.from(this.occupiedHubPortalPositions.values())
        );
        this.occupiedHubPortalPositions.set(z.id, { x: hubSlot.x, z: hubSlot.z });

        const hubArch = this.createPortalArch(hubSlot.x, hubSlot.z, z.color, hubSlot.rotationY, this.hubRegionGroup);
        this.spatial.addRegionObstacles('hub', computePortalPillarObstacles(hubSlot.x, hubSlot.z, hubSlot.rotationY));
        this.dynamicPortalArches.set(z.id, [hubArch]);

        const anchors = computeZonePortalAnchors(z);

        if (this.activeZoneIds && !this.activeZoneIds.has(z.id)) {
          hubArch.visible = false;
        }

        this.dynamicIslandPortals.set(z.id, [
          {
            id: `hub_to_z${z.id}`,
            name: `Đến ${z.name}`,
            source: { x: hubSlot.x, z: hubSlot.z },
            target: { x: anchors.arrival.x, z: anchors.arrival.z },
            triggerRadius: 1.85,
            targetRegionId: `zone:${z.id}`
          },
          {
            id: `z${z.id}_to_hub`,
            name: 'Về Đền Cổng Archimedes',
            source: { x: anchors.returnPortal.x, z: anchors.returnPortal.z },
            target: hubSlot.returnTarget,
            triggerRadius: 1.85,
            targetRegionId: 'hub'
          }
        ]);
      }
    });

    otherZones.forEach((z) => {
      const portals = this.dynamicIslandPortals.get(z.id);
      if (portals) {
        customPortals.push(...portals);
      }
    });

    // Ẩn/hiện các đảo động đã nạp và cổng kết nối theo activeZoneIds
    this.dynamicIslandGroups.forEach((objs, id) => {
      const vis = activeZoneIds.has(id);
      objs.forEach((o) => (o.visible = vis));
    });
    this.dynamicPortalArches.forEach((arches, id) => {
      const vis = activeZoneIds.has(id);
      arches.forEach((a) => (a.visible = vis));
    });

    // Cập nhật bia đá nếu vùng đất chứa bia đá đó đã được nạp trước đó
    this.archimedes.removeGardenMonoliths();
    for (const loadedId of this.loadedZoneRegions) {
      const zoneGroup = this.getOrCreateZoneGroup(loadedId);
      const newMonolithObs = this.createZoneMonoliths(loadedId, zoneGroup);
      if (newMonolithObs.length > 0) {
        const existingObs = this.zoneObstaclesMap.get(loadedId) ?? [];
        existingObs.push(...newMonolithObs);
        this.zoneObstaclesMap.set(loadedId, existingObs);
        this.spatial.setRegionObstacles(`zone:${loadedId}`, existingObs);
      }
    }

    // Đồng bộ hóa sang SpatialWorld và chỉ nạp vùng hiện tại đang đứng
    const allPositions = positionedMonoliths.filter((pm) => pm.position).map((pm) => pm.position!);
    this.spatial.setDynamicData(zones, allPositions, customPortals, this.dynamicObstacles);
    await this.activateRegionAt(this.player.position.x, this.player.position.z);
    this.requestIdleRender();
  }

  nearFlower(): number {
    return this.spatial.nearFlowerIndex();
  }

  bloomFlower(index: number) {
    const f = this.flowers[index];
    if (!f) return;
    f.bloomed = true;
    f.animating = true;
    f.bloomAnim = 0;
    this.burst(new THREE.Vector3(f.position.x, 2.0, f.position.z));
  }

  setFlowersBloomed(bloomedList: boolean[]) {
    this.flowers.forEach((f, i) => {
      const bloomed = bloomedList[i] === true;
      f.bloomed = bloomed;
      f.animating = false;
      f.bloomAnim = bloomed ? 1 : 0;
      f.bud.scale.setScalar(bloomed ? 0.001 : 1);
      f.bloom.scale.setScalar(bloomed ? 1 : 0.001);
    });
  }

  activateMonolith(ref: number | string) {
    this.archimedes.activateMonolith(ref, (pos) => this.burst(pos));
  }

  setMonolithsActivated(
    checker:
      | boolean[]
      | ((id: number | string, index: number) => boolean)
      | { monoliths?: boolean[]; solvedProblems?: Record<string, boolean> }
  ) {
    this.monolithActivationChecker = checker;
    this.archimedes.setMonolithsActivated(checker);
  }

  nearMonolith(): number {
    return this.spatial.nearMonolithIndex();
  }

  teleport(x: number, z: number, y?: number, explicitRegionId?: string) {
    const targetRegion = explicitRegionId ?? this.spatial.resolveRegionForPoint(x, z);
    if (explicitRegionId) {
      this.spatial.setActiveRegion(targetRegion);
    }
    this.spatial.teleport(x, z, y);
    this.player.position.set(x, this.spatial.floorHeight(), z);
    this.syncCameraModeForRegion(targetRegion);
    const targetY =
      this.player.position.y +
      (this.isCloseExplorationCamera()
        ? (this.avatar.activeAvatar === 'elsa' ? 2.4 : 1.75)
        : (this.avatar.activeAvatar === 'elsa' ? 1.85 : 1.35));
    this.target.set(x, targetY, z);
    if (targetRegion !== this.activeRegionId) {
      void this.activateRegionAt(x, z, targetRegion);
    }
    this.burst(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)));
    this.requestIdleRender();
    this.onTeleport?.(x, z);
  }

  setInitialPosition(x: number, z: number, y?: number) {
    const targetRegion = this.spatial.resolveRegionForPoint(x, z);
    this.spatial.teleport(x, z, y);
    this.player.position.set(x, this.spatial.floorHeight(), z);
    this.syncCameraModeForRegion(targetRegion);
    const targetY =
      this.player.position.y +
      (this.isCloseExplorationCamera()
        ? (this.avatar.activeAvatar === 'elsa' ? 2.4 : 1.75)
        : (this.avatar.activeAvatar === 'elsa' ? 1.85 : 1.35));
    this.target.set(x, targetY, z);
    if (targetRegion !== this.activeRegionId) {
      void this.activateRegionAt(x, z, targetRegion);
    }
    this.resetCamera();
    this.requestIdleRender();
  }

  private createMilo() {
    this.cylinder(this.milo, 0, .65, 0, .45, .7, 1.25, 0x537e7e);
    this.sphere(this.milo, 0, 1.58, 0, .48, 0xffd4ab);
    this.cylinder(this.milo, 0, 2.15, 0, .08, .58, .95, 0x447676);
    this.cylinder(this.milo, 0, 1.82, 0, .75, .75, .12, 0x447676);
    for (const x of [-.16, .16]) this.sphere(this.milo, x, 1.6, .44, .045, 0x293d38);
    this.sphere(this.milo, 0, 1.28, .33, .22, 0xf6f0d9);
    this.box(this.milo, .7, .9, 0, .09, 1.8, .09, 0x9f7248); this.sphere(this.milo, .7, 1.9, 0, .19, 0xffd26a);
    const beacon = this.sphere(this.milo, 0, 3.0, 0, .19, 0xffcf5d);
    beacon.castShadow = false;
    beacon.userData.beacon = true;
    this.miloBeacon = beacon;
  }

  // ─── Dispatch: delegate avatar changes to PlayerAvatar deep module ─────────
  setAvatar(avatarId: AvatarId) {
    this.avatar.setAvatar(avatarId);
  }

  private createBridge() {
    for (let i = 0; i < BRIDGE_PARTS; i++) {
      const part = new THREE.Group(); part.position.x = WORLD.riverMin + i + .5;
      this.box(part, 0, .12, 0, .97, .35, WORLD.bridgeWidth, 0xc3b895);
      this.box(part, 0, .33, 0, .86, .06, WORLD.bridgeWidth - .15, 0xe5d6ae);
      for (const z of [-1.6, 1.6]) { this.box(part, 0, .9, z, .17, 1.3, .17, 0xa98458); this.box(part, 0, 1.35, z, 1.08, .12, .15, 0xbfa479); }
      part.visible = false; this.bridge.add(part);
    }
    for (const x of [3.6, 10.4]) for (const z of [-1.85, 1.85]) { this.cylinder(this.coreRegionGroup, x, .65, z, .23, .3, 1.3, 0xcac09e); this.sphere(this.coreRegionGroup, x, 1.4, z, .28, 0xf4d37c); }
  }

  private createLakeFallback(
    id: number,
    cx: number,
    cz: number,
    color = 0x8ec963,
    parent: THREE.Object3D = this.getOrCreateZoneGroup(id)
  ): THREE.Object3D {
    const disc = this.cylinder(parent, cx, -1.25, cz, LAKE_FALLBACK_RADIUS, LAKE_FALLBACK_RADIUS, 2.5, color, 32);
    disc.receiveShadow = true;
    this.lakeFallbackDiscs.set(id, disc);
    return disc;
  }

  private async loadLakeMap(
    zone: { id: number; center: { x: number; z: number }; template?: string },
    parent: THREE.Object3D = this.getOrCreateZoneGroup(zone.id)
  ): Promise<Obstacle[]> {
    if (this.lakeModels.has(zone.id)) return [];
    const clone = await this.assets.instantiate('map:cozy_lake');
    if (!clone) return [];

    if (this.lakeModels.has(zone.id)) return [];

    const lakeGroup = new THREE.Group();
    lakeGroup.position.set(zone.center.x, 0, zone.center.z);
    lakeGroup.rotation.y = lakeRotationForZone(zone.id);
    lakeGroup.scale.setScalar(LAKE_SCALE);

    clone.position.set(-LAKE_MODEL_CENTER.x, -17.5, -LAKE_MODEL_CENTER.z);
    lakeGroup.add(clone);
    lakeGroup.updateMatrixWorld(true);

    const anchors = computeLakeAnchors(zone.center);
    const zoneMonoliths = this.monoliths.filter(
      (m) => Math.hypot(m.position.x - zone.center.x, m.position.z - zone.center.z) < 20
    );
    const expectedMonolithPos =
      zoneMonoliths.length > 0
        ? zoneMonoliths.map((m) => m.position)
        : computeLakeEntityPositions((zone.template as any) ?? 'GRID_SANCTUARY', 8, zone.center);

    const lakeObstacles: Obstacle[] = [];
    const processedTrunks = new Set<string>();

    lakeGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = (mesh.name || mesh.parent?.name || '').toLowerCase();
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        const distToCenter = Math.hypot(worldPos.x - zone.center.x, worldPos.z - zone.center.z);
        const distToPortal = Math.hypot(worldPos.x - anchors.returnPortal.x, worldPos.z - anchors.returnPortal.z);
        const distToMonolith =
          expectedMonolithPos.length > 0
            ? Math.min(...expectedMonolithPos.map((p) => Math.hypot(worldPos.x - p.x, worldPos.z - p.z)))
            : 999;

        const isProp =
          name.includes('stone') ||
          name.includes('mushroom') ||
          name.includes('rock') ||
          name.includes('pipe') ||
          name.includes('boat') ||
          name.includes('cylinder001');

        if (isProp) {
          if (distToCenter < 3.5 || distToPortal < 3.0 || distToMonolith < 2.5) {
            mesh.visible = false;
          }
        }

        if (name.includes('tree') || name.includes('pine')) {
          if (distToPortal < 3.0 || distToMonolith < 2.5) {
            mesh.visible = false;
          } else if (name.includes('wood') || name.includes('trunk')) {
            const key = `${worldPos.x.toFixed(1)}_${worldPos.z.toFixed(1)}`;
            if (!processedTrunks.has(key)) {
              processedTrunks.add(key);
              lakeObstacles.push({
                x: Number(worldPos.x.toFixed(2)),
                z: Number(worldPos.z.toFixed(2)),
                radius: 0.5
              });
            }
          }
        }
      }
    });

    if (lakeObstacles.length > 0) {
      this.obstacles.push(...lakeObstacles);
    }

    const fallback = this.lakeFallbackDiscs.get(zone.id);
    if (fallback) {
      fallback.removeFromParent();
      this.lakeFallbackDiscs.delete(zone.id);
    }

    if (this.activeZoneIds && !this.activeZoneIds.has(zone.id)) {
      lakeGroup.visible = false;
    }

    parent.add(lakeGroup);
    this.lakeModels.set(zone.id, lakeGroup);
    this.requestIdleRender();
    return lakeObstacles;
  }

  private async loadFarmMap(
    zone: RemoteZoneConfig,
    questions?: RemoteProblem[],
    parent: THREE.Object3D = this.getOrCreateZoneGroup(zone.id)
  ): Promise<Obstacle[]> {
    try {
      if (!this.farmSanctuary) {
        this.farmSanctuary = new FarmSanctuary(this.assets, this.geom);
      }
      this.farmSanctuary.onHomewardSparkle = (pos) => this.burst(pos);

      // Position farm at zone center before terrain extraction so world coordinates match
      this.farmSanctuary.group.position.set(zone.center.x, 0, zone.center.z);

      parent.add(this.farmSanctuary.group);
      if (this.activeZoneIds && !this.activeZoneIds.has(zone.id)) {
        this.farmSanctuary.group.visible = false;
      }

      await this.farmSanctuary.load(this.farmRescued, questions);
      if (this.latestFarmQuestions && this.latestFarmQuestions.length > 0 && this.latestFarmQuestions !== questions) {
        this.farmSanctuary.syncQuestions(this.latestFarmQuestions);
      }

      this.spatial.setFarmTerrain(
        zone.id,
        this.farmSanctuary.terrainSurface,
        this.farmSanctuary.colliderGrid
      );

      // Register shelter obstacles around the Central Farm Pen
      const farmObs = this.farmSanctuary.getObstacles(zone.center);
      if (farmObs.length > 0) {
        this.obstacles.push(...farmObs);
        this.dynamicObstacles.push(...farmObs);
      }
      return farmObs;
    } catch (err) {
      console.error('[World] Failed to load farm map:', err);
      return [];
    }
  }

  private async loadParkMap(
    zone: RemoteZoneConfig,
    questions?: RemoteProblem[],
    parent: THREE.Object3D = this.getOrCreateZoneGroup(zone.id)
  ): Promise<Obstacle[]> {
    if (this.parkModels.has(zone.id)) return [];
    const model = await this.assets.instantiate('map:park');
    if (!model) return [];
    if (this.parkModels.has(zone.id)) return [];

    const parkCx = zone.center.x;
    const parkCz = zone.center.z;
    model.position.set(parkCx, 0, parkCz);
    model.updateMatrixWorld(true);

    const initialBox = new THREE.Box3().setFromObject(model);
    const initialSize = new THREE.Vector3();
    initialBox.getSize(initialSize);
    const scaledRadius = Math.max(initialSize.x, initialSize.z) / 2;

    parent.add(model);
    this.parkModels.set(zone.id, model);
    if (this.activeZoneIds && !this.activeZoneIds.has(zone.id)) {
      model.visible = false;
    }
    this.spatial.setParkZone(parkCx, parkCz, scaledRadius, zone.name, zone.id);

    // Detect all Tree and Pine meshes for challenges
    const treeMeshes: { mesh: THREE.Mesh; center: THREE.Vector3; box: THREE.Box3; angle: number }[] = [];
    const parkObstacles: Obstacle[] = [];

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = (mesh.name || mesh.parent?.name || '').toLowerCase();
        const isTreeOrPine = name.includes('pine') || name.includes('tree');
        const isObstacleCandidate =
          isTreeOrPine ||
          name.includes('lamp') ||
          name.includes('stone') ||
          name.includes('rock') ||
          name.includes('cylinder01') ||
          name.includes('cube00');

        if (isObstacleCandidate) {
          const box = new THREE.Box3().setFromObject(mesh);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          const radius = Math.max(0.4, Math.min(2.0, Math.max(size.x, size.z) * 0.35));
          parkObstacles.push({
            x: Number(center.x.toFixed(2)),
            z: Number(center.z.toFixed(2)),
            radius: Number(radius.toFixed(2))
          });

          if (isTreeOrPine) {
            const angle = Math.atan2(center.z - parkCz, center.x - parkCx);
            treeMeshes.push({ mesh, center, box, angle });
          }
        }
      }
    });

    this.obstacles.push(...parkObstacles);

    // Sort trees in a circular sequence starting near the eastern entrance
    treeMeshes.sort((a, b) => {
      const normA = (a.angle - 0.25 + 2 * Math.PI) % (2 * Math.PI);
      const normB = (b.angle - 0.25 + 2 * Math.PI) % (2 * Math.PI);
      return normA - normB;
    });

    const activeQuestions = questions || [];
    const treePositions: { x: number; z: number }[] = [];
    const zoneTrees: ParkTreeEntity[] = [];
    treeMeshes.forEach((item, idx) => {
      const origMat = item.mesh.material as THREE.Material;
      const grayMat = new THREE.MeshStandardMaterial({
        color: 0x7a8288,
        roughness: 0.85,
        metalness: 0.05
      });

      const q = idx < activeQuestions.length ? activeQuestions[idx] : null;
      const hasQuestion = q !== null;
      const questionColor = q?.color || zone.color || 0x10b981;

      let coloredMat: THREE.Material | undefined;
      if (origMat && (origMat as any).isMeshStandardMaterial) {
        coloredMat = (origMat as THREE.MeshStandardMaterial).clone();
        if (q?.color) {
          (coloredMat as THREE.MeshStandardMaterial).color.set(q.color);
        }
      }

      const isAwakened = hasQuestion ? (this.isParkTreeAwakened?.(idx) ?? false) : true;

      // Cây không có câu hỏi: TỰ TÔ MÀU theo thiết kế gốc của park.glb (origMat)
      // Cây có câu hỏi: nếu đã thức tỉnh thì mang màu sắc tươi sáng (coloredMat || origMat), nếu ngủ say thì xám (grayMat)
      item.mesh.material = hasQuestion ? (isAwakened ? (coloredMat || origMat) : grayMat) : origMat;

      // Overhead guide beacon: chỉ hiển thị cho cây CÓ câu hỏi và ĐANG NGỦ SAY
      let beacon: THREE.Mesh | undefined;
      if (hasQuestion) {
        beacon = this.sphere(parent, item.center.x, item.box.max.y + 0.6, item.center.z, 0.32, questionColor);
        beacon.castShadow = false;
        beacon.visible = !isAwakened;
      }

      zoneTrees.push({
        index: idx,
        id: idx + 1,
        mesh: item.mesh,
        originalMaterial: origMat,
        grayMaterial: grayMat,
        coloredMaterial: coloredMat,
        position: item.center.clone(),
        beacon,
        topY: item.box.max.y + 0.6,
        awakened: isAwakened,
        hasQuestion,
        questionColor
      });

      // Spatial proximity: chỉ kích hoạt tương tác cho cây CÓ câu hỏi
      if (hasQuestion) {
        treePositions.push({ x: Number(item.center.x.toFixed(2)), z: Number(item.center.z.toFixed(2)) });
      }
    });

    this.parkTreesByZone.set(zone.id, zoneTrees);
    this.parkTreePositionsByZone.set(zone.id, treePositions);
    this.parkTrees.splice(0, this.parkTrees.length, ...zoneTrees);
    this.spatial.setParkTreePositions(treePositions);
    return parkObstacles;
  }

  wakeParkTree(index: number) {
    const tree = this.parkTrees[index];
    if (!tree || !tree.hasQuestion) return;
    tree.awakened = true;
    tree.mesh.material = tree.coloredMaterial || tree.originalMaterial;
    if (tree.beacon) {
      tree.beacon.visible = false;
    }
    this.burst(new THREE.Vector3(tree.position.x, tree.topY, tree.position.z));
  }

  syncAwakenedParkTrees(awakenedList: boolean[]) {
    this.parkTrees.forEach((tree, idx) => {
      if (!tree.hasQuestion) {
        // Cây không có câu hỏi: tự tô màu, giữ nguyên thiết kế gốc
        tree.awakened = true;
        tree.mesh.material = tree.originalMaterial;
        if (tree.beacon) tree.beacon.visible = false;
        return;
      }
      const isAwakened = awakenedList[idx] === true;
      tree.awakened = isAwakened;
      tree.mesh.material = isAwakened ? (tree.coloredMaterial || tree.originalMaterial) : tree.grayMaterial;
      if (tree.beacon) tree.beacon.visible = !isAwakened;
    });
  }

  syncParkQuestions(questions: RemoteProblem[], zoneColor = 0x10b981, zoneId?: number) {
    const activePositions: { x: number; z: number }[] = [];
    const targetTrees = zoneId !== undefined ? (this.parkTreesByZone.get(zoneId) ?? this.parkTrees) : this.parkTrees;
    const beaconParent = zoneId !== undefined ? this.getOrCreateZoneGroup(zoneId) : this.activeMountedGroup;
    targetTrees.forEach((tree, idx) => {
      const q = idx < questions.length ? questions[idx] : null;
      const hasQuestion = q !== null;
      const qColor = q?.color || zoneColor;

      tree.hasQuestion = hasQuestion;
      tree.questionColor = qColor;

      if (tree.originalMaterial && (tree.originalMaterial as any).isMeshStandardMaterial) {
        const coloredMat = (tree.originalMaterial as THREE.MeshStandardMaterial).clone();
        if (q?.color) {
          coloredMat.color.set(q.color);
        }
        tree.coloredMaterial = coloredMat;
      }

      if (!hasQuestion) {
        // Tự tô màu và không hiển thị câu hỏi
        tree.awakened = true;
        tree.mesh.material = tree.originalMaterial;
        if (tree.beacon) tree.beacon.visible = false;
      } else {
        const isAwakened = this.isParkTreeAwakened?.(idx) ?? false;
        tree.awakened = isAwakened;
        tree.mesh.material = isAwakened ? (tree.coloredMaterial || tree.originalMaterial) : tree.grayMaterial;
        if (!tree.beacon) {
          tree.beacon = this.sphere(beaconParent, tree.position.x, tree.topY, tree.position.z, 0.32, qColor);
          tree.beacon.castShadow = false;
        } else {
          (tree.beacon.material as THREE.MeshStandardMaterial).color.set(qColor);
        }
        tree.beacon.visible = !isAwakened;
        activePositions.push({ x: Number(tree.position.x.toFixed(2)), z: Number(tree.position.z.toFixed(2)) });
      }
    });

    if (zoneId !== undefined) {
      this.parkTreePositionsByZone.set(zoneId, activePositions);
    }
    if (zoneId === undefined || this.activeRegionId === `zone:${zoneId}`) {
      this.spatial.setParkTreePositions(activePositions);
    }
  }

  setBridge(count: number, animate = false) {
    this.bridgeCount = count;
    this.spatial.setBridgeBuilt(count);
    this.bridge.children.forEach((part, i) => { part.visible = i < count; if (animate && i === count - 1) { part.position.y = 3; this.burst(new THREE.Vector3(part.position.x, .8, 0)); } });
  }

  private decorate() {
    let seed = 48; const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.11, 0), this.material(0xffe1a1), 220);
    const stems = new THREE.InstancedMesh(new THREE.ConeGeometry(.1, .35, 3), this.material(0x61a450), 220);
    flowers.castShadow = false; stems.castShadow = false;
    const dummy = new THREE.Object3D(); let n = 0;
    while (n < 220) {
      const x = random() * 52 - 21, z = random() * 37 - 18.5;
      if ((x > 3.4 && x < 10.5) || Math.abs(z) < 2 || (x > 10.5 && x < 33 && Math.abs(z) < 3.2) || Math.hypot(x - 22, z) < 3.5) continue;
      dummy.position.set(x, .19, z); dummy.rotation.y = random() * 6; dummy.updateMatrix(); stems.setMatrixAt(n, dummy.matrix);
      dummy.position.y = .39; dummy.updateMatrix(); flowers.setMatrixAt(n, dummy.matrix);
      flowers.setColorAt(n, new THREE.Color([0xffe4a3, 0xf5f0d7, 0xe9a98e, 0xbdabe0][n % 4])); n++;
    }
    this.freezeStatic(flowers);
    this.freezeStatic(stems);
    this.coreRegionGroup.add(flowers, stems);

    this.cloudMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), this.material(0xf4fcf5), 40);
    this.cloudMesh.name = 'village_clouds_batch';
    this.cloudMesh.castShadow = false;
    this.cloudMesh.receiveShadow = false;
    let cIdx = 0;
    for (let i = 0; i < 10; i++) {
      this.cloudGroupX.push(-36 + i * 8);
      for (let j = 0; j < 4; j++) {
        const r = .95 + (j % 2) * .4;
        const slot = {
          groupIdx: i,
          ox: j * 1.1,
          oy: Math.sin(j) * .35,
          oz: -27 - (i % 2) * 7,
          sx: 1.4 * r,
          sy: 0.65 * r,
          sz: r
        };
        this.cloudSlots.push(slot);
        this.instDummy.position.set(this.cloudGroupX[i] + slot.ox, 11 + (i % 3) * 2 + slot.oy, slot.oz);
        this.instDummy.rotation.set(0, 0, 0);
        this.instDummy.scale.set(slot.sx, slot.sy, slot.sz);
        this.instDummy.updateMatrix();
        this.cloudMesh.setMatrixAt(cIdx++, this.instDummy.matrix);
      }
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.cloudMesh.frustumCulled = false;
    this.disposableInstancedMeshes.push(this.cloudMesh);
    this.coreRegionGroup.add(this.cloudMesh);

    const rockMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.8, 8, 6), this.material(0xb9ac8e), 9);
    rockMesh.name = 'village_border_rocks_batch';
    rockMesh.castShadow = false;
    rockMesh.receiveShadow = true;
    for (let i = 0; i < 9; i++) {
      this.instDummy.position.set(-20 + i * 5, -2.4, 21);
      this.instDummy.rotation.set(0, 0, 0);
      this.instDummy.scale.set(1.3, .7, .9);
      this.instDummy.updateMatrix();
      rockMesh.setMatrixAt(i, this.instDummy.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    rockMesh.computeBoundingSphere();
    this.freezeStatic(rockMesh);
    this.disposableInstancedMeshes.push(rockMesh);
    this.coreRegionGroup.add(rockMesh);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestIdleRender();
  }
  private floorHeight() { return this.spatial.floorHeight(); }
  jump() { if (this.active && !this.paused && this.spatial.jump()) { this.onJump?.(); } }
  clearInput() { this.keys.clear(); this.joystick = { x: 0, y: 0 }; this.pointerController.reset(); }
  resetCamera() {
    if (this.cameraMode === 'qhmj') {
      this.yaw = Math.PI / 2;
      this.pitch = 0.14;
      this.distance = 2.4;
      return;
    }
    if (this.cameraMode === 'farm') {
      this.yaw = FARM_CAMERA_DEFAULTS.yaw;
      this.pitch = FARM_CAMERA_DEFAULTS.pitch;
      this.distance = FARM_CAMERA_DEFAULTS.distance;
      return;
    }
    this.yaw = .57;
    this.pitch = .42;
    this.distance = 13.5;
    this.avatar.group.visible = true;
  }

  private interactAtScreen(x: number, y: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.scratchPointer.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1
    );
    this.scratchRay.setFromCamera(this.scratchPointer, this.camera);

    const isFarmMounted = Boolean(this.farmSanctuary && this.farmSanctuary.group.visible && this.farmSanctuary.group.parent === this.activeMountedGroup);

    // 1. Direct 3D raycast on farm animals
    if (isFarmMounted && this.farmSanctuary) {
      const animalHit = this.farmSanctuary.findAnimalAtRay(this.scratchRay);
      if (animalHit) {
        this.onFarmAnimalClick?.(animalHit.id);
        return;
      }
    }

    // 1b. Direct 3D raycast on QHMJ crystals / jump gates (required for elevated multi-level roads)
    const qhmjBuild = this.activeQhmjBuild();
    if (qhmjBuild) {
      const qhmjHit = qhmjBuild.entities.findNodeAtRay(this.scratchRay);
      if (qhmjHit) {
        const horiz = Math.hypot(
          this.player.position.x - qhmjHit.spec.position.x,
          this.player.position.z - qhmjHit.spec.position.z
        );
        const dy = Math.abs(this.player.position.y - qhmjHit.spec.position.y);
        if (horiz <= 5.0 && dy <= 2.8) {
          this.onQhmjNodeClick?.(qhmjBuild.zoneId, qhmjHit.spec.index);
          return;
        }
      }
    }

    const hit = this.scratchHit;
    if (this.scratchRay.ray.intersectPlane(this.scratchRayPlane, hit)) {
      // 2. Click near farm animal on ground plane
      if (isFarmMounted && this.farmSanctuary) {
        this.scratchLocalHit.copy(hit).sub(this.farmSanctuary.group.position);
        const nearAnimal = this.farmSanctuary.findAnimalNearPoint(this.scratchLocalHit, 2.5);
        if (nearAnimal) {
          this.onFarmAnimalClick?.(nearAnimal.id);
          return;
        }
      }
      if (hit.distanceTo(this.milo.position) < 2.8 && this.nearMilo()) {
        this.onSceneClick?.(true);
        return;
      }
      if (hit.distanceTo(this.portalPos) < 3.2 && this.spatial.isNearPortal()) {
        this.onPortalClick?.();
        return;
      }
      const nearFlowerIdx = this.nearFlower();
      if (nearFlowerIdx !== -1 && hit.distanceTo(this.flowers[nearFlowerIdx].position) < 3.0) {
        this.onFlowerClick?.(nearFlowerIdx);
        return;
      }
      for (let i = 0; i < this.flowers.length; i++) {
        if (hit.distanceTo(this.flowers[i].position) < 2.5 && this.nearFlower() === i) {
          this.onFlowerClick?.(i);
          return;
        }
      }
      const nearMonolithIdx = this.nearMonolith();
      if (nearMonolithIdx !== -1 && hit.distanceTo(this.monoliths[nearMonolithIdx].position) < 3.2) {
        this.onMonolithClick?.(nearMonolithIdx, this.monoliths[nearMonolithIdx].id);
        return;
      }
      for (let i = 0; i < this.monoliths.length; i++) {
        if (hit.distanceTo(this.monoliths[i].position) < 2.8 && this.nearMonolith() === i) {
          this.onMonolithClick?.(i, this.monoliths[i].id);
          return;
        }
      }
      const nearParkTreeIdx = this.spatial.nearParkTreeIndex();
      if (nearParkTreeIdx !== -1 && hit.distanceTo(this.parkTrees[nearParkTreeIdx].position) < 3.2) {
        if (this.parkTrees[nearParkTreeIdx]?.hasQuestion) {
          this.onParkTreeClick?.(nearParkTreeIdx);
          return;
        }
      }
      for (let i = 0; i < this.parkTrees.length; i++) {
        if (this.parkTrees[i]?.hasQuestion && hit.distanceTo(this.parkTrees[i].position) < 3.2 && this.spatial.nearParkTreeIndex() === i) {
          this.onParkTreeClick?.(i);
          return;
        }
      }
      if (hit.distanceTo(this.shopWorldPos) < 3.5 && this.spatial.isNearShop()) {
        this.onShopClick?.();
        return;
      }
      // Direct Locomotion: Clicking empty ground or far away objects does NOT auto-walk.
    }
  }

  nearMilo() { return this.spatial.isNearMilo(); }
  nearShop() { return this.spatial.isNearShop(); }

  setEquippedTrail(trailId: string) {
    this.equippedTrail = trailId;
  }

  private movement(dt: number) {
    const pose = this.spatial.tick(dt, { keys: this.keys, joystick: this.joystick }, this.yaw);
    this.player.position.set(pose.x, pose.y, pose.z);
    this.player.rotation.y = pose.rotation;
    this.avatar.updateWalkAnimation(this.time, pose.moving);

    const transit = this.spatial.checkPortalTransit(dt, { deferTeleport: true });
    if (transit && !this.pendingPortalTransit) {
      this.pendingPortalTransit = transit;
    }

    if (pose.moving && this.equippedTrail) {
      this.trailTimer += dt;
      if (this.trailTimer >= 0.09) {
        this.trailTimer = 0;
        this.geom.emitTrail(pose.x, pose.y, pose.z, this.equippedTrail);
      }
    }
  }

  burst(position: THREE.Vector3 | { x: number; y: number; z: number }) {
    this.geom.emitBurst(position.x, position.y, position.z);
  }

  burstPlayer(offsetY = 1.0) {
    this.geom.emitBurst(this.player.position.x, this.player.position.y + offsetY, this.player.position.z);
  }

  project(point: THREE.Vector3 | { x: number; y: number; z: number }) {
    const v = this.scratchProj.set(point.x, point.y, point.z).project(this.camera);
    return { x: (v.x * .5 + .5) * this.canvas.clientWidth, y: (-.5 * v.y + .5) * this.canvas.clientHeight, visible: v.z < 1 };
  }

  private isLoopActive(): boolean {
    const hidden = typeof document !== 'undefined' ? document.hidden : false;
    return shouldRunRenderLoop(this._active, this._paused, hidden);
  }

  private handleVisibilityChange = () => {
    this.syncRenderLoopState();
  };

  private syncRenderLoopState(): void {
    if (this.isLoopActive()) {
      if (this.idleFrame) {
        cancelAnimationFrame(this.idleFrame);
        this.idleFrame = 0;
      }
      this.clock.getDelta(); // discard elapsed idle delta
      this.accumulator = 0;
      if (!this.frame) {
        this.frame = requestAnimationFrame(this.animate);
      }
    } else {
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
      this.renderFrame(0);
    }
  }

  private requestIdleRender(): void {
    if (this.frame || this.idleFrame) return;
    this.idleFrame = requestAnimationFrame(() => {
      this.idleFrame = 0;
      if (!this.frame) {
        this.renderFrame(0);
      }
    });
  }

  private animate = () => {
    if (!this.isLoopActive()) {
      this.frame = 0;
      return;
    }
    this.frame = requestAnimationFrame(this.animate);
    const rawDt = Math.min(this.clock.getDelta(), 0.1);
    this.renderFrame(rawDt);
  };

  private renderFrame(rawDt: number): void {
    this.time += rawDt;

    const isFarmRegionActive = Boolean(this.farmSanctuary && this.farmSanctuary.group.parent === this.activeMountedGroup && this.farmSanctuary.group.visible);

    // Fixed-step simulation: physics & movement update at a constant 60Hz rate
    this.accumulator += rawDt;
    let steps = 0;
    while (this.accumulator >= this.FIXED_DT && steps < this.MAX_SUB_STEPS) {
      if (this._active && !this._paused) {
        this.movement(this.FIXED_DT);
        if (isFarmRegionActive && this.farmSanctuary) {
          this.farmSanctuary.update(this.FIXED_DT, this.player.position);
        }
      }
      this.accumulator -= this.FIXED_DT;
      steps++;
    }
    if (this.accumulator >= this.FIXED_DT) {
      this.accumulator = 0; // prevent spiral of death
    }

    // Presentation tick: unified third-person camera lerp & procedural animations using rawDt
    const qhmjBuild = this.activeQhmjBuild();
    const isNearFps = this.isCloseExplorationCamera();
    const wantedY = isNearFps
      ? (this.avatar.activeAvatar === 'elsa' ? 2.4 : 1.75)
      : (this.avatar.activeAvatar === 'elsa' ? 1.85 : 1.35);
    if (this._active) {
      this.scratchWanted.set(this.player.position.x, wantedY + this.player.position.y, this.player.position.z);
    } else {
      this.scratchWanted.set(-7, 1.35, 0);
    }
    const lerpSpeed = isNearFps ? 20 : 14;
    if (rawDt > 0) {
      this.target.lerp(this.scratchWanted, 1 - Math.exp(-rawDt * lerpSpeed));
    } else {
      this.target.copy(this.scratchWanted);
    }
    if (qhmjBuild) {
      updateQhmjAnimation(qhmjBuild, this.time, rawDt);
    }
    const distance = this._active ? this.distance : (this.camera.aspect < .85 ? 54 : 44);
    if (this._active) {
      this.avatar.group.visible = distance >= 1.8;
    } else if (!this.avatar.group.visible) {
      this.avatar.group.visible = true;
    }
    let camY = this.target.y + Math.sin(this.pitch) * distance;
    if (this._active) {
      camY = Math.max(camY, this.player.position.y + 0.55);
    }
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      camY,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance
    );
    this.camera.lookAt(this.target);

    if (this.activeRegionId === 'core') {
      this.windmill.rotation.z -= rawDt * .25;
      const bridgeParts = this.bridge.children;
      for (let i = 0; i < bridgeParts.length; i++) {
        if (bridgeParts[i].position.y > 0) {
          bridgeParts[i].position.y = Math.max(0, bridgeParts[i].position.y - rawDt * 5);
        }
      }

      if (rawDt > 0) {
        for (let i = 0; i < this.cloudGroupX.length; i++) {
          let gx = this.cloudGroupX[i] + rawDt * .12;
          if (gx > 50) gx = -50;
          this.cloudGroupX[i] = gx;
        }
        for (let i = 0; i < this.cloudSlots.length; i++) {
          const cs = this.cloudSlots[i];
          const gy = 11 + (cs.groupIdx % 3) * 2 + Math.sin(this.time * .2 + cs.groupIdx) * .3;
          this.instDummy.position.set(this.cloudGroupX[cs.groupIdx] + cs.ox, gy + cs.oy, cs.oz);
          this.instDummy.rotation.set(0, 0, 0);
          this.instDummy.scale.set(cs.sx, cs.sy, cs.sz);
          this.instDummy.updateMatrix();
          this.cloudMesh.setMatrixAt(i, this.instDummy.matrix);
        }
        this.cloudMesh.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < this.rippleSlots.length; i++) {
          const rs = this.rippleSlots[i];
          rs.z += rawDt * .25;
          if (rs.z > 19) rs.z = -19;
          this.instDummy.position.set(rs.x, 0.05, rs.z);
          this.instDummy.rotation.set(0, 0, 0);
          this.instDummy.scale.set(rs.sx, 1, 1);
          this.instDummy.updateMatrix();
          this.rippleMesh.setMatrixAt(i, this.instDummy.matrix);
        }
        this.rippleMesh.instanceMatrix.needsUpdate = true;
      }

      if (this.miloBeacon) {
        this.miloBeacon.position.y = 3 + Math.sin(this.time * 2) * .15;
      }

      // Animate the 10 flowers (indexed loop, zero per-frame closure allocations)
      for (let i = 0; i < this.flowers.length; i++) {
        const f = this.flowers[i];
        if (f.beacon) {
          f.beacon.visible = !f.bloomed;
          if (f.beacon.visible) {
            f.beacon.position.y = .75 + Math.sin(this.time * 2.5 + i) * .12;
          }
        }
        if (f.animating) {
          f.bloomAnim = Math.min(1, f.bloomAnim + rawDt * 2.0);
          if (f.bloomAnim >= 1) {
            f.bloomAnim = 1;
            f.animating = false;
          }
          const s = THREE.MathUtils.lerp(0.001, 1.0, f.bloomAnim);
          f.bloom.scale.setScalar(s);
          f.bud.scale.setScalar(Math.max(0.001, 1 - f.bloomAnim));
          if (Math.random() < 0.25) {
            this.geom.emitBurst(f.position.x, 2.0, f.position.z);
          }
        }
        if (f.bloomed) {
          f.bloom.rotation.y += rawDt * 0.35;
        }
      }

      if (this.shopBeacon) {
        this.shopBeacon.rotation.z += rawDt * 1.5;
      }
    }

    // Animate park tree beacons only when inside a park region
    if (this.activeRegionId.startsWith('zone:')) {
      for (let i = 0; i < this.parkTrees.length; i++) {
        const t = this.parkTrees[i];
        if (t.beacon && t.beacon.visible) {
          t.beacon.position.y = t.topY + Math.sin(this.time * 2.5 + t.index) * 0.15;
        }
      }
    }

    this.archimedes.updateAnimations(rawDt, this.time);
    this.geom.updateEffects(rawDt);

    let nearFarmId: string | null = null;
    if (isFarmRegionActive && this.farmSanctuary) {
      const px = this.player.position.x;
      const py = this.player.position.y;
      const pz = this.player.position.z;
      const farmX = this.farmSanctuary.group.position.x;
      const farmZ = this.farmSanctuary.group.position.z;
      const triggers = this.farmSanctuary.getInteractTriggers();
      for (let i = 0; i < triggers.length; i++) {
        const t = triggers[i];
        if (
          t.isActive &&
          Math.hypot(px - (farmX + t.position.x), pz - (farmZ + t.position.z)) < t.radius &&
          Math.abs(py - t.position.y) <= 3.0
        ) {
          nearFarmId = t.animalId;
          break;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);

    const nearPortal = this.spatial.getNearPortal();
    if (nearPortal) {
      if (this.lastPrefetchedPortalKey !== nearPortal.id) {
        this.lastPrefetchedPortalKey = nearPortal.id;
        let targetTemplate: string | undefined;
        if (!nearPortal.requiresSelection && 'target' in nearPortal && (nearPortal as PortalLink).target) {
          const destRegion =
            (nearPortal as PortalLink).targetRegionId ??
            this.spatial.resolveRegionForPoint((nearPortal as PortalLink).target.x, (nearPortal as PortalLink).target.z);
          if (destRegion.startsWith('zone:')) {
            const zId = Number(destRegion.slice(5));
            targetTemplate = this.dynamicZoneById.get(zId)?.template ?? STATIC_LAKE_SANCTUARIES.find((s) => s.id === zId)?.template;
          }
        }
        this.assets.prefetchForPortal(nearPortal.id, targetTemplate);
      }
    } else if (this.lastPrefetchedPortalKey) {
      this.lastPrefetchedPortalKey = '';
    }

    const transit = this.pendingPortalTransit;
    this.pendingPortalTransit = null;

    const emitHudPoses = rawDt === 0 || transit !== null || this.hudFrameTick++ % 3 === 0;
    const hudPoses = emitHudPoses
      ? {
          miloPose: this.project({ x: -3, y: 3.5, z: 1.5 }),
          bridgePose: this.project({ x: 7, y: 0.8, z: 0 }),
          portalPose: this.project(
            nearPortal
              ? {
                  x: nearPortal.source.x,
                  y: (this.isCloseExplorationCamera() ? this.player.position.y : 0) + 3.8,
                  z: nearPortal.source.z
                }
              : { x: this.portalPos.x, y: this.portalPos.y + 4.4, z: this.portalPos.z }
          )
        }
      : undefined;

    this.onFrame?.({
      active: this._active,
      paused: this._paused,
      fps: 1 / Math.max(rawDt, .001),
      playerPosition: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
      activeRegionId: this.activeRegionId,
      cameraYaw: this.yaw,
      locationName: this.spatial.getCurrentLocationName(),
      inGarden: this.spatial.isInGarden(),
      inArchimedes: this.spatial.isInArchimedesRealm(),
      nearMilo: this.spatial.isNearMilo(),
      crossedRiver: this.spatial.hasCrossedRiver(),
      nearFlowerIndex: this.spatial.nearFlowerIndex(),
      nearMonolithIndex: this.spatial.nearMonolithIndex(),
      nearParkTreeIndex: this.spatial.nearParkTreeIndex(),
      nearShop: this.spatial.isNearShop(),
      nearFarmAnimalId: nearFarmId,
      nearQhmjNodeIndex: this.spatial.nearQhmjNodeIndex(),
      nearPortal,
      portalTransit: transit,
      hudPoses
    });
  }

  setFarmRescued(rescued: Record<string, boolean>) {
    this.farmRescued = rescued;
  }

  setFocusedFarmAnimal(animalId: string | null) {
    this.farmSanctuary?.setFocusedAnimal(animalId);
  }

  dispose() {
    this.pointerController.reset();
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.idleFrame);
    this.frame = 0;
    this.idleFrame = 0;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.observer.disconnect();
    this.zoneRegionGroups.clear();
    this.loadedZoneRegions.clear();
    this.pendingZoneLoads.clear();
    for (let i = 0; i < this.disposableInstancedMeshes.length; i++) {
      const m = this.disposableInstancedMeshes[i];
      m.geometry.dispose();
      m.dispose();
    }
    this.disposableInstancedMeshes = [];
    this.avatar.dispose();
    this.farmSanctuary?.dispose();
    this.geom.dispose();
    this.assets.dispose();
    this.renderer.dispose();
  }
}
