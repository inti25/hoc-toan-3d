#!/usr/bin/env node
import path from 'node:path';
import { scanModelsDirectory } from './modelScanner';

async function main() {
  const args = process.argv.slice(2);
  let modelDir = 'public/3dmodel';
  let outputPath = 'public/data/meshCatalog.json';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      modelDir = args[i + 1];
      i++;
    } else if (args[i] === '--out' && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  console.log('='.repeat(70));
  console.log('  🏛️  VƯƠNG QUỐC HỌC TOÁN 3D — BỘ KHẢO SÁT MÔ HÌNH 3D (3D MESH SCANNER)');
  console.log('='.repeat(70));
  console.log(`📁 Thư mục nguồn:   ${path.resolve(modelDir)}`);
  console.log(`💾 Tệp đầu ra:     ${path.resolve(outputPath)}`);
  console.log('-'.repeat(70));

  const startTime = Date.now();
  const catalog = await scanModelsDirectory({
    modelDir,
    outputPath,
    verbose
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n📊 KẾT QUẢ KHẢO SÁT MÔ HÌNH 3D:');
  console.log(`   - Tổng số tệp nguồn đã quét:     ${catalog.sourceCount}`);
  console.log(`   - Tổng số thực thể/mesh bóc tách: ${catalog.totalItems}`);
  console.log(`   - Thời gian xử lý:               ${elapsed}s`);

  console.log('\n🏷️  PHÂN BỔ THEO DANH MỤC NGỮ NGHĨA (3D SEMANTIC CLASSIFICATION):');
  for (const [cat, count] of Object.entries(catalog.byCategory)) {
    const icon =
      cat === 'TERRAIN' ? '🏝️ ' :
      cat === 'FOLIAGE' ? '🌲' :
      cat === 'PROP' ? '🪑' :
      cat === 'OBSTACLE' ? '🪨' :
      cat === 'CHARACTER' ? '🧙' : '☁️ ';
    console.log(`   ${icon} ${cat.padEnd(12)}: ${String(count).padStart(4)} thực thể`);
  }

  console.log('\n📦 CHI TIẾT TỪNG TỆP MÔ HÌNH NGUỒN:');
  for (const src of catalog.sources) {
    const sizeMb = (src.fileSizeBytes / (1024 * 1024)).toFixed(2);
    console.log(`   - [${src.format.toUpperCase()}] ${src.filePath} (${sizeMb} MB) => ${src.extractedItemsCount} thực thể`);
  }

  console.log('\n✨ Đã lưu Bộ Khảo Sát Mô Hình 3D thành công vào:');
  console.log(`   👉 ${outputPath}`);
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('❌ Lỗi thực thi scan3dModels:', err);
  process.exit(1);
});
