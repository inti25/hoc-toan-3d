/**
 * Dựng mô hình nhân vật 3D "Bảo Châu" (stylized) từ ảnh tham chiếu trong thư mục BaoChau/
 * và xuất ra file GLB.
 *
 * Đặc điểm theo ảnh: tóc đen dài ngang lưng có mái bằng, kính gọng hồng trong suốt,
 * áo polo hồng kẻ sọc trắng (cổ + viền tay hồng đậm, 2 cúc trắng), chân váy xòe hồng
 * có 2 sọc trắng gần gấu, tất trắng cổ ngắn, giày sneaker hồng đế cao su trắng quai dán,
 * vòng tay vàng + chỉ đỏ ở cổ tay phải, khuyên tai bạc.
 *
 * Quy ước: Y hướng lên, mặt nhân vật hướng +Z, chân chạm Y = 0, đơn vị mét (~1.29 m).
 * Các node có pivot để làm animation: Head, Arm_L, Arm_R, Leg_L, Leg_R.
 *
 * Chạy: npm run build:baochau
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Document, NodeIO, TextureInfo, type Material as GMaterial, type Node as GNode, type Texture as GTexture } from '@gltf-transform/core';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT_PATH = resolve('public/3dmodel/characters/baochau.glb');
const PREFAB_PATH = resolve('public/3dmodel/prefabs/char_baochau.glb');

// ─── Bảng màu (sRGB) ────────────────────────────────────────────────────────

const C = {
  skin: 0xe5b08c,
  hair: 0x1a1412,
  shirtPink: 0xf2a5b0,
  white: 0xfbf7f5,
  collarPink: 0xe2808f,
  skirtPink: 0xeb8a95,
  shortsPink: 0xd9727f,
  iris: 0x2a1b14,
  lips: 0xd07f7a,
  blush: 0xe8a693,
  frame: 0xf3a9cc,
  lens: 0xfff0f6,
  gold: 0xe0b44c,
  red: 0xc81e2e,
  silver: 0xdadde2,
} as const;

type MatKey =
  | 'skin' | 'hair' | 'shirt' | 'collar' | 'skirt' | 'shorts' | 'eyeWhite' | 'iris' | 'highlight'
  | 'lips' | 'blush' | 'frame' | 'lens' | 'button' | 'gold' | 'red' | 'silver'
  | 'shoePink' | 'white';

interface MatSpec {
  color: number;
  roughness?: number;
  metallic?: number;
  alpha?: number;
  doubleSided?: boolean;
  emissive?: boolean;
  texture?: 'shirtStripes' | 'skirtBands';
}

const MATERIALS: Record<MatKey, MatSpec> = {
  skin: { color: C.skin, roughness: 0.65 },
  hair: { color: C.hair, roughness: 0.45, doubleSided: true },
  shirt: { color: 0xffffff, roughness: 0.85, doubleSided: true, texture: 'shirtStripes' },
  collar: { color: C.collarPink, roughness: 0.85, doubleSided: true },
  skirt: { color: 0xffffff, roughness: 0.85, doubleSided: true, texture: 'skirtBands' },
  shorts: { color: C.shortsPink, roughness: 0.85 },
  eyeWhite: { color: 0xfafafa, roughness: 0.3 },
  iris: { color: C.iris, roughness: 0.2 },
  highlight: { color: 0xffffff, roughness: 0.1, emissive: true },
  lips: { color: C.lips, roughness: 0.5 },
  blush: { color: C.blush, roughness: 0.7 },
  frame: { color: C.frame, roughness: 0.2, alpha: 0.85 },
  lens: { color: C.lens, roughness: 0.05, alpha: 0.15, doubleSided: true },
  button: { color: 0xffffff, roughness: 0.3 },
  gold: { color: C.gold, roughness: 0.3, metallic: 0.9 },
  red: { color: C.red, roughness: 0.6 },
  silver: { color: C.silver, roughness: 0.25, metallic: 0.9 },
  shoePink: { color: C.skirtPink, roughness: 0.65 },
  white: { color: C.white, roughness: 0.5 },
};

// ─── Hàm tiện ích hình học ──────────────────────────────────────────────────

type Vec3 = [number, number, number];

function addMesh(parent: THREE.Object3D, geom: THREE.BufferGeometry, mat: MatKey, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): THREE.Mesh {
  const m = new THREE.Mesh(geom);
  m.userData.mat = mat;
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  parent.add(m);
  return m;
}

/** Ellipsoid = unit sphere scaled by radii. */
function ellipsoid(parent: THREE.Object3D, mat: MatKey, pos: Vec3, radii: Vec3, rot: Vec3 = [0, 0, 0], seg = 16): THREE.Mesh {
  return addMesh(parent, new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.75))), mat, pos, rot, radii);
}

/** Thanh hộp nối 2 điểm (dùng cho gọng kính). Phải gọi trước khi gắn vào parent. */
function boxBetween(parent: THREE.Object3D, mat: MatKey, a: Vec3, b: Vec3, w: number, h: number): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, va.distanceTo(vb)));
  m.userData.mat = mat;
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.lookAt(vb);
  parent.add(m);
  return m;
}

function lathe(points: [number, number][], segments = 20): THREE.LatheGeometry {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

/** Catmull-Rom đều trên các hàng số. */
function spline(rows: number[][], t: number): number[] {
  const n = rows.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const s = f - i;
  const p0 = rows[Math.max(i - 1, 0)], p1 = rows[i], p2 = rows[i + 1], p3 = rows[Math.min(i + 2, n)];
  return p1.map((_, k) =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s * s + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s * s * s)
  );
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Mặt cong tham số (u, v) ∈ [0,1]². Pháp tuyến được hướng ra ngoài trục Y. */
function paramSurface(
  nu: number,
  nv: number,
  fn: (u: number, v: number) => Vec3,
  opts: { uv?: (u: number, v: number, p: Vec3) => [number, number]; wrapU?: boolean } = {}
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      const p = fn(u, v);
      pos.push(...p);
      uvs.push(...(opts.uv ? opts.uv(u, v, p) : [u, v]));
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const recompute = () => {
    g.computeVertexNormals();
    if (opts.wrapU) {
      const n = g.getAttribute('normal') as THREE.BufferAttribute;
      for (let j = 0; j <= nv; j++) {
        const a = j * (nu + 1), b = a + nu;
        const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
        n.setXYZ(a, v.x, v.y, v.z);
        n.setXYZ(b, v.x, v.y, v.z);
      }
    }
  };
  recompute();
  // Hướng pháp tuyến ra ngoài (so với trục Y đi qua gốc)
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  let sum = 0;
  for (let k = 0; k < p.count; k++) sum += n.getX(k) * p.getX(k) + n.getZ(k) * p.getZ(k);
  if (sum < 0) {
    const ix = g.getIndex()!;
    for (let k = 0; k < ix.count; k += 3) {
      const b = ix.getX(k + 1);
      ix.setX(k + 1, ix.getX(k + 2));
      ix.setX(k + 2, b);
    }
    recompute();
  }
  return g;
}

/** Superellipse cross-section (n > 2 cho thân áo hơi vuông). */
function superEllipse(a: number, rx: number, rz: number, zc: number, n = 2): [number, number] {
  const e = 2 / n;
  const s = Math.sin(a), c = Math.cos(a);
  return [rx * Math.sign(s) * Math.abs(s) ** e, zc + rz * Math.sign(c) * Math.abs(c) ** e];
}

/** Gán UV theo trục Y cục bộ để vẽ sọc ngang đều. */
function stripeUV(g: THREE.BufferGeometry, period: number): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let k = 0; k < p.count; k++) {
    uv[k * 2] = Math.atan2(p.getX(k), p.getZ(k)) / (Math.PI * 2) + 0.5;
    uv[k * 2 + 1] = p.getY(k) / period;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ─── Kích thước chính ───────────────────────────────────────────────────────

const SHIRT_STRIPE_PERIOD = 0.016;
const HEAD_PIVOT_Y = 1.04;
const HEAD_CENTER_LOCAL_Y = 0.125; // tâm đầu ở y ≈ 1.165
const R = 0.112; // bán kính đầu

/** Biến dạng hình cầu đầu: mặt hơi hẹp, cằm thon. */
function shapeHead(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position');
  for (let k = 0; k < p.count; k++) {
    let x = p.getX(k) * 0.9, y = p.getY(k), z = p.getZ(k) * 0.96;
    if (y < 0) {
      const t = -y / R;
      x *= 1 - 0.28 * t ** 1.6;
      z *= 1 - 0.1 * t * t;
      y *= 1.04;
    }
    p.setXYZ(k, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Toạ độ z của bề mặt mặt (head-local) tại (x, y). */
function faceZ(x: number, y: number): number {
  const yy = y < 0 ? y / 1.04 : y;
  const t = Math.max(0, -yy / R);
  const sx = 0.9 * (1 - 0.28 * t ** 1.6);
  const sz = 0.96 * (1 - 0.1 * t * t);
  const X = x / sx;
  return Math.sqrt(Math.max(R * R - X * X - yy * yy, 0)) * sz;
}

// ─── Dựng các bộ phận ───────────────────────────────────────────────────────

function buildBody(body: THREE.Object3D) {
  // Thân áo polo (dáng hộp, crop)
  const shirtRows = [
    [0.645, 0.178, 0.128, 0.0],
    [0.7, 0.176, 0.126, 0.0],
    [0.79, 0.17, 0.12, 0.0],
    [0.87, 0.17, 0.116, 0.0],
    [0.925, 0.162, 0.104, 0.0],
    [0.965, 0.125, 0.088, -0.005],
    [0.995, 0.07, 0.058, -0.005],
    [1.01, 0.048, 0.044, -0.005],
  ];
  const shirt = paramSurface(
    48, 40,
    (u, v) => {
      const [y, rx, rz, zc] = spline(shirtRows, v);
      const [x, z] = superEllipse(u * Math.PI * 2, rx, rz, zc, 2.6);
      return [x, y, z];
    },
    { uv: (u, _v, p) => [u, p[1] / SHIRT_STRIPE_PERIOD], wrapU: true }
  );
  addMesh(body, shirt, 'shirt');

  // Cổ áo bẻ (polo), hở phía trước
  const gap = 0.07 * Math.PI;
  const collar = paramSurface(56, 6, (u, v) => {
    const a = gap + u * (Math.PI * 2 - 2 * gap);
    const tip = Math.max(0, 1 - Math.min(u, 1 - u) / 0.12) ** 2;
    const rx = THREE.MathUtils.lerp(0.05, 0.098 + 0.012 * tip, v);
    const rz = THREE.MathUtils.lerp(0.046, 0.09 + 0.014 * tip, v);
    const zc = THREE.MathUtils.lerp(-0.005, -0.002, v);
    const y = THREE.MathUtils.lerp(1.022, 0.99 - 0.032 * tip, v);
    const [x, z] = superEllipse(a, rx, rz, zc);
    return [x, y, z];
  });
  addMesh(body, collar, 'collar');

  // Nẹp áo + 2 cúc trắng
  addMesh(body, new THREE.BoxGeometry(0.032, 0.08, 0.006), 'collar', [0, 0.935, 0.101], [-0.32, 0, 0]);
  for (const y of [0.952, 0.918]) {
    const z = 0.101 + (0.935 - y) * 0.33 + 0.004;
    addMesh(body, new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 12), 'button', [0, y, z], [Math.PI / 2 - 0.32, 0, 0]);
  }
  // Logo nhỏ ngực trái (Hello Kitty "LOVE")
  ellipsoid(body, 'button', [0.058, 0.912, 0.112], [0.007, 0.006, 0.002], [0, 0.35, 0], 10);
  addMesh(body, new THREE.BoxGeometry(0.018, 0.006, 0.002), 'red', [0.06, 0.902, 0.112], [0, 0.35, 0]);

  // Cổ
  addMesh(body, lathe([[0, 0.97], [0.036, 0.975], [0.034, 1.04], [0.032, 1.1], [0, 1.105]], 16), 'skin');

  // Chân váy xòe, có nếp
  const skirtRows = [
    [0.705, 0.13, 0.1],
    [0.645, 0.16, 0.12],
    [0.58, 0.2, 0.165],
    [0.5, 0.238, 0.205],
    [0.455, 0.252, 0.218],
  ];
  const skirtTop = 0.705, skirtHem = 0.455;
  const skirt = paramSurface(
    112, 24,
    (u, v) => {
      const [y0, rx, rz] = spline(skirtRows, v);
      const a = u * Math.PI * 2;
      const pleat = 1 + 0.045 * v ** 0.8 * Math.sin(a * 14);
      const y = y0 + 0.004 * v * Math.cos(a * 14);
      const [x, z] = superEllipse(a, rx * pleat, rz * pleat, 0);
      return [x, y, z];
    },
    { uv: (u, _v, p) => [u, (p[1] - skirtHem) / (skirtTop - skirtHem)], wrapU: true }
  );
  addMesh(body, skirt, 'skirt');

  // Quần lót an toàn che phần đùi trên
  ellipsoid(body, 'shorts', [0, 0.635, 0], [0.13, 0.085, 0.1], [0, 0, 0], 20);
}

function buildLeg(leg: THREE.Object3D, side: 1 | -1) {
  // Chân da (từ đùi xuống trên mắt cá chân)
  addMesh(leg, lathe([
    [0, -0.49], [0.033, -0.49], [0.035, -0.46], [0.042, -0.42], [0.049, -0.36],
    [0.046, -0.31], [0.043, -0.28], [0.05, -0.22], [0.058, -0.12], [0.062, -0.04], [0.055, 0], [0, 0.02],
  ], 18), 'skin');

  // Cổ tất trắng ngắn có gờ viền
  addMesh(leg, lathe([
    [0, -0.56], [0.035, -0.56], [0.034, -0.53], [0.037, -0.49], [0.034, -0.485], [0, -0.485],
  ], 18), 'white');

  // Thân giày sneaker màu hồng (skirtPink)
  ellipsoid(leg, 'shoePink', [0, -0.582, 0.025], [0.038, 0.026, 0.075]);
  ellipsoid(leg, 'shoePink', [0, -0.588, 0.082], [0.037, 0.022, 0.032]);
  ellipsoid(leg, 'shoePink', [0, -0.582, -0.028], [0.036, 0.025, 0.032]);
  // Cổ giày ôm chân
  addMesh(leg, lathe([[0.034, -0.57], [0.040, -0.57], [0.038, -0.552], [0.033, -0.552]], 18), 'shoePink');

  // Đế giày cao su trắng dày (tiếp đất Y = 0 tại y = -0.62)
  addMesh(leg, new THREE.BoxGeometry(0.076, 0.02, 0.125), 'white', [0, -0.61, 0.028]);
  ellipsoid(leg, 'white', [0, -0.605, 0.088], [0.038, 0.015, 0.03]);
  ellipsoid(leg, 'white', [0, -0.605, -0.028], [0.037, 0.015, 0.03]);
  // Mũi giày cao su trắng
  ellipsoid(leg, 'white', [0, -0.592, 0.096], [0.035, 0.016, 0.02], [0.2, 0, 0], 12);

  // Quai dán Velcro trắng ngang mu bàn chân
  addMesh(leg, new THREE.BoxGeometry(0.074, 0.012, 0.022), 'white', [0, -0.565, 0.046], [-0.35, 0, 0]);
  // Tab cài dán velcro bên phía ngoài chân (side = 1 là chân trái -> +X; side = -1 là chân phải -> -X)
  addMesh(leg, new THREE.BoxGeometry(0.01, 0.014, 0.024), 'shoePink', [side * 0.038, -0.565, 0.046], [-0.35, 0, 0]);
  ellipsoid(leg, 'button', [side * 0.042, -0.565, 0.046], [0.003, 0.005, 0.005], [0, 0, 0], 8);
}

function buildArm(arm: THREE.Object3D, side: 1 | -1) {
  // Tay áo (sọc) — đỉnh tròn để liền vai
  const sleeve = lathe([[0, 0.06], [0.035, 0.055], [0.055, 0.035], [0.062, 0], [0.066, -0.1], [0.068, -0.148]], 20);
  addMesh(arm, stripeUV(sleeve, SHIRT_STRIPE_PERIOD), 'shirt');
  // Viền tay hồng đậm
  addMesh(arm, lathe([[0.062, -0.142], [0.07, -0.142], [0.072, -0.18], [0.062, -0.18], [0.062, -0.142]], 20), 'collar');
  // Cánh tay + cẳng tay
  addMesh(arm, lathe([
    [0, -0.12], [0.036, -0.13], [0.036, -0.2], [0.031, -0.27], [0.032, -0.3], [0.029, -0.38], [0.024, -0.425], [0.02, -0.435], [0, -0.44],
  ], 16), 'skin');
  // Bàn tay + ngón cái (hướng vào trong thân)
  ellipsoid(arm, 'skin', [0, -0.47, 0.004], [0.019, 0.044, 0.032]);
  ellipsoid(arm, 'skin', [-side * 0.012, -0.455, 0.024], [0.01, 0.022, 0.01], [0.3, 0, 0], 10);

  // Vòng tay ở cổ tay phải (side = -1)
  if (side === -1) {
    addMesh(arm, new THREE.TorusGeometry(0.029, 0.0032, 6, 24), 'gold', [0, -0.416, 0], [Math.PI / 2, 0, 0]);
    addMesh(arm, new THREE.TorusGeometry(0.0275, 0.002, 6, 24), 'red', [0, -0.405, 0], [Math.PI / 2, 0, 0]);
    ellipsoid(arm, 'button', [0, -0.418, 0.031], [0.006, 0.006, 0.003], [0, 0, 0], 10);
  }
}

function buildHead(head: THREE.Object3D) {
  // Mặt / đầu
  addMesh(head, shapeHead(new THREE.SphereGeometry(R, 40, 32)), 'skin');

  // Tai + khuyên tai bạc
  for (const s of [1, -1]) {
    ellipsoid(head, 'skin', [s * 0.1, -0.012, -0.008], [0.012, 0.026, 0.019], [0, 0, -s * 0.1]);
    ellipsoid(head, 'silver', [s * 0.104, -0.037, -0.002], [0.005, 0.005, 0.005], [0, 0, 0], 10);
  }

  // Mắt
  const eyeY = -0.005;
  for (const s of [1, -1]) {
    const x = s * 0.04;
    const z = faceZ(x, eyeY);
    const ry = Math.atan2(x, z);
    ellipsoid(head, 'eyeWhite', [x, eyeY, z - 0.001], [0.018, 0.0125, 0.006], [0, ry, 0]);
    ellipsoid(head, 'iris', [x, eyeY - 0.001, z + 0.002], [0.0115, 0.0115, 0.005], [0, ry, 0]);
    ellipsoid(head, 'highlight', [x + 0.004, eyeY + 0.004, z + 0.0065], [0.0032, 0.0032, 0.0015], [0, ry, 0], 8);
    // Viền mi trên
    ellipsoid(head, 'hair', [x, eyeY + 0.0105, z + 0.0015], [0.02, 0.0035, 0.004], [0, ry, s * 0.08], 12);
    // Má hồng
    const bx = s * 0.058, by = -0.036;
    ellipsoid(head, 'blush', [bx, by, faceZ(bx, by) - 0.001], [0.016, 0.009, 0.004], [0, Math.atan2(bx, faceZ(bx, by)), 0], 12);
  }

  // Mũi + môi
  ellipsoid(head, 'skin', [0, -0.035, faceZ(0, -0.035) + 0.002], [0.01, 0.009, 0.01], [0, 0, 0], 12);
  ellipsoid(head, 'lips', [0, -0.066, faceZ(0, -0.066) - 0.0005], [0.019, 0.006, 0.006], [0, 0, 0], 12);

  buildHair(head);
  buildGlasses(head);
}

function buildHair(head: THREE.Object3D) {
  // Chỏm tóc (nghiêng ra sau để chân tóc trước cao hơn)
  addMesh(head, new THREE.SphereGeometry(0.121, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), 'hair', [0, 0.008, -0.006], [-0.35, 0, 0], [0.93, 1, 1]);

  // Tóc mái bằng, đuôi mái lởm chởm, hai bên dài hơn ôm thái dương
  const bangTop = 0.088;
  const bangs = paramSurface(40, 10, (u, v) => {
    const a = THREE.MathUtils.lerp(-0.95, 0.95, u);
    const edge = Math.abs(2 * u - 1);
    const yb = 0.026 + 0.006 * (0.5 + 0.5 * Math.cos(u * Math.PI * 2 * 7)) - 0.035 * edge ** 3;
    const y = THREE.MathUtils.lerp(bangTop, yb, v);
    const hr = Math.sqrt(Math.max(R * R - y * y, 0));
    const off = THREE.MathUtils.lerp(0.02, 0.011, v);
    return [(hr * 0.9 + off) * Math.sin(a), y, (hr * 0.96 + off) * Math.cos(a)];
  });
  addMesh(head, bangs, 'hair');

  // Tóc dài phía sau, xõa ngang lưng, nằm sau tai
  const rows = [
    // y,     rx,    rz,    zc,     góc bắt đầu (từ +Z)
    [0.03, 0.116, 0.12, -0.004, 0.57],
    [-0.05, 0.112, 0.116, -0.01, 0.57],
    [-0.12, 0.105, 0.1, -0.03, 0.6],
    [-0.2, 0.15, 0.07, -0.078, 0.62],
    [-0.3, 0.15, 0.06, -0.1, 0.66],
    [-0.445, 0.14, 0.055, -0.11, 0.68],
  ];
  const curtain = paramSurface(48, 36, (u, v) => {
    const [y0, rx, rz, zc, a0] = spline(rows, v);
    const a = THREE.MathUtils.lerp(a0 * Math.PI, (2 - a0) * Math.PI, u);
    const jag = -0.022 * Math.sin(u * Math.PI * 9) ** 2 - 0.025 * (1 - Math.abs(2 * u - 1)) + 0.01;
    const y = y0 + jag * smoothstep(0.8, 1, v);
    const [x, z] = superEllipse(a, rx, rz, zc);
    return [x, y, z];
  });
  addMesh(head, curtain, 'hair');
}

function buildGlasses(head: THREE.Object3D) {
  const W = 0.052, H = 0.04, T = 0.0035, depth = 0.004, cr = 0.01;
  const lensY = -0.004, lensZ = 0.118;
  for (const s of [1, -1]) {
    const shape = roundedRect(W, H, cr);
    shape.holes.push(roundedRect(W - 2 * T, H - 2 * T, cr - T * 0.6));
    const frame = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
    frame.translate(0, 0, -depth / 2);
    addMesh(head, frame, 'frame', [s * 0.043, lensY, lensZ - 0.002], [0, s * 0.12, 0]);
    const lens = new THREE.ShapeGeometry(roundedRect(W - 2 * T, H - 2 * T, cr - T * 0.6), 6);
    addMesh(head, lens, 'lens', [s * 0.043, lensY, lensZ - 0.002], [0, s * 0.12, 0]);
    // Càng kính chạy về tai
    boxBetween(head, 'frame', [s * 0.068, lensY + 0.012, lensZ - 0.006], [s * 0.104, lensY + 0.012, -0.02], 0.004, 0.005);
  }
  // Cầu kính
  addMesh(head, new THREE.BoxGeometry(0.014, 0.004, 0.004), 'frame', [0, lensY + 0.008, lensZ + 0.001]);
}

function buildCharacter(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'BaoChau';

  const body = new THREE.Group();
  body.name = 'Body';
  root.add(body);
  buildBody(body);

  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, HEAD_PIVOT_Y, 0);
  root.add(head);
  const headGeo = new THREE.Group();
  headGeo.name = 'Head_Geo';
  headGeo.position.set(0, HEAD_CENTER_LOCAL_Y, 0);
  head.add(headGeo);
  buildHead(headGeo);

  // +X là bên trái nhân vật (nhân vật nhìn về +Z)
  for (const [name, side] of [['Arm_L', 1], ['Arm_R', -1]] as const) {
    const arm = new THREE.Group();
    arm.name = name;
    arm.position.set(side * 0.152, 0.905, 0);
    arm.rotation.z = side * 0.18;
    root.add(arm);
    buildArm(arm, side);
  }
  for (const [name, side] of [['Leg_L', 1], ['Leg_R', -1]] as const) {
    const leg = new THREE.Group();
    leg.name = name;
    leg.position.set(side * 0.065, 0.62, 0);
    root.add(leg);
    buildLeg(leg, side);
  }
  return root;
}

// ─── Xuất GLB bằng glTF-Transform ───────────────────────────────────────────

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToLinear(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(v => srgbToLinear(v / 255)) as [number, number, number];
}

async function makeTexturePng(width: number, height: number, colorAtRow: (row: number) => number): Promise<Uint8Array> {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const c = colorAtRow(y);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = (c >> 16) & 255;
      data[o + 1] = (c >> 8) & 255;
      data[o + 2] = c & 255;
      data[o + 3] = 255;
    }
  }
  return new Uint8Array(await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer());
}

async function exportGLB(root: THREE.Object3D): Promise<Uint8Array> {
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'vuong-quoc-cuu-chuong-3d/buildBaoChauModel';
  const buffer = doc.createBuffer();

  // Textures
  const shirtTex = doc.createTexture('ShirtStripes').setMimeType('image/png')
    .setImage(await makeTexturePng(4, 32, row => (row < 10 ? C.white : C.shirtPink)));
  // v = 0 ở gấu váy: hồng | trắng | hồng | trắng | hồng
  const skirtTex = doc.createTexture('SkirtBands').setMimeType('image/png')
    .setImage(await makeTexturePng(4, 256, row => {
      const t = row / 256;
      return (t >= 0.15 && t < 0.2) || (t >= 0.25 && t < 0.3) ? C.white : C.skirtPink;
    }));
  const textures: Record<NonNullable<MatSpec['texture']>, { tex: GTexture; wrap: number }> = {
    shirtStripes: { tex: shirtTex, wrap: TextureInfo.WrapMode.REPEAT },
    skirtBands: { tex: skirtTex, wrap: TextureInfo.WrapMode.CLAMP_TO_EDGE },
  };

  const materials = new Map<MatKey, GMaterial>();
  const getMaterial = (key: MatKey): GMaterial => {
    let m = materials.get(key);
    if (m) return m;
    const spec = MATERIALS[key];
    m = doc.createMaterial(key)
      .setBaseColorFactor([...hexToLinear(spec.color), spec.alpha ?? 1])
      .setRoughnessFactor(spec.roughness ?? 0.6)
      .setMetallicFactor(spec.metallic ?? 0)
      .setDoubleSided(spec.doubleSided ?? false);
    if ((spec.alpha ?? 1) < 1) m.setAlphaMode('BLEND');
    if (spec.emissive) m.setEmissiveFactor([0.6, 0.6, 0.6]);
    if (spec.texture) {
      const { tex, wrap } = textures[spec.texture];
      m.setBaseColorTexture(tex);
      m.getBaseColorTextureInfo()!
        .setWrapS(TextureInfo.WrapMode.REPEAT)
        .setWrapT(wrap)
        .setMagFilter(TextureInfo.MagFilter.LINEAR)
        .setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR);
    }
    materials.set(key, m);
    return m;
  };

  const prepare = (mesh: THREE.Mesh): THREE.BufferGeometry => {
    mesh.updateMatrix();
    let g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.index) {
      const n = g.getAttribute('position').count;
      g.setIndex(Array.from({ length: n }, (_, i) => i));
    }
    g.clearGroups();
    g = g.applyMatrix4(mesh.matrix);
    return g;
  };

  let triangles = 0;
  const convert = (obj: THREE.Object3D): GNode => {
    obj.updateMatrix();
    const node = doc.createNode(obj.name || undefined)
      .setTranslation(obj.position.toArray() as Vec3)
      .setRotation(obj.quaternion.toArray() as [number, number, number, number])
      .setScale(obj.scale.toArray() as Vec3);

    const byMat = new Map<MatKey, THREE.BufferGeometry[]>();
    for (const child of obj.children) {
      if ((child as THREE.Mesh).isMesh) {
        const key = child.userData.mat as MatKey;
        if (!byMat.has(key)) byMat.set(key, []);
        byMat.get(key)!.push(prepare(child as THREE.Mesh));
      } else {
        node.addChild(convert(child));
      }
    }

    if (byMat.size > 0) {
      const gmesh = doc.createMesh(`${obj.name}_Mesh`);
      for (const [key, list] of byMat) {
        const merged = mergeGeometries(list, false);
        if (!merged) throw new Error(`Cannot merge geometries for material ${key} in ${obj.name}`);
        const pos = merged.getAttribute('position');
        const nor = merged.getAttribute('normal');
        const uv = merged.getAttribute('uv');
        const normals = new Float32Array(nor.array as ArrayLike<number>);
        for (let i = 0; i < normals.length; i += 3) {
          const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
          normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
        }
        const indexArr = merged.getIndex()!.array as ArrayLike<number>;
        const indices = pos.count < 65536 ? new Uint16Array(indexArr) : new Uint32Array(indexArr);
        triangles += indices.length / 3;
        const prim = doc.createPrimitive()
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos.array as ArrayLike<number>)).setBuffer(buffer))
          .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
          .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv.array as ArrayLike<number>)).setBuffer(buffer))
          .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
          .setMaterial(getMaterial(key));
        gmesh.addPrimitive(prim);
      }
      node.setMesh(gmesh);
    }
    return node;
  };

  doc.createScene('Scene').addChild(convert(root));
  console.log(`Triangles: ${triangles}, materials: ${materials.size}`);
  return new NodeIO().writeBinary(doc);
}

async function main() {
  const root = buildCharacter();
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  console.log('Bounds min', box.min.toArray().map(v => v.toFixed(3)), 'max', box.max.toArray().map(v => v.toFixed(3)));
  const glb = await exportGLB(root);
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, glb);
  mkdirSync(dirname(PREFAB_PATH), { recursive: true });
  writeFileSync(PREFAB_PATH, glb);
  console.log(`Wrote ${OUT_PATH} and ${PREFAB_PATH} (${(glb.byteLength / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
