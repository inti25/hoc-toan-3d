/**
 * Thuần logic hướng dẫn tìm Động Vật Xổng Chuồng trong `FARM_SANCTUARY`:
 * - Nhận diện khu vực địa danh theo tọa độ local trên bản đồ 3D (~220 × 165 m).
 * - Tính góc la bàn tương đối theo `cameraYaw` và chỉ dẫn hướng thân thiện cho bé.
 * - Sắp xếp danh sách thú còn lại (ưu tiên độ ổn định dưới ngón tay), xử lý ghim & tự động về Cổng Làng.
 * Không phụ thuộc DOM hay Three.js để kiểm thử trực tiếp trên Node.
 */

import { FARM_PEN_CENTER_LOCAL, FARM_RETURN_PORTAL_LOCAL } from '../../data/farmMap';

export const FARM_ARRIVAL_DISTANCE_M = 6;
export const FARM_COMPASS_FORWARD_DEG = 35;
export const FARM_COMPASS_BEHIND_DEG = 145;

export interface FarmSpeciesMeta {
  readonly kind: string;
  readonly name: string;
  readonly emoji: string;
}

export const FARM_ANIMAL_SPECIES_META: Readonly<Record<string, FarmSpeciesMeta>> = {
  cow: { kind: 'cow', name: 'Bò Sữa', emoji: '🐮' },
  calf: { kind: 'calf', name: 'Bê Con', emoji: '🐮' },
  pig: { kind: 'pig', name: 'Heo Ủn Ỉn', emoji: '🐷' },
  piglet: { kind: 'piglet', name: 'Heo Con', emoji: '🐷' },
  chicken: { kind: 'chicken', name: 'Gà Mái', emoji: '🐔' },
  chick: { kind: 'chick', name: 'Gà Con', emoji: '🐥' },
  duck: { kind: 'duck', name: 'Vịt Trắng', emoji: '🦆' },
  duckling: { kind: 'duckling', name: 'Vịt Con', emoji: '🐤' },
  dog: { kind: 'dog', name: 'Cún Cưng', emoji: '🐶' }
};

export function getFarmAnimalVietnameseName(kind: string): string {
  return FARM_ANIMAL_SPECIES_META[kind]?.name ?? 'Bé Thú';
}

export function getFarmAnimalEmoji(kind: string): string {
  return FARM_ANIMAL_SPECIES_META[kind]?.emoji ?? '🐾';
}

/**
 * Suy ra tên khu vực nông trại bằng tiếng Việt từ tọa độ local `(localX, localZ)`
 * khớp với các vùng cảnh quan trong `public/3dmodel/maps/farm/scene.gltf`.
 */
export function describeFarmArea(localX: number, localZ: number): string {
  const distToPen = Math.hypot(localX - FARM_PEN_CENTER_LOCAL.x, localZ - FARM_PEN_CENTER_LOCAL.z);
  if (distToPen <= 22) {
    return 'Gần Khu Chuồng Trại';
  }
  if (localZ <= -38) {
    if (localX >= 36) return 'Đồng cỏ Đông Bắc';
    if (localX <= -36) return 'Đường vòng Tây Bắc';
    return 'Đường vòng phía Bắc';
  }
  if (localZ >= 34) {
    if (localX >= 36) return 'Cánh đồng lúa Đông Nam';
    if (localX <= -30) return 'Khúc cua Tây Nam';
    return 'Đường thẳng phía Nam';
  }
  if (localX >= 36) return 'Đường thẳng phía Đông';
  if (localX <= -48) return 'Lối đá cuội phía Tây';
  return 'Bãi cỏ trung tâm';
}

export type FarmDirectionCue =
  | 'Đi thẳng'
  | 'Rẽ phải'
  | 'Rẽ trái'
  | 'Quay lại'
  | '✨ Đã tới gần!';

export interface CompassGuidance {
  distanceMeters: number;
  relativeAngleRad: number;
  /** Góc xoay CSS (độ): 0° hướng lên (trước mặt), +90° sang phải, -90° sang trái, ±180° phía sau. */
  arrowDeg: number;
  isNear: boolean;
  directionText: FarmDirectionCue;
}

/**
 * Tính góc la bàn tương đối và chỉ dẫn hướng từ người chơi đến mục tiêu theo `cameraYaw`.
 * Khớp quy ước camera trong `World.ts` và di chuyển trong `SpatialWorld.ts`:
 * - Hướng nhìn tới trước (W): `(-sin(cameraYaw), -cos(cameraYaw))`
 * - Hướng sang phải (D): `(cos(cameraYaw), -sin(cameraYaw))`
 */
export function computeCompassGuidance(
  playerPos: { x: number; z: number },
  cameraYaw: number,
  targetPos: { x: number; z: number }
): CompassGuidance {
  const dx = targetPos.x - playerPos.x;
  const dz = targetPos.z - playerPos.z;
  const distanceMeters = Math.hypot(dx, dz);

  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);

  const forwardDot = dx * forwardX + dz * forwardZ;
  const rightDot = dx * rightX + dz * rightZ;

  const relativeAngleRad = distanceMeters < 0.001 ? 0 : Math.atan2(rightDot, forwardDot);
  const arrowDeg = (relativeAngleRad * 180) / Math.PI;
  const absDeg = Math.abs(arrowDeg);
  const isNear = distanceMeters < FARM_ARRIVAL_DISTANCE_M;

  let directionText: FarmDirectionCue;
  if (isNear) {
    directionText = '✨ Đã tới gần!';
  } else if (absDeg <= FARM_COMPASS_FORWARD_DEG) {
    directionText = 'Đi thẳng';
  } else if (absDeg >= FARM_COMPASS_BEHIND_DEG) {
    directionText = 'Quay lại';
  } else if (arrowDeg > 0) {
    directionText = 'Rẽ phải';
  } else {
    directionText = 'Rẽ trái';
  }

  return {
    distanceMeters,
    relativeAngleRad,
    arrowDeg,
    isNear,
    directionText
  };
}

export function formatShortProblemTitle(
  rawTitle: string | undefined,
  displayName: string
): string | undefined {
  if (!rawTitle) return undefined;
  const trimmed = rawTitle.trim().replace(/\s+/g, ' ');
  if (!trimmed) return undefined;
  if (/^Bài\s+\d+$/i.test(trimmed)) return undefined;
  if (trimmed.toLowerCase() === displayName.toLowerCase()) return undefined;
  if (trimmed.length <= 34) return trimmed;
  return `${trimmed.slice(0, 33).trimEnd()}…`;
}

export interface FarmAnimalTrackerSource {
  id: string;
  index: number;
  kind: string;
  localPos: { x: number; z: number };
  rescued: boolean;
  problemTitle?: string;
}

export interface FarmTrackedAnimalView {
  id: string;
  index: number;
  kind: string;
  emoji: string;
  displayName: string;
  shortTitle?: string;
  areaHint: string;
  localPos: { x: number; z: number };
  distanceMeters: number;
  isPinned: boolean;
  isActiveTarget: boolean;
}

export type FarmGuidanceTarget =
  | {
      kind: 'animal';
      id: string;
      emoji: string;
      label: string;
      areaHint: string;
      localPos: { x: number; z: number };
      isPinned: boolean;
    }
  | {
      kind: 'portal';
      id: 'return_portal';
      emoji: '🏡';
      label: 'Cổng Về Làng Khởi Đầu';
      areaHint: 'Khu Chuồng Trại · Lối về làng';
      localPos: { x: number; z: number };
      isPinned: boolean;
    };

export interface FarmTrackerSnapshot {
  totalCount: number;
  remainingCount: number;
  allRescued: boolean;
  /** ID con vật đang cần dựng cột sáng 3D nổi bật, hoặc `null` khi đang chỉ về cổng làng. */
  focusedAnimalId: string | null;
  effectivePinnedId: string | null;
  guideToPortalActive: boolean;
  didResort: boolean;
  orderedIds: string[];
  target: FarmGuidanceTarget;
  compass: CompassGuidance;
  remainingAnimals: FarmTrackedAnimalView[];
}

export function orderTrackedAnimals<T extends { id: string; index: number; distanceMeters: number }>(
  items: ReadonlyArray<T>,
  previousOrderIds: ReadonlyArray<string>,
  allowResort: boolean,
  toleranceMeters = 2.0
): { ordered: T[]; didResort: boolean } {
  const sortedByDist = [...items].sort(
    (a, b) => a.distanceMeters - b.distanceMeters || a.index - b.index
  );

  if (previousOrderIds.length === 0) {
    return { ordered: sortedByDist, didResort: true };
  }

  const byId = new Map<string, T>();
  for (const item of items) {
    byId.set(item.id, item);
  }

  const preserved: T[] = [];
  const seen = new Set<string>();
  for (const id of previousOrderIds) {
    const found = byId.get(id);
    if (found) {
      preserved.push(found);
      seen.add(id);
    }
  }

  const newlyAdded = sortedByDist.filter((item) => !seen.has(item.id));
  const combined = [...preserved, ...newlyAdded];

  if (!allowResort) {
    return { ordered: combined, didResort: false };
  }

  if (newlyAdded.length === 0 && combined.length === items.length) {
    let withinTolerance = true;
    for (let i = 0; i < combined.length - 1; i++) {
      if (combined[i].distanceMeters > combined[i + 1].distanceMeters + toleranceMeters) {
        withinTolerance = false;
        break;
      }
    }
    if (withinTolerance) {
      return { ordered: combined, didResort: false };
    }
  }

  return { ordered: sortedByDist, didResort: true };
}

export interface BuildFarmTrackerSnapshotInput {
  animals: ReadonlyArray<FarmAnimalTrackerSource>;
  playerLocalPos: { x: number; z: number };
  cameraYaw: number;
  pinnedAnimalId: string | null;
  guideToPortal: boolean;
  previousOrderIds: ReadonlyArray<string>;
  allowResort: boolean;
  sortToleranceMeters?: number;
  returnPortalLocalPos?: { x: number; z: number };
}

export function buildFarmTrackerSnapshot(
  input: BuildFarmTrackerSnapshotInput
): FarmTrackerSnapshot {
  const portalPos = input.returnPortalLocalPos ?? {
    x: FARM_RETURN_PORTAL_LOCAL.x,
    z: FARM_RETURN_PORTAL_LOCAL.z
  };
  const totalCount = input.animals.length;

  const remainingBase: FarmTrackedAnimalView[] = [];
  for (const a of input.animals) {
    if (a.rescued) continue;
    const emoji = getFarmAnimalEmoji(a.kind);
    const displayName = `${getFarmAnimalVietnameseName(a.kind)} #${a.index + 1}`;
    const shortTitle = formatShortProblemTitle(a.problemTitle, displayName);
    const distanceMeters = Math.hypot(
      a.localPos.x - input.playerLocalPos.x,
      a.localPos.z - input.playerLocalPos.z
    );
    remainingBase.push({
      id: a.id,
      index: a.index,
      kind: a.kind,
      emoji,
      displayName,
      shortTitle,
      areaHint: describeFarmArea(a.localPos.x, a.localPos.z),
      localPos: { x: a.localPos.x, z: a.localPos.z },
      distanceMeters,
      isPinned: false,
      isActiveTarget: false
    });
  }

  const remainingCount = remainingBase.length;
  const allRescued = totalCount > 0 && remainingCount === 0;

  const pinnedCandidate = input.pinnedAnimalId
    ? remainingBase.find((a) => a.id === input.pinnedAnimalId) ?? null
    : null;
  const effectivePinnedId = allRescued ? null : pinnedCandidate?.id ?? null;

  const { ordered, didResort } = orderTrackedAnimals(
    remainingBase,
    input.previousOrderIds,
    input.allowResort,
    input.sortToleranceMeters ?? 2.0
  );

  let target: FarmGuidanceTarget;
  let focusedAnimalId: string | null = null;
  let guideToPortalActive = false;

  if (allRescued || remainingCount === 0 || input.guideToPortal) {
    guideToPortalActive = input.guideToPortal || allRescued || remainingCount === 0;
    target = {
      kind: 'portal',
      id: 'return_portal',
      emoji: '🏡',
      label: 'Cổng Về Làng Khởi Đầu',
      areaHint: 'Khu Chuồng Trại · Lối về làng',
      localPos: { x: portalPos.x, z: portalPos.z },
      isPinned: false
    };
  } else if (pinnedCandidate) {
    focusedAnimalId = pinnedCandidate.id;
    target = {
      kind: 'animal',
      id: pinnedCandidate.id,
      emoji: pinnedCandidate.emoji,
      label: pinnedCandidate.displayName,
      areaHint: pinnedCandidate.areaHint,
      localPos: { ...pinnedCandidate.localPos },
      isPinned: true
    };
  } else {
    let nearest = remainingBase[0];
    for (let i = 1; i < remainingBase.length; i++) {
      if (remainingBase[i].distanceMeters < nearest.distanceMeters) {
        nearest = remainingBase[i];
      }
    }
    focusedAnimalId = nearest.id;
    target = {
      kind: 'animal',
      id: nearest.id,
      emoji: nearest.emoji,
      label: nearest.displayName,
      areaHint: nearest.areaHint,
      localPos: { ...nearest.localPos },
      isPinned: false
    };
  }

  const remainingAnimals = ordered.map((item) => ({
    ...item,
    isPinned: item.id === effectivePinnedId,
    isActiveTarget: item.id === focusedAnimalId
  }));

  const compass = computeCompassGuidance(
    input.playerLocalPos,
    input.cameraYaw,
    target.localPos
  );

  return {
    totalCount,
    remainingCount,
    allRescued,
    focusedAnimalId,
    effectivePinnedId,
    guideToPortalActive,
    didResort,
    orderedIds: remainingAnimals.map((item) => item.id),
    target,
    compass,
    remainingAnimals
  };
}
