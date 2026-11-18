import { RoadSurface, type Vec3 } from './RoadSurface';

/** Một bệ bật nhảy nối cụm đường này sang cụm đường khác. */
export interface JumpLink {
  id: number;
  /** Vị trí bệ (điểm đứng trên mặt đường). */
  pad: Vec3;
  /** Điểm đáp trên cụm đường đích. */
  target: Vec3;
  triggerRadius: number;
  /** Thời gian bay (giây). */
  duration: number;
  /** Độ cao đỉnh quỹ đạo vượt trên đường nối thẳng (mét). */
  peak: number;
  fromIsland: number;
  toIsland: number;
  /** Bệ "đường về" được thêm tự động (không có model bệ thật trong GLB). */
  synthetic?: boolean;
}

export interface BuildJumpLinksOptions {
  triggerRadius?: number;
  /** Tối đa khoảng cách tới điểm đáp (mét). */
  maxRange?: number;
  /** Bệ cách mặt đường quá xa sẽ bị bỏ qua (mét). */
  maxPadSnap?: number;
  /** Bán kính chỗ đứng tối thiểu quanh điểm đáp (mét). */
  landingClearance?: number;
  /** Cụm đường chứa điểm xuất phát: dùng để bảo đảm mọi cụm đều đi tới được. */
  startIsland?: number;
}

interface PadInfo {
  idx: number;
  stand: Vec3;
  fromIsland: number;
}

/**
 * Nối các bệ nhảy sang cụm đường khác:
 * 1. Mở rộng vùng đi tới được từ `startIsland`: lần lượt chọn cặp (bệ trên cụm đã tới được, cụm chưa tới được)
 *    gần nhau nhất, cho tới khi mọi cụm đều đi tới được (nếu có đủ bệ & trong tầm).
 * 2. Các bệ còn lại nối tới cụm khác gần nhất (làm đường quay lại).
 * Điểm đáp luôn đủ chỗ đứng và nằm ngoài vùng kích hoạt của mọi bệ (tránh bật ngược ngay khi đáp).
 */
export function buildJumpLinks(surface: RoadSurface, pads: Vec3[], options: BuildJumpLinksOptions = {}): JumpLink[] {
  const triggerRadius = options.triggerRadius ?? 2.4;
  const maxRange = options.maxRange ?? 80;
  const maxPadSnap = options.maxPadSnap ?? 8;
  const clearance = options.landingClearance ?? 1.0;

  const padList: Vec3[] = [...pads];
  const infos: PadInfo[] = [];
  pads.forEach((rawPad, idx) => {
    const near = surface.nearestVertex(rawPad);
    if (!near || near.dist > maxPadSnap) return;
    const ground = surface.sample(rawPad.x, rawPad.z, rawPad.y, 2.5, 2.5);
    infos.push({
      idx,
      stand: { x: rawPad.x, y: ground ? ground.y : near.pos.y, z: rawPad.z },
      fromIsland: ground ? ground.island : near.island
    });
  });

  const findLanding = (info: PadInfo, allowed: (island: number) => boolean) => {
    const candidates = surface.verticesByDistance(info.stand, (island) => island !== info.fromIsland && allowed(island));
    for (const v of candidates) {
      const dist = Math.hypot(v.x - info.stand.x, v.y - info.stand.y, v.z - info.stand.z);
      if (dist > maxRange) break;
      if (!surface.hasClearance(v.x, v.z, v.y, clearance)) continue;
      if (padList.some((p) => Math.hypot(v.x - p.x, v.z - p.z) < triggerRadius + 1.5)) continue;
      const hit = surface.sample(v.x, v.z, v.y, 0.5, 0.5);
      if (!hit) continue;
      const link: JumpLink = {
        id: info.idx,
        pad: info.stand,
        target: { x: v.x, y: hit.y, z: v.z },
        triggerRadius,
        duration: Math.min(1.8, Math.max(0.8, 0.6 + dist / 22)),
        peak: Math.max(3, dist * 0.25),
        fromIsland: info.fromIsland,
        toIsland: hit.island
      };
      return { link, dist };
    }
    return null;
  };

  const links: JumpLink[] = [];
  const used = new Set<number>();
  const reachable = new Set<number>();
  if (options.startIsland !== undefined) reachable.add(options.startIsland);

  if (options.startIsland !== undefined) {
    for (;;) {
      let best: { link: JumpLink; dist: number } | null = null;
      for (const info of infos) {
        if (used.has(info.idx) || !reachable.has(info.fromIsland)) continue;
        const found = findLanding(info, (island) => !reachable.has(island));
        if (found && (!best || found.dist < best.dist)) best = found;
      }
      if (!best) break;
      links.push(best.link);
      used.add(best.link.id);
      reachable.add(best.link.toIsland);
    }
  }

  for (const info of infos) {
    if (used.has(info.idx)) continue;
    const found = findLanding(info, () => true);
    if (found) {
      links.push(found.link);
      used.add(info.idx);
    }
  }

  // Phase 3: cụm nào không có đường quay về cụm xuất phát thì thêm bệ nhảy "đường về" tổng hợp,
  // để người chơi không bao giờ bị kẹt ở ngõ cụt.
  if (options.startIsland !== undefined) {
    const canReachStart = new Set<number>([options.startIsland]);
    const propagate = () => {
      let changed = true;
      while (changed) {
        changed = false;
        for (const l of links) {
          if (!canReachStart.has(l.fromIsland) && canReachStart.has(l.toIsland)) {
            canReachStart.add(l.fromIsland);
            changed = true;
          }
        }
      }
    };
    propagate();

    // Ràng buộc "ngoài vùng bệ" trong findLanding phải tính cả bệ tổng hợp.
    let nextId = pads.length;
    for (let guard = 0; guard < surface.islandCount; guard++) {
      const stuck = Array.from({ length: surface.islandCount }, (_, i) => i).filter((i) => !canReachStart.has(i));
      if (stuck.length === 0) break;

      let bestPad: { stand: Vec3; island: number; dist: number } | null = null;
      for (const island of stuck) {
        const avoid = [...padList, ...links.filter((l) => l.toIsland === island).map((l) => l.target)];
        for (const v of surface.verticesByDistance({ x: 0, y: 0, z: 0 }, (i) => i === island, 5000)) {
          if (avoid.some((p) => Math.hypot(v.x - p.x, v.z - p.z) < triggerRadius + 3)) continue;
          if (!surface.hasClearance(v.x, v.z, v.y, 2.0)) continue;
          const nv = surface.nearestVertex(v, (i) => canReachStart.has(i));
          if (!nv) continue;
          if (!bestPad || nv.dist < bestPad.dist) bestPad = { stand: v, island, dist: nv.dist };
        }
      }
      if (!bestPad) break;

      padList.push(bestPad.stand);
      const found = findLanding(
        { idx: nextId, stand: bestPad.stand, fromIsland: bestPad.island },
        (i) => canReachStart.has(i)
      );
      if (!found) break;
      links.push({ ...found.link, synthetic: true });
      nextId++;
      propagate();
      canReachStart.add(bestPad.island);
    }
  }

  return links.sort((a, b) => a.id - b.id);
}

/** Quỹ đạo parabol: nội suy tuyến tính (x, z, y) cộng vòm nâng `peak` * 4s(1-s). */
export function evalJumpArc(link: Pick<JumpLink, 'pad' | 'target' | 'peak'>, s: number): Vec3 {
  const t = Math.min(1, Math.max(0, s));
  return {
    x: link.pad.x + (link.target.x - link.pad.x) * t,
    z: link.pad.z + (link.target.z - link.pad.z) * t,
    y: link.pad.y + (link.target.y - link.pad.y) * t + link.peak * 4 * t * (1 - t)
  };
}

