import type { RemoteZoneConfig } from './remoteTypes';

/**
 * Bản đồ nông trại 3D `public/3dmodel/maps/farm/scene.gltf` ("moorhuhn kart 2 farm", CC-BY-4.0).
 *
 * Kết hợp cảnh quan nông trại 3D (đường đất, đường đá cuội, đồng cỏ, ruộng lúa mì,
 * nhà kho đỏ, cối xay gió, hàng rào gỗ và vòm trời mây xanh) với thư viện `farm.glb`
 * cung cấp đàn thú chuyển động khớp xương và các chòi trú ẩn theo loài.
 *
 * Tọa độ "local" tính theo mét SAU KHI scale `FARM_SCALE` và dịch bởi `FARM_RAW_OFFSET`,
 * gốc là tâm zone `(zone.center.x, 0, zone.center.z)`.
 */

export const FARM_TEMPLATE = 'FARM_SANCTUARY' as const;

export type FarmAnimalKind =
  | 'cow'
  | 'calf'
  | 'pig'
  | 'piglet'
  | 'chicken'
  | 'chick'
  | 'duck'
  | 'duckling'
  | 'dog';

/** Tỉ lệ thu phóng model gốc sang mét thế giới thực (hàng rào ~0.8 m, nhà kho ~7.5 m). */
export const FARM_SCALE = 0.4;

/** Dịch gốc tọa độ thô của `scene.gltf` để vòng đường nông trại cân quanh tâm zone (0, 0). */
export const FARM_RAW_OFFSET = { x: -15, z: 55 } as const;

/** Vị trí đặt `worldScene` bên trong `FarmSanctuary.sceneryGroup` sau khi áp dụng `FARM_SCALE`. */
export const FARM_WORLD_MODEL_OFFSET = {
  x: -FARM_RAW_OFFSET.x * FARM_SCALE,
  y: 0,
  z: -FARM_RAW_OFFSET.z * FARM_SCALE
} as const;

/** Tốc độ chạy trong nông trại (m/s) — tương đương QHMJ do bản đồ rộng ~220 × 165 m. */
export const FARM_SPEED = 7.5;

/** Bán kính vùng bao quanh tâm nông trại (bao trùm toàn bộ `FARM_PLAYABLE_BOUNDS`). */
export const FARM_REGION_RADIUS = 150;

/** Kích thước chuẩn của vùng `FARM_SANCTUARY` khi cấu hình trên Google Sheets. */
export const FARM_RECOMMENDED_SIZE = { width: 220, depth: 165 } as const;

/** Tọa độ tách biệt khuyên dùng trên Google Sheets `CONFIG` để không chồng lấn vùng trung tâm. */
export const FARM_RECOMMENDED_CENTER = { x: 400, z: 400 } as const;

/** Giới hạn vùng chơi an toàn theo tọa độ local (bao trọn vòng đường đất, đồng cỏ & ruộng lúa). */
export const FARM_PLAYABLE_BOUNDS = {
  minX: -116,
  maxX: 116,
  minZ: -84,
  maxZ: 92
} as const;

/** Tâm Khu Chuồng Trại Trung Tâm: bãi cỏ phẳng phía Đông trước Nhà Kho Đỏ & Cối Xay Gió. */
export const FARM_PEN_CENTER_LOCAL = { x: 72, y: 1.19, z: -36 } as const;

/** Lối vào Khu Chuồng Trại để thú thực hiện Hành Trình Về Chuồng. */
export const FARM_PEN_ENTRY_LOCAL = { x: 65, y: 1.25, z: -36 } as const;

/** Bán kính vùng cấm thú chưa giải cứu bén mảng vào Khu Chuồng Trại. */
export const FARM_PEN_EXCLUSION_RADIUS = 9.5;

/** Điểm xuất phát của người chơi tại rìa tây Khu Chuồng Trại, hướng nhìn mở ra đồng cỏ & vòng đường. */
export const FARM_SPAWN_LOCAL = { x: 60, y: 1.31, z: -36 } as const;

/** Cổng "Về Làng Khởi Đầu" đặt ở rìa nam Khu Chuồng Trại. */
export const FARM_RETURN_PORTAL_LOCAL = { x: 65, y: 1.4, z: -24 } as const;

/** Cổng Gỗ Đồng Quê đặt tại Làng Khởi Đầu. */
export const FARM_VILLAGE_PORTAL = { x: -8, z: 14 } as const;

/** Điểm đáp khi quay về Làng Khởi Đầu, cách cổng đủ xa để không kích hoạt lại. */
export const FARM_VILLAGE_RETURN_TARGET = { x: -8, z: 12 } as const;

/** Độ cao nhảy tối thiểu so với mặt đất để người chơi nhảy qua hàng rào gỗ thấp. */
export const FARM_FENCE_JUMP_CLEARANCE = 0.55;

/** Khoảng cách tối đa thú chạy thẳng về chuồng; xa hơn sẽ chạy ăn mừng rồi phát pháo hoa về cổng chuồng. */
export const FARM_DIRECT_HOMEWARD_MAX_DIST = 35;

/** Thời gian tối đa chạy ăn mừng từ xa trước khi phát hạt sáng về cổng chuồng (giây). */
export const FARM_REMOTE_HOMEWARD_WARP_SEC = 4.5;

/** Tham số mặc định của Góc Nhìn Khám Phá Gần cho `FARM_SANCTUARY`. */
export const FARM_CAMERA_DEFAULTS = {
  yaw: Math.PI / 2 - 0.12,
  pitch: 0.22,
  distance: 4.2,
  fov: 58,
  far: 950,
  fogNear: 480,
  fogFar: 1100
} as const;

/** Các vật liệu bề mặt đi được trong `public/3dmodel/maps/farm/scene.gltf`. */
export const FARM_GROUND_MATERIALS: ReadonlySet<string> = new Set([
  'Mesh_0289.rip.001_0',
  'Mesh_0289.rip.001_4',
  'Mesh_0289.rip.001_5',
  'Mesh_0289.rip.001_6',
  'Mesh_0289.rip.001_7',
  'Mesh_0289.rip.001_8',
  'Mesh_0289.rip.001_9',
  'Mesh_0289.rip.001_10',
  'Mesh_0289.rip.001_16',
  'Mesh_0289.rip.001_17',
  'Mesh_0289.rip.001_19',
  'Mesh_0289.rip.001_20',
  'Mesh_0289.rip.001_21',
  'Mesh_0289.rip.001_22',
  'Mesh_0289.rip.001_23',
  'Mesh_0289.rip.001_24',
  'Mesh_0289.rip.001_25',
  'Mesh_0289.rip.001_27'
]);

/** Các vật liệu công trình cứng luôn chặn di chuyển (nhà kho, cối xay gió, thân cây, đạo cụ). */
export const FARM_SOLID_OBSTACLE_MATERIALS: ReadonlySet<string> = new Set([
  'Mesh_0289.rip.001_2',
  'Mesh_0289.rip.001_11',
  'Mesh_0289.rip.001_12',
  'Mesh_0289.rip.001_14',
  'Mesh_0289.rip.001_15',
  'Mesh_0289.rip.001_18',
  'Mesh_0289.rip.001_26',
  'unnamed.007_2'
]);

/** Hàng rào gỗ thấp — chặn khi đi bộ dưới đất nhưng có thể nhảy qua. */
export const FARM_FENCE_MATERIALS: ReadonlySet<string> = new Set([
  'Mesh_0289.rip.001_13'
]);

/** Vòm trời xanh mây trắng tích hợp sẵn trong `scene.gltf`. */
export const FARM_SKY_MATERIALS: ReadonlySet<string> = new Set([
  'unnamed.007_3'
]);

/** Tâm các Chòi Trú Ẩn Theo Loài quanh `FARM_PEN_CENTER_LOCAL` (tọa độ local). */
export const FARM_SHELTER_CENTERS: Record<FarmAnimalKind, { x: number; z: number }> = {
  cow: { x: 76, z: -39 },
  calf: { x: 75.2, z: -38.2 },
  chicken: { x: 69, z: -39 },
  chick: { x: 68.5, z: -38.3 },
  duck: { x: 71, z: -32 },
  duckling: { x: 71.8, z: -32.4 },
  pig: { x: 73, z: -41 },
  piglet: { x: 73.8, z: -40.6 },
  dog: { x: 70, z: -42 }
};

/**
 * 18 điểm neo thoáng đẹp dọc vòng đường đất, lối đá cuội và đồng cỏ.
 * Tất cả đã được kiểm chứng nằm trên mặt đất đi được và cách xa nhà kho/hàng rào.
 */
export const FARM_ANIMAL_ANCHORS_LOCAL: ReadonlyArray<{ x: number; z: number }> = [
  { x: 54, z: -56 },
  { x: 46, z: 8 },
  { x: 10, z: -8 },
  { x: 72, z: 16 },
  { x: -18, z: -22 },
  { x: -16, z: 26 },
  { x: 56, z: 50 },
  { x: -56, z: -56 },
  { x: -72, z: 6 },
  { x: -46, z: 62 },
  { x: 28, z: -56 },
  { x: 84, z: 38 },
  { x: 14, z: -64 },
  { x: 18, z: 62 },
  { x: -32, z: 10 },
  { x: -82, z: -52 },
  { x: -88, z: 26 },
  { x: -96, z: -54 }
];

export interface FarmAnchors {
  spawn: { x: number; y: number; z: number };
  returnPortal: { x: number; y: number; z: number };
  penCenter: { x: number; y: number; z: number };
  penEntry: { x: number; y: number; z: number };
}

export function computeFarmAnchors(center: { x: number; z: number }): FarmAnchors {
  return {
    spawn: {
      x: center.x + FARM_SPAWN_LOCAL.x,
      y: FARM_SPAWN_LOCAL.y,
      z: center.z + FARM_SPAWN_LOCAL.z
    },
    returnPortal: {
      x: center.x + FARM_RETURN_PORTAL_LOCAL.x,
      y: FARM_RETURN_PORTAL_LOCAL.y,
      z: center.z + FARM_RETURN_PORTAL_LOCAL.z
    },
    penCenter: {
      x: center.x + FARM_PEN_CENTER_LOCAL.x,
      y: FARM_PEN_CENTER_LOCAL.y,
      z: center.z + FARM_PEN_CENTER_LOCAL.z
    },
    penEntry: {
      x: center.x + FARM_PEN_ENTRY_LOCAL.x,
      y: FARM_PEN_ENTRY_LOCAL.y,
      z: center.z + FARM_PEN_ENTRY_LOCAL.z
    }
  };
}

export function farmZoneSpawn(zone: Pick<RemoteZoneConfig, 'center'>): { x: number; y: number; z: number } {
  return computeFarmAnchors(zone.center).spawn;
}

export function isInsideFarmPenLocal(x: number, z: number, margin = 0): boolean {
  return Math.hypot(x - FARM_PEN_CENTER_LOCAL.x, z - FARM_PEN_CENTER_LOCAL.z) < FARM_PEN_EXCLUSION_RADIUS + margin;
}

export function isWithinFarmPlayableBoundsLocal(x: number, z: number): boolean {
  return (
    x >= FARM_PLAYABLE_BOUNDS.minX &&
    x <= FARM_PLAYABLE_BOUNDS.maxX &&
    z >= FARM_PLAYABLE_BOUNDS.minZ &&
    z <= FARM_PLAYABLE_BOUNDS.maxZ
  );
}
