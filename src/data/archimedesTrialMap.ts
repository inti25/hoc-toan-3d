export interface ArchimedesStep {
  stepId: string;
  prompt: string;
  imageUrl?: string;
  diagramSvg?: string;
  options: { label: string; value: string }[];
  answer: string;
  hints: string[];
  explanation: string;
  explanationImageUrl?: string;
}

export interface ArchimedesMonolith {
  id: number;
  zoneId: 1 | 2 | 3 | 4 | 5;
  zoneName: string;
  page: number;
  title: string;
  subtitle: string;
  position: { x: number; z: number };
  color: number;
  badge: string;
  steps: ArchimedesStep[];
}

export interface ArchimedesZone {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  title: string;
  description: string;
  center: { x: number; z: number };
  color: number;
  badge: string;
}

export const ARCHIMEDES_ZONES: ArchimedesZone[] = [
  {
    "id": 1,
    "name": "Thung Lũng Tính Toán & Đại Lượng",
    "title": "Khu 1: Phép Tính & Đo Lường",
    "description": "Rèn luyện đặt tính cộng trừ 3 chữ số, đại lượng kg, cm, lít và tìm thành phần chưa biết.",
    "center": {
      "x": 110,
      "z": -60
    },
    "color": 4367861,
    "badge": "🏆 Huy Chương Thung Lũng Tính Toán"
  },
  {
    "id": 2,
    "name": "Suối Nguồn Tính Nhanh & Dãy Số",
    "title": "Khu 2: Tính Nhanh & Quy Luật Số",
    "description": "Chinh phục nghệ thuật nhóm số tròn chục tròn trăm và giải mã các dãy số bí ẩn.",
    "center": {
      "x": 150,
      "z": -60
    },
    "color": 2533018,
    "badge": "⚡ Huy Chương Dãy Số Ma Thuật"
  },
  {
    "id": 3,
    "name": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "title": "Khu 3: Đồng Hồ, Lịch & Cân Đĩa",
    "description": "Khám phá thế giới thời gian 24h, lịch ngày trong tuần và bài toán cân đĩa thăng bằng.",
    "center": {
      "x": 110,
      "z": 60
    },
    "color": 16754470,
    "badge": "⏳ Huy Chương Người Quản Thời Gian"
  },
  {
    "id": 4,
    "name": "Rừng Hình Học & Đường Gấp Khúc",
    "title": "Khu 4: Hình Học & Đường Gấp Khúc",
    "description": "Quan sát các hình tam giác, tứ giác, trung điểm đoạn thẳng và tính độ dài đường gấp khúc.",
    "center": {
      "x": 150,
      "z": 60
    },
    "color": 6732650,
    "badge": "📐 Huy Chương Bậc Thầy Hình Học"
  },
  {
    "id": 5,
    "name": "Đỉnh Núi Tư Duy Sao (*, **)",
    "title": "Khu 5: Thử Thách Tư Duy Đỉnh Cao",
    "description": "Thử thách trí tuệ với các bài toán sao nâng cao: ma trận ô số, số ma thuật và logic tối ưu.",
    "center": {
      "x": 190,
      "z": 0
    },
    "color": 11225020,
    "badge": "👑 Đại Vương Miện Archimedes"
  }
];

/**
 * Danh sách bia đá Archimedes được nạp động 100% từ Google Sheets qua Apps Script.
 * Mảng mặc định để rỗng trên Frontend.
 */
export const ARCHIMEDES_MONOLITHS: ArchimedesMonolith[] = [];

export function getMonolithById(id: number): ArchimedesMonolith | undefined {
  return ARCHIMEDES_MONOLITHS.find(m => m.id === id);
}

export function getMonolithsByZone(zoneId: number): ArchimedesMonolith[] {
  return ARCHIMEDES_MONOLITHS.filter(m => m.zoneId === zoneId);
}
