/**
 * Bề mặt đường đi được (walkable road surface) dựng từ lưới tam giác thế giới.
 *
 * Thuần dữ liệu (không phụ thuộc three.js) để test được bằng node. Hỗ trợ:
 * - tra độ cao tại (x, z) theo "cửa sổ" quanh độ cao tham chiếu (xử lý đường chồng tầng / cầu vượt),
 * - phân cụm các mảng đường rời nhau (island) theo kết nối đỉnh.
 */

export interface RoadHit {
  /** Độ cao mặt đường tại (x, z). */
  y: number;
  /** Chỉ số tam giác. */
  tri: number;
  /** Mã cụm đường (island) chứa tam giác này. */
  island: number;
}

export interface RoadSurfaceOptions {
  /** Kích thước ô lưới tra cứu (mét). */
  cellSize?: number;
  /** Khoảng cách hàn các đỉnh gần nhau khi tính cụm đường (mét). */
  weldEps?: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const BARY_EPS = 1e-4;

export class RoadSurface {
  readonly triCount: number;
  readonly islandCount: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;

  private readonly tris: Float32Array;
  private readonly triIsland: Int32Array;
  private readonly grid = new Map<number, number[]>();
  private readonly cell: number;
  private readonly verts: Float32Array;
  private readonly vertIsland: Int32Array;

  constructor(positions: ArrayLike<number>, indices: ArrayLike<number>, options: RoadSurfaceOptions = {}) {
    this.cell = options.cellSize ?? 2;
    const weld = options.weldEps ?? 0.8;
    const vertCount = Math.floor(positions.length / 3);
    this.verts = Float32Array.from(positions as ArrayLike<number>);

    const triCount = Math.floor(indices.length / 3);
    this.tris = new Float32Array(triCount * 9);
    this.triCount = triCount;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < vertCount; i++) {
      const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    this.minX = minX; this.maxX = maxX; this.minY = minY; this.maxY = maxY; this.minZ = minZ; this.maxZ = maxZ;

    // Union-find để gom các đỉnh trùng/gần nhau thành cụm đường.
    const parent = new Int32Array(vertCount);
    for (let i = 0; i < vertCount; i++) parent[i] = i;
    const find = (a: number): number => {
      while (parent[a] !== a) {
        parent[a] = parent[parent[a]];
        a = parent[a];
      }
      return a;
    };
    const union = (a: number, b: number) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    for (let t = 0; t < triCount; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      union(a, b);
      union(b, c);
      const o = t * 9;
      for (const [k, v] of [[0, a], [3, b], [6, c]] as const) {
        this.tris[o + k] = positions[v * 3];
        this.tris[o + k + 1] = positions[v * 3 + 1];
        this.tris[o + k + 2] = positions[v * 3 + 2];
      }
      this.registerTriangle(t);
    }

    // Hàn các đỉnh nằm sát nhau (đường bị cắt thành nhiều mảnh có chung biên).
    const hash = new Map<string, number[]>();
    const hk = (x: number, y: number, z: number) => `${x},${y},${z}`;
    for (let i = 0; i < vertCount; i++) {
      const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
      const gx = Math.floor(x / weld), gy = Math.floor(y / weld), gz = Math.floor(z / weld);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = hash.get(hk(gx + dx, gy + dy, gz + dz));
            if (!bucket) continue;
            for (const j of bucket) {
              if (
                Math.hypot(x - positions[j * 3], y - positions[j * 3 + 1], z - positions[j * 3 + 2]) < weld
              ) {
                union(i, j);
              }
            }
          }
        }
      }
      const key = hk(gx, gy, gz);
      const bucket = hash.get(key);
      if (bucket) bucket.push(i); else hash.set(key, [i]);
    }

    const rootToIsland = new Map<number, number>();
    this.vertIsland = new Int32Array(vertCount);
    for (let i = 0; i < vertCount; i++) {
      const r = find(i);
      let id = rootToIsland.get(r);
      if (id === undefined) {
        id = rootToIsland.size;
        rootToIsland.set(r, id);
      }
      this.vertIsland[i] = id;
    }
    this.islandCount = rootToIsland.size;
    this.triIsland = new Int32Array(triCount);
    for (let t = 0; t < triCount; t++) {
      this.triIsland[t] = this.vertIsland[indices[t * 3]];
    }
  }

  private cellKey(ix: number, iz: number): number {
    return (ix + 100000) * 200003 + (iz + 100000);
  }

  private registerTriangle(t: number) {
    const o = t * 9;
    const xs = [this.tris[o], this.tris[o + 3], this.tris[o + 6]];
    const zs = [this.tris[o + 2], this.tris[o + 5], this.tris[o + 8]];
    const x0 = Math.floor(Math.min(...xs) / this.cell), x1 = Math.floor(Math.max(...xs) / this.cell);
    const z0 = Math.floor(Math.min(...zs) / this.cell), z1 = Math.floor(Math.max(...zs) / this.cell);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.cellKey(ix, iz);
        const arr = this.grid.get(k);
        if (arr) arr.push(t); else this.grid.set(k, [t]);
      }
    }
  }

  /**
   * Tra mặt đường tại (x, z) có độ cao trong [refY - maxDown, refY + maxUp],
   * chọn mặt gần `refY` nhất (để bám đúng tầng khi có cầu vượt chồng lên).
   */
  sample(x: number, z: number, refY: number, maxUp = 1.3, maxDown = 3.5): RoadHit | null {
    const list = this.grid.get(this.cellKey(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!list) return null;
    let best: RoadHit | null = null;
    let bestDelta = Infinity;
    for (const t of list) {
      const o = t * 9;
      const ax = this.tris[o], ay = this.tris[o + 1], az = this.tris[o + 2];
      const bx = this.tris[o + 3], by = this.tris[o + 4], bz = this.tris[o + 5];
      const cx = this.tris[o + 6], cy = this.tris[o + 7], cz = this.tris[o + 8];
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-9) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < -BARY_EPS || l2 < -BARY_EPS || l3 < -BARY_EPS) continue;
      const y = l1 * ay + l2 * by + l3 * cy;
      const delta = y - refY;
      if (delta > maxUp || delta < -maxDown) continue;
      const abs = Math.abs(delta);
      if (abs < bestDelta) {
        bestDelta = abs;
        best = { y, tri: t, island: this.triIsland[t] };
      }
    }
    return best;
  }

  /** Mặt đường bất kỳ tại (x, z) gần `refY` nhất (không giới hạn biên độ). */
  sampleNearest(x: number, z: number, refY: number): RoadHit | null {
    return this.sample(x, z, refY, 1e6, 1e6);
  }

  /** Đỉnh gần nhất theo khoảng cách 3D. */
  nearestVertex(p: Vec3, filter?: (island: number) => boolean): { pos: Vec3; island: number; dist: number } | null {
    let bestI = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.vertIsland.length; i++) {
      if (filter && !filter(this.vertIsland[i])) continue;
      const d = Math.hypot(this.verts[i * 3] - p.x, this.verts[i * 3 + 1] - p.y, this.verts[i * 3 + 2] - p.z);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestI < 0) return null;
    return {
      pos: { x: this.verts[bestI * 3], y: this.verts[bestI * 3 + 1], z: this.verts[bestI * 3 + 2] },
      island: this.vertIsland[bestI],
      dist: bestD
    };
  }

  /** Các đỉnh của một cụm đường, sắp theo khoảng cách 3D tới `p` tăng dần. */
  verticesByDistance(p: Vec3, filter: (island: number) => boolean, limit = 400): Vec3[] {
    const arr: { d: number; i: number }[] = [];
    for (let i = 0; i < this.vertIsland.length; i++) {
      if (!filter(this.vertIsland[i])) continue;
      arr.push({
        d: Math.hypot(this.verts[i * 3] - p.x, this.verts[i * 3 + 1] - p.y, this.verts[i * 3 + 2] - p.z),
        i
      });
    }
    arr.sort((a, b) => a.d - b.d);
    return arr.slice(0, limit).map(({ i }) => ({
      x: this.verts[i * 3], y: this.verts[i * 3 + 1], z: this.verts[i * 3 + 2]
    }));
  }

  /** Điểm (x, z) có đủ chỗ đứng: mọi hướng quanh bán kính `radius` đều có mặt đường gần độ cao `y`. */
  hasClearance(x: number, z: number, y: number, radius: number, maxUp = 1.0, maxDown = 1.0): boolean {
    if (!this.sample(x, z, y, maxUp, maxDown)) return false;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      if (!this.sample(x + Math.cos(ang) * radius, z + Math.sin(ang) * radius, y, maxUp + 0.5, maxDown + 0.5)) {
        return false;
      }
    }
    return true;
  }
}
