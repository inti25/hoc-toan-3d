import * as THREE from 'three';

export type AnimalKind = 'cow' | 'calf' | 'pig' | 'piglet' | 'chicken' | 'chick' | 'duck' | 'duckling' | 'dog';

export interface AnimalPart {
  mesh: THREE.Mesh | THREE.Group;
  name: string;
  originalY: number;
}

export class FarmAnimalEntity {
  public root: THREE.Group = new THREE.Group();
  public kind: AnimalKind;
  public id: string;
  public index: number;

  public state: 'ROAMING' | 'ENGAGED' | 'HOMEWARD' | 'RESTING' = 'ROAMING';
  
  // Locomotion and AI
  public speed = 0;
  public heading = 0; // current rotation Y
  public phase = 0; // animation phase
  public pop = 1; // scale pop for celebration
  
  public graze = 0;
  public peck = 0;
  public flap = 0;

  // Parts
  public body?: AnimalPart;
  public head?: AnimalPart;
  public tail?: AnimalPart;
  public legL?: AnimalPart;
  public legR?: AnimalPart;
  public legFL?: AnimalPart;
  public legFR?: AnimalPart;
  public legBL?: AnimalPart;
  public legBR?: AnimalPart;
  public wingL?: AnimalPart;
  public wingR?: AnimalPart;

  // Target steering
  public targetPos?: THREE.Vector3;
  public restTime = 0;
  
  // Shelter
  public shelterPos?: THREE.Vector3;
  public shelterGate?: THREE.Vector3; // the gate of the farm pen to go through first

  constructor(id: string, index: number, kind: AnimalKind, sourceGlb: THREE.Group) {
    this.id = id;
    this.index = index;
    this.kind = kind;

    // Extract the root group for this animal from the GLB
    const animalRoot = sourceGlb.children.find(c => c.name === kind)?.clone(true);
    if (animalRoot) {
      this.root.add(animalRoot);
      this.extractParts(animalRoot);
    } else {
      // Fallback if not found (e.g. creating simple boxes)
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
      mesh.position.y = 0.25;
      this.root.add(mesh);
    }
  }

  private extractParts(node: THREE.Object3D) {
    node.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || child.type === 'Group') {
        const name = child.name;
        const part: AnimalPart = { mesh: child as THREE.Mesh | THREE.Group, name, originalY: child.position.y };
        if (name.endsWith('_body')) this.body = part;
        else if (name.endsWith('_head')) this.head = part;
        else if (name.endsWith('_tail')) this.tail = part;
        else if (name.endsWith('_leg_l')) this.legL = part;
        else if (name.endsWith('_leg_r')) this.legR = part;
        else if (name.endsWith('_leg_fl')) this.legFL = part;
        else if (name.endsWith('_leg_fr')) this.legFR = part;
        else if (name.endsWith('_leg_bl')) this.legBL = part;
        else if (name.endsWith('_leg_br')) this.legBR = part;
        else if (name.endsWith('_wing_l')) this.wingL = part;
        else if (name.endsWith('_wing_r')) this.wingR = part;
      }
    });
  }

  public updateAnimation(dt: number, time: number) {
    const moving = this.speed > 0.05;
    
    // Update phase
    this.phase += dt * (this.isCowOrPig() ? 7 : 16) * Math.min(1, this.speed / 0.3);
    if (!moving) {
      // Return phase to 0 smoothly if stopped
      this.phase += (0 - this.phase) * dt * 5;
    }

    // Body bob and settle
    const bob = moving ? Math.abs(Math.sin(this.phase)) * (this.isCowOrPig() ? 0.03 : 0.05) : 0;
    
    // Update pop (celebration)
    const scale = this.pop < 1 ? Math.min(1, this.pop * 2) * (1 + Math.sin(this.pop * Math.PI * 2.5) * (1 - this.pop) * 0.35) : 1;
    this.root.scale.setScalar(scale);

    if (this.body) {
      this.body.mesh.position.y = this.body.originalY + bob;
    }

    // Head animation
    if (this.head) {
      let rx = 0;
      let ry = 0;
      if (this.isCowOrPig() || this.kind === 'dog') {
        rx = this.graze * 0.75 + (this.graze * Math.sin(time * 6) * 0.06 + Math.sin(time * 2) * 0.05);
        ry = Math.sin(time * 0.7) * 0.15 * (1 - this.graze * 0.6);
      } else {
        rx = this.peck * 0.9 + Math.sin(time * 2) * 0.05;
        ry = Math.sin(time * 0.7) * 0.15;
      }
      this.head.mesh.rotation.x = rx;
      this.head.mesh.rotation.y = ry;
    }

    // Legs animation
    const swing = moving ? Math.sin(this.phase) * (this.isCowOrPig() ? 0.45 : 0.7) : 0;
    if (this.legL) this.legL.mesh.rotation.x = swing;
    if (this.legR) this.legR.mesh.rotation.x = -swing;
    if (this.legFL) this.legFL.mesh.rotation.x = swing;
    if (this.legFR) this.legFR.mesh.rotation.x = -swing;
    if (this.legBL) this.legBL.mesh.rotation.x = -swing;
    if (this.legBR) this.legBR.mesh.rotation.x = swing;

    // Tail animation
    if (this.tail) {
      this.tail.mesh.rotation.y = Math.sin(time * 3) * 0.35;
    }

    // Wings animation
    if (this.wingL && this.wingR) {
      const flapAmt = this.flap * 0.5 + (moving ? Math.sin(this.phase) * 0.1 : 0);
      this.wingL.mesh.rotation.z = flapAmt;
      this.wingR.mesh.rotation.z = -flapAmt;
    }
  }

  private isCowOrPig(): boolean {
    return this.kind === 'cow' || this.kind === 'calf' || this.kind === 'pig' || this.kind === 'piglet' || this.kind === 'dog';
  }
}
