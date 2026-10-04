/**
 * Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog) — Định nghĩa kiểu dữ liệu và Schema chuẩn.
 *
 * Định nghĩa cấu trúc lưu trữ thông tin hình học, phân loại ngữ nghĩa và
 * tham số vật cản trích xuất từ kho mô hình 3D (GLTF/GLB) để phục vụ:
 * 1. Tái sử dụng mesh cho các Bản Mẫu Vùng Đất mới (Zone Templates / Procedural Land Builder).
 * 2. Tự động tính toán vật cản (Spatial Collision) và vùng an toàn (Keep-out zones).
 * 3. Hỗ trợ bóc tách prefab độc lập (.glb) và nạp lười (lazy loading).
 */

export type MeshSemanticCategory =
  | 'TERRAIN'      // Mặt đất, bờ cát, nước, đường đi, nền đảo
  | 'FOLIAGE'      // Cây cối, thông, bụi rậm, hoa lá, nấm
  | 'PROP'         // Cột đèn, ghế đá, ống dẫn, thuyền, rào chắn
  | 'OBSTACLE'     // Tảng đá, bia đá, tường chắn, khối cản lớn
  | 'CHARACTER'    // Nhân vật đại diện (Elsa, Sanrio, NPC)
  | 'ENVIRONMENT'; // Đám mây, bầu trời, hiệu ứng môi trường

export type FoliageSubCategory = 'tree' | 'pine' | 'bush' | 'flower' | 'grass' | 'mushroom' | 'plant';
export type PropSubCategory = 'lamp' | 'bench' | 'pipe' | 'boat' | 'fence' | 'box' | 'cylinder' | 'decor';
export type TerrainSubCategory = 'island' | 'water' | 'sand' | 'dirt' | 'ground' | 'road';
export type ObstacleSubCategory = 'rock' | 'stone' | 'monolith' | 'barrier';
export type CharacterSubCategory = 'hero' | 'companion' | 'npc';

export type MeshSubCategory =
  | FoliageSubCategory
  | PropSubCategory
  | TerrainSubCategory
  | ObstacleSubCategory
  | CharacterSubCategory
  | string;

export interface BoundingBox3D {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number]; // [width (X), height (Y), depth (Z)]
}

export interface MaterialSummary {
  name: string;
  baseColorHex?: string;
  hasTexture: boolean;
  roughness?: number;
  metallic?: number;
}

export interface MeshCatalogItem {
  /** Mã định danh chuẩn hóa duy nhất (VD: "park_tree_002", "lake_stone1_01", "char_elsa") */
  id: string;

  /** Tên node hoặc mesh gốc từ file 3D */
  name: string;

  /** Đường dẫn tương đối từ thư mục gốc đến file nguồn (VD: "public/3dmodel/maps/park.glb") */
  sourceFile: string;

  /** Phân loại ngữ nghĩa chính */
  category: MeshSemanticCategory;

  /** Phân loại chi tiết (VD: "tree", "lamp", "rock", "water") */
  subCategory: MeshSubCategory;

  /** Đường dẫn phân cấp node trong scene (VD: ["RootNode", "Tree002"]) */
  nodePath: string[];

  /** Danh sách tên các mesh con thuộc thực thể này */
  meshNames: string[];

  /** Tổng số primitive hình học */
  primitiveCount: number;

  /** Tổng số đỉnh (vertices) */
  vertexCount: number;

  /** Tổng số tam giác (triangles) */
  triangleCount: number;

  /** Khung bao AABB không gian thực tế trong mô hình nguồn */
  bounds: BoundingBox3D;

  /** Khung bao AABB đã chuẩn hóa (tâm đáy tại Y=0, X=0, Z=0) để đặt trực tiếp lên mặt đất */
  normalizedBounds: BoundingBox3D;

  /** Bán kính va chạm vật cản ước tính (mét). 0 nếu là vật thể đi xuyên qua được như cỏ/hoa/nước */
  obstacleRadius: number;

  /** Đánh dấu xem thực thể có cản trở chuyển động của người chơi hay không */
  isObstacle: boolean;

  /** Thông tin tóm tắt về vật liệu và texture */
  materials: MaterialSummary[];

  /** Đường dẫn file prefab độc lập nếu đã bóc tách (VD: "3dmodel/prefabs/park_tree_002.glb") */
  prefabPath?: string;

  /** Bộ từ khóa tìm kiếm và lọc (VD: ["tree", "foliage", "park", "nature"]) */
  tags: string[];
}

export interface SourceModelInfo {
  filePath: string;
  format: 'glb' | 'gltf';
  fileSizeBytes: number;
  meshCount: number;
  nodeCount: number;
  extractedItemsCount: number;
}

export interface MeshCatalog {
  /** Phiên bản cấu trúc schema */
  version: string;

  /** Thời điểm tạo file (ISO-8601) */
  generatedAt: string;

  /** Tổng số file mô hình nguồn đã quét */
  sourceCount: number;

  /** Tổng số thực thể/mesh được catalog */
  totalItems: number;

  /** Thống kê số lượng thực thể theo từng danh mục ngữ nghĩa */
  byCategory: Record<MeshSemanticCategory, number>;

  /** Danh sách thông tin các file nguồn */
  sources: SourceModelInfo[];

  /** Danh mục chi tiết toàn bộ các thực thể mesh */
  items: MeshCatalogItem[];
}
