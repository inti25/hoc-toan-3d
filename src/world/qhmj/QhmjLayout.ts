import type { RemoteProblem } from '../../data/remoteTypes';
import type { QhmjAnchors } from '../../data/qhmjMap';
import type { JumpLink } from './JumpLinks';
import type { RoadSurface, Vec3 } from './RoadSurface';

export type QhmjNodeKind = 'jump_gate' | 'path_crystal' | 'clock_summit';

export interface QhmjNodeSpec {
  index: number;
  id: string | number;
  progressKey: string;
  kind: QhmjNodeKind;
  tier: 1 | 2 | 3;
  position: Vec3;
  island: number;
  /** Các JumpLink.id bị khóa cho tới khi giải xong node này (chỉ có ở `jump_gate`). */
  lockedLinkIds: number[];
  problem: RemoteProblem;
}

export interface TierAllocation {
  tier1: number;
  tier2: number;
  tier3: number;
}

/** Khóa lưu tiến độ chuẩn hóa theo zone để không trùng ID `1..20` của Vườn Hoa/Công Viên. */
export function qhmjProgressKey(zoneId: number, problemId: string | number): string {
  return `qhmj_${zoneId}_${problemId}`;
}

/**
 * Chia `N` câu hỏi (không phụ thuộc chủ đề) thành 3 tầng cao độ:
 * - Tầng 1 (`Island 4` + `Island 2`): tối đa 15 điểm (gồm tối đa 4 bệ nhảy mở đường).
 * - Tầng 3 (`Island 3` + `Island 0`): tối đa 27 điểm (ít nhất 1 điểm trên đỉnh).
 * - Tầng 2 (`Island 1` trục chính): nhận phần còn lại.
 */
export function splitQhmjProblemsByTier(count: number): TierAllocation {
  if (count <= 0) return { tier1: 0, tier2: 0, tier3: 0 };
  if (count < 3) return { tier1: 0, tier2: count - 1, tier3: 1 };
  const tier1 = Math.min(15, Math.floor(count / 3));
  const tier3 = Math.min(27, Math.max(1, Math.floor(count / 3)));
  const tier2 = count - tier1 - tier3;
  return { tier1, tier2, tier3 };
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Điểm mốc đẹp dọc đường (tọa độ local ở QHMJ_SCALE = 16) để ưu tiên neo tinh thể. */
const ISLAND1_LANDMARK_LOCALS: readonly Vec3[] = [
  { x: -62.6, y: 11.8, z: -8.44 },   // Bánh răng Tây #1
  { x: -49.28, y: 11.79, z: 7.19 },  // Bánh răng Tây #2
  { x: -13.13, y: 17.74, z: 21.28 }, // Rừng senlin: map_daoju_02
  { x: 22.27, y: 20.27, z: 11.53 },  // Rừng senlin: map_daoju_02 (1)
  { x: 27.19, y: 21.28, z: 20.82 },  // Rừng senlin: map_daoju_02 (2)
  { x: 42.55, y: 22.27, z: 38.93 },  // Rừng senlin: map_daoju_02 (3)
  { x: 59.42, y: 22.77, z: 23.61 },  // Rừng senlin: map_daoju_02s
  { x: 67.79, y: 22.92, z: 29.46 }   // Rừng senlin: map_daoju_02s (1)
];

const ISLAND3_LANDMARK_LOCALS: readonly Vec3[] = [
  { x: -0.17, y: 16.46, z: -47.66 }, // Quảng trường chengbao: map_daoju_02 (4)
  { x: 32.28, y: 16.46, z: -42.82 }, // Hoa sân lớn
  { x: 27.96, y: 16.46, z: -52.64 },
  { x: 21.23, y: 16.46, z: -54.5 }
];

function collectIslandCandidates(
  surface: RoadSurface,
  island: number,
  center: { x: number; z: number },
  anchors: QhmjAnchors,
  links: JumpLink[],
  preferredLocals: readonly Vec3[] = []
): Vec3[] {
  const candidates: Vec3[] = [];
  const isSafeSpot = (p: Vec3): boolean => {
    if (!surface.hasClearance(p.x, p.z, p.y, 0.9, 1.0, 1.0)) return false;
    if (dist3(p, anchors.spawn) < 3.5) return false;
    if (dist3(p, anchors.returnPortal) < 3.5) return false;
    if (links.some((l) => dist3(p, l.pad) < 3.0 || dist3(p, l.target) < 3.0)) return false;
    return true;
  };

  for (const loc of preferredLocals) {
    const wx = center.x + loc.x;
    const wz = center.z + loc.z;
    const hit = surface.sampleNearest(wx, wz, loc.y);
    if (hit && hit.island === island) {
      const p = { x: wx, y: hit.y, z: wz };
      if (isSafeSpot(p)) candidates.push(p);
    }
  }

  const rawVerts = surface.verticesByDistance({ x: center.x, y: 0, z: center.z }, (i) => i === island, 5000);
  for (const v of rawVerts) {
    if (isSafeSpot(v)) candidates.push(v);
  }
  return candidates;
}

/**
 * Chọn tối đa `needed` điểm từ `candidates` sao cho khoảng cách 3D tới mọi điểm đã đặt
 * đạt ít nhất ngưỡng `minGap` (tự động nới ngưỡng từ 8m xuống 1.5m khi số câu lớn).
 */
function pickSpacedSpots(
  candidates: Vec3[],
  needed: number,
  occupied: Vec3[],
  gaps: readonly number[] = [8, 6, 4.5, 3, 1.5]
): Vec3[] {
  if (needed <= 0 || candidates.length === 0) return [];
  const chosen: Vec3[] = [];
  const allTaken = [...occupied];

  for (const gap of gaps) {
    for (const c of candidates) {
      if (chosen.length >= needed) return chosen;
      if (allTaken.some((o) => dist3(c, o) < gap)) continue;
      chosen.push(c);
      allTaken.push(c);
    }
  }

  // Fallback cuối cùng nếu mật độ quá dày (>120 điểm): chấp nhận bất kỳ điểm nào chưa trùng khít
  for (const c of candidates) {
    if (chosen.length >= needed) break;
    if (allTaken.some((o) => dist3(c, o) < 0.6)) continue;
    chosen.push(c);
    allTaken.push(c);
  }
  return chosen;
}

/** Tìm một điểm an toàn sát cạnh bệ nhảy để đặt ấn ký mở khóa mà không làm vướng điểm đáp. */
function findGateSpot(surface: RoadSurface, pad: Vec3, island: number): Vec3 {
  const hit = surface.sampleNearest(pad.x, pad.z, pad.y);
  if (hit && hit.island === island) return { x: pad.x, y: hit.y, z: pad.z };
  const near = surface.nearestVertex(pad, (i) => i === island);
  return near ? near.pos : pad;
}

export interface BuildQhmjLayoutInput {
  zoneId: number;
  center: { x: number; z: number };
  surface: RoadSurface;
  links: JumpLink[];
  anchors: QhmjAnchors;
  problems: RemoteProblem[];
}

/**
 * Phân bổ bộ câu hỏi động (từ Google Sheets hoặc fallback) lên 3 tầng cao độ của `RoadSurface`.
 * Bảo đảm không gây soft-lock và không để câu hỏi lơ lửng ngoài mặt đường.
 */
export function buildQhmjNodeLayout(input: BuildQhmjLayoutInput): QhmjNodeSpec[] {
  const { zoneId, center, surface, links, anchors, problems } = input;
  if (problems.length === 0) return [];

  const startHit = surface.sampleNearest(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y);
  const startIsland = startHit?.island ?? 4;

  // Tách các câu đã ghim tọa độ cứng trên Sheets và các câu để trống (tự phân bổ)
  const pinnedEntries: { rawIndex: number; problem: RemoteProblem }[] = [];
  const autoProblems: RemoteProblem[] = [];
  problems.forEach((p, idx) => {
    if (p.position && Number.isFinite(p.position.x) && Number.isFinite(p.position.z)) {
      pinnedEntries.push({ rawIndex: idx, problem: p });
    } else {
      autoProblems.push(p);
    }
  });

  // Nếu có câu nhiều bước (>= 2 steps), ưu tiên đưa câu nhiều bước cuối cùng lên đỉnh Island 0
  if (autoProblems.length >= 2) {
    let lastMultiIdx = -1;
    for (let i = autoProblems.length - 1; i >= 0; i--) {
      if ((autoProblems[i].steps?.length ?? 0) >= 2) {
        lastMultiIdx = i;
        break;
      }
    }
    if (lastMultiIdx !== -1 && lastMultiIdx !== autoProblems.length - 1) {
      const [multi] = autoProblems.splice(lastMultiIdx, 1);
      autoProblems.push(multi);
    }
  }

  const occupied: Vec3[] = [];
  const specs: QhmjNodeSpec[] = [];
  let nextIdx = 0;

  // 1. Neo các câu có sẵn tọa độ PosX/PosZ (tùy chọn PosY) lên mặt đường gần nhất
  for (const { problem } of pinnedEntries) {
    const px = problem.position!.x;
    const pz = problem.position!.z;
    const refY = problem.position!.y ?? anchors.spawn.y;
    const hit = surface.sampleNearest(px, pz, refY);
    let pos: Vec3 = hit ? { x: px, y: hit.y, z: pz } : { ...anchors.spawn };
    let island = hit?.island ?? startIsland;
    if (!surface.hasClearance(pos.x, pos.z, pos.y, 0.7, 1.0, 1.0)) {
      const near = surface.nearestVertex(pos);
      if (near) {
        pos = near.pos;
        island = near.island;
      }
    }
    occupied.push(pos);
    specs.push({
      index: nextIdx++,
      id: problem.id,
      progressKey: qhmjProgressKey(zoneId, problem.id),
      kind: island === 0 ? 'clock_summit' : 'path_crystal',
      tier: island === 4 || island === 2 ? 1 : island === 1 ? 2 : 3,
      position: pos,
      island,
      lockedLinkIds: [],
      problem
    });
  }

  if (autoProblems.length === 0) return specs;

  const alloc = splitQhmjProblemsByTier(autoProblems.length);
  const t1Problems = autoProblems.slice(0, alloc.tier1);
  const t2Problems = autoProblems.slice(alloc.tier1, alloc.tier1 + alloc.tier2);
  const t3Problems = autoProblems.slice(alloc.tier1 + alloc.tier2);

  // Tập ứng viên sẵn có cho từng cụm (lấy theo thứ tự đường)
  const candI4 = collectIslandCandidates(surface, 4, center, anchors, links);
  const candI2 = collectIslandCandidates(surface, 2, center, anchors, links);
  const candI1 = collectIslandCandidates(surface, 1, center, anchors, links, ISLAND1_LANDMARK_LOCALS);
  const candI3 = collectIslandCandidates(surface, 3, center, anchors, links, ISLAND3_LANDMARK_LOCALS);
  const candI0 = collectIslandCandidates(surface, 0, center, anchors, links);

  // 2. Tầng 1: Jump-Gate ở Island 4 + phần tràn sang Island 4 đường / Island 2
  // Quy tắc chống soft-lock:
  // - Không bao giờ khóa bệ synthetic hoặc bệ đi về/hạ tầng.
  // - Nếu Tầng 1 có > 4 câu (tràn sang Island 2), bệ đi Island 2 (toIsland=2) LUÔN mở sẵn!
  const forwardLinksByDest = new Map<number, JumpLink[]>();
  for (const l of links) {
    if (l.synthetic || l.fromIsland !== startIsland || l.toIsland === startIsland) continue;
    const arr = forwardLinksByDest.get(l.toIsland) ?? [];
    arr.push(l);
    forwardLinksByDest.set(l.toIsland, arr);
  }

  const preferredGateOrder = t1Problems.length > 4 ? [1, 3, 0] : [1, 2, 3, 0];
  const gateDestinations = preferredGateOrder.filter((dest) => forwardLinksByDest.has(dest));
  const gateCount = Math.min(t1Problems.length, gateDestinations.length);

  for (let i = 0; i < gateCount; i++) {
    const dest = gateDestinations[i];
    const groupLinks = forwardLinksByDest.get(dest)!;
    const primary = groupLinks[0];
    const gatePos = findGateSpot(surface, primary.pad, startIsland);
    occupied.push(gatePos);
    specs.push({
      index: nextIdx++,
      id: t1Problems[i].id,
      progressKey: qhmjProgressKey(zoneId, t1Problems[i].id),
      kind: 'jump_gate',
      tier: 1,
      position: gatePos,
      island: startIsland,
      lockedLinkIds: groupLinks.map((l) => l.id),
      problem: t1Problems[i]
    });
  }

  const t1Rest = t1Problems.slice(gateCount);
  if (t1Rest.length > 0) {
    const i4Spots = pickSpacedSpots(candI4, Math.min(2, t1Rest.length), occupied);
    const i2Need = t1Rest.length - i4Spots.length;
    const i2Spots = pickSpacedSpots(candI2, i2Need, [...occupied, ...i4Spots]);
    const t1Spots: { pos: Vec3; island: number }[] = [
      ...i4Spots.map((pos) => ({ pos, island: 4 })),
      ...i2Spots.map((pos) => ({ pos, island: 2 }))
    ];
    // Nếu còn dư ngoài sức chứa Island 4 + 2 (N rất lớn), đẩy phần dư sang Island 1
    const extraNeed = t1Rest.length - t1Spots.length;
    if (extraNeed > 0) {
      const extra = pickSpacedSpots(candI1, extraNeed, [...occupied, ...t1Spots.map((s) => s.pos)]);
      extra.forEach((pos) => t1Spots.push({ pos, island: 1 }));
    }
    t1Rest.forEach((prob, i) => {
      const slot = t1Spots[i] ?? { pos: anchors.spawn, island: startIsland };
      occupied.push(slot.pos);
      specs.push({
        index: nextIdx++,
        id: prob.id,
        progressKey: qhmjProgressKey(zoneId, prob.id),
        kind: 'path_crystal',
        tier: 1,
        position: slot.pos,
        island: slot.island,
        lockedLinkIds: [],
        problem: prob
      });
    });
  }

  // 3. Tầng 2: Trục đường chính Island 1 (fallback Island 2 nếu N cực lớn)
  if (t2Problems.length > 0) {
    const i1Spots = pickSpacedSpots(candI1, t2Problems.length, occupied);
    const t2Slots: { pos: Vec3; island: number }[] = i1Spots.map((pos) => ({ pos, island: 1 }));
    if (t2Slots.length < t2Problems.length) {
      const extra = pickSpacedSpots(candI2, t2Problems.length - t2Slots.length, [...occupied, ...t2Slots.map((s) => s.pos)]);
      extra.forEach((pos) => t2Slots.push({ pos, island: 2 }));
    }
    t2Problems.forEach((prob, i) => {
      const slot = t2Slots[i] ?? { pos: anchors.spawn, island: startIsland };
      occupied.push(slot.pos);
      specs.push({
        index: nextIdx++,
        id: prob.id,
        progressKey: qhmjProgressKey(zoneId, prob.id),
        kind: 'path_crystal',
        tier: 2,
        position: slot.pos,
        island: slot.island,
        lockedLinkIds: [],
        problem: prob
      });
    });
  }

  // 4. Tầng 3: Quảng trường Island 3 + Đỉnh Island 0 (câu cuối luôn ở đỉnh Island 0)
  if (t3Problems.length > 0) {
    const summitCount = t3Problems.length >= 4 ? Math.min(3, Math.ceil(t3Problems.length / 3)) : 1;
    const plazaCount = t3Problems.length - summitCount;
    const i3Spots = pickSpacedSpots(candI3, plazaCount, occupied);
    const i0Spots = pickSpacedSpots(candI0, t3Problems.length - i3Spots.length, [...occupied, ...i3Spots]);
    const t3Slots: { pos: Vec3; island: number }[] = [
      ...i3Spots.map((pos) => ({ pos, island: 3 })),
      ...i0Spots.map((pos) => ({ pos, island: 0 }))
    ];
    t3Problems.forEach((prob, i) => {
      const isFinal = i === t3Problems.length - 1;
      const slot = t3Slots[i] ?? { pos: candI0[0] ?? anchors.spawn, island: 0 };
      occupied.push(slot.pos);
      specs.push({
        index: nextIdx++,
        id: prob.id,
        progressKey: qhmjProgressKey(zoneId, prob.id),
        kind: isFinal ? 'clock_summit' : 'path_crystal',
        tier: 3,
        position: slot.pos,
        island: slot.island,
        lockedLinkIds: [],
        problem: prob
      });
    });
  }

  return specs;
}
