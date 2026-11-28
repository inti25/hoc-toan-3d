import type { FarmAnimalKind } from '../../data/farmMap';
import {
  FARM_RACE_ANIMALS,
  FARM_RACE_BASE_SPEED,
  FARM_RACE_BOOST_DURATION_SEC,
  FARM_RACE_BOOST_SPEED,
  FARM_RACE_FIRST_TRY_BOOST_SEC,
  FARM_RACE_FIRST_TRY_BOOST_SPEED,
  FARM_RACE_TRACK_WAYPOINTS,
  farmRaceProgressKey
} from '../../data/farmRaceMap';
import type { RemoteProblem } from '../../data/remoteTypes';
import { computeCompassGuidance, type CompassGuidance } from './FarmGuidance';

export type FarmRacePhase = 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'PAUSED_QUIZ' | 'FINISHED';

export type CheckpointStatus = 'upcoming' | 'active' | 'solved' | 'skipped';

export interface TrackSample {
  x: number;
  z: number;
  heading: number;
  tangentX: number;
  tangentZ: number;
  distance: number;
}

export interface TrackProjection {
  distance: number;
  lateralDist: number;
  x: number;
  z: number;
  heading: number;
}

interface TrackSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  length: number;
  startDist: number;
  endDist: number;
  tx: number;
  tz: number;
  heading: number;
}

/**
 * Pure closed-loop polyline representation of the 3D Moorhuhn Farm dirt track.
 */
export class FarmRaceTrack {
  readonly waypoints: ReadonlyArray<{ x: number; z: number }>;
  readonly segments: ReadonlyArray<TrackSegment>;
  readonly totalLength: number;

  constructor(waypoints: ReadonlyArray<{ x: number; z: number }> = FARM_RACE_TRACK_WAYPOINTS) {
    this.waypoints = waypoints;
    const segs: TrackSegment[] = [];
    let acc = 0;

    for (let i = 0; i < waypoints.length; i++) {
      const a = waypoints[i];
      const b = waypoints[(i + 1) % waypoints.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-5) continue;
      const tx = dx / length;
      const tz = dz / length;
      segs.push({
        ax: a.x,
        az: a.z,
        bx: b.x,
        bz: b.z,
        length,
        startDist: acc,
        endDist: acc + length,
        tx,
        tz,
        heading: Math.atan2(tx, tz)
      });
      acc += length;
    }

    this.segments = segs;
    this.totalLength = acc;
  }

  wrapDistance(s: number): number {
    if (this.totalLength <= 0) return 0;
    const mod = s % this.totalLength;
    return mod < 0 ? mod + this.totalLength : mod;
  }

  sampleAtDistance(s: number, lateralOffset = 0): TrackSample {
    const wrapped = this.wrapDistance(s);
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (wrapped <= seg.endDist || i === this.segments.length - 1) {
        const t = Math.max(0, Math.min(1, (wrapped - seg.startDist) / seg.length));
        const cx = seg.ax + (seg.bx - seg.ax) * t;
        const cz = seg.az + (seg.bz - seg.az) * t;
        // Right normal (-tz, tx)
        const nx = -seg.tz;
        const nz = seg.tx;
        return {
          x: cx + nx * lateralOffset,
          z: cz + nz * lateralOffset,
          heading: seg.heading,
          tangentX: seg.tx,
          tangentZ: seg.tz,
          distance: wrapped
        };
      }
    }
    return { x: 0, z: 0, heading: 0, tangentX: 0, tangentZ: 1, distance: 0 };
  }

  private isDistanceInWindow(segStart: number, segEnd: number, minD: number, maxD: number): boolean {
    if (minD <= maxD) {
      return segEnd >= minD && segStart <= maxD;
    }
    // Wrapped window around seam [minD..totalLength] U [0..maxD]
    return segEnd >= minD || segStart <= maxD;
  }

  /**
   * Projects a local (x, z) coordinate onto the track centerline.
   * When `hintDistance` is provided, searches a local track window first to prevent
   * jumping across nearby hairpin curves.
   */
  projectLocalPoint(x: number, z: number, hintDistance?: number): TrackProjection {
    if (this.segments.length === 0) {
      return { distance: 0, lateralDist: 0, x, z, heading: 0 };
    }

    const findBest = (useWindow: boolean): TrackProjection & { distSq: number } => {
      let bestDistSq = Infinity;
      let best: TrackProjection = { distance: 0, lateralDist: Infinity, x, z, heading: 0 };

      const winMin = hintDistance !== undefined ? this.wrapDistance(hintDistance - 24) : 0;
      const winMax = hintDistance !== undefined ? this.wrapDistance(hintDistance + 42) : this.totalLength;

      for (const seg of this.segments) {
        if (useWindow && hintDistance !== undefined && !this.isDistanceInWindow(seg.startDist, seg.endDist, winMin, winMax)) {
          continue;
        }
        const vx = x - seg.ax;
        const vz = z - seg.az;
        const proj = Math.max(0, Math.min(seg.length, vx * seg.tx + vz * seg.tz));
        const px = seg.ax + seg.tx * proj;
        const pz = seg.az + seg.tz * proj;
        const dx = x - px;
        const dz = z - pz;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = {
            distance: seg.startDist + proj,
            lateralDist: Math.sqrt(dSq),
            x: px,
            z: pz,
            heading: seg.heading
          };
        }
      }

      return { ...best, distSq: bestDistSq };
    };

    if (hintDistance !== undefined) {
      const localMatch = findBest(true);
      if (localMatch.lateralDist <= 14.0) {
        return {
          distance: localMatch.distance,
          lateralDist: localMatch.lateralDist,
          x: localMatch.x,
          z: localMatch.z,
          heading: localMatch.heading
        };
      }
    }

    const globalMatch = findBest(false);
    return {
      distance: globalMatch.distance,
      lateralDist: globalMatch.lateralDist,
      x: globalMatch.x,
      z: globalMatch.z,
      heading: globalMatch.heading
    };
  }
}

export interface RaceCheckpointState {
  index: number;
  progressKey: string;
  title: string;
  distance: number;
  x: number;
  z: number;
  heading: number;
  status: CheckpointStatus;
  cooldownSec: number;
}

export interface RaceRacerState {
  id: string;
  kind: FarmAnimalKind;
  name: string;
  emoji: string;
  isPlayer: boolean;
  laneOffset: number;
  baseSpeed: number;
  distance: number;
  x: number;
  z: number;
  heading: number;
  currentSpeed: number;
  finished: boolean;
  finishTimeMs: number | null;
}

export interface FarmRaceLeaderboardEntry {
  id: string;
  kind: FarmAnimalKind;
  name: string;
  emoji: string;
  isPlayer: boolean;
  rank: number;
  progress01: number;
  progressPercent: number;
  finished: boolean;
  finishTimeMs: number | null;
}

export interface FarmRaceHudSnapshot {
  phase: FarmRacePhase;
  countdownNumber: number;
  rank: number;
  totalRacers: number;
  checkpointsSolved: number;
  totalCheckpoints: number;
  allCheckpointsSolved: boolean;
  missingCheckpointsCount: number;
  finishBlocked: boolean;
  skippedCheckpointAhead: boolean;
  nextUnsolvedIndex: number | null;
  progress01: number;
  progressPercent: number;
  elapsedMs: number;
  boostRemaining: number;
  boostMax: number;
  boostActive: boolean;
  isOffTrack: boolean;
  playerAnimal: { kind: FarmAnimalKind; name: string; emoji: string };
  nextTarget: {
    kind: 'checkpoint' | 'finish';
    label: string;
    emoji: string;
    localPos: { x: number; z: number };
  };
  compass: CompassGuidance;
  leaderboard: FarmRaceLeaderboardEntry[];
}

export interface FarmRaceFinishResult {
  rank: number;
  totalRacers: number;
  elapsedMs: number;
  solvedCount: number;
  totalCheckpoints: number;
  boostsEarned: number;
  playerAnimal: { kind: FarmAnimalKind; name: string; emoji: string };
  leaderboard: FarmRaceLeaderboardEntry[];
}

export interface FarmRaceTickResult {
  triggeredCheckpointIndex: number | null;
  finishedResult: FarmRaceFinishResult | null;
  finishBlockedTriggered: boolean;
  boostActive: boolean;
  speedMultiplier: number;
}

const AI_LANE_OFFSETS = [-1.45, -0.72, 0.72, 1.45] as const;
const AI_BASE_SPEEDS = [10.45, 9.95, 9.55, 9.15] as const;
const CHECKPOINT_TRIGGER_RADIUS = 5.5;
const OFF_TRACK_THRESHOLD_M = 8.5;

export class FarmRaceEngine {
  readonly zoneId: number;
  readonly track: FarmRaceTrack;

  phase: FarmRacePhase = 'LOBBY';
  selectedKind: FarmAnimalKind = 'dog';
  checkpoints: RaceCheckpointState[] = [];
  racers: RaceRacerState[] = [];

  countdownRemaining = 0;
  elapsedMs = 0;
  boostRemaining = 0;
  boostMax = FARM_RACE_BOOST_DURATION_SEC;
  boostSpeed = FARM_RACE_BOOST_SPEED;
  boostsEarned = 0;
  playerDistance = 0;
  rawTrackDistance = 0;
  playerMaxProgress01 = 0;
  playerLateralDist = 0;
  isOffTrack = false;
  finishBlocked = false;
  skippedCheckpointAhead = false;

  private finishBlockedCueCooldown = 0;
  private finishResult: FarmRaceFinishResult | null = null;
  private problems: RemoteProblem[] = [];

  constructor(zoneId = 10, problems: RemoteProblem[] = [], track: FarmRaceTrack = new FarmRaceTrack()) {
    this.zoneId = zoneId;
    this.track = track;
    this.setProblems(problems);
    this.resetToLobby(this.selectedKind);
  }

  setProblems(problems: RemoteProblem[]): void {
    this.problems = problems;
    this.rebuildCheckpoints();
  }

  private rebuildCheckpoints(): void {
    const count = this.problems.length > 0 ? this.problems.length : 10;
    const list: RaceCheckpointState[] = [];

    for (let i = 0; i < count; i++) {
      const prob = this.problems[i];
      const problemId = prob?.id ?? `race_cp_${i + 1}`;
      const progressKey = farmRaceProgressKey(this.zoneId, problemId);
      const distance = (this.track.totalLength * (i + 1)) / (count + 1);
      const sample = this.track.sampleAtDistance(distance, 0);
      list.push({
        index: i,
        progressKey,
        title: prob?.title || `Trạm #${i + 1}`,
        distance,
        x: sample.x,
        z: sample.z,
        heading: sample.heading,
        status: i === 0 ? 'active' : 'upcoming',
        cooldownSec: 0
      });
    }

    this.checkpoints = list;
  }

  selectAnimal(kind: FarmAnimalKind): void {
    if (FARM_RACE_ANIMALS.some((a) => a.kind === kind)) {
      this.selectedKind = kind;
    }
    if (this.phase === 'LOBBY') {
      this.buildRacers();
    }
  }

  private buildRacers(): void {
    const chosenMeta = FARM_RACE_ANIMALS.find((a) => a.kind === this.selectedKind) ?? FARM_RACE_ANIMALS[0];
    const rivals = FARM_RACE_ANIMALS.filter((a) => a.kind !== chosenMeta.kind);

    const startSample = this.track.sampleAtDistance(0, 0);
    const playerRacer: RaceRacerState = {
      id: 'player_racer',
      kind: chosenMeta.kind,
      name: `${chosenMeta.name} (Bạn)`,
      emoji: chosenMeta.emoji,
      isPlayer: true,
      laneOffset: 0,
      baseSpeed: FARM_RACE_BASE_SPEED,
      distance: 0,
      x: startSample.x,
      z: startSample.z,
      heading: startSample.heading,
      currentSpeed: 0,
      finished: false,
      finishTimeMs: null
    };

    const aiRacers: RaceRacerState[] = rivals.map((meta, idx) => {
      const laneOffset = AI_LANE_OFFSETS[idx % AI_LANE_OFFSETS.length];
      const sample = this.track.sampleAtDistance(0, laneOffset);
      return {
        id: `ai_${meta.kind}`,
        kind: meta.kind,
        name: meta.name,
        emoji: meta.emoji,
        isPlayer: false,
        laneOffset,
        baseSpeed: AI_BASE_SPEEDS[idx % AI_BASE_SPEEDS.length],
        distance: 0,
        x: sample.x,
        z: sample.z,
        heading: sample.heading,
        currentSpeed: 0,
        finished: false,
        finishTimeMs: null
      };
    });

    this.racers = [playerRacer, ...aiRacers];
  }

  resetToLobby(kind: FarmAnimalKind = this.selectedKind): void {
    this.selectAnimal(kind);
    this.phase = 'LOBBY';
    this.countdownRemaining = 0;
    this.elapsedMs = 0;
    this.boostRemaining = 0;
    this.boostMax = FARM_RACE_BOOST_DURATION_SEC;
    this.boostSpeed = FARM_RACE_BOOST_SPEED;
    this.boostsEarned = 0;
    this.playerDistance = 0;
    this.rawTrackDistance = 0;
    this.playerMaxProgress01 = 0;
    this.playerLateralDist = 0;
    this.isOffTrack = false;
    this.finishBlocked = false;
    this.skippedCheckpointAhead = false;
    this.finishBlockedCueCooldown = 0;
    this.finishResult = null;
    this.rebuildCheckpoints();
    this.buildRacers();
  }

  startCountdown(): void {
    this.resetToLobby(this.selectedKind);
    this.phase = 'COUNTDOWN';
    this.countdownRemaining = 2.4;
  }

  getCountdownNumber(): number {
    if (this.phase !== 'COUNTDOWN') return 0;
    if (this.countdownRemaining > 1.6) return 3;
    if (this.countdownRemaining > 0.8) return 2;
    if (this.countdownRemaining > 0.1) return 1;
    return 0;
  }

  getPlayerRacer(): RaceRacerState {
    return this.racers[0];
  }

  getAiRacers(): RaceRacerState[] {
    return this.racers.slice(1);
  }

  getActiveSpeedMultiplier(): number {
    if (this.boostRemaining > 0) {
      return this.boostSpeed / FARM_RACE_BASE_SPEED;
    }
    return 1.0;
  }

  private refreshActiveCheckpoint(): void {
    let foundNext = false;
    for (const cp of this.checkpoints) {
      if (cp.status === 'solved') continue;
      if (!foundNext) {
        cp.status = 'active';
        foundNext = true;
      } else if (cp.status !== 'skipped') {
        cp.status = 'upcoming';
      }
    }
  }

  resumeAfterQuiz(solved: boolean, firstTry: boolean, checkpointIndex: number): void {
    const cp = this.checkpoints[checkpointIndex];
    if (cp) {
      if (solved) {
        cp.status = 'solved';
        cp.cooldownSec = 0;
        this.boostsEarned++;
        this.boostMax = firstTry ? FARM_RACE_FIRST_TRY_BOOST_SEC : FARM_RACE_BOOST_DURATION_SEC;
        this.boostRemaining = this.boostMax;
        this.boostSpeed = firstTry ? FARM_RACE_FIRST_TRY_BOOST_SPEED : FARM_RACE_BOOST_SPEED;
      } else {
        cp.cooldownSec = 3.5;
        if (cp.status !== 'solved') {
          cp.status = 'skipped';
        }
      }
    }
    this.refreshActiveCheckpoint();
    const firstUnsolved = this.getFirstUnsolvedCheckpoint();
    if (firstUnsolved === null) {
      this.finishBlocked = false;
      this.skippedCheckpointAhead = false;
    } else {
      this.skippedCheckpointAhead = this.rawTrackDistance > firstUnsolved.distance + 12;
      if (!this.skippedCheckpointAhead) {
        this.finishBlocked = false;
      }
    }
    if (this.phase === 'PAUSED_QUIZ') {
      this.phase = 'RACING';
    }
  }

  getFirstUnsolvedCheckpoint(): RaceCheckpointState | null {
    return this.checkpoints.find((c) => c.status !== 'solved') ?? null;
  }

  areAllCheckpointsSolved(): boolean {
    return this.checkpoints.length === 0 || this.checkpoints.every((c) => c.status === 'solved');
  }

  findNearUnsolvedCheckpoint(playerLocalPos: { x: number; z: number }, radius = 6.5): RaceCheckpointState | null {
    let best: RaceCheckpointState | null = null;
    let bestDist = radius;
    for (const cp of this.checkpoints) {
      if (cp.status === 'solved') continue;
      const d = Math.hypot(playerLocalPos.x - cp.x, playerLocalPos.z - cp.z);
      if (d <= bestDist) {
        bestDist = d;
        best = cp;
      }
    }
    return best;
  }

  openCheckpointManual(index: number): boolean {
    if (this.phase !== 'RACING') return false;
    const cp = this.checkpoints[index];
    if (!cp || cp.status === 'solved') return false;
    this.phase = 'PAUSED_QUIZ';
    return true;
  }

  getRecoveryPoint(): { x: number; z: number; heading: number } {
    const firstUnsolved = this.getFirstUnsolvedCheckpoint();
    if ((this.skippedCheckpointAhead || this.finishBlocked) && firstUnsolved) {
      const sample = this.track.sampleAtDistance(Math.max(0, firstUnsolved.distance - 6.0), 0);
      return {
        x: sample.x,
        z: sample.z,
        heading: sample.heading
      };
    }
    const sample = this.track.sampleAtDistance(this.playerDistance, 0);
    return {
      x: sample.x,
      z: sample.z,
      heading: sample.heading
    };
  }

  update(dt: number, playerLocalPos: { x: number; z: number }): FarmRaceTickResult {
    const clampedDt = Math.max(0, Math.min(0.1, dt));

    if (this.phase === 'COUNTDOWN') {
      this.countdownRemaining = Math.max(0, this.countdownRemaining - clampedDt);
      if (this.countdownRemaining <= 0) {
        this.phase = 'RACING';
      }
      return {
        triggeredCheckpointIndex: null,
        finishedResult: null,
        finishBlockedTriggered: false,
        boostActive: false,
        speedMultiplier: 1.0
      };
    }

    if (this.phase !== 'RACING') {
      return {
        triggeredCheckpointIndex: null,
        finishedResult: this.phase === 'FINISHED' ? this.finishResult : null,
        finishBlockedTriggered: false,
        boostActive: false,
        speedMultiplier: 1.0
      };
    }

    this.elapsedMs += clampedDt * 1000;

    if (this.boostRemaining > 0) {
      this.boostRemaining = Math.max(0, this.boostRemaining - clampedDt);
    }
    if (this.finishBlockedCueCooldown > 0) {
      this.finishBlockedCueCooldown = Math.max(0, this.finishBlockedCueCooldown - clampedDt);
    }

    for (const cp of this.checkpoints) {
      if (cp.cooldownSec > 0) {
        cp.cooldownSec = Math.max(0, cp.cooldownSec - clampedDt);
      }
    }

    // 1. Project player onto track using local window around rawTrackDistance
    const proj = this.track.projectLocalPoint(playerLocalPos.x, playerLocalPos.z, this.rawTrackDistance);
    this.playerLateralDist = proj.lateralDist;
    this.isOffTrack = proj.lateralDist > OFF_TRACK_THRESHOLD_M;

    let rawDist = proj.distance;
    // Prevent start-line seam wrap when starting just behind s = 0
    if (this.playerMaxProgress01 < 0.2 && rawDist > this.track.totalLength - 30) {
      rawDist = 0;
    }

    const firstUnsolved = this.getFirstUnsolvedCheckpoint();
    const startSample = this.track.sampleAtDistance(0, 0);
    let finishBlockedTriggered = false;

    if (firstUnsolved !== null) {
      // Cap effective progress at earliest unsolved checkpoint so skipping gates cannot unlock finish
      this.playerDistance = Math.min(rawDist, firstUnsolved.distance);
      this.skippedCheckpointAhead = rawDist > firstUnsolved.distance + 12;

      const distToStart = Math.hypot(playerLocalPos.x - startSample.x, playerLocalPos.z - startSample.z);
      const nearFinishZone =
        distToStart <= 9.0 &&
        (this.playerMaxProgress01 >= 0.5 || rawDist >= this.track.totalLength - 20 || this.skippedCheckpointAhead);
      this.finishBlocked = nearFinishZone;
      if (this.finishBlocked && this.finishBlockedCueCooldown <= 0) {
        finishBlockedTriggered = true;
        this.finishBlockedCueCooldown = 4.0;
      }
    } else {
      this.finishBlocked = false;
      this.skippedCheckpointAhead = false;
      if (
        this.playerMaxProgress01 >= 0.82 &&
        rawDist < 30 &&
        this.rawTrackDistance > this.track.totalLength - 35
      ) {
        // Crossed finish seam after solving all checkpoints and completing >= 82% of lap
        rawDist = this.track.totalLength;
      }
      this.playerDistance = rawDist;
    }

    this.rawTrackDistance = rawDist;

    const progress01 = Math.max(0, Math.min(1, this.playerDistance / Math.max(1, this.track.totalLength)));
    if (progress01 > this.playerMaxProgress01) {
      this.playerMaxProgress01 = progress01;
    }

    const playerRacer = this.getPlayerRacer();
    if (playerRacer) {
      playerRacer.distance = this.playerDistance;
      playerRacer.x = playerLocalPos.x;
      playerRacer.z = playerLocalPos.z;
      playerRacer.heading = proj.heading;
      playerRacer.currentSpeed = this.boostRemaining > 0 ? this.boostSpeed : FARM_RACE_BASE_SPEED;
    }

    // 2. Advance AI rivals with gentle rubber-banding
    for (const ai of this.getAiRacers()) {
      if (ai.finished) {
        ai.currentSpeed = 0;
        continue;
      }
      const gap = ai.distance - this.playerDistance;
      let rubberFactor = 1.0;
      if (gap > 35) {
        rubberFactor = 1 - Math.min(0.22, (gap - 35) * 0.006);
      } else if (gap < -45) {
        rubberFactor = 1 + Math.min(0.14, (-gap - 45) * 0.004);
      }
      const speed = Math.min(FARM_RACE_BOOST_SPEED * 0.72, ai.baseSpeed * rubberFactor);
      ai.currentSpeed = speed;
      ai.distance += speed * clampedDt;

      if (ai.distance >= this.track.totalLength) {
        ai.distance = this.track.totalLength;
        ai.finished = true;
        ai.finishTimeMs = Math.round(this.elapsedMs);
      }

      const sample = this.track.sampleAtDistance(ai.distance, ai.laneOffset);
      ai.x = sample.x;
      ai.z = sample.z;
      ai.heading = sample.heading;
    }

    // 3. Check finish condition (requires ALL checkpoints solved + >= 82% completed + finish zone)
    if (
      firstUnsolved === null &&
      this.playerMaxProgress01 >= 0.82 &&
      this.playerDistance >= this.track.totalLength - 6
    ) {
      this.playerDistance = this.track.totalLength;
      if (playerRacer) {
        playerRacer.distance = this.track.totalLength;
        playerRacer.finished = true;
        playerRacer.finishTimeMs = Math.round(this.elapsedMs);
        playerRacer.currentSpeed = 0;
      }
      this.phase = 'FINISHED';
      const leaderboard = this.computeLeaderboard();
      const playerRank = leaderboard.find((e) => e.isPlayer)?.rank ?? 1;
      const solvedCount = this.checkpoints.filter((c) => c.status === 'solved').length;
      const playerMeta = FARM_RACE_ANIMALS.find((a) => a.kind === this.selectedKind) ?? FARM_RACE_ANIMALS[0];

      this.finishResult = {
        rank: playerRank,
        totalRacers: this.racers.length,
        elapsedMs: Math.round(this.elapsedMs),
        solvedCount,
        totalCheckpoints: this.checkpoints.length,
        boostsEarned: this.boostsEarned,
        playerAnimal: { kind: playerMeta.kind, name: playerMeta.name, emoji: playerMeta.emoji },
        leaderboard
      };

      return {
        triggeredCheckpointIndex: null,
        finishedResult: this.finishResult,
        finishBlockedTriggered: false,
        boostActive: false,
        speedMultiplier: 1.0
      };
    }

    // 4. Check checkpoint triggers (Euclidean gate check without fragile trackDelta clamp)
    for (const cp of this.checkpoints) {
      if (cp.status === 'solved' || cp.cooldownSec > 0) continue;
      const distToGate = Math.hypot(playerLocalPos.x - cp.x, playerLocalPos.z - cp.z);
      if (distToGate <= CHECKPOINT_TRIGGER_RADIUS) {
        this.phase = 'PAUSED_QUIZ';
        return {
          triggeredCheckpointIndex: cp.index,
          finishedResult: null,
          finishBlockedTriggered,
          boostActive: this.boostRemaining > 0,
          speedMultiplier: this.getActiveSpeedMultiplier()
        };
      }
    }

    return {
      triggeredCheckpointIndex: null,
      finishedResult: null,
      finishBlockedTriggered,
      boostActive: this.boostRemaining > 0,
      speedMultiplier: this.getActiveSpeedMultiplier()
    };
  }

  computeLeaderboard(): FarmRaceLeaderboardEntry[] {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) {
        return (a.finishTimeMs ?? Infinity) - (b.finishTimeMs ?? Infinity);
      }
      if (a.finished !== b.finished) {
        return a.finished ? -1 : 1;
      }
      return b.distance - a.distance;
    });

    return sorted.map((r, idx) => {
      const progress01 = Math.max(0, Math.min(1, r.distance / Math.max(1, this.track.totalLength)));
      return {
        id: r.id,
        kind: r.kind,
        name: r.name,
        emoji: r.emoji,
        isPlayer: r.isPlayer,
        rank: idx + 1,
        progress01,
        progressPercent: Math.round(progress01 * 100),
        finished: r.finished,
        finishTimeMs: r.finishTimeMs
      };
    });
  }

  getNextTarget(): { kind: 'checkpoint' | 'finish'; label: string; emoji: string; localPos: { x: number; z: number } } {
    const nextCp = this.getFirstUnsolvedCheckpoint();

    if (nextCp) {
      return {
        kind: 'checkpoint',
        label: `Trạm ${nextCp.index + 1}/${this.checkpoints.length}: ${nextCp.title}`,
        emoji: '🚩',
        localPos: { x: nextCp.x, z: nextCp.z }
      };
    }

    const finishSample = this.track.sampleAtDistance(0, 0);
    return {
      kind: 'finish',
      label: 'Vạch Đích Nông Trại',
      emoji: '🏁',
      localPos: { x: finishSample.x, z: finishSample.z }
    };
  }

  buildHudSnapshot(playerLocalPos: { x: number; z: number }, cameraYaw: number): FarmRaceHudSnapshot {
    const leaderboard = this.computeLeaderboard();
    const playerEntry = leaderboard.find((e) => e.isPlayer);
    const nextTarget = this.getNextTarget();
    const compass = computeCompassGuidance(playerLocalPos, cameraYaw, nextTarget.localPos);
    const playerMeta = FARM_RACE_ANIMALS.find((a) => a.kind === this.selectedKind) ?? FARM_RACE_ANIMALS[0];
    const progress01 = Math.max(0, Math.min(1, this.playerDistance / Math.max(1, this.track.totalLength)));
    const checkpointsSolved = this.checkpoints.filter((c) => c.status === 'solved').length;
    const totalCheckpoints = this.checkpoints.length;
    const firstUnsolved = this.getFirstUnsolvedCheckpoint();

    return {
      phase: this.phase,
      countdownNumber: this.getCountdownNumber(),
      rank: playerEntry?.rank ?? 1,
      totalRacers: this.racers.length,
      checkpointsSolved,
      totalCheckpoints,
      allCheckpointsSolved: firstUnsolved === null,
      missingCheckpointsCount: Math.max(0, totalCheckpoints - checkpointsSolved),
      finishBlocked: this.finishBlocked,
      skippedCheckpointAhead: this.skippedCheckpointAhead,
      nextUnsolvedIndex: firstUnsolved ? firstUnsolved.index : null,
      progress01,
      progressPercent: Math.round(progress01 * 100),
      elapsedMs: Math.round(this.elapsedMs),
      boostRemaining: this.boostRemaining,
      boostMax: this.boostMax,
      boostActive: this.boostRemaining > 0,
      isOffTrack: this.isOffTrack,
      playerAnimal: { kind: playerMeta.kind, name: playerMeta.name, emoji: playerMeta.emoji },
      nextTarget,
      compass,
      leaderboard
    };
  }
}
