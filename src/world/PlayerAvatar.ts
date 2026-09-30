import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarId } from '../data/characters';

export type Avatar3DId = 'kuromi' | 'hellokitty' | 'mymelody' | 'cinnamoroll';

export interface PlayerAvatarOptions {
  onModelLoaded?: (avatarId: Avatar3DId) => void;
}

/**
 * Deep Module: PlayerAvatar
 *
 * Encapsulates:
 * - 3D GLTF model loading, caching, scaling, and bounding box normalization
 * - Instant procedural fallback mesh generation for all 6 characters
 * - Progressive loading upgrade with celebration callback
 * - Locomotion animations (leg swing for primitive meshes, hop/wobble for 3D GLTF models)
 */
export class PlayerAvatar {
  /** Root group added to the game world's player hierarchy */
  readonly group = new THREE.Group();

  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private legs: THREE.Mesh[] = [];
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
      case 'boy':         this.buildBoyMesh();          break;
      case 'girl':        this.buildGirlMesh();         break;
      case 'kuromi':      this.applyOrLoadGLTF('kuromi', () => this.buildKuromiMesh()); break;
      case 'hellokitty':  this.applyOrLoadGLTF('hellokitty', () => this.buildHelloKittyMesh()); break;
      case 'mymelody':    this.applyOrLoadGLTF('mymelody', () => this.buildMyMelodyMesh()); break;
      case 'cinnamoroll': this.applyOrLoadGLTF('cinnamoroll', () => this.buildCinnamorollMesh()); break;
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
      if (this.legs.length === 0 && this.gltfActiveModel) {
        this.gltfActiveModel.position.y = Math.abs(Math.sin(time * 12)) * 0.12;
        this.gltfActiveModel.rotation.z = Math.sin(time * 6) * 0.05;
      }
    } else {
      this.legs.forEach(leg => {
        leg.rotation.x *= 0.8;
      });
      if (this.gltfActiveModel) {
        this.gltfActiveModel.position.y = 0;
        this.gltfActiveModel.rotation.z *= 0.8;
      }
    }
  }

  dispose(): void {
    this.clearMesh();
    this.materials.forEach(mat => mat.dispose());
    this.materials.clear();
    this.gltfCache.clear();
  }

  // ─── Private: GLTF Model Pipeline ─────────────────────────────────────────

  private preloadGLTFModels(): void {
    this.loadGLTF('kuromi');
    this.loadGLTF('hellokitty');
    this.loadGLTF('mymelody');
    this.loadGLTF('cinnamoroll');
  }

  private applyOrLoadGLTF(avatarId: Avatar3DId, fallback: () => void): void {
    const cached = this.gltfCache.get(avatarId);
    if (cached) {
      const clone = SkeletonUtils.clone(cached) as THREE.Group;
      this.group.add(clone);
      this.gltfActiveModel = clone;
      return;
    }

    fallback();
    this.loadGLTF(avatarId);
  }

  private loadGLTF(avatarId: Avatar3DId): void {
    if (this.gltfCache.has(avatarId)) return;
    const url = `${import.meta.env.BASE_URL}3dmodel/${avatarId}/scene.gltf`;

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

        // Compute bounds and scale to target height ~2.2
        const box = new THREE.Box3().setFromObject(raw);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 2.2;
        const scale = targetHeight / (size.y > 0 ? size.y : 1);
        raw.scale.setScalar(scale);

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

    const eL = new THREE.Mesh(geomEye, eyeMat); eL.position.set(-0.24, 1.48, 0.48);
    const sL = new THREE.Mesh(geomShine, shineMat); sL.position.set(-0.21, 1.51, 0.51);
    const eR = new THREE.Mesh(geomEye, eyeMat); eR.position.set(0.24, 1.48, 0.48);
    const sR = new THREE.Mesh(geomShine, shineMat); sR.position.set(0.27, 1.51, 0.51);
    const bL = new THREE.Mesh(geomBlush, blushMat); bL.position.set(-0.38, 1.38, 0.44);
    const bR = new THREE.Mesh(geomBlush, blushMat); bR.position.set(0.38, 1.38, 0.44);
    const nose = new THREE.Mesh(geomNose, noseMat); nose.position.set(0, 1.42, 0.50);

    const faceGroup = new THREE.Group();
    faceGroup.add(eL, sL, eR, sR, bL, bR, nose);
    faceGroup.traverse(child => { child.userData.isGLTF = true; });
    wrapper.add(faceGroup);
  }

  // ─── Private: Procedural Geometry Helpers ─────────────────────────────────

  private material(color: number): THREE.MeshStandardMaterial {
    let mat = this.materials.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
      this.materials.set(color, mat);
    }
    return mat;
  }

  private mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number): THREE.Mesh {
    return this.mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);
  }

  private sphere(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: number): THREE.Mesh {
    return this.mesh(parent, new THREE.IcosahedronGeometry(r, 1), color, x, y, z);
  }

  private cylinder(parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, h: number, color: number, segments = 8): THREE.Mesh {
    return this.mesh(parent, new THREE.CylinderGeometry(top, bottom, h, segments), color, x, y, z);
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
    this.gltfActiveModel = undefined;
  }

  // ─── Private: Procedural Character Builders ───────────────────────────────

  private buildBoyMesh(): void {
    const p = this.group;
    this.box(p, 0, .93, 0, .7, .8, .47, 0xebae42);
    this.sphere(p, 0, 1.67, 0, .45, 0xffd5ae);
    const hair = this.sphere(p, 0, 1.93, -.035, .43, 0x513c32);
    hair.scale.y = .65;
    for (const x of [-.16, .16]) {
      const leg = this.box(p, x, .3, 0, .25, .55, .28, 0x425f70);
      this.box(leg, 0, -.19, .08, .29, .16, .4, 0xfaf2d6);
      this.legs.push(leg);
    }
    this.box(p, -.48, .94, 0, .2, .65, .23, 0xffd5ae);
    this.box(p, .48, .94, 0, .2, .65, .23, 0xffd5ae);
    this.box(p, 0, 1, -.36, .52, .65, .3, 0x599989);
    this.box(p, 0, 1, -.54, .32, .25, .1, 0xf0cd76);
  }

  private buildGirlMesh(): void {
    const p = this.group;
    this.box(p, 0, .93, 0, .7, .8, .47, 0x9774b8);
    this.sphere(p, 0, 1.67, 0, .45, 0xffd5ae);
    const hair = this.sphere(p, 0, 1.93, -.035, .43, 0x513c32);
    hair.scale.y = .65;
    this.sphere(p, 0, 1.66, -.39, .25, 0x513c32); // ponytail
    for (const x of [-.16, .16]) {
      const leg = this.box(p, x, .3, 0, .25, .55, .28, 0x425f70);
      this.box(leg, 0, -.19, .08, .29, .16, .4, 0xfaf2d6);
      this.legs.push(leg);
    }
    this.box(p, -.48, .94, 0, .2, .65, .23, 0xffd5ae);
    this.box(p, .48, .94, 0, .2, .65, .23, 0xffd5ae);
    this.box(p, 0, 1, -.36, .52, .65, .3, 0x9774b8);
    this.box(p, 0, 1, -.54, .32, .25, .1, 0xf0cd76);
  }

  private buildKuromiMesh(): void {
    const p = this.group;
    this.box(p, 0, 0.9, 0, 0.60, 1.15, 0.42, 0x1a1a2e);
    this.box(p, -.43, .94, 0, .17, .62, .19, 0xf5f0ff);
    this.box(p, .43, .94, 0, .17, .62, .19, 0xf5f0ff);
    for (const x of [-.12, .12]) {
      const leg = this.box(p, x, 0.22, 0, 0.20, 0.44, 0.23, 0x1a1a2e);
      this.box(leg, 0, -.16, .06, .24, .13, .34, 0x2d1a4e);
      this.legs.push(leg);
    }
    const face = this.sphere(p, 0, 1.72, .04, .38, 0xffffff);
    face.scale.set(0.95, 1.0, 0.88);
    const eL = this.sphere(p, -.14, 1.77, .37, .065, 0x0a0520);
    eL.scale.set(0.8, 1.0, 0.5);
    const eR = this.sphere(p, .14, 1.77, .37, .065, 0x0a0520);
    eR.scale.set(0.8, 1.0, 0.5);
    const hood = this.sphere(p, 0, 1.99, 0, .46, 0x1a1a2e);
    hood.scale.set(1.0, 0.80, 0.95);
    this.cylinder(p, 0, 2.44, 0, 0.04, 0.22, 0.56, 0x1a1a2e, 6);
    const skull = this.sphere(p, 0, 2.12, .42, .10, 0xf5f0ff);
    skull.scale.set(1, 0.85, 0.7);
    this.sphere(p, -.04, 2.14, .50, .025, 0x1a1a2e);
    this.sphere(p, .04, 2.14, .50, .025, 0x1a1a2e);
    const bL = this.sphere(p, -.13, 2.56, 0, .12, 0x7c3aed);
    bL.scale.set(1.0, 0.65, 0.5);
    const bR = this.sphere(p, .13, 2.56, 0, .12, 0x7c3aed);
    bR.scale.set(1.0, 0.65, 0.5);
    this.sphere(p, 0, 2.56, 0, .055, 0x0a0520);
  }

  private buildHelloKittyMesh(): void {
    const p = this.group;
    this.box(p, 0, 0.80, 0, 0.84, 0.80, 0.54, 0xffffff);
    this.box(p, 0, 0.86, 0.28, 0.66, 0.68, 0.06, 0xe11d48);
    this.box(p, -.56, 0.84, 0, .20, .54, .24, 0xffffff);
    this.box(p, .56, 0.84, 0, .20, .54, .24, 0xffffff);
    for (const x of [-.18, .18]) {
      const leg = this.box(p, x, 0.20, 0, 0.28, 0.40, 0.30, 0xfcd5e0);
      this.box(leg, 0, -.12, .04, .30, .12, .38, 0xff4d6d);
      this.legs.push(leg);
    }
    this.sphere(p, 0, 1.82, 0, .58, 0xffffff);
    const earL = this.sphere(p, -.38, 2.36, 0, .17, 0xffffff);
    earL.scale.set(0.9, 0.85, 0.7);
    this.sphere(p, -.38, 2.37, .09, .08, 0xfcd5e0);
    const earR = this.sphere(p, .38, 2.36, 0, .17, 0xffffff);
    earR.scale.set(0.9, 0.85, 0.7);
    this.sphere(p, .38, 2.37, .09, .08, 0xfcd5e0);
    const bwL = this.sphere(p, .22, 2.41, .07, .17, 0xe11d48);
    bwL.scale.set(0.98, 0.65, 0.52);
    const bwR = this.sphere(p, .52, 2.41, .07, .17, 0xe11d48);
    bwR.scale.set(0.98, 0.65, 0.52);
    this.sphere(p, .37, 2.41, .09, .075, 0xb91c1c);
    const eyeL = this.sphere(p, -.19, 1.86, .53, .07, 0x111111);
    eyeL.scale.set(0.7, 1.1, 0.4);
    const eyeR = this.sphere(p, .19, 1.86, .53, .07, 0x111111);
    eyeR.scale.set(0.7, 1.1, 0.4);
    this.sphere(p, 0, 1.79, .55, .032, 0xffd700);
    for (let i = 0; i < 3; i++) {
      this.sphere(p, -.22 - i * .1, 1.80 + (i - 1) * .04, .52, .015, 0xcccccc);
      this.sphere(p, .22 + i * .1, 1.80 + (i - 1) * .04, .52, .015, 0xcccccc);
    }
    this.box(p, 0, 1.28, .22, .52, .07, .05, 0xfbbf24);
  }

  private buildMyMelodyMesh(): void {
    const p = this.group;
    this.box(p, 0, 0.88, 0, 0.70, 0.92, 0.48, 0xfce7f3);
    this.box(p, -.47, .92, 0, .20, .60, .22, 0xfdf2f8);
    this.box(p, .47, .92, 0, .20, .60, .22, 0xfdf2f8);
    for (const x of [-.15, .15]) {
      const leg = this.box(p, x, 0.22, 0, 0.22, 0.44, 0.25, 0xfce7f3);
      this.box(leg, 0, -.13, .04, .26, .12, .32, 0xf9a8d4);
      this.legs.push(leg);
    }
    const face = this.sphere(p, 0, 1.72, 0, .40, 0xfff5f8);
    face.scale.set(0.95, 1.0, 0.92);
    const hood = this.sphere(p, 0, 1.92, -.07, .48, 0xfce7f3);
    hood.scale.set(1.06, 0.90, 1.0);

    const earLG = new THREE.Group();
    earLG.position.set(-.20, 2.06, -.04);
    earLG.rotation.z = .20;
    this.cylinder(earLG, 0, .30, 0, .082, .10, .64, 0xfce7f3, 6);
    this.cylinder(earLG, 0, .30, .02, .046, .056, .50, 0xf9a8d4, 6);
    p.add(earLG);

    const earRG = new THREE.Group();
    earRG.position.set(.20, 2.06, -.04);
    earRG.rotation.z = -.20;
    this.cylinder(earRG, 0, .30, 0, .082, .10, .64, 0xfce7f3, 6);
    this.cylinder(earRG, 0, .30, .02, .046, .056, .50, 0xf9a8d4, 6);
    p.add(earRG);

    const eL = this.sphere(p, -.13, 1.76, .36, .07, 0x111111);
    eL.scale.set(0.8, 1.0, 0.5);
    const eR = this.sphere(p, .13, 1.76, .36, .07, 0x111111);
    eR.scale.set(0.8, 1.0, 0.5);
    const nose = this.sphere(p, 0, 1.68, .38, .055, 0xf9a8d4);
    nose.scale.set(1.2, 0.7, 0.5);
    const ckL = this.sphere(p, -.24, 1.69, .34, .09, 0xfcbad5);
    ckL.scale.set(1.3, 0.65, 0.35);
    const ckR = this.sphere(p, .24, 1.69, .34, .09, 0xfcbad5);
    ckR.scale.set(1.3, 0.65, 0.35);
    const heart = this.sphere(p, 0, 1.1, .25, .08, 0xf43f5e);
    heart.scale.set(0.9, 0.75, 0.4);
  }

  private buildCinnamorollMesh(): void {
    const p = this.group;
    const body = this.sphere(p, 0, 0.82, 0, .54, 0xf0f9ff);
    body.scale.set(0.94, 0.86, 0.80);
    const belly = this.sphere(p, 0, 0.79, .22, .37, 0xe0f2fe);
    belly.scale.set(0.86, 0.76, 0.46);
    const aL = this.sphere(p, -.54, 0.78, 0, .20, 0xf0f9ff);
    aL.scale.set(0.72, 0.65, 0.62);
    const aR = this.sphere(p, .54, 0.78, 0, .20, 0xf0f9ff);
    aR.scale.set(0.72, 0.65, 0.62);
    for (const x of [-.15, .15]) {
      const leg = this.box(p, x, 0.20, 0, 0.26, 0.40, 0.28, 0xf0f9ff);
      this.box(leg, 0, -.12, .04, .30, .13, .36, 0xbae6fd);
      this.legs.push(leg);
    }
    const head = this.sphere(p, 0, 1.80, 0, .57, 0xffffff);
    head.scale.set(1.0, 0.97, 0.96);

    const earLG = new THREE.Group();
    earLG.position.set(-.44, 1.96, 0);
    earLG.rotation.z = .55;
    const earLM = this.sphere(earLG, 0, .22, -.06, .25, 0xf0f9ff);
    earLM.scale.set(0.55, 1.28, 0.46);
    p.add(earLG);

    const earRG = new THREE.Group();
    earRG.position.set(.44, 1.96, 0);
    earRG.rotation.z = -.55;
    const earRM = this.sphere(earRG, 0, .22, -.06, .25, 0xf0f9ff);
    earRM.scale.set(0.55, 1.28, 0.46);
    p.add(earRG);

    const eL = this.sphere(p, -.19, 1.87, .50, .105, 0x0284c7);
    eL.scale.set(0.78, 1.05, 0.42);
    const eR = this.sphere(p, .19, 1.87, .50, .105, 0x0284c7);
    eR.scale.set(0.78, 1.05, 0.42);
    this.sphere(p, -.14, 1.90, .54, .042, 0xffffff);
    this.sphere(p, .23, 1.90, .54, .042, 0xffffff);
    const bL = this.sphere(p, -.33, 1.77, .44, .115, 0xfecdd3);
    bL.scale.set(1.35, 0.65, 0.36);
    const bR = this.sphere(p, .33, 1.77, .44, .115, 0xfecdd3);
    bR.scale.set(1.35, 0.65, 0.36);
    const nose = this.sphere(p, 0, 1.79, .54, .032, 0xffd0e6);
    nose.scale.set(1.2, 0.7, 0.5);
    const tail = this.sphere(p, 0, 0.80, -.54, .16, 0xf0f9ff);
    tail.scale.set(0.8, 0.8, 0.52);
    this.sphere(earLG, 0, .56, -.06, .09, 0xbae6fd);
    this.sphere(earRG, 0, .56, -.06, .09, 0xbae6fd);
  }
}
