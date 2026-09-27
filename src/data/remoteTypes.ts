export type ZoneTemplateType = 'FLOWER_BEDS' | 'CIRCLE_SANCTUARY' | 'GRID_SANCTUARY';

export interface RemoteStep {
  stepId: string;
  prompt: string;
  options: { label: string; value: string }[];
  answer: string;
  hints: string[];
  explanation: string;
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
 * Tính toán tọa độ vị trí 3D cho các thực thể học tập (Bia đá / Cây hoa)
 * dựa theo Bản Mẫu Bố Cục Thử Thách (Procedural Layout Template).
 */
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
