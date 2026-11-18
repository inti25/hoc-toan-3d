import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';

const GLB_PATH = new URL('../../public/3dmodel/maps/map_qhmj.glb', import.meta.url);

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

function loadGlb() {
  const buf = readFileSync(GLB_PATH);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const bin = buf.subarray(20 + jsonLen + 8);
  return { json, bin };
}

function readAccessor(json: any, bin: Buffer, idx: number): Float32Array | Uint32Array {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const comps = acc.type === 'VEC3' ? 3 : 1;
  const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const sizes: Record<number, number> = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 };
  const stride = bv.byteStride ?? sizes[acc.componentType] * comps;
  const out = acc.componentType === 5126 ? new Float32Array(acc.count * comps) : new Uint32Array(acc.count * comps);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < comps; c++) {
      const off = base + i * stride + c * sizes[acc.componentType];
      out[i * comps + c] =
        acc.componentType === 5126 ? bin.readFloatLE(off)
          : acc.componentType === 5123 ? bin.readUInt16LE(off)
            : acc.componentType === 5125 ? bin.readUInt32LE(off)
              : bin.readUInt8(off);
    }
  }
  return out;
}

function localMatrix(n: GltfNode): Matrix4 {
  const m = new Matrix4();
  if (n.matrix) return m.fromArray(n.matrix);
  m.compose(
    new Vector3(...(n.translation ?? [0, 0, 0])),
    new Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
    new Vector3(...(n.scale ?? [1, 1, 1]))
  );
  return m;
}

/** Duyệt scene, trả về ma trận thế giới của mọi node (theo chỉ số). */
function worldMatrices(json: any): Map<number, Matrix4> {
  const result = new Map<number, Matrix4>();
  const walk = (ni: number, parent: Matrix4) => {
    const n: GltfNode = json.nodes[ni];
    const world = parent.clone().multiply(localMatrix(n));
    result.set(ni, world);
    (n.children ?? []).forEach((c) => walk(c, world));
  };
  json.scenes[json.scene ?? 0].nodes.forEach((r: number) => walk(r, new Matrix4()));
  return result;
}

export interface WorldMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Tam giác thế giới của mọi node có mesh tên `meshName`, nhân thêm `scale`. */
export function loadQhmjMesh(meshName: string, scale: number): WorldMesh {
  const { json, bin } = loadGlb();
  const mats = worldMatrices(json);
  const posList: number[] = [];
  const idxList: number[] = [];
  json.nodes.forEach((n: GltfNode, ni: number) => {
    if (n.mesh === undefined || n.name !== meshName) return;
    const world = mats.get(ni)!;
    for (const prim of json.meshes[n.mesh].primitives) {
      const pos = readAccessor(json, bin, prim.attributes.POSITION) as Float32Array;
      const idx = readAccessor(json, bin, prim.indices) as Uint32Array;
      const base = posList.length / 3;
      const v = new Vector3();
      for (let i = 0; i < pos.length; i += 3) {
        v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(world).multiplyScalar(scale);
        posList.push(v.x, v.y, v.z);
      }
      for (const i of idx) idxList.push(base + i);
    }
  });
  return { positions: Float32Array.from(posList), indices: Uint32Array.from(idxList) };
}

/** Tâm thế giới (đã nhân `scale`) của các node mesh có tên bắt đầu bằng `prefix`. */
export function loadQhmjNodeCenters(prefix: string, scale: number): { x: number; y: number; z: number }[] {
  const { json, bin } = loadGlb();
  const mats = worldMatrices(json);
  const out: { x: number; y: number; z: number }[] = [];
  json.nodes.forEach((n: GltfNode, ni: number) => {
    if (n.mesh === undefined || !n.name?.startsWith(prefix)) return;
    const world = mats.get(ni)!;
    const pos = readAccessor(json, bin, json.meshes[n.mesh].primitives[0].attributes.POSITION) as Float32Array;
    const c = new Vector3();
    const v = new Vector3();
    for (let i = 0; i < pos.length; i += 3) c.add(v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(world));
    c.multiplyScalar(1 / (pos.length / 3)).multiplyScalar(scale);
    out.push({ x: c.x, y: c.y, z: c.z });
  });
  return out;
}
