import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadSurface } from '../src/world/qhmj/RoadSurface';
import { buildJumpLinks, evalJumpArc } from '../src/world/qhmj/JumpLinks';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { zoneCountsForBadges, classifyZoneTemplate } from '../src/boot/WorldSession';
import { sanitizeRemoteZones } from '../src/core/sheetsClient';
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

test('Zone QHMJ_SANCTUARY: nhận diện template và Pha 1 chưa tính vào tổng huy hiệu', () => {
  const zones = sanitizeRemoteZones([
    { id: 8, name: 'QHMJ', template: 'qhmj_sanctuary', sheetName: 'QHMJ_Map', center: { x: -400, z: -400 } }
  ]);
  assert.equal(zones[0].template, 'QHMJ_SANCTUARY');
  assert.equal(classifyZoneTemplate(zones[0]), 'qhmj');
  assert.equal(zoneCountsForBadges(zones[0]), false);
});
