import * as THREE from 'three';
import { FarmAnimalEntity, type AnimalKind } from './FarmAnimalEntity';
import { generateFarmMultiplicationProblem } from '../../core/adventure';
import type { Obstacle } from '../SpatialWorld';
import { AssetRepository } from '../assets/AssetRepository';
import type { AssetRepositorySeam } from '../assets/types';
import { SceneBatchPool } from '../SceneBatchPool';
import {
  FARM_ANIMAL_ANCHORS_LOCAL,
  FARM_DIRECT_HOMEWARD_MAX_DIST,
  FARM_PEN_CENTER_LOCAL,
  FARM_PEN_ENTRY_LOCAL,
  FARM_REMOTE_HOMEWARD_WARP_SEC,
  FARM_SCALE,
  FARM_SHELTER_CENTERS,
  FARM_SKY_MATERIALS,
  FARM_WORLD_MODEL_OFFSET,
  isInsideFarmPenLocal,
  isWithinFarmPlayableBoundsLocal
} from '../../data/farmMap';
import { extractFarmTerrainFromScene, type FarmColliderGrid } from './FarmTerrain';
import type { RoadSurface } from '../qhmj/RoadSurface';

export interface FarmInteractTrigger {
  position: THREE.Vector3;
  radius: number;
  id: string;
  animalId: string;
  isActive: boolean;
  problemData: any;
}

export const SHELTER_CENTERS: Record<AnimalKind, { x: number; z: number }> = FARM_SHELTER_CENTERS;

export class FarmSanctuary {
  public group = new THREE.Group();
  public sceneryGroup = new THREE.Group();
  public animalsGroup = new THREE.Group();
  public animals: FarmAnimalEntity[] = [];
  public libraryScene?: THREE.Group;
  public worldScene?: THREE.Group;
  public terrainSurface: RoadSurface | null = null;
  public colliderGrid: FarmColliderGrid | null = null;
  public focusBeamGroup: THREE.Group | null = null;
  public onHomewardSparkle?: (worldPos: THREE.Vector3) => void;

  // Triggers for answering math problems
  public interactTriggers: FarmInteractTrigger[] = [];
  private triggerByAnimalId = new Map<string, FarmInteractTrigger>();
  private readonly scratchLocalPlayerPos = new THREE.Vector3();
  private readonly scratchSparklePos = new THREE.Vector3();
  private readonly scratchFallbackAnchor = new THREE.Vector3();
  private focusedAnimalId: string | null = null;
  private focusRingMesh: THREE.Mesh | null = null;
  private focusHaloMesh: THREE.Mesh | null = null;

  private readonly assets: AssetRepositorySeam;
  private time = 0;
  private disposed = false;
  private lastFarmRescued: Record<string, boolean> = {};

  constructor(assets?: AssetRepositorySeam, _batchPool?: SceneBatchPool) {
    this.assets = assets ?? new AssetRepository();
    this.sceneryGroup.name = 'farm_scenery';
    this.animalsGroup.name = 'farm_animals';
    this.group.add(this.sceneryGroup);
    this.group.add(this.animalsGroup);
  }

  public async load(farmRescued: Record<string, boolean>, questions?: any[]) {
    const [farmScene, worldScene] = await Promise.all([
      this.assets.instantiate('map:farm'),
      this.assets.instantiate('map:farm_world')
    ]);

    if (!farmScene) {
      throw new Error('Failed to load map:farm from AssetRepository');
    }

    this.setupFromLibrary(farmScene, farmRescued, questions, worldScene ?? undefined);
  }

  public setupFromLibrary(
    libraryScene: THREE.Group,
    farmRescued: Record<string, boolean> = {},
    questions?: any[],
    worldScene?: THREE.Group
  ) {
    this.disposed = false;
    this.libraryScene = libraryScene;
    this.worldScene = worldScene;
    this.lastFarmRescued = { ...farmRescued };

    // Reset groups & terrain state
    this.sceneryGroup.clear();
    this.animalsGroup.clear();
    this.animals = [];
    this.interactTriggers = [];
    this.triggerByAnimalId.clear();
    this.terrainSurface = null;
    this.colliderGrid = null;

    // Ensure shadows on source animal/shelter library meshes
    libraryScene.traverse((child) => {
      if ((child as any).isLight || (child as any).isCamera) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // 1. Mount countryside 3D world (maps/farm/scene.gltf) & extract terrain/colliders
    if (worldScene) {
      this.mountCountrysideWorld(worldScene);
    }

    // 2. Build open Central Farm Pen shelters on the flat eastern meadow
    this.buildScenery();

    // 3. Spawn and configure farm animals across scenic spots
    this.spawnAnimals(farmRescued, questions);
    this.syncFocusBeam(0);
  }

  private mountCountrysideWorld(worldScene: THREE.Group): void {
    worldScene.name = 'farm_world_terrain';
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
          // Giữ nguyên vòm trời mây xanh và tránh mất nét ở góc nhìn ngang
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

  /**
   * Tra độ cao mặt đất 3D theo tọa độ local (so với tâm `FarmSanctuary.group`).
   */
  public sampleLocalGroundY(localX: number, localZ: number, refY: number = FARM_PEN_CENTER_LOCAL.y): number {
    if (!this.terrainSurface) return 0;
    const wx = this.group.position.x + localX;
    const wz = this.group.position.z + localZ;
    return (
      this.terrainSurface.sample(wx, wz, refY, 4.0, 6.0)?.y ??
      this.terrainSurface.sampleNearest(wx, wz, refY)?.y ??
      0
    );
  }

  private isBlockedLocal(localX: number, localZ: number): boolean {
    if (!this.colliderGrid) return false;
    const wx = this.group.position.x + localX;
    const wz = this.group.position.z + localZ;
    return this.colliderGrid.isBlockedForAnimal(wx, wz);
  }

  private buildScenery() {
    if (!this.libraryScene) return;

    const placeProp = (name: string, x: number, z: number, rotationY = 0) => {
      const prop = this.instantiateProp(name);
      const y = this.sampleLocalGroundY(x, z, FARM_PEN_CENTER_LOCAL.y);
      prop.position.set(x, y, z);
      if (rotationY !== 0) prop.rotation.y = rotationY;
      this.sceneryGroup.add(prop);
    };

    // Khu Chuồng Trại Trung Tâm (không dựng vòng rào kín cũ, hòa hợp tự nhiên trước Nhà Kho Đỏ & Cối Xay Gió)
    // 1) Khu Gà: Coop, chicken shelter, egg basket
    placeProp('coop', 68.5, -39.5, 0.35);
    placeProp('chicken_shelter', 67.0, -37.2, 0.6);
    placeProp('egg_basket', 70.0, -38.5);

    // 2) Khu Bò: Cow shelter, feed trough, water trough, hay bales
    placeProp('cow_shelter', 76.5, -39.8, -0.35);
    placeProp('feed_trough', 74.2, -38.0);
    placeProp('water_trough', 75.6, -36.5, 0.2);
    placeProp('hay_bale', 77.2, -35.0, Math.PI / 2);
    placeProp('hay_bale', 77.5, -33.8, 0.3);

    // 3) Khu Heo: Pig shelter
    placeProp('pig_shelter', 73.0, -41.6);

    // 4) Khu Chó chăn cừu: Dog shelter
    placeProp('dog_shelter', 70.2, -42.0, 0.15);

    // 5) Khu Vịt: Duck shelter
    placeProp('duck_shelter', 70.8, -31.8, 0.8);
  }

  private instantiateProp(name: string): THREE.Object3D {
    const found = this.libraryScene?.children.find((c) => c.name === name);
    if (found) {
      const clone = found.clone(true);
      clone.name = name;
      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return clone;
    }

    // Fallback placeholder if prop is missing in mock or gltf
    const fallback = new THREE.Group();
    fallback.name = name;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
    );
    box.position.y = 0.4;
    fallback.add(box);
    return fallback;
  }

  public getObstacles(worldOrigin: { x: number; z: number }): Obstacle[] {
    const obs: Obstacle[] = [];
    const ox = worldOrigin.x;
    const oz = worldOrigin.z;

    const shelterObstacles: Array<[number, number, number]> = [
      [68.5, -39.5, 1.15], // coop
      [67.0, -37.2, 0.95], // chicken shelter
      [76.5, -39.8, 1.35], // cow shelter
      [74.2, -38.0, 0.8], // feed trough
      [75.6, -36.5, 0.8], // water trough
      [73.0, -41.6, 1.15], // pig shelter
      [70.2, -42.0, 0.95], // dog shelter
      [70.8, -31.8, 0.95] // duck shelter
    ];

    for (const [lx, lz, radius] of shelterObstacles) {
      obs.push({
        x: Number((ox + lx).toFixed(2)),
        z: Number((oz + lz).toFixed(2)),
        radius
      });
    }

    return obs;
  }

  private pickAnimalSpawnAnchor(index: number): { x: number; z: number } {
    const base = FARM_ANIMAL_ANCHORS_LOCAL[index % FARM_ANIMAL_ANCHORS_LOCAL.length];
    if (index < FARM_ANIMAL_ANCHORS_LOCAL.length) {
      return base;
    }
    const extraRing = Math.floor(index / FARM_ANIMAL_ANCHORS_LOCAL.length);
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = index * 2.1 + attempt * 0.78;
      const dist = 3.0 + extraRing * 1.8;
      const cx = base.x + Math.cos(angle) * dist;
      const cz = base.z + Math.sin(angle) * dist;
      if (
        isWithinFarmPlayableBoundsLocal(cx, cz) &&
        !isInsideFarmPenLocal(cx, cz, 1.0) &&
        !this.isBlockedLocal(cx, cz)
      ) {
        return { x: cx, z: cz };
      }
    }
    return base;
  }

  private spawnAnimals(farmRescued: Record<string, boolean>, questions?: any[]) {
    if (!this.libraryScene) return;

    const count = questions && questions.length > 0 ? questions.length : 10;
    const availableKinds: AnimalKind[] = ['cow', 'pig', 'chicken', 'duck', 'dog'];

    const lineup: AnimalKind[] = Array.from({ length: count }, (_, i) => {
      const qKind = questions?.[i]?.kind || questions?.[i]?.animalKind;
      if (qKind && (availableKinds as string[]).includes(qKind)) return qKind as AnimalKind;
      return availableKinds[i % availableKinds.length];
    });

    lineup.forEach((kind, i) => {
      const animalId = `farm_${kind}_${i}`;
      const entity = new FarmAnimalEntity(animalId, i, kind, this.libraryScene!);
      const isRescued = farmRescued?.[animalId] === true;
      const homeCenter = SHELTER_CENTERS[kind] || { x: FARM_PEN_CENTER_LOCAL.x, z: FARM_PEN_CENTER_LOCAL.z };

      if (isRescued) {
        // Rescued -> resting inside their specific shelter area
        entity.state = 'RESTING';
        entity.setBeaconVisible(false);
        const rx = homeCenter.x + (Math.random() - 0.5) * 1.4;
        const rz = homeCenter.z + (Math.random() - 0.5) * 1.4;
        const ry = this.sampleLocalGroundY(rx, rz, FARM_PEN_CENTER_LOCAL.y);
        entity.root.position.set(rx, ry, rz);
        entity.heading = Math.random() * Math.PI * 2;
        entity.targetPos = entity.root.position.clone();
      } else {
        // Escaped -> localized roaming around verified scenic anchor points
        entity.state = 'ROAMING';
        entity.setBeaconVisible(true);
        const anchor = this.pickAnimalSpawnAnchor(i);
        const ay = this.sampleLocalGroundY(anchor.x, anchor.z);
        entity.root.position.set(anchor.x, ay, anchor.z);
        entity.roamAnchor = entity.root.position.clone();
        entity.heading = Math.random() * Math.PI * 2;
        entity.targetPos = this.getRandomRoamPos(entity.roamAnchor);

        // Create interaction trigger for math challenge
        const problemData = this.buildAnimalProblemData(questions?.[i], i, kind);

        const trigger: FarmInteractTrigger = {
          position: entity.root.position.clone(),
          radius: 3.8,
          id: problemData.id || animalId,
          animalId: animalId,
          isActive: true,
          problemData
        };
        this.interactTriggers.push(trigger);
        this.triggerByAnimalId.set(animalId, trigger);
      }

      this.animalsGroup.add(entity.root);
      this.animals.push(entity);
    });
  }

  private buildAnimalProblemData(question: any, index: number, kind: AnimalKind) {
    const rawProblem = question ?? generateFarmMultiplicationProblem(index, kind);
    return {
      ...rawProblem,
      title: rawProblem.title || rawProblem.Title || `Bài ${index + 1}`,
      subtitle: rawProblem.subtitle || rawProblem.Subtitle || ''
    };
  }

  /**
   * Synchronizes farm animal challenge data when Google Sheets questions refresh.
   */
  public syncQuestions(questions?: any[]) {
    if (!this.libraryScene || !questions || questions.length === 0) return;

    if (questions.length !== this.animals.length) {
      this.animalsGroup.clear();
      this.animals = [];
      this.interactTriggers = [];
      this.triggerByAnimalId.clear();
      this.spawnAnimals(this.lastFarmRescued, questions);
      this.syncFocusBeam(0);
      return;
    }

    this.animals.forEach((animal, i) => {
      const trigger = this.triggerByAnimalId.get(animal.id);
      if (!trigger) return;
      const problemData = this.buildAnimalProblemData(questions[i], i, animal.kind);
      trigger.problemData = problemData;
      trigger.id = problemData.id || animal.id;
    });
    this.syncFocusBeam(0);
  }

  private ensureFocusBeam(): THREE.Group {
    if (this.focusBeamGroup) {
      return this.focusBeamGroup;
    }

    const beamGroup = new THREE.Group();
    beamGroup.name = 'farm_focus_beam';
    beamGroup.visible = false;

    const outerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.52, 12.5, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    outerBeam.position.y = 6.25;
    outerBeam.frustumCulled = false;

    const coreBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.16, 12.0, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    coreBeam.position.y = 6.0;
    coreBeam.frustumCulled = false;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.38, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    ring.frustumCulled = false;
    this.focusRingMesh = ring;

    const halo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    halo.position.y = 3.2;
    halo.frustumCulled = false;
    this.focusHaloMesh = halo;

    beamGroup.add(outerBeam, coreBeam, ring, halo);
    this.group.add(beamGroup);
    this.focusBeamGroup = beamGroup;
    return beamGroup;
  }

  /** Chọn con vật mục tiêu để dựng cột sáng 3D dẫn đường (hoặc `null` để ẩn). */
  public setFocusedAnimal(animalId: string | null): void {
    this.focusedAnimalId = animalId;
    this.syncFocusBeam(0);
  }

  public getFocusedAnimalId(): string | null {
    return this.focusedAnimalId;
  }

  private syncFocusBeam(dt: number): void {
    const target = this.focusedAnimalId
      ? this.animals.find(
          (a) => a.id === this.focusedAnimalId && this.triggerByAnimalId.get(a.id)?.isActive === true
        ) ?? null
      : null;

    if (!target) {
      if (this.focusBeamGroup) {
        this.focusBeamGroup.visible = false;
      }
      return;
    }

    const beam = this.ensureFocusBeam();
    beam.visible = true;
    beam.position.copy(target.root.position);

    if (this.focusRingMesh) {
      const pulse = 1 + Math.sin(this.time * 4.5) * 0.12;
      this.focusRingMesh.scale.set(pulse, pulse, 1);
    }
    if (this.focusHaloMesh) {
      this.focusHaloMesh.position.y = 3.2 + Math.sin(this.time * 3.2) * 0.25;
      this.focusHaloMesh.rotation.y += dt * 2.1;
    }
  }

  public getInteractTriggers() {
    return this.interactTriggers;
  }

  public findAnimalAtRay(ray: THREE.Raycaster): FarmAnimalEntity | null {
    this.animalsGroup.updateMatrixWorld(true);
    const hitCandidates: THREE.Object3D[] = [];
    for (const a of this.animals) {
      hitCandidates.push(a.root);
    }

    const hits = ray.intersectObjects(hitCandidates, true);
    if (hits.length > 0) {
      const hitObj = hits[0].object;
      return (
        this.animals.find((a) => {
          let curr: THREE.Object3D | null = hitObj;
          while (curr) {
            if (curr === a.root) return true;
            curr = curr.parent;
          }
          return false;
        }) || null
      );
    }
    return null;
  }

  public findAnimalNearPoint(localPoint: THREE.Vector3, maxDistance = 2.5): FarmAnimalEntity | null {
    let closest: FarmAnimalEntity | null = null;
    let minDist = maxDistance;

    for (const animal of this.animals) {
      const dist = Math.hypot(
        animal.root.position.x - localPoint.x,
        animal.root.position.z - localPoint.z
      );
      if (dist < minDist) {
        minDist = dist;
        closest = animal;
      }
    }

    return closest;
  }

  public onAnimalRescued(animalId: string) {
    const animal = this.animals.find((a) => a.id === animalId);
    if (animal) {
      animal.setBeaconVisible(false);
      animal.state = 'ENGAGED';
      animal.pop = 0; // Trigger celebration jump/pop
      const homeCenter = SHELTER_CENTERS[animal.kind] || { x: FARM_PEN_CENTER_LOCAL.x, z: FARM_PEN_CENTER_LOCAL.z };
      setTimeout(() => {
        if (this.disposed) return;
        animal.state = 'HOMEWARD';
        animal.homewardElapsed = 0;
        const gateY = this.sampleLocalGroundY(FARM_PEN_ENTRY_LOCAL.x, FARM_PEN_ENTRY_LOCAL.z, animal.root.position.y);
        animal.shelterGate = new THREE.Vector3(FARM_PEN_ENTRY_LOCAL.x, gateY, FARM_PEN_ENTRY_LOCAL.z);
        const sx = homeCenter.x + (Math.random() - 0.5) * 1.4;
        const sz = homeCenter.z + (Math.random() - 0.5) * 1.4;
        const sy = this.sampleLocalGroundY(sx, sz, gateY);
        animal.shelterPos = new THREE.Vector3(sx, sy, sz);
        animal.homewardStartDist = Math.hypot(
          animal.root.position.x - animal.shelterGate.x,
          animal.root.position.z - animal.shelterGate.z
        );
        animal.targetPos = animal.shelterGate;
      }, 1500);
    }

    const trigger = this.interactTriggers.find((t) => t.animalId === animalId);
    if (trigger) {
      trigger.isActive = false;
    }
    this.syncFocusBeam(0);
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    this.time += dt;

    // Convert world player position into Farm local space without allocating per tick
    const localPlayerPos = this.scratchLocalPlayerPos.copy(playerPos).sub(this.group.position);

    for (const animal of this.animals) {
      const pos = animal.root.position;

      if (animal.state === 'ROAMING' || animal.state === 'HOMEWARD') {
        const homeCenter = SHELTER_CENTERS[animal.kind] || { x: FARM_PEN_CENTER_LOCAL.x, z: FARM_PEN_CENTER_LOCAL.z };
        if (!animal.targetPos) {
          animal.targetPos =
            animal.state === 'ROAMING'
              ? this.getRandomRoamPos(animal.roamAnchor ?? pos)
              : (animal.shelterGate || new THREE.Vector3(homeCenter.x, pos.y, homeCenter.z));
        }

        if (animal.state === 'HOMEWARD') {
          animal.homewardElapsed += dt;
          if (
            animal.shelterGate &&
            animal.targetPos === animal.shelterGate &&
            animal.homewardStartDist > FARM_DIRECT_HOMEWARD_MAX_DIST &&
            animal.homewardElapsed >= FARM_REMOTE_HOMEWARD_WARP_SEC
          ) {
            this.scratchSparklePos.set(
              this.group.position.x + pos.x,
              pos.y + 0.8,
              this.group.position.z + pos.z
            );
            this.onHomewardSparkle?.(this.scratchSparklePos);
            pos.copy(animal.shelterGate);
            if (animal.speed > 0 || animal.state === 'HOMEWARD') {
          pos.y = this.sampleLocalGroundY(pos.x, pos.z, pos.y);
        }
            this.scratchSparklePos.set(
              this.group.position.x + pos.x,
              pos.y + 0.8,
              this.group.position.z + pos.z
            );
            this.onHomewardSparkle?.(this.scratchSparklePos);
            animal.targetPos = animal.shelterPos ?? animal.shelterGate;
          }
        }

        const horizDist = Math.hypot(animal.targetPos.x - pos.x, animal.targetPos.z - pos.z);
        if (horizDist < 1.25) {
          if (animal.state === 'HOMEWARD') {
            if (animal.shelterGate && animal.targetPos === animal.shelterGate && animal.shelterPos) {
              // Reached pen entry -> walk towards species shelter
              animal.targetPos = animal.shelterPos;
            } else {
              animal.state = 'RESTING';
              animal.speed = 0;
              animal.restTime = 4 + Math.random() * 4;
              animal.shelterGate = undefined;
            }
          } else {
            animal.restTime = 2 + Math.random() * 5;
            animal.targetPos = undefined;
            animal.speed = 0;
          }
        } else {
          const angleToTarget = Math.atan2(animal.targetPos.x - pos.x, animal.targetPos.z - pos.z);
          const diff = this.normalizeAngle(angleToTarget - animal.heading);
          animal.heading += diff * dt * 3;
          animal.speed = animal.state === 'HOMEWARD' ? 4.2 : 1.3;

          const nextX = pos.x + Math.sin(animal.heading) * animal.speed * dt;
          const nextZ = pos.z + Math.cos(animal.heading) * animal.speed * dt;

          if (animal.state === 'ROAMING') {
            const outOfBounds = !isWithinFarmPlayableBoundsLocal(nextX, nextZ);
            const insidePen = isInsideFarmPenLocal(nextX, nextZ, 0.5);
            const blocked = this.isBlockedLocal(nextX, nextZ);
            if (outOfBounds || insidePen || blocked) {
              const anchor = animal.roamAnchor ?? pos;
              animal.targetPos = this.getRandomRoamPos(anchor);
              animal.heading = Math.atan2(animal.targetPos.x - pos.x, animal.targetPos.z - pos.z);
              animal.speed = 0;
              animal.restTime = 0.6;
            } else {
              pos.x = nextX;
              pos.z = nextZ;
            }
          } else {
            pos.x = nextX;
            pos.z = nextZ;
          }
        }

        // Hard perimeter defense: unrescued animals must never enter the Central Farm Pen
        if (animal.state === 'ROAMING' && isInsideFarmPenLocal(pos.x, pos.z)) {
          const dx = pos.x - FARM_PEN_CENTER_LOCAL.x;
          const dz = pos.z - FARM_PEN_CENTER_LOCAL.z;
          const d = Math.hypot(dx, dz) || 1;
          const pushR = 10.8;
          pos.x = FARM_PEN_CENTER_LOCAL.x + (dx / d) * pushR;
          pos.z = FARM_PEN_CENTER_LOCAL.z + (dz / d) * pushR;
          animal.heading = Math.atan2(dx, dz);
          animal.targetPos = this.getRandomRoamPos(animal.roamAnchor ?? pos);
        }

        if (animal.speed > 0 || animal.state === 'HOMEWARD') {
          pos.y = this.sampleLocalGroundY(pos.x, pos.z, pos.y);
        }

        if (animal.restTime > 0) {
          animal.restTime -= dt;
          animal.speed = 0;
          if (animal.restTime > 1) {
            if (animal.kind.includes('chicken') || animal.kind.includes('duck')) {
              animal.peck = Math.sin(this.time * 8) > 0.5 ? 1 : 0;
              animal.graze = 0;
            } else {
              animal.graze = Math.min(1, animal.graze + dt * 2);
              animal.peck = 0;
            }
          }
        } else {
          animal.graze = Math.max(0, animal.graze - dt * 2);
          animal.peck = 0;
        }
      } else if (animal.state === 'RESTING') {
        animal.speed = 0;
        animal.restTime -= dt;
        if (animal.restTime <= 0) {
          // Wander gently inside home shelter area
          const homeCenter = SHELTER_CENTERS[animal.kind] || { x: FARM_PEN_CENTER_LOCAL.x, z: FARM_PEN_CENTER_LOCAL.z };
          animal.state = 'HOMEWARD';
          animal.homewardElapsed = 0;
          animal.homewardStartDist = 0;
          animal.shelterGate = undefined;
          const wx = homeCenter.x + (Math.random() - 0.5) * 1.8;
          const wz = homeCenter.z + (Math.random() - 0.5) * 1.8;
          const wy = this.sampleLocalGroundY(wx, wz, pos.y);
          if (animal.targetPos) {
            animal.targetPos.set(wx, wy, wz);
          } else {
            animal.targetPos = new THREE.Vector3(wx, wy, wz);
          }
        }
      } else if (animal.state === 'ENGAGED') {
        // Look directly at player
        const angleToTarget = Math.atan2(localPlayerPos.x - pos.x, localPlayerPos.z - pos.z);
        const diff = this.normalizeAngle(angleToTarget - animal.heading);
        animal.heading += diff * dt * 5;
        animal.speed = 0;
        animal.graze = 0;
        animal.peck = 0;
        pos.y = this.sampleLocalGroundY(pos.x, pos.z, pos.y);
      }

      // Pop celebration
      if (animal.pop < 1) animal.pop += dt * 1.5;

      // Update rotation
      animal.root.rotation.y = animal.heading;

      // Synchronize trigger position to match current 3D animal location
      const trigger = this.triggerByAnimalId.get(animal.id);
      if (trigger && trigger.isActive) {
        trigger.position.copy(pos);
      }

      // Procedural walking/head/legs/beacon animation
      animal.updateAnimation(dt, this.time);
    }

    this.syncFocusBeam(dt);
  }

  private getRandomRoamPos(anchor?: THREE.Vector3): THREE.Vector3 {
    const base = anchor && (anchor.x !== 0 || anchor.z !== 0)
      ? anchor
      : this.scratchFallbackAnchor.set(FARM_ANIMAL_ANCHORS_LOCAL[0].x, 0, FARM_ANIMAL_ANCHORS_LOCAL[0].z);

    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 2.0 + Math.random() * 6.5;
      const px = base.x + Math.cos(angle) * r;
      const pz = base.z + Math.sin(angle) * r;
      if (
        isWithinFarmPlayableBoundsLocal(px, pz) &&
        !isInsideFarmPenLocal(px, pz, 1.0) &&
        !this.isBlockedLocal(px, pz)
      ) {
        const py = this.sampleLocalGroundY(px, pz, base.y);
        return new THREE.Vector3(px, py, pz);
      }
    }

    const fallbackY = this.sampleLocalGroundY(base.x, base.z, base.y);
    return new THREE.Vector3(base.x, fallbackY, base.z);
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  public dispose(): void {
    this.disposed = true;
    this.focusedAnimalId = null;
    if (this.focusBeamGroup) {
      this.group.remove(this.focusBeamGroup);
      this.focusBeamGroup = null;
    }
    this.focusRingMesh = null;
    this.focusHaloMesh = null;
    this.sceneryGroup.clear();
    this.animalsGroup.clear();
    this.animals = [];
    this.interactTriggers = [];
    this.triggerByAnimalId.clear();
    this.terrainSurface = null;
    this.colliderGrid = null;
  }
}
