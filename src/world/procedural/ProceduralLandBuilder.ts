import * as THREE from 'three';
import type { RemoteZoneConfig } from '../../data/remoteTypes';
import type { AssetRepositorySeam } from '../assets/types';
import type { Obstacle } from '../SpatialWorld';
import { computeProceduralEntityPositions } from '../../data/remoteTypes';

export interface ProceduralLandResult {
  group: THREE.Group;
  obstacles: Obstacle[];
  portalAnchors: {
    returnPortal: { x: number; z: number; rotationY: number };
    arrival: { x: number; z: number };
  };
  monolithPositions: { x: number; z: number }[];
}

/**
 * Bộ Xây Dựng Vùng Đất Tùy Biến (Procedural Land Builder).
 *
 * Tự động kiến tạo hòn đảo 3D động hoàn chỉnh dựa trên cấu hình Google Sheets:
 * - Dựng nền đảo địa hình (Terrain Mesh) chuẩn tỷ lệ.
 * - Thiết lập Cổng Dịch Chuyển và vùng đệm an toàn (Keep-out zones).
 * - Bố trí các Bia Đá Tri Thức hài hòa.
 * - Rải ngẫu nhiên có kiểm soát (deterministic PRNG) các Mảnh Ghép Mô Hình (Prefabs) từ catalog.
 */
export class ProceduralLandBuilder {
  /**
   * Sinh hòn đảo hoàn chỉnh cho vùng đất.
   */
  public async buildLand(zone: RemoteZoneConfig, assets: AssetRepositorySeam): Promise<ProceduralLandResult> {
    const group = new THREE.Group();
    group.name = `ProceduralLand_Zone_${zone.id}`;
    group.position.set(zone.center.x, 0, zone.center.z);

    const radius = Math.max(zone.width, zone.depth) / 2;
    const cx = zone.center.x;
    const cz = zone.center.z;

    // 1. Dựng nền đảo địa hình (Terrain Base)
    const terrainGroup = this.createIslandBase(radius, zone.color);
    group.add(terrainGroup);

    // 2. Tính toán vị trí Cổng Dịch Chuyển quay về (ở mép phía Tây của đảo)
    const portalDist = Math.max(8, radius - 3.2);
    const returnPortal = {
      x: Math.round((cx - portalDist) * 10) / 10,
      z: cz,
      rotationY: 0 // Mặt cổng mở hướng vào tâm đảo (+X)
    };
    const arrival = {
      x: Math.round((returnPortal.x + 2.6) * 10) / 10,
      z: cz
    };

    // 3. Tính toán vị trí các Bia Đá Tri Thức (Monoliths)
    const monolithPositions = computeProceduralEntityPositions(
      'PROCEDURAL_SANCTUARY',
      8,
      zone.center,
      zone.width,
      zone.depth
    );

    // 4. Danh sách các vùng đệm an toàn (Keep-out Zones)
    const keepOutPoints: { x: number; z: number; radius: number }[] = [
      { x: returnPortal.x, z: returnPortal.z, radius: 3.5 }, // Cổng về
      { x: arrival.x, z: arrival.z, radius: 2.2 },           // Điểm xuất hiện
      { x: cx, z: cz, radius: 2.5 },                         // Tâm đảo
      ...monolithPositions.map((p) => ({ x: p.x, z: p.z, radius: 2.2 })) // Quanh bia đá
    ];

    // 5. Rải Mảnh Ghép Mô Hình (Prefab Scattering) theo Theme và DecorDensity
    const obstacles: Obstacle[] = [];
    const decorPrefabs = this.getThemePrefabPool(zone.theme || 'FOREST');
    const decorCount = this.getDecorCount(zone.decorDensity || 'MEDIUM');

    // Bộ sinh số ngẫu nhiên có seed theo zone.id (đảm bảo tính nhất quán trên mọi máy)
    let seed = (zone.id * 9301 + 49297) % 233280;
    const prng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const placedLargeProps: { x: number; z: number }[] = [];

    for (let i = 0; i < decorCount; i++) {
      // Chọn ngẫu nhiên vị trí trên đĩa đảo
      const r = 3.5 + prng() * (radius - 5.5);
      const theta = prng() * Math.PI * 2;
      const wx = cx + Math.cos(theta) * r;
      const wz = cz + Math.sin(theta) * r;

      // Kiểm tra khoảng cách an toàn với các vùng cấm
      const inKeepOut = keepOutPoints.some((kp) => Math.hypot(wx - kp.x, wz - kp.z) < kp.radius);
      if (inKeepOut) continue;

      // Kiểm tra khoảng cách với các vật thể lớn khác để tránh dính đè lên nhau
      const tooClose = placedLargeProps.some((lp) => Math.hypot(wx - lp.x, wz - lp.z) < 2.5);
      if (tooClose) continue;

      // Chọn prefab ngẫu nhiên từ theme pool
      const prefabId = decorPrefabs[Math.floor(prng() * decorPrefabs.length)];
      const randRotY = prng() * Math.PI * 2;
      const randScale = 0.85 + prng() * 0.35; // 0.85 - 1.2

      try {
        const res = await assets.instantiatePrefab(prefabId, {
          position: { x: wx, y: 0, z: wz },
          rotationY: randRotY,
          scale: randScale
        });

        if (res && res.group) {
          group.add(res.group);
          if (res.obstacle) {
            obstacles.push(res.obstacle);
            placedLargeProps.push({ x: wx, z: wz });
          }
        }
      } catch (err) {
        console.warn(`[ProceduralLandBuilder] Lỗi cắm prefab ${prefabId}:`, err);
      }
    }

    return {
      group,
      obstacles,
      portalAnchors: { returnPortal, arrival },
      monolithPositions
    };
  }

  /**
   * Dựng hình đĩa đảo địa hình 3D nguyên khối gồm mặt cỏ và bờ vách đất đá.
   */
  private createIslandBase(radius: number, grassColor = 0x10b981): THREE.Group {
    const baseGroup = new THREE.Group();

    // 1. Mặt cỏ trên đảo
    const topGeo = new THREE.CylinderGeometry(radius, radius, 0.4, 36);
    const topMat = new THREE.MeshStandardMaterial({
      color: grassColor,
      roughness: 0.85,
      metalness: 0.1
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.y = -0.2;
    topMesh.receiveShadow = true;
    baseGroup.add(topMesh);

    // 2. Chân vách đất đá
    const cliffGeo = new THREE.CylinderGeometry(radius, radius * 0.82, 3.2, 36);
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x4a3728, // Đất nâu trầm
      roughness: 0.95,
      metalness: 0.05
    });
    const cliffMesh = new THREE.Mesh(cliffGeo, cliffMat);
    cliffMesh.position.y = -1.9;
    cliffMesh.receiveShadow = true;
    baseGroup.add(cliffMesh);

    // 3. Đường viền bờ cát trang trí mép đảo
    const rimGeo = new THREE.RingGeometry(radius - 0.9, radius + 0.1, 36);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xd9c58c, // Màu cát vàng ấm
      side: THREE.DoubleSide
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.y = 0.01;
    rimMesh.receiveShadow = true;
    baseGroup.add(rimMesh);

    return baseGroup;
  }

  /**
   * Lấy danh sách ID các prefab phù hợp với từng chủ đề.
   */
  private getThemePrefabPool(theme: string): string[] {
    switch (theme) {
      case 'GARDEN':
        return [
          'park_flowers002',
          'park_flowers005',
          'park_flowers010',
          'park_lamp003',
          'park_bush003',
          'park_bush015',
          'park_tree003',
          'park_grass002'
        ];
      case 'RUINS':
        return [
          'cozy_lake_stone1_01',
          'cozy_lake_stone2_01',
          'cozy_lake_stone2_002',
          'cozy_lake_tree_bare_01',
          'cozy_lake_tree_stump',
          'cozy_lake_pipe',
          'park_cube001'
        ];
      case 'VILLAGE':
        return [
          'park_lamp002',
          'park_cube002',
          'park_tree005',
          'cozy_lake_boat',
          'park_flowers003',
          'park_grass005',
          'cozy_lake_tree_dense_red_01'
        ];
      case 'FOREST':
      default:
        return [
          'cozy_lake_tree_dense_01',
          'park_tree002',
          'park_pine002',
          'park_pine006',
          'park_bush002',
          'park_bush010',
          'cozy_lake_mushroom_01',
          'park_grass002',
          'park_flowers002',
          'cozy_lake_stone1_01'
        ];
    }
  }

  /**
   * Xác định số lượng vật thể decor sinh trên đảo theo mật độ.
   */
  private getDecorCount(density: string): number {
    switch (density) {
      case 'LOW':
        return 12;
      case 'HIGH':
        return 38;
      case 'MEDIUM':
      default:
        return 24;
    }
  }
}

export const proceduralLandBuilder = new ProceduralLandBuilder();
