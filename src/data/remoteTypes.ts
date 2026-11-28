export type ZoneTemplateType = 'FLOWER_BEDS' | 'CIRCLE_SANCTUARY' | 'GRID_SANCTUARY' | 'PARK_SANCTUARY' | 'PROCEDURAL_SANCTUARY' | 'FARM_SANCTUARY' | 'FARM_RACE' | 'QHMJ_SANCTUARY';
export type ZoneThemeType = 'GARDEN' | 'RUINS' | 'FOREST' | 'CRYSTAL' | 'VILLAGE';
export type DecorDensityType = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RemoteStep {
  stepId: string;
  prompt: string;
  imageUrl?: string;
  options: { label: string; value: string }[];
  answer: string;
  hints: string[];
  explanation: string;
  explanationImageUrl?: string;
  diagramSvg?: string;
}

export interface RemoteProblem {
  id: number | string;
  zoneId?: number;
  zoneName?: string;
  title: string;
  subtitle: string;
  position?: { x: number; y?: number; z: number } | null;
  color?: number;
  badge?: string;
  entityKind?: string;
  difficulty?: 1 | 2 | 3;
  steps: RemoteStep[];
}

export interface RemoteZoneConfig {
  id: number;
  name: string;
  title: string;
  description: string;
  template: ZoneTemplateType;
  theme?: ZoneThemeType;
  decorDensity?: DecorDensityType;
  sheetName: string;
  center: { x: number; z: number };
  width: number;
  depth: number;
  color: number;
  colorHex: string;
  badge: string;
  /** Cột Active trong CONFIG; false = ẩn vùng. Mặc định true */
  active?: boolean;
  /** Cột StartAt trong CONFIG (ISO hoặc 'yyyy-MM-dd HH:mm' giờ VN); trống = hiện ngay */
  startAt?: string;
  /** Quy tắc mở khóa v2 (trống = mở ngay; 'BRIDGE_DONE' / 'LEVEL:N' / 'ZONE:ID') */
  unlockRule?: string;
  /** Thưởng hoàn thành vùng tùy chỉnh từ CONFIG */
  rewardXp?: number;
  rewardCoins?: number;
}

export interface ExplorerProfile {
  nickname: string;
  className: string;
  isAnonymous: boolean;
  explorerId?: string;
  passcode?: string;
  avatar?: string;
}


export interface RemotePlayerProgress {
  explorerId: string;
  passcode: string;
  nickname: string;
  className: string;
  avatar: string;
  level: number;
  totalXP: number;
  totalCoins: number;
  bridgeParts: number;
  flowersBloomed: number;
  monolithsActivated: number;
  treesAwakened: number;
  lastActiveAt?: string;
  saveData?: any;
}

export interface SavePlayerProgressPayload {
  action?: 'savePlayerProgress';
  explorerId: string;
  passcode: string;
  nickname: string;
  className: string;
  avatar: string;
  level: number;
  totalXP: number;
  totalCoins: number;
  bridgeParts: number;
  flowersBloomed: number;
  monolithsActivated: number;
  treesAwakened: number;
  saveData: any;
}

/**
 * Tự động tính toán vị trí vòng cung quanh biển (Archipelago Orbital Radius)
 * nếu giáo viên để trống hoặc để tọa độ (0, 0)
 * Bán kính từ 110m đến 175m cách đảo trung tâm (Làng Khởi Đầu), phân bố đều theo góc.
 */
export function computeArchipelagoOrbitalPosition(
  zoneIndex: number,
  totalZones = 8,
  minRadius = 110,
  maxRadius = 175
): { x: number; z: number } {
  const safeTotal = Math.max(totalZones, 6);
  // Góc cơ bản phân bố theo số lượng đảo, tránh góc 0 (hướng làng và vườn hoa)
  const angle = (zoneIndex / safeTotal) * Math.PI * 2 + 0.45;
  // Bán kính zic-zac tự nhiên
  const radius = minRadius + (zoneIndex % 3) * ((maxRadius - minRadius) / 2);
  return {
    x: Math.round(Math.cos(angle) * radius),
    z: Math.round(Math.sin(angle) * radius)
  };
}

/**
 * Tính toán tọa độ vị trí 3D cho các thực thể học tập (Bia đá / Cây hoa)
 * dựa theo Bản Mẫu Bố Cục Thử Thách (Procedural Layout Template).
 */
export const PARK_TREE_OFFSETS: { x: number; z: number; type: 'PINE' | 'TREE'; name: string }[] = [
  { x: 12.5, z: 4.9, type: 'TREE', name: 'Tree009' },
  { x: 7.6, z: 6.2, type: 'PINE', name: 'Pine011' },
  { x: 11.9, z: 11.7, type: 'TREE', name: 'Tree011' },
  { x: 7.3, z: 12.7, type: 'PINE', name: 'Pine012' },
  { x: 4.6, z: 9.9, type: 'TREE', name: 'Tree010' },
  { x: -6.9, z: 11.6, type: 'TREE', name: 'Tree002' },
  { x: -12.4, z: 13.6, type: 'PINE', name: 'Pine002' },
  { x: -11.7, z: 9.2, type: 'TREE', name: 'Tree003' },
  { x: -7.6, z: 5.3, type: 'PINE', name: 'Pine003' },
  { x: -12.9, z: 4.7, type: 'PINE', name: 'Pine004' },
  { x: -13.6, z: -7.2, type: 'PINE', name: 'Pine009' },
  { x: -7.9, z: -6.9, type: 'TREE', name: 'Tree006' },
  { x: -13.0, z: -11.9, type: 'PINE', name: 'Pine006' },
  { x: -9.3, z: -13.0, type: 'TREE', name: 'Tree005' },
  { x: -5.9, z: -11.1, type: 'PINE', name: 'Pine008' },
  { x: 5.5, z: -12.7, type: 'PINE', name: 'Pine010' },
  { x: 6.7, z: -8.8, type: 'TREE', name: 'Tree007' },
  { x: 11.3, z: -12.0, type: 'PINE', name: 'Pine005' },
  { x: 11.9, z: -6.7, type: 'TREE', name: 'Tree008' },
  { x: 6.4, z: -3.6, type: 'PINE', name: 'Pine007' }
];

import {
  computeLakeAnchors,
  computeLakeEntityPositions,
  LAKE_WALK_OUTER,
  usesLakeTerrain
} from './lakeLand';

export function computeZonePortalAnchors(
  zone: Pick<RemoteZoneConfig, 'template' | 'center' | 'width' | 'depth'>
): { returnPortal: { x: number; z: number; rotationY: number }; arrival: { x: number; z: number } } {
  if (zone.template === 'PROCEDURAL_SANCTUARY') {
    const radius = Math.max(zone.width, zone.depth) / 2;
    const portalDist = radius >= 11.2 ? radius - 3.2 : Math.max(2, radius - 3.2);
    const retX = Math.round((zone.center.x - portalDist) * 10) / 10;
    return {
      returnPortal: { x: retX, z: zone.center.z, rotationY: 0 },
      arrival: { x: Math.round((retX + 2.6) * 10) / 10, z: zone.center.z }
    };
  }
  if (usesLakeTerrain(zone.template)) {
    return computeLakeAnchors(zone.center);
  }
  const retX = Math.round((zone.center.x - zone.width / 2 + 3) * 10) / 10;
  return {
    returnPortal: { x: retX, z: zone.center.z, rotationY: 0 },
    arrival: { x: Math.round((retX + 2.5) * 10) / 10, z: zone.center.z }
  };
}

/**
 * Bảo đảm tọa độ bia đá/thực thể không nằm sát mép đảo hay chắn đè cổng dịch chuyển/điểm đáp.
 */
export function sanitizeZoneEntityPosition(
  zone: Pick<RemoteZoneConfig, 'id' | 'template' | 'center' | 'width' | 'depth'>,
  pos: { x: number; z: number } | null | undefined,
  fallbackPos?: { x: number; z: number }
): { x: number; z: number } {
  const candidate = pos ?? fallbackPos ?? { x: zone.center.x, z: zone.center.z };
  if (zone.template === 'PARK_SANCTUARY' || zone.template === 'FARM_SANCTUARY' || zone.template === 'FARM_RACE' || zone.template === 'QHMJ_SANCTUARY' || zone.id <= 5) {
    return candidate;
  }

  const anchors = computeZonePortalAnchors(zone);
  const isClearOfPortal = (p: { x: number; z: number }) =>
    Math.hypot(p.x - anchors.returnPortal.x, p.z - anchors.returnPortal.z) >= 3.5 &&
    Math.hypot(p.x - anchors.arrival.x, p.z - anchors.arrival.z) >= 2.6;

  const isInsideSafeMargin = (p: { x: number; z: number }) => {
    if (usesLakeTerrain(zone.template)) {
      return Math.hypot(p.x - zone.center.x, p.z - zone.center.z) <= LAKE_WALK_OUTER - 1.2;
    }
    if (zone.template === 'PROCEDURAL_SANCTUARY') {
      const r = Math.max(zone.width, zone.depth) / 2;
      return Math.hypot(p.x - zone.center.x, p.z - zone.center.z) <= Math.max(2, r - 2.0);
    }
    const maxDx = Math.max(1.5, zone.width / 2 - 2.0);
    const maxDz = Math.max(1.5, zone.depth / 2 - 2.0);
    return Math.abs(p.x - zone.center.x) <= maxDx && Math.abs(p.z - zone.center.z) <= maxDz;
  };

  if (isInsideSafeMargin(candidate) && isClearOfPortal(candidate)) {
    return candidate;
  }

  if (fallbackPos && isInsideSafeMargin(fallbackPos) && isClearOfPortal(fallbackPos)) {
    return fallbackPos;
  }

  // Kéo tọa độ vào trong biên an toàn và tránh vùng cổng về phía tâm đảo
  let nx = candidate.x;
  let nz = candidate.z;
  if (usesLakeTerrain(zone.template) || zone.template === 'PROCEDURAL_SANCTUARY') {
    const safeR = usesLakeTerrain(zone.template)
      ? LAKE_WALK_OUTER - 1.8
      : Math.max(2, Math.max(zone.width, zone.depth) / 2 - 2.2);
    const dx = nx - zone.center.x;
    const dz = nz - zone.center.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d > safeR) {
      nx = zone.center.x + (dx / d) * safeR;
      nz = zone.center.z + (dz / d) * safeR;
    }
  } else {
    const maxDx = Math.max(1.5, zone.width / 2 - 2.2);
    const maxDz = Math.max(1.5, zone.depth / 2 - 2.2);
    nx = Math.max(zone.center.x - maxDx, Math.min(zone.center.x + maxDx, nx));
    nz = Math.max(zone.center.z - maxDz, Math.min(zone.center.z + maxDz, nz));
  }

  const clamped = { x: Math.round(nx * 10) / 10, z: Math.round(nz * 10) / 10 };
  if (isClearOfPortal(clamped)) {
    return clamped;
  }

  // Đẩy lệch khỏi cổng về phía tâm/đông đảo
  const pushedX = Math.max(clamped.x, anchors.arrival.x + 2.8);
  const maxDxBox = Math.max(1.5, zone.width / 2 - 2.2);
  const safeX = usesLakeTerrain(zone.template) || zone.template === 'PROCEDURAL_SANCTUARY'
    ? Math.min(zone.center.x + 4, pushedX)
    : Math.min(zone.center.x + maxDxBox, pushedX);
  return { x: Math.round(safeX * 10) / 10, z: clamped.z };
}

export function computeProceduralEntityPositions(
  template: ZoneTemplateType,
  count: number,
  center: { x: number; z: number },
  width = 24,
  depth = 32
): { x: number; z: number }[] {
  if (count <= 0) return [];
  const positions: { x: number; z: number }[] = [];

  switch (template) {
    case 'PARK_SANCTUARY': {
      for (let i = 0; i < count; i++) {
        const offset = PARK_TREE_OFFSETS[i % PARK_TREE_OFFSETS.length];
        positions.push({
          x: Math.round((center.x + offset.x) * 10) / 10,
          z: Math.round((center.z + offset.z) * 10) / 10
        });
      }
      break;
    }

    case 'CIRCLE_SANCTUARY':
    case 'GRID_SANCTUARY': {
      return computeLakeEntityPositions(template, count, center);
    }

    case 'PROCEDURAL_SANCTUARY': {
      const radius = Math.min(width, depth) * 0.32;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI * 0.7 + (i / Math.max(1, count - 1)) * (Math.PI * 1.4);
        positions.push({
          x: Math.round((center.x + Math.cos(angle) * radius) * 10) / 10,
          z: Math.round((center.z + Math.sin(angle) * radius) * 10) / 10
        });
      }
      break;
    }

    case 'FLOWER_BEDS':
    default: {
      // 2 luống chạy dọc 2 bên lối đi trung tâm (chừa đủ khoảng trống bên Tây cho cổng về & biên đảo)
      const half = Math.ceil(count / 2);
      const rowOffsetZ = Math.min(Math.max(2.6, (depth / 2) * 0.55), Math.max(2.6, depth / 2 - 2.4));
      const minLeft = center.x - Math.max(0, width / 2 - 5.8);
      const defaultLeft = center.x - (width / 2) * 0.7;
      const leftX = Math.max(minLeft, defaultLeft);
      const rightX = Math.min(center.x + Math.max(2, width / 2 - 2.4), center.x + (width / 2) * 0.7);
      const stepX = half > 1 ? Math.max(0, rightX - leftX) / (half - 1) : 0;

      for (let i = 0; i < count; i++) {
        const isTop = i < half;
        const colIdx = isTop ? i : i - half;
        const posX = half > 1 ? leftX + colIdx * stepX : (leftX + rightX) / 2;
        const posZ = isTop ? center.z - rowOffsetZ : center.z + rowOffsetZ;
        positions.push({
          x: Math.round(posX * 10) / 10,
          z: Math.round(posZ * 10) / 10
        });
      }
      break;
    }
  }

  return positions;
}
