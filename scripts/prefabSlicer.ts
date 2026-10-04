import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, type Document, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument, prune } from '@gltf-transform/functions';
import * as THREE from 'three';
import type { MeshCatalog, MeshCatalogItem, MeshSemanticCategory } from '../src/data/meshCatalogTypes';

export interface SliceOptions {
  catalogPath?: string;
  outDir?: string;
  categories?: MeshSemanticCategory[];
  ids?: string[];
  limit?: number;
  verbose?: boolean;
}

export interface SliceResult {
  totalProcessed: number;
  totalSuccess: number;
  totalSkipped: number;
  totalBytes: number;
  outputDir: string;
  catalogUpdated: boolean;
}

/**
 * Bóc tách một thực thể đơn lẻ từ mô hình nguồn thành tệp .glb độc lập chuẩn hóa.
 */
export async function sliceCatalogItem(
  item: MeshCatalogItem,
  docCache: Map<string, Document>,
  io: NodeIO,
  outDir: string
): Promise<{ success: boolean; filePath?: string; bytes?: number; error?: string }> {
  const sourceFile = path.resolve(item.sourceFile);
  if (!fs.existsSync(sourceFile)) {
    return { success: false, error: `Không tìm thấy file nguồn: ${item.sourceFile}` };
  }

  // 1. Nạp Document nguồn (dùng cache để tối ưu hiệu năng)
  let baseDoc = docCache.get(sourceFile);
  if (!baseDoc) {
    baseDoc = await io.read(sourceFile);
    docCache.set(sourceFile, baseDoc);
  }

  const outFileName = `${item.id}.glb`;
  const outFilePath = path.join(outDir, outFileName);

  // 2. Trường hợp nhân vật độc lập
  if (item.category === 'CHARACTER') {
    // Đã là file riêng biệt, nhân bản và xuất sang GLB độc lập
    const charDoc = cloneDocument(baseDoc);
    await charDoc.transform(prune());
    const glbBuffer = await io.writeBinary(charDoc);
    fs.writeFileSync(outFilePath, Buffer.from(glbBuffer));
    return { success: true, filePath: outFilePath, bytes: glbBuffer.length };
  }

  // 3. Trường hợp thực thể nằm trong mô hình tổng hợp (park, lake...)
  const cloned = cloneDocument(baseDoc);

  // Tìm node đại diện cho thực thể theo item.name
  const targetNode = cloned.getRoot().listNodes().find((n) => n.getName() === item.name);
  if (!targetNode) {
    return { success: false, error: `Không tìm thấy node '${item.name}' trong ${item.sourceFile}` };
  }

  // Gom các node có chứa mesh thuộc thực thể
  const childrenWithMesh: Node[] = [];
  targetNode.traverse((descendant) => {
    if (descendant.getMesh() !== null) {
      childrenWithMesh.push(descendant);
    }
  });

  if (childrenWithMesh.length === 0) {
    return { success: false, error: `Thực thể '${item.name}' không chứa mesh nào` };
  }

  // 4. Tính toán bounding box thực tế và tâm đáy (Pivot Alignment)
  const box = new THREE.Box3();
  const v = new THREE.Vector3();

  for (const child of childrenWithMesh) {
    const wm = new THREE.Matrix4().fromArray(child.getWorldMatrix());
    const mesh = child.getMesh();
    if (!mesh) continue;

    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute('POSITION');
      if (!posAttr) continue;

      for (let i = 0; i < posAttr.getCount(); i++) {
        v.fromArray(posAttr.getElement(i, [])).applyMatrix4(wm);
        box.expandByPoint(v);
      }
    }
  }

  const center = new THREE.Vector3();
  box.getCenter(center);
  const bottomY = box.min.y;

  // 5. Chuẩn hóa hình học: Biến đổi từng đỉnh về tâm đáy (X=0, Z=0, Y=0)
  for (const child of childrenWithMesh) {
    const wm = new THREE.Matrix4().fromArray(child.getWorldMatrix());
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(wm);
    const mesh = child.getMesh();
    if (!mesh) continue;

    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute('POSITION');
      if (posAttr) {
        for (let i = 0; i < posAttr.getCount(); i++) {
          v.fromArray(posAttr.getElement(i, [])).applyMatrix4(wm);
          posAttr.setElement(i, [v.x - center.x, v.y - bottomY, v.z - center.z]);
        }
      }

      const normAttr = prim.getAttribute('NORMAL');
      if (normAttr) {
        const n = new THREE.Vector3();
        for (let i = 0; i < normAttr.getCount(); i++) {
          n.fromArray(normAttr.getElement(i, [])).applyMatrix3(normalMatrix).normalize();
          normAttr.setElement(i, [n.x, n.y, n.z]);
        }
      }
    }

    // Reset transform của node con về identity
    child.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }

  // Reset transform của targetNode về identity
  targetNode.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);

  // 6. Cô lập Sub-graph: Tạo scene mới chỉ chứa targetNode và dọn dẹp (pruning)
  const newScene = cloned.createScene('Scene').addChild(targetNode);
  for (const s of cloned.getRoot().listScenes()) {
    if (s !== newScene) s.dispose();
  }

  // Loại bỏ các node khác ngoài targetNode và các con của nó
  for (const n of cloned.getRoot().listNodes()) {
    if (n !== targetNode && !childrenWithMesh.includes(n) && !targetNode.listChildren().includes(n)) {
      if (!n.isDisposed()) n.dispose();
    }
  }

  // Prune các accessor, bufferView, texture, material không dùng
  await cloned.transform(prune());

  // 7. Xuất binary GLB
  const glbBuffer = await io.writeBinary(cloned);
  fs.writeFileSync(outFilePath, Buffer.from(glbBuffer));

  return { success: true, filePath: outFilePath, bytes: glbBuffer.length };
}

/**
 * Thực hiện bóc tách toàn bộ hoặc một phần danh mục Catalog thành các file prefab GLB.
 */
export async function slicePrefabs(options: SliceOptions = {}): Promise<SliceResult> {
  const catalogPath = path.resolve(options.catalogPath || 'public/data/meshCatalog.json');
  const outDir = path.resolve(options.outDir || 'public/3dmodel/prefabs');

  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Không tìm thấy file catalog tại: ${catalogPath}. Vui lòng chạy npm run scan:models trước.`);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const catalog: MeshCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const docCache = new Map<string, Document>();

  let itemsToProcess = catalog.items;

  if (options.categories && options.categories.length > 0) {
    itemsToProcess = itemsToProcess.filter((i) => options.categories!.includes(i.category));
  }

  if (options.ids && options.ids.length > 0) {
    itemsToProcess = itemsToProcess.filter((i) => options.ids!.includes(i.id));
  }

  if (options.limit && options.limit > 0) {
    itemsToProcess = itemsToProcess.slice(0, options.limit);
  }

  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalBytes = 0;

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    try {
      const res = await sliceCatalogItem(item, docCache, io, outDir);
      if (res.success && res.bytes) {
        totalSuccess++;
        totalBytes += res.bytes;
        // Cập nhật prefabPath tương đối từ thư mục public/
        item.prefabPath = `3dmodel/prefabs/${item.id}.glb`;

        if (options.verbose) {
          const kb = (res.bytes / 1024).toFixed(1);
          console.log(`  [${i + 1}/${itemsToProcess.length}] ✅ ${item.id} (${kb} KB)`);
        }
      } else {
        totalSkipped++;
        if (options.verbose) {
          console.warn(`  [${i + 1}/${itemsToProcess.length}] ⚠️ Bỏ qua ${item.id}: ${res.error}`);
        }
      }
    } catch (err) {
      totalSkipped++;
      console.error(`  [${i + 1}/${itemsToProcess.length}] ❌ Lỗi bóc tách ${item.id}:`, err);
    }
  }

  // Cập nhật lại file catalog JSON với prefabPath đã điền
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

  return {
    totalProcessed: itemsToProcess.length,
    totalSuccess,
    totalSkipped,
    totalBytes,
    outputDir: outDir,
    catalogUpdated: true
  };
}
