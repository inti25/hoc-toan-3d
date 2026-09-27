import fs from 'node:fs';
import path from 'node:path';
import { getBundledFallbackData } from '../src/core/sheetsClient';

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

async function main() {
  console.log('🚀 Khởi tạo toàn bộ dữ liệu Vương Quốc Học Toán 3D lên Google Sheets...\n');

  const envPath = path.resolve(process.cwd(), '.env');
  const env = parseEnvFile(envPath);
  const scriptUrl = process.env.VITE_APPS_SCRIPT_URL || env.VITE_APPS_SCRIPT_URL;
  const sheetUrl = process.env.VITE_APPS_SHEETS_URL || env.VITE_APPS_SHEETS_URL;

  if (!scriptUrl) {
    console.error('❌ Lỗi: Chưa tìm thấy VITE_APPS_SCRIPT_URL trong file .env hoặc biến môi trường.');
    console.error('Vui lòng kiểm tra file .env với nội dung:');
    console.error('VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec\n');
    process.exit(1);
  }

  console.log(`🔗 Apps Script URL: ${scriptUrl}`);
  if (sheetUrl) console.log(`📊 Google Sheets URL: ${sheetUrl}`);

  // 1. Lấy toàn bộ kho dữ liệu hiện có (40 bài Archimedes + 10 bài Vườn hoa)
  const bundle = getBundledFallbackData();
  const zoneCount = bundle.zones.length;
  const sheetKeys = Object.keys(bundle.questionsBySheet);
  let totalProblems = 0;
  let totalSteps = 0;

  sheetKeys.forEach((key) => {
    const probs = bundle.questionsBySheet[key];
    totalProblems += probs.length;
    probs.forEach((p) => {
      totalSteps += p.steps.length;
    });
  });

  console.log(`\n📦 Chuẩn bị dữ liệu:`);
  console.log(`   - Số vùng đất (Zones): ${zoneCount}`);
  console.log(`   - Số sheet câu hỏi (Tabs): ${sheetKeys.length} (${sheetKeys.join(', ')})`);
  console.log(`   - Tổng số bài toán (Problems): ${totalProblems}`);
  console.log(`   - Tổng số bước giải chi tiết (Steps): ${totalSteps}\n`);

  console.log('⏳ Đang gửi dữ liệu đến Google Apps Script Web App...');
  const payload = {
    action: 'seedDatabase',
    zones: bundle.zones,
    questionsBySheet: bundle.questionsBySheet
  };

  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status === 'success') {
    console.log('\n✨ KHỞI TẠO THÀNH CÔNG RỰC RỠ! ✨');
    console.log(`📢 Thông báo từ Apps Script: ${result.message}`);
    if (sheetUrl) {
      console.log(`👉 Xem ngay bảng tính tại: ${sheetUrl}\n`);
    }
  } else {
    console.error('\n⚠️ Thất bại:', result.message || 'Lỗi không xác định từ Apps Script');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Có lỗi xảy ra trong quá trình seed:', err.message);
  process.exit(1);
});
