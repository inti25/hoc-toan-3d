import { BRIDGE_PARTS, WORLD } from '../data/config';
import { ARCHIMEDES_MONOLITHS } from '../data/archimedesTrialMap';

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
}

export const PORTAL_LINKS: PortalLink[] = [
  // Garden <-> Hub
  { id: 'garden_to_hub', name: 'Đến Đền Cổng Archimedes', source: { x: 32, z: 0 }, target: { x: 55, z: 0 }, triggerRadius: 1.5 },
  { id: 'hub_to_garden', name: 'Về Vườn Hoa Tri Thức', source: { x: 52, z: 0 }, target: { x: 30, z: 0 }, triggerRadius: 1.5 },

  // Hub <-> Zone 1 (Thung Lũng Tính Toán)
  { id: 'hub_to_z1', name: 'Đến Thung Lũng Tính Toán', source: { x: 68, z: -8 }, target: { x: 102, z: -60 }, triggerRadius: 1.5 },
  { id: 'z1_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: 100, z: -60 }, target: { x: 65, z: -8 }, triggerRadius: 1.5 },

  // Hub <-> Zone 2 (Suối Nguồn Dãy Số)
  { id: 'hub_to_z2', name: 'Đến Suối Nguồn Dãy Số', source: { x: 70, z: -4 }, target: { x: 142, z: -60 }, triggerRadius: 1.5 },
  { id: 'z2_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: 140, z: -60 }, target: { x: 67, z: -4 }, triggerRadius: 1.5 },

  // Hub <-> Zone 3 (Đồi Thời Gian)
  { id: 'hub_to_z3', name: 'Đến Đồi Thời Gian', source: { x: 70, z: 0 }, target: { x: 102, z: 60 }, triggerRadius: 1.5 },
  { id: 'z3_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: 100, z: 60 }, target: { x: 67, z: 0 }, triggerRadius: 1.5 },

  // Hub <-> Zone 4 (Rừng Hình Học)
  { id: 'hub_to_z4', name: 'Đến Rừng Hình Học', source: { x: 70, z: 4 }, target: { x: 140, z: 60 }, triggerRadius: 1.5 },
  { id: 'z4_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: 138, z: 60 }, target: { x: 67, z: 4 }, triggerRadius: 1.5 },

  // Hub <-> Zone 5 (Đỉnh Núi Tư Duy Sao)
  { id: 'hub_to_z5', name: 'Đến Đỉnh Núi Tư Duy Sao', source: { x: 68, z: 8 }, target: { x: 183, z: 0 }, triggerRadius: 1.5 },
  { id: 'z5_to_hub', name: 'Về Đền Cổng Archimedes', source: { x: 181, z: 0 }, target: { x: 65, z: 8 }, triggerRadius: 1.5 }
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
  readonly miloPos = { x: -3, z: 1.5 };

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
      [-20,-14,1.3],[-20,-8,1],[-20,0,1.1],[-20,13,1.3],[-14,14,1.1],[-7,16,1.4],[-2,13,1.1],[1,17,1.2],[0,-16,1.5],[1,-8,1],[-8,-17,1.2],
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
  }

  setBridgeBuilt(count: number) {
    this.bridgeCount = count;
  }

  addObstacle(obstacle: Obstacle) {
    this.obstacles.push(obstacle);
  }

  private dynamicIslands: { cx: number; cz: number; w: number; d: number; name?: string }[] = [];
  private dynamicPortals: PortalLink[] = [];
  private dynamicMonoliths: { x: number; z: number }[] = [];

  setDynamicData(
    zones: { center: { x: number; z: number }; width: number; depth: number; name?: string; id?: number }[],
    monolithPositions: { x: number; z: number }[] = [],
    customPortals: PortalLink[] = []
  ) {
    this.dynamicIslands = zones.map((z) => ({
      cx: z.center.x,
      cz: z.center.z,
      w: z.width,
      d: z.depth,
      name: z.name
    }));
    this.dynamicMonoliths = monolithPositions;
    this.dynamicPortals = customPortals;
  }

  isWithinLand(x: number, z: number): boolean {
    // 1. Starter Village
    if (x >= -21 && x <= 4 && Math.abs(z) <= 18.8) return true;
    // 2. Friendship Bridge (requires bridge completed)
    if (x > 4 && x < 10 && this.bridgeCount >= BRIDGE_PARTS && Math.abs(z) <= 1.25) return true;
    // 3. Flower Garden
    if (x >= 10 && x <= 34 && Math.abs(z) <= 18.8) return true;
    // 4. Gatehouse Hub (Đền Cổng Archimedes)
    if (x >= 49 && x <= 71 && Math.abs(z) <= 11) return true;
    // 5. Sanctuary 1 (Thung Lũng Tính Toán)
    if (x >= 98 && x <= 122 && z >= -76 && z <= -44) return true;
    // 6. Sanctuary 2 (Suối Nguồn Dãy Số)
    if (x >= 138 && x <= 162 && z >= -76 && z <= -44) return true;
    // 7. Sanctuary 3 (Đồi Thời Gian)
    if (x >= 98 && x <= 122 && z >= 44 && z <= 76) return true;
    // 8. Sanctuary 4 (Rừng Hình Học)
    if (x >= 136 && x <= 164 && z >= 43 && z <= 77) return true;
    // 9. Sanctuary 5 (Đỉnh Núi Tư Duy Sao)
    if (x >= 179 && x <= 201 && z >= -12 && z <= 12) return true;

    // 10. Kiểm tra các hòn đảo động từ Google Sheets (Bản Mẫu Vùng Đất)
    for (const isl of this.dynamicIslands) {
      const halfW = isl.w / 2 + 1;
      const halfD = isl.d / 2 + 1;
      if (x >= isl.cx - halfW && x <= isl.cx + halfW && z >= isl.cz - halfD && z <= isl.cz + halfD) {
        return true;
      }
    }

    return false;
  }

  canMove(x: number, z: number): boolean {
    if (!this.isWithinLand(x, z)) return false;
    return !this.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + .35);
  }

  getCurrentLocationName(): string {
    if (this.x <= 4) return 'Làng Khởi Đầu';
    if (this.x <= 34) return 'Vườn Hoa Tri Thức';
    if (this.x >= 49 && this.x <= 71 && Math.abs(this.z) <= 11) return 'Đền Cổng Archimedes';
    if (this.x >= 98 && this.x <= 122 && this.z >= -76 && this.z <= -44) return 'Thung Lũng Tính Toán';
    if (this.x >= 138 && this.x <= 162 && this.z >= -76 && this.z <= -44) return 'Suối Nguồn Dãy Số';
    if (this.x >= 98 && this.x <= 122 && this.z >= 44 && this.z <= 76) return 'Đồi Thời Gian';
    if (this.x >= 136 && this.x <= 164 && this.z >= 43 && this.z <= 77) return 'Rừng Hình Học';
    if (this.x >= 179 && this.x <= 201 && Math.abs(this.z) <= 12) return 'Đỉnh Núi Tư Duy Sao';
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

  checkPortalTransit(dt = 0): PortalLink | null {
    if (this.portalCooldown > 0) {
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
      if (this.portalCooldown > 0) return null;
    }

    const allPortals = this.dynamicPortals.length > 0 ? this.dynamicPortals : PORTAL_LINKS;

    for (const portal of allPortals) {
      const dist = Math.hypot(this.x - portal.source.x, this.z - portal.source.z);
      if (dist <= portal.triggerRadius) {
        this.teleport(portal.target.x, portal.target.z);
        this.portalCooldown = 1.2;
        return portal;
      }
    }
    return null;
  }

  getNearPortal(): PortalLink | null {
    const allPortals = this.dynamicPortals.length > 0 ? this.dynamicPortals : PORTAL_LINKS;
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
