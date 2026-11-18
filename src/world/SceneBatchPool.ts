import * as THREE from 'three';

export interface StaticPlacement {
  template: THREE.Object3D;
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: number;
}

export interface BatchTemplateOptions {
  namePrefix?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export type TrailEffectKind = 'trail_flower' | 'trail_stardust' | 'trail_frost';

interface SparkSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface TrailSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  life: number;
  maxLife: number;
}

interface TrailPool {
  kind: 'flower' | 'star' | 'frost';
  mesh: THREE.InstancedMesh;
  slots: TrailSlot[];
  cursor: number;
  dirty: boolean;
}

const SPARK_CAPACITY = 160;
const TRAIL_CAPACITY = 96;
const SPARK_COLORS = [0xffd164, 0xfff4c7, 0x7dd4b5, 0xf06292];
const TRAIL_PALETTES: Record<'flower' | 'star' | 'frost', number[]> = {
  flower: [0xff69b4, 0xffd166, 0x06d6a0, 0xf72585, 0x70e000],
  star: [0xffd700, 0xffbe0b, 0xfff8e7, 0xfb5607, 0xffe600],
  frost: [0x00f5d4, 0x70d6ff, 0xe0fbfc, 0x00b4d8, 0x90e0ef]
};

/**
 * Deep module owning shared geometry/material caches, static InstancedMesh
 * batching, and zero-allocation ring-buffered particle effect pools.
 */
export class SceneBatchPool {
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private geometries = new Map<string, THREE.BufferGeometry>();

  private effectsScene: THREE.Scene | null = null;
  private sparkMesh: THREE.InstancedMesh | null = null;
  private sparkSlots: SparkSlot[] = [];
  private sparkCursor = 0;
  private trailPools: Record<'flower' | 'star' | 'frost', TrailPool> | null = null;
  private effectGeometries: THREE.BufferGeometry[] = [];
  private effectMaterials: THREE.Material[] = [];

  private readonly scratchDummy = new THREE.Object3D();
  private readonly scratchColor = new THREE.Color();
  private readonly scratchMat = new THREE.Matrix4();
  private readonly scratchInv = new THREE.Matrix4();
  private readonly scratchChildMat = new THREE.Matrix4();

  material(color: number, roughness = 0.9, metalness = 0): THREE.MeshStandardMaterial {
    const key = `${color}:${roughness}:${metalness}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      this.materials.set(key, mat);
    }
    return mat;
  }

  private getOrCreateGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geo = this.geometries.get(key);
    if (!geo) {
      geo = factory();
      this.geometries.set(key, geo);
    }
    return geo;
  }

  mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number): THREE.Mesh {
    const geo = this.getOrCreateGeometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
    return this.mesh(parent, geo, color, x, y, z);
  }

  sphere(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: number): THREE.Mesh {
    const geo = this.getOrCreateGeometry(`ico:${r}`, () => new THREE.IcosahedronGeometry(r, 1));
    return this.mesh(parent, geo, color, x, y, z);
  }

  cylinder(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    top: number,
    bottom: number,
    h: number,
    color: number,
    segments = 8
  ): THREE.Mesh {
    const geo = this.getOrCreateGeometry(
      `cyl:${top}:${bottom}:${h}:${segments}`,
      () => new THREE.CylinderGeometry(top, bottom, h, segments)
    );
    return this.mesh(parent, geo, color, x, y, z);
  }

  /**
   * Batches repeated static templates (including multi-mesh GLB groups) into
   * InstancedMesh objects added to `parent`, eliminating per-instance clones.
   */
  batchStaticTemplates(
    parent: THREE.Object3D,
    placements: StaticPlacement[],
    options?: BatchTemplateOptions
  ): THREE.InstancedMesh[] {
    if (placements.length === 0) return [];

    const namePrefix = options?.namePrefix ?? 'batch';
    const castShadow = options?.castShadow ?? true;
    const receiveShadow = options?.receiveShadow ?? true;

    // Extract local sub-mesh descriptors once per unique template
    const templateSubMeshes = new Map<
      THREE.Object3D,
      Array<{ mesh: THREE.Mesh; localMatrix: THREE.Matrix4 }>
    >();

    for (const p of placements) {
      if (templateSubMeshes.has(p.template)) continue;
      p.template.updateMatrixWorld(true);
      this.scratchInv.copy(p.template.matrixWorld).invert();
      const parts: Array<{ mesh: THREE.Mesh; localMatrix: THREE.Matrix4 }> = [];
      p.template.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const localMatrix = new THREE.Matrix4().multiplyMatrices(this.scratchInv, mesh.matrixWorld);
          parts.push({ mesh, localMatrix });
        }
      });
      templateSubMeshes.set(p.template, parts);
    }

    // Group placements by unique template so each sub-mesh becomes 1 InstancedMesh
    const byTemplate = new Map<THREE.Object3D, StaticPlacement[]>();
    for (const p of placements) {
      let list = byTemplate.get(p.template);
      if (!list) {
        list = [];
        byTemplate.set(p.template, list);
      }
      list.push(p);
    }

    const created: THREE.InstancedMesh[] = [];
    for (const [template, groupPlacements] of byTemplate.entries()) {
      const parts = templateSubMeshes.get(template) || [];
      parts.forEach((part, partIdx) => {
        const instMesh = new THREE.InstancedMesh(
          part.mesh.geometry,
          part.mesh.material,
          groupPlacements.length
        );
        const safeName = template.name || part.mesh.name || `part_${partIdx}`;
        instMesh.name = `${namePrefix}_${safeName}`;
        instMesh.castShadow = castShadow;
        instMesh.receiveShadow = receiveShadow;

        for (let i = 0; i < groupPlacements.length; i++) {
          const p = groupPlacements[i];
          this.scratchDummy.position.set(p.position.x, p.position.y, p.position.z);
          this.scratchDummy.rotation.set(0, p.rotationY, 0);
          this.scratchDummy.scale.setScalar(p.scale);
          this.scratchDummy.updateMatrix();
          this.scratchChildMat.multiplyMatrices(this.scratchDummy.matrix, part.localMatrix);
          instMesh.setMatrixAt(i, this.scratchChildMat);
        }

        instMesh.instanceMatrix.needsUpdate = true;
        instMesh.computeBoundingSphere();
        parent.add(instMesh);
        created.push(instMesh);
      });
    }

    return created;
  }

  attachEffects(scene: THREE.Scene): void {
    this.effectsScene = scene;
    this.ensureEffectPools();
  }

  emitBurst(x: number, y: number, z: number): void {
    this.ensureEffectPools();
    if (!this.sparkMesh) return;

    for (let i = 0; i < 20; i++) {
      const idx = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_CAPACITY;
      const slot = this.sparkSlots[idx];
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = (Math.random() - 0.5) * 5;
      slot.vy = 3 + Math.random() * 3;
      slot.vz = (Math.random() - 0.5) * 5;
      slot.life = 1.2;

      this.scratchColor.setHex(SPARK_COLORS[i % SPARK_COLORS.length]);
      this.sparkMesh.setColorAt(idx, this.scratchColor);
      this.writeTransform(this.sparkMesh, idx, x, y, z, 0, 0, 0, 1.2);
    }

    if (this.sparkMesh.instanceColor) {
      this.sparkMesh.instanceColor.needsUpdate = true;
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  emitTrail(x: number, y: number, z: number, trailType: string): void {
    const kind =
      trailType === 'trail_flower'
        ? 'flower'
        : trailType === 'trail_stardust'
          ? 'star'
          : trailType === 'trail_frost'
            ? 'frost'
            : null;
    if (!kind) return;

    this.ensureEffectPools();
    if (!this.trailPools) return;

    const pool = this.trailPools[kind];
    const palette = TRAIL_PALETTES[kind];
    const count = kind === 'star' ? 2 : 1;

    for (let c = 0; c < count; c++) {
      const idx = pool.cursor;
      pool.cursor = (pool.cursor + 1) % TRAIL_CAPACITY;
      const slot = pool.slots[idx];

      const col = palette[Math.floor(Math.random() * palette.length)];
      const maxLife = 0.8 + Math.random() * 0.4;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.45;
      slot.y = y + 0.08 + Math.random() * 0.06;
      slot.z = z + (Math.random() - 0.5) * 0.45;
      slot.vx = (Math.random() - 0.5) * 0.3;
      slot.vy = 0.4 + Math.random() * 0.3;
      slot.vz = (Math.random() - 0.5) * 0.3;
      slot.rx = 0;
      slot.ry = 0;
      slot.rz = 0;
      slot.vrx = (Math.random() - 0.5) * 5;
      slot.vry = (Math.random() - 0.5) * 5;
      slot.vrz = (Math.random() - 0.5) * 5;
      slot.life = maxLife;
      slot.maxLife = maxLife;

      this.scratchColor.setHex(col);
      pool.mesh.setColorAt(idx, this.scratchColor);
      this.writeTransform(pool.mesh, idx, slot.x, slot.y, slot.z, 0, 0, 0, 0.01);
    }

    if (pool.mesh.instanceColor) {
      pool.mesh.instanceColor.needsUpdate = true;
    }
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.dirty = true;
  }

  updateEffects(dt: number): void {
    if (this.sparkMesh) {
      let anySparkDirty = false;
      for (let i = 0; i < SPARK_CAPACITY; i++) {
        const s = this.sparkSlots[i];
        if (!s.active) continue;
        anySparkDirty = true;
        s.life -= dt;
        s.vy -= dt * 6;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        if (s.life <= 0) {
          s.active = false;
          this.writeHidden(this.sparkMesh, i);
        } else {
          this.writeTransform(this.sparkMesh, i, s.x, s.y, s.z, 0, 0, 0, s.life);
        }
      }
      if (anySparkDirty) {
        this.sparkMesh.instanceMatrix.needsUpdate = true;
      }
    }

    if (this.trailPools) {
      for (const kind of ['flower', 'star', 'frost'] as const) {
        const pool = this.trailPools[kind];
        let anyTrailDirty = false;
        for (let i = 0; i < TRAIL_CAPACITY; i++) {
          const p = pool.slots[i];
          if (!p.active) continue;
          anyTrailDirty = true;
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.rx += p.vrx * dt;
          p.ry += p.vry * dt;
          p.rz += p.vrz * dt;
          if (p.life <= 0) {
            p.active = false;
            this.writeHidden(pool.mesh, i);
          } else {
            const progress = Math.max(0, p.life / p.maxLife);
            const scale = Math.max(0.001, Math.sin(progress * Math.PI));
            this.writeTransform(pool.mesh, i, p.x, p.y, p.z, p.rx, p.ry, p.rz, scale);
          }
        }
        if (anyTrailDirty) {
          pool.mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  }

  getActiveEffectCount(): { sparks: number; trails: number } {
    let sparks = 0;
    for (const s of this.sparkSlots) {
      if (s.active) sparks++;
    }
    let trails = 0;
    if (this.trailPools) {
      for (const kind of ['flower', 'star', 'frost'] as const) {
        for (const t of this.trailPools[kind].slots) {
          if (t.active) trails++;
        }
      }
    }
    return { sparks, trails };
  }

  dispose(): void {
    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();
    this.geometries.forEach((geo) => geo.dispose());
    this.geometries.clear();

    if (this.sparkMesh) {
      this.effectsScene?.remove(this.sparkMesh);
      this.sparkMesh.dispose();
      this.sparkMesh = null;
    }
    if (this.trailPools) {
      for (const kind of ['flower', 'star', 'frost'] as const) {
        const pool = this.trailPools[kind];
        this.effectsScene?.remove(pool.mesh);
        pool.mesh.dispose();
      }
      this.trailPools = null;
    }
    this.effectGeometries.forEach((g) => g.dispose());
    this.effectGeometries = [];
    this.effectMaterials.forEach((m) => m.dispose());
    this.effectMaterials = [];
    this.sparkSlots = [];
    this.effectsScene = null;
  }

  // ─── Private: Pool Initialization & Matrix Helpers ────────────────────────

  private ensureEffectPools(): void {
    if (!this.effectsScene || this.sparkMesh) return;

    const sparkGeo = new THREE.IcosahedronGeometry(0.09, 1);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.effectGeometries.push(sparkGeo);
    this.effectMaterials.push(sparkMat);

    const sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_CAPACITY);
    sparkMesh.name = 'effect_sparks_pool';
    sparkMesh.castShadow = false;
    sparkMesh.receiveShadow = false;
    sparkMesh.frustumCulled = false;

    this.sparkSlots = [];
    for (let i = 0; i < SPARK_CAPACITY; i++) {
      this.sparkSlots.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
      this.writeHidden(sparkMesh, i);
      sparkMesh.setColorAt(i, this.scratchColor.setHex(0xffffff));
    }
    sparkMesh.instanceMatrix.needsUpdate = true;
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
    this.effectsScene.add(sparkMesh);
    this.sparkMesh = sparkMesh;

    const createTrailPool = (kind: 'flower' | 'star' | 'frost', geo: THREE.BufferGeometry): TrailPool => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.effectGeometries.push(geo);
      this.effectMaterials.push(mat);

      const mesh = new THREE.InstancedMesh(geo, mat, TRAIL_CAPACITY);
      mesh.name = `effect_trail_${kind}_pool`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;

      const slots: TrailSlot[] = [];
      for (let i = 0; i < TRAIL_CAPACITY; i++) {
        slots.push({
          active: false,
          x: 0,
          y: 0,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          rx: 0,
          ry: 0,
          rz: 0,
          vrx: 0,
          vry: 0,
          vrz: 0,
          life: 0,
          maxLife: 1
        });
        this.writeHidden(mesh, i);
        mesh.setColorAt(i, this.scratchColor.setHex(0xffffff));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.effectsScene!.add(mesh);

      return { kind, mesh, slots, cursor: 0, dirty: false };
    };

    this.trailPools = {
      flower: createTrailPool('flower', new THREE.IcosahedronGeometry(0.12, 0)),
      star: createTrailPool('star', new THREE.TetrahedronGeometry(0.11, 0)),
      frost: createTrailPool('frost', new THREE.OctahedronGeometry(0.12, 0))
    };
  }

  private writeTransform(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    scale: number
  ): void {
    this.scratchDummy.position.set(x, y, z);
    this.scratchDummy.rotation.set(rx, ry, rz);
    this.scratchDummy.scale.setScalar(scale);
    this.scratchDummy.updateMatrix();
    mesh.setMatrixAt(index, this.scratchDummy.matrix);
  }

  private writeHidden(mesh: THREE.InstancedMesh, index: number): void {
    this.scratchMat.makeScale(0, 0, 0);
    mesh.setMatrixAt(index, this.scratchMat);
  }
}
