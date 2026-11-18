import * as THREE from 'three';
import {
  FARM_FENCE_JUMP_CLEARANCE,
  FARM_FENCE_MATERIALS,
  FARM_GROUND_MATERIALS,
  FARM_SKY_MATERIALS,
  FARM_SOLID_OBSTACLE_MATERIALS
} from '../../data/farmMap';
import { RoadSurface } from '../qhmj/RoadSurface';

export interface FarmMeshTriangleInput {
  positions: Float32Array;
  indices: Uint32Array;
  solidTriangles: Float32Array;
  fenceTriangles: Float32Array;
}

/**
 * Lưới băm không gian 2D (spatial hash grid) lưu vùng va chạm chính xác theo cạnh tam giác
 * cho công trình cứng (nhà kho, cối xay gió, thân cây) và hàng rào gỗ thấp (nhảy qua được).
 *
 * Thuần dữ liệu (không phụ thuộc three.js) để test trực tiếp bằng Node.
 */
export class FarmColliderGrid {
  readonly cellSize: number;
  private readonly solidCells = new Set<number>();
  private readonly fenceCells = new Set<number>();

  constructor(cellSize = 0.9) {
    this.cellSize = cellSize;
  }

  get solidCellCount(): number {
    return this.solidCells.size;
  }

  get fenceCellCount(): number {
    return this.fenceCells.size;
  }

  private cellKey(ix: number, iz: number): number {
    return (ix + 100000) * 200003 + (iz + 100000);
  }

  private markPoint(set: Set<number>, x: number, z: number): void {
    const ix = Math.floor(x / this.cellSize);
    const iz = Math.floor(z / this.cellSize);
    set.add(this.cellKey(ix, iz));
  }

  private rasterizeEdge(set: Set<number>, x0: number, z0: number, x1: number, z1: number): void {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const step = this.cellSize * 0.4;
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.markPoint(set, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    }
  }

  /**
   * Đánh dấu các ô bị chiếm bởi một tam giác (bao gồm các tam giác dựng đứng như tường/hàng rào).
   */
  rasterizeTriangle(
    target: 'solid' | 'fence',
    ax: number,
    az: number,
    bx: number,
    bz: number,
    cx: number,
    cz: number
  ): void {
    const set = target === 'fence' ? this.fenceCells : this.solidCells;
    this.rasterizeEdge(set, ax, az, bx, bz);
    this.rasterizeEdge(set, bx, bz, cx, cz);
    this.rasterizeEdge(set, cx, cz, ax, az);

    // Tô phần ruột nếu tam giác có diện tích mặt bằng (ví dụ mái dốc sát đất hoặc bậc thềm).
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 0.08) return;

    const minX = Math.min(ax, bx, cx);
    const maxX = Math.max(ax, bx, cx);
    const minZ = Math.min(az, bz, cz);
    const maxZ = Math.max(az, bz, cz);
    const ix0 = Math.floor(minX / this.cellSize);
    const ix1 = Math.floor(maxX / this.cellSize);
    const iz0 = Math.floor(minZ / this.cellSize);
    const iz1 = Math.floor(maxZ / this.cellSize);
    // Bảo vệ hiệu năng nếu tam giác quá khổng lồ
    if ((ix1 - ix0 + 1) * (iz1 - iz0 + 1) > 400) return;

    for (let ix = ix0; ix <= ix1; ix++) {
      const px = (ix + 0.5) * this.cellSize;
      for (let iz = iz0; iz <= iz1; iz++) {
        const pz = (iz + 0.5) * this.cellSize;
        const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / det;
        const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 >= -0.02 && l2 >= -0.02 && l3 >= -0.02) {
          set.add(this.cellKey(ix, iz));
        }
      }
    }
  }

  private hasPointIn(set: Set<number>, x: number, z: number, radius: number): boolean {
    if (set.size === 0) return false;
    const checks: ReadonlyArray<[number, number]> =
      radius > 0
        ? [
            [x, z],
            [x + radius, z],
            [x - radius, z],
            [x, z + radius],
            [x, z - radius]
          ]
        : [[x, z]];
    for (const [px, pz] of checks) {
      const ix = Math.floor(px / this.cellSize);
      const iz = Math.floor(pz / this.cellSize);
      if (set.has(this.cellKey(ix, iz))) return true;
    }
    return false;
  }

  hasSolidAt(x: number, z: number, radius = 0.35): boolean {
    return this.hasPointIn(this.solidCells, x, z, radius);
  }

  hasFenceAt(x: number, z: number, radius = 0.25): boolean {
    return this.hasPointIn(this.fenceCells, x, z, radius);
  }

  /**
   * Kiểm tra va chạm cho người chơi: công trình cứng luôn chặn;
   * hàng rào gỗ thấp chỉ chặn khi đứng/chạy sát đất và cho phép nhảy vượt qua.
   */
  isBlockedForPlayer(x: number, z: number, playerY: number, floorY: number): boolean {
    if (this.hasSolidAt(x, z, 0.35)) return true;
    if (playerY <= floorY + FARM_FENCE_JUMP_CLEARANCE && this.hasFenceAt(x, z, 0.25)) {
      return true;
    }
    return false;
  }

  /** Động vật luôn tránh cả công trình cứng lẫn hàng rào gỗ. */
  isBlockedForAnimal(x: number, z: number): boolean {
    return this.hasSolidAt(x, z, 0.5) || this.hasFenceAt(x, z, 0.45);
  }
}

/**
 * Dựng `RoadSurface` (mặt đất đi được) và `FarmColliderGrid` (vật cản cứng + hàng rào)
 * từ mảng tam giác thô đã biến đổi sang tọa độ thế giới.
 */
export function buildFarmTerrainFromMeshTriangles(
  input: FarmMeshTriangleInput
): { surface: RoadSurface; colliders: FarmColliderGrid } {
  const surface = new RoadSurface(input.positions, input.indices, { cellSize: 2.5, weldEps: 0.8 });
  const colliders = new FarmColliderGrid(0.9);

  const filterAndRasterize = (target: 'solid' | 'fence', tris: Float32Array) => {
    for (let i = 0; i < tris.length; i += 9) {
      const ax = tris[i];
      const ay = tris[i + 1];
      const az = tris[i + 2];
      const bx = tris[i + 3];
      const by = tris[i + 4];
      const bz = tris[i + 5];
      const cx = tris[i + 6];
      const cy = tris[i + 7];
      const cz = tris[i + 8];

      const minY = Math.min(ay, by, cy);
      const maxY = Math.max(ay, by, cy);
      const midX = (ax + bx + cx) / 3;
      const midY = (ay + by + cy) / 3;
      const midZ = (az + bz + cz) / 3;

      const ground = surface.sampleNearest(midX, midZ, midY);
      if (ground) {
        // Bỏ qua tán lá/mái nhà cao hơn mặt đất > 2.2 m và bỏ qua gờ phẳng thấp < 0.15 m
        if (minY > ground.y + 2.2) continue;
        if (maxY < ground.y + 0.15) continue;
      }

      colliders.rasterizeTriangle(target, ax, az, bx, bz, cx, cz);
    }
  };

  filterAndRasterize('solid', input.solidTriangles);
  filterAndRasterize('fence', input.fenceTriangles);

  return { surface, colliders };
}

function resolveMaterialName(material: THREE.Material | THREE.Material[] | undefined, groupMatIndex?: number): string {
  if (!material) return '';
  if (Array.isArray(material)) {
    const m = material[groupMatIndex ?? 0];
    return m?.name || '';
  }
  return material.name || '';
}

/**
 * Bóc tách bề mặt địa hình đi được và lưới va chạm trực tiếp từ cây đối tượng 3D `worldScene`.
 * Yêu cầu `worldScene` đã đặt đúng `position` / `scale` và cập nhật `matrixWorld` trước khi gọi.
 */
export function extractFarmTerrainFromScene(
  worldScene: THREE.Object3D
): { surface: RoadSurface; colliders: FarmColliderGrid } {
  worldScene.updateMatrixWorld(true);

  const groundPositions: number[] = [];
  const groundIndices: number[] = [];
  const solidTriangles: number[] = [];
  const fenceTriangles: number[] = [];

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();

  worldScene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const posAttr = geometry?.getAttribute('position');
    if (!geometry || !posAttr) return;

    const indexAttr = geometry.getIndex();
    const groups =
      geometry.groups && geometry.groups.length > 0
        ? geometry.groups
        : [{ start: 0, count: indexAttr ? indexAttr.count : posAttr.count, materialIndex: 0 }];

    for (const grp of groups) {
      const matName = resolveMaterialName(mesh.material, grp.materialIndex);

      if (FARM_SKY_MATERIALS.has(matName)) {
        mesh.frustumCulled = false;
        continue;
      }

      const isGround = FARM_GROUND_MATERIALS.has(matName);
      const isSolid = FARM_SOLID_OBSTACLE_MATERIALS.has(matName);
      const isFence = FARM_FENCE_MATERIALS.has(matName);
      if (!isGround && !isSolid && !isFence) continue;

      const end = grp.start + grp.count;
      if (isGround) {
        const baseVertex = groundPositions.length / 3;
        if (indexAttr) {
          // Thu thập tập đỉnh cục bộ để chỉ chuyển đổi đỉnh thuộc group này
          const localMap = new Map<number, number>();
          for (let k = grp.start; k < end; k++) {
            const origIdx = indexAttr.getX(k);
            let mapped = localMap.get(origIdx);
            if (mapped === undefined) {
              va.fromBufferAttribute(posAttr, origIdx).applyMatrix4(mesh.matrixWorld);
              mapped = baseVertex + localMap.size;
              localMap.set(origIdx, mapped);
              groundPositions.push(va.x, va.y, va.z);
            }
            groundIndices.push(mapped);
          }
        } else {
          for (let k = grp.start; k < end; k++) {
            va.fromBufferAttribute(posAttr, k).applyMatrix4(mesh.matrixWorld);
            groundIndices.push(groundPositions.length / 3);
            groundPositions.push(va.x, va.y, va.z);
          }
        }
      } else {
        const out = isFence ? fenceTriangles : solidTriangles;
        for (let k = grp.start; k + 2 < end; k += 3) {
          const i0 = indexAttr ? indexAttr.getX(k) : k;
          const i1 = indexAttr ? indexAttr.getX(k + 1) : k + 1;
          const i2 = indexAttr ? indexAttr.getX(k + 2) : k + 2;
          va.fromBufferAttribute(posAttr, i0).applyMatrix4(mesh.matrixWorld);
          vb.fromBufferAttribute(posAttr, i1).applyMatrix4(mesh.matrixWorld);
          vc.fromBufferAttribute(posAttr, i2).applyMatrix4(mesh.matrixWorld);
          out.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
        }
      }
    }
  });

  return buildFarmTerrainFromMeshTriangles({
    positions: Float32Array.from(groundPositions),
    indices: Uint32Array.from(groundIndices),
    solidTriangles: Float32Array.from(solidTriangles),
    fenceTriangles: Float32Array.from(fenceTriangles)
  });
}
