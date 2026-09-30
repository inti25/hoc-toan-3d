import * as THREE from 'three';

/**
 * Shared reusable geometry builder for Three.js scenes.
 * Manages material caching and simplifies creating positioned, shadow-enabled primitives.
 */
export class GeometryBuilder {
  private materials = new Map<number, THREE.MeshStandardMaterial>();

  material(color: number, roughness = 0.9, metalness = 0): THREE.MeshStandardMaterial {
    let mat = this.materials.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      this.materials.set(color, mat);
    }
    return mat;
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
    return this.mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);
  }

  sphere(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: number): THREE.Mesh {
    return this.mesh(parent, new THREE.IcosahedronGeometry(r, 1), color, x, y, z);
  }

  cylinder(parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, h: number, color: number, segments = 8): THREE.Mesh {
    return this.mesh(parent, new THREE.CylinderGeometry(top, bottom, h, segments), color, x, y, z);
  }

  dispose(): void {
    this.materials.forEach(mat => mat.dispose());
    this.materials.clear();
  }
}
