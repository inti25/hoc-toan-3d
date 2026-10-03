import type { ZoneTemplateType } from './remoteTypes';

/**
 * Địa Hình Hồ Yên Bình (Cozy Lake Terrain) — mô tả hình học dùng chung.
 *
 * Mô hình `cozy_lake.glb` là một đảo tròn có HỒ NƯỚC ở giữa, đất đi được chỉ là
 * vành bờ cát bao quanh. Mô-đun thuần dữ liệu này (không phụ thuộc three.js) là
 * nguồn sự thật duy nhất cho: ranh giới đi được, vị trí bia đá, cổng về và điểm đến.
 *
 * Mọi kích thước tính bằng mét thế giới (sau khi scale mô hình).
 */

/** Hệ số scale từ đơn vị mô hình sang mét (đảo ≈ 20 m bán kính, vừa khoảng cách 40 m giữa các đảo). */
export const LAKE_SCALE = 0.075;

/** Tâm vành đảo trong không gian mô hình (x, z), đo từ hình học `Island_01`. */
export const LAKE_MODEL_CENTER = { x: 27.8, z: 10.0 } as const;

/** Bán kính trong / ngoài của vành bờ đi được (mét). */
export const LAKE_WALK_INNER = 180 * LAKE_SCALE; // 13.5
export const LAKE_WALK_OUTER = 240 * LAKE_SCALE; // 18.0

/** Bán kính đường tâm vành (nơi đặt cổng) và hàng bia đá (lệch về phía mép hồ để chừa lối đi). */
export const LAKE_PORTAL_RADIUS = (LAKE_WALK_INNER + LAKE_WALK_OUTER) / 2; // 15.75
export const LAKE_MONOLITH_RADIUS = 14.4;

/** Bán kính đĩa đảo dự phòng khi chưa nạp được mô hình. */
export const LAKE_FALLBACK_RADIUS = LAKE_WALK_OUTER + 1.5;

/** Khoảng cách dọc vành từ cổng về tới điểm đến (m). */
export const LAKE_ARRIVAL_OFFSET = 2.6;

const TWO_PI = Math.PI * 2;

export interface LakeLand {
  cx: number;
  cz: number;
  innerRadius: number;
  outerRadius: number;
}

export interface LakeAnchors {
  /** Cổng về Đền Cổng Archimedes, đặt ở phía tây của vành. */
  returnPortal: { x: number; z: number; rotationY: number };
  /** Điểm xuất hiện khi dịch chuyển tới vùng. */
  arrival: { x: number; z: number };
}

export function usesLakeTerrain(template?: ZoneTemplateType | string | null): boolean {
  return template === 'GRID_SANCTUARY' || template === 'CIRCLE_SANCTUARY';
}

export function createLakeLand(center: { x: number; z: number }): LakeLand {
  return { cx: center.x, cz: center.z, innerRadius: LAKE_WALK_INNER, outerRadius: LAKE_WALK_OUTER };
}

export function isWithinLakeLand(land: LakeLand, x: number, z: number): boolean {
  const d = Math.hypot(x - land.cx, z - land.cz);
  return d <= land.outerRadius;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Góc quay của mô hình theo mã vùng (cố định, để mỗi đảo hơi khác nhau). */
export function lakeRotationForZone(zoneId: number): number {
  return ((zoneId * 2.399963229728653) % TWO_PI + TWO_PI) % TWO_PI;
}

export function computeLakeAnchors(center: { x: number; z: number }): LakeAnchors {
  const portalAngle = Math.PI; // phía tây
  const arrivalAngle = portalAngle + LAKE_ARRIVAL_OFFSET / LAKE_PORTAL_RADIUS;
  return {
    returnPortal: {
      x: round1(center.x + Math.cos(portalAngle) * LAKE_PORTAL_RADIUS),
      z: round1(center.z + Math.sin(portalAngle) * LAKE_PORTAL_RADIUS),
      // Trụ cổng nằm dọc phương bán kính, lối đi xuyên cổng chạy dọc vành.
      rotationY: Math.PI / 2 - portalAngle
    },
    arrival: {
      x: round1(center.x + Math.cos(arrivalAngle) * LAKE_PORTAL_RADIUS),
      z: round1(center.z + Math.sin(arrivalAngle) * LAKE_PORTAL_RADIUS)
    }
  };
}

/**
 * Bố cục bia đá trên vành bờ hồ.
 * - CIRCLE_SANCTUARY: cách đều quanh cả vành.
 * - GRID_SANCTUARY: hai cung (cung bắc z < tâm và cung nam z > tâm), mỗi cung xếp đều.
 * Không bao giờ đặt bia đúng hướng tây, nơi có cổng về.
 */
export function computeLakeEntityPositions(
  template: ZoneTemplateType,
  count: number,
  center: { x: number; z: number }
): { x: number; z: number }[] {
  if (count <= 0) return [];
  const at = (angle: number) => ({
    x: round1(center.x + Math.cos(angle) * LAKE_MONOLITH_RADIUS),
    z: round1(center.z + Math.sin(angle) * LAKE_MONOLITH_RADIUS)
  });

  const positions: { x: number; z: number }[] = [];
  if (template === 'CIRCLE_SANCTUARY') {
    for (let i = 0; i < count; i++) {
      positions.push(at(Math.PI + ((i + 0.5) / count) * TWO_PI));
    }
    return positions;
  }

  const northCount = Math.ceil(count / 2);
  const southCount = count - northCount;
  for (let i = 0; i < northCount; i++) {
    positions.push(at(Math.PI + ((i + 0.5) / northCount) * Math.PI));
  }
  for (let i = 0; i < southCount; i++) {
    positions.push(at(((i + 0.5) / southCount) * Math.PI));
  }
  return positions;
}

/**
 * Tọa độ thủ công (PosX/PosZ) chỉ được giữ nếu nằm trên vành đi được (chừa 0.5 m mép);
 * tọa độ cũ thiết kế cho đảo hộp, nằm giữa hồ, sẽ bị thay bằng bố cục tự động.
 */
export function isValidLakePosition(center: { x: number; z: number }, pos: { x: number; z: number }): boolean {
  const d = Math.hypot(pos.x - center.x, pos.z - center.z);
  return d <= LAKE_WALK_OUTER - 0.5;
}
