import * as THREE from 'three';
import type { AssetRepositorySeam } from '../assets/types';
import {
  QHMJ_HIDDEN_NODE_PATTERNS,
  QHMJ_ROAD_MESH_NAME,
  QHMJ_SCALE,
  computeQhmjAnchors
} from '../../data/qhmjMap';
import { RoadSurface, type Vec3 } from './RoadSurface';
import { buildJumpLinks, type JumpLink } from './JumpLinks';

export interface QhmjRegionBuild {
  model: THREE.Group;
  surface: RoadSurface;
  links: JumpLink[];
  /** Vòng sáng nhận diện bệ nhảy. */
  beacons: THREE.Object3D[];
  /** Xương bánh răng (xoay nhẹ cho cảnh có sức sống). */
  gearBones: THREE.Bone[];
}

/** Gom tam giác thế giới của một mesh. */
export function extractWorldTriangles(mesh: THREE.Mesh): { positions: Float32Array; indices: Uint32Array } {
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const pos = geometry.getAttribute('position');
  const positions = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  }
  const index = geometry.getIndex();
  let indices: Uint32Array;
  if (index) {
    indices = Uint32Array.from(index.array as ArrayLike<number>);
  } else {
    indices = new Uint32Array(pos.count);
    for (let i = 0; i < pos.count; i++) indices[i] = i;
  }
  return { positions, indices };
}

function createBeacon(link: JumpLink): THREE.Object3D {
  const group = new THREE.Group();
  const color = link.synthetic ? 0xfbbf24 : 0x38bdf8;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(link.triggerRadius * 0.62, link.triggerRadius, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(link.triggerRadius * 0.7, link.triggerRadius * 0.7, 3, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  column.position.y = 1.5;
  group.add(ring, column);
  group.position.set(link.pad.x, link.pad.y, link.pad.z);
  group.name = `qhmj_jump_beacon_${link.id}`;
  return group;
}

/**
 * Dựng vùng QHMJ: nạp model, scale, ẩn mesh phụ, trích mặt đường đi được và nối các bệ bật nhảy.
 */
export async function buildQhmjRegion(
  assets: AssetRepositorySeam,
  zone: { center: { x: number; z: number } },
  parent: THREE.Object3D
): Promise<QhmjRegionBuild | null> {
  const model = await assets.instantiate('map:qhmj');
  if (!model) return null;

  model.scale.setScalar(QHMJ_SCALE);
  model.position.set(zone.center.x, 0, zone.center.z);
  model.updateMatrixWorld(true);

  const found: { road: THREE.Mesh | null } = { road: null };
  const padCenters: Vec3[] = [];
  const gearBones: THREE.Bone[] = [];
  const hidden: THREE.Object3D[] = [];
  model.traverse((obj) => {
    const name = obj.name || '';
    if (QHMJ_HIDDEN_NODE_PATTERNS.some((p) => p.test(name))) hidden.push(obj);
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (name === QHMJ_ROAD_MESH_NAME) found.road = mesh;
      if (name.startsWith('comm_jumpt')) {
        const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        padCenters.push({ x: c.x, y: c.y, z: c.z });
      }
    }
    if ((obj as THREE.Bone).isBone && name.startsWith('gear_')) gearBones.push(obj as THREE.Bone);
  });
  hidden.forEach((o) => (o.visible = false));

  const roadMesh = found.road;
  if (!roadMesh) {
    console.warn('[Qhmj] Không tìm thấy mesh đường', QHMJ_ROAD_MESH_NAME);
    return null;
  }

  const { positions, indices } = extractWorldTriangles(roadMesh);
  const surface = new RoadSurface(positions, indices);
  const anchors = computeQhmjAnchors(zone.center);
  const start = surface.sampleNearest(anchors.spawn.x, anchors.spawn.z, anchors.spawn.y);
  const links = buildJumpLinks(surface, padCenters, { startIsland: start?.island });

  const beacons = links.map((l) => createBeacon(l));
  parent.add(model);
  beacons.forEach((b) => parent.add(b));

  return { model, surface, links, beacons, gearBones };
}

/** Hoạt ảnh nhẹ: bánh răng xoay quanh trục dọc xương, vòng sáng bệ nhảy nhấp nháy. */
export function updateQhmjAnimation(build: QhmjRegionBuild, time: number, dt: number): void {
  build.gearBones.forEach((bone, i) => {
    bone.rotateY((i % 2 === 0 ? 1 : -1) * dt * 0.45);
  });
  const pulse = 1 + Math.sin(time * 3) * 0.08;
  build.beacons.forEach((b) => b.scale.set(pulse, 1, pulse));
}
