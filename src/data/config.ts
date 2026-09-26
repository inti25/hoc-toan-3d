export const TABLES = [2, 5, 10] as const;
export type Table = typeof TABLES[number];
export const SAVE_KEY = 'aigame3d_multiplication_save';
export const BRIDGE_PARTS = 6;
export const LEVEL_XP = [0, 100, 250, 450, 700];
export const WORLD = { riverMin: 4, riverMax: 10, bridgeZ: 0, bridgeWidth: 3.4, bounds: 34 };
export const getLevel = (xp: number) => 1 + LEVEL_XP.slice(1).filter(n => xp >= n).length;
