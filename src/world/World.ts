import * as THREE from 'three';
import { BRIDGE_PARTS, WORLD } from '../data/config';
import { getCharacter, type AvatarId } from '../data/characters';
import { FLOWER_QUESTIONS } from '../data/flowerQuestions';
import { ARCHIMEDES_MONOLITHS } from '../data/archimedesTrialMap';
import { SpatialWorld, type PortalLink } from './SpatialWorld';
import type { RemoteZoneConfig } from '../data/remoteTypes';

interface Obstacle { x: number; z: number; radius: number }
interface Spark { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }

export interface FlowerItem {
  id: number;
  position: THREE.Vector3;
  group: THREE.Group;
  bud: THREE.Group;
  bloom: THREE.Group;
  beacon: THREE.Mesh;
  bloomed: boolean;
  bloomAnim: number;
  animating: boolean;
}

export interface MonolithItem {
  id: number;
  position: THREE.Vector3;
  group: THREE.Group;
  pedestal: THREE.Mesh;
  pillar: THREE.Mesh;
  crystal: THREE.Mesh;
  beam?: THREE.Mesh;
  activated: boolean;
  color: number;
  glowAnim: number;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
  readonly player = new THREE.Group();
  readonly milo = new THREE.Group();
  readonly bridge = new THREE.Group();
  readonly flowers: FlowerItem[] = [];
  readonly monoliths: MonolithItem[] = [];
  readonly goal = new THREE.Vector3(16, 0, 0);
  readonly keys = new Set<string>();
  readonly spatial = new SpatialWorld(-6, 6);
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private obstacles: Obstacle[] = [];
  private sparks: Spark[] = [];
  private clouds: THREE.Group[] = [];
  private windmill = new THREE.Group();
  private water: THREE.Mesh;
  private legs: THREE.Mesh[] = [];
  private avatarAccessories: THREE.Object3D[] = [];
  private clock = new THREE.Clock();
  private target = new THREE.Vector3(-5, 0, 0);
  private destination?: THREE.Vector3;
  private jumpVelocity = 0;
  private yaw = .57;
  private pitch = .8;
  private distance = 48;
  private bridgeCount = 0;
  private time = 0;
  private observer: ResizeObserver;
  private frame = 0;
  active = false;
  paused = false;
  joystick = { x: 0, y: 0 };
  onFrame?: (near: boolean, crossed: boolean, fps: number, nearFlower: number, nearPortal: boolean, nearMonolith: number) => void;
  onJump?: () => void;
  onSceneClick?: (near: boolean) => void;
  onFlowerClick?: (index: number) => void;
  onMonolithClick?: (index: number) => void;
  onPortalClick?: () => void;
  readonly portalPos = new THREE.Vector3(32, 0, 0);
  private portalGroups: THREE.Group[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xc9e9e5);
    this.scene.fog = new THREE.Fog(0xc9e9e5, 110, 320);
    this.scene.add(new THREE.HemisphereLight(0xf2fbff, 0x7d9870, 2.4));
    const sun = new THREE.DirectionalLight(0xfff0c9, 3.2);
    sun.position.set(-18, 45, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -40, right: 220, top: 90, bottom: -90, near: 1, far: 260 });
    sun.shadow.normalBias = .045; sun.shadow.bias = -.0003; this.scene.add(sun);
    this.terrain();
    this.water = this.box(this.scene, 7, -.05, 0, 6, .18, 40, 0x48b8cf); this.water.receiveShadow = true;
    for (let i = 0; i < 28; i++) {
      const foam = this.box(this.scene, 4.7 + (i % 4) * 1.35, .05, -18 + (i * 2.17) % 37, .35 + (i % 3) * .2, .025, .07, 0xb5f4ed);
      foam.userData.ripple = true;
    }
    this.village();
    this.createPlayer(); this.createMilo(); this.createBridge(); this.createFlowers(); this.createArchimedesPortals(); this.createArchimedesMonoliths(); this.decorate();
    this.scene.add(this.player, this.milo, this.bridge);
    this.player.position.set(-6, 0, 6); this.milo.position.set(-3, 0, 1.5);
    this.obstacles.push({ x: -3, z: 1.5, radius: .85 });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas.parentElement!); this.resize();
    let pointer = { x: 0, y: 0, moved: false, id: -1 };
    canvas.addEventListener('pointerdown', e => { if (!this.active || this.paused) return; pointer = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (pointer.id !== e.pointerId || !this.active || this.paused) return; const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y; if (Math.abs(dx) + Math.abs(dy) > 2) pointer.moved = true; this.yaw -= dx * .006; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .003, .45, 1.15); pointer.x = e.clientX; pointer.y = e.clientY; });
    canvas.addEventListener('pointerup', e => { if (pointer.id !== e.pointerId) return; if (!pointer.moved && !this.paused) this.moveToScreen(e.clientX, e.clientY); pointer.id = -1; });
    canvas.addEventListener('pointercancel', () => { pointer.id = -1; });
    canvas.addEventListener('wheel', e => { if (!this.active || this.paused) return; e.preventDefault(); this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * .025, 23, 60); }, { passive: false });
    this.animate();
  }

  private material(color: number) { let mat = this.materials.get(color); if (!mat) { mat = new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0 }); this.materials.set(color, mat); } return mat; }
  private mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(geo, this.material(color)); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number) { return this.mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z); }
  private sphere(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: number) { return this.mesh(parent, new THREE.IcosahedronGeometry(r, 1), color, x, y, z); }
  private cylinder(parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, h: number, color: number, segments = 8) { return this.mesh(parent, new THREE.CylinderGeometry(top, bottom, h, segments), color, x, y, z); }

  private createStoneTrail(x1: number, z1: number, x2: number, z2: number, count = 12) {
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = THREE.MathUtils.lerp(x1, x2, t);
      const z = THREE.MathUtils.lerp(z1, z2, t);
      const stone = this.box(this.scene, x, .05, z, 1.8, .06, 1.8, 0xead5a3);
      stone.rotation.y = (i * 0.3) % Math.PI;
    }
  }

  private terrain() {
    const islands: { cx: number; cz: number; w: number; d: number; grassColor: number; soilColor?: number }[] = [
      // 1. Starter Village
      { cx: -9, cz: 0, w: 26, d: 40, grassColor: 0x8ec963, soilColor: 0xb7976d },
      // 2. Flower Garden (Vườn Hoa Tri Thức)
      { cx: 22, cz: 0, w: 24, d: 40, grassColor: 0x8ec963, soilColor: 0xb7976d },
      // 3. Archimedes Gatehouse Hub (Đền Cổng Archimedes)
      { cx: 60, cz: 0, w: 22, d: 22, grassColor: 0x85c158, soilColor: 0x93a388 },
      // 4. Sanctuary 1 (Thung Lũng Tính Toán)
      { cx: 110, cz: -60, w: 24, d: 32, grassColor: 0x94c973, soilColor: 0xc49a6c },
      // 5. Sanctuary 2 (Suối Nguồn Dãy Số)
      { cx: 150, cz: -60, w: 24, d: 32, grassColor: 0x82c47c, soilColor: 0x769fb6 },
      // 6. Sanctuary 3 (Đồi Thời Gian)
      { cx: 110, cz: 60, w: 24, d: 32, grassColor: 0x8ec963, soilColor: 0x94a3b8 },
      // 7. Sanctuary 4 (Rừng Hình Học)
      { cx: 150, cz: 60, w: 28, d: 34, grassColor: 0x78ba65, soilColor: 0x5a8f6e },
      // 8. Sanctuary 5 (Đỉnh Núi Tư Duy Sao)
      { cx: 190, cz: 0, w: 22, d: 24, grassColor: 0x6aa85b, soilColor: 0x64748b }
    ];

    for (const isl of islands) {
      this.createSingleIsland(isl);
    }

    // Paths in starter village
    this.box(this.scene, -7, .055, 1, 21, .08, 3.2, 0xead5a3);
    this.box(this.scene, -10, .055, -4, 3.1, .08, 20, 0xead5a3);
    const plaza = this.cylinder(this.scene, -6, .07, 5, 4.5, 4.5, .1, 0xead5a3, 24);
    plaza.receiveShadow = true;

    // Paths in Vườn Hoa Tri Thức (new land)
    this.box(this.scene, 21.5, .055, 0, 23, .08, 3.2, 0xead5a3);
    this.box(this.scene, 22, .055, 0, 3.2, .08, 18, 0xead5a3);
    const gardenPlaza = this.cylinder(this.scene, 22, .07, 0, 4.5, 4.5, .1, 0xead5a3, 24);
    gardenPlaza.receiveShadow = true;

    for (let i = 0; i < 15; i++) {
      const stone = this.box(this.scene, -16 + i * 1.3, .12, 1 + Math.sin(i) * .8, .65, .08, .4, 0xf5e9ca);
      stone.rotation.y = i;
    }

    // Đền Cổng Archimedes (Gatehouse Hub at x: 60, z: 0)
    const hubPlaza = this.cylinder(this.scene, 60, .07, 0, 7.5, 7.5, .1, 0xdfd6c0, 24);
    hubPlaza.receiveShadow = true;
    this.cylinder(this.scene, 60, .14, 0, 5.5, 5.5, .06, 0x93a388, 8);

    // Central Compass Monument at x: 60, z: 0
    const monument = new THREE.Group();
    monument.position.set(60, 0, 0);
    this.cylinder(monument, 0, 0.6, 0, 0.9, 1.1, 1.2, 0x76876c, 8);
    this.cylinder(monument, 0, 2.2, 0, 0.45, 0.55, 2.2, 0x93a388, 8);
    const globe = this.sphere(monument, 0, 3.6, 0, 0.6, 0xffd54f);
    globe.userData.archimedesGlobe = true;
    for (let a = 0; a < 4; a++) {
      const ring = this.box(monument, 0, 3.6, 0, 1.5, 0.08, 1.5, 0x38bdf8);
      ring.rotation.x = a * Math.PI / 4;
    }
    this.scene.add(monument);
    this.obstacles.push({ x: 60, z: 0, radius: 1.5 });

    // Paths connecting Hub center to portals
    this.box(this.scene, 56, .055, 0, 8, .08, 2.8, 0xd5cbb2);
    this.createStoneTrail(60, 0, 68, -8, 5);
    this.createStoneTrail(60, 0, 70, -4, 5);
    this.createStoneTrail(60, 0, 70, 0, 5);
    this.createStoneTrail(60, 0, 70, 4, 5);
    this.createStoneTrail(60, 0, 68, 8, 5);

    // Landmarks and Paving for 5 Sanctuaries:
    // 1. Zone 1: Thung Lũng Tính Toán (x: 110, z: -60)
    this.cylinder(this.scene, 110, .07, -60, 4.5, 4.5, .1, 0xecd9b5, 16);
    this.box(this.scene, 105, .055, -60, 10, .08, 2.5, 0xecd9b5);
    this.cylinder(this.scene, 110, 1.6, -60, 0.7, 0.9, 3.2, 0xc49a6c, 6);
    this.box(this.scene, 113, 0.6, -58, 1.4, 1.2, 1.4, 0x9a7b56);
    this.obstacles.push({ x: 110, z: -60, radius: 1.3 });

    // 2. Zone 2: Suối Nguồn Dãy Số (x: 150, z: -60)
    this.cylinder(this.scene, 150, .07, -60, 4.5, 4.5, .1, 0xd8eaf4, 16);
    this.box(this.scene, 145, .055, -60, 10, .08, 2.5, 0xd8eaf4);
    this.box(this.scene, 150, 0.03, -60, 14, 0.08, 2.8, 0x38bdf8);
    for (let s = 0; s < 4; s++) {
      this.cylinder(this.scene, 144 + s * 4, 0.1 + s * 0.04, -60, 0.75, 0.75, 0.12, 0xf8fafc, 8);
    }
    this.cylinder(this.scene, 154, 1.5, -55, 0.1, 0.5, 2.8, 0x7dd3fc, 5);
    this.obstacles.push({ x: 154, z: -55, radius: 1.0 });

    // 3. Zone 3: Đồi Thời Gian (x: 110, z: 60)
    this.cylinder(this.scene, 110, .07, 60, 5.0, 5.0, .1, 0xe2e8f0, 24);
    this.box(this.scene, 105, .055, 60, 10, .08, 2.5, 0xe2e8f0);
    this.cylinder(this.scene, 110, 0.4, 60, 2.2, 2.4, 0.8, 0x94a3b8, 16);
    const gnomon = this.box(this.scene, 110, 1.2, 60, 0.14, 1.2, 1.2, 0xd97706);
    gnomon.rotation.x = 0.5;
    for (let h = 0; h < 12; h++) {
      const a = h * Math.PI / 6;
      this.box(this.scene, 110 + Math.cos(a) * 1.8, 0.45, 60 + Math.sin(a) * 1.8, 0.25, 0.08, 0.25, 0xf59e0b);
    }
    this.obstacles.push({ x: 110, z: 60, radius: 2.3 });

    // 4. Zone 4: Rừng Hình Học (x: 150, z: 60)
    this.cylinder(this.scene, 150, .07, 60, 5.0, 5.0, .1, 0xdcfce7, 16);
    this.box(this.scene, 144, .055, 60, 12, .08, 2.5, 0xdcfce7);
    this.cylinder(this.scene, 150, 1.8, 56, 0, 1.6, 3.5, 0x10b981, 4);
    this.box(this.scene, 146, 1.0, 64, 1.8, 1.8, 1.8, 0x059669);
    this.sphere(this.scene, 154, 1.5, 64, 1.1, 0x34d399);
    this.obstacles.push({ x: 150, z: 56, radius: 1.6 });

    // 5. Zone 5: Đỉnh Núi Tư Duy Sao (x: 190, z: 0)
    this.cylinder(this.scene, 190, 0.25, 0, 5.5, 5.8, 0.5, 0x334155, 16);
    this.cylinder(this.scene, 190, 0.55, 0, 3.8, 4.0, 0.3, 0x475569, 8);
    this.box(this.scene, 185.5, .055, 0, 9, .08, 2.5, 0xcbd5e1);
    this.cylinder(this.scene, 190, 1.8, 0, 0.55, 0.65, 2.5, 0xf59e0b, 8);
    this.sphere(this.scene, 190, 3.5, 0, 0.6, 0xfef08a);
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2;
      this.sphere(this.scene, 190 + Math.cos(a) * 2.2, 1.2, Math.sin(a) * 2.2, 0.3, 0x67e8f9);
    }
    this.obstacles.push({ x: 190, z: 0, radius: 1.5 });

    // Celestial Sea of Clouds under void between islands
    const cloudSea = new THREE.Group();
    for (let c = 0; c < 36; c++) {
      const cx = 35 + ((c * 19) % 170);
      const cz = -75 + ((c * 23) % 150);
      if (!this.spatial.isWithinLand(cx, cz)) {
        const cloud = this.sphere(cloudSea, cx, -1.8 + Math.sin(c) * 0.7, cz, 4.5 + (c % 4), 0xffffff);
        cloud.scale.set(1.4, 0.6, 1.4);
      }
    }
    this.scene.add(cloudSea);
  }

  public createSingleIsland(isl: { cx: number; cz: number; w: number; d: number; grassColor: number; soilColor?: number }) {
    const shape = new THREE.Shape();
    const left = -isl.w / 2, right = isl.w / 2, t = -isl.d / 2, b = isl.d / 2, r = 2;
    shape.moveTo(left + r, t);
    shape.lineTo(right - r, t);
    shape.quadraticCurveTo(right, t, right, t + r);
    shape.lineTo(right, b - r);
    shape.quadraticCurveTo(right, b, right - r, b);
    shape.lineTo(left + r, b);
    shape.quadraticCurveTo(left, b, left, b - r);
    shape.lineTo(left, t + r);
    shape.quadraticCurveTo(left, t, left + r, t);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .35, bevelThickness: .2 });
    geo.rotateX(-Math.PI / 2);
    const soil = new THREE.Mesh(geo, [this.material(isl.cx > 35 ? (isl.soilColor || 0x6e964b) : 0x88bb52), this.material(isl.soilColor || 0xb7976d)]);
    soil.position.set(isl.cx, -2.5, isl.cz);
    soil.receiveShadow = true;
    soil.castShadow = true;
    this.scene.add(soil);

    const grass = new THREE.ShapeGeometry(shape);
    grass.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(grass, this.material(isl.grassColor));
    top.position.set(isl.cx, .025, isl.cz);
    top.receiveShadow = true;
    this.scene.add(top);
  }

  private house(x: number, z: number, color: number, size = 1, rotate = 0) {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.scale.setScalar(size); h.rotation.y = rotate;
    this.box(h, 0, 1.5, 0, 3.6, 3, 3, 0xfff0ce);
    const roof = this.cylinder(h, 0, 3.5, 0, 0, 3.1, 2, color, 4); roof.rotation.y = Math.PI / 4; roof.scale.z = .95;
    this.box(h, -.85, 4.15, -.65, .5, 1.5, .6, 0xe9c6a0);
    this.box(h, -.35, .95, 1.53, .9, 1.9, .15, 0x835b41);
    this.sphere(h, -.08, .98, 1.65, .06, 0xf8d55c);
    this.box(h, 1, 1.55, 1.53, .8, .8, .12, 0x4d95a3);
    this.box(h, 1, 1.55, 1.61, .08, .84, .07, 0xffffff); this.box(h, 1, 1.55, 1.61, .84, .08, .07, 0xffffff);
    this.box(h, 1, 1.02, 1.7, 1.1, .22, .4, 0x9e6a44);
    for (let i = 0; i < 4; i++) this.sphere(h, .63 + i * .25, 1.23, 1.7, .18, i % 2 ? 0xffce58 : 0xf18e81);
    this.box(h, 0, .12, 1.85, 2.3, .25, .8, 0xd6c4a1);
    this.scene.add(h); this.obstacles.push({ x, z, radius: 2.35 * size });
  }

  private tree(x: number, z: number, size: number, variant = 0) {
    const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(size);
    this.cylinder(tree, 0, 1.1, 0, .18, .26, 2.2, 0x946b43);
    const greens = [0x3c9360, 0x56a45d, 0x76b351];
    if (variant % 3 === 0) {
      this.cylinder(tree, 0, 2.35, 0, 0, 1.35, 2.3, greens[variant % 3]); this.cylinder(tree, 0, 3.35, 0, 0, 1, 1.9, 0x61ad69);
    } else {
      this.sphere(tree, 0, 2.7, 0, 1.35, greens[variant % 3]); this.sphere(tree, -.7, 2.25, .25, .9, greens[(variant + 1) % 3]); this.sphere(tree, .6, 2.7, .3, .8, 0x81bf62);
      if (variant % 4 === 0) for (let i = 0; i < 4; i++) this.sphere(tree, Math.cos(i * 2) * .8, 2.4 + Math.sin(i) * .4, .85, .17, 0xf3a444);
    }
    this.scene.add(tree); this.obstacles.push({ x, z, radius: .45 * size });
  }

  private village() {
    this.house(-12, -6, 0xd88c55, 1.25); this.house(-17, 6, 0x528f91, .9, .25); this.house(-4, -11, 0xbd7063, 1);
    const mill = new THREE.Group(); mill.position.set(-15, 0, -14);
    this.cylinder(mill, 0, 2, 0, 1.2, 1.6, 4, 0xf1dfb3); this.cylinder(mill, 0, 4.7, 0, 0, 1.8, 1.9, 0x53918d);
    this.windmill.position.set(0, 3.2, 1.65);
    for (let i = 0; i < 4; i++) { const sail = new THREE.Group(); sail.rotation.z = i * Math.PI / 2; this.box(sail, 0, 1.6, 0, .18, 3, .18, 0x8c7049); this.box(sail, .4, 1.85, 0, .75, 1.7, .12, 0xfff1cb); this.windmill.add(sail); }
    this.sphere(this.windmill, 0, 0, .1, .25, 0xeab65b); mill.add(this.windmill); this.scene.add(mill); this.obstacles.push({ x: -15, z: -14, radius: 1.8 });

    // Trees encircling village and flower garden perimeter
    [
      [-20,-14,1.3],[-20,-8,1],[-20,0,1.1],[-20,13,1.3],[-14,14,1.1],[-7,16,1.4],[-2,13,1.1],[1,17,1.2],[0,-16,1.5],[1,-8,1],[-8,-17,1.2],
      [13,-15,1.3],[18,-17,1.5],[25,-16,1.2],[32,-12,1.3],[33,-5,1.1],[33,5,1.1],[32,12,1.3],[25,16,1.2],[18,17,1.5],[13,15,1.3]
    ].forEach(([x,z,s],i)=>this.tree(x,z,s,i));

    // 1. Entrance Flower Arch at x = 11.2, z = 0
    const arch = new THREE.Group(); arch.position.set(11.2, 0, 0);
    this.cylinder(arch, 0, 1.8, -2.2, .22, .26, 3.6, 0xc8baa0);
    this.sphere(arch, 0, 3.7, -2.2, .3, 0xe89758);
    this.cylinder(arch, 0, 1.8, 2.2, .22, .26, 3.6, 0xc8baa0);
    this.sphere(arch, 0, 3.7, 2.2, .3, 0xe89758);
    this.box(arch, 0, 3.6, 0, .45, .32, 4.8, 0x8d6e4f);
    this.box(arch, 0, 4.2, 0, .25, .8, 3.6, 0xfce9bf);
    for (let s = -1.8; s <= 1.8; s += .6) {
      this.sphere(arch, 0, 3.8 + Math.sin(s * 2) * .12, s, .16, 0x5aab59);
      this.sphere(arch, .15, 3.9 + Math.sin(s * 3) * .1, s, .12, 0xf48fb1);
    }
    this.scene.add(arch);
    this.obstacles.push({ x: 11.2, z: -2.2, radius: .5 }, { x: 11.2, z: 2.2, radius: .5 });

    // 2. Central Fountain of Knowledge at x = 22, z = 0
    const fountain = new THREE.Group(); fountain.position.set(22, 0, 0);
    this.cylinder(fountain, 0, .3, 0, 2.3, 2.4, .6, 0xcfc2a3, 20);
    this.cylinder(fountain, 0, .48, 0, 2.1, 2.1, .15, 0x4fc3f7, 20);
    this.cylinder(fountain, 0, 1.1, 0, .45, .6, 1.4, 0x9e8a6d, 12);
    this.cylinder(fountain, 0, 1.8, 0, 1.1, 1.2, .35, 0xcfc2a3, 16);
    this.cylinder(fountain, 0, 1.9, 0, .95, .95, .1, 0x81d4fa, 16);
    this.sphere(fountain, 0, 2.3, 0, .28, 0xffd54f);
    this.scene.add(fountain);
    this.obstacles.push({ x: 22, z: 0, radius: 2.3 });

    // 3. Garden Benches around Fountain
    [[-2.5, -2.5], [-2.5, 2.5], [2.5, -2.5], [2.5, 2.5]].forEach(([bx, bz]) => {
      const bxW = 22 + bx, bzW = bz;
      this.box(this.scene, bxW, .35, bzW, 1.6, .1, .55, 0xdcd1b8);
      this.box(this.scene, bxW - .55, .17, bzW, .15, .35, .45, 0x9e8a6d);
      this.box(this.scene, bxW + .55, .17, bzW, .15, .35, .45, 0x9e8a6d);
      this.obstacles.push({ x: bxW, z: bzW, radius: .7 });
    });

    // 4. Lantern posts in the garden
    [[14.5, -2.5], [14.5, 2.5], [29.5, -2.5], [29.5, 2.5]].forEach(([lx, lz]) => {
      this.cylinder(this.scene, lx, 1.5, lz, .06, .08, 3.0, 0x615243);
      this.box(this.scene, lx, 3.1, lz, .36, .45, .36, 0xffdf80);
      this.cylinder(this.scene, lx, 3.45, lz, 0, .3, .25, 0x4a3b2c, 4);
      this.obstacles.push({ x: lx, z: lz, radius: .3 });
    });

    const sign = new THREE.Group(); sign.position.set(.4, 0, 3.4); this.box(sign, 0, .7, 0, .17, 1.4, .17, 0x8c6947); this.box(sign, 0, 1.45, 0, 1.5, .65, .2, 0xb78a54); this.scene.add(sign);
  }

  private createFlowers() {
    const FLOWER_COORDS: [number, number][] = [
      [14, -6.0], [18, -6.0], [22, -8.5], [26, -6.0], [30, -6.0],
      [14, 6.0], [18, 6.0], [22, 8.5], [26, 6.0], [30, 6.0]
    ];
    const FLOWER_PALETTE = [0xf06292, 0xffb300, 0x42a5f5, 0xe91e63, 0xab47bc, 0xff7043, 0x26a69a, 0xffa726, 0x5c6bc0, 0xffd54f];
    FLOWER_COORDS.forEach(([x, z], i) => {
      const q = FLOWER_QUESTIONS[i];
      const flowerColor = q?.color ?? FLOWER_PALETTE[i % FLOWER_PALETTE.length];
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Elevated flowerbed pedestal
      this.cylinder(group, 0, .14, 0, 1.35, 1.45, .28, 0xd4c7a5, 16);
      this.cylinder(group, 0, .26, 0, 1.2, 1.2, .08, 0x422f1d, 16);

      // Small stone path connecting to main walk
      const connZ = z < 0 ? 1.4 : -1.4;
      this.box(group, 0, .05, connZ, 1.2, .08, 1.5, 0xead5a3);

      // Wooden signpost beside the flower with number
      const sign = new THREE.Group();
      sign.position.set(.85, 0, .85);
      this.cylinder(sign, 0, .45, 0, .05, .05, .9, 0x8a623f, 6);
      this.box(sign, 0, .85, 0, .45, .32, .08, 0xfce9bf);
      this.sphere(sign, 0, 1.1, 0, .1, flowerColor);
      group.add(sign);

      // Stem & Leaves
      this.cylinder(group, 0, .95, 0, .09, .13, 1.5, 0x3d8e35, 8);
      const leaf1 = this.box(group, .32, .75, 0, .45, .06, .22, 0x5cb85c);
      leaf1.rotation.z = .45;
      const leaf2 = this.box(group, -.32, 1.05, 0, .45, .06, .22, 0x5cb85c);
      leaf2.rotation.z = -.45;

      // Bud (unbloomed state)
      const bud = new THREE.Group();
      bud.position.set(0, 1.75, 0);
      this.cylinder(bud, 0, 0, 0, .22, .08, .3, 0x43a047, 6);
      const budBall = this.sphere(bud, 0, .18, 0, .28, flowerColor);
      budBall.scale.y = 1.3;
      const beacon = this.sphere(bud, 0, .75, 0, .13, 0xffd54f);
      beacon.userData.beacon = true;
      group.add(bud);

      // Bloom (radiant flower when answered)
      const bloom = new THREE.Group();
      bloom.position.set(0, 1.8, 0);
      bloom.scale.setScalar(0.001);
      this.sphere(bloom, 0, .06, 0, .32, 0xffd54f);
      for (let p = 0; p < 8; p++) {
        const angle = p * Math.PI / 4;
        const petal = this.box(bloom, Math.cos(angle) * .55, .02, Math.sin(angle) * .55, .36, .08, .55, flowerColor);
        petal.rotation.y = -angle;
        petal.rotation.x = .15;
      }
      group.add(bloom);

      this.scene.add(group);
      this.obstacles.push({ x, z, radius: 1.15 });

      this.flowers.push({
        id: i,
        position: new THREE.Vector3(x, 0, z),
        group,
        bud,
        bloom,
        beacon,
        bloomed: false,
        bloomAnim: 0,
        animating: false
      });
    });
  }

  private createPortalArch(x: number, z: number, color: number, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Stone base with steps
    this.cylinder(group, 0, .12, 0, 1.8, 2.0, .24, 0x8a927d, 12);
    this.cylinder(group, 0, .26, 0, 1.5, 1.7, .12, 0x5a634e, 12);

    // Two ancient pillars wide enough for player to pass through center
    this.cylinder(group, 0, 1.8, -1.5, .22, .28, 3.4, 0x93a388, 8);
    this.cylinder(group, 0, 1.8, 1.5, .22, .28, 3.4, 0x93a388, 8);

    // Grand Arch top
    this.box(group, 0, 3.5, 0, .6, .45, 3.6, 0x76876c);

    // Floating crystal prism above the arch
    const crystal = this.sphere(group, 0, 4.3, 0, .32, color);
    crystal.scale.set(0.7, 1.4, 0.7);
    crystal.userData.portalCrystal = true;

    // Glowing energy arch aura
    const portalEnergy = this.box(group, 0, 1.8, 0, .05, 3.0, 2.7, color);
    portalEnergy.userData.portalEnergy = true;

    this.scene.add(group);
    this.portalGroups.push(group);

    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    this.obstacles.push({ x: x - (-1.5) * sin, z: z + (-1.5) * cos, radius: .45 });
    this.obstacles.push({ x: x - 1.5 * sin, z: z + 1.5 * cos, radius: .45 });

    return group;
  }

  private createArchimedesPortals() {
    // 1. Garden -> Hub Portal
    this.createPortalArch(32, 0, 0x38bdf8, 0);

    // 2. Hub -> Garden Return Portal
    this.createPortalArch(52, 0, 0x22c55e, 0);

    // 3. Hub -> Zone 1 (Thung Lũng Tính Toán)
    this.createPortalArch(68, -8, 0xf59e0b, Math.PI / 4);

    // 4. Hub -> Zone 2 (Suối Nguồn Dãy Số)
    this.createPortalArch(70, -4, 0x06b6d4, Math.PI / 6);

    // 5. Hub -> Zone 3 (Đồi Thời Gian)
    this.createPortalArch(70, 0, 0x8b5cf6, 0);

    // 6. Hub -> Zone 4 (Rừng Hình Học)
    this.createPortalArch(70, 4, 0x10b981, -Math.PI / 6);

    // 7. Hub -> Zone 5 (Đỉnh Núi Tư Duy Sao)
    this.createPortalArch(68, 8, 0xec4899, -Math.PI / 4);

    // 8-12. Sanctuary Return Portals back to Hub
    this.createPortalArch(100, -60, 0x38bdf8, 0);
    this.createPortalArch(140, -60, 0x38bdf8, 0);
    this.createPortalArch(100, 60, 0x38bdf8, 0);
    this.createPortalArch(138, 60, 0x38bdf8, 0);
    this.createPortalArch(181, 0, 0x38bdf8, 0);
  }

  public createMonolithEntity(id: number | string, x: number, z: number, color: number, title?: string): MonolithItem {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 1. Pedestal base (stone cylinder)
    const pedestal = this.cylinder(group, 0, .14, 0, 1.35, 1.45, .28, 0x64748b, 12);
    this.cylinder(group, 0, .26, 0, 1.15, 1.15, .08, 0x334155, 12);

    // 2. Small stone approach path
    this.box(group, 0, .05, 1.3, 1.1, .08, 1.2, 0xd5cbb2);

    // 3. Obelisk column
    const pillar = this.box(group, 0, 1.1, 0, .68, 1.7, .68, 0x475569);

    // 4. Inscription plaque on front face (Bài number)
    this.box(group, 0, 1.3, .36, .52, .38, .06, 0xfef08a);

    // 5. Crown stone cap
    this.cylinder(group, 0, 2.02, 0, .45, .38, .16, 0x334155, 8);

    // 6. Floating Rune Crystal Beacon (Octahedron)
    const crystalGeo = new THREE.OctahedronGeometry(.32, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.5,
      metalness: 0.1
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 2.45, 0);
    crystal.castShadow = true;
    group.add(crystal);

    // 7. Celestial Light Beam (inactive at start)
    const beamGeo = new THREE.CylinderGeometry(.25, .45, 18, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 11.5, 0);
    beam.visible = false;
    group.add(beam);

    this.scene.add(group);
    this.obstacles.push({ x, z, radius: 1.35 });

    const numId = typeof id === 'number' ? id : parseInt(String(id), 10) || (306 + this.monoliths.length);
    const monolithItem: MonolithItem = {
      id: numId,
      position: new THREE.Vector3(x, 0, z),
      group,
      pedestal,
      pillar,
      crystal,
      beam,
      activated: false,
      color,
      glowAnim: 0
    };
    this.monoliths.push(monolithItem);
    return monolithItem;
  }

  private createArchimedesMonoliths() {
    ARCHIMEDES_MONOLITHS.forEach((m) => {
      this.createMonolithEntity(m.id, m.position.x, m.position.z, m.color, m.title);
    });
  }

  private dynamicIslandIds = new Set<number>();
  private dynamicObstacles: Obstacle[] = [];

  private createIslandScenery(z: {
    id: number;
    name: string;
    theme?: string;
    decorDensity?: string;
    center: { x: number; z: number };
    width: number;
    depth: number;
    color: number;
  }): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const theme = (z.theme || 'RUINS').toUpperCase();
    const density = (z.decorDensity || 'MEDIUM').toUpperCase();
    const countMult = density === 'HIGH' ? 1.4 : (density === 'LOW' ? 0.6 : 1.0);

    const halfW = z.width / 2;
    const halfD = z.depth / 2;
    const cx = z.center.x;
    const cz = z.center.z;

    const decorGroup = new THREE.Group();
    decorGroup.position.set(cx, 0, cz);

    if (theme === 'GARDEN') {
      // 1. Đài phun nước nhỏ ở giữa
      const fountain = new THREE.Group();
      fountain.position.set(0, 0, 0);
      this.cylinder(fountain, 0, .25, 0, 1.6, 1.8, .5, 0xdcd1b8, 16);
      this.cylinder(fountain, 0, .42, 0, 1.4, 1.4, .12, 0x38bdf8, 16);
      this.cylinder(fountain, 0, 1.0, 0, .3, .45, 1.1, 0x8a7051, 10);
      this.sphere(fountain, 0, 1.6, 0, .22, 0xfacc15);
      decorGroup.add(fountain);
      obstacles.push({ x: cx, z: cz, radius: 1.8 });

      // 2. Viền hoa xung quanh mép đảo
      const flowerCount = Math.round(12 * countMult);
      const flowerColors = [0xf43f5e, 0xec4899, 0xa855f7, 0x38bdf8, 0xfbbf24];
      for (let i = 0; i < flowerCount; i++) {
        const angle = (i / flowerCount) * Math.PI * 2;
        const fx = Math.cos(angle) * (halfW - 2.5);
        const fz = Math.sin(angle) * (halfD - 2.5);
        const col = flowerColors[i % flowerColors.length];
        this.sphere(decorGroup, fx, .2, fz, .35, col);
        this.sphere(decorGroup, fx, .1, fz, .45, 0x22c55e);
      }
    } else if (theme === 'RUINS') {
      // 1. Hàng cột đá cổ Hy Lạp ở 4 góc
      const colCorners = [
        [-halfW + 3.5, -halfD + 3.5],
        [halfW - 3.5, -halfD + 3.5],
        [-halfW + 3.5, halfD - 3.5],
        [halfW - 3.5, halfD - 3.5]
      ];
      colCorners.forEach(([ox, oz]) => {
        const pillar = new THREE.Group();
        pillar.position.set(ox, 0, oz);
        this.cylinder(pillar, 0, .2, 0, .9, 1.0, .35, 0x94a3b8, 10);
        this.cylinder(pillar, 0, 1.8, 0, .38, .45, 3.2, 0xcfd8dc, 8);
        this.cylinder(pillar, 0, 3.5, 0, .55, .42, .25, 0x94a3b8, 8);
        this.box(pillar, 0, 3.75, 0, 1.2, .25, 1.2, 0xe2e8f0);
        decorGroup.add(pillar);
        obstacles.push({ x: cx + ox, z: cz + oz, radius: 1.0 });
      });

      // 2. Tảng đá rêu phong
      const rockCount = Math.round(6 * countMult);
      for (let i = 0; i < rockCount; i++) {
        const angle = (i / rockCount) * Math.PI * 2 + 0.3;
        const rx = Math.cos(angle) * (halfW - 3);
        const rz = Math.sin(angle) * (halfD - 3);
        const stone = this.box(decorGroup, rx, .4, rz, 1.4, .8, 1.1, 0x64748b);
        stone.rotation.y = angle;
        obstacles.push({ x: cx + rx, z: cz + rz, radius: .9 });
      }
    } else if (theme === 'FOREST') {
      // 1. Cây cối xung quanh đảo
      const treeCount = Math.round(8 * countMult);
      for (let i = 0; i < treeCount; i++) {
        const angle = (i / treeCount) * Math.PI * 2;
        const tx = Math.cos(angle) * (halfW - 3.0);
        const tz = Math.sin(angle) * (halfD - 3.0);
        this.tree(cx + tx, cz + tz, 1.2, i);
        obstacles.push({ x: cx + tx, z: cz + tz, radius: .6 });
      }

      // 2. Nấm ma thuật phát sáng
      const shroomCount = Math.round(10 * countMult);
      const shroomColors = [0xef4444, 0xa855f7, 0xf97316];
      for (let i = 0; i < shroomCount; i++) {
        const angle = (i / shroomCount) * Math.PI * 2 + 0.4;
        const sx = Math.cos(angle) * (halfW * 0.6);
        const sz = Math.sin(angle) * (halfD * 0.6);
        this.cylinder(decorGroup, sx, .2, sz, .08, .12, .4, 0xf1f5f9, 6);
        this.sphere(decorGroup, sx, .45, sz, .28, shroomColors[i % shroomColors.length]);
      }
    } else if (theme === 'CRYSTAL') {
      // 1. Khối pha lê phát sáng
      const crystalCount = Math.round(8 * countMult);
      const crystalColors = [0x22d3ee, 0xc084fc, 0xf472b6, 0x38bdf8];
      for (let i = 0; i < crystalCount; i++) {
        const angle = (i / crystalCount) * Math.PI * 2;
        const kx = Math.cos(angle) * (halfW - 3.2);
        const kz = Math.sin(angle) * (halfD - 3.2);
        const cCol = crystalColors[i % crystalColors.length];

        const cGroup = new THREE.Group();
        cGroup.position.set(kx, 0, kz);
        this.cylinder(cGroup, 0, .15, 0, .8, .9, .3, 0x1e293b, 8);
        const cMesh = this.cylinder(cGroup, 0, 1.2, 0, 0, .35, 2.2, cCol, 6);
        cMesh.rotation.z = (i % 2 === 0 ? 0.15 : -0.15);
        decorGroup.add(cGroup);
        obstacles.push({ x: cx + kx, z: cz + kz, radius: .8 });
      }
    } else if (theme === 'VILLAGE') {
      // 1. Nhà gỗ nhỏ ở góc đảo
      const hx = -halfW + 5.5;
      const hz = -halfD + 5.5;
      this.house(cx + hx, cz + hz, 0xd97706, 0.85);
      obstacles.push({ x: cx + hx, z: cz + hz, radius: 2.0 });

      // 2. Hàng rào gỗ
      const fenceCount = Math.round(5 * countMult);
      for (let i = 0; i < fenceCount; i++) {
        const fx = halfW - 3;
        const fz = -halfD + 4 + i * 2.5;
        this.box(decorGroup, fx, .5, fz, .15, .8, 2.2, 0x854d0e);
        this.box(decorGroup, fx, .3, fz, .2, .15, 2.4, 0xa16207);
        obstacles.push({ x: cx + fx, z: cz + fz, radius: .5 });
      }
    }

    this.scene.add(decorGroup);
    return obstacles;
  }

  public renderDynamicZones(
    zones: RemoteZoneConfig[],
    positionedMonoliths: Array<{ id: number | string; position: { x: number; z: number }; color?: number; title?: string }> = []
  ) {
    const customPortals: PortalLink[] = [];

    // 1. Dựng các hòn đảo động và cảnh quan
    zones.forEach((z) => {
      if (z.id > 5 && z.id !== 6 && !this.dynamicIslandIds.has(z.id)) {
        this.createSingleIsland({
          cx: z.center.x,
          cz: z.center.z,
          w: z.width,
          d: z.depth,
          grassColor: z.color,
          soilColor: 0x93a388
        });
        this.dynamicIslandIds.add(z.id);

        // Sinh cảnh quan theo chủ đề
        const islandObs = this.createIslandScenery(z);
        this.dynamicObstacles.push(...islandObs);

        // Cổng kết nối từ Hub tới đảo mới
        const angle = ((this.portalGroups.length % 12) / 12) * Math.PI * 2;
        const hubX = 60 + Math.cos(angle) * 8.5;
        const hubZ = Math.sin(angle) * 8.5;
        this.createPortalArch(hubX, hubZ, z.color, angle + Math.PI / 2);

        // Cổng quay về từ đảo mới về Hub
        const retX = z.center.x - z.width / 2 + 3;
        const retZ = z.center.z;
        this.createPortalArch(retX, retZ, 0x38bdf8, 0);

        customPortals.push(
          {
            id: `hub_to_z${z.id}`,
            name: `Đến ${z.name}`,
            source: { x: hubX, z: hubZ },
            target: { x: retX + 2.5, z: retZ },
            triggerRadius: 1.5
          },
          {
            id: `z${z.id}_to_hub`,
            name: 'Về Đền Cổng Archimedes',
            source: { x: retX, z: retZ },
            target: { x: hubX - Math.cos(angle) * 2, z: hubZ - Math.sin(angle) * 2 },
            triggerRadius: 1.5
          }
        );
      }
    });

    // 2. Dọn dẹp bất kỳ bia đá nào bị sinh nhầm trong Vườn Hoa (id 1..10)
    for (let i = this.monoliths.length - 1; i >= 0; i--) {
      const m = this.monoliths[i];
      if (typeof m.id === 'number' && m.id <= 10) {
        this.scene.remove(m.group);
        this.monoliths.splice(i, 1);
      }
    }

    // 3. Dựng các bia đá mới nếu có
    const existingIds = new Set(this.monoliths.map((m) => m.id));
    positionedMonoliths.forEach((pm) => {
      const numId = typeof pm.id === 'number' ? pm.id : parseInt(String(pm.id), 10);
      if (isNaN(numId) || numId <= 10 || !pm.position) return;

      if (!existingIds.has(numId)) {
        this.createMonolithEntity(numId, pm.position.x, pm.position.z, pm.color || 0x38bdf8, pm.title);
        existingIds.add(numId);
      }
    });

    // 4. Đồng bộ hóa sang SpatialWorld
    const allPositions = positionedMonoliths.filter((pm) => pm.position).map((pm) => pm.position!);
    this.spatial.setDynamicData(zones, allPositions, customPortals, this.dynamicObstacles);
  }

  nearFlower(): number {
    return this.spatial.nearFlowerIndex();
  }

  bloomFlower(index: number) {
    const f = this.flowers[index];
    if (!f) return;
    f.bloomed = true;
    f.animating = true;
    f.bloomAnim = 0;
    this.burst(new THREE.Vector3(f.position.x, 2.0, f.position.z));
  }

  setFlowersBloomed(bloomedList: boolean[]) {
    this.flowers.forEach((f, i) => {
      const bloomed = bloomedList[i] === true;
      f.bloomed = bloomed;
      f.animating = false;
      f.bloomAnim = bloomed ? 1 : 0;
      f.bud.scale.setScalar(bloomed ? 0.001 : 1);
      f.bloom.scale.setScalar(bloomed ? 1 : 0.001);
    });
  }

  activateMonolith(index: number) {
    const m = this.monoliths[index];
    if (!m) return;
    m.activated = true;
    const mat = m.crystal.material as THREE.MeshStandardMaterial;
    mat.color.setHex(m.color);
    mat.emissive = new THREE.Color(m.color);
    mat.emissiveIntensity = 0.8;
    if (m.beam) m.beam.visible = true;
    this.burst(new THREE.Vector3(m.position.x, 2.5, m.position.z));
  }

  setMonolithsActivated(activatedList: boolean[]) {
    this.monoliths.forEach((m, i) => {
      const active = activatedList[i] === true;
      m.activated = active;
      const mat = m.crystal.material as THREE.MeshStandardMaterial;
      if (active) {
        mat.color.setHex(m.color);
        mat.emissive = new THREE.Color(m.color);
        mat.emissiveIntensity = 0.8;
        if (m.beam) m.beam.visible = true;
      } else {
        mat.color.setHex(0x64748b);
        mat.emissive = new THREE.Color(0x000000);
        mat.emissiveIntensity = 0;
        if (m.beam) m.beam.visible = false;
      }
    });
  }

  nearMonolith(): number {
    return this.spatial.nearMonolithIndex();
  }

  teleport(x: number, z: number) {
    this.spatial.teleport(x, z);
    this.player.position.set(x, this.spatial.floorHeight(), z);
    this.target.set(x, 0, z);
    this.destination = undefined;
    this.burst(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)));
  }


  private createPlayer() { this.buildBoyMesh(); }

  private createMilo() {
    this.cylinder(this.milo, 0, .65, 0, .45, .7, 1.25, 0x537e7e);
    this.sphere(this.milo, 0, 1.58, 0, .48, 0xffd4ab);
    this.cylinder(this.milo, 0, 2.15, 0, .08, .58, .95, 0x447676);
    this.cylinder(this.milo, 0, 1.82, 0, .75, .75, .12, 0x447676);
    for (const x of [-.16, .16]) this.sphere(this.milo, x, 1.6, .44, .045, 0x293d38);
    this.sphere(this.milo, 0, 1.28, .33, .22, 0xf6f0d9);
    this.box(this.milo, .7, .9, 0, .09, 1.8, .09, 0x9f7248); this.sphere(this.milo, .7, 1.9, 0, .19, 0xffd26a);
    const beacon = this.sphere(this.milo, 0, 3.0, 0, .19, 0xffcf5d); beacon.userData.beacon = true;
  }

  // ─── Clear all player mesh children and walking-leg refs ───────────────────
  private clearPlayerMesh() {
    while (this.player.children.length > 0) {
      const obj = this.player.children[0];
      this.player.remove(obj);
      obj.traverse(child => { if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).geometry.dispose(); });
    }
    this.legs = [];
    this.avatarAccessories = [];
  }

  // ─── BOY: classic adventurer ─────────────────────────────────────────────
  private buildBoyMesh() {
    const p = this.player;
    this.box(p, 0, .93, 0, .7, .8, .47, 0xebae42);
    this.sphere(p, 0, 1.67, 0, .45, 0xffd5ae);
    const hair = this.sphere(p, 0, 1.93, -.035, .43, 0x513c32); hair.scale.y = .65;
    for (const x of [-.16, .16]) { const leg = this.box(p, x, .3, 0, .25, .55, .28, 0x425f70); this.box(leg, 0, -.19, .08, .29, .16, .4, 0xfaf2d6); this.legs.push(leg); }
    this.box(p, -.48, .94, 0, .2, .65, .23, 0xffd5ae); this.box(p, .48, .94, 0, .2, .65, .23, 0xffd5ae);
    this.box(p, 0, 1, -.36, .52, .65, .3, 0x599989); this.box(p, 0, 1, -.54, .32, .25, .1, 0xf0cd76);
  }

  // ─── GIRL: explorer with ponytail ─────────────────────────────────────────
  private buildGirlMesh() {
    const p = this.player;
    this.box(p, 0, .93, 0, .7, .8, .47, 0x9774b8);
    this.sphere(p, 0, 1.67, 0, .45, 0xffd5ae);
    const hair = this.sphere(p, 0, 1.93, -.035, .43, 0x513c32); hair.scale.y = .65;
    this.sphere(p, 0, 1.66, -.39, .25, 0x513c32); // ponytail
    for (const x of [-.16, .16]) { const leg = this.box(p, x, .3, 0, .25, .55, .28, 0x425f70); this.box(leg, 0, -.19, .08, .29, .16, .4, 0xfaf2d6); this.legs.push(leg); }
    this.box(p, -.48, .94, 0, .2, .65, .23, 0xffd5ae); this.box(p, .48, .94, 0, .2, .65, .23, 0xffd5ae);
    this.box(p, 0, 1, -.36, .52, .65, .3, 0x9774b8); this.box(p, 0, 1, -.54, .32, .25, .1, 0xf0cd76);
  }

  // ─── KUROMI: gothic dark robed figure ────────────────────────────────────
  private buildKuromiMesh() {
    const p = this.player;
    // Long dark robe (taller + narrower than boy)
    this.box(p, 0, 0.9, 0, 0.60, 1.15, 0.42, 0x1a1a2e);
    // Pale slender arms
    this.box(p, -.43, .94, 0, .17, .62, .19, 0xf5f0ff);
    this.box(p, .43, .94, 0, .17, .62, .19, 0xf5f0ff);
    // Dark legs just visible below robe hem
    for (const x of [-.12, .12]) {
      const leg = this.box(p, x, 0.22, 0, 0.20, 0.44, 0.23, 0x1a1a2e);
      this.box(leg, 0, -.16, .06, .24, .13, .34, 0x2d1a4e);
      this.legs.push(leg);
    }
    // White oval face
    const face = this.sphere(p, 0, 1.72, .04, .38, 0xffffff); face.scale.set(0.95, 1.0, 0.88);
    // Small dark beady eyes
    const eL = this.sphere(p, -.14, 1.77, .37, .065, 0x0a0520); eL.scale.set(0.8, 1.0, 0.5);
    const eR = this.sphere(p, .14, 1.77, .37, .065, 0x0a0520); eR.scale.set(0.8, 1.0, 0.5);
    // Large black hood covering top of head
    const hood = this.sphere(p, 0, 1.99, 0, .46, 0x1a1a2e); hood.scale.set(1.0, 0.80, 0.95);
    // Pointed hood tip (iconic Kuromi spike)
    this.cylinder(p, 0, 2.44, 0, 0.04, 0.22, 0.56, 0x1a1a2e, 6);
    // Tiny white skull on front of hood
    const skull = this.sphere(p, 0, 2.12, .42, .10, 0xf5f0ff); skull.scale.set(1, 0.85, 0.7);
    // Skull eye dots
    this.sphere(p, -.04, 2.14, .50, .025, 0x1a1a2e);
    this.sphere(p, .04, 2.14, .50, .025, 0x1a1a2e);
    // Purple bow on hood tip
    const bL = this.sphere(p, -.13, 2.56, 0, .12, 0x7c3aed); bL.scale.set(1.0, 0.65, 0.5);
    const bR = this.sphere(p, .13, 2.56, 0, .12, 0x7c3aed); bR.scale.set(1.0, 0.65, 0.5);
    this.sphere(p, 0, 2.56, 0, .055, 0x0a0520);
  }

  // ─── HELLO KITTY: round white cat ────────────────────────────────────────
  private buildHelloKittyMesh() {
    const p = this.player;
    // Chubby white body
    this.box(p, 0, 0.80, 0, 0.84, 0.80, 0.54, 0xffffff);
    // Red overalls front bib
    this.box(p, 0, 0.86, 0.28, 0.66, 0.68, 0.06, 0xe11d48);
    // Short wide arms
    this.box(p, -.56, 0.84, 0, .20, .54, .24, 0xffffff);
    this.box(p, .56, 0.84, 0, .20, .54, .24, 0xffffff);
    // Short stumpy legs with red boots
    for (const x of [-.18, .18]) {
      const leg = this.box(p, x, 0.20, 0, 0.28, 0.40, 0.30, 0xfcd5e0);
      this.box(leg, 0, -.12, .04, .30, .12, .38, 0xff4d6d);
      this.legs.push(leg);
    }
    // Very large round white head (signature big head)
    this.sphere(p, 0, 1.82, 0, .58, 0xffffff);
    // Round cat ears
    const earL = this.sphere(p, -.38, 2.36, 0, .17, 0xffffff); earL.scale.set(0.9, 0.85, 0.7);
    this.sphere(p, -.38, 2.37, .09, .08, 0xffd0e6); // inner ear pink
    const earR = this.sphere(p, .38, 2.36, 0, .17, 0xffffff); earR.scale.set(0.9, 0.85, 0.7);
    this.sphere(p, .38, 2.37, .09, .08, 0xffd0e6);
    // BIG RED BOW on right ear (iconic)
    const bwL = this.sphere(p, .22, 2.41, .07, .17, 0xe11d48); bwL.scale.set(0.98, 0.65, 0.52);
    const bwR = this.sphere(p, .52, 2.41, .07, .17, 0xe11d48); bwR.scale.set(0.98, 0.65, 0.52);
    this.sphere(p, .37, 2.41, .09, .075, 0xb91c1c); // bow knot center
    // Two tiny oval eyes (no mouth on Hello Kitty!)
    const eyeL = this.sphere(p, -.19, 1.86, .53, .07, 0x111111); eyeL.scale.set(0.7, 1.1, 0.4);
    const eyeR = this.sphere(p, .19, 1.86, .53, .07, 0x111111); eyeR.scale.set(0.7, 1.1, 0.4);
    // Tiny yellow nose dot
    this.sphere(p, 0, 1.79, .55, .032, 0xffd700);
    // Whisker suggestion (3 tiny dots each side)
    for (let i = 0; i < 3; i++) {
      this.sphere(p, -.22 - i * .1, 1.80 + (i - 1) * .04, .52, .015, 0xcccccc);
      this.sphere(p, .22 + i * .1, 1.80 + (i - 1) * .04, .52, .015, 0xcccccc);
    }
    // Gold collar ribbon
    this.box(p, 0, 1.28, .22, .52, .07, .05, 0xfbbf24);
  }

  // ─── MY MELODY: pink bunny with hood ─────────────────────────────────────
  private buildMyMelodyMesh() {
    const p = this.player;
    // Soft pink rounded dress
    this.box(p, 0, 0.88, 0, 0.70, 0.92, 0.48, 0xfce7f3);
    // Arms
    this.box(p, -.47, .92, 0, .20, .60, .22, 0xfdf2f8);
    this.box(p, .47, .92, 0, .20, .60, .22, 0xfdf2f8);
    // Pink legs below dress
    for (const x of [-.15, .15]) {
      const leg = this.box(p, x, 0.22, 0, 0.22, 0.44, 0.25, 0xfce7f3);
      this.box(leg, 0, -.13, .04, .26, .12, .32, 0xf9a8d4); // pink shoes
      this.legs.push(leg);
    }
    // White round face
    const face = this.sphere(p, 0, 1.72, 0, .40, 0xfff5f8); face.scale.set(0.95, 1.0, 0.92);
    // Pink bunny hood covering back of head
    const hood = this.sphere(p, 0, 1.92, -.07, .48, 0xfce7f3); hood.scale.set(1.06, 0.90, 1.0);
    // Left bunny ear inside hood (signature tall pink ears)
    const earLG = new THREE.Group(); earLG.position.set(-.20, 2.06, -.04); earLG.rotation.z = .20;
    this.cylinder(earLG, 0, .30, 0, .082, .10, .64, 0xfce7f3, 6);
    this.cylinder(earLG, 0, .30, .02, .046, .056, .50, 0xf9a8d4, 6);
    p.add(earLG);
    // Right bunny ear
    const earRG = new THREE.Group(); earRG.position.set(.20, 2.06, -.04); earRG.rotation.z = -.20;
    this.cylinder(earRG, 0, .30, 0, .082, .10, .64, 0xfce7f3, 6);
    this.cylinder(earRG, 0, .30, .02, .046, .056, .50, 0xf9a8d4, 6);
    p.add(earRG);
    // Small black eyes
    const eL = this.sphere(p, -.13, 1.76, .36, .07, 0x111111); eL.scale.set(0.8, 1.0, 0.5);
    const eR = this.sphere(p, .13, 1.76, .36, .07, 0x111111); eR.scale.set(0.8, 1.0, 0.5);
    // Small pink oval nose
    const nose = this.sphere(p, 0, 1.68, .38, .055, 0xf9a8d4); nose.scale.set(1.2, 0.7, 0.5);
    // Tiny rosy cheeks
    const ckL = this.sphere(p, -.24, 1.69, .34, .09, 0xfcbad5); ckL.scale.set(1.3, 0.65, 0.35);
    const ckR = this.sphere(p, .24, 1.69, .34, .09, 0xfcbad5); ckR.scale.set(1.3, 0.65, 0.35);
    // Red heart detail on dress
    const heart = this.sphere(p, 0, 1.1, .25, .08, 0xf43f5e); heart.scale.set(0.9, 0.75, 0.4);
  }

  // ─── CINNAMOROLL: chubby white puppy ─────────────────────────────────────
  private buildCinnamorollMesh() {
    const p = this.player;
    // Very round chubby white body
    const body = this.sphere(p, 0, 0.82, 0, .54, 0xf0f9ff); body.scale.set(0.94, 0.86, 0.80);
    // Light blue belly highlight
    const belly = this.sphere(p, 0, 0.79, .22, .37, 0xe0f2fe); belly.scale.set(0.86, 0.76, 0.46);
    // Small round arms/paws
    const aL = this.sphere(p, -.54, 0.78, 0, .20, 0xf0f9ff); aL.scale.set(0.72, 0.65, 0.62);
    const aR = this.sphere(p, .54, 0.78, 0, .20, 0xf0f9ff); aR.scale.set(0.72, 0.65, 0.62);
    // Very short stubby legs with blue feet
    for (const x of [-.15, .15]) {
      const leg = this.box(p, x, 0.20, 0, 0.26, 0.40, 0.28, 0xf0f9ff);
      this.box(leg, 0, -.12, .04, .30, .13, .36, 0xbae6fd); // sky-blue foot
      this.legs.push(leg);
    }
    // Very large round white head (biggest head of all characters)
    const head = this.sphere(p, 0, 1.80, 0, .57, 0xffffff); head.scale.set(1.0, 0.97, 0.96);
    // Large floppy left ear (drooping down the side)
    const earLG = new THREE.Group(); earLG.position.set(-.44, 1.96, 0); earLG.rotation.z = .55;
    const earLM = this.sphere(earLG, 0, .22, -.06, .25, 0xf0f9ff); earLM.scale.set(0.55, 1.28, 0.46);
    p.add(earLG);
    // Large floppy right ear
    const earRG = new THREE.Group(); earRG.position.set(.44, 1.96, 0); earRG.rotation.z = -.55;
    const earRM = this.sphere(earRG, 0, .22, -.06, .25, 0xf0f9ff); earRM.scale.set(0.55, 1.28, 0.46);
    p.add(earRG);
    // Large expressive blue eyes (Cinnamoroll's most iconic feature)
    const eL = this.sphere(p, -.19, 1.87, .50, .105, 0x0284c7); eL.scale.set(0.78, 1.05, 0.42);
    const eR = this.sphere(p, .19, 1.87, .50, .105, 0x0284c7); eR.scale.set(0.78, 1.05, 0.42);
    // Eye shine dots
    this.sphere(p, -.14, 1.90, .54, .042, 0xffffff);
    this.sphere(p, .23, 1.90, .54, .042, 0xffffff);
    // Rosy blush cheeks
    const bL = this.sphere(p, -.33, 1.77, .44, .115, 0xfecdd3); bL.scale.set(1.35, 0.65, 0.36);
    const bR = this.sphere(p, .33, 1.77, .44, .115, 0xfecdd3); bR.scale.set(1.35, 0.65, 0.36);
    // Tiny pink nose
    const nose = this.sphere(p, 0, 1.79, .54, .032, 0xffd0e6); nose.scale.set(1.2, 0.7, 0.5);
    // Small curled tail at back
    const tail = this.sphere(p, 0, 0.80, -.54, .16, 0xf0f9ff); tail.scale.set(0.8, 0.8, 0.52);
    // Blue stripe on each ear tip (Cinnamoroll's detail)
    this.sphere(earLG, 0, .56, -.06, .09, 0xbae6fd);
    this.sphere(earRG, 0, .56, -.06, .09, 0xbae6fd);
  }

  // ─── Dispatch: clear player mesh and rebuild for given avatar ─────────────
  setAvatar(avatarId: AvatarId) {
    this.clearPlayerMesh();
    switch (avatarId) {
      case 'boy':         this.buildBoyMesh();          break;
      case 'girl':        this.buildGirlMesh();         break;
      case 'kuromi':      this.buildKuromiMesh();       break;
      case 'hellokitty':  this.buildHelloKittyMesh();   break;
      case 'mymelody':    this.buildMyMelodyMesh();     break;
      case 'cinnamoroll': this.buildCinnamorollMesh();  break;
    }
  }

  private createBridge() {
    for (let i = 0; i < BRIDGE_PARTS; i++) {
      const part = new THREE.Group(); part.position.x = WORLD.riverMin + i + .5;
      this.box(part, 0, .12, 0, .97, .35, WORLD.bridgeWidth, 0xc3b895);
      this.box(part, 0, .33, 0, .86, .06, WORLD.bridgeWidth - .15, 0xe5d6ae);
      for (const z of [-1.6, 1.6]) { this.box(part, 0, .9, z, .17, 1.3, .17, 0xa98458); this.box(part, 0, 1.35, z, 1.08, .12, .15, 0xbfa479); }
      part.visible = false; this.bridge.add(part);
    }
    for (const x of [3.6, 10.4]) for (const z of [-1.85, 1.85]) { this.cylinder(this.scene, x, .65, z, .23, .3, 1.3, 0xcac09e); this.sphere(this.scene, x, 1.4, z, .28, 0xf4d37c); }
  }

  setBridge(count: number, animate = false) {
    this.bridgeCount = count;
    this.spatial.setBridgeBuilt(count);
    this.bridge.children.forEach((part, i) => { part.visible = i < count; if (animate && i === count - 1) { part.position.y = 3; this.burst(new THREE.Vector3(part.position.x, .8, 0)); } });
  }

  private decorate() {
    let seed = 48; const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.11, 0), this.material(0xffe1a1), 220);
    const stems = new THREE.InstancedMesh(new THREE.ConeGeometry(.1, .35, 3), this.material(0x61a450), 220);
    const dummy = new THREE.Object3D(); let n = 0;
    while (n < 220) {
      const x = random() * 52 - 21, z = random() * 37 - 18.5;
      if ((x > 3.4 && x < 10.5) || Math.abs(z) < 2 || (x > 10.5 && x < 33 && Math.abs(z) < 3.2) || Math.hypot(x - 22, z) < 3.5) continue;
      dummy.position.set(x, .19, z); dummy.rotation.y = random() * 6; dummy.updateMatrix(); stems.setMatrixAt(n, dummy.matrix);
      dummy.position.y = .39; dummy.updateMatrix(); flowers.setMatrixAt(n, dummy.matrix);
      flowers.setColorAt(n, new THREE.Color([0xffe4a3, 0xf5f0d7, 0xe9a98e, 0xbdabe0][n % 4])); n++;
    }
    this.scene.add(flowers, stems);
    for (let i = 0; i < 10; i++) {
      const cloud = new THREE.Group(); cloud.position.set(-36 + i * 8, 10 + (i % 3) * 2, -27 - (i % 2) * 7);
      for (let j = 0; j < 4; j++) { const ball = this.sphere(cloud, j * 1.1, Math.sin(j) * .35, 0, .95 + (j % 2) * .4, 0xf4fcf5); ball.scale.set(1.4, .65, 1); ball.castShadow = false; }
      this.scene.add(cloud); this.clouds.push(cloud);
    }
    for (let i = 0; i < 9; i++) { const rock = this.sphere(this.scene, -20 + i * 5, -2.4, 21, .8, 0xb9ac8e); rock.scale.set(1.3, .7, .9); }
  }

  private resize() { const { clientWidth: w, clientHeight: h } = this.canvas; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  private floorHeight() { return this.spatial.floorHeight(); }
  jump() { if (this.active && !this.paused && this.spatial.jump()) { this.onJump?.(); } }
  clearInput() { this.keys.clear(); this.joystick = { x: 0, y: 0 }; this.destination = undefined; }
  resetCamera() { this.yaw = .57; this.pitch = .8; this.distance = 48; }

  private moveToScreen(x: number, y: number) {
    const rect = this.canvas.getBoundingClientRect(); const pointer = new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, this.camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
      if (hit.distanceTo(this.milo.position) < 2.8 && this.nearMilo()) { this.onSceneClick?.(true); return; }
      if (hit.distanceTo(this.portalPos) < 3.2 && this.spatial.isNearPortal()) {
        this.onPortalClick?.();
        return;
      }
      const nearFlowerIdx = this.nearFlower();
      if (nearFlowerIdx !== -1 && hit.distanceTo(this.flowers[nearFlowerIdx].position) < 3.0) {
        this.onFlowerClick?.(nearFlowerIdx);
        return;
      }
      for (let i = 0; i < this.flowers.length; i++) {
        if (hit.distanceTo(this.flowers[i].position) < 2.5 && this.nearFlower() === i) {
          this.onFlowerClick?.(i);
          return;
        }
      }
      const nearMonolithIdx = this.nearMonolith();
      if (nearMonolithIdx !== -1 && hit.distanceTo(this.monoliths[nearMonolithIdx].position) < 3.2) {
        this.onMonolithClick?.(nearMonolithIdx);
        return;
      }
      for (let i = 0; i < this.monoliths.length; i++) {
        if (hit.distanceTo(this.monoliths[i].position) < 2.8) {
          if (this.nearMonolith() === i) {
            this.onMonolithClick?.(i);
            return;
          } else {
            this.destination = this.monoliths[i].position.clone();
            return;
          }
        }
      }
      this.destination = hit;
    }
  }

  nearMilo() { return this.spatial.isNearMilo(); }

  private movement(dt: number) {
    const dest = this.destination ? { x: this.destination.x, z: this.destination.z } : undefined;
    const pose = this.spatial.tick(dt, { keys: this.keys, joystick: this.joystick, destination: dest }, this.yaw);
    this.player.position.set(pose.x, pose.y, pose.z);
    this.player.rotation.y = pose.rotation;
    if (pose.moving) {
      this.legs.forEach((leg, i) => leg.rotation.x = Math.sin(this.time * 12 + i * Math.PI) * .55);
    } else {
      this.legs.forEach(leg => leg.rotation.x *= .8);
      if (this.destination) this.destination = undefined;
    }
  }

  burst(position: THREE.Vector3) {
    for (let i = 0; i < 20; i++) { const mesh = this.sphere(this.scene, position.x, position.y, position.z, .09, [0xffd164, 0xfff4c7, 0x7dd4b5, 0xf06292][i % 4]); mesh.castShadow = false; this.sparks.push({ mesh, life: 1.2, velocity: new THREE.Vector3((Math.random() - .5) * 5, 3 + Math.random() * 3, (Math.random() - .5) * 5) }); }
  }

  project(point: THREE.Vector3) { const v = point.clone().project(this.camera); return { x: (v.x * .5 + .5) * this.canvas.clientWidth, y: (-.5 * v.y + .5) * this.canvas.clientHeight, visible: v.z < 1 }; }

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate); const dt = Math.min(this.clock.getDelta(), .05); this.time += dt;
    if (this.active && !this.paused) this.movement(dt);
    const wanted = this.active ? new THREE.Vector3(this.player.position.x, 0, this.player.position.z) : new THREE.Vector3(-7, 0, 0);
    this.target.lerp(wanted, 1 - Math.exp(-dt * 3));
    const distance = this.active ? this.distance : (this.camera.aspect < .85 ? 69 : 59);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance, this.target.y + Math.sin(this.pitch) * distance, this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance);
    this.camera.lookAt(this.target); this.windmill.rotation.z -= dt * .25;
    this.bridge.children.forEach(p => p.position.y = Math.max(0, p.position.y - dt * 5));
    this.clouds.forEach((c, i) => { c.position.x += dt * .12; if (c.position.x > 50) c.position.x = -50; c.position.y = 11 + (i % 3) * 2 + Math.sin(this.time * .2 + i) * .3; });
    this.milo.children.forEach(o => { if (o.userData.beacon) o.position.y = 3 + Math.sin(this.time * 2) * .15; });

    // Animate the 10 flowers
    this.flowers.forEach((f, i) => {
      if (f.beacon) {
        f.beacon.position.y = .75 + Math.sin(this.time * 2.5 + i) * .12;
        f.beacon.visible = !f.bloomed;
      }
      if (f.animating) {
        f.bloomAnim = Math.min(1, f.bloomAnim + dt * 2.0);
        if (f.bloomAnim >= 1) {
          f.bloomAnim = 1;
          f.animating = false;
        }
        const s = THREE.MathUtils.lerp(0.001, 1.0, f.bloomAnim);
        f.bloom.scale.setScalar(s);
        f.bud.scale.setScalar(Math.max(0.001, 1 - f.bloomAnim));
        if (Math.random() < 0.25) {
          this.burst(new THREE.Vector3(f.position.x, 2.0, f.position.z));
        }
      }
      if (f.bloomed) {
        f.bloom.rotation.y += dt * 0.35;
      }
    });

    // Animate the 40 Archimedes monoliths
    this.monoliths.forEach(m => {
      if (m.activated) {
        m.crystal.rotation.y += dt * 2.8;
        m.crystal.position.y = 2.45 + Math.sin(this.time * 3 + m.id) * 0.12;
        if (m.beam) {
          m.beam.rotation.y += dt * 0.4;
        }
      } else {
        m.crystal.rotation.y += dt * 0.8;
      }
    });

    for (let i = this.sparks.length - 1; i >= 0; i--) { const s = this.sparks[i]; s.life -= dt; s.velocity.y -= dt * 6; s.mesh.position.addScaledVector(s.velocity, dt); s.mesh.scale.setScalar(Math.max(0, s.life)); if (s.life <= 0) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); this.sparks.splice(i, 1); } }
    this.scene.children.forEach(o => { if (o.userData.ripple) o.position.z += dt * .25; if (o.userData.ripple && o.position.z > 19) o.position.z = -19; });
    this.portalGroups.forEach(pg => {
      pg.children.forEach(o => {
        if (o.userData.portalCrystal) {
          o.rotation.y += dt * 1.5;
          o.position.y = 4.3 + Math.sin(this.time * 2.5) * .12;
        }
        if (o.userData.portalEnergy) {
          o.scale.z = 1.0 + Math.sin(this.time * 4) * 0.04;
        }
      });
    });
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.spatial.isNearMilo(), this.spatial.hasCrossedRiver(), 1 / Math.max(dt, .001), this.spatial.nearFlowerIndex(), this.spatial.isNearPortal(), this.spatial.nearMonolithIndex());
  };


  dispose() { cancelAnimationFrame(this.frame); this.observer.disconnect(); this.renderer.dispose(); }
}
