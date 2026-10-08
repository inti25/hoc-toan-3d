/**
 * ============================================================================
 * VƯƠNG QUỐC HỌC TOÁN 3D - GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * Biến Google Sheets thành Headless CMS & Database cho game 3D.
 * Hỗ trợ:
 * 1. doGet: Lấy danh sách vùng đất (getZones), câu hỏi theo vùng (getQuestions),
 *    hoặc toàn bộ dữ liệu (getAll).
 * 2. doPost: Ghi nhận nhật ký làm bài của học sinh vào tab LOGS, hoặc seedDatabase.
 * 3. seedFullKingdomDatabase: Khởi tạo sổ CONFIG, LOGS, PLAYERS (không sinh câu hỏi).
 * 4. menuCreateNewZone: Tạo vùng đất theo 6 bản mẫu với câu hỏi cửu chương TỰ SINH.
 */

// Tiêu đề các cột cho sheet CONFIG
const CONFIG_HEADERS = [
  'ZoneId', 'Name', 'Title', 'Description', 'Template', 'Theme', 'DecorDensity',
  'SheetName', 'CenterX', 'CenterZ', 'Width', 'Depth', 'ColorHex', 'Badge',
  'Active', 'StartAt', 'QuestionCount'
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

// Tiêu đề các cột cho sheet PLAYERS (Sổ Theo Dõi Người Chơi & Lưu Trữ Đám Mây)
const PLAYER_HEADERS = [
  'ExplorerId', 'Passcode', 'Nickname', 'ClassName', 'Avatar',
  'Level', 'TotalXP', 'TotalCoins', 'BridgeParts', 'FlowersBloomed',
  'MonolithsActivated', 'TreesAwakened', 'LastActiveAt', 'SaveDataJson'
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
    } else if (action === 'loadPlayerProgress') {
      const identifier = params.passcode || params.explorerId || params.identifier;
      result = handleLoadPlayerProgress(ss, identifier);
    } else {
      throw new Error('Action không hợp lệ: ' + action);
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Xử lý HTTP POST (Ghi nhật ký làm bài, Lưu tiến trình, hoặc Seed Database)
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

    // 2. Xử lý lưu tiến trình học sinh vào sheet PLAYERS
    if (payload.action === 'savePlayerProgress') {
      const saveResult = handleSavePlayerProgress(ss, payload);
      return createJsonResponse(saveResult);
    }

    // 3. Xử lý tải tiến trình học sinh từ sheet PLAYERS
    if (payload.action === 'loadPlayerProgress') {
      const identifier = payload.passcode || payload.explorerId || payload.identifier;
      const loadResult = handleLoadPlayerProgress(ss, identifier);
      return createJsonResponse(loadResult);
    }

    // 4. Mặc định: Ghi nhật ký tiến trình vào sheet LOGS
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
 * Bản mẫu vùng đất (Template) được hỗ trợ khi tạo vùng mới.
 * questionCount = số câu mặc định sinh ra cho bản mẫu (có thể ghi đè bằng cột QuestionCount).
 */
const ZONE_TEMPLATES = {
  GRID_SANCTUARY: { label: 'Đảo bia đá xếp lưới', theme: 'RUINS', questionCount: 8, width: 24, depth: 32, colorHex: '#38bdf8' },
  CIRCLE_SANCTUARY: { label: 'Đảo tròn bia đá vòng cung', theme: 'CRYSTAL', questionCount: 8, width: 22, depth: 24, colorHex: '#a855f7' },
  FLOWER_BEDS: { label: 'Vườn hoa luống dọc lối đi', theme: 'GARDEN', questionCount: 10, width: 26, depth: 20, colorHex: '#ec4899' },
  PARK_SANCTUARY: { label: 'Công viên cây tri thức', theme: 'FOREST', questionCount: 20, width: 30, depth: 30, colorHex: '#10b981' },
  PROCEDURAL_SANCTUARY: { label: 'Vùng đất cảnh quan tự dựng', theme: 'FOREST', questionCount: 8, width: 28, depth: 28, colorHex: '#f59e0b' },
  FARM_SANCTUARY: { label: 'Nông trại giải cứu thú cưng', theme: 'VILLAGE', questionCount: 10, width: 32, depth: 32, colorHex: '#84cc16' }
};
const ZONE_TEMPLATE_ORDER = [
  'GRID_SANCTUARY', 'CIRCLE_SANCTUARY', 'FLOWER_BEDS',
  'PARK_SANCTUARY', 'PROCEDURAL_SANCTUARY', 'FARM_SANCTUARY'
];

/**
 * Đảm bảo sheet CONFIG tồn tại và có đủ các cột chuẩn (KHÔNG xóa vùng đất đã khai báo)
 */
function ensureConfigSheet(ss) {
  let sheet = ss.getSheetByName('CONFIG');
  if (!sheet) {
    sheet = ss.insertSheet('CONFIG');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONFIG_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, CONFIG_HEADERS.length).setFontWeight('bold').setBackground('#e0f2fe');
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(function(h) { return String(h).trim(); });
  CONFIG_HEADERS.forEach(function(h) {
    if (headers.indexOf(h) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(h);
      headers.push(h);
    }
  });
  return sheet;
}

/**
 * Khởi tạo các sổ nền (CONFIG, LOGS, PLAYERS) nếu chưa có. KHÔNG sinh câu hỏi và
 * KHÔNG ghi đè dữ liệu đã có. Vùng đất do giáo viên tạo bằng menu "Tạo Vùng Đất Mới".
 */
function handleSeedDatabase(ss, payload) {
  ensureConfigSheet(ss);

  let logSheet = ss.getSheetByName('LOGS');
  if (!logSheet) {
    logSheet = ss.insertSheet('LOGS');
    logSheet.appendRow(LOG_HEADERS);
    logSheet.setFrozenRows(1);
  }

  getOrCreatePlayersSheet(ss);

  return {
    status: 'success',
    message: 'Đã khởi tạo sổ CONFIG, LOGS và PLAYERS. Hãy dùng menu "Tạo Vùng Đất Mới" để thêm vùng đất.'
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleCopy(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Sinh 4 đáp án (1 đúng + 3 nhiễu hợp lý) cho phép nhân a x b
 */
function buildMultiplicationOptions(a, b) {
  const answer = a * b;
  const picked = [answer];
  const candidates = [answer + a, answer - a, answer + b, answer - b, (a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), answer + 10, answer - 10];
  shuffleCopy(candidates).forEach(function(c) {
    if (picked.length < 4 && c > 0 && picked.indexOf(c) === -1) picked.push(c);
  });
  let guard = answer + 1;
  while (picked.length < 4) {
    if (picked.indexOf(guard) === -1) picked.push(guard);
    guard++;
  }
  return shuffleCopy(picked);
}

/**
 * Sinh các dòng câu hỏi cửu chương (tất cả các bảng 2-10, thừa số 1-10, không trùng phép tính)
 * theo đúng thứ tự cột QUEST_HEADERS.
 */
function generateMultiplicationRows(zoneId, count) {
  const rows = [];
  const used = {};
  const total = Math.max(1, Math.min(Number(count) || 1, 90));
  while (rows.length < total) {
    const a = randomInt(2, 10);
    const b = randomInt(1, 10);
    const key = a + 'x' + b;
    if (used[key]) continue;
    used[key] = true;

    const index = rows.length + 1;
    const problemId = 'mul_' + zoneId + '_' + index;
    const answer = a * b;
    const options = buildMultiplicationOptions(a, b);
    const sums = [];
    for (let k = 0; k < b; k++) sums.push(a);
    const hints = [
      a + ' × ' + b + ' nghĩa là ' + b + ' nhóm, mỗi nhóm có ' + a,
      sums.join(' + '),
      'Nhẩm bảng cửu chương ' + a + ' nhé!'
    ].join(' | ');

    rows.push([
      problemId,
      problemId + '_1',
      'Bài ' + index,
      'Bảng cửu chương ' + a,
      escapeSheetsText(a + ' × ' + b + ' = ?'),
      '',
      escapeSheetsText(options[0]),
      escapeSheetsText(options[1]),
      escapeSheetsText(options[2]),
      escapeSheetsText(options[3]),
      escapeSheetsText(answer),
      escapeSheetsText(hints),
      escapeSheetsText(a + ' × ' + b + ' = ' + answer),
      '',
      '',
      ''
    ]);
  }
  return rows;
}

/**
 * Tạo vùng đất mới theo bản mẫu: ghi dòng CONFIG và sinh tab câu hỏi cửu chương
 */
function createZoneFromTemplate(ss, zoneName, templateKey, questionCount) {
  const tpl = ZONE_TEMPLATES[templateKey] || ZONE_TEMPLATES.GRID_SANCTUARY;
  const template = ZONE_TEMPLATES[templateKey] ? templateKey : 'GRID_SANCTUARY';
  const count = Number(questionCount) > 0 ? Number(questionCount) : tpl.questionCount;

  const configSheet = ensureConfigSheet(ss);
  const lastRow = configSheet.getLastRow();
  let maxId = 0;
  if (lastRow >= 2) {
    configSheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(row) {
      const num = Number(row[0]);
      if (!isNaN(num) && num > maxId) maxId = num;
    });
  }
  const nextId = maxId + 1;
  const safeName = zoneName.replace(/[^a-zA-Z0-9]/g, '');
  const sheetName = 'Zone_' + nextId + '_' + (safeName || 'Moi');

  const values = {
    ZoneId: nextId,
    Name: zoneName,
    Title: 'Khám Phá ' + zoneName,
    Description: 'Khu vực thử thách cửu chương (' + tpl.label + ')',
    Template: template,
    Theme: tpl.theme,
    DecorDensity: 'MEDIUM',
    SheetName: sheetName,
    CenterX: 0,
    CenterZ: 0,
    Width: tpl.width,
    Depth: tpl.depth,
    ColorHex: tpl.colorHex,
    Badge: '🌟 Huy Hiệu ' + zoneName,
    Active: 'TRUE',
    StartAt: '',
    QuestionCount: count
  };
  const headers = configSheet.getRange(1, 1, 1, configSheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h).trim(); });
  configSheet.appendRow(headers.map(function(h) { return values[h] !== undefined ? values[h] : ''; }));

  let questSheet = ss.getSheetByName(sheetName);
  if (!questSheet) {
    questSheet = ss.insertSheet(sheetName);
  } else {
    questSheet.clear();
  }
  questSheet.appendRow(QUEST_HEADERS);
  const rows = generateMultiplicationRows(nextId, count);
  const range = questSheet.getRange(2, 1, rows.length, QUEST_HEADERS.length);
  range.setNumberFormat('@');
  range.setValues(rows);
  questSheet.setFrozenRows(1);

  return { zoneId: nextId, sheetName: sheetName, count: rows.length, template: template };
}

/**
 * Lấy hoặc khởi tạo sheet PLAYERS với định dạng chuẩn
 */
function getOrCreatePlayersSheet(ss) {
  let sheet = ss.getSheetByName('PLAYERS');
  if (!sheet) {
    sheet = ss.insertSheet('PLAYERS');
    sheet.appendRow(PLAYER_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, PLAYER_HEADERS.length).setFontWeight('bold').setBackground('#e0f2fe');
    sheet.setColumnWidth(1, 160); // ExplorerId
    sheet.setColumnWidth(2, 110); // Passcode
    sheet.setColumnWidth(3, 140); // Nickname
    sheet.setColumnWidth(4, 90);  // ClassName
    sheet.setColumnWidth(5, 80);  // Avatar
    sheet.setColumnWidth(6, 70);  // Level
    sheet.setColumnWidth(7, 90);  // TotalXP
    sheet.setColumnWidth(8, 90);  // TotalCoins
    sheet.setColumnWidth(9, 100); // BridgeParts
    sheet.setColumnWidth(10, 110); // FlowersBloomed
    sheet.setColumnWidth(11, 130); // MonolithsActivated
    sheet.setColumnWidth(12, 120); // TreesAwakened
    sheet.setColumnWidth(13, 160); // LastActiveAt
    sheet.setColumnWidth(14, 250); // SaveDataJson
  }
  return sheet;
}

/**
 * Lưu tiến trình học sinh lên tab PLAYERS (Upsert theo ExplorerId hoặc Passcode)
 */
function handleSavePlayerProgress(ss, payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = getOrCreatePlayersSheet(ss);
    const explorerId = String(payload.explorerId || '').trim();
    const passcode = String(payload.passcode || '').trim().toUpperCase();

    if (!explorerId && !passcode) {
      throw new Error('Yêu cầu explorerId hoặc passcode');
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][0]).trim();
      const rowPass = String(data[i][1]).trim().toUpperCase();
      if ((passcode && rowPass === passcode) || (explorerId && rowId === explorerId)) {
        rowIndex = i + 1;
        break;
      }
    }

    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const nickname = escapeSheetsText(payload.nickname || payload.explorerName || 'Dũng Sĩ');
    const className = escapeSheetsText(payload.className || 'Tự do');
    const avatar = escapeSheetsText(payload.avatar || 'boy');
    const level = Number(payload.level) || 1;
    const totalXP = Number(payload.xp !== undefined ? payload.xp : payload.totalXP) || 0;
    const totalCoins = Number(payload.coins !== undefined ? payload.coins : payload.totalCoins) || 0;
    const bridgeParts = Number(payload.bridge !== undefined ? payload.bridge : payload.bridgeParts) || 0;
    const flowersBloomed = Number(payload.flowersBloomed) || 0;
    const monolithsActivated = Number(payload.monolithsActivated) || 0;
    const treesAwakened = Number(payload.treesAwakened) || 0;
    const rawJson = typeof payload.saveData === 'object' ? JSON.stringify(payload.saveData) : String(payload.saveData || '{}');
    const saveDataJson = escapeSheetsText(rawJson);

    const rowValues = [
      escapeSheetsText(explorerId),
      escapeSheetsText(passcode),
      nickname,
      className,
      avatar,
      level,
      totalXP,
      totalCoins,
      bridgeParts,
      flowersBloomed,
      monolithsActivated,
      treesAwakened,
      timestamp,
      saveDataJson
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, PLAYER_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return {
      status: 'success',
      message: 'Đã lưu tiến trình học sinh thành công',
      passcode: passcode,
      lastActiveAt: timestamp
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Tải tiến trình học sinh từ tab PLAYERS theo Passcode hoặc ExplorerId
 */
function handleLoadPlayerProgress(ss, identifier) {
  const sheet = ss.getSheetByName('PLAYERS');
  if (!sheet) {
    return { status: 'not_found', message: 'Chưa có bảng dữ liệu PLAYERS trên Google Sheets' };
  }

  const query = String(identifier || '').trim().toUpperCase();
  if (!query) {
    return { status: 'error', message: 'Thiếu Mã Thám Hiểm hoặc ExplorerId cần tìm' };
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0]).trim().toUpperCase();
    const rowPass = String(data[i][1]).trim().toUpperCase();
    if (rowPass === query || rowId === query) {
      let rawJson = String(data[i][13] || '{}');
      if (rawJson.indexOf("'") === 0) {
        rawJson = rawJson.slice(1);
      }
      let parsedSave = {};
      try {
        parsedSave = JSON.parse(rawJson);
      } catch (_) {}

      return {
        status: 'success',
        player: {
          explorerId: String(data[i][0] || '').replace(/^'/, ''),
          passcode: String(data[i][1] || '').replace(/^'/, ''),
          nickname: String(data[i][2] || '').replace(/^'/, ''),
          className: String(data[i][3] || '').replace(/^'/, ''),
          avatar: String(data[i][4] || '').replace(/^'/, ''),
          level: Number(data[i][5]) || 1,
          totalXP: Number(data[i][6]) || 0,
          totalCoins: Number(data[i][7]) || 0,
          bridgeParts: Number(data[i][8]) || 0,
          flowersBloomed: Number(data[i][9]) || 0,
          monolithsActivated: Number(data[i][10]) || 0,
          treesAwakened: Number(data[i][11]) || 0,
          lastActiveAt: data[i][12],
          saveData: parsedSave
        }
      };
    }
  }

  return { status: 'not_found', message: 'Không tìm thấy Mã Thám Hiểm: ' + query };
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
      .addItem('⚡ Khởi tạo sổ CONFIG / LOGS / PLAYERS', 'seedFullKingdomDatabase')
      .addToUi();
  } catch (_) {}
}

/**
 * Hộp thoại tương tác cho giáo viên tạo vùng đất mới theo bản mẫu.
 * Câu hỏi được TỰ ĐỘNG SINH theo bảng cửu chương, không có câu hỏi cứng.
 */
function menuCreateNewZone() {
  const ui = SpreadsheetApp.getUi();
  const nameResp = ui.prompt('Tạo Vùng Đất Mới (Bước 1/3)', 'Nhập tên vùng đất mới (VD: Nông Trại Vui Vẻ, Mỏ Pha Lê):', ui.ButtonSet.OK_CANCEL);
  if (nameResp.getSelectedButton() !== ui.Button.OK) return;
  const zoneName = nameResp.getResponseText().trim();
  if (!zoneName) {
    ui.alert('⚠️ Tên vùng đất không được để trống.');
    return;
  }

  const menuLines = ZONE_TEMPLATE_ORDER.map(function(key, idx) {
    return (idx + 1) + '. ' + ZONE_TEMPLATES[key].label + ' (' + key + ', mặc định ' + ZONE_TEMPLATES[key].questionCount + ' câu)';
  }).join('\n');
  const tplResp = ui.prompt(
    'Chọn Bản Mẫu Vùng Đất (Bước 2/3)',
    'Nhập số thứ tự bản mẫu:\n' + menuLines,
    ui.ButtonSet.OK_CANCEL
  );
  if (tplResp.getSelectedButton() !== ui.Button.OK) return;
  const tplIndex = Number(tplResp.getResponseText().trim()) - 1;
  const templateKey = ZONE_TEMPLATE_ORDER[tplIndex];
  if (!templateKey) {
    ui.alert('⚠️ Số thứ tự bản mẫu không hợp lệ. Vui lòng chạy lại và nhập từ 1 đến ' + ZONE_TEMPLATE_ORDER.length + '.');
    return;
  }

  const countResp = ui.prompt(
    'Số Câu Hỏi Cửu Chương (Bước 3/3)',
    'Nhập số câu hỏi muốn sinh (để trống = mặc định ' + ZONE_TEMPLATES[templateKey].questionCount + ' câu):',
    ui.ButtonSet.OK_CANCEL
  );
  if (countResp.getSelectedButton() !== ui.Button.OK) return;
  const countText = countResp.getResponseText().trim();
  const questionCount = countText ? Number(countText) : 0;
  if (countText && (isNaN(questionCount) || questionCount < 1)) {
    ui.alert('⚠️ Số câu hỏi phải là số nguyên dương.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = createZoneFromTemplate(ss, zoneName, templateKey, questionCount);

  ui.alert('🎉 Đã tạo vùng đất "' + zoneName + '" (ZoneId: ' + res.zoneId + ', bản mẫu ' + res.template + ') với ' + res.count + ' câu cửu chương tự sinh trong tab "' + res.sheetName + '".\nBạn có thể sửa từng câu trong tab đó và mở game để phiêu lưu ngay.');
}

/**
 * HÀM DÀNH CHO GIÁO VIÊN / ADMIN CHẠY TRỰC TIẾP TRONG APPS SCRIPT:
 * Chọn hàm "seedFullKingdomDatabase" và bấm [Chạy] (Run) để khởi tạo
 * sổ CONFIG, LOGS và PLAYERS (không ghi đè dữ liệu đã có).
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
      badge: String(rowObj.Badge || '🏆 Huy Chương Thám Hiểm'),
      active: parseActiveFlag(rowObj.Active),
      startAt: normalizeStartAt(rowObj.StartAt)
    });
  }

  return zones;
}

/**
 * Cột Active: trống hoặc giá trị lạ = TRUE (tương thích ngược); FALSE/0/NO/KHONG = ẩn vùng
 */
function parseActiveFlag(val) {
  if (val === false || val === 0) return false;
  var s = String(val === undefined || val === null ? '' : val).trim().toUpperCase();
  return !(s === 'FALSE' || s === '0' || s === 'NO' || s === 'KHONG' || s === 'KHÔNG');
}

/**
 * Cột StartAt: chuẩn hóa về chuỗi ISO có múi giờ Việt Nam; ô trống = hiện ngay
 */
function normalizeStartAt(val) {
  if (val === undefined || val === null || val === '') return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return isNaN(val.getTime()) ? '' : Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return String(val).trim();
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

/**
 * Hàm bảo vệ ô tính khỏi lỗi công thức Google Sheets (#ERROR! với dấu =, <=, >=)
 */
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

