export const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type Table = typeof TABLES[number];
export const SAVE_KEY = 'aigame3d_multiplication_save';
export const BRIDGE_PARTS = 6;

/**
 * 20-level XP progression curve: XP(L) = 25 * L * (L + 1) - 50
 * Preserves Lv1..Lv5 thresholds: [0, 100, 250, 450, 700]
 */
export const LEVEL_XP: readonly number[] = Array.from(
  { length: 20 },
  (_, idx) => 25 * (idx + 1) * (idx + 2) - 50
);

export const LEVEL_TITLES: readonly string[] = [
  'Tập Sự Làng Cỏ',
  'Người Xây Cầu',
  'Bạn Của Hoa',
  'Người Gác Vườn',
  'Hiệp Sĩ Cửu Chương',
  'Người Tìm Sao',
  'Kỵ Sĩ Ánh Sáng',
  'Học Trò Sáng Tạo',
  'Người Mở Cổng',
  'Nhà Thám Hiểm Sao',
  'Học Giả Tập Sự',
  'Người Giải Mã',
  'Nhà Hình Học Nhí',
  'Bậc Thầy Dãy Số',
  'Học Giả Archimedes',
  'Hiền Triết Đảo Xanh',
  'Người Giữ Tri Thức',
  'Thủ Lĩnh Vương Quốc',
  'Huyền Thoại Toán Học',
  'Đại Kiến Trúc Sư Vương Quốc'
];

export const WORLD = { riverMin: 4, riverMax: 10, bridgeZ: 0, bridgeWidth: 3.4, bounds: 34 };

export const getLevel = (xp: number): number =>
  1 + LEVEL_XP.slice(1).filter((n) => xp >= n).length;

export const getLevelTitle = (level: number): string => {
  const idx = Math.max(0, Math.min(LEVEL_TITLES.length - 1, Math.floor(level) - 1));
  return LEVEL_TITLES[idx];
};
