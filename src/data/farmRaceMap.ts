import type { FarmAnimalKind } from './farmMap';
import type { RemoteZoneConfig } from './remoteTypes';

export const FARM_RACE_TEMPLATE = 'FARM_RACE' as const;

export const FARM_RACE_RECOMMENDED_CENTER = { x: 400, z: -400 } as const;
export const FARM_RACE_RECOMMENDED_SIZE = { width: 220, depth: 165 } as const;
export const FARM_RACE_REGION_RADIUS = 150;

export const FARM_RACE_VILLAGE_PORTAL = { x: -1, z: 9 } as const;
export const FARM_RACE_VILLAGE_RETURN_TARGET = { x: -3, z: 7 } as const;

export const FARM_RACE_START_LOCAL = { x: 13.0, y: 1.17, z: 63.5 } as const;
export const FARM_RACE_SPAWN_LOCAL = { x: 17.0, y: 1.25, z: 63.5 } as const;
export const FARM_RACE_RETURN_PORTAL_LOCAL = { x: 24.0, y: 1.87, z: 69.0 } as const;

export const FARM_RACE_BASE_SPEED = 11.5;
export const FARM_RACE_BOOST_SPEED = 18.0;
export const FARM_RACE_FIRST_TRY_BOOST_SPEED = 19.2;
export const FARM_RACE_BOOST_DURATION_SEC = 4.5;
export const FARM_RACE_FIRST_TRY_BOOST_SEC = 5.5;

export const FARM_RACE_CAMERA_DEFAULTS = {
  yaw: Math.PI / 2,
  pitch: 0.28,
  distance: 7.2,
  fov: 56,
  far: 950,
  fogNear: 480,
  fogFar: 1100
} as const;

export interface FarmRaceAnimalMeta {
  readonly kind: FarmAnimalKind;
  readonly name: string;
  readonly emoji: string;
  readonly trait: string;
  readonly colorHex: string;
}

export const FARM_RACE_ANIMALS: ReadonlyArray<FarmRaceAnimalMeta> = [
  { kind: 'dog', name: 'Cún Cưng', emoji: '🐶', trait: 'Nhanh nhẹn · Bền bỉ', colorHex: '#f59e0b' },
  { kind: 'cow', name: 'Bò Sữa', emoji: '🐮', trait: 'Vững vàng · Mạnh mẽ', colorHex: '#38bdf8' },
  { kind: 'pig', name: 'Heo Ủn Ỉn', emoji: '🐷', trait: 'Vui vẻ · Bứt tốc tốt', colorHex: '#ec4899' },
  { kind: 'chicken', name: 'Gà Mái', emoji: '🐔', trait: 'Lanh lợi · Nhảy gọn', colorHex: '#ef4444' },
  { kind: 'duck', name: 'Vịt Trắng', emoji: '🦆', trait: 'Khéo léo · Vào cua mượt', colorHex: '#10b981' }
];

export const FARM_RACE_TRACK_WAYPOINTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: 13, z: 63.5 },
  { x: 6, z: 63.9 },
  { x: -1.1, z: 63.4 },
  { x: -9, z: 63.4 },
  { x: -15.9, z: 64 },
  { x: -22.4, z: 63 },
  { x: -29.3, z: 61.5 },
  { x: -36.7, z: 61 },
  { x: -44.5, z: 61.4 },
  { x: -50.7, z: 63.4 },
  { x: -57.8, z: 66.8 },
  { x: -64.6, z: 67.8 },
  { x: -71.5, z: 67.5 },
  { x: -79, z: 67 },
  { x: -85.5, z: 65 },
  { x: -90.6, z: 60.9 },
  { x: -94.3, z: 54.9 },
  { x: -97.3, z: 48.8 },
  { x: -99.1, z: 42.8 },
  { x: -98.4, z: 36.6 },
  { x: -95.4, z: 32 },
  { x: -89.7, z: 28.4 },
  { x: -82.5, z: 26.2 },
  { x: -75.6, z: 24.4 },
  { x: -68, z: 22.7 },
  { x: -60.8, z: 21.4 },
  { x: -53, z: 20.9 },
  { x: -45.9, z: 20.3 },
  { x: -38.8, z: 19.7 },
  { x: -31.1, z: 20 },
  { x: -24, z: 20.2 },
  { x: -16.7, z: 20.5 },
  { x: -9.2, z: 21.3 },
  { x: -1.6, z: 22.3 },
  { x: 5.8, z: 23.4 },
  { x: 12.5, z: 26 },
  { x: 19.1, z: 29.5 },
  { x: 25.5, z: 31 },
  { x: 31.7, z: 30.5 },
  { x: 37.6, z: 27.6 },
  { x: 42.2, z: 23 },
  { x: 45.5, z: 17.2 },
  { x: 46.5, z: 11 },
  { x: 45.8, z: 4 },
  { x: 43.2, z: -2.6 },
  { x: 39.3, z: -6.8 },
  { x: 33.9, z: -8.4 },
  { x: 26.4, z: -8.2 },
  { x: 19.5, z: -7.9 },
  { x: 11.8, z: -7.8 },
  { x: 3.6, z: -7.6 },
  { x: -3.3, z: -7.4 },
  { x: -11, z: -7.4 },
  { x: -19, z: -7.2 },
  { x: -26.2, z: -7 },
  { x: -33.3, z: -5.6 },
  { x: -38.3, z: -2.4 },
  { x: -43.1, z: 4.2 },
  { x: -46.8, z: 8.5 },
  { x: -51.4, z: 10.9 },
  { x: -58.3, z: 10.6 },
  { x: -65, z: 7.6 },
  { x: -71.8, z: 5.1 },
  { x: -78.2, z: 1.9 },
  { x: -82.4, z: -3 },
  { x: -86.8, z: -9.1 },
  { x: -91.9, z: -12.8 },
  { x: -98.2, z: -16.9 },
  { x: -101.6, z: -22.2 },
  { x: -102.6, z: -28.5 },
  { x: -101.2, z: -35.2 },
  { x: -100.9, z: -42.6 },
  { x: -100.4, z: -50.6 },
  { x: -98.5, z: -57.9 },
  { x: -95.2, z: -63.8 },
  { x: -90.7, z: -67.3 },
  { x: -84.2, z: -69.3 },
  { x: -77.9, z: -68.5 },
  { x: -72, z: -65 },
  { x: -66.1, z: -60.5 },
  { x: -60.1, z: -56.3 },
  { x: -54.1, z: -53.2 },
  { x: -47.2, z: -52.1 },
  { x: -39.4, z: -52.2 },
  { x: -32.5, z: -52.8 },
  { x: -26.3, z: -54.9 },
  { x: -21, z: -58.8 },
  { x: -16.1, z: -64.1 },
  { x: -10.2, z: -67.9 },
  { x: -4.1, z: -69 },
  { x: 2.2, z: -67.4 },
  { x: 7.4, z: -63.3 },
  { x: 10.3, z: -57.6 },
  { x: 11.8, z: -50.4 },
  { x: 14.5, z: -43.6 },
  { x: 18.4, z: -37.8 },
  { x: 23.8, z: -34.1 },
  { x: 30.4, z: -32.2 },
  { x: 37.9, z: -31.2 },
  { x: 45.4, z: -30.2 },
  { x: 51.7, z: -27.9 },
  { x: 56.2, z: -24 },
  { x: 57.9, z: -19.2 },
  { x: 57.5, z: -12 },
  { x: 57.5, z: -4.5 },
  { x: 59.6, z: 0.9 },
  { x: 64.3, z: 7.1 },
  { x: 67.8, z: 13.6 },
  { x: 72.1, z: 17 },
  { x: 77.7, z: 18 },
  { x: 84.4, z: 17.1 },
  { x: 92, z: 16.4 },
  { x: 98.4, z: 17.7 },
  { x: 102.5, z: 20.7 },
  { x: 103.9, z: 25.6 },
  { x: 102.6, z: 30.6 },
  { x: 98.3, z: 36.6 },
  { x: 93.4, z: 42.3 },
  { x: 87.7, z: 46.4 },
  { x: 81.5, z: 49.4 },
  { x: 74.6, z: 50.7 },
  { x: 67, z: 51.2 },
  { x: 59.9, z: 51.5 },
  { x: 53.1, z: 51.5 },
  { x: 45.2, z: 51.8 },
  { x: 39.7, z: 53.9 },
  { x: 34.1, z: 58 },
  { x: 27.9, z: 62 }
];

export interface FarmRaceAnchors {
  startLine: { x: number; y: number; z: number };
  spawn: { x: number; y: number; z: number };
  returnPortal: { x: number; y: number; z: number };
}

export function computeFarmRaceAnchors(center: { x: number; z: number }): FarmRaceAnchors {
  return {
    startLine: {
      x: center.x + FARM_RACE_START_LOCAL.x,
      y: FARM_RACE_START_LOCAL.y,
      z: center.z + FARM_RACE_START_LOCAL.z
    },
    spawn: {
      x: center.x + FARM_RACE_SPAWN_LOCAL.x,
      y: FARM_RACE_SPAWN_LOCAL.y,
      z: center.z + FARM_RACE_SPAWN_LOCAL.z
    },
    returnPortal: {
      x: center.x + FARM_RACE_RETURN_PORTAL_LOCAL.x,
      y: FARM_RACE_RETURN_PORTAL_LOCAL.y,
      z: center.z + FARM_RACE_RETURN_PORTAL_LOCAL.z
    }
  };
}

export function farmRaceZoneSpawn(zone: Pick<RemoteZoneConfig, 'center'>): { x: number; y: number; z: number } {
  return computeFarmRaceAnchors(zone.center).spawn;
}

export function farmRaceProgressKey(zoneId: number, problemId: number | string): string {
  return `farm_race_${zoneId}_${String(problemId)}`;
}
