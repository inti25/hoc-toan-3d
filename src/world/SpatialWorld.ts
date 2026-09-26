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

  canMove(x: number, z: number): boolean {
    if (x < -21 || x > 218) return false;
    // Starter village and flower garden
    if (x <= 34 && (z < -18.8 || z > 18.8)) return false;
    // Connecting avenue between flower garden and Archimedes realm
    if (x > 34 && x <= 42 && (z < -6.5 || z > 6.5)) return false;
    // Archimedes plateau
    if (x > 42 && (z < -72 || z > 54)) return false;

    if (
      x > WORLD.riverMin - .3 &&
      x < WORLD.riverMax + .3 &&
      (this.bridgeCount < BRIDGE_PARTS || Math.abs(z) > 1.25)
    ) {
      return false;
    }
    return !this.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + .35);
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
    for (let i = 0; i < ARCHIMEDES_MONOLITHS.length; i++) {
      const { x, z } = ARCHIMEDES_MONOLITHS[i].position;
      if (Math.hypot(this.x - x, this.z - z) < 2.9) {
        return i;
      }
    }
    return -1;
  }

  isNearPortal(): boolean {
    return Math.hypot(this.x - 35, this.z - 0) < 3.5;
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
