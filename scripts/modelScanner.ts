import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, type Document, type Node, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import type {
  MeshCatalog,
  MeshCatalogItem,
  MeshSemanticCategory,
  MeshSubCategory,
  SourceModelInfo,
  MaterialSummary,
  BoundingBox3D
} from '../src/data/meshCatalogTypes';

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export interface ScanOptions {
  modelDir: string;
  outputPath?: string;
  verbose?: boolean;
}

/**
 * Phân loại ngữ nghĩa cho một thực thể 3D dựa trên tên, đường dẫn và kích thước hình học.
 */
export function classifyMeshSemantic(
  name: string,
  modelPath: string,
  boundsSize: [number, number, number]
): {
  category: MeshSemanticCategory;
  subCategory: MeshSubCategory;
  tags: string[];
  isObstacle: boolean;
  obstacleRadius: number;
} {
  const normPath = modelPath.toLowerCase().replace(/\\/g, '/');
  const lowerName = name.toLowerCase();
  const [width, height, depth] = boundsSize;
  const maxFootprint = Math.max(width, depth);

  // 1. Kiểm tra nhân vật
  const isCharFolder =
    normPath.includes('elsa') ||
    normPath.includes('cinnamoroll') ||
    normPath.includes('hellokitty') ||
    normPath.includes('kuromi') ||
    normPath.includes('mymelody') ||
    normPath.includes('character');

  if (isCharFolder || lowerName.includes('character') || lowerName.includes('hero') || lowerName.includes('avatar')) {
    return {
      category: 'CHARACTER',
      subCategory: normPath.includes('elsa') ? 'hero' : 'companion',
      tags: ['character', 'companion', 'interactive'],
      isObstacle: true,
      obstacleRadius: 0.4
    };
  }

  // 2. Kiểm tra Môi trường / Bầu trời
  if (lowerName.includes('cloud') || lowerName.includes('sky') || lowerName.includes('sun') || lowerName.includes('moon')) {
    return {
      category: 'ENVIRONMENT',
      subCategory: 'cloud',
      tags: ['environment', 'sky', 'visual'],
      isObstacle: false,
      obstacleRadius: 0
    };
  }

  // 3. Kiểm tra Địa hình (Terrain)
  const isTerrain =
    lowerName.includes('island') ||
    lowerName.includes('water') ||
    lowerName.includes('sand') ||
    lowerName.includes('dirt') ||
    lowerName.includes('ground') ||
    lowerName.includes('road') ||
    lowerName.includes('path') ||
    lowerName.includes('terrain') ||
    lowerName.includes('floor') ||
    lowerName.includes('circle004') ||
    lowerName.includes('circle006') ||
    lowerName.includes('plane002');

  if (isTerrain) {
    let subCategory: MeshSubCategory = 'ground';
    if (lowerName.includes('water')) subCategory = 'water';
    else if (lowerName.includes('island')) subCategory = 'island';
    else if (lowerName.includes('sand')) subCategory = 'sand';
    else if (lowerName.includes('dirt')) subCategory = 'dirt';
    else if (lowerName.includes('road') || lowerName.includes('path')) subCategory = 'road';

    return {
      category: 'TERRAIN',
      subCategory,
      tags: ['terrain', subCategory, 'walkable'],
      isObstacle: false,
      obstacleRadius: 0
    };
  }

  // 4. Kiểm tra Thực vật / Cây cỏ (Foliage)
  const isTree = lowerName.includes('tree');
  const isPine = lowerName.includes('pine');
  const isBush = lowerName.includes('bush');
  const isFlower = lowerName.includes('flower') || lowerName.includes('flowers');
  const isGrass = lowerName.includes('grass');
  const isMushroom = lowerName.includes('mushroom');
  const isPlant = lowerName.includes('plant');

  if (isTree || isPine || isBush || isFlower || isGrass || isMushroom || isPlant) {
    let subCategory: MeshSubCategory = 'tree';
    if (isPine) subCategory = 'pine';
    else if (isBush) subCategory = 'bush';
    else if (isFlower) subCategory = 'flower';
    else if (isGrass) subCategory = 'grass';
    else if (isMushroom) subCategory = 'mushroom';
    else if (isPlant) subCategory = 'plant';

    const tags = ['foliage', 'nature', subCategory];

    // Cỏ và hoa cho phép đi xuyên qua, không tạo vật cản
    if (isGrass || isFlower || isMushroom) {
      return {
        category: 'FOLIAGE',
        subCategory,
        tags: [...tags, 'walk-through'],
        isObstacle: false,
        obstacleRadius: 0
      };
    }

    // Bụi cây nhỏ không cản đường
    if ((isBush || isPlant) && height < 0.6 && maxFootprint < 0.6) {
      return {
        category: 'FOLIAGE',
        subCategory,
        tags: [...tags, 'walk-through'],
        isObstacle: false,
        obstacleRadius: 0
      };
    }

    // Cây thân gỗ hoặc bụi cây lớn tạo vật cản
    const obstacleRadius = isTree || isPine
      ? round3(Math.max(0.3, Math.min(2.0, maxFootprint * 0.25)))
      : round3(Math.max(0.25, Math.min(1.5, maxFootprint * 0.35)));

    return {
      category: 'FOLIAGE',
      subCategory,
      tags: [...tags, 'obstacle'],
      isObstacle: true,
      obstacleRadius
    };
  }

  // 5. Kiểm tra Tảng đá / Vật cản cố định (Obstacle)
  const isRock =
    lowerName.includes('stone') ||
    lowerName.includes('rock') ||
    lowerName.includes('boulder') ||
    lowerName.includes('monolith') ||
    lowerName.includes('barrier');

  if (isRock) {
    const obstacleRadius = round3(Math.max(0.3, Math.min(3.0, maxFootprint * 0.45)));
    return {
      category: 'OBSTACLE',
      subCategory: 'stone',
      tags: ['obstacle', 'rock', 'solid'],
      isObstacle: true,
      obstacleRadius
    };
  }

  // 6. Kiểm tra Đạo cụ / Trang trí (Prop)
  const isLamp = lowerName.includes('lamp') || lowerName.includes('light');
  const isBench = lowerName.includes('bench') || lowerName.includes('chair');
  const isPipe = lowerName.includes('pipe');
  const isBoat = lowerName.includes('boat');
  const isCylinder = lowerName.includes('cylinder');
  const isCube = lowerName.includes('cube') || lowerName.includes('box');

  let propSub: MeshSubCategory = 'decor';
  let obstacleRadius = 0;
  let isObstacle = false;

  if (isLamp) {
    propSub = 'lamp';
    obstacleRadius = 0.3;
    isObstacle = true;
  } else if (isBench) {
    propSub = 'bench';
    obstacleRadius = round3(Math.max(0.4, maxFootprint * 0.4));
    isObstacle = true;
  } else if (isPipe || isBoat) {
    propSub = isPipe ? 'pipe' : 'boat';
    obstacleRadius = round3(Math.max(0.4, maxFootprint * 0.4));
    isObstacle = true;
  } else if (isCylinder || isCube) {
    propSub = isCylinder ? 'cylinder' : 'box';
    if (height > 0.4) {
      obstacleRadius = round3(Math.max(0.3, maxFootprint * 0.45));
      isObstacle = true;
    }
  }

  return {
    category: 'PROP',
    subCategory: propSub,
    tags: ['prop', propSub, isObstacle ? 'obstacle' : 'decor'],
    isObstacle,
    obstacleRadius
  };
}

/**
 * Tìm kiếm đệ quy toàn bộ file GLB/GLTF trong thư mục.
 */
export function find3DModelFiles(dirPath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...find3DModelFiles(fullPath));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.glb' || ext === '.gltf') {
        results.push(fullPath);
      }
    }
  }
  return results;
}

interface EntityTarget {
  id: string;
  name: string;
  nodePath: string[];
  nodes: Node[];
  isCharacter?: boolean;
}

/**
 * Xác định các thực thể logic từ tài liệu GLTF/GLB.
 */
function identifyEntitiesInDocument(doc: Document, sourceFile: string): EntityTarget[] {
  const normPath = sourceFile.toLowerCase().replace(/\\/g, '/');
  const baseName = path.basename(sourceFile, path.extname(sourceFile)).toLowerCase();
  const dirName = path.basename(path.dirname(sourceFile)).toLowerCase();

  // Kiểm tra mô hình nhân vật
  const isCharacter =
    normPath.includes('elsa') ||
    normPath.includes('cinnamoroll') ||
    normPath.includes('hellokitty') ||
    normPath.includes('kuromi') ||
    normPath.includes('mymelody') ||
    normPath.includes('character');

  if (isCharacter) {
    const charName = dirName !== '3dmodel' ? dirName : baseName;
    const allNodesWithMesh = doc.getRoot().listNodes().filter((n) => n.getMesh() !== null);
    return [
      {
        id: `char_${charName}`,
        name: charName,
        nodePath: ['Root', charName],
        nodes: allNodesWithMesh,
        isCharacter: true
      }
    ];
  }

  // Đối với map hoặc cảnh quan lớn
  const scenes = doc.getRoot().listScenes();
  if (scenes.length === 0) return [];

  const allNodes = doc.getRoot().listNodes();
  let entityContainer: Node | null = null;

  for (const node of allNodes) {
    const children = node.listChildren();
    if (children.length >= 10) {
      entityContainer = node;
      break;
    }
  }

  const entities: EntityTarget[] = [];
  const prefix = baseName.replace(/[^a-zA-Z0-9_]/g, '_');

  if (entityContainer) {
    for (const child of entityContainer.listChildren()) {
      const childName = child.getName() || 'entity';
      const descendantNodesWithMesh: Node[] = [];

      child.traverse((descendant) => {
        if (descendant.getMesh() !== null) {
          descendantNodesWithMesh.push(descendant);
        }
      });

      if (descendantNodesWithMesh.length > 0) {
        const cleanId = `${prefix}_${childName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
        entities.push({
          id: cleanId,
          name: childName,
          nodePath: [entityContainer.getName() || 'Root', childName],
          nodes: descendantNodesWithMesh
        });
      }
    }
  } else {
    for (const node of allNodes) {
      if (node.getMesh() !== null) {
        const nodeName = node.getName() || `mesh_${node.getMesh()?.getName() || 'obj'}`;
        const cleanId = `${prefix}_${nodeName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
        entities.push({
          id: cleanId,
          name: nodeName,
          nodePath: [nodeName],
          nodes: [node]
        });
      }
    }
  }

  return entities;
}

/**
 * Trích xuất vật liệu từ danh sách primitive.
 */
function extractMaterials(primitives: Primitive[]): MaterialSummary[] {
  const matMap = new Map<string, MaterialSummary>();

  for (const prim of primitives) {
    const mat = prim.getMaterial();
    if (!mat) continue;

    const name = mat.getName() || 'DefaultMaterial';
    if (matMap.has(name)) continue;

    const color = mat.getBaseColorFactor();
    let baseColorHex: string | undefined;
    if (color && color.length >= 3) {
      const r = Math.round(color[0] * 255);
      const g = Math.round(color[1] * 255);
      const b = Math.round(color[2] * 255);
      baseColorHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    matMap.set(name, {
      name,
      baseColorHex,
      hasTexture: !!mat.getBaseColorTexture(),
      roughness: round3(mat.getRoughnessFactor()),
      metallic: round3(mat.getMetallicFactor())
    });
  }

  return Array.from(matMap.values());
}

/**
 * Tính toán hình học bounding box, số lượng đỉnh và tam giác cho một thực thể.
 */
function computeEntityGeometry(
  nodes: Node[],
  isCharacter?: boolean
): {
  bounds: BoundingBox3D;
  normalizedBounds: BoundingBox3D;
  primitiveCount: number;
  vertexCount: number;
  triangleCount: number;
  meshNames: string[];
  materials: MaterialSummary[];
} {
  const worldBox = new THREE.Box3();
  const v = new THREE.Vector3();
  let primitiveCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  const meshNamesSet = new Set<string>();
  const allPrimitives: Primitive[] = [];

  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    const meshName = mesh.getName() || node.getName();
    if (meshName) meshNamesSet.add(meshName);

    const worldMatrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());

    for (const prim of mesh.listPrimitives()) {
      primitiveCount++;
      allPrimitives.push(prim);

      const posAttr = prim.getAttribute('POSITION');
      if (posAttr) {
        const count = posAttr.getCount();
        vertexCount += count;

        for (let i = 0; i < count; i++) {
          const el = posAttr.getElement(i, []);
          v.set(el[0], el[1], el[2]);
          if (!isCharacter) {
            v.applyMatrix4(worldMatrix);
          }
          worldBox.expandByPoint(v);
        }
      }

      const indicesAttr = prim.getIndices();
      if (indicesAttr) {
        triangleCount += Math.floor(indicesAttr.getCount() / 3);
      } else if (posAttr) {
        triangleCount += Math.floor(posAttr.getCount() / 3);
      }
    }
  }

  if (worldBox.isEmpty()) {
    worldBox.min.set(0, 0, 0);
    worldBox.max.set(1, 1, 1);
  }

  const worldSize = new THREE.Vector3();
  worldBox.getSize(worldSize);
  const worldCenter = new THREE.Vector3();
  worldBox.getCenter(worldCenter);

  const bounds: BoundingBox3D = {
    min: [round3(worldBox.min.x), round3(worldBox.min.y), round3(worldBox.min.z)],
    max: [round3(worldBox.max.x), round3(worldBox.max.y), round3(worldBox.max.z)],
    center: [round3(worldCenter.x), round3(worldCenter.y), round3(worldCenter.z)],
    size: [round3(worldSize.x), round3(worldSize.y), round3(worldSize.z)]
  };

  const normSize: [number, number, number] = [bounds.size[0], bounds.size[1], bounds.size[2]];
  const normalizedBounds: BoundingBox3D = {
    min: [round3(-normSize[0] / 2), 0, round3(-normSize[2] / 2)],
    max: [round3(normSize[0] / 2), round3(normSize[1]), round3(normSize[2] / 2)],
    center: [0, round3(normSize[1] / 2), 0],
    size: normSize
  };

  return {
    bounds,
    normalizedBounds,
    primitiveCount,
    vertexCount,
    triangleCount,
    meshNames: Array.from(meshNamesSet),
    materials: extractMaterials(allPrimitives)
  };
}

/**
 * Quét toàn bộ thư mục mô hình 3D và sinh dữ liệu MeshCatalog hoàn chỉnh.
 */
export async function scanModelsDirectory(options: ScanOptions): Promise<MeshCatalog> {
  const modelDir = path.resolve(options.modelDir);
  const files = find3DModelFiles(modelDir);

  if (options.verbose) {
    console.log(`[scanModelsDirectory] Tìm thấy ${files.length} file 3D trong ${modelDir}`);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const catalogItems: MeshCatalogItem[] = [];
  const sourceModels: SourceModelInfo[] = [];

  const byCategory: Record<MeshSemanticCategory, number> = {
    TERRAIN: 0,
    FOLIAGE: 0,
    PROP: 0,
    OBSTACLE: 0,
    CHARACTER: 0,
    ENVIRONMENT: 0
  };

  for (const filePath of files) {
    const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);

    if (options.verbose) {
      console.log(`[scanModelsDirectory] Đang xử lý: ${relPath}`);
    }

    try {
      const doc = await io.read(filePath);
      const meshes = doc.getRoot().listMeshes();
      const nodes = doc.getRoot().listNodes();

      const entities = identifyEntitiesInDocument(doc, filePath);
      let extractedCount = 0;

      for (const entity of entities) {
        const geom = computeEntityGeometry(entity.nodes, entity.isCharacter);
        const classification = classifyMeshSemantic(entity.name, relPath, geom.normalizedBounds.size);

        const item: MeshCatalogItem = {
          id: entity.id,
          name: entity.name,
          sourceFile: relPath,
          category: classification.category,
          subCategory: classification.subCategory,
          nodePath: entity.nodePath,
          meshNames: geom.meshNames,
          primitiveCount: geom.primitiveCount,
          vertexCount: geom.vertexCount,
          triangleCount: geom.triangleCount,
          bounds: geom.bounds,
          normalizedBounds: geom.normalizedBounds,
          obstacleRadius: classification.obstacleRadius,
          isObstacle: classification.isObstacle,
          materials: geom.materials,
          tags: classification.tags
        };

        catalogItems.push(item);
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
        extractedCount++;
      }

      sourceModels.push({
        filePath: relPath,
        format: ext === '.glb' ? 'glb' : 'gltf',
        fileSizeBytes: stat.size,
        meshCount: meshes.length,
        nodeCount: nodes.length,
        extractedItemsCount: extractedCount
      });
    } catch (err) {
      console.error(`[scanModelsDirectory] Lỗi khi đọc file ${relPath}:`, err);
    }
  }

  const catalog: MeshCatalog = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceCount: sourceModels.length,
    totalItems: catalogItems.length,
    byCategory,
    sources: sourceModels,
    items: catalogItems
  };

  if (options.outputPath) {
    const outDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, JSON.stringify(catalog, null, 2), 'utf-8');
    if (options.verbose) {
      console.log(`[scanModelsDirectory] Đã ghi catalog ra: ${options.outputPath} (${catalogItems.length} thực thể)`);
    }
  }

  return catalog;
}
