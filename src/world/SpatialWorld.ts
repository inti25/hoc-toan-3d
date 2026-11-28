import { BRIDGE_PARTS, WORLD } from '../data/config';
import { ARCHIMEDES_MONOLITHS } from '../data/archimedesTrialMap';
import { QHMJ_SPEED } from '../data/qhmjMap';
import {
  FARM_FENCE_JUMP_CLEARANCE,
  FARM_PLAYABLE_BOUNDS,
  FARM_REGION_RADIUS,
  FARM_SPEED
} from '../data/farmMap';
import { RoadSurface } from './qhmj/RoadSurface';
import { evalJumpArc, type JumpLink } from './qhmj/JumpLinks';
import type { FarmColliderGrid } from './farm/FarmTerrain';
import {
  LAKE_WALK_INNER,
  LAKE_WALK_OUTER,
  computeLakeAnchors,
  usesLakeTerrain
} from '../data/lakeLand';

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

export interface SpatialInput {
  keys: Set<string>;
  joystick: { x: number; y: number };
  destination?: { x: number; z: number };
}

export interface PlayerPose {
  x: number;
  y: number;
  z: number;
  rotation: number;
  moving: boolean;
  speed: number;
}

export interface PortalLink {
  id: string;
  name: string;
  source: { x: number; z: number };
  target: { x: number; z: number };
  triggerRadius: number;
  requiresSelection?: boolean;
  targetRegionId?: string;
}

const DEFAULT_LAKE_SANCTUARIES = [
  { id: 1, cx: 110, cz: -60 },
  { id: 2, cx: 150, cz: -60 },
  { id: 3, cx: 110, cz: 60 },
  { id: 4, cx: 150, cz: 60 },
  { id: 5, cx: 190, cz: 0 }
] as const;

const z1Anchors = computeLakeAnchors({ x: 110, z: -60 });
const z2Anchors = computeLakeAnchors({ x: 150, z: -60 });
const z3Anchors = computeLakeAnchors({ x: 110, z: 60 });
const z4Anchors = computeLakeAnchors({ x: 150, z: 60 });
const z5Anchors = computeLakeAnchors({ x: 190, z: 0 });

export const PORTAL_LINKS: PortalLink[] = [
  // Garden <-> Hub
  { id: 'garden_to_hub', name: 'Đến Đền Cổng Archimedes', source: { x: 32, z: 0 }, target: { x: 55, z: 0 }, triggerRadius: 1.85 },
  { id: 'hub_to_garden', name: 'Về Vườn Hoa Tri Thức', source: { x: 52, z: 0 }, target: { x: 30, z: 0 }, triggerRadius: 1.85 },

  // Hub <-> Zone 1 (Thung Lũng Tính Toán)
  { id: 'hub_to_z1', name: 'Đến Thung Lũng Tính Toán', source: { x: 68, z: -8 }, target: z1Anchors.arrival, triggerRadius: 1.85 },
  { id: 'z1_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z1Anchors.returnPortal.x, z: z1Anchors.returnPortal.z }, target: { x: 65, z: -8 }, triggerRadius: 1.85 },

  // Hub <-> Zone 2 (Suối Nguồn Dãy Số)
  { id: 'hub_to_z2', name: 'Đến Suối Nguồn Dãy Số', source: { x: 70, z: -4 }, target: z2Anchors.arrival, triggerRadius: 1.85 },
  { id: 'z2_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z2Anchors.returnPortal.x, z: z2Anchors.returnPortal.z }, target: { x: 67, z: -4 }, triggerRadius: 1.85 },

  // Hub <-> Zone 3 (Đồi Thời Gian)
  { id: 'hub_to_z3', name: 'Đến Đồi Thời Gian', source: { x: 70, z: 0 }, target: z3Anchors.arrival, triggerRadius: 1.85 },
  { id: 'z3_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z3Anchors.returnPortal.x, z: z3Anchors.returnPortal.z }, target: { x: 67, z: 0 }, triggerRadius: 1.85 },

  // Hub <-> Zone 4 (Rừng Hình Học)
  { id: 'hub_to_z4', name: 'Đến Rừng Hình Học', source: { x: 70, z: 4 }, target: z4Anchors.arrival, triggerRadius: 1.85 },
  { id: 'z4_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z4Anchors.returnPortal.x, z: z4Anchors.returnPortal.z }, target: { x: 67, z: 4 }, triggerRadius: 1.85 },

  // Hub <-> Zone 5 (Đỉnh Núi Tư Duy Sao)
  { id: 'hub_to_z5', name: 'Đến Đỉnh Núi Tư Duy Sao', source: { x: 68, z: 8 }, target: z5Anchors.arrival, triggerRadius: 1.85 },
  { id: 'z5_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z5Anchors.returnPortal.x, z: z5Anchors.returnPortal.z }, target: { x: 65, z: 8 }, triggerRadius: 1.85 }
];

export const FLOWER_COORDS: [number, number][] = [
  [14, -6.0], [18, -6.0], [22, -8.5], [26, -6.0], [30, -6.0],
  [14, 6.0], [18, 6.0], [22, 8.5], [26, 6.0], [30, 6.0]
];

export interface QhmjNodeAnchor {
  index: number;
  x: number;
  y: number;
  z: number;
}

export interface QhmjZoneState {
  id: number;
  name: string;
  cx: number;
  cz: number;
  radius: number;
  spawn: { x: number; y: number; z: number };
  surface: RoadSurface | null;
  links: JumpLink[];
  nodes: QhmjNodeAnchor[];
  lockedLinkIds: Set<number>;
}

export interface FarmZoneState {
  id: number;
  name: string;
  cx: number;
  cz: number;
  radius: number;
  spawn: { x: number; y: number; z: number };
  baseSpeed?: number;
  template?: 'FARM_SANCTUARY' | 'FARM_RACE';
  surface: RoadSurface | null;
  colliders: FarmColliderGrid | null;
}

/** Cửa sổ độ cao khi bám mặt đường: bước lên tối đa / xuống tối đa so với độ cao hiện tại. */
const ROAD_STEP_UP = 1.3;
const ROAD_STEP_DOWN = 3.5;
/** Các góc lệch thử khi đi chéo ra rìa đường để trượt dọc mép. */
const ROAD_SLIDE_ANGLES = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4];

export class SpatialWorld {
  private x: number;
  private y = 0;
  private z: number;
  private rotation = 0;
  private jumpVelocity = 0;
  private bridgeCount = 0;
  private portalCooldown = 0;
  private obstacles: Obstacle[] = [];
  private activeZoneIds: Set<number> = new Set([1, 2, 3, 4, 5]);
  private regionScopingEnabled = false;
  private activeRegionId = 'core';
  private regionObstacles = new Map<string, Obstacle[]>();
  readonly miloPos = { x: -3, z: 1.5 };
  readonly shopPos = { x: -12.4, z: -3.5 };

  constructor(initialX = -6, initialZ = 6) {
    this.x = initialX;
    this.z = initialZ;
    this.initDefaultObstacles();
  }

  private initDefaultObstacles() {
    const coreObs: Obstacle[] = [
      { x: -3, z: 1.5, radius: .85 }, // Milo
      { x: -12, z: -6, radius: 2.35 * 1.25 }, // House 1
      { x: -17, z: 6, radius: 2.35 * .9 }, // House 2
      { x: -4, z: -11, radius: 2.35 }, // House 3
      { x: -15, z: -14, radius: 1.8 } // Mill
    ];

    // Trees
    [
      [-20,-14,1.3],[-20,-8,1],[-20,-3.8,1.1],[-20,3.8,1.1],[-20,13,1.3],[-14,14,1.1],[-7,16,1.4],[-2,13,1.1],[1,17,1.2],[0,-16,1.5],[1,-8,1],[-8,-17,1.2],
      [13,-15,1.3],[18,-17,1.5],[25,-16,1.2],[32,-12,1.3],[33,-5,1.1],[33,5,1.1],[32,12,1.3],[25,16,1.2],[18,17,1.5],[13,15,1.3]
    ].forEach(([tx, tz, s]) => {
      coreObs.push({ x: tx, z: tz, radius: .45 * s });
    });

    // Arch, Fountain, Benches, Lanterns, Flowers
    coreObs.push({ x: 11.2, z: -2.2, radius: .5 }, { x: 11.2, z: 2.2, radius: .5 });
    coreObs.push({ x: 22, z: 0, radius: 2.3 });
    [[-2.5, -2.5], [-2.5, 2.5], [2.5, -2.5], [2.5, 2.5]].forEach(([bx, bz]) => {
      coreObs.push({ x: 22 + bx, z: bz, radius: .7 });
    });
    [[14.5, -2.5], [14.5, 2.5], [29.5, -2.5], [29.5, 2.5]].forEach(([lx, lz]) => {
      coreObs.push({ x: lx, z: lz, radius: .3 });
    });
    FLOWER_COORDS.forEach(([fx, fz]) => {
      coreObs.push({ x: fx, z: fz, radius: 1.15 });
    });

    this.regionObstacles.set('core', [...coreObs]);

    // 5 Archimedes Sanctuaries Physical Center Monuments & Fountains
    const zone1Obs: Obstacle[] = [{ x: 110, z: -60, radius: 1.35 }];
    const zone2Obs: Obstacle[] = [{ x: 154, z: -55, radius: 1.0 }, { x: 150, z: -60, radius: 1.2 }];
    const zone3Obs: Obstacle[] = [{ x: 110, z: 60, radius: 2.3 }];
    const zone4Obs: Obstacle[] = [{ x: 150, z: 56, radius: 1.6 }];
    const zone5Obs: Obstacle[] = [{ x: 190, z: 0, radius: 1.5 }];
    this.regionObstacles.set('zone:1', zone1Obs);
    this.regionObstacles.set('zone:2', zone2Obs);
    this.regionObstacles.set('zone:3', zone3Obs);
    this.regionObstacles.set('zone:4', zone4Obs);
    this.regionObstacles.set('zone:5', zone5Obs);
    this.regionObstacles.set('hub', [{ x: 60, z: 0, radius: 1.5 }]);

    this.obstacles.push(...coreObs, ...zone1Obs, ...zone2Obs, ...zone3Obs, ...zone4Obs, ...zone5Obs);
  }

  enableRegionScoping() {
    this.regionScopingEnabled = true;
  }

  setActiveRegion(regionId: string) {
    this.regionScopingEnabled = true;
    this.activeRegionId = regionId;
  }

  getActiveRegion(): string {
    return this.activeRegionId;
  }

  setRegionObstacles(regionId: string, obstacles: Obstacle[]) {
    this.regionObstacles.set(regionId, [...obstacles]);
  }

  addRegionObstacles(regionId: string, obstacles: Obstacle[]) {
    const existing = this.regionObstacles.get(regionId) ?? [];
    existing.push(...obstacles);
    this.regionObstacles.set(regionId, existing);
  }

  setBridgeBuilt(count: number) {
    this.bridgeCount = count;
  }

  addObstacle(obstacle: Obstacle) {
    this.obstacles.push(obstacle);
  }

  addObstacles(obstacles: Obstacle[]) {
    this.obstacles.push(...obstacles);
  }

  private qhmjZones: QhmjZoneState[] = [];
  private launch: { link: JumpLink; t: number } | null = null;
  private padArmed = true;
  private padCooldown = 0;
  private lastRoadSafe: { x: number; y: number; z: number } | null = null;
  private farmZones: FarmZoneState[] = [];
  private lastFarmSafe: { x: number; y: number; z: number } | null = null;
  private farmSpeedMultiplier = 1;

  setFarmSpeedMultiplier(mult: number) {
    this.farmSpeedMultiplier = Number.isFinite(mult) ? Math.max(0.5, Math.min(2.5, mult)) : 1;
  }

  /** Đăng ký vùng Nông Trại (giữ lại địa hình 3D đã nạp nếu cùng mã vùng). */
  setFarmZones(
    zones: {
      id: number;
      name: string;
      cx: number;
      cz: number;
      radius: number;
      spawn: { x: number; y: number; z: number };
      baseSpeed?: number;
      template?: 'FARM_SANCTUARY' | 'FARM_RACE';
    }[]
  ) {
    const prev = new Map(this.farmZones.map((z) => [z.id, z]));
    this.farmZones = zones.map((z) => ({
      ...z,
      surface: prev.get(z.id)?.surface ?? null,
      colliders: prev.get(z.id)?.colliders ?? null
    }));
  }

  setFarmTerrain(id: number, surface: RoadSurface | null, colliders: FarmColliderGrid | null) {
    const zone = this.farmZones.find((z) => z.id === id);
    if (zone) {
      zone.surface = surface;
      zone.colliders = colliders;
    }
  }

  getFarmZones(): ReadonlyArray<FarmZoneState> {
    return this.farmZones;
  }

  private activeFarmZone(): FarmZoneState | null {
    if (!this.regionScopingEnabled || !this.activeRegionId.startsWith('zone:')) return null;
    const zoneId = Number(this.activeRegionId.slice(5));
    return this.farmZones.find((z) => z.id === zoneId) ?? null;
  }

  private farmAt(x: number, z: number): FarmZoneState | null {
    const active = this.activeFarmZone();
    if (active) {
      return active.surface ? active : null;
    }
    if (this.regionScopingEnabled && !this.resolveRegionForPoint(x, z).startsWith('zone:')) {
      return null;
    }
    for (const fz of this.farmZones) {
      if (fz.surface && Math.hypot(x - fz.cx, z - fz.cz) <= fz.radius) return fz;
    }
    return null;
  }

  /** Đăng ký vùng QHMJ (giữ lại bề mặt đường đã nạp nếu cùng mã vùng). */
  setQhmjZones(zones: { id: number; name: string; cx: number; cz: number; radius: number; spawn: { x: number; y: number; z: number } }[]) {
    const prev = new Map(this.qhmjZones.map((z) => [z.id, z]));
    this.qhmjZones = zones.map((z) => ({
      ...z,
      surface: prev.get(z.id)?.surface ?? null,
      links: prev.get(z.id)?.links ?? [],
      nodes: prev.get(z.id)?.nodes ?? [],
      lockedLinkIds: prev.get(z.id)?.lockedLinkIds ?? new Set<number>()
    }));
  }

  setQhmjRoad(
    id: number,
    surface: RoadSurface,
    links: JumpLink[],
    nodes: QhmjNodeAnchor[] = [],
    lockedLinkIds: Set<number> = new Set()
  ) {
    const zone = this.qhmjZones.find((z) => z.id === id);
    if (zone) {
      zone.surface = surface;
      zone.links = links;
      zone.nodes = nodes;
      zone.lockedLinkIds = new Set(lockedLinkIds);
    }
  }

  setQhmjLockedLinks(id: number, lockedLinkIds: Set<number>) {
    const zone = this.qhmjZones.find((z) => z.id === id);
    if (zone) {
      zone.lockedLinkIds = new Set(lockedLinkIds);
    }
  }

  nearQhmjNodeIndex(): number {
    const q = this.qhmjAt(this.x, this.z);
    if (!q || q.nodes.length === 0) return -1;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const n of q.nodes) {
      const horiz = Math.hypot(this.x - n.x, this.z - n.z);
      const dy = Math.abs(this.y - n.y);
      if (horiz <= 3.2 && dy <= 2.5) {
        const d3 = Math.hypot(horiz, dy);
        if (d3 < bestDist) {
          bestDist = d3;
          bestIdx = n.index;
        }
      }
    }
    return bestIdx;
  }

  getQhmjZones(): ReadonlyArray<QhmjZoneState> {
    return this.qhmjZones;
  }

  /** Vùng QHMJ (đã nạp mặt đường) chứa điểm (x, z), nếu có. */
  private qhmjAt(x: number, z: number): QhmjZoneState | null {
    for (const q of this.qhmjZones) {
      if (q.surface && Math.hypot(x - q.cx, z - q.cz) <= q.radius) return q;
    }
    return null;
  }

  isLaunching(): boolean {
    return this.launch !== null;
  }

  public parkZones: { id: number; name: string; cx: number; cz: number; radius: number }[] = [];

  setParkZones(zones: { id: number; name: string; cx: number; cz: number; radius: number }[]) {
    this.parkZones = zones;
  }

  setParkZone(cx: number, cz: number, radius: number, name = 'Công Viên Xanh', id = 7) {
    this.parkZones = [{ id, name, cx, cz, radius }];
  }

  public parkTreePositions: { x: number; z: number }[] = [];

  setParkTreePositions(positions: { x: number; z: number }[]) {
    this.parkTreePositions = positions;
  }

  nearParkTreeIndex(): number {
    for (let i = 0; i < this.parkTreePositions.length; i++) {
      const p = this.parkTreePositions[i];
      if (Math.hypot(this.x - p.x, this.z - p.z) <= 2.8) {
        return i;
      }
    }
    return -1;
  }

  private dynamicIslands: { id: number; cx: number; cz: number; w: number; d: number; name?: string; template?: string }[] = [];
  private dynamicPortals: PortalLink[] = [];
  private dynamicMonoliths: { x: number; z: number }[] = [];
  private dynamicObstacles: Obstacle[] = [];

  setDynamicData(
    zones: { center: { x: number; z: number }; width: number; depth: number; name?: string; id?: number; template?: string }[],
    monolithPositions: { x: number; z: number }[] = [],
    customPortals?: PortalLink[],
    obstacles?: Obstacle[]
  ) {
    this.activeZoneIds = new Set(
      zones
        .map((z, idx) => (typeof z.id === 'number' ? z.id : idx + 1))
        .filter((id): id is number => typeof id === 'number')
    );
    this.dynamicIslands = zones.map((z, idx) => ({
      id: typeof z.id === 'number' ? z.id : idx + 1,
      cx: z.center.x,
      cz: z.center.z,
      w: z.width,
      d: z.depth,
      name: z.name,
      template: z.template
    }));
    this.dynamicMonoliths = monolithPositions;
    if (customPortals !== undefined) {
      this.dynamicPortals = customPortals;
    }
    if (obstacles !== undefined) {
      this.dynamicObstacles = obstacles;
    }
  }

  resolveRegionForPoint(x: number, z: number): string {
    for (const pz of this.parkZones) {
      if (Math.hypot(x - pz.cx, z - pz.cz) <= pz.radius + 2.0) {
        return `zone:${pz.id}`;
      }
    }

    for (const qz of this.qhmjZones) {
      if (Math.hypot(x - qz.cx, z - qz.cz) <= qz.radius) {
        return `zone:${qz.id}`;
      }
    }

    if (x >= -22 && x <= 35 && Math.abs(z) <= 19.5) {
      return 'core';
    }

    if (x >= 48 && x <= 72 && Math.abs(z) <= 12) {
      return 'hub';
    }

    for (const s of DEFAULT_LAKE_SANCTUARIES) {
      if (this.activeZoneIds.has(s.id)) {
        if (Math.hypot(x - s.cx, z - s.cz) <= LAKE_WALK_OUTER + 2.0) {
          return `zone:${s.id}`;
        }
      }
    }

    // Ưu tiên kiểm tra các đảo nhỏ gọn trước, tránh bị vùng Nông Trại rộng lớn che mất khi test gần nhau
    for (const isl of this.dynamicIslands) {
      const isStaticGarden =
        isl.id === 6 ||
        (isl.template === 'FLOWER_BEDS' && isl.cx >= 10 && isl.cx <= 34 && Math.abs(isl.cz) <= 19);
      if (isStaticGarden || isl.template === 'QHMJ_SANCTUARY' || isl.template === 'FARM_SANCTUARY' || isl.template === 'FARM_RACE') continue;
      if (isl.template === 'PARK_SANCTUARY') {
        if (Math.hypot(x - isl.cx, z - isl.cz) <= Math.max(20, Math.max(isl.w, isl.d) / 2 + 4)) {
          return `zone:${isl.id}`;
        }
      } else if (usesLakeTerrain(isl.template)) {
        const d = Math.hypot(x - isl.cx, z - isl.cz);
        if (d <= LAKE_WALK_OUTER + 2.0) {
          return `zone:${isl.id}`;
        }
      } else if (isl.template === 'PROCEDURAL_SANCTUARY') {
        if (Math.hypot(x - isl.cx, z - isl.cz) <= Math.max(isl.w, isl.d) / 2 + 2.0) {
          return `zone:${isl.id}`;
        }
      } else {
        const halfW = isl.w / 2 + 2;
        const halfD = isl.d / 2 + 2;
        if (x >= isl.cx - halfW && x <= isl.cx + halfW && z >= isl.cz - halfD && z <= isl.cz + halfD) {
          return `zone:${isl.id}`;
        }
      }
    }

    for (const isl of this.dynamicIslands) {
      if (isl.template !== 'FARM_SANCTUARY' && isl.template !== 'FARM_RACE') continue;
      const d = Math.hypot(x - isl.cx, z - isl.cz);
      if (d <= Math.max(FARM_REGION_RADIUS, Math.max(isl.w, isl.d) / 2 + 18) + 2.0) {
        return `zone:${isl.id}`;
      }
    }

    return 'core';
  }

  isWithinLand(x: number, z: number): boolean {
    // QHMJ: chỉ đi được trên mặt đường (kiểm tra theo độ cao hiện tại để phân biệt các tầng chồng nhau)
    for (const qz of this.qhmjZones) {
      if (Math.hypot(x - qz.cx, z - qz.cz) <= qz.radius) {
        return qz.surface ? qz.surface.sample(x, z, this.y, ROAD_STEP_UP, ROAD_STEP_DOWN) !== null : false;
      }
    }

    // Farm 3D Terrain: ưu tiên kiểm tra khi đang đứng trong vùng Nông Trại đã nạp địa hình
    const activeFarm = this.activeFarmZone();
    if (activeFarm?.surface) {
      const lx = x - activeFarm.cx;
      const lz = z - activeFarm.cz;
      if (
        lx < FARM_PLAYABLE_BOUNDS.minX ||
        lx > FARM_PLAYABLE_BOUNDS.maxX ||
        lz < FARM_PLAYABLE_BOUNDS.minZ ||
        lz > FARM_PLAYABLE_BOUNDS.maxZ
      ) {
        return false;
      }
      return activeFarm.surface.sample(x, z, this.y, 1.5, 3.5) !== null;
    }

    // 0. Park Island(s) (PARK_SANCTUARY loaded dynamically)
    for (const pz of this.parkZones) {
      if (Math.hypot(x - pz.cx, z - pz.cz) <= pz.radius) return true;
    }

    // 1. Starter Village
    if (x >= -21 && x <= 4 && Math.abs(z) <= 18.8) return true;
    // 2. Friendship Bridge (requires bridge completed)
    if (x > 4 && x < 10 && this.bridgeCount >= BRIDGE_PARTS && Math.abs(z) <= 1.25) return true;
    // 3. Flower Garden
    if (x >= 10 && x <= 34 && Math.abs(z) <= 18.8) return true;
    // 4. Gatehouse Hub (Đền Cổng Archimedes)
    if (x >= 49 && x <= 71 && Math.abs(z) <= 11) return true;

    // 5. 5 Ốc Đảo Chuyên Đề Archimedes (Địa Hình Hồ Yên Bình - Cozy Lake Terrain)
    for (const s of DEFAULT_LAKE_SANCTUARIES) {
      if (this.activeZoneIds.has(s.id)) {
        const d = Math.hypot(x - s.cx, z - s.cz);
        if (d <= LAKE_WALK_OUTER) return true;
      }
    }

    // 6. Kiểm tra các hòn đảo động từ Google Sheets (Bản Mẫu Vùng Đất)
    for (const isl of this.dynamicIslands) {
      if (isl.template === 'QHMJ_SANCTUARY') continue;
      if (isl.template === 'FARM_SANCTUARY' || isl.template === 'FARM_RACE') {
        const matchedFarm = this.farmZones.find((f) => f.id === isl.id);
        if (matchedFarm?.surface) {
          const lx = x - matchedFarm.cx;
          const lz = z - matchedFarm.cz;
          if (
            lx >= FARM_PLAYABLE_BOUNDS.minX &&
            lx <= FARM_PLAYABLE_BOUNDS.maxX &&
            lz >= FARM_PLAYABLE_BOUNDS.minZ &&
            lz <= FARM_PLAYABLE_BOUNDS.maxZ &&
            matchedFarm.surface.sample(x, z, this.y, 1.5, 3.5) !== null
          ) {
            return true;
          }
          continue;
        }
        const d = Math.hypot(x - isl.cx, z - isl.cz);
        if (d <= Math.max(FARM_REGION_RADIUS, Math.max(isl.w, isl.d) / 2 + 18)) return true;
      } else if (usesLakeTerrain(isl.template)) {
        const d = Math.hypot(x - isl.cx, z - isl.cz);
        if (d <= LAKE_WALK_OUTER) return true;
      } else if (isl.template === 'PROCEDURAL_SANCTUARY') {
        const d = Math.hypot(x - isl.cx, z - isl.cz);
        if (d <= Math.max(isl.w, isl.d) / 2 + 1) return true;
      } else {
        const halfW = isl.w / 2 + 1;
        const halfD = isl.d / 2 + 1;
        if (x >= isl.cx - halfW && x <= isl.cx + halfW && z >= isl.cz - halfD && z <= isl.cz + halfD) {
          return true;
        }
      }
    }

    return false;
  }

  private findBlockingObstacle(x: number, z: number): Obstacle | null {
    const candidates = this.regionScopingEnabled
      ? (this.regionObstacles.get(this.activeRegionId) ?? [])
      : [...this.obstacles, ...this.dynamicObstacles];
    for (const o of candidates) {
      if (Math.hypot(x - o.x, z - o.z) < o.radius + .35) {
        return o;
      }
    }
    return null;
  }

  canMove(x: number, z: number): boolean {
    if (!this.isWithinLand(x, z)) return false;
    const fz = this.farmAt(x, z);
    if (fz?.colliders) {
      const ground = fz.surface?.sample(x, z, this.y, 1.5, 3.5);
      const floor = ground ? ground.y : this.y;
      if (fz.colliders.isBlockedForPlayer(x, z, this.y, floor)) {
        return false;
      }
    }
    return this.findBlockingObstacle(x, z) === null;
  }

  resolveSafeSpawn(x: number, z: number): { x: number; z: number } | null {
    for (const qz of this.qhmjZones) {
      if (Math.hypot(x - qz.cx, z - qz.cz) <= qz.radius) {
        if (!qz.surface) return { x, z };
        return qz.surface.sampleNearest(x, z, qz.spawn.y) ? { x, z } : { x: qz.spawn.x, z: qz.spawn.z };
      }
    }

    for (const fz of this.farmZones) {
      if (Math.hypot(x - fz.cx, z - fz.cz) <= fz.radius) {
        if (!fz.surface) return { x, z };
        const lx = x - fz.cx;
        const lz = z - fz.cz;
        const inBounds =
          lx >= FARM_PLAYABLE_BOUNDS.minX &&
          lx <= FARM_PLAYABLE_BOUNDS.maxX &&
          lz >= FARM_PLAYABLE_BOUNDS.minZ &&
          lz <= FARM_PLAYABLE_BOUNDS.maxZ;
        const hit = inBounds ? fz.surface.sampleNearest(x, z, fz.spawn.y) : null;
        if (hit && (!fz.colliders || !fz.colliders.isBlockedForPlayer(x, z, hit.y, hit.y))) {
          return { x, z };
        }
        return { x: fz.spawn.x, z: fz.spawn.z };
      }
    }

    if (this.isWithinLand(x, z)) {
      return { x, z };
    }

    for (const s of DEFAULT_LAKE_SANCTUARIES) {
      if (!this.activeZoneIds.has(s.id)) continue;
      const d = Math.hypot(x - s.cx, z - s.cz);
      if (d <= LAKE_WALK_OUTER + 2.0) {
        return computeLakeAnchors({ x: s.cx, z: s.cz }).arrival;
      }
    }

    for (const isl of this.dynamicIslands) {
      if (usesLakeTerrain(isl.template)) {
        const d = Math.hypot(x - isl.cx, z - isl.cz);
        if (d <= LAKE_WALK_OUTER + 2.0) {
          return computeLakeAnchors({ x: isl.cx, z: isl.cz }).arrival;
        }
      }
    }

    return null;
  }

  getCurrentLocationName(): string {
    const activeFarm = this.activeFarmZone();
    if (activeFarm) {
      return activeFarm.name || 'Nông Trại';
    }
    for (const qz of this.qhmjZones) {
      if (Math.hypot(this.x - qz.cx, this.z - qz.cz) <= qz.radius) {
        return qz.name || 'Con Đường Bậc Thang';
      }
    }
    for (const pz of this.parkZones) {
      if (Math.hypot(this.x - pz.cx, this.z - pz.cz) <= pz.radius + 1.2) {
        return pz.name || 'Công Viên Xanh';
      }
    }
    if (this.x <= 4 && Math.abs(this.z) <= 18.8) return 'Làng Khởi Đầu';
    if (this.x > 4 && this.x < 10 && Math.abs(this.z) <= 1.4) return 'Làng Khởi Đầu';
    if (this.x <= 34 && Math.abs(this.z) <= 18.8) return 'Vườn Hoa Tri Thức';
    if (this.x >= 49 && this.x <= 71 && Math.abs(this.z) <= 11) return 'Đền Cổng Archimedes';

    // 5 Ốc Đảo Archimedes
    const STATIC_SANCTUARIES = [
      { id: 1, cx: 110, cz: -60, name: 'Thung Lũng Tính Toán' },
      { id: 2, cx: 150, cz: -60, name: 'Suối Nguồn Dãy Số' },
      { id: 3, cx: 110, cz: 60, name: 'Đồi Thời Gian' },
      { id: 4, cx: 150, cz: 60, name: 'Rừng Hình Học' },
      { id: 5, cx: 190, cz: 0, name: 'Đỉnh Núi Tư Duy Sao' }
    ];
    for (const s of STATIC_SANCTUARIES) {
      if (this.activeZoneIds.has(s.id) && Math.hypot(this.x - s.cx, this.z - s.cz) <= LAKE_WALK_OUTER + 1.5) {
        return s.name;
      }
    }

    for (const isl of this.dynamicIslands) {
      if (isl.template === 'FARM_SANCTUARY' || isl.template === 'FARM_RACE') {
        const farmRadius = Math.max(FARM_REGION_RADIUS, Math.max(isl.w, isl.d) / 2 + 18) + 1.5;
        if (Math.hypot(this.x - isl.cx, this.z - isl.cz) <= farmRadius) {
          return isl.name || 'Nông Trại';
        }
      } else if (usesLakeTerrain(isl.template)) {
        if (Math.hypot(this.x - isl.cx, this.z - isl.cz) <= LAKE_WALK_OUTER + 1.5) {
          return isl.name || 'Vùng Đất Mới';
        }
      } else {
        const halfW = isl.w / 2 + 1;
        const halfD = isl.d / 2 + 1;
        if (this.x >= isl.cx - halfW && this.x <= isl.cx + halfW && this.z >= isl.cz - halfD && this.z <= isl.cz + halfD) {
          return isl.name || 'Vùng Đất Mới';
        }
      }
    }

    return 'Vùng Đất Archimedes';
  }

  floorHeight(): number {
    const q = this.qhmjAt(this.x, this.z);
    if (q) {
      return q.surface!.sample(this.x, this.z, this.y, ROAD_STEP_UP, ROAD_STEP_DOWN)?.y ?? this.y;
    }
    const f = this.farmAt(this.x, this.z);
    if (f) {
      return f.surface!.sample(this.x, this.z, this.y, 1.5, 3.5)?.y ?? this.y;
    }
    return this.bridgeCount === BRIDGE_PARTS &&
      this.x >= 4 &&
      this.x <= 10 &&
      Math.abs(this.z) < 1.4
      ? .36
      : 0;
  }

  jump(): boolean {
    const floor = this.floorHeight();
    if (this.y <= floor + .01) {
      this.jumpVelocity = 6.5;
      return true;
    }
    return false;
  }

  teleport(x: number, z: number, refY?: number) {
    this.x = x;
    this.z = z;
    this.launch = null;
    this.padArmed = false;
    this.padCooldown = 0.8;
    const qz = this.qhmjZones.find((q) => Math.hypot(x - q.cx, z - q.cz) <= q.radius);
    if (qz) {
      const targetRefY = typeof refY === 'number' && Number.isFinite(refY) ? refY : qz.spawn.y;
      this.y = qz.surface?.sampleNearest(x, z, targetRefY)?.y ?? targetRefY;
      this.lastRoadSafe = { x, y: this.y, z };
    } else {
      const fz =
        this.activeFarmZone() ??
        (!this.regionScopingEnabled || this.resolveRegionForPoint(x, z).startsWith('zone:')
          ? this.farmZones.find((f) => Math.hypot(x - f.cx, z - f.cz) <= f.radius)
          : undefined);
      if (fz) {
        const targetRefY = typeof refY === 'number' && Number.isFinite(refY) ? refY : fz.spawn.y;
        this.y = fz.surface?.sampleNearest(x, z, targetRefY)?.y ?? targetRefY;
        this.lastFarmSafe = { x, y: this.y, z };
      } else {
        this.y = this.floorHeight();
      }
    }
    this.jumpVelocity = 0;
  }

  getPose(): PlayerPose {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      rotation: this.rotation,
      moving: false,
      speed: 0
    };
  }

  isNearMilo(): boolean {
    return Math.hypot(this.x - this.miloPos.x, this.z - this.miloPos.z) < 3.1;
  }

  isNearShop(): boolean {
    return Math.hypot(this.x - this.shopPos.x, this.z - this.shopPos.z) < 3.2;
  }

  nearFlowerIndex(): number {
    for (let i = 0; i < FLOWER_COORDS.length; i++) {
      const [fx, fz] = FLOWER_COORDS[i];
      if (Math.hypot(this.x - fx, this.z - fz) < 2.9) {
        return i;
      }
    }
    return -1;
  }

  nearMonolithIndex(): number {
    if (this.dynamicMonoliths.length > 0) {
      for (let i = 0; i < this.dynamicMonoliths.length; i++) {
        const { x, z } = this.dynamicMonoliths[i];
        if (Math.hypot(this.x - x, this.z - z) < 2.9) {
          return i;
        }
      }
      return -1;
    }

    for (let i = 0; i < ARCHIMEDES_MONOLITHS.length; i++) {
      const { x, z } = ARCHIMEDES_MONOLITHS[i].position;
      if (Math.hypot(this.x - x, this.z - z) < 2.9) {
        return i;
      }
    }
    return -1;
  }

  getActivePortals(): PortalLink[] {
    const staticPortals = PORTAL_LINKS.filter((p) => {
      const match = p.id.match(/(?:hub_to_z|z)(\d+)(?:_to_hub)?/);
      if (match) {
        const zId = Number(match[1]);
        return this.activeZoneIds.has(zId);
      }
      return true;
    });
    return [...staticPortals, ...this.dynamicPortals];
  }

  checkPortalTransit(dt = 0, options?: { deferTeleport?: boolean }): PortalLink | null {
    if (this.portalCooldown > 0) {
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
      if (this.portalCooldown > 0) return null;
    }

    const allPortals = this.getActivePortals();

    for (const portal of allPortals) {
      const dist = Math.hypot(this.x - portal.source.x, this.z - portal.source.z);
      if (dist <= portal.triggerRadius) {
        const sourceRegion = this.regionScopingEnabled
          ? this.activeRegionId
          : this.resolveRegionForPoint(this.x, this.z);
        const targetRegion = portal.targetRegionId ?? this.resolveRegionForPoint(portal.target.x, portal.target.z);
        const shouldDefer = Boolean(options?.deferTeleport && !portal.requiresSelection && sourceRegion !== targetRegion);
        if (!portal.requiresSelection && !shouldDefer) {
          this.teleport(portal.target.x, portal.target.z);
        }
        this.portalCooldown = portal.requiresSelection ? 2.5 : (shouldDefer ? 2.0 : 1.2);
        return portal;
      }
    }
    return null;
  }

  getNearPortal(): PortalLink | null {
    const allPortals = this.getActivePortals();
    return allPortals.find(p => Math.hypot(this.x - p.source.x, this.z - p.source.z) < 3.2) || null;
  }

  isNearPortal(): boolean {
    return this.getNearPortal() !== null;
  }

  hasCrossedRiver(): boolean {
    return this.x > 12 && Math.abs(this.z) < 4;
  }

  isInGarden(): boolean {
    if (this.activeFarmZone()) return false;
    return this.x > 8 && this.x <= 35 && Math.abs(this.z) <= 18.8;
  }

  isInArchimedesRealm(): boolean {
    return this.x > 35;
  }

  /**
   * Di chuyển trên mặt đường 3D của vùng QHMJ: bám tầng theo độ cao hiện tại, trượt dọc mép đường,
   * và tự bật nhảy khi bước lên bệ nhảy.
   */
  private tickRoad(dt: number, input: SpatialInput, cameraYaw: number, q: QhmjZoneState): PlayerPose {
    const surface = q.surface!;
    if (this.portalCooldown > 0) this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    if (this.padCooldown > 0) this.padCooldown = Math.max(0, this.padCooldown - dt);

    // Đang bay trên quỹ đạo bệ nhảy: bỏ qua điều khiển cho tới khi đáp.
    if (this.launch) {
      const l = this.launch;
      l.t += dt;
      const s = Math.min(1, l.t / l.link.duration);
      const p = evalJumpArc(l.link, s);
      this.x = p.x;
      this.y = p.y;
      this.z = p.z;
      this.rotation = Math.atan2(l.link.target.x - l.link.pad.x, l.link.target.z - l.link.pad.z);
      if (s >= 1) {
        this.launch = null;
        this.x = l.link.target.x;
        this.y = l.link.target.y;
        this.z = l.link.target.z;
        this.jumpVelocity = 0;
        this.padArmed = false;
        this.padCooldown = 0.8;
        this.lastRoadSafe = { x: this.x, y: this.y, z: this.z };
      }
      return { x: this.x, y: this.y, z: this.z, rotation: this.rotation, moving: true, speed: 0 };
    }

    // Đang đứng ngoài mặt đường (vd. dữ liệu cũ): đưa về điểm an toàn gần nhất
    if (!surface.sample(this.x, this.z, this.y, ROAD_STEP_UP, ROAD_STEP_DOWN)) {
      const safe = this.lastRoadSafe ?? q.spawn;
      this.x = safe.x;
      this.z = safe.z;
      this.y = safe.y;
      this.jumpVelocity = 0;
    }

    const sx =
      (input.keys.has('d') || input.keys.has('arrowright') ? 1 : 0) -
      (input.keys.has('a') || input.keys.has('arrowleft') ? 1 : 0) +
      input.joystick.x;
    const sy =
      (input.keys.has('s') || input.keys.has('arrowdown') ? 1 : 0) -
      (input.keys.has('w') || input.keys.has('arrowup') ? 1 : 0) +
      input.joystick.y;
    let vx = sx * Math.cos(cameraYaw) + sy * Math.sin(cameraYaw);
    let vz = -sx * Math.sin(cameraYaw) + sy * Math.cos(cameraYaw);
    const length = Math.hypot(vx, vz);

    let moving = false;
    let speed = 0;
    if (length > 0.05) {
      moving = true;
      vx /= length;
      vz /= length;
      speed = QHMJ_SPEED * dt;
      for (const a of ROAD_SLIDE_ANGLES) {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const dx = vx * cos - vz * sin;
        const dz = vx * sin + vz * cos;
        const step = a === 0 ? speed : speed * Math.max(0.35, cos);
        const nx = this.x + dx * step;
        const nz = this.z + dz * step;
        if (surface.sample(nx, nz, this.y, ROAD_STEP_UP, ROAD_STEP_DOWN) && !this.findBlockingObstacle(nx, nz)) {
          this.x = nx;
          this.z = nz;
          break;
        }
      }
      this.rotation = Math.atan2(vx, vz);
    }

    const ground = surface.sample(this.x, this.z, this.y, ROAD_STEP_UP, ROAD_STEP_DOWN);
    const floor = ground ? ground.y : this.y;
    if (this.y > floor + 0.01 || this.jumpVelocity > 0) {
      this.jumpVelocity -= 18 * dt;
      this.y = Math.max(floor, this.y + this.jumpVelocity * dt);
      if (this.y === floor) this.jumpVelocity = 0;
    } else {
      this.y = floor;
    }
    if (ground && this.y <= floor + 0.05) {
      this.lastRoadSafe = { x: this.x, y: floor, z: this.z };
    }

    // Bệ bật nhảy: bỏ qua bệ đang khóa, và chỉ kích hoạt lại sau khi đã rời khỏi mọi bệ.
    const onPad = q.links.find(
      (l) => !q.lockedLinkIds.has(l.id) &&
        Math.hypot(this.x - l.pad.x, this.z - l.pad.z) <= l.triggerRadius &&
        Math.abs(this.y - l.pad.y) <= 3
    );
    if (!this.padArmed) {
      const nearAny = q.links.some(
        (l) => Math.hypot(this.x - l.pad.x, this.z - l.pad.z) <= l.triggerRadius * 1.25 && Math.abs(this.y - l.pad.y) <= 3.5
      );
      if (!nearAny && this.padCooldown <= 0) this.padArmed = true;
    } else if (onPad && this.padCooldown <= 0) {
      this.launch = { link: onPad, t: 0 };
      this.padArmed = false;
      this.jumpVelocity = 0;
    }

    return { x: this.x, y: this.y, z: this.z, rotation: this.rotation, moving, speed };
  }

  /** Chuyển đổi bàn phím / joystick sang vector hướng di chuyển trên mặt phẳng XZ theo góc xoay camera. */
  private computeCameraRelativeMove(input: SpatialInput, cameraYaw: number): { vx: number; vz: number; length: number } {
    const sx =
      (input.keys.has('d') || input.keys.has('arrowright') ? 1 : 0) -
      (input.keys.has('a') || input.keys.has('arrowleft') ? 1 : 0) +
      input.joystick.x;
    const sy =
      (input.keys.has('s') || input.keys.has('arrowdown') ? 1 : 0) -
      (input.keys.has('w') || input.keys.has('arrowup') ? 1 : 0) +
      input.joystick.y;
    const vx = sx * Math.cos(cameraYaw) + sy * Math.sin(cameraYaw);
    const vz = -sx * Math.sin(cameraYaw) + sy * Math.cos(cameraYaw);
    return { vx, vz, length: Math.hypot(vx, vz) };
  }

  /**
   * Di chuyển tự do trên địa hình 3D của Nông Trại: bám độ cao đồi dốc, chặn công trình cứng,
   * chặn hàng rào gỗ ở độ cao thấp (cho phép nhảy qua) và trượt dọc theo tường/biên.
   */
  private tickFarm(dt: number, input: SpatialInput, cameraYaw: number, fz: FarmZoneState): PlayerPose {
    const surface = fz.surface!;
    if (this.portalCooldown > 0) this.portalCooldown = Math.max(0, this.portalCooldown - dt);

    if (!surface.sample(this.x, this.z, this.y, 1.5, 3.5)) {
      const safe = this.lastFarmSafe ?? fz.spawn;
      this.x = safe.x;
      this.z = safe.z;
      this.y = safe.y;
      this.jumpVelocity = 0;
    }

    const curInFence = Boolean(fz.colliders?.hasFenceAt(this.x, this.z));
    const canStepFarm = (nx: number, nz: number): boolean => {
      const lx = nx - fz.cx;
      const lz = nz - fz.cz;
      if (
        lx < FARM_PLAYABLE_BOUNDS.minX ||
        lx > FARM_PLAYABLE_BOUNDS.maxX ||
        lz < FARM_PLAYABLE_BOUNDS.minZ ||
        lz > FARM_PLAYABLE_BOUNDS.maxZ
      ) {
        return false;
      }
      const hit = surface.sample(nx, nz, this.y, 1.5, 3.5);
      if (!hit) return false;
      if (fz.colliders) {
        if (fz.colliders.hasSolidAt(nx, nz)) return false;
        const hitsFence = fz.colliders.hasFenceAt(nx, nz);
        if (hitsFence && !curInFence && this.y <= hit.y + FARM_FENCE_JUMP_CLEARANCE) {
          return false;
        }
      }
      return this.findBlockingObstacle(nx, nz) === null;
    };

    const move = this.computeCameraRelativeMove(input, cameraYaw);
    let moving = false;
    let speed = 0;
    if (move.length > 0.05) {
      moving = true;
      const vx = move.vx / move.length;
      const vz = move.vz / move.length;
      speed = (fz.baseSpeed ?? FARM_SPEED) * this.farmSpeedMultiplier * dt;
      for (const a of ROAD_SLIDE_ANGLES) {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const dx = vx * cos - vz * sin;
        const dz = vx * sin + vz * cos;
        const step = a === 0 ? speed : speed * Math.max(0.35, cos);
        const nx = this.x + dx * step;
        const nz = this.z + dz * step;
        if (canStepFarm(nx, nz)) {
          this.x = nx;
          this.z = nz;
          break;
        }
      }
      this.rotation = Math.atan2(vx, vz);
    }

    const ground = surface.sample(this.x, this.z, this.y, 1.5, 3.5);
    const floor = ground ? ground.y : this.y;
    if (this.y > floor + 0.01 || this.jumpVelocity > 0) {
      this.jumpVelocity -= 18 * dt;
      this.y = Math.max(floor, this.y + this.jumpVelocity * dt);
      if (this.y <= floor + 0.001) {
        this.y = floor;
        this.jumpVelocity = 0;
      }
    } else {
      this.y = floor;
    }

    if (ground && this.y <= floor + 0.05 && (!fz.colliders || !fz.colliders.isBlockedForPlayer(this.x, this.z, floor, floor))) {
      this.lastFarmSafe = { x: this.x, y: floor, z: this.z };
    }

    return { x: this.x, y: this.y, z: this.z, rotation: this.rotation, moving, speed };
  }

  tick(dt: number, input: SpatialInput, cameraYaw = 0.57): PlayerPose {
    const roadZone = this.qhmjAt(this.x, this.z);
    if (roadZone) {
      return this.tickRoad(dt, input, cameraYaw, roadZone);
    }
    const farmZone = this.farmAt(this.x, this.z);
    if (farmZone) {
      return this.tickFarm(dt, input, cameraYaw, farmZone);
    }
    if (this.portalCooldown > 0) {
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    }
    let sx =
      (input.keys.has('d') || input.keys.has('arrowright') ? 1 : 0) -
      (input.keys.has('a') || input.keys.has('arrowleft') ? 1 : 0) +
      input.joystick.x;
    let sy =
      (input.keys.has('s') || input.keys.has('arrowdown') ? 1 : 0) -
      (input.keys.has('w') || input.keys.has('arrowup') ? 1 : 0) +
      input.joystick.y;

    let vx = sx * Math.cos(cameraYaw) + sy * Math.sin(cameraYaw);
    let vz = -sx * Math.sin(cameraYaw) + sy * Math.cos(cameraYaw);

    if (sx === 0 && sy === 0 && input.destination) {
      vx = input.destination.x - this.x;
      vz = input.destination.z - this.z;
      if (Math.hypot(vx, vz) < .2) {
        input.destination = undefined;
        vx = 0;
        vz = 0;
      }
    }

    const length = Math.hypot(vx, vz);
    let moving = false;
    let speed = 0;

    if (length > .05) {
      moving = true;
      vx /= length;
      vz /= length;
      speed = 5.5 * dt;
      const nx = this.x + vx * speed;
      const nz = this.z + vz * speed;

      let moved = false;
      if (this.canMove(nx, nz)) {
        this.x = nx;
        this.z = nz;
        moved = true;
      } else {
        const blocker = this.findBlockingObstacle(nx, nz);
        if (blocker) {
          const dxB = this.x - blocker.x;
          const dzB = this.z - blocker.z;
          const bDist = Math.hypot(dxB, dzB);
          if (bDist > 1e-4) {
            const normX = dxB / bDist;
            const normZ = dzB / bDist;
            const dotVN = vx * normX + vz * normZ;
            let tx = vx - dotVN * normX;
            let tz = vz - dotVN * normZ;
            const tLen = Math.hypot(tx, tz);
            if (tLen < 0.08) {
              // Tiến trực diện tâm vật cản: rẽ ngang theo hướng pháp tuyến xoay 90°
              tx = -normZ;
              tz = normX;
            } else {
              tx = (tx / tLen) + normX * 0.08;
              tz = (tz / tLen) + normZ * 0.08;
            }
            const slideLen = Math.hypot(tx, tz);
            if (slideLen > 1e-4) {
              const sdx = (tx / slideLen) * speed;
              const sdz = (tz / slideLen) * speed;
              if (this.canMove(this.x + sdx, this.z + sdz)) {
                this.x += sdx;
                this.z += sdz;
                moved = true;
              } else if (this.canMove(this.x - sdx, this.z - sdz)) {
                this.x -= sdx;
                this.z -= sdz;
                moved = true;
              } else if (this.canMove(this.x + sdx * 0.5, this.z + sdz * 0.5)) {
                this.x += sdx * 0.5;
                this.z += sdz * 0.5;
                moved = true;
              } else if (this.canMove(this.x - sdx * 0.5, this.z - sdz * 0.5)) {
                this.x -= sdx * 0.5;
                this.z -= sdz * 0.5;
                moved = true;
              }
            }
          }
        }
        if (!moved) {
          if (this.canMove(nx, this.z)) {
            this.x = nx;
            moved = true;
          }
          if (this.canMove(this.x, nz)) {
            this.z = nz;
            moved = true;
          }
        }
        // Thoát kẹt nếu vị trí hiện tại đang chạm nhẹ vào vật cản/biên
        if (!moved && !this.canMove(this.x, this.z)) {
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const ex = this.x + Math.cos(ang) * Math.max(speed, 0.35);
            const ez = this.z + Math.sin(ang) * Math.max(speed, 0.35);
            if (this.canMove(ex, ez)) {
              this.x = ex;
              this.z = ez;
              moved = true;
              break;
            }
          }
        }
      }
      if (!moved && input.destination) {
        input.destination = undefined;
      }
      this.rotation = Math.atan2(vx, vz);
    }

    const floor = this.floorHeight();
    if (this.y > floor || this.jumpVelocity > 0) {
      this.jumpVelocity -= 18 * dt;
      this.y = Math.max(floor, this.y + this.jumpVelocity * dt);
      if (this.y === floor) this.jumpVelocity = 0;
    } else {
      this.y = floor;
    }

    return {
      x: this.x,
      y: this.y,
      z: this.z,
      rotation: this.rotation,
      moving,
      speed
    };
  }
}
