import { BRIDGE_PARTS, WORLD } from '../data/config';
import { ARCHIMEDES_MONOLITHS } from '../data/archimedesTrialMap';
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
}

const z1Anchors = computeLakeAnchors({ x: 110, z: -60 });
const z2Anchors = computeLakeAnchors({ x: 150, z: -60 });
const z3Anchors = computeLakeAnchors({ x: 110, z: 60 });
const z4Anchors = computeLakeAnchors({ x: 150, z: 60 });
const z5Anchors = computeLakeAnchors({ x: 190, z: 0 });

export const PORTAL_LINKS: PortalLink[] = [
  // Garden <-> Hub
  { id: 'garden_to_hub', name: 'Đến Đền Cổng Archimedes', source: { x: 32, z: 0 }, target: { x: 55, z: 0 }, triggerRadius: 1.5 },
  { id: 'hub_to_garden', name: 'Về Vườn Hoa Tri Thức', source: { x: 52, z: 0 }, target: { x: 30, z: 0 }, triggerRadius: 1.5 },

  // Hub <-> Zone 1 (Thung Lũng Tính Toán)
  { id: 'hub_to_z1', name: 'Đến Thung Lũng Tính Toán', source: { x: 68, z: -8 }, target: z1Anchors.arrival, triggerRadius: 1.5 },
  { id: 'z1_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z1Anchors.returnPortal.x, z: z1Anchors.returnPortal.z }, target: { x: 65, z: -8 }, triggerRadius: 1.5 },

  // Hub <-> Zone 2 (Suối Nguồn Dãy Số)
  { id: 'hub_to_z2', name: 'Đến Suối Nguồn Dãy Số', source: { x: 70, z: -4 }, target: z2Anchors.arrival, triggerRadius: 1.5 },
  { id: 'z2_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z2Anchors.returnPortal.x, z: z2Anchors.returnPortal.z }, target: { x: 67, z: -4 }, triggerRadius: 1.5 },

  // Hub <-> Zone 3 (Đồi Thời Gian)
  { id: 'hub_to_z3', name: 'Đến Đồi Thời Gian', source: { x: 70, z: 0 }, target: z3Anchors.arrival, triggerRadius: 1.5 },
  { id: 'z3_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z3Anchors.returnPortal.x, z: z3Anchors.returnPortal.z }, target: { x: 67, z: 0 }, triggerRadius: 1.5 },

  // Hub <-> Zone 4 (Rừng Hình Học)
  { id: 'hub_to_z4', name: 'Đến Rừng Hình Học', source: { x: 70, z: 4 }, target: z4Anchors.arrival, triggerRadius: 1.5 },
  { id: 'z4_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z4Anchors.returnPortal.x, z: z4Anchors.returnPortal.z }, target: { x: 67, z: 4 }, triggerRadius: 1.5 },

  // Hub <-> Zone 5 (Đỉnh Núi Tư Duy Sao)
  { id: 'hub_to_z5', name: 'Đến Đỉnh Núi Tư Duy Sao', source: { x: 68, z: 8 }, target: z5Anchors.arrival, triggerRadius: 1.5 },
  { id: 'z5_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: z5Anchors.returnPortal.x, z: z5Anchors.returnPortal.z }, target: { x: 65, z: 8 }, triggerRadius: 1.5 }
];

export const FLOWER_COORDS: [number, number][] = [
  [14, -6.0], [18, -6.0], [22, -8.5], [26, -6.0], [30, -6.0],
  [14, 6.0], [18, 6.0], [22, 8.5], [26, 6.0], [30, 6.0]
];

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
  readonly miloPos = { x: -3, z: 1.5 };
  readonly shopPos = { x: -12.4, z: -3.5 };

  constructor(initialX = -6, initialZ = 6) {
    this.x = initialX;
    this.z = initialZ;
    this.initDefaultObstacles();
  }

  private initDefaultObstacles() {
    this.obstacles.push({ x: -3, z: 1.5, radius: .85 }); // Milo
    this.obstacles.push({ x: -12, z: -6, radius: 2.35 * 1.25 }); // House 1
    this.obstacles.push({ x: -17, z: 6, radius: 2.35 * .9 }); // House 2
    this.obstacles.push({ x: -4, z: -11, radius: 2.35 }); // House 3
    this.obstacles.push({ x: -15, z: -14, radius: 1.8 }); // Mill

    // Trees
    [
      [-20,-14,1.3],[-20,-8,1],[-20,-3.8,1.1],[-20,3.8,1.1],[-20,13,1.3],[-14,14,1.1],[-7,16,1.4],[-2,13,1.1],[1,17,1.2],[0,-16,1.5],[1,-8,1],[-8,-17,1.2],
      [13,-15,1.3],[18,-17,1.5],[25,-16,1.2],[32,-12,1.3],[33,-5,1.1],[33,5,1.1],[32,12,1.3],[25,16,1.2],[18,17,1.5],[13,15,1.3]
    ].forEach(([tx, tz, s]) => {
      this.obstacles.push({ x: tx, z: tz, radius: .45 * s });
    });

    // Arch
    this.obstacles.push({ x: 11.2, z: -2.2, radius: .5 }, { x: 11.2, z: 2.2, radius: .5 });
    // Fountain
    this.obstacles.push({ x: 22, z: 0, radius: 2.3 });
    // Benches
    [[-2.5, -2.5], [-2.5, 2.5], [2.5, -2.5], [2.5, 2.5]].forEach(([bx, bz]) => {
      this.obstacles.push({ x: 22 + bx, z: bz, radius: .7 });
    });
    // Lanterns
    [[14.5, -2.5], [14.5, 2.5], [29.5, -2.5], [29.5, 2.5]].forEach(([lx, lz]) => {
      this.obstacles.push({ x: lx, z: lz, radius: .3 });
    });
    // Flowers
    FLOWER_COORDS.forEach(([fx, fz]) => {
      this.obstacles.push({ x: fx, z: fz, radius: 1.15 });
    });

    // 5 Archimedes Sanctuaries Physical Center Monuments & Fountains
    this.obstacles.push({ x: 110, z: -60, radius: 1.35 }); // Zone 1 monument
    this.obstacles.push({ x: 154, z: -55, radius: 1.0 });  // Zone 2 stepped pillar
    this.obstacles.push({ x: 150, z: -60, radius: 1.2 });  // Zone 2 fountain center
    this.obstacles.push({ x: 110, z: 60, radius: 2.3 });   // Zone 3 sundial
    this.obstacles.push({ x: 150, z: 56, radius: 1.6 });   // Zone 4 polyhedron
    this.obstacles.push({ x: 190, z: 0, radius: 1.5 });    // Zone 5 star summit monument
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

  private dynamicIslands: { cx: number; cz: number; w: number; d: number; name?: string; template?: string }[] = [];
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
    this.dynamicIslands = zones.map((z) => ({
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

  isWithinLand(x: number, z: number): boolean {
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
    const STATIC_LAKE_SANCTUARIES = [
      { id: 1, cx: 110, cz: -60 },
      { id: 2, cx: 150, cz: -60 },
      { id: 3, cx: 110, cz: 60 },
      { id: 4, cx: 150, cz: 60 },
      { id: 5, cx: 190, cz: 0 }
    ];
    for (const s of STATIC_LAKE_SANCTUARIES) {
      if (this.activeZoneIds.has(s.id)) {
        const d = Math.hypot(x - s.cx, z - s.cz);
        if (d <= LAKE_WALK_OUTER) return true;
      }
    }

    // 6. Kiểm tra các hòn đảo động từ Google Sheets (Bản Mẫu Vùng Đất)
    for (const isl of this.dynamicIslands) {
      if (isl.template === 'FARM_SANCTUARY') {
        const d = Math.hypot(x - isl.cx, z - isl.cz);
        if (d <= Math.max(34, Math.max(isl.w, isl.d) / 2 + 18)) return true;
      } else if (usesLakeTerrain(isl.template)) {
        const d = Math.hypot(x - isl.cx, z - isl.cz);
        if (d <= LAKE_WALK_OUTER) return true;
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

  canMove(x: number, z: number): boolean {
    if (!this.isWithinLand(x, z)) return false;
    const hitDefault = this.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + .35);
    if (hitDefault) return false;
    return !this.dynamicObstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + .35);
  }

  resolveSafeSpawn(x: number, z: number): { x: number; z: number } | null {
    if (this.isWithinLand(x, z)) {
      return { x, z };
    }

    const STATIC_LAKE_SANCTUARIES = [
      { id: 1, cx: 110, cz: -60 },
      { id: 2, cx: 150, cz: -60 },
      { id: 3, cx: 110, cz: 60 },
      { id: 4, cx: 150, cz: 60 },
      { id: 5, cx: 190, cz: 0 }
    ];
    for (const s of STATIC_LAKE_SANCTUARIES) {
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
    for (const pz of this.parkZones) {
      if (Math.hypot(this.x - pz.cx, this.z - pz.cz) <= pz.radius + 1.2) {
        return pz.name || 'Công Viên Xanh';
      }
    }
    if (this.x <= 4) return 'Làng Khởi Đầu';
    if (this.x <= 34) return 'Vườn Hoa Tri Thức';
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
      if (usesLakeTerrain(isl.template)) {
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

  teleport(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.y = this.floorHeight();
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

  checkPortalTransit(dt = 0): PortalLink | null {
    if (this.portalCooldown > 0) {
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
      if (this.portalCooldown > 0) return null;
    }

    const allPortals = this.getActivePortals();

    for (const portal of allPortals) {
      const dist = Math.hypot(this.x - portal.source.x, this.z - portal.source.z);
      if (dist <= portal.triggerRadius) {
        if (!portal.requiresSelection) {
          this.teleport(portal.target.x, portal.target.z);
        }
        this.portalCooldown = portal.requiresSelection ? 2.5 : 1.2;
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
    return this.x > 8 && this.x <= 35;
  }

  isInArchimedesRealm(): boolean {
    return this.x > 35;
  }

  tick(dt: number, input: SpatialInput, cameraYaw = 0.57): PlayerPose {
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
      if (this.canMove(nx, this.z)) {
        this.x = nx;
        moved = true;
      }
      if (this.canMove(this.x, nz)) {
        this.z = nz;
        moved = true;
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
