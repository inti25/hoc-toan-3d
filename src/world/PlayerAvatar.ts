import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarId } from '../data/characters';
import { GeometryBuilder } from './geom';

export type Avatar3DId = 'kuromi' | 'hellokitty' | 'mymelody' | 'cinnamoroll' | 'elsa';

interface ElsaArmRig {
  leftUpperArm: THREE.Bone;
  rightUpperArm: THREE.Bone;
  leftForearm?: THREE.Bone;
  rightForearm?: THREE.Bone;
  leftUpperBaseZ: number;
  rightUpperBaseZ: number;
  leftForeBaseZ: number;
  rightForeBaseZ: number;
}

export interface PlayerAvatarOptions {
  onModelLoaded?: (avatarId: Avatar3DId) => void;
}

/**
 * Deep Module: PlayerAvatar
 *
 * Encapsulates:
 * - 3D GLTF model loading, caching, scaling, and bounding box normalization
 * - Instant procedural fallback mesh generation for all 7 characters
 * - Progressive loading upgrade with celebration callback
 * - Locomotion animations (leg swing for primitive meshes, arm-swing/hop/wobble for 3D GLTF models)
 */
export class PlayerAvatar {
  /** Root group added to the game world's player hierarchy */
  readonly group = new THREE.Group();

  private geom = new GeometryBuilder();
  private legs: THREE.Mesh[] = [];
  private proceduralArms: THREE.Mesh[] = [];
  private elsaArmRig?: ElsaArmRig;
  private gltfLoader = new GLTFLoader();
  private gltfCache = new Map<Avatar3DId, THREE.Group>();
  private gltfActiveModel?: THREE.Group;
  private currentAvatar: AvatarId = 'boy';

  constructor(private readonly options?: PlayerAvatarOptions) {
    this.buildBoyMesh();
    this.preloadGLTFModels();
  }

  get activeAvatar(): AvatarId {
    return this.currentAvatar;
  }

  /**
   * Switches the active character.
   * If a 3D model is cached, it is applied immediately.
   * Otherwise, renders an immediate procedural fallback and loads the 3D model in background.
   */
  setAvatar(avatarId: AvatarId): void {
    this.currentAvatar = avatarId;
    this.clearMesh();

    switch (avatarId) {
      case 'boy': this.buildBoyMesh(); break;
      case 'girl': this.buildGirlMesh(); break;
      case 'kuromi': this.applyOrLoadGLTF('kuromi', () => this.buildKuromiMesh()); break;
      case 'hellokitty': this.applyOrLoadGLTF('hellokitty', () => this.buildHelloKittyMesh()); break;
      case 'mymelody': this.applyOrLoadGLTF('mymelody', () => this.buildMyMelodyMesh()); break;
      case 'cinnamoroll': this.applyOrLoadGLTF('cinnamoroll', () => this.buildCinnamorollMesh()); break;
      case 'elsa': this.applyOrLoadGLTF('elsa', () => this.buildElsaMesh()); break;
    }
  }

  /**
   * Advances locomotion animations:
   * - Swings legs for procedural characters
   * - Cute bob/hop and wobble for 3D GLTF characters
   */
  updateWalkAnimation(time: number, isMoving: boolean): void {
    if (isMoving) {
      this.legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(time * 12 + i * Math.PI) * 0.55;
      });
      this.proceduralArms.forEach((arm, i) => {
        arm.rotation.x = Math.sin(time * 10 + (i === 0 ? 0 : Math.PI)) * 0.45;
      });
      if (this.legs.length === 0 && this.gltfActiveModel) {
        this.gltfActiveModel.position.y = Math.abs(Math.sin(time * 10)) * 0.10;
        this.gltfActiveModel.rotation.z = Math.sin(time * 5) * 0.03;
      }
      if (this.elsaArmRig) {
        // Natural out-of-phase arm swing
        const swing = Math.sin(time * 10) * 0.35;
        this.elsaArmRig.leftUpperArm.rotation.z = this.elsaArmRig.leftUpperBaseZ - swing;
        this.elsaArmRig.rightUpperArm.rotation.z = this.elsaArmRig.rightUpperBaseZ + swing;

        // Graceful subtle elbow flexion on forward swing
        if (this.elsaArmRig.leftForearm) {
          const elbowFlex = Math.max(0, swing) * 0.25;
          this.elsaArmRig.leftForearm.rotation.z = this.elsaArmRig.leftForeBaseZ - elbowFlex;
        }
        if (this.elsaArmRig.rightForearm) {
          const elbowFlex = Math.max(0, -swing) * 0.25;
          this.elsaArmRig.rightForearm.rotation.z = this.elsaArmRig.rightForeBaseZ - elbowFlex;
        }
      }
    } else {
      this.legs.forEach(leg => {
        leg.rotation.x *= 0.8;
      });
      this.proceduralArms.forEach(arm => {
        arm.rotation.x *= 0.8;
      });
      if (this.gltfActiveModel) {
        this.gltfActiveModel.position.y = 0;
        this.gltfActiveModel.rotation.z *= 0.8;
      }
      if (this.elsaArmRig) {
        // Smooth lerp damping back to rest pose
        this.elsaArmRig.leftUpperArm.rotation.z += (this.elsaArmRig.leftUpperBaseZ - this.elsaArmRig.leftUpperArm.rotation.z) * 0.2;
        this.elsaArmRig.rightUpperArm.rotation.z += (this.elsaArmRig.rightUpperBaseZ - this.elsaArmRig.rightUpperArm.rotation.z) * 0.2;
        if (this.elsaArmRig.leftForearm) {
          this.elsaArmRig.leftForearm.rotation.z += (this.elsaArmRig.leftForeBaseZ - this.elsaArmRig.leftForearm.rotation.z) * 0.2;
        }
        if (this.elsaArmRig.rightForearm) {
          this.elsaArmRig.rightForearm.rotation.z += (this.elsaArmRig.rightForeBaseZ - this.elsaArmRig.rightForearm.rotation.z) * 0.2;
        }
      }
    }
  }

  dispose(): void {
    this.clearMesh();
    this.geom.dispose();
    this.gltfCache.clear();
  }

  // ─── Private: GLTF Model Pipeline ─────────────────────────────────────────

  private preloadGLTFModels(): void {
    this.loadGLTF('kuromi');
    this.loadGLTF('hellokitty');
    this.loadGLTF('mymelody');
    this.loadGLTF('cinnamoroll');
    this.loadGLTF('elsa');
  }

  private applyOrLoadGLTF(avatarId: Avatar3DId, fallback: () => void): void {
    const cached = this.gltfCache.get(avatarId);
    if (cached) {
      const clone = SkeletonUtils.clone(cached) as THREE.Group;
      this.group.add(clone);
      this.gltfActiveModel = clone;
      this.attachArmRig(clone, avatarId);
      return;
    }

    fallback();
    this.loadGLTF(avatarId);
  }

  private loadGLTF(avatarId: Avatar3DId): void {
    if (typeof window === 'undefined') return;
    if (this.gltfCache.has(avatarId)) return;
    const baseUrl = import.meta.env?.BASE_URL ?? '/';
    const url = `${baseUrl}3dmodel/${avatarId}/scene.gltf`;

    this.gltfLoader.load(
      url,
      gltf => {
        const raw = gltf.scene;
        raw.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.isGLTF = true;
          }
        });

        // Per-model orientation calibration: align authored forward facing to +Z
        const MODEL_ROTATION_Y: Partial<Record<Avatar3DId, number>> = {
          mymelody: -Math.PI / 2
        };
        const rotY = MODEL_ROTATION_Y[avatarId];
        if (rotY !== undefined) {
          raw.rotation.y = rotY;
          raw.updateMatrixWorld(true);
        }

        // For Elsa: calibrate rest pose by lowering arms from A-pose to graceful sides
        if (avatarId === 'elsa') {
          raw.traverse(c => {
            if (c.name === 'Bip001_L_UpperArm_060' && (c as THREE.Bone).isBone) {
              c.rotation.y += 0.60;
            }
            if (c.name === 'Bip001_R_UpperArm_070' && (c as THREE.Bone).isBone) {
              c.rotation.y -= 0.60;
            }
          });
          raw.updateMatrixWorld(true);
        }

        // Compute bounds and scale to target height ~2.2 for chibi, 4.4 for Elsa (scale x2)
        const box = new THREE.Box3().setFromObject(raw);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = avatarId === 'elsa' ? 3.6 : 2.2;
        const scale = targetHeight / (size.y > 0 ? size.y : 1);
        raw.scale.setScalar(scale);
        raw.updateMatrixWorld(true);

        // Center on X and Z, and rest base on Y=0
        const scaledBox = new THREE.Box3().setFromObject(raw);
        raw.position.x = -(scaledBox.min.x + scaledBox.max.x) / 2;
        raw.position.y = -scaledBox.min.y;
        raw.position.z = -(scaledBox.min.z + scaledBox.max.z) / 2;

        const wrapper = new THREE.Group();
        wrapper.add(raw);
        wrapper.userData.isGLTF = true;

        if (avatarId === 'cinnamoroll') {
          this.attachCinnamorollFace(wrapper);
        }

        this.gltfCache.set(avatarId, wrapper);

        // If currently active, upgrade immediately
        if (this.currentAvatar === avatarId) {
          this.clearMesh();
          const clone = SkeletonUtils.clone(wrapper) as THREE.Group;
          this.group.add(clone);
          this.gltfActiveModel = clone;
          this.attachArmRig(clone, avatarId);
          this.options?.onModelLoaded?.(avatarId);
        }
      },
      undefined,
      err => {
        console.warn(`[PlayerAvatar] Failed to load 3D model for ${avatarId}:`, err);
      }
    );
  }

  private attachCinnamorollFace(wrapper: THREE.Group): void {
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.5 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });

    const geomEye = new THREE.SphereGeometry(0.08, 12, 12);
    geomEye.scale(0.85, 1.1, 0.4);
    const geomShine = new THREE.SphereGeometry(0.028, 8, 8);
    const geomBlush = new THREE.SphereGeometry(0.1, 12, 12);
    geomBlush.scale(1.3, 0.65, 0.3);
    const geomNose = new THREE.SphereGeometry(0.03, 8, 8);
    geomNose.scale(1.2, 0.7, 0.5);

    const leftEye = new THREE.Mesh(geomEye, eyeMat);
    leftEye.position.set(-0.24, 1.48, 0.48);
    const leftShine = new THREE.Mesh(geomShine, shineMat);
    leftShine.position.set(-0.21, 1.51, 0.51);

    const rightEye = new THREE.Mesh(geomEye, eyeMat);
    rightEye.position.set(0.24, 1.48, 0.48);
    const rightShine = new THREE.Mesh(geomShine, shineMat);
    rightShine.position.set(0.27, 1.51, 0.51);

    const leftBlush = new THREE.Mesh(geomBlush, blushMat);
    leftBlush.position.set(-0.38, 1.38, 0.44);
    const rightBlush = new THREE.Mesh(geomBlush, blushMat);
    rightBlush.position.set(0.38, 1.38, 0.44);

    const nose = new THREE.Mesh(geomNose, noseMat);
    nose.position.set(0, 1.42, 0.50);

    const faceGroup = new THREE.Group();
    faceGroup.add(leftEye, leftShine, rightEye, rightShine, leftBlush, rightBlush, nose);
    faceGroup.traverse(child => { child.userData.isGLTF = true; });
    wrapper.add(faceGroup);
  }

  // ─── Private: Procedural Geometry Delegation ──────────────────────────────

  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number): THREE.Mesh {
    return this.geom.box(parent, x, y, z, w, h, d, color);
  }

  private sphere(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: number): THREE.Mesh {
    return this.geom.sphere(parent, x, y, z, r, color);
  }

  private cylinder(parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, h: number, color: number, segments = 8): THREE.Mesh {
    return this.geom.cylinder(parent, x, y, z, top, bottom, h, color, segments);
  }

  private clearMesh(): void {
    while (this.group.children.length > 0) {
      const obj = this.group.children[0];
      this.group.remove(obj);
      obj.traverse(child => {
        if ((child as THREE.Mesh).isMesh && !child.userData.isGLTF) {
          (child as THREE.Mesh).geometry.dispose();
        }
      });
    }
    this.legs = [];
    this.proceduralArms = [];
    this.gltfActiveModel = undefined;
    this.elsaArmRig = undefined;
  }

  private attachArmRig(clone: THREE.Group, avatarId: Avatar3DId): void {
    if (avatarId === 'elsa') {
      let leftUpper: THREE.Bone | undefined;
      let rightUpper: THREE.Bone | undefined;
      let leftFore: THREE.Bone | undefined;
      let rightFore: THREE.Bone | undefined;

      clone.traverse(c => {
        if (c.name === 'Bip001_L_UpperArm_060' && (c as THREE.Bone).isBone) leftUpper = c as THREE.Bone;
        if (c.name === 'Bip001_R_UpperArm_070' && (c as THREE.Bone).isBone) rightUpper = c as THREE.Bone;
        if (c.name === 'Bip001_L_Forearm_061' && (c as THREE.Bone).isBone) leftFore = c as THREE.Bone;
        if (c.name === 'Bip001_R_Forearm_071' && (c as THREE.Bone).isBone) rightFore = c as THREE.Bone;
      });

      if (leftUpper && rightUpper) {
        this.elsaArmRig = {
          leftUpperArm: leftUpper,
          rightUpperArm: rightUpper,
          leftForearm: leftFore,
          rightForearm: rightFore,
          leftUpperBaseZ: leftUpper.rotation.z,
          rightUpperBaseZ: rightUpper.rotation.z,
          leftForeBaseZ: leftFore ? leftFore.rotation.z : 0,
          rightForeBaseZ: rightFore ? rightFore.rotation.z : 0,
        };
      }
    }
  }

  // ─── Private: Procedural Character Builders ───────────────────────────────

  private buildBoyMesh(): void {
    const root = this.group;
    this.box(root, 0, 0.93, 0, 0.7, 0.8, 0.47, 0xebae42);
    this.sphere(root, 0, 1.67, 0, 0.45, 0xffd5ae);
    const hair = this.sphere(root, 0, 1.93, -0.035, 0.43, 0x513c32);
    hair.scale.y = 0.65;
    for (const x of [-0.16, 0.16]) {
      const leg = this.box(root, x, 0.3, 0, 0.25, 0.55, 0.28, 0x425f70);
      this.box(leg, 0, -0.19, 0.08, 0.29, 0.16, 0.4, 0xfaf2d6);
      this.legs.push(leg);
    }
    this.box(root, -0.48, 0.94, 0, 0.2, 0.65, 0.23, 0xffd5ae);
    this.box(root, 0.48, 0.94, 0, 0.2, 0.65, 0.23, 0xffd5ae);
    this.box(root, 0, 1.0, -0.36, 0.52, 0.65, 0.3, 0x599989);
    this.box(root, 0, 1.0, -0.54, 0.32, 0.25, 0.1, 0xf0cd76);
  }

  private buildGirlMesh(): void {
    const root = this.group;
    this.box(root, 0, 0.93, 0, 0.7, 0.8, 0.47, 0x9774b8);
    this.sphere(root, 0, 1.67, 0, 0.45, 0xffd5ae);
    const hair = this.sphere(root, 0, 1.93, -0.035, 0.43, 0x513c32);
    hair.scale.y = 0.65;
    this.sphere(root, 0, 1.66, -0.39, 0.25, 0x513c32); // ponytail
    for (const x of [-0.16, 0.16]) {
      const leg = this.box(root, x, 0.3, 0, 0.25, 0.55, 0.28, 0x425f70);
      this.box(leg, 0, -0.19, 0.08, 0.29, 0.16, 0.4, 0xfaf2d6);
      this.legs.push(leg);
    }
    this.box(root, -0.48, 0.94, 0, 0.2, 0.65, 0.23, 0xffd5ae);
    this.box(root, 0.48, 0.94, 0, 0.2, 0.65, 0.23, 0xffd5ae);
    this.box(root, 0, 1.0, -0.36, 0.52, 0.65, 0.3, 0x9774b8);
    this.box(root, 0, 1.0, -0.54, 0.32, 0.25, 0.1, 0xf0cd76);
  }

  private buildKuromiMesh(): void {
    const root = this.group;
    this.box(root, 0, 0.9, 0, 0.60, 1.15, 0.42, 0x1a1a2e);
    this.box(root, -0.43, 0.94, 0, 0.17, 0.62, 0.19, 0xf5f0ff);
    this.box(root, 0.43, 0.94, 0, 0.17, 0.62, 0.19, 0xf5f0ff);
    for (const x of [-0.12, 0.12]) {
      const leg = this.box(root, x, 0.22, 0, 0.20, 0.44, 0.23, 0x1a1a2e);
      this.box(leg, 0, -0.16, 0.06, 0.24, 0.13, 0.34, 0x2d1a4e);
      this.legs.push(leg);
    }
    const face = this.sphere(root, 0, 1.72, 0.04, 0.38, 0xffffff);
    face.scale.set(0.95, 1.0, 0.88);
    const leftEye = this.sphere(root, -0.14, 1.77, 0.37, 0.065, 0x0a0520);
    leftEye.scale.set(0.8, 1.0, 0.5);
    const rightEye = this.sphere(root, 0.14, 1.77, 0.37, 0.065, 0x0a0520);
    rightEye.scale.set(0.8, 1.0, 0.5);
    const hood = this.sphere(root, 0, 1.99, 0, 0.46, 0x1a1a2e);
    hood.scale.set(1.0, 0.80, 0.95);
    this.cylinder(root, 0, 2.44, 0, 0.04, 0.22, 0.56, 0x1a1a2e, 6);
    const skull = this.sphere(root, 0, 2.12, 0.42, 0.10, 0xf5f0ff);
    skull.scale.set(1.0, 0.85, 0.7);
    this.sphere(root, -0.04, 2.14, 0.50, 0.025, 0x1a1a2e);
    this.sphere(root, 0.04, 2.14, 0.50, 0.025, 0x1a1a2e);
    const leftBowWing = this.sphere(root, -0.13, 2.56, 0, 0.12, 0x7c3aed);
    leftBowWing.scale.set(1.0, 0.65, 0.5);
    const rightBowWing = this.sphere(root, 0.13, 2.56, 0, 0.12, 0x7c3aed);
    rightBowWing.scale.set(1.0, 0.65, 0.5);
    this.sphere(root, 0, 2.56, 0, 0.055, 0x0a0520);
  }

  private buildHelloKittyMesh(): void {
    const root = this.group;
    this.box(root, 0, 0.80, 0, 0.84, 0.80, 0.54, 0xffffff);
    this.box(root, 0, 0.86, 0.28, 0.66, 0.68, 0.06, 0xe11d48);
    this.box(root, -0.56, 0.84, 0, 0.20, 0.54, 0.24, 0xffffff);
    this.box(root, 0.56, 0.84, 0, 0.20, 0.54, 0.24, 0xffffff);
    for (const x of [-0.18, 0.18]) {
      const leg = this.box(root, x, 0.20, 0, 0.28, 0.40, 0.30, 0xfcd5e0);
      this.box(leg, 0, -0.12, 0.04, 0.30, 0.12, 0.38, 0xff4d6d);
      this.legs.push(leg);
    }
    this.sphere(root, 0, 1.82, 0, 0.58, 0xffffff);
    const leftEar = this.sphere(root, -0.38, 2.36, 0, 0.17, 0xffffff);
    leftEar.scale.set(0.9, 0.85, 0.7);
    this.sphere(root, -0.38, 2.37, 0.09, 0.08, 0xfcd5e0);
    const rightEar = this.sphere(root, 0.38, 2.36, 0, 0.17, 0xffffff);
    rightEar.scale.set(0.9, 0.85, 0.7);
    this.sphere(root, 0.38, 2.37, 0.09, 0.08, 0xfcd5e0);
    const leftBowWing = this.sphere(root, 0.22, 2.41, 0.07, 0.17, 0xe11d48);
    leftBowWing.scale.set(0.98, 0.65, 0.52);
    const rightBowWing = this.sphere(root, 0.52, 2.41, 0.07, 0.17, 0xe11d48);
    rightBowWing.scale.set(0.98, 0.65, 0.52);
    this.sphere(root, 0.37, 2.41, 0.09, 0.075, 0xb91c1c);
    const leftEye = this.sphere(root, -0.19, 1.86, 0.53, 0.07, 0x111111);
    leftEye.scale.set(0.7, 1.1, 0.4);
    const rightEye = this.sphere(root, 0.19, 1.86, 0.53, 0.07, 0x111111);
    rightEye.scale.set(0.7, 1.1, 0.4);
    this.sphere(root, 0, 1.79, 0.55, 0.032, 0xffd700);
    for (let i = 0; i < 3; i++) {
      this.sphere(root, -0.22 - i * 0.1, 1.80 + (i - 1) * 0.04, 0.52, 0.015, 0xcccccc);
      this.sphere(root, 0.22 + i * 0.1, 1.80 + (i - 1) * 0.04, 0.52, 0.015, 0xcccccc);
    }
    this.box(root, 0, 1.28, 0.22, 0.52, 0.07, 0.05, 0xfbbf24);
  }

  private buildMyMelodyMesh(): void {
    const root = this.group;
    this.box(root, 0, 0.88, 0, 0.70, 0.92, 0.48, 0xfce7f3);
    this.box(root, -0.47, 0.92, 0, 0.20, 0.60, 0.22, 0xfdf2f8);
    this.box(root, 0.47, 0.92, 0, 0.20, 0.60, 0.22, 0xfdf2f8);
    for (const x of [-0.15, 0.15]) {
      const leg = this.box(root, x, 0.22, 0, 0.22, 0.44, 0.25, 0xfce7f3);
      this.box(leg, 0, -0.13, 0.04, 0.26, 0.12, 0.32, 0xf9a8d4);
      this.legs.push(leg);
    }
    const face = this.sphere(root, 0, 1.72, 0, 0.40, 0xfff5f8);
    face.scale.set(0.95, 1.0, 0.92);
    const hood = this.sphere(root, 0, 1.92, -0.07, 0.48, 0xfce7f3);
    hood.scale.set(1.06, 0.90, 1.0);

    const leftEarGroup = new THREE.Group();
    leftEarGroup.position.set(-0.20, 2.06, -0.04);
    leftEarGroup.rotation.z = 0.20;
    this.cylinder(leftEarGroup, 0, 0.30, 0, 0.082, 0.10, 0.64, 0xfce7f3, 6);
    this.cylinder(leftEarGroup, 0, 0.30, 0.02, 0.046, 0.056, 0.50, 0xf9a8d4, 6);
    root.add(leftEarGroup);

    const rightEarGroup = new THREE.Group();
    rightEarGroup.position.set(0.20, 2.06, -0.04);
    rightEarGroup.rotation.z = -0.20;
    this.cylinder(rightEarGroup, 0, 0.30, 0, 0.082, 0.10, 0.64, 0xfce7f3, 6);
    this.cylinder(rightEarGroup, 0, 0.30, 0.02, 0.046, 0.056, 0.50, 0xf9a8d4, 6);
    root.add(rightEarGroup);

    const leftEye = this.sphere(root, -0.13, 1.76, 0.36, 0.07, 0x111111);
    leftEye.scale.set(0.8, 1.0, 0.5);
    const rightEye = this.sphere(root, 0.13, 1.76, 0.36, 0.07, 0x111111);
    rightEye.scale.set(0.8, 1.0, 0.5);
    const nose = this.sphere(root, 0, 1.68, 0.38, 0.055, 0xf9a8d4);
    nose.scale.set(1.2, 0.7, 0.5);
    const leftCheek = this.sphere(root, -0.24, 1.69, 0.34, 0.09, 0xfcbad5);
    leftCheek.scale.set(1.3, 0.65, 0.35);
    const rightCheek = this.sphere(root, 0.24, 1.69, 0.34, 0.09, 0xfcbad5);
    rightCheek.scale.set(1.3, 0.65, 0.35);
    const heart = this.sphere(root, 0, 1.1, 0.25, 0.08, 0xf43f5e);
    heart.scale.set(0.9, 0.75, 0.4);
  }

  private buildCinnamorollMesh(): void {
    const root = this.group;
    const body = this.sphere(root, 0, 0.82, 0, 0.54, 0xf0f9ff);
    body.scale.set(0.94, 0.86, 0.80);
    const belly = this.sphere(root, 0, 0.79, 0.22, 0.37, 0xe0f2fe);
    belly.scale.set(0.86, 0.76, 0.46);
    const leftArm = this.sphere(root, -0.54, 0.78, 0, 0.20, 0xf0f9ff);
    leftArm.scale.set(0.72, 0.65, 0.62);
    const rightArm = this.sphere(root, 0.54, 0.78, 0, 0.20, 0xf0f9ff);
    rightArm.scale.set(0.72, 0.65, 0.62);
    for (const x of [-0.15, 0.15]) {
      const leg = this.box(root, x, 0.20, 0, 0.26, 0.40, 0.28, 0xf0f9ff);
      this.box(leg, 0, -0.12, 0.04, 0.30, 0.13, 0.36, 0xbae6fd);
      this.legs.push(leg);
    }
    const head = this.sphere(root, 0, 1.80, 0, 0.57, 0xffffff);
    head.scale.set(1.0, 0.97, 0.96);

    const leftEarGroup = new THREE.Group();
    leftEarGroup.position.set(-0.44, 1.96, 0);
    leftEarGroup.rotation.z = 0.55;
    const leftEarMesh = this.sphere(leftEarGroup, 0, 0.22, -0.06, 0.25, 0xf0f9ff);
    leftEarMesh.scale.set(0.55, 1.28, 0.46);
    root.add(leftEarGroup);

    const rightEarGroup = new THREE.Group();
    rightEarGroup.position.set(0.44, 1.96, 0);
    rightEarGroup.rotation.z = -0.55;
    const rightEarMesh = this.sphere(rightEarGroup, 0, 0.22, -0.06, 0.25, 0xf0f9ff);
    rightEarMesh.scale.set(0.55, 1.28, 0.46);
    root.add(rightEarGroup);

    const leftEye = this.sphere(root, -0.19, 1.87, 0.50, 0.105, 0x0284c7);
    leftEye.scale.set(0.78, 1.05, 0.42);
    const rightEye = this.sphere(root, 0.19, 1.87, 0.50, 0.105, 0x0284c7);
    rightEye.scale.set(0.78, 1.05, 0.42);
    this.sphere(root, -0.14, 1.90, 0.54, 0.042, 0xffffff);
    this.sphere(root, 0.23, 1.90, 0.54, 0.042, 0xffffff);
    const leftBlush = this.sphere(root, -0.33, 1.77, 0.44, 0.115, 0xfecdd3);
    leftBlush.scale.set(1.35, 0.65, 0.36);
    const rightBlush = this.sphere(root, 0.33, 1.77, 0.44, 0.115, 0xfecdd3);
    rightBlush.scale.set(1.35, 0.65, 0.36);
    const nose = this.sphere(root, 0, 1.79, 0.54, 0.032, 0xffd0e6);
    nose.scale.set(1.2, 0.7, 0.5);
    const tail = this.sphere(root, 0, 0.80, -0.54, 0.16, 0xf0f9ff);
    tail.scale.set(0.8, 0.8, 0.52);
    this.sphere(leftEarGroup, 0, 0.56, -0.06, 0.09, 0xbae6fd);
    this.sphere(rightEarGroup, 0, 0.56, -0.06, 0.09, 0xbae6fd);
  }

  private buildElsaMesh(): void {
    const elsaGroup = new THREE.Group();
    elsaGroup.scale.setScalar(1.2);
    this.group.add(elsaGroup);
    const root = elsaGroup;

    // Torso (ice-blue royal bodice)
    this.box(root, 0, 0.95, 0, 0.64, 0.78, 0.42, 0x38bdf8);

    // Gown skirt (flowing flared ice crystal gown)
    this.cylinder(root, 0, 0.46, 0, 0.32, 0.54, 0.62, 0x7dd3fc, 10);

    // Shimmering translucent ice cape on back
    this.box(root, 0, 0.96, -0.25, 0.62, 0.95, 0.06, 0xbae6fd);

    // Arms: fair skin with icy cuffs (stored for procedural swing)
    const leftArm = this.box(root, -0.44, 0.96, 0, 0.18, 0.62, 0.20, 0xffd5ae);
    const rightArm = this.box(root, 0.44, 0.96, 0, 0.18, 0.62, 0.20, 0xffd5ae);
    this.box(leftArm, 0, 0.19, 0, 0.20, 0.24, 0.22, 0x7dd3fc);
    this.box(rightArm, 0, 0.19, 0, 0.20, 0.24, 0.22, 0x7dd3fc);
    this.proceduralArms.push(leftArm, rightArm);

    // Legs with crystal shoes for walk animation
    for (const x of [-0.15, 0.15]) {
      const leg = this.box(root, x, 0.24, 0, 0.20, 0.48, 0.22, 0x38bdf8);
      this.box(leg, 0, -0.17, 0.05, 0.24, 0.14, 0.32, 0xe0f2fe);
      this.legs.push(leg);
    }

    // Head & face
    this.sphere(root, 0, 1.70, 0, 0.42, 0xffd5ae);

    // Expressive royal blue eyes (+Z forward)
    const leftEye = this.sphere(root, -0.13, 1.74, 0.38, 0.065, 0x0284c7);
    leftEye.scale.set(0.8, 1.0, 0.5);
    const rightEye = this.sphere(root, 0.13, 1.74, 0.38, 0.065, 0x0284c7);
    rightEye.scale.set(0.8, 1.0, 0.5);

    // Eye shines
    this.sphere(root, -0.11, 1.76, 0.41, 0.024, 0xffffff);
    this.sphere(root, 0.15, 1.76, 0.41, 0.024, 0xffffff);

    // Soft rosy cheeks & gentle smile
    this.sphere(root, -0.22, 1.66, 0.36, 0.08, 0xfecdd3);
    this.sphere(root, 0.22, 1.66, 0.36, 0.08, 0xfecdd3);
    this.sphere(root, 0, 1.65, 0.40, 0.032, 0xfda4af);

    // Platinum blonde hair volume
    const hair = this.sphere(root, 0, 1.94, -0.05, 0.44, 0xfef08a);
    hair.scale.set(1.05, 0.9, 1.0);
    this.sphere(root, 0, 1.98, 0.18, 0.25, 0xfef08a);

    // Signature Elsa side braid draped over left shoulder
    const braidSegments = [
      { x: -0.28, y: 1.68, z: 0.14, r: 0.13 },
      { x: -0.32, y: 1.48, z: 0.18, r: 0.11 },
      { x: -0.30, y: 1.30, z: 0.22, r: 0.09 },
      { x: -0.26, y: 1.14, z: 0.24, r: 0.075 },
    ];
    for (const b of braidSegments) {
      this.sphere(root, b.x, b.y, b.z, b.r, 0xfef08a);
    }

    // Ice Tiara / Snowflake Crown
    this.cylinder(root, 0, 2.16, 0.12, 0.015, 0.07, 0.24, 0x0284c7, 6);
    this.cylinder(root, -0.12, 2.13, 0.10, 0.012, 0.05, 0.18, 0x38bdf8, 6);
    this.cylinder(root, 0.12, 2.13, 0.10, 0.012, 0.05, 0.18, 0x38bdf8, 6);
    this.box(root, 0, 2.05, 0.16, 0.34, 0.04, 0.04, 0x7dd3fc);
  }
}

