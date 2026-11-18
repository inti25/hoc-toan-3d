import * as THREE from 'three';
import type { QhmjNodeSpec } from './QhmjLayout';

export interface QhmjInteractiveEntity {
  spec: QhmjNodeSpec;
  solved: boolean;
  group: THREE.Group;
  crystal: THREE.Mesh;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
  hitMesh: THREE.Mesh;
}

const COLOR_UNSOLVED_GATE = 0xef4444;
const COLOR_UNSOLVED_CRYSTAL = 0xf59e0b;
const COLOR_UNSOLVED_SUMMIT = 0xa855f7;
const COLOR_SOLVED = 0x22c55e;

/**
 * Quản lý nhóm các điểm tương tác 3D của vùng QHMJ:
 * - Không chặn đường đi hẹp (không thêm vào `regionObstacles`).
 * - Hỗ trợ raycast 3D trực tiếp (cho góc nhìn gần thứ nhất ở nhiều tầng cao độ).
 */
export class QhmjEntities {
  readonly root = new THREE.Group();
  readonly items: QhmjInteractiveEntity[] = [];
  private readonly hitMeshes: THREE.Object3D[] = [];

  constructor(specs: QhmjNodeSpec[], isSolved: (spec: QhmjNodeSpec) => boolean) {
    this.root.name = 'qhmj_interactive_nodes';

    for (const spec of specs) {
      const solved = isSolved(spec);
      const group = new THREE.Group();
      group.position.set(spec.position.x, spec.position.y, spec.position.z);
      group.name = `qhmj_node_${spec.index}_${spec.kind}`;

      const color = this.colorFor(spec, solved);
      const isSummit = spec.kind === 'clock_summit';
      const isGate = spec.kind === 'jump_gate';

      const crystalGeo = isSummit
        ? new THREE.OctahedronGeometry(0.68, 0)
        : isGate
          ? new THREE.OctahedronGeometry(0.48, 0)
          : new THREE.OctahedronGeometry(0.45, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: solved ? 0.35 : 0.75,
        roughness: 0.25,
        metalness: 0.2
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = isSummit ? 1.75 : 1.35;
      crystal.castShadow = true;

      const ringGeo = new THREE.RingGeometry(isGate ? 1.5 : 0.75, isGate ? 1.85 : 1.0, 28);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: solved ? 0.45 : 0.85,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;

      const beamGeo = new THREE.CylinderGeometry(0.22, 0.42, isSummit ? 6.0 : 4.2, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: solved ? 0.0 : (isSummit ? 0.28 : 0.16),
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = isSummit ? 3.0 : 2.1;
      beam.visible = !solved;

      // Hitbox vô hình đủ lớn để click 3D dễ dàng khi đang di chuyển ở góc nhìn gần
      const hitMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.15, 2.8, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.y = 1.4;
      hitMesh.userData.qhmjNodeIndex = spec.index;

      group.add(ring, crystal, beam, hitMesh);
      this.root.add(group);
      this.hitMeshes.push(hitMesh);
      this.items.push({ spec, solved, group, crystal, ring, beam, hitMesh });
    }
  }

  private colorFor(spec: QhmjNodeSpec, solved: boolean): number {
    if (solved) return COLOR_SOLVED;
    if (spec.kind === 'jump_gate') return COLOR_UNSOLVED_GATE;
    if (spec.kind === 'clock_summit') return COLOR_UNSOLVED_SUMMIT;
    return spec.problem.color || COLOR_UNSOLVED_CRYSTAL;
  }

  setSolved(nodeIndex: number, solved = true): void {
    const item = this.items.find((it) => it.spec.index === nodeIndex);
    if (!item || item.solved === solved) return;
    item.solved = solved;
    const color = this.colorFor(item.spec, solved);
    const cMat = item.crystal.material as THREE.MeshStandardMaterial;
    cMat.color.setHex(color);
    cMat.emissive.setHex(color);
    cMat.emissiveIntensity = solved ? 0.35 : 0.75;

    const rMat = item.ring.material as THREE.MeshBasicMaterial;
    rMat.color.setHex(color);
    rMat.opacity = solved ? 0.45 : 0.85;

    item.beam.visible = !solved;
  }

  syncSolved(isSolved: (spec: QhmjNodeSpec) => boolean): void {
    for (const item of this.items) {
      this.setSolved(item.spec.index, isSolved(item.spec));
    }
  }

  /** Trả về danh sách JumpLink.id hiện vẫn đang bị khóa (do jump_gate chưa giải). */
  getLockedLinkIds(): Set<number> {
    const locked = new Set<number>();
    for (const item of this.items) {
      if (!item.solved && item.spec.lockedLinkIds.length > 0) {
        for (const id of item.spec.lockedLinkIds) locked.add(id);
      }
    }
    return locked;
  }

  findNodeAtRay(raycaster: THREE.Raycaster): QhmjInteractiveEntity | null {
    if (this.hitMeshes.length === 0) return null;
    const hits = raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length === 0) return null;
    const idx = hits[0].object.userData?.qhmjNodeIndex;
    if (typeof idx !== 'number') return null;
    return this.items.find((it) => it.spec.index === idx) ?? null;
  }

  update(time: number, dt: number): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const baseH = item.spec.kind === 'clock_summit' ? 1.75 : 1.35;
      item.crystal.position.y = baseH + Math.sin(time * 2.4 + i) * 0.14;
      item.crystal.rotation.y += dt * (item.solved ? 0.6 : 1.4);
    }
  }
}
