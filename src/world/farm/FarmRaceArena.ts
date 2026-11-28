import * as THREE from 'three';
import {
  FARM_SCALE,
  FARM_SKY_MATERIALS,
  FARM_WORLD_MODEL_OFFSET,
  type FarmAnimalKind
} from '../../data/farmMap';
import { FARM_RACE_START_LOCAL } from '../../data/farmRaceMap';
import type { RemoteProblem } from '../../data/remoteTypes';
import type { Obstacle } from '../SpatialWorld';
import { AssetRepository } from '../assets/AssetRepository';
import type { AssetRepositorySeam } from '../assets/types';
import type { RoadSurface } from '../qhmj/RoadSurface';
import { FarmAnimalEntity } from './FarmAnimalEntity';
import {
  FarmRaceEngine,
  type CheckpointStatus,
  type FarmRaceHudSnapshot,
  type FarmRaceTickResult,
  type RaceCheckpointState
} from './FarmRaceLogic';
import { extractFarmTerrainFromScene, type FarmColliderGrid } from './FarmTerrain';

interface GateVisual {
  index: number;
  group: THREE.Group;
  pylonMat: THREE.MeshStandardMaterial;
  stripMat: THREE.MeshBasicMaterial;
  barrier: THREE.Mesh;
  barrierMat: THREE.MeshBasicMaterial;
  crystal: THREE.Mesh;
  crystalMat: THREE.MeshStandardMaterial;
  lastStatus?: CheckpointStatus;
}

export class FarmRaceArena {
  public readonly zoneId: number;
  public readonly group = new THREE.Group();
  public readonly sceneryGroup = new THREE.Group();
  public readonly trackPropsGroup = new THREE.Group();
  public readonly racersGroup = new THREE.Group();

  public libraryScene?: THREE.Group;
  public worldScene?: THREE.Group;
  public terrainSurface: RoadSurface | null = null;
  public colliderGrid: FarmColliderGrid | null = null;
  public readonly engine: FarmRaceEngine;
  public questions: RemoteProblem[] = [];

  private readonly assets: AssetRepositorySeam;
  private gateVisuals: GateVisual[] = [];
  private finishBarrierMesh: THREE.Mesh | null = null;
  private finishBarrierMat: THREE.MeshBasicMaterial | null = null;
  private finishLanternMat: THREE.MeshStandardMaterial | null = null;
  private focusBeamGroup: THREE.Group | null = null;
  private focusRingMesh: THREE.Mesh | null = null;
  private playerAnimalEntity: FarmAnimalEntity | null = null;
  private aiAnimalEntities = new Map<string, FarmAnimalEntity>();
  private playerStarMesh: THREE.Mesh | null = null;
  private time = 0;

  private readonly scratchLocalPos = new THREE.Vector3();

  constructor(zoneId: number, assets?: AssetRepositorySeam) {
    this.zoneId = zoneId;
    this.assets = assets ?? new AssetRepository();
    this.engine = new FarmRaceEngine(zoneId);
    this.sceneryGroup.name = `farm_race_scenery_${zoneId}`;
    this.trackPropsGroup.name = `farm_race_props_${zoneId}`;
    this.racersGroup.name = `farm_race_racers_${zoneId}`;
    this.group.add(this.sceneryGroup, this.trackPropsGroup, this.racersGroup);
  }

  public async load(questions?: RemoteProblem[]): Promise<void> {
    const [farmScene, worldScene] = await Promise.all([
      this.assets.instantiate('map:farm'),
      this.assets.instantiate('map:farm_world')
    ]);

    if (!farmScene) {
      throw new Error('Failed to load map:farm from AssetRepository');
    }

    this.setupFromLibrary(farmScene, questions ?? [], worldScene ?? undefined);
  }

  public setupFromLibrary(
    libraryScene: THREE.Group,
    questions: RemoteProblem[] = [],
    worldScene?: THREE.Group
  ): void {
    this.libraryScene = libraryScene;
    this.worldScene = worldScene;
    this.questions = questions;

    this.sceneryGroup.clear();
    this.trackPropsGroup.clear();
    this.racersGroup.clear();
    this.gateVisuals = [];
    this.finishBarrierMesh = null;
    this.finishBarrierMat = null;
    this.finishLanternMat = null;
    this.aiAnimalEntities.clear();
    this.playerAnimalEntity = null;
    this.playerStarMesh = null;
    this.terrainSurface = null;
    this.colliderGrid = null;

    libraryScene.traverse((child) => {
      if ((child as any).isLight || (child as any).isCamera) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (worldScene) {
      this.mountCountrysideWorld(worldScene);
    }

    this.engine.setProblems(questions);
    this.engine.resetToLobby(this.engine.selectedKind);

    this.buildStartFinishArch();
    this.buildCheckpointGates();
    this.rebuildRacerEntities();
    this.syncGateVisuals(0);
    this.syncFocusBeam(0);
  }

  public syncQuestions(questions?: RemoteProblem[]): void {
    if (!questions) return;
    this.questions = questions;
    if (this.engine.phase === 'LOBBY') {
      this.engine.setProblems(questions);
      this.engine.resetToLobby(this.engine.selectedKind);
      this.trackPropsGroup.clear();
      this.gateVisuals = [];
      this.buildStartFinishArch();
      this.buildCheckpointGates();
      this.syncGateVisuals(0);
      this.syncFocusBeam(0);
    }
  }

  public selectAnimal(kind: FarmAnimalKind): void {
    this.engine.selectAnimal(kind);
    if (this.libraryScene) {
      this.rebuildRacerEntities();
    }
  }

  public startCountdown(): void {
    this.engine.startCountdown();
    this.syncRacerEntitiesToEngine(0);
    this.syncGateVisuals(0);
    this.syncFocusBeam(0);
  }

  public resetToLobby(): void {
    this.engine.resetToLobby(this.engine.selectedKind);
    this.syncRacerEntitiesToEngine(0);
    this.syncGateVisuals(0);
    this.syncFocusBeam(0);
  }

  public resumeAfterQuiz(solved: boolean, firstTry: boolean, checkpointIndex: number): void {
    this.engine.resumeAfterQuiz(solved, firstTry, checkpointIndex);
    this.syncGateVisuals(0);
    this.syncFocusBeam(0);
  }

  private mountCountrysideWorld(worldScene: THREE.Group): void {
    worldScene.name = `farm_race_world_terrain_${this.zoneId}`;
    worldScene.scale.setScalar(FARM_SCALE);
    worldScene.position.set(
      FARM_WORLD_MODEL_OFFSET.x,
      FARM_WORLD_MODEL_OFFSET.y,
      FARM_WORLD_MODEL_OFFSET.z
    );

    worldScene.traverse((child) => {
      if ((child as any).isLight || (child as any).isCamera) {
        child.visible = false;
        return;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (mats.some((m) => m && FARM_SKY_MATERIALS.has(m.name))) {
          mesh.frustumCulled = false;
        }
      }
    });

    this.sceneryGroup.add(worldScene);
    this.group.updateMatrixWorld(true);

    const { surface, colliders } = extractFarmTerrainFromScene(worldScene);
    if (surface.triCount > 0) {
      this.terrainSurface = surface;
    }
    if (colliders.solidCellCount > 0 || colliders.fenceCellCount > 0) {
      this.colliderGrid = colliders;
    }
  }

  public sampleLocalGroundY(localX: number, localZ: number, refY: number = FARM_RACE_START_LOCAL.y): number {
    if (!this.terrainSurface) return 0;
    const wx = this.group.position.x + localX;
    const wz = this.group.position.z + localZ;
    return (
      this.terrainSurface.sample(wx, wz, refY, 4.0, 6.0)?.y ??
      this.terrainSurface.sampleNearest(wx, wz, refY)?.y ??
      0
    );
  }

  private buildStartFinishArch(): void {
    const startSample = this.engine.track.sampleAtDistance(0, 0);
    const groundY = this.sampleLocalGroundY(startSample.x, startSample.z, FARM_RACE_START_LOCAL.y);

    const arch = new THREE.Group();
    arch.name = 'farm_race_finish_arch';
    arch.position.set(startSample.x, groundY, startSample.z);
    arch.rotation.y = startSample.heading;

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x78350f, roughness: 0.35 });
    this.finishLanternMat = goldMat;
    const bannerMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 });

    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.28, 4.8, 10);
    for (const side of [-3.4, 3.4]) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(side, 2.4, 0);
      p.castShadow = true;
      arch.add(p);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), goldMat);
      cap.position.set(side, 4.95, 0);
      arch.add(cap);
    }

    const barrierMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const finishBarrier = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.6), barrierMat);
    finishBarrier.position.set(0, 1.9, 0);
    finishBarrier.visible = false;
    arch.add(finishBarrier);
    this.finishBarrierMesh = finishBarrier;
    this.finishBarrierMat = barrierMat;

    const beam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.78, 0.32), bannerMat);
    beam.position.set(0, 4.45, 0);
    beam.castShadow = true;
    arch.add(beam);

    // Checkered accent blocks along beam
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const checkGeo = new THREE.BoxGeometry(0.62, 0.32, 0.36);
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        const block = new THREE.Mesh(checkGeo, darkMat);
        block.position.set(-2.8 + i * 0.62, 4.45, 0);
        arch.add(block);
      }
    }

    this.trackPropsGroup.add(arch);
  }

  private buildCheckpointGates(): void {
    const pylonGeo = new THREE.CylinderGeometry(0.16, 0.22, 3.4, 10);
    const barGeo = new THREE.BoxGeometry(6.6, 0.28, 0.22);
    const stripGeo = new THREE.PlaneGeometry(5.8, 1.15);
    const barrierGeo = new THREE.PlaneGeometry(5.8, 2.8);
    const crystalGeo = new THREE.OctahedronGeometry(0.42, 0);

    for (const cp of this.engine.checkpoints) {
      const groundY = this.sampleLocalGroundY(cp.x, cp.z, FARM_RACE_START_LOCAL.y);
      const gate = new THREE.Group();
      gate.name = `farm_race_gate_${cp.index}`;
      gate.position.set(cp.x, groundY, cp.z);
      gate.rotation.y = cp.heading;

      const pylonMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.28,
        roughness: 0.4
      });
      const stripMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const barrierMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.55,
        roughness: 0.25
      });

      for (const side of [-3.1, 3.1]) {
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.set(side, 1.7, 0);
        pylon.castShadow = true;
        gate.add(pylon);
      }

      const topBar = new THREE.Mesh(barGeo, pylonMat);
      topBar.position.set(0, 3.4, 0);
      gate.add(topBar);

      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, 0.08, 0);
      gate.add(strip);

      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(0, 1.65, 0);
      gate.add(barrier);

      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.set(0, 4.15, 0);
      gate.add(crystal);

      this.trackPropsGroup.add(gate);
      this.gateVisuals.push({
        index: cp.index,
        group: gate,
        pylonMat,
        stripMat,
        barrier,
        barrierMat,
        crystal,
        crystalMat
      });
    }
  }

  private rebuildRacerEntities(): void {
    this.racersGroup.clear();
    this.aiAnimalEntities.clear();
    this.playerAnimalEntity = null;
    this.playerStarMesh = null;

    if (!this.libraryScene) return;

    const playerRacer = this.engine.getPlayerRacer();
    if (playerRacer) {
      const entity = new FarmAnimalEntity(playerRacer.id, 0, playerRacer.kind, this.libraryScene);
      entity.setBeaconVisible(false);
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      star.position.y = 2.2;
      entity.root.add(star);
      this.playerStarMesh = star;
      this.playerAnimalEntity = entity;
      this.racersGroup.add(entity.root);
    }

    this.engine.getAiRacers().forEach((ai, idx) => {
      const entity = new FarmAnimalEntity(ai.id, idx + 1, ai.kind, this.libraryScene!);
      entity.setBeaconVisible(false);
      this.aiAnimalEntities.set(ai.id, entity);
      this.racersGroup.add(entity.root);
    });

    this.syncRacerEntitiesToEngine(0);
  }

  private syncRacerEntitiesToEngine(dt: number): void {
    const playerRacer = this.engine.getPlayerRacer();
    if (this.playerAnimalEntity && playerRacer) {
      const py = this.sampleLocalGroundY(playerRacer.x, playerRacer.z, FARM_RACE_START_LOCAL.y);
      this.playerAnimalEntity.root.position.set(playerRacer.x, py, playerRacer.z);
      this.playerAnimalEntity.root.rotation.y = playerRacer.heading;
      this.playerAnimalEntity.speed = playerRacer.currentSpeed;
      this.playerAnimalEntity.updateAnimation(dt, this.time);
    }

    for (const ai of this.engine.getAiRacers()) {
      const entity = this.aiAnimalEntities.get(ai.id);
      if (!entity) continue;
      const ay = this.sampleLocalGroundY(ai.x, ai.z, FARM_RACE_START_LOCAL.y);
      entity.root.position.set(ai.x, ay, ai.z);
      entity.root.rotation.y = ai.heading;
      entity.speed = ai.currentSpeed;
      entity.updateAnimation(dt, this.time);
    }
  }

  private syncGateVisuals(dt: number): void {
    for (const gv of this.gateVisuals) {
      const cp = this.engine.checkpoints[gv.index];
      if (!cp) continue;
      if (cp.status !== gv.lastStatus) {
        gv.lastStatus = cp.status;
        if (cp.status === 'solved') {
          gv.pylonMat.color.setHex(0x10b981);
          gv.pylonMat.emissive.setHex(0x047857);
          gv.stripMat.color.setHex(0x34d399);
          gv.stripMat.opacity = 0.24;
          gv.barrier.visible = false;
          gv.crystalMat.color.setHex(0x6ee7b7);
          gv.crystalMat.emissive.setHex(0x10b981);
        } else if (cp.status === 'active') {
          gv.pylonMat.color.setHex(0xf59e0b);
          gv.pylonMat.emissive.setHex(0xd97706);
          gv.stripMat.color.setHex(0xfde047);
          gv.stripMat.opacity = 0.56;
          gv.barrier.visible = true;
          gv.barrierMat.color.setHex(0xf59e0b);
          gv.barrierMat.opacity = 0.26;
          gv.crystalMat.color.setHex(0xfef08a);
          gv.crystalMat.emissive.setHex(0xf59e0b);
        } else {
          gv.pylonMat.color.setHex(0x38bdf8);
          gv.pylonMat.emissive.setHex(0x0284c7);
          gv.stripMat.color.setHex(0x38bdf8);
          gv.stripMat.opacity = 0.4;
          gv.barrier.visible = true;
          gv.barrierMat.color.setHex(0x38bdf8);
          gv.barrierMat.opacity = 0.2;
          gv.crystalMat.color.setHex(0xe0f2fe);
          gv.crystalMat.emissive.setHex(0x0284c7);
        }
      }
      gv.crystal.rotation.y += dt * (cp.status === 'active' ? 2.6 : 1.4);
      gv.crystal.position.y = 4.15 + Math.sin(this.time * 3 + gv.index) * 0.22;
    }

    const allSolved = this.engine.areAllCheckpointsSolved();
    if (this.finishBarrierMesh) {
      this.finishBarrierMesh.visible = this.engine.phase === 'RACING' && !allSolved;
      if (this.finishBarrierMesh.visible && this.finishBarrierMat) {
        this.finishBarrierMat.opacity = 0.28 + Math.sin(this.time * 4) * 0.08;
      }
    }
    if (this.finishLanternMat) {
      if (allSolved) {
        this.finishLanternMat.color.setHex(0x10b981);
        this.finishLanternMat.emissive.setHex(0x047857);
      } else {
        this.finishLanternMat.color.setHex(0xf59e0b);
        this.finishLanternMat.emissive.setHex(0x78350f);
      }
    }
  }

  private ensureFocusBeam(): THREE.Group {
    if (this.focusBeamGroup) return this.focusBeamGroup;

    const beamGroup = new THREE.Group();
    beamGroup.name = 'farm_race_focus_beam';
    const outerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.58, 14, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    outerBeam.position.y = 7;
    outerBeam.frustumCulled = false;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.65, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    ring.frustumCulled = false;
    this.focusRingMesh = ring;

    beamGroup.add(outerBeam, ring);
    this.group.add(beamGroup);
    this.focusBeamGroup = beamGroup;
    return beamGroup;
  }

  private syncFocusBeam(dt: number): void {
    void dt;
    if (this.engine.phase === 'FINISHED') {
      if (this.focusBeamGroup) this.focusBeamGroup.visible = false;
      return;
    }

    const next = this.engine.getNextTarget();
    const beam = this.ensureFocusBeam();
    beam.visible = true;
    const gy = this.sampleLocalGroundY(next.localPos.x, next.localPos.z, FARM_RACE_START_LOCAL.y);
    beam.position.set(next.localPos.x, gy, next.localPos.z);
    if (this.focusRingMesh) {
      const pulse = 1 + Math.sin(this.time * 4.5) * 0.12;
      this.focusRingMesh.scale.set(pulse, pulse, 1);
    }
  }

  public update(
    dt: number,
    playerWorldPos: THREE.Vector3,
    playerHeading: number,
    playerMoving: boolean
  ): FarmRaceTickResult {
    this.time += dt;
    const localPlayer = this.scratchLocalPos.copy(playerWorldPos).sub(this.group.position);

    const tickRes = this.engine.update(dt, { x: localPlayer.x, z: localPlayer.z });

    // Position player companion animal beside/ahead of player
    if (this.playerAnimalEntity) {
      if (this.engine.phase === 'LOBBY' || this.engine.phase === 'COUNTDOWN') {
        const startSample = this.engine.track.sampleAtDistance(0, 0);
        const py = this.sampleLocalGroundY(startSample.x, startSample.z, FARM_RACE_START_LOCAL.y);
        this.playerAnimalEntity.root.position.set(startSample.x, py, startSample.z);
        this.playerAnimalEntity.root.rotation.y = startSample.heading;
        this.playerAnimalEntity.speed = 0;
        this.playerAnimalEntity.updateAnimation(dt, this.time);
      } else {
        const compX = localPlayer.x + Math.sin(playerHeading) * 1.15 + Math.cos(playerHeading) * 0.65;
        const compZ = localPlayer.z + Math.cos(playerHeading) * 1.15 - Math.sin(playerHeading) * 0.65;
        const compY = this.sampleLocalGroundY(compX, compZ, playerWorldPos.y);
        this.playerAnimalEntity.root.position.set(compX, compY, compZ);
        this.playerAnimalEntity.root.rotation.y = playerHeading;
        this.playerAnimalEntity.speed = playerMoving
          ? (tickRes.boostActive ? 14 : 9.5)
          : 0;
        this.playerAnimalEntity.updateAnimation(dt * (tickRes.boostActive ? 1.35 : 1), this.time);
      }

      if (this.playerStarMesh) {
        this.playerStarMesh.position.y = 2.15 + Math.sin(this.time * 4) * 0.14;
        this.playerStarMesh.rotation.y += dt * (tickRes.boostActive ? 5.0 : 2.0);
      }
    }

    // Update AI racer entities
    for (const ai of this.engine.getAiRacers()) {
      const entity = this.aiAnimalEntities.get(ai.id);
      if (!entity) continue;
      const ay = this.sampleLocalGroundY(ai.x, ai.z, FARM_RACE_START_LOCAL.y);
      entity.root.position.set(ai.x, ay, ai.z);
      entity.root.rotation.y = ai.heading;
      entity.speed = this.engine.phase === 'RACING' ? ai.currentSpeed : 0;
      entity.updateAnimation(dt, this.time);
    }

    this.syncGateVisuals(dt);
    this.syncFocusBeam(dt);

    return tickRes;
  }

  public findNearUnsolvedCheckpointWorld(
    playerWorldPos: { x: number; z: number },
    radius = 6.5
  ): RaceCheckpointState | null {
    return this.engine.findNearUnsolvedCheckpoint(
      {
        x: playerWorldPos.x - this.group.position.x,
        z: playerWorldPos.z - this.group.position.z
      },
      radius
    );
  }

  public getRecoveryWorldPoint(): { x: number; y: number; z: number; heading: number } {
    const rec = this.engine.getRecoveryPoint();
    const y = this.sampleLocalGroundY(rec.x, rec.z, FARM_RACE_START_LOCAL.y);
    return {
      x: this.group.position.x + rec.x,
      y,
      z: this.group.position.z + rec.z,
      heading: rec.heading
    };
  }

  public getHudSnapshot(playerWorldPos: { x: number; z: number }, cameraYaw: number): FarmRaceHudSnapshot {
    return this.engine.buildHudSnapshot(
      {
        x: playerWorldPos.x - this.group.position.x,
        z: playerWorldPos.z - this.group.position.z
      },
      cameraYaw
    );
  }

  public getObstacles(_worldOrigin: { x: number; z: number }): Obstacle[] {
    return [];
  }

  public dispose(): void {
    this.focusBeamGroup = null;
    this.focusRingMesh = null;
    this.finishBarrierMesh = null;
    this.finishBarrierMat = null;
    this.finishLanternMat = null;
    this.playerStarMesh = null;
    this.playerAnimalEntity = null;
    this.aiAnimalEntities.clear();
    this.gateVisuals = [];
    this.sceneryGroup.clear();
    this.trackPropsGroup.clear();
    this.racersGroup.clear();
    this.terrainSurface = null;
    this.colliderGrid = null;
  }
}
