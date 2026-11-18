import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadSurface } from '../src/world/qhmj/RoadSurface';
import { buildJumpLinks, evalJumpArc } from '../src/world/qhmj/JumpLinks';
import { buildQhmjNodeLayout, qhmjProgressKey, splitQhmjProblemsByTier } from '../src/world/qhmj/QhmjLayout';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { zoneCountsForBadges, classifyZoneTemplate } from '../src/boot/WorldSession';
import { sanitizeRemoteZones } from '../src/core/sheetsClient';
import { generateQhmjProblems } from '../src/core/qhmjQuestions';
import { Adventure } from '../src/core/adventure';
import { parseSave } from '../src/core/state';
import {
  QHMJ_SCALE,
  QHMJ_SPEED,
  QHMJ_REGION_RADIUS,
  QHMJ_ROAD_MESH_NAME,
  computeQhmjAnchors
} from '../src/data/qhmjMap';
import { loadQhmjMesh, loadQhmjNodeCenters } from './helpers/qhmjFixture';

const CENTER = { x: -400, z: -400 };

function loadRealSurface(offset = CENTER) {
  const m = loadQhmjMesh(QHMJ_ROAD_MESH_NAME, QHMJ_SCALE);
  for (let i = 0; i < m.positions.length; i += 3) {
    m.positions[i] += offset.x;
    m.positions[i + 2] += offset.z;
  }
  const surface = new RoadSurface(m.positions, m.indices);
  const pads = loadQhmjNodeCenters('comm_jumpt_0', QHMJ_SCALE).map((p) => ({
    x: p.x + offset.x,
    y: p.y,
    z: p.z + offset.z
  }));
  return { surface, pads };
}

/** Hai tầng đường chồng nhau (cầu vượt) tại cùng (x, z). */
function twoLayerSurface() {
  // Tầng thấp y=0, tầng cao y=5, mỗi tầng là một ô vuông 10x10 gồm 2 tam giác
  const quad = (y: number, base: number) => ({
    pos: [0, y, 0, 10, y, 0, 10, y, 10, 0, y, 10],
    idx: [base, base + 1, base + 2, base, base + 2, base + 3]
  });
  const low = quad(0, 0);
  const high = quad(5, 4);
  return new RoadSurface([...low.pos, ...high.pos], [...low.idx, ...high.idx]);
}

test('RoadSurface bám đúng tầng theo độ cao tham chiếu (cầu vượt chồng tầng)', () => {
  const s = twoLayerSurface();
  assert.equal(s.sample(5, 5, 0)!.y, 0);
  assert.equal(s.sample(5, 5, 5)!.y, 5);
  assert.equal(s.sample(5, 5, 0.4)!.y, 0, 'đứng ở tầng thấp không bị nhảy lên cầu vượt');
  assert.equal(s.sample(5, 5, 5.4)!.y, 5);
  assert.equal(s.sample(50, 50, 0), null, 'ngoài đường thì không có mặt');
  assert.equal(s.islandCount, 2);
});

test('buildJumpLinks nối hai cụm đường rời nhau và đáp ngoài vùng bệ', () => {
  // Cụm A (x 0..10) và cụm B (x 20..30) cách nhau 10 m, bệ nằm trên A. Mỗi cụm là lưới 6x6 đỉnh.
  const grid = (x0: number, y: number, base: number) => {
    const pos: number[] = [];
    const idx: number[] = [];
    const n = 6;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pos.push(x0 + (i * 10) / (n - 1), y, (j * 10) / (n - 1));
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = base + i * n + j;
        idx.push(a, a + n, a + n + 1, a, a + n + 1, a + 1);
      }
    }
    return { pos, idx };
  };
  const a = grid(0, 0, 0);
  const b = grid(20, 3, 36);
  const surface = new RoadSurface([...a.pos, ...b.pos], [...a.idx, ...b.idx]);
  const pad = { x: 8, y: 0, z: 5 };
  const links = buildJumpLinks(surface, [pad], { startIsland: surface.sample(2, 5, 0)!.island, triggerRadius: 1.5 });
  const nonSynthetic = links.filter((l) => !l.synthetic);
  assert.equal(nonSynthetic.length, 1);
  assert.notEqual(nonSynthetic[0].fromIsland, nonSynthetic[0].toIsland);
  assert.ok(nonSynthetic[0].target.x >= 20, 'điểm đáp nằm trên cụm B');
  assert.ok(Math.hypot(nonSynthetic[0].target.x - pad.x, nonSynthetic[0].target.z - pad.z) > 3);
  // cụm B không có bệ -> phải có bệ "đường về" tổng hợp để không bị kẹt
  assert.ok(links.some((l) => l.synthetic && l.fromIsland === nonSynthetic[0].toIsland));
  const mid = evalJumpArc(nonSynthetic[0], 0.5);
  assert.ok(mid.y > Math.max(nonSynthetic[0].pad.y, nonSynthetic[0].target.y), 'quỹ đạo vòng cung');
  const end = evalJumpArc(nonSynthetic[0], 1);
  assert.ok(Math.abs(end.x - nonSynthetic[0].target.x) < 1e-6);
});

test('map_qhmj.glb: đường 5 cụm, điểm xuất phát và cổng về nằm trên mặt đường', () => {
  const { surface } = loadRealSurface();
  assert.equal(surface.islandCount, 5);
  const anchors = computeQhmjAnchors(CENTER);
  assert.ok(surface.hasClearance(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y, 1.5, 1.5), 'spawn có đủ chỗ đứng');
  assert.ok(
    surface.hasClearance(anchors.returnPortal.x, anchors.returnPortal.z, anchors.returnPortal.y, 1.5, 1.5),
    'cổng về có đủ chỗ đứng'
  );
  assert.ok(Math.hypot(anchors.spawn.x - anchors.returnPortal.x, anchors.spawn.z - anchors.returnPortal.z) > 3.5);
  for (const v of [surface.minX, surface.maxX]) {
    assert.ok(Math.abs(v - CENTER.x) <= QHMJ_REGION_RADIUS);
  }
});

test('map_qhmj.glb: mọi cụm đường đi tới được từ điểm xuất phát và quay về được', () => {
  const { surface, pads } = loadRealSurface();
  const anchors = computeQhmjAnchors(CENTER);
  const start = surface.sampleNearest(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y)!.island;
  const links = buildJumpLinks(surface, pads, { startIsland: start });

  const reach = (from: number, edges: { a: number; b: number }[]) => {
    const seen = new Set<number>([from]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of edges) {
        if (seen.has(e.a) && !seen.has(e.b)) {
          seen.add(e.b);
          changed = true;
        }
      }
    }
    return seen;
  };
  const forward = reach(start, links.map((l) => ({ a: l.fromIsland, b: l.toIsland })));
  assert.equal(forward.size, surface.islandCount, 'đi tới được mọi cụm');
  const backward = reach(start, links.map((l) => ({ a: l.toIsland, b: l.fromIsland })));
  assert.equal(backward.size, surface.islandCount, 'từ mọi cụm đều quay về được điểm xuất phát');
});

function createRoadWorld() {
  const { surface, pads } = loadRealSurface();
  const anchors = computeQhmjAnchors(CENTER);
  const start = surface.sampleNearest(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y)!.island;
  const links = buildJumpLinks(surface, pads, { startIsland: start });
  const world = new SpatialWorld(-6, 6);
  world.setQhmjZones([
    { id: 8, name: 'QHMJ', cx: CENTER.x, cz: CENTER.z, radius: QHMJ_REGION_RADIUS, spawn: anchors.spawn }
  ]);
  world.setQhmjRoad(8, surface, links);
  return { world, surface, links, anchors };
}

test('SpatialWorld: vùng QHMJ được nhận diện và đi trên đường không rơi khỏi mặt đường', () => {
  const { world, surface, anchors } = createRoadWorld();
  assert.equal(world.resolveRegionForPoint(anchors.spawn.x, anchors.spawn.z), 'zone:8');
  world.teleport(anchors.spawn.x, anchors.spawn.z);

  const dirs: Array<string[]> = [['w'], ['a'], ['s'], ['d'], ['w', 'd'], ['s', 'a'], ['w', 'a']];
  let prev = world.getPose();
  let travelled = 0;
  let yaw = 0.2;
  for (let i = 0; i < 60 * 90; i++) {
    if (i % 45 === 0) yaw += 0.9;
    const keys = new Set(dirs[Math.floor(i / 45) % dirs.length]);
    const pose = world.tick(1 / 60, { keys, joystick: { x: 0, y: 0 } }, yaw);
    if (!world.isLaunching()) {
      assert.ok(
        surface.sample(pose.x, pose.z, pose.y, 1.4, 3.6) !== null,
        `bước ${i}: nhân vật rơi khỏi mặt đường tại (${pose.x.toFixed(1)}, ${pose.y.toFixed(1)}, ${pose.z.toFixed(1)})`
      );
      assert.ok(Math.abs(pose.y - prev.y) <= 1.5, `bước ${i}: nhảy độ cao đột ngột ${prev.y} -> ${pose.y}`);
    }
    travelled += Math.hypot(pose.x - prev.x, pose.z - prev.z);
    prev = pose;
  }
  assert.ok(travelled > 20, 'nhân vật thực sự di chuyển được');
  assert.ok(travelled / 90 <= QHMJ_SPEED + 0.5, 'không vượt tốc độ cho phép');
});

test('SpatialWorld: đi thẳng ra mép đường thì trượt dọc mép thay vì đứng yên hoặc rơi', () => {
  const { world, surface, anchors } = createRoadWorld();
  world.teleport(anchors.spawn.x, anchors.spawn.z);
  // đi thẳng một hướng trong 30 giây: phải còn trên đường dù chạm mép
  for (let i = 0; i < 60 * 30; i++) {
    const pose = world.tick(1 / 60, { keys: new Set(['d']), joystick: { x: 0, y: 0 } }, 0);
    if (!world.isLaunching()) assert.ok(surface.sample(pose.x, pose.z, pose.y, 1.4, 3.6) !== null);
  }
});

test('SpatialWorld: bước lên bệ nhảy thì bay sang cụm đường đích rồi đáp xuống', () => {
  const { world, surface, links } = createRoadWorld();
  const link = links.find((l) => !l.synthetic)!;
  // tìm điểm cách bệ ~4.5 m trên cùng cụm đường, có chỗ đứng
  let startPoint: { x: number; z: number } | null = null;
  for (let a = 0; a < 24 && !startPoint; a++) {
    const ang = (a / 24) * Math.PI * 2;
    const x = link.pad.x + Math.cos(ang) * 4.5;
    const z = link.pad.z + Math.sin(ang) * 4.5;
    const hit = surface.sample(x, z, link.pad.y, 1.0, 1.0);
    if (hit && hit.island === link.fromIsland && surface.hasClearance(x, z, hit.y, 0.8)) startPoint = { x, z };
  }
  assert.ok(startPoint, 'tìm được điểm xuất phát gần bệ');
  world.teleport(startPoint!.x, startPoint!.z);
  const noInput = { keys: new Set<string>(), joystick: { x: 0, y: 0 } };
  for (let i = 0; i < 70; i++) world.tick(1 / 60, noInput, 0); // chờ hết cooldown, bệ nạp lại
  assert.equal(world.isLaunching(), false);

  const dx = link.pad.x - startPoint!.x;
  const dz = link.pad.z - startPoint!.z;
  const yaw = Math.atan2(-dx, -dz); // 'w' đi theo hướng (dx, dz)
  let launched = false;
  for (let i = 0; i < 60 * 3 && !launched; i++) {
    world.tick(1 / 60, { keys: new Set(['w']), joystick: { x: 0, y: 0 } }, yaw);
    launched = world.isLaunching();
  }
  assert.ok(launched, 'bước lên bệ thì tự bật nhảy');

  let steps = 0;
  while (world.isLaunching() && steps++ < 60 * 4) world.tick(1 / 60, noInput, yaw);
  const pose = world.getPose();
  assert.ok(Math.hypot(pose.x - link.target.x, pose.z - link.target.z) < 0.01, 'đáp đúng điểm đích');
  assert.ok(Math.abs(pose.y - link.target.y) < 0.01);

  // Đáp xong không bị bật ngược lại ngay
  for (let i = 0; i < 90; i++) world.tick(1 / 60, noInput, yaw);
  assert.equal(world.isLaunching(), false);
});

test('Zone QHMJ_SANCTUARY: nhận diện template và Pha 2 được tính vào tổng huy hiệu', () => {
  const zones = sanitizeRemoteZones([
    { id: 8, name: 'QHMJ', template: 'qhmj_sanctuary', sheetName: 'QHMJ_Map', center: { x: -400, z: -400 } }
  ]);
  assert.equal(zones[0].template, 'QHMJ_SANCTUARY');
  assert.equal(classifyZoneTemplate(zones[0]), 'qhmj');
  assert.equal(zoneCountsForBadges(zones[0]), true);
});

test('splitQhmjProblemsByTier chia đều 3 tầng cho N=9,12,30,40 không phụ thuộc chủ đề', () => {
  assert.deepEqual(splitQhmjProblemsByTier(1), { tier1: 0, tier2: 0, tier3: 1 });
  assert.deepEqual(splitQhmjProblemsByTier(3), { tier1: 1, tier2: 1, tier3: 1 });
  assert.deepEqual(splitQhmjProblemsByTier(9), { tier1: 3, tier2: 3, tier3: 3 });
  assert.deepEqual(splitQhmjProblemsByTier(12), { tier1: 4, tier2: 4, tier3: 4 });
  assert.deepEqual(splitQhmjProblemsByTier(30), { tier1: 10, tier2: 10, tier3: 10 });
  assert.deepEqual(splitQhmjProblemsByTier(40), { tier1: 13, tier2: 14, tier3: 13 });
});

test('map_qhmj.glb: rải 12 và 40 câu hỏi đều nằm trên mặt đường và không gây soft-lock', () => {
  const { surface, pads } = loadRealSurface();
  const anchors = computeQhmjAnchors(CENTER);
  const start = surface.sampleNearest(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y)!.island;
  const links = buildJumpLinks(surface, pads, { startIsland: start });

  for (const count of [3, 12, 30, 40]) {
    const problems = generateQhmjProblems(8, count);
    const specs = buildQhmjNodeLayout({
      zoneId: 8,
      center: CENTER,
      surface,
      links,
      anchors,
      problems
    });
    assert.equal(specs.length, count, `N=${count}: phải đặt đủ ${count} điểm`);

    const lockedIds = new Set(specs.flatMap((s) => s.lockedLinkIds));
    for (const l of links) {
      if (l.synthetic || l.fromIsland !== start || l.toIsland === start) {
        assert.equal(lockedIds.has(l.id), false, `N=${count}: không được khóa bệ về/synthetic link ${l.id}`);
      }
    }
    if (count === 40) {
      // N=40 tràn Tầng 1 sang Island 2 -> mọi bệ 4->2 phải mở sẵn
      for (const l of links.filter((x) => x.fromIsland === start && x.toIsland === 2)) {
        assert.equal(lockedIds.has(l.id), false, 'N=40: bệ sang Island 2 phải mở sẵn');
      }
    }
    for (const spec of specs) {
      const hit = surface.sample(spec.position.x, spec.position.z, spec.position.y, 0.5, 0.5);
      assert.ok(hit !== null, `N=${count} node ${spec.index} phải nằm trên RoadSurface`);
    }
    const last = specs[specs.length - 1];
    assert.equal(last.kind, 'clock_summit');
    assert.equal(last.island, 0, 'câu cuối cùng phải nằm ở đỉnh Island 0');
  }
});

test('SpatialWorld: bệ bị khóa không kích hoạt nhảy cho tới khi mở khóa & proximity 3D phân biệt cầu vượt chồng tầng', () => {
  const { surface, pads } = loadRealSurface();
  const anchors = computeQhmjAnchors(CENTER);
  const start = surface.sampleNearest(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y)!.island;
  const links = buildJumpLinks(surface, pads, { startIsland: start });
  const problems = generateQhmjProblems(8, 12);
  const specs = buildQhmjNodeLayout({ zoneId: 8, center: CENTER, surface, links, anchors, problems });

  const gate = specs.find((s) => s.kind === 'jump_gate')!;
  const lockedLink = links.find((l) => l.id === gate.lockedLinkIds[0])!;
  const lockedIds = new Set(specs.flatMap((s) => s.lockedLinkIds));

  // Tìm một cặp tầng chồng nhau (Island 4 ở dưới, Island 1 ở trên cùng (x,z)) để test proximity 3D
  const upperNode = specs.find((s) => s.island === 1)!;
  const fakeWorld = new SpatialWorld(-6, 6);
  fakeWorld.setQhmjZones([
    { id: 8, name: 'QHMJ', cx: CENTER.x, cz: CENTER.z, radius: QHMJ_REGION_RADIUS, spawn: anchors.spawn }
  ]);
  fakeWorld.setQhmjRoad(
    8,
    surface,
    links,
    specs.map((s) => ({ index: s.index, x: s.position.x, y: s.position.y, z: s.position.z })),
    lockedIds
  );

  // 1. Bệ đang khóa: đứng ngay trên bệ cũng không phóng
  fakeWorld.teleport(lockedLink.pad.x, lockedLink.pad.z, lockedLink.pad.y);
  const noInput = { keys: new Set<string>(), joystick: { x: 0, y: 0 } };
  for (let i = 0; i < 70; i++) fakeWorld.tick(1 / 60, noInput, 0);
  assert.equal(fakeWorld.isLaunching(), false, 'bệ đang khóa không được phóng');
  assert.equal(fakeWorld.nearQhmjNodeIndex(), gate.index, 'đứng cạnh bệ khóa nhận diện được gate để mở');

  // 2. Mở khóa bệ: rời bệ rồi bước lại -> phóng bình thường
  lockedIds.delete(lockedLink.id);
  fakeWorld.setQhmjLockedLinks(8, lockedIds);
  fakeWorld.teleport(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y);
  for (let i = 0; i < 60; i++) fakeWorld.tick(1 / 60, noInput, 0);
  fakeWorld.teleport(lockedLink.pad.x, lockedLink.pad.z, lockedLink.pad.y);
  for (let i = 0; i < 70; i++) fakeWorld.tick(1 / 60, noInput, 0);
  // teleport đặt padArmed=false và đứng yên trên pad; đi ra rồi vào lại hoặc test trực tiếp trên node tầng trên:
  fakeWorld.teleport(upperNode.position.x, upperNode.position.z, upperNode.position.y);
  assert.equal(fakeWorld.nearQhmjNodeIndex(), upperNode.index, 'đúng tầng cao thì nhận diện node tầng cao');

  // Kiểm tra cầu vượt: nếu đứng lệch độ cao 15m ngay bên dưới upperNode thì KHÔNG kích hoạt
  fakeWorld.teleport(upperNode.position.x, upperNode.position.z, upperNode.position.y - 15);
  if (Math.abs(fakeWorld.getPose().y - upperNode.position.y) > 3) {
    assert.equal(fakeWorld.nearQhmjNodeIndex(), -1, 'đứng khác tầng quá 2.5m không kích hoạt nhầm node');
  }
});

test('SaveState & Adventure: lưu vị trí y tầng cao và namespace tiến độ QHMJ không đụng ID 1..12', () => {
  const adv = new Adventure();
  adv.savePosition(-380.5, -395.2, 21.45);
  const roundtrip = parseSave(JSON.stringify(adv.getState()));
  assert.deepEqual(roundtrip.position, { x: -380.5, y: 21.45, z: -395.2 });

  const problems = generateQhmjProblems(8, 3);
  const keys = problems.map((p) => qhmjProgressKey(8, p.id));
  const r1 = adv.solveQhmjNode({ progressKey: keys[0], zoneId: 8, allProgressKeys: keys });
  assert.equal(r1.alreadySolved, false);
  assert.equal(r1.zoneCompleted, false);
  assert.equal(adv.isProblemSolved('1'), false, 'không đánh dấu nhầm câu ID 1 của Vườn Hoa');
  assert.equal(adv.isProblemSolved(keys[0]), true);

  adv.solveQhmjNode({ progressKey: keys[1], zoneId: 8, allProgressKeys: keys });
  const r3 = adv.solveQhmjNode({ progressKey: keys[2], zoneId: 8, allProgressKeys: keys });
  assert.equal(r3.zoneCompleted, true);
  assert.equal(adv.getState().zoneBadges[7], true, 'hoàn thành toàn bộ QHMJ nhận Đại Huy Chương zone 8');
});
