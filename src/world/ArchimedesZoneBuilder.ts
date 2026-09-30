import * as THREE from 'three';
import { ARCHIMEDES_MONOLITHS } from '../data/archimedesTrialMap';
import type { GeometryBuilder } from './geom';

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
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

/**
 * Deep module encapsulating the Archimedes Realm structures:
 * - Grand portal arches and dynamic dimension gates
 * - Trial monoliths, crystals, beacon columns, and celestial beams
 * - Monolith activation states and glow/spin tick animations
 */
export class ArchimedesZoneBuilder {
  readonly monoliths: MonolithItem[] = [];
  readonly portalGroups: THREE.Group[] = [];

  constructor(
    private scene: THREE.Scene,
    private geom: GeometryBuilder,
    private obstacles: Obstacle[]
  ) {}

  createPortalArch(x: number, z: number, color: number, rotationY = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Stone base with steps
    this.geom.cylinder(group, 0, .12, 0, 1.8, 2.0, .24, 0x8a927d, 12);
    this.geom.cylinder(group, 0, .26, 0, 1.5, 1.7, .12, 0x5a634e, 12);

    // Two ancient pillars wide enough for player to pass through center
    this.geom.cylinder(group, 0, 1.8, -1.5, .22, .28, 3.4, 0x93a388, 8);
    this.geom.cylinder(group, 0, 1.8, 1.5, .22, .28, 3.4, 0x93a388, 8);

    // Grand Arch top
    this.geom.box(group, 0, 3.5, 0, .6, .45, 3.6, 0x76876c);

    // Floating crystal prism above the arch
    const crystal = this.geom.sphere(group, 0, 4.3, 0, .32, color);
    crystal.scale.set(0.7, 1.4, 0.7);
    crystal.userData.portalCrystal = true;

    // Glowing energy arch aura
    const portalEnergy = this.geom.box(group, 0, 1.8, 0, .05, 3.0, 2.7, color);
    portalEnergy.userData.portalEnergy = true;

    this.scene.add(group);
    this.portalGroups.push(group);

    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    this.obstacles.push({ x: x - (-1.5) * sin, z: z + (-1.5) * cos, radius: .45 });
    this.obstacles.push({ x: x - 1.5 * sin, z: z + 1.5 * cos, radius: .45 });

    return group;
  }

  createArchimedesPortals(): void {
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

  createMonolithEntity(id: number | string, x: number, z: number, color: number, title?: string): MonolithItem {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 1. Pedestal base (stone cylinder)
    const pedestal = this.geom.cylinder(group, 0, .14, 0, 1.35, 1.45, .28, 0x64748b, 12);
    this.geom.cylinder(group, 0, .26, 0, 1.15, 1.15, .08, 0x334155, 12);

    // 2. Small stone approach path
    this.geom.box(group, 0, .05, 1.3, 1.1, .08, 1.2, 0xd5cbb2);

    // 3. Obelisk column
    const pillar = this.geom.box(group, 0, 1.1, 0, .68, 1.7, .68, 0x475569);

    // 4. Inscription plaque on front face (Bài number)
    this.geom.box(group, 0, 1.3, .36, .52, .38, .06, 0xfef08a);

    // 5. Crown stone cap
    this.geom.cylinder(group, 0, 2.02, 0, .45, .38, .16, 0x334155, 8);

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

  createArchimedesMonoliths(): void {
    ARCHIMEDES_MONOLITHS.forEach((m) => {
      this.createMonolithEntity(m.id, m.position.x, m.position.z, m.color, m.title);
    });
  }

  removeGardenMonoliths(): void {
    for (let i = this.monoliths.length - 1; i >= 0; i--) {
      const m = this.monoliths[i];
      if (typeof m.id === 'number' && m.id <= 10) {
        this.scene.remove(m.group);
        this.monoliths.splice(i, 1);
      }
    }
  }

  activateMonolith(index: number, burstFn?: (pos: THREE.Vector3) => void): void {
    const m = this.monoliths[index];
    if (!m) return;
    m.activated = true;
    const mat = m.crystal.material as THREE.MeshStandardMaterial;
    mat.color.setHex(m.color);
    mat.emissive = new THREE.Color(m.color);
    mat.emissiveIntensity = 0.8;
    if (m.beam) m.beam.visible = true;
    burstFn?.(new THREE.Vector3(m.position.x, 2.5, m.position.z));
  }

  setMonolithsActivated(activatedList: boolean[]): void {
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

  updateAnimations(dt: number, time: number): void {
    this.monoliths.forEach((m) => {
      if (m.activated) {
        m.crystal.rotation.y += dt * 2.8;
        m.crystal.position.y = 2.45 + Math.sin(time * 3 + m.id) * 0.12;
        if (m.beam) {
          m.beam.rotation.y += dt * 0.4;
        }
      } else {
        m.crystal.rotation.y += dt * 0.8;
      }
    });

    this.portalGroups.forEach((pg) => {
      pg.children.forEach((o) => {
        if (o.userData.portalCrystal) {
          o.rotation.y += dt * 1.5;
          o.position.y = 4.3 + Math.sin(time * 2.5) * 0.12;
        }
        if (o.userData.portalEnergy) {
          o.scale.z = 1.0 + Math.sin(time * 4) * 0.04;
        }
      });
    });
  }
}
