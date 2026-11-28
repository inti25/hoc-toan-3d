import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';
import {
  FARM_FENCE_MATERIALS,
  FARM_GROUND_MATERIALS,
  FARM_RAW_OFFSET,
  FARM_SCALE,
  FARM_SOLID_OBSTACLE_MATERIALS,
  FARM_SPEED,
  computeFarmAnchors
} from '../src/data/farmMap';
import {
  FARM_RACE_BASE_SPEED,
  FARM_RACE_FIRST_TRY_BOOST_SPEED,
  FARM_RACE_RECOMMENDED_CENTER,
  FARM_RACE_REGION_RADIUS,
  FARM_RACE_RETURN_PORTAL_LOCAL,
  FARM_RACE_SPAWN_LOCAL,
  FARM_RACE_START_LOCAL,
  FARM_RACE_TRACK_WAYPOINTS,
  computeFarmRaceAnchors,
  farmRaceProgressKey
} from '../src/data/farmRaceMap';
import { buildFarmTerrainFromMeshTriangles } from '../src/world/farm/FarmTerrain';
import { FarmRaceEngine, FarmRaceTrack } from '../src/world/farm/FarmRaceLogic';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { sanitizeRemoteZones } from '../src/core/sheetsClient';
import { classifyZoneTemplate, zoneCountsForBadges, zoneSpawnsMonoliths } from '../src/boot/WorldSession';
import { Adventure } from '../src/core/adventure';
import { freshState } from '../src/core/state';
import { mergeStates } from '../src/core/SyncManager';

const FARM_GLTF_PATH = new URL('../public/3dmodel/maps/farm/scene.gltf', import.meta.url);
const FARM_BIN_PATH = new URL('../public/3dmodel/maps/farm/scene.bin', import.meta.url);

function loadRealFarmTerrain(center: { x: number; z: number } = FARM_RACE_RECOMMENDED_CENTER) {
  const gltf = JSON.parse(readFileSync(FARM_GLTF_PATH, 'utf8'));
  const bin = readFileSync(FARM_BIN_PATH);

  const readVec3 = (accIdx: number): Float32Array => {
    const acc = gltf.accessors[accIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const stride = bv.byteStride ?? 12;
    const out = new Float32Array(acc.count * 3);
    for (let i = 0; i < acc.count; i++) {
      const o = base + i * stride;
      out[i * 3] = bin.readFloatLE(o);
      out[i * 3 + 1] = bin.readFloatLE(o + 4);
      out[i * 3 + 2] = bin.readFloatLE(o + 8);
    }
    return out;
  };

  const readIdx = (accIdx: number): Uint32Array => {
    const acc = gltf.accessors[accIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const out = new Uint32Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
      out[i] = acc.componentType === 5123 ? bin.readUInt16LE(base + i * 2) : bin.readUInt32LE(base + i * 4);
    }
    return out;
  };

  const nodeMat = (n: any): Matrix4 => {
    const m = new Matrix4();
    if (n.matrix) return m.fromArray(n.matrix);
    return m.compose(
      new Vector3(...(n.translation ?? [0, 0, 0])),
      new Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
      new Vector3(...(n.scale ?? [1, 1, 1]))
    );
  };

  const groundPos: number[] = [];
  const groundIdx: number[] = [];
  const solidTris: number[] = [];
  const fenceTris: number[] = [];
  const v = new Vector3();

  const toWorld = (pt: Vector3) => {
    pt.x = center.x + (pt.x - FARM_RAW_OFFSET.x) * FARM_SCALE;
    pt.y = pt.y * FARM_SCALE;
    pt.z = center.z + (pt.z - FARM_RAW_OFFSET.z) * FARM_SCALE;
  };

  const walk = (ni: number, parentM: Matrix4) => {
    const n = gltf.nodes[ni];
    const m = parentM.clone().multiply(nodeMat(n));
    if (n.mesh !== undefined) {
      const mesh = gltf.meshes[n.mesh];
      for (const p of mesh.primitives) {
        const matName: string = gltf.materials[p.material]?.name ?? '';
        const isGround = FARM_GROUND_MATERIALS.has(matName);
        const isSolid = FARM_SOLID_OBSTACLE_MATERIALS.has(matName);
        const isFence = FARM_FENCE_MATERIALS.has(matName);
        if (!isGround && !isSolid && !isFence) continue;

        const verts = readVec3(p.attributes.POSITION);
        const idxs = p.indices !== undefined ? readIdx(p.indices) : Uint32Array.from({ length: verts.length / 3 }, (_, i) => i);

        if (isGround) {
          const baseV = groundPos.length / 3;
          for (let i = 0; i < verts.length; i += 3) {
            v.set(verts[i], verts[i + 1], verts[i + 2]).applyMatrix4(m);
            toWorld(v);
            groundPos.push(v.x, v.y, v.z);
          }
          for (let k = 0; k < idxs.length; k++) {
            groundIdx.push(baseV + idxs[k]);
          }
        } else {
          const out = isFence ? fenceTris : solidTris;
          for (let k = 0; k + 2 < idxs.length; k += 3) {
            for (const idx of [idxs[k], idxs[k + 1], idxs[k + 2]]) {
              v.set(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]).applyMatrix4(m);
              toWorld(v);
              out.push(v.x, v.y, v.z);
            }
          }
        }
      }
    }
    for (const c of n.children ?? []) walk(c, m);
  };

  walk(0, new Matrix4());

  return buildFarmTerrainFromMeshTriangles({
    positions: Float32Array.from(groundPos),
    indices: Uint32Array.from(groundIdx),
    solidTriangles: Float32Array.from(solidTris),
    fenceTriangles: Float32Array.from(fenceTris)
  });
}

test('FARM_RACE waypoints, start/spawn, and return portal sit on unobstructed real scene.gltf terrain', () => {
  const { surface, colliders } = loadRealFarmTerrain(FARM_RACE_RECOMMENDED_CENTER);

  const checkSpot = (label: string, lx: number, lz: number) => {
    const wx = FARM_RACE_RECOMMENDED_CENTER.x + lx;
    const wz = FARM_RACE_RECOMMENDED_CENTER.z + lz;
    const hit = surface.sampleNearest(wx, wz, 2.0);
    assert.ok(hit !== null, `${label} (${lx}, ${lz}) must sit on walkable terrain`);
    assert.equal(colliders.isBlockedForAnimal(wx, wz), false, `${label} (${lx}, ${lz}) must be unobstructed`);
  };

  checkSpot('FARM_RACE_START_LOCAL', FARM_RACE_START_LOCAL.x, FARM_RACE_START_LOCAL.z);
  checkSpot('FARM_RACE_SPAWN_LOCAL', FARM_RACE_SPAWN_LOCAL.x, FARM_RACE_SPAWN_LOCAL.z);
  checkSpot('FARM_RACE_RETURN_PORTAL_LOCAL', FARM_RACE_RETURN_PORTAL_LOCAL.x, FARM_RACE_RETURN_PORTAL_LOCAL.z);

  FARM_RACE_TRACK_WAYPOINTS.forEach((wp, idx) => {
    checkSpot(`TrackWaypoint#${idx}`, wp.x, wp.z);
  });
});

test('FarmRaceTrack computes loop arc-length, wrapping, and hairpin-safe windowed projection', () => {
  const track = new FarmRaceTrack();
  assert.ok(track.totalLength > 850 && track.totalLength < 950, `Unexpected track length ${track.totalLength}`);

  const s0 = track.sampleAtDistance(0);
  const sWrap = track.sampleAtDistance(track.totalLength);
  assert.ok(Math.hypot(s0.x - sWrap.x, s0.z - sWrap.z) < 0.05);

  // Sample halfway along track and verify windowed projection locks onto that distance instead of nearby hairpins
  const midDist = track.totalLength * 0.45;
  const midSample = track.sampleAtDistance(midDist, 1.5);
  const proj = track.projectLocalPoint(midSample.x, midSample.z, midDist - 4);
  assert.ok(Math.abs(proj.distance - midDist) < 3.0, `Expected near ${midDist}, got ${proj.distance}`);
  assert.ok(proj.lateralDist < 2.2);
});

test('FarmRaceEngine runs full lifecycle: countdown, checkpoint quiz pause, Nitro boost, dismiss cooldown, and finish podium', () => {
  const engine = new FarmRaceEngine(10, [
    {
      id: 'r1',
      title: 'Trạm 1',
      subtitle: '',
      steps: [{ stepId: 'r1_1', prompt: '2 x 3 = ?', options: [{ label: '6', value: '6' }], answer: '6', hints: [], explanation: '' }]
    },
    {
      id: 'r2',
      title: 'Trạm 2',
      subtitle: '',
      steps: [{ stepId: 'r2_1', prompt: '4 x 5 = ?', options: [{ label: '20', value: '20' }], answer: '20', hints: [], explanation: '' }]
    }
  ]);

  assert.equal(engine.phase, 'LOBBY');
  assert.equal(engine.checkpoints.length, 2);
  assert.equal(engine.racers.length, 5);

  engine.selectAnimal('pig');
  engine.startCountdown();
  assert.equal(engine.phase, 'COUNTDOWN');
  assert.equal(engine.getPlayerRacer().kind, 'pig');
  assert.equal(engine.getCountdownNumber(), 3);

  // Tick through 2.4s countdown -> RACING
  for (let i = 0; i < 30; i++) {
    engine.update(0.1, { x: FARM_RACE_SPAWN_LOCAL.x, z: FARM_RACE_SPAWN_LOCAL.z });
  }
  assert.equal(engine.phase, 'RACING');

  // Move player onto checkpoint 0 -> triggers PAUSED_QUIZ
  const cp0 = engine.checkpoints[0];
  engine.playerDistance = cp0.distance - 2;
  const trigRes = engine.update(0.05, { x: cp0.x, z: cp0.z });
  assert.equal(trigRes.triggeredCheckpointIndex, 0);
  assert.equal(engine.phase, 'PAUSED_QUIZ');

  // While paused, AI racers and timer must freeze
  const aiDistBefore = engine.getAiRacers()[0].distance;
  const elapsedBefore = engine.elapsedMs;
  engine.update(0.5, { x: cp0.x, z: cp0.z });
  assert.equal(engine.getAiRacers()[0].distance, aiDistBefore);
  assert.equal(engine.elapsedMs, elapsedBefore);

  // Dismissing applies cooldown so standing in gate does not immediately re-open
  engine.resumeAfterQuiz(false, false, 0);
  assert.equal(engine.phase, 'RACING');
  const afterDismiss = engine.update(0.05, { x: cp0.x, z: cp0.z });
  assert.equal(afterDismiss.triggeredCheckpointIndex, null);

  // Solving checkpoint 1 on first try activates Nitro boost, but checkpoint 0 is still missing
  const cp1 = engine.checkpoints[1];
  engine.rawTrackDistance = cp1.distance - 2;
  const trig1 = engine.update(0.05, { x: cp1.x, z: cp1.z });
  assert.equal(trig1.triggeredCheckpointIndex, 1);
  engine.resumeAfterQuiz(true, true, 1);
  assert.equal(engine.phase, 'RACING');
  const boosted = engine.update(0.1, { x: cp1.x, z: cp1.z });
  assert.equal(boosted.boostActive, true);
  assert.ok(
    Math.abs(boosted.speedMultiplier - FARM_RACE_FIRST_TRY_BOOST_SPEED / FARM_RACE_BASE_SPEED) < 1e-6
  );
  assert.equal(engine.skippedCheckpointAhead, true);
  assert.equal(engine.playerDistance, cp0.distance, 'Effective distance must stay capped at earliest unsolved checkpoint');

  // Attempting to cross finish line while checkpoint 0 is unsolved MUST NOT finish!
  const nearFinish = engine.track.sampleAtDistance(engine.track.totalLength - 3);
  engine.rawTrackDistance = engine.track.totalLength - 4;
  const blockedFin = engine.update(0.05, { x: nearFinish.x, z: nearFinish.z });
  assert.equal(engine.phase, 'RACING');
  assert.equal(blockedFin.finishedResult, null);
  assert.equal(blockedFin.finishBlockedTriggered, true);
  assert.equal(engine.finishBlocked, true);

  // Recovery point must send player back ~6m before missed checkpoint 0
  const rec = engine.getRecoveryPoint();
  const expectedBeforeCp0 = engine.track.sampleAtDistance(Math.max(0, cp0.distance - 6.0), 0);
  assert.ok(Math.hypot(rec.x - expectedBeforeCp0.x, rec.z - expectedBeforeCp0.z) < 0.1);

  // Cutting straight across meadow to finish without solving cp0 also does NOT unlock finish
  const shortcutFin = engine.update(0.05, { x: FARM_RACE_START_LOCAL.x, z: FARM_RACE_START_LOCAL.z });
  assert.equal(engine.phase, 'RACING');
  assert.equal(shortcutFin.finishedResult, null);

  // Now open & solve checkpoint 0 -> all checkpoints solved!
  assert.equal(engine.openCheckpointManual(0), true);
  assert.equal(engine.phase, 'PAUSED_QUIZ');
  engine.resumeAfterQuiz(true, true, 0);
  assert.equal(engine.areAllCheckpointsSolved(), true);

  // Off-track detection & recovery once all checkpoints solved
  engine.rawTrackDistance = cp1.distance;
  engine.update(0.05, { x: cp1.x, z: cp1.z });
  const offTick = engine.update(0.05, { x: cp1.x, z: cp1.z + 10.5 });
  assert.equal(offTick.finishedResult, null);
  assert.equal(engine.isOffTrack, true);

  // Crossing finish after solving ALL checkpoints and >= 82% progress -> FINISHED
  engine.rawTrackDistance = engine.track.totalLength - 4;
  engine.playerDistance = engine.track.totalLength - 4;
  engine.playerMaxProgress01 = 0.96;
  const finTick = engine.update(0.05, { x: nearFinish.x, z: nearFinish.z });
  assert.equal(engine.phase, 'FINISHED');
  assert.ok(finTick.finishedResult !== null);
  assert.ok(finTick.finishedResult!.rank >= 1 && finTick.finishedResult!.rank <= 5);
  assert.equal(finTick.finishedResult!.solvedCount, 2);
});

test('SpatialWorld coexists FARM_SANCTUARY and FARM_RACE and applies speed multiplier', () => {
  const { surface: sancSurf, colliders: sancCol } = loadRealFarmTerrain({ x: 400, z: 400 });
  const { surface: raceSurf, colliders: raceCol } = loadRealFarmTerrain(FARM_RACE_RECOMMENDED_CENTER);

  const sancAnchors = computeFarmAnchors({ x: 400, z: 400 });
  const raceAnchors = computeFarmRaceAnchors(FARM_RACE_RECOMMENDED_CENTER);

  const spatial = new SpatialWorld(-6, 6);
  spatial.enableRegionScoping();
  spatial.setDynamicData([
    { id: 9, name: 'Nông Trại', template: 'FARM_SANCTUARY', center: { x: 400, z: 400 }, width: 220, depth: 165 },
    { id: 10, name: 'Đường Đua Thú', template: 'FARM_RACE', center: FARM_RACE_RECOMMENDED_CENTER, width: 220, depth: 165 }
  ]);
  spatial.setFarmZones([
    { id: 9, name: 'Nông Trại', cx: 400, cz: 400, radius: FARM_RACE_REGION_RADIUS, spawn: sancAnchors.spawn, baseSpeed: FARM_SPEED, template: 'FARM_SANCTUARY' },
    { id: 10, name: 'Đường Đua Thú', cx: FARM_RACE_RECOMMENDED_CENTER.x, cz: FARM_RACE_RECOMMENDED_CENTER.z, radius: FARM_RACE_REGION_RADIUS, spawn: raceAnchors.spawn, baseSpeed: FARM_RACE_BASE_SPEED, template: 'FARM_RACE' }
  ]);
  spatial.setFarmTerrain(9, sancSurf, sancCol);
  spatial.setFarmTerrain(10, raceSurf, raceCol);

  spatial.setActiveRegion('zone:10');
  spatial.teleport(raceAnchors.spawn.x, raceAnchors.spawn.z, raceAnchors.spawn.y);
  assert.equal(spatial.getCurrentLocationName(), 'Đường Đua Thú');

  const dt = 1 / 60;
  const normalPose = spatial.tick(dt, { keys: new Set(['w']), joystick: { x: 0, y: 0 } }, Math.PI / 2);
  assert.ok(Math.abs(normalPose.speed - FARM_RACE_BASE_SPEED * dt) < 1e-6);

  spatial.setFarmSpeedMultiplier(1.6);
  const boostPose = spatial.tick(dt, { keys: new Set(['w']), joystick: { x: 0, y: 0 } }, Math.PI / 2);
  assert.ok(Math.abs(boostPose.speed - FARM_RACE_BASE_SPEED * 1.6 * dt) < 1e-6);

  // Sanctuary zone remains intact at FARM_SPEED * multiplier=1
  spatial.setFarmSpeedMultiplier(1);
  spatial.setActiveRegion('zone:9');
  spatial.teleport(sancAnchors.spawn.x, sancAnchors.spawn.z, sancAnchors.spawn.y);
  const sancPose = spatial.tick(dt, { keys: new Set(['w']), joystick: { x: 0, y: 0 } }, Math.PI / 2);
  assert.ok(Math.abs(sancPose.speed - FARM_SPEED * dt) < 1e-6);
});

test('Sheets sanitizer, WorldSession classification, Adventure rewards, and SyncManager handle FARM_RACE', () => {
  const zones = sanitizeRemoteZones([
    { ZoneId: 10, Name: 'Cuộc Đua Thú', Template: 'farm_race', SheetName: 'DuaThu', CenterX: 400, CenterZ: -400 }
  ]);
  assert.equal(zones[0].template, 'FARM_RACE');
  assert.equal(classifyZoneTemplate(zones[0]), 'farm_race');
  assert.equal(zoneSpawnsMonoliths(zones[0]), false);
  assert.equal(zoneCountsForBadges(zones[0]), true);

  const adv = new Adventure(freshState());
  const pKey = farmRaceProgressKey(10, 'q1');
  const cp1 = adv.solveFarmRaceCheckpoint({ zoneId: 10, progressKey: pKey, firstTry: true });
  assert.equal(cp1.alreadySolved, false);
  assert.equal(cp1.xpGained, 25);
  assert.equal(cp1.coinsGained, 8);

  // Replay does not duplicate checkpoint rewards
  const cpReplay = adv.solveFarmRaceCheckpoint({ zoneId: 10, progressKey: pKey, firstTry: true });
  assert.equal(cpReplay.alreadySolved, true);
  assert.equal(cpReplay.xpGained, 0);

  const fin = adv.completeFarmRace({
    zoneId: 10,
    rank: 1,
    elapsedMs: 52000,
    solvedCount: 1,
    totalCheckpoints: 1
  });
  assert.equal(fin.zoneCompleted, true);
  assert.equal(fin.xpGained, 140); // 60 (1st) + 80 (badge)
  assert.equal(fin.coinsGained, 70); // 30 + 40
  assert.equal(adv.getState().farmRaceRecords?.['10']?.bestRank, 1);

  // SyncManager mergeStates merges bestRank (min), bestTimeMs (min), racesCompleted (max)
  const local = freshState();
  local.farmRaceRecords = { '10': { bestRank: 2, bestTimeMs: 48000, racesCompleted: 1 } };
  const remote = freshState();
  remote.farmRaceRecords = { '10': { bestRank: 1, bestTimeMs: 55000, racesCompleted: 3 } };
  const merged = mergeStates(local, remote);
  assert.deepEqual(merged.farmRaceRecords?.['10'], {
    bestRank: 1,
    bestTimeMs: 48000,
    racesCompleted: 3
  });
});
