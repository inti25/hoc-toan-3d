import fs from 'node:fs';
import path from 'node:path';

function buildAppsScriptCode() {
  const seedPath = path.resolve(process.cwd(), 'src/data/seedData.json');
  const bundle = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  // Tạo mã nguồn JavaScript của Google Apps Script
  const code = `/**
 * ============================================================================
 * VƯƠNG QUỐC HỌC TOÁN 3D - GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * Biến Google Sheets thành Headless CMS & Database cho game 3D.
 * Hỗ trợ:
 * 1. doGet: Lấy danh sách vùng đất (getZones), câu hỏi theo vùng (getQuestions),
 *    hoặc toàn bộ dữ liệu (getAll).
 * 2. doPost: Ghi nhận nhật ký làm bài của học sinh vào tab LOGS, hoặc seedDatabase.
 * 3. seedFullKingdomDatabase: Hàm 1-CLICK tự động tạo 7 tab với 50 bài toán mẫu.
 */

// Tiêu đề các cột cho sheet CONFIG
const CONFIG_HEADERS = [
  'ZoneId', 'Name', 'Title', 'Description', 'Template', 'Theme', 'DecorDensity',
  'SheetName', 'CenterX', 'CenterZ', 'Width', 'Depth', 'ColorHex', 'Badge'
];

// Tiêu đề các cột cho Bảng Thử Thách (Zone Quest Sheets)
const QUEST_HEADERS = [
  'ProblemId', 'StepId', 'Title', 'Subtitle', 'Prompt', 'ImageUrl',
  'OptionA', 'OptionB', 'OptionC', 'OptionD', 'Answer',
  'Hints', 'Explanation', 'ExplanationImageUrl', 'PosX', 'PosZ'
];

// Tiêu đề các cột cho sheet LOGS
const LOG_HEADERS = [
  'Timestamp', 'ExplorerName', 'ClassName', 'ZoneId',
  'ProblemId', 'StepId', 'IsCorrect', 'Score', 'Details'
];

/**
 * Xử lý HTTP GET
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || 'getAll';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let result = {};

    if (action === 'ping') {
      result = { status: 'success', message: 'Vương Quốc Học Toán 3D Backend Online!', time: new Date().toISOString() };
    } else if (action === 'getZones') {
      result = { status: 'success', zones: fetchZonesFromSheet(ss) };
    } else if (action === 'getQuestions') {
      const sheetName = params.sheetName;
      if (!sheetName) {
        throw new Error('Thiếu tham số sheetName');
      }
      result = { status: 'success', sheetName: sheetName, questions: fetchQuestionsFromSheet(ss, sheetName) };
    } else if (action === 'getAll') {
      const zones = fetchZonesFromSheet(ss);
      const allQuestions = {};
      zones.forEach(function(zone) {
        if (zone.sheetName) {
          allQuestions[zone.sheetName] = fetchQuestionsFromSheet(ss, zone.sheetName);
        }
      });
      result = { status: 'success', zones: zones, questions: allQuestions };
    } else {
      throw new Error('Action không hợp lệ: ' + action);
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Xử lý HTTP POST (Ghi nhật ký làm bài hoặc Seed Database)
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Xử lý hành động Seed Database (Khởi tạo toàn bộ dữ liệu mẫu)
    if (payload.action === 'seedDatabase') {
      const seedResult = handleSeedDatabase(ss, payload);
      return createJsonResponse(seedResult);
    }

    // 2. Mặc định: Ghi nhật ký tiến trình vào sheet LOGS
    let logSheet = ss.getSheetByName('LOGS');
    if (!logSheet) {
      logSheet = ss.insertSheet('LOGS');
      logSheet.appendRow(LOG_HEADERS);
      logSheet.setFrozenRows(1);
    }

    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const explorerName = payload.explorerName || payload.nickname || 'Dũng Sĩ Ẩn Danh';
    const className = payload.className || 'Tự do';
    const zoneId = payload.zoneId || '';
    const problemId = payload.problemId || '';
    const stepId = payload.stepId || '';
    const isCorrect = payload.isCorrect !== undefined ? (payload.isCorrect ? 'ĐÚNG' : 'SAI') : '';
    const score = payload.score !== undefined ? payload.score : 0;
    const details = payload.details ? JSON.stringify(payload.details) : '';

    logSheet.appendRow([
      timestamp, explorerName, className, zoneId,
      problemId, stepId, isCorrect, score, details
    ]);

    return createJsonResponse({ status: 'success', message: 'Đã lưu nhật ký thành công' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Khởi tạo hoặc ghi đè toàn bộ dữ liệu các vùng đất và câu hỏi lên Google Sheets
 */
function handleSeedDatabase(ss, payload) {
  const zones = (payload && payload.zones && payload.zones.length) ? payload.zones : SEED_DATA.zones;
  const questionsBySheet = (payload && payload.questionsBySheet && Object.keys(payload.questionsBySheet).length)
    ? payload.questionsBySheet
    : SEED_DATA.questionsBySheet;

  // 1. Tạo hoặc làm mới sheet CONFIG (Sổ Đăng Ký Vùng Đất)
  let configSheet = ss.getSheetByName('CONFIG');
  if (!configSheet) {
    configSheet = ss.insertSheet('CONFIG');
  } else {
    configSheet.clear();
  }
  configSheet.appendRow(CONFIG_HEADERS);

  const configRows = zones.map(function(z) {
    return [
      z.id,
      z.name || '',
      z.title || '',
      z.description || '',
      z.template || 'GRID_SANCTUARY',
      z.theme || (z.template === 'FLOWER_BEDS' ? 'GARDEN' : 'RUINS'),
      z.decorDensity || 'MEDIUM',
      z.sheetName || '',
      z.center ? z.center.x : 0,
      z.center ? z.center.z : 0,
      z.width || 24,
      z.depth || 32,
      z.colorHex || '#38bdf8',
      z.badge || ''
    ];
  });

  if (configRows.length > 0) {
    const configRange = configSheet.getRange(2, 1, configRows.length, CONFIG_HEADERS.length);
    configRange.setNumberFormat('@');
    configRange.setValues(configRows);
  }
  configSheet.setFrozenRows(1);

  // Hàm bảo vệ ô tính khỏi lỗi công thức Google Sheets (#ERROR! với dấu =, <=, >=)
  function escapeSheetsText(val) {
    if (val === undefined || val === null) return '';
    var str = String(val);
    var trimmed = str.trim();
    if (
      trimmed.indexOf('=') === 0 ||
      trimmed.indexOf('+') === 0 ||
      trimmed.indexOf('-') === 0 ||
      trimmed.indexOf('@') === 0 ||
      trimmed.indexOf('<') === 0 ||
      trimmed.indexOf('>') === 0 ||
      trimmed.indexOf('≤') === 0 ||
      trimmed.indexOf('≥') === 0
    ) {
      return "'" + str;
    }
    return str;
  }

  // 2. Tạo hoặc làm mới từng sheet câu hỏi (Bảng Thử Thách)
  const sheetNames = Object.keys(questionsBySheet);
  sheetNames.forEach(function(sName) {
    let sheet = ss.getSheetByName(sName);
    if (!sheet) {
      sheet = ss.insertSheet(sName);
    } else {
      sheet.clear();
    }
    sheet.appendRow(QUEST_HEADERS);

    const problems = questionsBySheet[sName] || [];
    const rowsToAppend = [];

    problems.forEach(function(prob) {
      const steps = prob.steps || [];
      steps.forEach(function(step, sIdx) {
        const optA = (step.options && step.options[0]) ? (step.options[0].value || step.options[0].label || '') : '';
        const optB = (step.options && step.options[1]) ? (step.options[1].value || step.options[1].label || '') : '';
        const optC = (step.options && step.options[2]) ? (step.options[2].value || step.options[2].label || '') : '';
        const optD = (step.options && step.options[3]) ? (step.options[3].value || step.options[3].label || '') : '';
        const hints = Array.isArray(step.hints) ? step.hints.join(' | ') : (step.hints || '');
        const posX = (prob.position && typeof prob.position.x === 'number') ? prob.position.x : '';
        const posZ = (prob.position && typeof prob.position.z === 'number') ? prob.position.z : '';

        rowsToAppend.push([
          prob.id,
          step.stepId || (prob.id + '_' + (sIdx + 1)),
          prob.title || '',
          prob.subtitle || '',
          escapeSheetsText(step.prompt || ''),
          escapeSheetsText(step.imageUrl || ''),
          escapeSheetsText(optA),
          escapeSheetsText(optB),
          escapeSheetsText(optC),
          escapeSheetsText(optD),
          escapeSheetsText(step.answer || ''),
          escapeSheetsText(hints),
          escapeSheetsText(step.explanation || ''),
          escapeSheetsText(step.explanationImageUrl || ''),
          posX,
          posZ
        ]);
      });
    });

    if (rowsToAppend.length > 0) {
      const range = sheet.getRange(2, 1, rowsToAppend.length, QUEST_HEADERS.length);
      range.setNumberFormat('@');
      range.setValues(rowsToAppend);
    }
    sheet.setFrozenRows(1);
  });

  // 3. Đảm bảo sheet LOGS tồn tại mà KHÔNG xóa nhật ký đã có
  let logSheet = ss.getSheetByName('LOGS');
  if (!logSheet) {
    logSheet = ss.insertSheet('LOGS');
    logSheet.appendRow(LOG_HEADERS);
    logSheet.setFrozenRows(1);
  }

  return {
    status: 'success',
    message: 'Khởi tạo thành công ' + zones.length + ' vùng đất và ' + sheetNames.length + ' bảng câu hỏi với đầy đủ bài toán!'
  };
}

/**
 * Tự động thêm menu 'Vương Quốc 3D' trên thanh công cụ của Google Sheets
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🎮 Vương Quốc 3D')
      .addItem('➕ Tạo Vùng Đất Mới...', 'menuCreateNewZone')
      .addSeparator()
      .addItem('⚡ Khởi tạo lại 50 câu hỏi gốc', 'seedFullKingdomDatabase')
      .addToUi();
  } catch (_) {}
}

/**
 * Hộp thoại tương tác cho giáo viên tạo vùng đất mới
 */
function menuCreateNewZone() {
  const ui = SpreadsheetApp.getUi();
  const nameResp = ui.prompt('Tạo Vùng Đất Mới (Bước 1/2)', 'Nhập tên vùng đất mới (VD: Rừng Phép Thuật, Mỏ Pha Lê):', ui.ButtonSet.OK_CANCEL);
  if (nameResp.getSelectedButton() !== ui.Button.OK) return;
  const zoneName = nameResp.getResponseText().trim();
  if (!zoneName) {
    ui.alert('⚠️ Tên vùng đất không được để trống.');
    return;
  }

  const themeResp = ui.prompt(
    'Chọn Chủ Đề Cảnh Quan (Bước 2/2)',
    'Nhập một trong các chủ đề sau:\\n- FOREST (Rừng thông, nấm ma thuật)\\n- RUINS (Di tích cổ Hy Lạp, cột đá)\\n- GARDEN (Đồi hoa rực rỡ, đài phun nước)\\n- CRYSTAL (Mỏ pha lê, thạch anh phát sáng)\\n- VILLAGE (Làng quê, nhà gỗ mini)',
    ui.ButtonSet.OK_CANCEL
  );
  if (themeResp.getSelectedButton() !== ui.Button.OK) return;
  let theme = themeResp.getResponseText().trim().toUpperCase();
  if (!['FOREST', 'RUINS', 'GARDEN', 'CRYSTAL', 'VILLAGE'].includes(theme)) {
    theme = 'FOREST';
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName('CONFIG');
  if (!configSheet) {
    seedFullKingdomDatabase();
    configSheet = ss.getSheetByName('CONFIG');
  }

  // Lấy ZoneId tiếp theo
  const lastRow = configSheet.getLastRow();
  let maxId = 0;
  if (lastRow >= 2) {
    const ids = configSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(row) {
      const num = Number(row[0]);
      if (!isNaN(num) && num > maxId) maxId = num;
    });
  }
  const nextId = maxId + 1;
  const safeName = zoneName.replace(/[^a-zA-Z0-9]/g, '');
  const sheetName = 'Zone_' + nextId + '_' + (safeName || 'Moi');

  configSheet.appendRow([
    nextId,
    zoneName,
    'Khám Phá ' + zoneName,
    'Khu vực thử thách mới với chủ đề ' + theme,
    theme === 'GARDEN' ? 'FLOWER_BEDS' : 'GRID_SANCTUARY',
    theme,
    'MEDIUM',
    sheetName,
    0, // CenterX = 0 -> Game tự tính vị trí quanh biển
    0, // CenterZ = 0
    26,
    32,
    theme === 'CRYSTAL' ? '#a855f7' : (theme === 'GARDEN' ? '#ec4899' : (theme === 'FOREST' ? '#22c55e' : '#38bdf8')),
    '🌟 Huy Hiệu ' + zoneName
  ]);

  let questSheet = ss.getSheetByName(sheetName);
  if (!questSheet) {
    questSheet = ss.insertSheet(sheetName);
    questSheet.appendRow(QUEST_HEADERS);
    questSheet.appendRow([
      1, 'step_1', zoneName + ' - Bài 1', 'Thử Thách Khởi Động',
      'Tính nhẩm: 25 + 35 = ?',
      '50', '60', '70', '55', '60',
      'Cộng hàng đơn vị 5 + 5 = 10, nhớ 1 sang hàng chục',
      '25 + 35 = 60', '', ''
    ]);
    questSheet.appendRow([
      2, 'step_1', zoneName + ' - Bài 2', 'Thử Thách Tiếp Theo',
      'Tính: 8 x 5 = ?',
      '35', '40', '45', '48', '40',
      'Nhớ lại bảng cửu chương 8: 8 x 5 = 40',
      '8 nhân 5 bằng 40', '', ''
    ]);
    questSheet.setFrozenRows(1);
  }

  ui.alert('🎉 Đã tạo thành công vùng đất "' + zoneName + '" (ZoneId: ' + nextId + ') và tab câu hỏi "' + sheetName + '"!\\nBạn có thể vào tab đó để soạn câu hỏi và mở game để phiêu lưu ngay.');
}

/**
 * HÀM 1-CLICK DÀNH CHO GIÁO VIÊN / ADMIN CHẠY TRỰC TIẾP TRONG APPS SCRIPT:
 * Chọn hàm "seedFullKingdomDatabase" từ menu thả xuống và bấm [Chạy] (Run)
 * để tự động khởi tạo 7 tab với 50 bài toán vào Google Sheets.
 */
function seedFullKingdomDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = handleSeedDatabase(ss, null);
  Logger.log(res.message);
  try {
    SpreadsheetApp.getUi().alert(res.message);
  } catch (_) {}
  return res;
}

/**
 * Đọc dữ liệu từ sheet CONFIG
 */
function fetchZonesFromSheet(ss) {
  const sheet = ss.getSheetByName('CONFIG');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(function(h) { return String(h).trim(); });
  const zones = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[0] && row[0] !== 0) continue;

    const rowObj = {};
    headers.forEach(function(h, colIdx) {
      rowObj[h] = row[colIdx];
    });

    zones.push({
      id: Number(rowObj.ZoneId) || r,
      name: String(rowObj.Name || ''),
      title: String(rowObj.Title || ''),
      description: String(rowObj.Description || ''),
      template: String(rowObj.Template || 'GRID_SANCTUARY').toUpperCase(),
      theme: String(rowObj.Theme || (String(rowObj.Template).toUpperCase() === 'FLOWER_BEDS' ? 'GARDEN' : 'RUINS')).toUpperCase(),
      decorDensity: String(rowObj.DecorDensity || 'MEDIUM').toUpperCase(),
      sheetName: String(rowObj.SheetName || ''),
      center: {
        x: Number(rowObj.CenterX) || 0,
        z: Number(rowObj.CenterZ) || 0
      },
      width: Number(rowObj.Width) || 24,
      depth: Number(rowObj.Depth) || 32,
      color: parseColorHex(rowObj.ColorHex),
      colorHex: String(rowObj.ColorHex || '#38bdf8'),
      badge: String(rowObj.Badge || '🏆 Huy Chương Thám Hiểm')
    });
  }

  return zones;
}

/**
 * Đọc dữ liệu từ tab câu hỏi và tự động gom nhóm theo ProblemId
 */
function fetchQuestionsFromSheet(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(function(h) { return String(h).trim(); });
  const problemMap = {};
  const problemOrder = [];

  function cleanSheetText(val) {
    if (val === undefined || val === null) return '';
    var str = String(val).trim();
    if (str.indexOf("'") === 0) {
      str = str.substring(1);
    }
    // Tự động khôi phục nếu ô bị lỗi công thức #ERROR! từ Google Sheets (do chứa dấu =)
    if (
      str.indexOf('#') === 0 &&
      (str.indexOf('ERROR') !== -1 ||
       str.indexOf('NAME') !== -1 ||
       str.indexOf('VALUE') !== -1 ||
       str.indexOf('REF') !== -1 ||
       str.indexOf('N/A') !== -1)
    ) {
      return '=';
    }
    return str;
  }

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[0] && row[0] !== 0) continue;

    const rowObj = {};
    headers.forEach(function(h, colIdx) {
      rowObj[h] = row[colIdx];
    });

    const probId = String(rowObj.ProblemId).trim();
    if (!probId) continue;

    const cleanAnswer = cleanSheetText(rowObj.Answer);

    const rawOptions = [rowObj.OptionA, rowObj.OptionB, rowObj.OptionC, rowObj.OptionD]
      .filter(function(opt) { return opt !== undefined && opt !== null && String(opt).trim() !== ''; })
      .map(function(opt) {
        const val = cleanSheetText(opt);
        return { label: val, value: val };
      });

    // Nếu options chưa chứa cleanAnswer đúng, tự động thêm vào
    if (cleanAnswer && !rawOptions.some(function(o) { return o.value === cleanAnswer; })) {
      rawOptions.unshift({ label: cleanAnswer, value: cleanAnswer });
    }

    let rawHints = [];
    if (rowObj.Hints) {
      rawHints = String(rowObj.Hints)
        .split(/[|;]/)
        .map(function(h) { return cleanSheetText(h); })
        .filter(function(h) { return h.length > 0; });
    }

    const stepObj = {
      stepId: String(rowObj.StepId || probId + '_' + r).trim(),
      prompt: cleanSheetText(rowObj.Prompt || ''),
      imageUrl: cleanSheetText(rowObj.ImageUrl || ''),
      options: rawOptions,
      answer: cleanAnswer,
      hints: rawHints,
      explanation: cleanSheetText(rowObj.Explanation || ''),
      explanationImageUrl: cleanSheetText(rowObj.ExplanationImageUrl || '')
    };

    if (!problemMap[probId]) {
      const posX = rowObj.PosX !== '' && rowObj.PosX !== undefined ? Number(rowObj.PosX) : null;
      const posZ = rowObj.PosZ !== '' && rowObj.PosZ !== undefined ? Number(rowObj.PosZ) : null;

      problemMap[probId] = {
        id: isNaN(Number(probId)) ? probId : Number(probId),
        title: String(rowObj.Title || 'Bài ' + probId).trim(),
        subtitle: String(rowObj.Subtitle || '').trim(),
        position: (posX !== null && posZ !== null) ? { x: posX, z: posZ } : null,
        steps: []
      };
      problemOrder.push(probId);
    }

    problemMap[probId].steps.push(stepObj);
  }

  return problemOrder.map(function(pId) { return problemMap[pId]; });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseColorHex(hexStr) {
  if (!hexStr) return 0x38bdf8;
  const clean = String(hexStr).replace(/^#/, '').replace(/^0x/, '');
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0x38bdf8 : parsed;
}

/**
 * ============================================================================
 * HÀM 1-CLICK TỰ ĐỘNG KHỞI TẠO 50 BÀI TOÁN TOÀN DIỆN LÊN GOOGLE SHEETS
 * Chạy hàm này một lần trong Apps Script Editor để sinh đủ 7 tab với 50 câu hỏi.
 * ============================================================================
 */
function seedFullKingdomDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = handleSeedDatabase(ss, SEED_DATA);
  SpreadsheetApp.getUi().alert(res.message);
}

// BỘ DỮ LIỆU GỐC ĐẦY ĐỦ (50 BÀI TOÁN & 6 VÙNG ĐẤT)
const SEED_DATA = ${JSON.stringify(bundle, null, 2)};
`;

  const outputPath = path.resolve(process.cwd(), 'apps-script/Code.gs');
  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(`✅ Đã sinh thành công apps-script/Code.gs với đầy đủ 50 bài toán (${(code.length / 1024).toFixed(1)} KB)`);
}

buildAppsScriptCode();
