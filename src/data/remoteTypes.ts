export type ZoneTemplateType = 'FLOWER_BEDS' | 'CIRCLE_SANCTUARY' | 'GRID_SANCTUARY' | 'PARK_SANCTUARY';
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
  position?: { x: number; z: number } | null;
  color?: number;
  badge?: string;
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
}

export interface ExplorerProfile {
  nickname: string;
  className: string;
  isAnonymous: boolean;
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

    case 'CIRCLE_SANCTUARY': {
      const rx = (width / 2) * 0.65;
      const rz = (depth / 2) * 0.65;
      for (let i = 0; i < count; i++) {
        // Phân bố đều theo vòng tròn quanh đài trung tâm
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        positions.push({
          x: Math.round((center.x + Math.cos(angle) * rx) * 10) / 10,
          z: Math.round((center.z + Math.sin(angle) * rz) * 10) / 10
        });
      }
      break;
    }

    case 'FLOWER_BEDS': {
      // 2 luống chạy dọc 2 bên lối đi trung tâm
      const half = Math.ceil(count / 2);
      const rowOffsetZ = (depth / 2) * 0.55;
      const xSpan = (width / 2) * 0.7;
      const stepX = half > 1 ? (xSpan * 2) / (half - 1) : 0;

      for (let i = 0; i < count; i++) {
        const isTop = i < half;
        const colIdx = isTop ? i : i - half;
        const posX = center.x - xSpan + colIdx * stepX;
        const posZ = isTop ? center.z - rowOffsetZ : center.z + rowOffsetZ;
        positions.push({
          x: Math.round(posX * 10) / 10,
          z: Math.round(posZ * 10) / 10
        });
      }
      break;
    }

    case 'GRID_SANCTUARY':
    default: {
      // Bố trí dạng lưới 2 hàng ngay ngắn (tương tự 5 phân khu Archimedes)
      const half = Math.ceil(count / 2);
      const xSpan = Math.min((width / 2) * 0.75, (half - 1) * 3.5);
      const stepX = half > 1 ? (xSpan * 2) / (half - 1) : 0;
      const rowSpacing = Math.min((depth / 2) * 0.6, 6.0);

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / half);
        const col = i % half;
        const posX = center.x - xSpan + col * stepX;
        const posZ = center.z + (row === 0 ? -rowSpacing : rowSpacing);
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
