import type { RemoteZoneConfig } from './remoteTypes';

/**
 * Bản đồ `map_qhmj.glb` (Thế giới đường bậc thang & bệ bật nhảy).
 *
 * Hằng số hình học dưới đây đo từ chính file GLB (xem tests/qhmj_road.test.ts kiểm chứng lại).
 * Tọa độ "local" tính theo mét SAU KHI scale `QHMJ_SCALE`, gốc là tâm zone (model đặt tại center.x, 0, center.z).
 */

export const QHMJ_TEMPLATE = 'QHMJ_SANCTUARY' as const;

/** Đường nhiều tầng trong map gốc rộng trung vị 0.235 → scale 16 cho lòng đường ≈ 3.8 m. */
export const QHMJ_SCALE = 16;

/** Tốc độ chạy trong vùng (m/s) — map dài hơn Vườn Hoa/Công Viên rất nhiều. */
export const QHMJ_SPEED = 7.5;

/** Bán kính vùng bao quanh gốc model (map trải khoảng x∈[-72,80], z∈[-65,44]). */
export const QHMJ_REGION_RADIUS = 110;

/** Tên node mesh dùng làm mặt đường đi được. */
export const QHMJ_ROAD_MESH_NAME = 'road_qhmj_001__6';

/** Tên node bị ẩn khi hiển thị. */
export const QHMJ_HIDDEN_NODE_PATTERNS: RegExp[] = [/^map_qhmj_pick$/i, /^qhmj_sky/i];

/** Điểm xuất phát: chân đảo (điểm thấp nhất có đủ chỗ đứng trên cụm đường thấp nhất). */
export const QHMJ_SPAWN_LOCAL = { x: 68.87, y: 0.37, z: -9.37 } as const;

/** Cổng "Về Làng Khởi Đầu": đặt phía sau điểm xuất phát (+X) để hướng nhìn mặc định (-X) mở thẳng lên đường. */
export const QHMJ_RETURN_PORTAL_LOCAL = { x: 73.5, y: 0.32, z: -9.37 } as const;

export function isQhmjTemplate(template?: string | null): boolean {
  return template === QHMJ_TEMPLATE;
}

export interface QhmjAnchors {
  spawn: { x: number; y: number; z: number };
  returnPortal: { x: number; y: number; z: number };
}

export function computeQhmjAnchors(center: { x: number; z: number }): QhmjAnchors {
  return {
    spawn: {
      x: center.x + QHMJ_SPAWN_LOCAL.x,
      y: QHMJ_SPAWN_LOCAL.y,
      z: center.z + QHMJ_SPAWN_LOCAL.z
    },
    returnPortal: {
      x: center.x + QHMJ_RETURN_PORTAL_LOCAL.x,
      y: QHMJ_RETURN_PORTAL_LOCAL.y,
      z: center.z + QHMJ_RETURN_PORTAL_LOCAL.z
    }
  };
}

/** Cổng vào đặt tại Làng Khởi Đầu (cạnh các cổng Công Viên / Nông Trại). */
export const QHMJ_VILLAGE_PORTAL = { x: -12, z: 9 } as const;
/** Điểm đáp khi quay về Làng, cách cổng vào đủ xa để không kích hoạt lại. */
export const QHMJ_VILLAGE_RETURN_TARGET = { x: -12, z: 12.5 } as const;

export function qhmjZoneSpawn(zone: Pick<RemoteZoneConfig, 'center'>): { x: number; z: number } {
  const a = computeQhmjAnchors(zone.center);
  return { x: a.spawn.x, z: a.spawn.z };
}
