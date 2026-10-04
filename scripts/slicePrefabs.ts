#!/usr/bin/env node
import path from 'node:path';
import { slicePrefabs } from './prefabSlicer';
import type { MeshSemanticCategory } from '../src/data/meshCatalogTypes';

async function main() {
  const args = process.argv.slice(2);
  let catalogPath = 'public/data/meshCatalog.json';
  let outDir = 'public/3dmodel/prefabs';
  let categories: MeshSemanticCategory[] | undefined;
  let ids: string[] | undefined;
  let limit: number | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--catalog' && args[i + 1]) {
      catalogPath = args[i + 1];
      i++;
    } else if (args[i] === '--out' && args[i + 1]) {
      outDir = args[i + 1];
      i++;
    } else if (args[i] === '--categories' && args[i + 1]) {
      categories = args[i + 1].split(',').map((s) => s.trim() as MeshSemanticCategory);
      i++;
    } else if (args[i] === '--ids' && args[i + 1]) {
      ids = args[i + 1].split(',').map((s) => s.trim());
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  console.log('='.repeat(70));
  console.log('  ✂️  VƯƠNG QUỐC HỌC TOÁN 3D — BỘ CẮT TÁCH MÔ HÌNH PREFAB (PREFAB SLICER)');
  console.log('='.repeat(70));
  console.log(`📄 Tệp Catalog:    ${path.resolve(catalogPath)}`);
  console.log(`📁 Thư mục Prefabs: ${path.resolve(outDir)}`);
  if (categories) console.log(`🏷️  Lọc danh mục:   ${categories.join(', ')}`);
  if (limit) console.log(`🔢 Giới hạn xử lý:  ${limit} thực thể`);
  console.log('-'.repeat(70));

  const startTime = Date.now();
  const res = await slicePrefabs({
    catalogPath,
    outDir,
    categories,
    ids,
    limit,
    verbose
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalMb = (res.totalBytes / (1024 * 1024)).toFixed(2);

  console.log('\n📊 KẾT QUẢ BÓC TÁCH PREFAB GLB:');
  console.log(`   - Tổng số thực thể đã xử lý:    ${res.totalProcessed}`);
  console.log(`   - Số file GLB prefab thành công: ${res.totalSuccess}`);
  console.log(`   - Bỏ qua / không có mesh:        ${res.totalSkipped}`);
  console.log(`   - Tổng dung lượng prefabs:      ${totalMb} MB`);
  console.log(`   - Thời gian thực thi:           ${elapsed}s`);
  console.log(`   - Cập nhật catalog JSON:        ${res.catalogUpdated ? '✅ Đã điền prefabPath' : '❌'}`);

  console.log('\n✨ Đã hoàn thành bóc tách Prefab GLB chuẩn hóa vào:');
  console.log(`   👉 ${outDir}`);
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('❌ Lỗi thực thi slicePrefabs:', err);
  process.exit(1);
});
