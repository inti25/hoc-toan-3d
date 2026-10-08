import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FarmAnimalEntity, AnimalKind } from './FarmAnimalEntity';
import { generateFarmMultiplicationProblem } from '../../core/adventure';

export class FarmSanctuary {
  public group = new THREE.Group();
  public animals: FarmAnimalEntity[] = [];
  public mapGroup?: THREE.Group;
  
  // Triggers for answering math problems
  public interactTriggers: { 
    position: THREE.Vector3; 
    radius: number; 
    id: string; 
    animalId: string;
    isActive: boolean;
    problemData: any;
  }[] = [];

  private modelLoader = new GLTFLoader();
  private time = 0;

  constructor() {}

  public async load(farmRescued: Record<string, boolean>, questions?: any[]) {
    // Load farm.glb
    const gltf = await this.modelLoader.loadAsync('/3dmodel/maps/farm.glb');
    this.mapGroup = gltf.scene;

    // Remove any embedded lights or cameras
    this.mapGroup.traverse((child) => {
      if ((child as any).isLight || (child as any).isCamera) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.group.add(this.mapGroup);

    // Instantiate animals
    // Define species and initial layout (10 animals)
    const lineup: AnimalKind[] = ['cow', 'chicken', 'pig', 'duck', 'calf', 'piglet', 'chick', 'duckling', 'dog', 'cow'];
    
    // Pen locations (inside the fence)
    const penCenter = new THREE.Vector3(0, 0, 0);
    const penRadius = 8;
    
    // Roam locations (outside the fence)
    const roamCenter = new THREE.Vector3(20, 0, 20);
    const roamRadius = 25;

    lineup.forEach((kind, i) => {
      const animalId = `farm_${kind}_${i}`;
      const entity = new FarmAnimalEntity(animalId, i, kind, this.mapGroup!);
      const isRescued = farmRescued?.[animalId] === true;
      
      if (isRescued) {
        // Already rescued -> start inside pen
        entity.state = 'HOMEWARD';
        const angle = (i / lineup.length) * Math.PI * 2;
        entity.root.position.set(
          penCenter.x + Math.cos(angle) * (penRadius * Math.random()),
          0,
          penCenter.z + Math.sin(angle) * (penRadius * Math.random())
        );
        entity.heading = Math.random() * Math.PI * 2;
        entity.targetPos = entity.root.position.clone();
      } else {
        // Escaped -> start outside
        entity.state = 'ROAMING';
        const angle = (i / lineup.length) * Math.PI * 2;
        entity.root.position.set(
          roamCenter.x + Math.cos(angle) * (roamRadius * 0.5 + Math.random() * 10),
          0,
          roamCenter.z + Math.sin(angle) * (roamRadius * 0.5 + Math.random() * 10)
        );
        entity.heading = Math.random() * Math.PI * 2;
        entity.targetPos = this.getRandomRoamPos();

        // Create trigger for problem
        const problemData = (questions && questions[i]) ? questions[i] : generateFarmMultiplicationProblem(i, kind);
        this.interactTriggers.push({
          position: entity.root.position,
          radius: 3,
          id: problemData.id,
          animalId: animalId,
          isActive: true,
          problemData
        });
      }

      this.group.add(entity.root);
      this.animals.push(entity);
    });
  }

  public getInteractTriggers() {
    return this.interactTriggers;
  }

  public onAnimalRescued(animalId: string) {
    const animal = this.animals.find(a => a.id === animalId);
    if (animal) {
      animal.state = 'ENGAGED';
      animal.pop = 0; // trigger celebration pop
      setTimeout(() => {
        animal.state = 'HOMEWARD';
        animal.targetPos = new THREE.Vector3(Math.random() * 6 - 3, 0, Math.random() * 6 - 3); // center pen
      }, 2000); // 2 seconds engaged then go home
    }

    const trigger = this.interactTriggers.find(t => t.animalId === animalId);
    if (trigger) {
      trigger.isActive = false; // Disable trigger
    }
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    this.time += dt;

    for (const animal of this.animals) {
      // 1. Steering & State Machine
      const pos = animal.root.position;
      
      if (animal.state === 'ROAMING' || animal.state === 'HOMEWARD') {
        if (!animal.targetPos) animal.targetPos = animal.state === 'ROAMING' ? this.getRandomRoamPos() : new THREE.Vector3(0,0,0);
        
        const dist = pos.distanceTo(animal.targetPos);
        if (dist < 1) {
          // Reached target
          if (animal.state === 'HOMEWARD') {
            animal.speed = 0;
            // Maybe find new spot in pen
            if (Math.random() < 0.02) {
               animal.targetPos = new THREE.Vector3(Math.random() * 8 - 4, 0, Math.random() * 8 - 4);
            }
          } else {
             // Roaming, rest for a bit
             animal.restTime = 2 + Math.random() * 5;
             animal.targetPos = undefined; 
             animal.speed = 0;
          }
        } else {
          // Move towards target
          const angleToTarget = Math.atan2(animal.targetPos.x - pos.x, animal.targetPos.z - pos.z);
          // Turn smoothly
          const diff = this.normalizeAngle(angleToTarget - animal.heading);
          animal.heading += diff * dt * 3;
          
          animal.speed = animal.state === 'HOMEWARD' ? 4 : 1.5;
          
          pos.x += Math.sin(animal.heading) * animal.speed * dt;
          pos.z += Math.cos(animal.heading) * animal.speed * dt;
        }

        if (animal.restTime > 0) {
           animal.restTime -= dt;
           animal.speed = 0;
           // Occasionally graze/peck when resting
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
      } else if (animal.state === 'ENGAGED') {
        // Look at player
        const angleToTarget = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
        const diff = this.normalizeAngle(angleToTarget - animal.heading);
        animal.heading += diff * dt * 5;
        animal.speed = 0;
        animal.graze = 0;
        animal.peck = 0;
      }

      // Update pop
      if (animal.pop < 1) animal.pop += dt;

      // Update rotation
      animal.root.rotation.y = animal.heading;

      // Update trigger positions to follow the animal
      const trigger = this.interactTriggers.find(t => t.animalId === animal.id);
      if (trigger && trigger.isActive) {
        trigger.position.copy(pos);
      }

      // 2. Procedural Animation
      animal.updateAnimation(dt, this.time);
    }
  }

  private getRandomRoamPos(): THREE.Vector3 {
     const angle = Math.random() * Math.PI * 2;
     const r = 15 + Math.random() * 20;
     return new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}
