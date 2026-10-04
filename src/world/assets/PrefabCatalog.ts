import * as THREE from 'three';
import type { MeshCatalog, MeshCatalogItem, MeshSemanticCategory } from '../../data/meshCatalogTypes';

export class PrefabCatalog {
  private catalog: MeshCatalog | null = null;
  private itemMap = new Map<string, MeshCatalogItem>();
  private categoryMap = new Map<MeshSemanticCategory, MeshCatalogItem[]>();
  private subCategoryMap = new Map<string, MeshCatalogItem[]>();
  private loadingPromise: Promise<MeshCatalog | null> | null = null;

  public isLoaded(): boolean {
    return this.catalog !== null;
  }

  public setCatalog(catalog: MeshCatalog): void {
    this.catalog = catalog;
    this.itemMap.clear();
    this.categoryMap.clear();
    this.subCategoryMap.clear();

    for (const item of catalog.items) {
      this.itemMap.set(item.id, item);

      // Nhóm theo danh mục chính
      const catList = this.categoryMap.get(item.category) || [];
      catList.push(item);
      this.categoryMap.set(item.category, catList);

      // Nhóm theo danh mục phụ
      if (item.subCategory) {
        const subList = this.subCategoryMap.get(item.subCategory) || [];
        subList.push(item);
        this.subCategoryMap.set(item.subCategory, subList);
      }
    }
  }

  public async load(catalogUrl: string): Promise<MeshCatalog | null> {
    if (this.catalog) return this.catalog;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const res = await fetch(catalogUrl);
        if (!res.ok) {
          console.warn(`[PrefabCatalog] Không thể tải catalog từ ${catalogUrl}: HTTP ${res.status}`);
          return null;
        }
        const data: MeshCatalog = await res.json();
        this.setCatalog(data);
        return data;
      } catch (err) {
        console.warn(`[PrefabCatalog] Lỗi khi nạp catalog từ ${catalogUrl}:`, err);
        return null;
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  public getItem(id: string): MeshCatalogItem | undefined {
    return this.itemMap.get(id);
  }

  public getItemsByCategory(category: MeshSemanticCategory): MeshCatalogItem[] {
    return this.categoryMap.get(category) || [];
  }

  public getItemsBySubCategory(subCategory: string): MeshCatalogItem[] {
    return this.subCategoryMap.get(subCategory) || [];
  }

  public getAllItems(): MeshCatalogItem[] {
    return this.catalog?.items || [];
  }

  public getRandomItem(filter?: {
    category?: MeshSemanticCategory;
    subCategory?: string;
    isObstacle?: boolean;
  }): MeshCatalogItem | undefined {
    let pool = this.getAllItems();
    if (filter?.category) {
      pool = pool.filter((i) => i.category === filter.category);
    }
    if (filter?.subCategory) {
      pool = pool.filter((i) => i.subCategory === filter.subCategory);
    }
    if (filter?.isObstacle !== undefined) {
      pool = pool.filter((i) => i.isObstacle === filter.isObstacle);
    }
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Tạo mô hình placeholder cơ bản (low-poly) nếu prefab GLB chưa tải xong hoặc gặp sự cố mạng.
   */
  public createPlaceholder(item?: Partial<MeshCatalogItem>): THREE.Group {
    const group = new THREE.Group();
    const size = item?.normalizedBounds?.size || [1, 2, 1];
    const [w, h, d] = size;
    const cat = item?.category;

    if (cat === 'FOLIAGE') {
      const isTreeOrPine = item?.subCategory === 'tree' || item?.subCategory === 'pine';
      if (isTreeOrPine) {
        // Thân cây
        const trunkGeo = new THREE.CylinderGeometry(w * 0.1, w * 0.15, h * 0.4, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = h * 0.2;
        group.add(trunk);

        // Tán lá
        const foliageGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.5, h * 0.7, 7);
        const foliageMat = new THREE.MeshLambertMaterial({ color: item?.subCategory === 'pine' ? 0x1b5e20 : 0x2e7d32 });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = h * 0.65;
        group.add(foliage);
      } else {
        // Bụi cây hoặc hoa
        const bushGeo = new THREE.SphereGeometry(Math.max(w, d) * 0.5, 6, 5);
        const bushMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.y = h * 0.5;
        group.add(bush);
      }
    } else if (cat === 'OBSTACLE') {
      // Tảng đá low-poly
      const rockRadius = Math.max(w, d, h) * 0.45;
      const rockGeo = new THREE.DodecahedronGeometry(rockRadius, 0);
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x78909c, flatShading: true });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.y = rockRadius;
      group.add(rock);
    } else {
      // Prop hoặc đối tượng chung
      const boxGeo = new THREE.BoxGeometry(w, h, d);
      const boxMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = h * 0.5;
      group.add(box);
    }

    return group;
  }
}

export const prefabCatalog = new PrefabCatalog();
