import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FarmAnimalEntity, AnimalKind } from './FarmAnimalEntity';
import { generateFarmMultiplicationProblem } from '../../core/adventure';
import type { Obstacle } from '../SpatialWorld';

export interface FarmInteractTrigger {
  position: THREE.Vector3;
  radius: number;
  id: string;
  animalId: string;
  isActive: boolean;
  problemData: any;
}

export const SHELTER_CENTERS: Record<AnimalKind, { x: number; z: number }> = {
  cow: { x: 3.2, z: -1.5 },
  calf: { x: 2.5, z: -1.0 },
  chicken: { x: -3.0, z: -1.2 },
  chick: { x: -3.5, z: -0.5 },
  duck: { x: -2.0, z: 2.8 },
  duckling: { x: -1.5, z: 3.2 },
  pig: { x: 0.2, z: -2.2 },
  piglet: { x: 0.8, z: -2.0 },
  dog: { x: -1.5, z: -2.5 }
};

export class FarmSanctuary {
  public group = new THREE.Group();
  public sceneryGroup = new THREE.Group();
  public animalsGroup = new THREE.Group();
  public animals: FarmAnimalEntity[] = [];
  public libraryScene?: THREE.Group;
  public parkLibrary?: THREE.Group;
  public floraPrefabs: THREE.Object3D[] = [];
  public bushPrefab?: THREE.Object3D;

  // Triggers for answering math problems
  public interactTriggers: FarmInteractTrigger[] = [];

  private modelLoader = new GLTFLoader();
  private time = 0;

  constructor() {
    this.sceneryGroup.name = 'farm_scenery';
    this.animalsGroup.name = 'farm_animals';
    this.group.add(this.sceneryGroup);
    this.group.add(this.animalsGroup);
  }

  public async load(farmRescued: Record<string, boolean>, questions?: any[]) {
    const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    const loadSafe = async (relPath: string): Promise<THREE.Group | null> => {
      try {
        const gltf = await this.modelLoader.loadAsync(`${cleanBase}${relPath}`);
        return gltf.scene;
      } catch (e) {
        return null;
      }
    };
    
    const [farmGltf, grass02, grass03, flowers02, flowers03, bush02] = await Promise.all([
      this.modelLoader.loadAsync(`${cleanBase}3dmodel/maps/farm.glb`),
      loadSafe('3dmodel/prefabs/park_grass002.glb'),
      loadSafe('3dmodel/prefabs/park_grass003.glb'),
      loadSafe('3dmodel/prefabs/park_flowers002.glb'),
      loadSafe('3dmodel/prefabs/park_flowers003.glb'),
      loadSafe('3dmodel/prefabs/park_bush002.glb')
    ]);

    if (bush02) {
      this.bushPrefab = bush02;
    }

    this.floraPrefabs = [grass02, grass03, flowers02, flowers03].filter(
      (m): m is THREE.Group => m !== null
    );

    this.setupFromLibrary(farmGltf.scene, farmRescued, questions);
  }




  public setupFromLibrary(
    libraryScene: THREE.Group,
    farmRescued: Record<string, boolean> = {},
    questions?: any[]
  ) {
    this.libraryScene = libraryScene;

    // Reset groups
    this.sceneryGroup.clear();
    this.animalsGroup.clear();
    this.animals = [];
    this.interactTriggers = [];

    // Ensure shadows on source library meshes
    libraryScene.traverse((child) => {
      if ((child as any).isLight || (child as any).isCamera) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // 1. Build modular open scenery (inspired by cute_game)
    this.buildScenery();

    // 2. Spawn and configure the 10 farm animals
    this.spawnAnimals(farmRescued, questions);
  }

  private buildScenery() {
    if (!this.libraryScene) return;

    // A. Sandy / Farm Soil Yard Floor (front and sides stay open, no full perimeter fences)
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 32),
      new THREE.MeshStandardMaterial({
        color: 0xdfc588,
        roughness: 0.9,
        metalness: 0.05
      })
    );
    floor.name = 'yard_floor';
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    this.sceneryGroup.add(floor);

    // B. Duck Pond & Rim
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(2.0, 24),
      new THREE.MeshStandardMaterial({
        color: 0x48b8cf,
        roughness: 0.2,
        metalness: 0.1
      })
    );
    pond.name = 'duck_pond';
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-2.2, 0.03, 3.2);
    pond.receiveShadow = true;
    this.sceneryGroup.add(pond);

    const pondRim = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.2, 24),
      new THREE.MeshStandardMaterial({
        color: 0x93d9b8,
        roughness: 0.9
      })
    );
    pondRim.name = 'duck_pond_rim';
    pondRim.rotation.x = -Math.PI / 2;
    pondRim.position.set(-2.2, 0.025, 3.2);
    this.sceneryGroup.add(pondRim);

    // C. Fences around the pen (Rectangle ~10x8m)
    // Front: gate in middle, fences on sides
    const gate = this.instantiateProp('pen_gate');
    gate.position.set(0, 0, 4);
    this.sceneryGroup.add(gate);

    for (const x of [-4, -2, 2, 4]) {
      const fence = this.instantiateProp('pen_fence');
      fence.position.set(x, 0, 4);
      this.sceneryGroup.add(fence);
    }
    // Back:
    for (let x = -4; x <= 4; x += 2) {
      const fence = this.instantiateProp('pen_fence');
      fence.position.set(x, 0, -4);
      this.sceneryGroup.add(fence);
    }
    // Sides:
    for (let z = -2; z <= 2; z += 2) {
      const fenceL = this.instantiateProp('pen_fence');
      fenceL.position.set(-5, 0, z);
      fenceL.rotation.y = Math.PI / 2;
      this.sceneryGroup.add(fenceL);

      const fenceR = this.instantiateProp('pen_fence');
      fenceR.position.set(5, 0, z);
      fenceR.rotation.y = -Math.PI / 2;
      this.sceneryGroup.add(fenceR);
    }

    // Decorate with flora (Grass, Flowers, Bushes outside the fence)
    const floraPool: THREE.Object3D[] = [];

    // 1. From pre-loaded GLB prefabs (grass, flowers)
    for (const prefab of this.floraPrefabs) {
      if (!prefab.name.toLowerCase().includes('bush')) {
        floraPool.push(prefab);
      }
    }

    // 2. Only if prefabs not loaded, fallback to parkLibrary
    if (floraPool.length === 0 && this.parkLibrary) {
      const floraNames = [
        'Grass002', 'Grass003', 'Grass004', 'Grass005', 'Grass006',
        'Flowers002', 'Flowers003', 'Flowers004', 'Flowers005'
      ];
      for (const name of floraNames) {
        const extracted = this.extractFloraFromPark(name);
        if (extracted) {
          floraPool.push(extracted);
        }
      }
    }

    // 3. Fallback procedural flora
    if (floraPool.length === 0) {
      floraPool.push(this.createProceduralGrassCluster());
      floraPool.push(this.createProceduralFlowerCluster());
    }

    // Distribute 140 flora clusters covering the entire pasture from 6.2m to 28.5m
    for (let i = 0; i < 140; i++) {
      const template = floraPool[Math.floor(Math.random() * floraPool.length)];
      const prop = template.clone(true);
      prop.name = template.name || `flora_${i}`;

      const t = i / 140;
      const angle = t * Math.PI * 2 * 9 + (Math.random() - 0.5) * 0.5;
      const radius = 6.2 + Math.sqrt(Math.random()) * 22.3;
      let px = Math.cos(angle) * radius;
      let pz = Math.sin(angle) * radius;

      // Ensure never placed inside pen rectangle
      if (Math.abs(px) < 5.6 && Math.abs(pz) < 4.6) {
        if (Math.abs(px) / 5.6 > Math.abs(pz) / 4.6) {
          px = (px >= 0 ? 1 : -1) * 6.2;
        } else {
          pz = (pz >= 0 ? 1 : -1) * 5.2;
        }
      }

      prop.position.set(px, 0.02, pz);
      prop.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.45 + Math.random() * 0.45;
      prop.scale.set(s, s, s);

      prop.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.sceneryGroup.add(prop);
    }

    // E. Perimeter Bush002 hedge surrounding the entire farm island
    const bushTemplate =
      this.bushPrefab ||
      (this.parkLibrary ? this.extractFloraFromPark('Bush002') : null) ||
      this.createProceduralBush();

    const perimeterBushCount = 80;
    const perimeterRadius = 30.5;

    for (let i = 0; i < perimeterBushCount; i++) {
      const angle = (i / perimeterBushCount) * Math.PI * 2;
      const bush = bushTemplate.clone(true);
      bush.name = `perimeter_bush_${i}`;

      const r = perimeterRadius + (Math.random() - 0.5) * 0.5;
      const bx = Math.cos(angle) * r;
      const bz = Math.sin(angle) * r;
      bush.position.set(bx, 0.02, bz);
      bush.rotation.y = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.35;
      const scale = 1.0 + Math.random() * 0.25;
      bush.scale.set(scale, scale, scale);

      bush.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.sceneryGroup.add(bush);
    }



    // D. Modular shelters and accessories
    // 1) Chicken area: Coop, chicken shelter, egg basket
    const coop = this.instantiateProp('coop');
    coop.position.set(-3.5, 0, -1.8);
    coop.rotation.y = 0.35;
    this.sceneryGroup.add(coop);

    const chickenShelter = this.instantiateProp('chicken_shelter');
    chickenShelter.position.set(-5.2, 0, 0.5);
    chickenShelter.rotation.y = 0.6;
    this.sceneryGroup.add(chickenShelter);

    const eggBasket = this.instantiateProp('egg_basket');
    eggBasket.position.set(-2.2, 0, -1.0);
    this.sceneryGroup.add(eggBasket);

    // 2) Cow area: Cow shelter, feed trough, water trough, hay bales
    const cowShelter = this.instantiateProp('cow_shelter');
    cowShelter.position.set(3.8, 0, -2.5);
    cowShelter.rotation.y = -0.2;
    this.sceneryGroup.add(cowShelter);

    const feedTrough = this.instantiateProp('feed_trough');
    feedTrough.position.set(1.6, 0, -1.8);
    this.sceneryGroup.add(feedTrough);

    const waterTrough = this.instantiateProp('water_trough');
    waterTrough.position.set(3.2, 0, -0.5);
    waterTrough.rotation.y = 0.2;
    this.sceneryGroup.add(waterTrough);

    const hayBale1 = this.instantiateProp('hay_bale');
    hayBale1.position.set(4.5, 0, 1.0);
    hayBale1.rotation.y = Math.PI / 2;
    this.sceneryGroup.add(hayBale1);

    const hayBale2 = this.instantiateProp('hay_bale');
    hayBale2.position.set(4.8, 0, 2.0);
    hayBale2.rotation.y = 0.3;
    this.sceneryGroup.add(hayBale2);

    // 3) Pig area: Pig shelter
    const pigShelter = this.instantiateProp('pig_shelter');
    pigShelter.position.set(0, 0, -3.2);
    this.sceneryGroup.add(pigShelter);

    // 4) Dog area: Dog shelter
    const dogShelter = this.instantiateProp('dog_shelter');
    dogShelter.position.set(-1.8, 0, -3.2);
    dogShelter.rotation.y = 0.1;
    this.sceneryGroup.add(dogShelter);

    // 5) Duck area: Duck shelter right beside pond
    const duckShelter = this.instantiateProp('duck_shelter');
    duckShelter.position.set(-3.8, 0, 3.2);
    duckShelter.rotation.y = 0.8;
    this.sceneryGroup.add(duckShelter);
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

    // 1. Back Fence Wall: z = -4, x from -5 to 5
    for (let x = -5; x <= 5; x += 1.0) {
      obs.push({ x: Number((ox + x).toFixed(2)), z: Number((oz - 4).toFixed(2)), radius: 0.65 });
    }

    // 2. Left Fence Wall: x = -5, z from -4 to 4
    for (let z = -4; z <= 4; z += 1.0) {
      obs.push({ x: Number((ox - 5).toFixed(2)), z: Number((oz + z).toFixed(2)), radius: 0.65 });
    }

    // 3. Right Fence Wall: x = 5, z from -4 to 4
    for (let z = -4; z <= 4; z += 1.0) {
      obs.push({ x: Number((ox + 5).toFixed(2)), z: Number((oz + z).toFixed(2)), radius: 0.65 });
    }

    // 4. Front Fence Wall: z = 4
    // Left segment: x from -5 to -1.4
    for (let x = -5; x <= -1.4; x += 0.9) {
      obs.push({ x: Number((ox + x).toFixed(2)), z: Number((oz + 4).toFixed(2)), radius: 0.65 });
    }
    // Right segment: x from 1.4 to 5
    for (let x = 1.4; x <= 5; x += 0.9) {
      obs.push({ x: Number((ox + x).toFixed(2)), z: Number((oz + 4).toFixed(2)), radius: 0.65 });
    }
    // (Gate opening between x = -1.3 and 1.3 at z = 4 is open for player passage)

    // 5. Farm Shelters and Pond inside the pen
    obs.push({ x: Number((ox - 3.5).toFixed(2)), z: Number((oz - 1.8).toFixed(2)), radius: 1.2 }); // coop
    obs.push({ x: Number((ox - 5.2).toFixed(2)), z: Number((oz + 0.5).toFixed(2)), radius: 1.0 }); // chicken shelter
    obs.push({ x: Number((ox + 3.8).toFixed(2)), z: Number((oz - 2.5).toFixed(2)), radius: 1.4 }); // cow shelter
    obs.push({ x: Number((ox + 0.0).toFixed(2)), z: Number((oz - 3.2).toFixed(2)), radius: 1.2 }); // pig shelter
    obs.push({ x: Number((ox - 1.8).toFixed(2)), z: Number((oz - 3.2).toFixed(2)), radius: 1.0 }); // dog shelter
    obs.push({ x: Number((ox - 3.8).toFixed(2)), z: Number((oz + 3.2).toFixed(2)), radius: 1.0 }); // duck shelter
    obs.push({ x: Number((ox - 2.2).toFixed(2)), z: Number((oz + 3.2).toFixed(2)), radius: 1.6 }); // duck pond

    // 6. Perimeter Bush Hedge: radius 30.5m
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      const bx = ox + Math.cos(angle) * 30.5;
      const bz = oz + Math.sin(angle) * 30.5;
      obs.push({ x: Number(bx.toFixed(2)), z: Number(bz.toFixed(2)), radius: 0.9 });
    }

    return obs;
  }

  private extractFloraFromPark(name: string): THREE.Object3D | null {
    if (!this.parkLibrary) return null;
    const foundNode = this.parkLibrary.getObjectByName(name);
    if (!foundNode) return null;

    const wrapper = new THREE.Group();
    wrapper.name = name;

    const clone = foundNode.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    // If raw coordinates from park.glb FBX
    if (size.x > 10 || size.z > 10 || size.y > 10) {
      clone.rotation.x = -Math.PI / 2;
      const fbxBox = new THREE.Box3().setFromObject(clone);
      const fbxCenter = new THREE.Vector3();
      fbxBox.getCenter(fbxCenter);
      clone.position.sub(new THREE.Vector3(fbxCenter.x, fbxBox.min.y, fbxCenter.z));
      wrapper.scale.setScalar(0.01);
    } else {
      clone.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 2.0) {
        wrapper.scale.setScalar(1.2 / maxDim);
      }
    }

    wrapper.add(clone);
    return wrapper;
  }

  private createProceduralGrassCluster(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Grass002';
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5ea338,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6 + Math.random() * 0.3, 4), mat);
      blade.position.set((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4);
      blade.rotation.z = (Math.random() - 0.5) * 0.4;
      blade.rotation.x = (Math.random() - 0.5) * 0.4;
      blade.castShadow = true;
      group.add(blade);
    }
    return group;
  }

  private createProceduralFlowerCluster(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Flowers002';
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d7a22, roughness: 0.9 });
    const petalColors = [0xf59e0b, 0xec4899, 0xef4444, 0x8b5cf6, 0xffffff];
    const petalMat = new THREE.MeshStandardMaterial({
      color: petalColors[Math.floor(Math.random() * petalColors.length)],
      roughness: 0.5
    });
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 });

    for (let i = 0; i < 3; i++) {
      const fx = (Math.random() - 0.5) * 0.5;
      const fz = (Math.random() - 0.5) * 0.5;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), stemMat);
      stem.position.set(fx, 0.2, fz);
      group.add(stem);

      const center = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), centerMat);
      center.position.set(fx, 0.42, fz);
      group.add(center);

      const petal = new THREE.Mesh(new THREE.CircleGeometry(0.12, 6), petalMat);
      petal.position.set(fx, 0.42, fz);
      petal.rotation.x = -Math.PI / 2;
      group.add(petal);
    }
    return group;
  }

  private createProceduralBush(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Bush002';
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3b7a2d,
      roughness: 0.85
    });
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 1), mat);
    mesh.position.y = 0.55;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
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
      const homeCenter = SHELTER_CENTERS[kind] || { x: 0, z: 0 };

      if (isRescued) {
        // Rescued -> resting inside their specific shelter area
        entity.state = 'RESTING';
        entity.root.position.set(
          homeCenter.x + (Math.random() - 0.5) * 1.8,
          0,
          homeCenter.z + (Math.random() - 0.5) * 1.8
        );
        entity.heading = Math.random() * Math.PI * 2;
        entity.targetPos = entity.root.position.clone();
      } else {
        // Escaped -> roaming outside in the surrounding pasture across radius 9.5m - 25m
        entity.state = 'ROAMING';
        const angle = (i / lineup.length) * Math.PI * 2 + 0.3;
        const ring = i % 4;
        const radius = 9.5 + ring * 4.2 + (Math.random() - 0.5) * 1.5;
        entity.root.position.set(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        if (Math.abs(entity.root.position.x) < 5.6 && Math.abs(entity.root.position.z) < 4.6) {
          entity.root.position.x = (entity.root.position.x >= 0 ? 1 : -1) * 6.5;
        }

        entity.heading = Math.random() * Math.PI * 2;
        entity.targetPos = this.getRandomRoamPos(entity.root.position);

        // Create interaction trigger for math challenge
        const problemData =
          questions && questions[i]
            ? questions[i]
            : generateFarmMultiplicationProblem(i, kind);

        this.interactTriggers.push({
          position: entity.root.position.clone(),
          radius: 3.5,
          id: problemData.id || animalId,
          animalId: animalId,
          isActive: true,
          problemData
        });
      }


      this.animalsGroup.add(entity.root);
      this.animals.push(entity);
    });
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
      const dist = animal.root.position.distanceTo(localPoint);
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
      animal.state = 'ENGAGED';
      animal.pop = 0; // Trigger celebration jump/pop
      const homeCenter = SHELTER_CENTERS[animal.kind] || { x: 0, z: 0 };
      setTimeout(() => {
        animal.state = 'HOMEWARD';
        animal.shelterGate = new THREE.Vector3(0, 0, 4.5);
        animal.shelterPos = new THREE.Vector3(
          homeCenter.x + (Math.random() - 0.5) * 1.5,
          0,
          homeCenter.z + (Math.random() - 0.5) * 1.5
        );
        animal.targetPos = animal.shelterGate;
      }, 1500);
    }

    const trigger = this.interactTriggers.find((t) => t.animalId === animalId);
    if (trigger) {
      trigger.isActive = false;
    }
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    this.time += dt;

    // Convert world player position into Farm local space for accurate look-at
    const localPlayerPos = new THREE.Vector3().copy(playerPos).sub(this.group.position);

    for (const animal of this.animals) {
      const pos = animal.root.position;

      if (animal.state === 'ROAMING' || animal.state === 'HOMEWARD') {
        const homeCenter = SHELTER_CENTERS[animal.kind] || { x: 0, z: 0 };
        if (!animal.targetPos) {
          animal.targetPos =
            animal.state === 'ROAMING'
              ? this.getRandomRoamPos(pos)
              : (animal.shelterGate || new THREE.Vector3(homeCenter.x, 0, homeCenter.z));
        }

        const dist = pos.distanceTo(animal.targetPos);
        if (dist < 1.2) {
          if (animal.state === 'HOMEWARD') {
            if (animal.shelterGate && animal.targetPos === animal.shelterGate && animal.shelterPos) {
              // Reached front gate -> enter towards internal species shelter
              animal.targetPos = animal.shelterPos;
            } else {
              animal.state = 'RESTING';
              animal.speed = 0;
              animal.restTime = 4 + Math.random() * 4;
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
          animal.speed = animal.state === 'HOMEWARD' ? 3.5 : 1.2;

          const nextX = pos.x + Math.sin(animal.heading) * animal.speed * dt;
          const nextZ = pos.z + Math.cos(animal.heading) * animal.speed * dt;

          if (animal.state === 'ROAMING' && Math.abs(nextX) < 5.5 && Math.abs(nextZ) < 4.5) {
            // Unrescued animal blocked from entering pen boundary
            animal.targetPos = this.getRandomRoamPos(pos);
            animal.heading = Math.atan2(pos.x, pos.z);
            animal.speed = 0;
            animal.restTime = 1.0;
          } else {
            pos.x = nextX;
            pos.z = nextZ;
          }
        }

        // Hard perimeter defense: unrescued animals must never be inside pen
        if (animal.state === 'ROAMING') {
          const penX = 5.5;
          const penZ = 4.5;
          if (Math.abs(pos.x) < penX && Math.abs(pos.z) < penZ) {
            if (Math.abs(pos.x) / penX > Math.abs(pos.z) / penZ) {
              pos.x = (pos.x >= 0 ? 1 : -1) * (penX + 0.6);
            } else {
              pos.z = (pos.z >= 0 ? 1 : -1) * (penZ + 0.6);
            }
            animal.heading = Math.atan2(pos.x, pos.z);
            animal.targetPos = this.getRandomRoamPos(pos);
          }
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
          // Wander slightly inside home shelter area
          const homeCenter = SHELTER_CENTERS[animal.kind] || { x: 0, z: 0 };
          animal.state = 'HOMEWARD';
          animal.targetPos = new THREE.Vector3(
            homeCenter.x + (Math.random() - 0.5) * 2.0,
            0,
            homeCenter.z + (Math.random() - 0.5) * 2.0
          );
        }
      } else if (animal.state === 'ENGAGED') {
        // Look directly at player
        const angleToTarget = Math.atan2(localPlayerPos.x - pos.x, localPlayerPos.z - pos.z);
        const diff = this.normalizeAngle(angleToTarget - animal.heading);
        animal.heading += diff * dt * 5;
        animal.speed = 0;
        animal.graze = 0;
        animal.peck = 0;
      }

      // Pop celebration
      if (animal.pop < 1) animal.pop += dt * 1.5;

      // Update rotation
      animal.root.rotation.y = animal.heading;

      // Synchronize trigger position to match current animal location
      const trigger = this.interactTriggers.find((t) => t.animalId === animal.id);
      if (trigger && trigger.isActive) {
        trigger.position.copy(pos);
      }

      // Procedural walking/head/legs animation
      animal.updateAnimation(dt, this.time);
    }
  }

  private getRandomRoamPos(currentPos?: THREE.Vector3): THREE.Vector3 {
    let px = 0;
    let pz = 0;

    if (currentPos && (currentPos.x !== 0 || currentPos.z !== 0)) {
      // Roam within an angular arc around current pasture location outside pen
      const currAngle = Math.atan2(currentPos.z, currentPos.x);
      const deltaAngle = (Math.random() - 0.5) * 1.4;
      const angle = currAngle + deltaAngle;
      // Roam across wide pasture between radius 8.5m and 26.5m
      const r = 8.5 + Math.random() * 18.0;
      px = Math.cos(angle) * r;
      pz = Math.sin(angle) * r;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const r = 9.0 + Math.random() * 17.5;
      px = Math.cos(angle) * r;
      pz = Math.sin(angle) * r;
    }

    // Strictly ensure target is outside the pen rectangle (-5.5 to 5.5, -4.5 to 4.5)
    const penMarginX = 5.6;
    const penMarginZ = 4.6;
    if (Math.abs(px) < penMarginX && Math.abs(pz) < penMarginZ) {
      if (Math.abs(px) / penMarginX > Math.abs(pz) / penMarginZ) {
        px = (px >= 0 ? 1 : -1) * (penMarginX + 1.5);
      } else {
        pz = (pz >= 0 ? 1 : -1) * (penMarginZ + 1.5);
      }
    }

    return new THREE.Vector3(px, 0, pz);
  }


  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}

