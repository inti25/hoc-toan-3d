/**
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

  // 4. Đảm bảo sheet PLAYERS tồn tại mà KHÔNG xóa danh sách người chơi đã có
  let playersSheet = ss.getSheetByName('PLAYERS');
  if (!playersSheet) {
    playersSheet = ss.insertSheet('PLAYERS');
    playersSheet.appendRow(PLAYER_HEADERS);
    playersSheet.setFrozenRows(1);
    playersSheet.getRange(1, 1, 1, PLAYER_HEADERS.length).setFontWeight('bold').setBackground('#e0f2fe');
  }

  return {
    status: 'success',
    message: 'Khởi tạo thành công ' + zones.length + ' vùng đất, ' + sheetNames.length + ' bảng câu hỏi và sổ PLAYERS!'
  };
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
    'Nhập một trong các chủ đề sau:\n- FOREST (Rừng thông, nấm ma thuật)\n- RUINS (Di tích cổ Hy Lạp, cột đá)\n- GARDEN (Đồi hoa rực rỡ, đài phun nước)\n- CRYSTAL (Mỏ pha lê, thạch anh phát sáng)\n- VILLAGE (Làng quê, nhà gỗ mini)',
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

  ui.alert('🎉 Đã tạo thành công vùng đất "' + zoneName + '" (ZoneId: ' + nextId + ') và tab câu hỏi "' + sheetName + '"!\nBạn có thể vào tab đó để soạn câu hỏi và mở game để phiêu lưu ngay.');
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
const SEED_DATA = {
  "zones": [
    {
      "id": 1,
      "name": "Thung Lũng Tính Toán & Đại Lượng",
      "title": "Khu 1: Phép Tính & Đo Lường",
      "description": "Rèn luyện đặt tính cộng trừ 3 chữ số, đại lượng kg, cm, lít và tìm thành phần chưa biết.",
      "template": "GRID_SANCTUARY",
      "theme": "RUINS",
      "decorDensity": "MEDIUM",
      "sheetName": "Zone_1_Archimedes",
      "center": {
        "x": 110,
        "z": -60
      },
      "width": 24,
      "depth": 32,
      "color": 4367861,
      "colorHex": "#42a5f5",
      "badge": "🏆 Huy Chương Thung Lũng Tính Toán"
    },
    {
      "id": 2,
      "name": "Suối Nguồn Tính Nhanh & Dãy Số",
      "title": "Khu 2: Tính Nhanh & Quy Luật Số",
      "description": "Chinh phục nghệ thuật nhóm số tròn chục tròn trăm và giải mã các dãy số bí ẩn.",
      "template": "GRID_SANCTUARY",
      "theme": "FOREST",
      "decorDensity": "HIGH",
      "sheetName": "Zone_2_Archimedes",
      "center": {
        "x": 150,
        "z": -60
      },
      "width": 24,
      "depth": 32,
      "color": 2533018,
      "colorHex": "#26a69a",
      "badge": "⚡ Huy Chương Dãy Số Ma Thuật"
    },
    {
      "id": 3,
      "name": "Đồi Thời Gian & Đo Lường Cân Đĩa",
      "title": "Khu 3: Đồng Hồ, Lịch & Cân Đĩa",
      "description": "Khám phá thế giới thời gian 24h, lịch ngày trong tuần và bài toán cân đĩa thăng bằng.",
      "template": "CIRCLE_SANCTUARY",
      "theme": "CRYSTAL",
      "decorDensity": "MEDIUM",
      "sheetName": "Zone_3_Archimedes",
      "center": {
        "x": 110,
        "z": 60
      },
      "width": 24,
      "depth": 32,
      "color": 16754470,
      "colorHex": "#ffa726",
      "badge": "⏳ Huy Chương Người Quản Thời Gian"
    },
    {
      "id": 4,
      "name": "Rừng Hình Học & Đường Gấp Khúc",
      "title": "Khu 4: Hình Học & Đường Gấp Khúc",
      "description": "Quan sát các hình tam giác, tứ giác, trung điểm đoạn thẳng và tính độ dài đường gấp khúc.",
      "template": "GRID_SANCTUARY",
      "theme": "FOREST",
      "decorDensity": "HIGH",
      "sheetName": "Zone_4_Archimedes",
      "center": {
        "x": 150,
        "z": 60
      },
      "width": 28,
      "depth": 34,
      "color": 6732650,
      "colorHex": "#66bb6a",
      "badge": "📐 Huy Chương Bậc Thầy Hình Học"
    },
    {
      "id": 5,
      "name": "Đỉnh Núi Tư Duy Sao (*, **)",
      "title": "Khu 5: Thử Thách Tư Duy Đỉnh Cao",
      "description": "Thử thách trí tuệ với các bài toán sao nâng cao: ma trận ô số, số ma thuật và logic tối ưu.",
      "template": "CIRCLE_SANCTUARY",
      "theme": "RUINS",
      "decorDensity": "MEDIUM",
      "sheetName": "Zone_5_Archimedes",
      "center": {
        "x": 190,
        "z": 0
      },
      "width": 22,
      "depth": 24,
      "color": 11225020,
      "colorHex": "#ab47bc",
      "badge": "👑 Đại Vương Miện Archimedes"
    },
    {
      "id": 6,
      "name": "Vườn Hoa Tri Thức",
      "title": "Vườn Hoa Rực Rỡ",
      "description": "Đánh thức 10 đóa hoa tri thức bằng các bài toán ứng dụng",
      "template": "FLOWER_BEDS",
      "theme": "GARDEN",
      "decorDensity": "HIGH",
      "sheetName": "VuonHoa",
      "center": {
        "x": 22,
        "z": 0
      },
      "width": 26,
      "depth": 20,
      "color": 15485081,
      "colorHex": "#ec4899",
      "badge": "🌸 Tinh Thể Vườn Hoa"
    },
    {
      "id": 7,
      "name": "Công Viên Xanh",
      "title": "Công Viên Thư Giãn",
      "description": "Đánh thức 20 Cây Tri Thức trong công viên bằng các bài toán nhân chia nâng cao",
      "template": "PARK_SANCTUARY",
      "theme": "GARDEN",
      "decorDensity": "HIGH",
      "sheetName": "CongVienXanh",
      "center": {
        "x": -45,
        "z": 0
      },
      "width": 36,
      "depth": 36,
      "color": 1096065,
      "colorHex": "#10b981",
      "badge": "🌳 Mầm Xanh Tri Thức"
    }
  ],
  "questionsBySheet": {
    "Zone_1_Archimedes": [
      {
        "id": 306,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 306: Đặt tính rồi tính",
        "subtitle": "Cộng trừ các số có 3 chữ số",
        "position": {
          "x": 104,
          "z": -65
        },
        "color": 4367861,
        "badge": "Bia Đá 306: Đặt Tính Chuẩn",
        "steps": [
          {
            "stepId": "306_1",
            "prompt": "Thực hiện phép cộng: 247 + 646 = ?",
            "options": [
              {
                "label": "893",
                "value": "893"
              },
              {
                "label": "883",
                "value": "883"
              },
              {
                "label": "891",
                "value": "891"
              }
            ],
            "answer": "893",
            "hints": [
              "Cộng hàng đơn vị trước: 7 + 6 = 13 (viết 3, nhớ 1).",
              "Cộng hàng chục: 4 + 4 = 8, thêm 1 nhớ là 9. Hàng trăm: 2 + 6 = 8."
            ],
            "explanation": "247 + 646 = 893. Cộng có nhớ 1 ở hàng đơn vị sang hàng chục."
          },
          {
            "stepId": "306_2",
            "prompt": "Thực hiện phép trừ: 505 – 124 = ?",
            "options": [
              {
                "label": "381",
                "value": "381"
              },
              {
                "label": "371",
                "value": "371"
              },
              {
                "label": "481",
                "value": "481"
              }
            ],
            "answer": "381",
            "hints": [
              "Hàng đơn vị: 5 – 4 = 1.",
              "Hàng chục: 0 không trừ được 2, mượn 1 trăm thành 10 – 2 = 8. Hàng trăm: 5 bớt 1 còn 4, 4 – 1 = 3."
            ],
            "explanation": "505 – 124 = 381. Phép trừ có nhớ ở hàng chục."
          }
        ]
      },
      {
        "id": 307,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 307: Tính kèm đơn vị đo",
        "subtitle": "Thực hiện phép tính với kg, cm, lít",
        "position": {
          "x": 107,
          "z": -65
        },
        "color": 4367861,
        "badge": "Bia Đá 307: Cân Đo Đong Đếm",
        "steps": [
          {
            "stepId": "307_1",
            "prompt": "Tính: 225 kg + 354 kg + 128 kg = ?",
            "options": [
              {
                "label": "707 kg",
                "value": "707 kg"
              },
              {
                "label": "697 kg",
                "value": "697 kg"
              },
              {
                "label": "717 kg",
                "value": "717 kg"
              }
            ],
            "answer": "707 kg",
            "hints": [
              "Tính lần lượt từ trái sang phải: 225 + 354 = 579 kg.",
              "Cộng tiếp 579 + 128: 9 + 8 = 17 (nhớ 1), 7 + 2 + 1 = 10 (nhớ 1), 5 + 1 + 1 = 7."
            ],
            "explanation": "225 kg + 354 kg + 128 kg = 579 kg + 128 kg = 707 kg."
          },
          {
            "stepId": "307_2",
            "prompt": "Tính: 1000 ℓ – 511 ℓ – 19 ℓ = ?",
            "options": [
              {
                "label": "470 ℓ",
                "value": "470 ℓ"
              },
              {
                "label": "480 ℓ",
                "value": "480 ℓ"
              },
              {
                "label": "460 ℓ",
                "value": "460 ℓ"
              }
            ],
            "answer": "470 ℓ",
            "hints": [
              "1000 ℓ – 511 ℓ = 489 ℓ.",
              "Lấy 489 ℓ – 19 ℓ = 470 ℓ."
            ],
            "explanation": "1000 ℓ – 511 ℓ – 19 ℓ = 489 ℓ – 19 ℓ = 470 ℓ."
          }
        ]
      },
      {
        "id": 308,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 308: Điền dấu so sánh thích hợp",
        "subtitle": "So sánh số và giá trị biểu thức",
        "position": {
          "x": 110,
          "z": -65
        },
        "color": 4367861,
        "badge": "Bia Đá 308: Cán Cân So Sánh",
        "steps": [
          {
            "stepId": "308_1",
            "prompt": "Điền dấu thích hợp: 890 + 3 [ ? ] 800 + 90 + 3",
            "options": [
              {
                "label": "=",
                "value": "="
              },
              {
                "label": ">",
                "value": ">"
              },
              {
                "label": "<",
                "value": "<"
              }
            ],
            "answer": "=",
            "hints": [
              "Tính vế trái: 890 + 3 = 893.",
              "Tính vế phải: 800 + 90 + 3 = 890 + 3 = 893."
            ],
            "explanation": "Cả hai vế đều có giá trị bằng 893 nên điền dấu =."
          },
          {
            "stepId": "308_2",
            "prompt": "Điền dấu thích hợp: 556 + 29 [ ? ] 550 + 26",
            "options": [
              {
                "label": ">",
                "value": ">"
              },
              {
                "label": "<",
                "value": "<"
              },
              {
                "label": "=",
                "value": "="
              }
            ],
            "answer": ">",
            "hints": [
              "So sánh từng số hạng: 556 > 550 và 29 > 26.",
              "Hoặc tính ra: 556 + 29 = 585; 550 + 26 = 576."
            ],
            "explanation": "556 + 29 = 585 > 576 = 550 + 26, nên điền dấu >."
          }
        ]
      },
      {
        "id": 309,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 309: So sánh biểu thức tổng",
        "subtitle": "So sánh cấu tạo số và phép cộng",
        "position": {
          "x": 113,
          "z": -65
        },
        "color": 4367861,
        "badge": "Bia Đá 309: Cấu Tạo Số Học",
        "steps": [
          {
            "stepId": "309_1",
            "prompt": "Điền dấu thích hợp: 640 + 1 [ ? ] 600 + 80 + 5",
            "options": [
              {
                "label": "<",
                "value": "<"
              },
              {
                "label": ">",
                "value": ">"
              },
              {
                "label": "=",
                "value": "="
              }
            ],
            "answer": "<",
            "hints": [
              "Vế trái: 640 + 1 = 641.",
              "Vế phải: 600 + 80 + 5 = 685. So sánh hàng chục: 4 chục < 8 chục."
            ],
            "explanation": "641 < 685 nên ta điền dấu <."
          },
          {
            "stepId": "309_2",
            "prompt": "Điền dấu thích hợp: 910 + 78 [ ? ] 900 + 70 + 8",
            "options": [
              {
                "label": ">",
                "value": ">"
              },
              {
                "label": "<",
                "value": "<"
              },
              {
                "label": "=",
                "value": "="
              }
            ],
            "answer": ">",
            "hints": [
              "Vế trái: 910 + 78 = 988.",
              "Vế phải: 900 + 70 + 8 = 978."
            ],
            "explanation": "988 > 978 nên ta điền dấu >."
          }
        ]
      },
      {
        "id": 310,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 310: Sơ đồ chuỗi phép tính",
        "subtitle": "Điền số theo sơ đồ hình học liên hoàn",
        "position": {
          "x": 116,
          "z": -65
        },
        "color": 4367861,
        "badge": "Bia Đá 310: Chuỗi Ngọc Phép Tính",
        "steps": [
          {
            "stepId": "310_1",
            "prompt": "Theo sơ đồ: 80 ➔ (+8) ➔ [ Lục giác ] ➔ (+12) ➔ [ Tam giác ]. Điền giá trị vào Lục giác và Tam giác:",
            "imageUrl": "Screenshot 2026-09-27 160421.png",
            "options": [
              {
                "label": "88 | 100",
                "value": "88|100"
              },
              {
                "label": "88 | 98",
                "value": "88|98"
              },
              {
                "label": "90 | 102",
                "value": "90|102"
              }
            ],
            "answer": "88|100",
            "hints": [
              "Lục giác = 80 + 8 = 88.",
              "Tam giác = Lục giác + 12 = 88 + 12 = 100."
            ],
            "explanation": "80 + 8 = 88; 88 + 12 = 100. Điền 88 vào Lục giác và 100 vào Tam giác."
          },
          {
            "stepId": "310_2",
            "prompt": "Theo sơ đồ ngược: [ Thoi ] ➔ (–276) ➔ [ 600 ] ➔ (–38) ➔ [ Tam giác ]. Giá trị ở hình Thoi là bao nhiêu?",
            "imageUrl": "Screenshot 2026-09-27 160421.png",
            "options": [
              {
                "label": "876",
                "value": "876"
              },
              {
                "label": "324",
                "value": "324"
              },
              {
                "label": "866",
                "value": "866"
              }
            ],
            "answer": "876",
            "hints": [
              "Tìm số bị trừ: Thoi – 276 = 600.",
              "Muốn tìm Thoi, ta lấy 600 + 276."
            ],
            "explanation": "Thoi = 600 + 276 = 876."
          }
        ]
      },
      {
        "id": 311,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 311: Tìm y (thành phần chưa biết)",
        "subtitle": "Giải phương trình đơn giản lớp 2",
        "position": {
          "x": 104,
          "z": -55
        },
        "color": 4367861,
        "badge": "Bia Đá 311: Giải Mã Biến Số y",
        "steps": [
          {
            "stepId": "311_1",
            "prompt": "Tìm y biết: 142 – y = 98 + 14",
            "options": [
              {
                "label": "y = 30",
                "value": "y = 30"
              },
              {
                "label": "y = 20",
                "value": "y = 20"
              },
              {
                "label": "y = 40",
                "value": "y = 40"
              }
            ],
            "answer": "y = 30",
            "hints": [
              "Thu gọn vế phải trước: 98 + 14 = 112.",
              "Ta có 142 – y = 112 ➔ y = 142 – 112 = ?"
            ],
            "explanation": "142 – y = 112 ➔ y = 142 – 112 = 30."
          },
          {
            "stepId": "311_2",
            "prompt": "Tìm y biết: 831 – 300 + y = 647",
            "options": [
              {
                "label": "y = 116",
                "value": "y = 116"
              },
              {
                "label": "y = 126",
                "value": "y = 126"
              },
              {
                "label": "y = 106",
                "value": "y = 106"
              }
            ],
            "answer": "y = 116",
            "hints": [
              "Tính: 831 – 300 = 531.",
              "Biểu thức trở thành: 531 + y = 647 ➔ y = 647 – 531."
            ],
            "explanation": "531 + y = 647 ➔ y = 647 – 531 = 116."
          }
        ]
      },
      {
        "id": 316,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 316: Số liền trước và số liền sau",
        "subtitle": "Tính tổng hai số hạng theo quy ước vị trí",
        "position": {
          "x": 107,
          "z": -55
        },
        "color": 4367861,
        "badge": "Bia Đá 316: Nhịp Cầu Liền Kề",
        "steps": [
          {
            "stepId": "316_1",
            "prompt": "Tính tổng của hai số hạng, biết số thứ nhất là số liền trước của 310, số thứ hai là số liền sau của 90.",
            "options": [
              {
                "label": "400",
                "value": "400"
              },
              {
                "label": "399",
                "value": "399"
              },
              {
                "label": "401",
                "value": "401"
              }
            ],
            "answer": "400",
            "hints": [
              "Số liền trước của 310 là 310 – 1 = 309.",
              "Số liền sau của 90 là 90 + 1 = 91. Tổng là 309 + 91."
            ],
            "explanation": "Số thứ nhất là 309, số thứ hai là 91. Tổng là 309 + 91 = 400."
          }
        ]
      },
      {
        "id": 317,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 317: Tìm Số bị trừ đặc biệt",
        "subtitle": "Mối quan hệ giữa Số bị trừ, Số trừ và Hiệu",
        "position": {
          "x": 110,
          "z": -55
        },
        "color": 4367861,
        "badge": "Bia Đá 317: Ẩn Số Phép Trừ",
        "steps": [
          {
            "stepId": "317_1",
            "prompt": "Một phép trừ có Hiệu là 389 và hơn Số trừ 155 đơn vị. Số bị trừ trong phép trừ đó là bao nhiêu?",
            "options": [
              {
                "label": "623",
                "value": "623"
              },
              {
                "label": "544",
                "value": "544"
              },
              {
                "label": "633",
                "value": "633"
              }
            ],
            "answer": "623",
            "hints": [
              "Hiệu hơn Số trừ 155 đơn vị ➔ Số trừ = 389 – 155 = 234.",
              "Số bị trừ = Hiệu + Số trừ = 389 + 234."
            ],
            "explanation": "Số trừ là: 389 – 155 = 234. Số bị trừ là: 389 + 234 = 623."
          }
        ]
      },
      {
        "id": 341,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 341: Điền số thích hợp vào ô trống",
        "subtitle": "Xác định thành phần trong biểu thức kết hợp",
        "position": {
          "x": 113,
          "z": -55
        },
        "color": 4367861,
        "badge": "Bia Đá 341: Khung Ô Thần Kỳ",
        "steps": [
          {
            "stepId": "341_1",
            "prompt": "Điền số vào ô trống: [ ? ] – 80 + 200 = 210",
            "options": [
              {
                "label": "90",
                "value": "90"
              },
              {
                "label": "70",
                "value": "70"
              },
              {
                "label": "100",
                "value": "100"
              }
            ],
            "answer": "90",
            "hints": [
              "Coi ([ ? ] – 80) là một số: ([ ? ] – 80) + 200 = 210 ➔ [ ? ] – 80 = 10.",
              "Vậy [ ? ] = 10 + 80 = ?"
            ],
            "explanation": "[ ? ] – 80 = 210 – 200 = 10 ➔ [ ? ] = 10 + 80 = 90."
          },
          {
            "stepId": "341_2",
            "prompt": "Điền số vào ô trống: 502 + 98 – [ ? ] = 200",
            "options": [
              {
                "label": "400",
                "value": "400"
              },
              {
                "label": "300",
                "value": "300"
              },
              {
                "label": "500",
                "value": "500"
              }
            ],
            "answer": "400",
            "hints": [
              "Tính tổng trước: 502 + 98 = 600.",
              "600 – [ ? ] = 200 ➔ [ ? ] = 600 – 200."
            ],
            "explanation": "502 + 98 = 600. Lấy 600 – 200 = 400."
          }
        ]
      },
      {
        "id": 342,
        "zoneId": 1,
        "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
        "title": "Bài 342: Tìm x biểu thức nhiều bước",
        "subtitle": "Tìm x với hai vế biểu thức phong phú",
        "position": {
          "x": 116,
          "z": -55
        },
        "color": 4367861,
        "badge": "Bia Đá 342: Vòng Quay Tìm x",
        "steps": [
          {
            "stepId": "342_1",
            "prompt": "Tìm x biết: x + 456 = 510 + 47",
            "options": [
              {
                "label": "x = 101",
                "value": "x = 101"
              },
              {
                "label": "x = 111",
                "value": "x = 111"
              },
              {
                "label": "x = 91",
                "value": "x = 91"
              }
            ],
            "answer": "x = 101",
            "hints": [
              "Tính vế phải: 510 + 47 = 557.",
              "x = 557 – 456."
            ],
            "explanation": "510 + 47 = 557 ➔ x = 557 – 456 = 101."
          },
          {
            "stepId": "342_2",
            "prompt": "Tìm x biết: 500 – x + 123 = 500 – 122",
            "options": [
              {
                "label": "x = 245",
                "value": "x = 245"
              },
              {
                "label": "x = 235",
                "value": "x = 235"
              },
              {
                "label": "x = 255",
                "value": "x = 255"
              }
            ],
            "answer": "x = 245",
            "hints": [
              "Tính vế phải: 500 – 122 = 378.",
              "Ta có: 500 + 123 – x = 378 ➔ 623 – x = 378 ➔ x = 623 – 378."
            ],
            "explanation": "623 – x = 378 ➔ x = 623 – 378 = 245."
          }
        ]
      }
    ],
    "Zone_2_Archimedes": [
      {
        "id": 312,
        "zoneId": 2,
        "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
        "title": "Bài 312: Tính nhanh nhóm tròn trăm",
        "subtitle": "Ghép cặp số có tổng tròn chục tròn trăm",
        "position": {
          "x": 145,
          "z": -65
        },
        "color": 2533018,
        "badge": "Bia Đá 312: Nhóm Cặp Thông Minh",
        "steps": [
          {
            "stepId": "312_1",
            "prompt": "Tính nhanh biểu thức: A = 164 + 179 + 236 + 321",
            "options": [
              {
                "label": "900",
                "value": "900"
              },
              {
                "label": "890",
                "value": "890"
              },
              {
                "label": "910",
                "value": "910"
              }
            ],
            "answer": "900",
            "hints": [
              "Ghép cặp các số có hàng đơn vị bù nhau thành 10: (164 + 236) và (179 + 321).",
              "164 + 236 = 400; 179 + 321 = 500. Tổng là 400 + 500."
            ],
            "explanation": "A = (164 + 236) + (179 + 321) = 400 + 500 = 900."
          }
        ]
      },
      {
        "id": 313,
        "zoneId": 2,
        "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
        "title": "Bài 313: Tính nhanh cộng trừ kết hợp",
        "subtitle": "Ghép cặp triệt tiêu hàng chục hàng đơn vị",
        "position": {
          "x": 150,
          "z": -65
        },
        "color": 2533018,
        "badge": "Bia Đá 313: Triệt Tiêu Tuyệt Diệu",
        "steps": [
          {
            "stepId": "313_1",
            "prompt": "Tính nhanh: B = 649 + 361 + 439 – 149 – 61 – 239",
            "options": [
              {
                "label": "1000",
                "value": "1000"
              },
              {
                "label": "900",
                "value": "900"
              },
              {
                "label": "1100",
                "value": "1100"
              }
            ],
            "answer": "1000",
            "hints": [
              "Nhóm từng cặp có cùng đuôi trừ đi nhau: (649 – 149) + (361 – 61) + (439 – 239).",
              "500 + 300 + 200 = ?"
            ],
            "explanation": "B = (649 – 149) + (361 – 61) + (439 – 239) = 500 + 300 + 200 = 1000."
          },
          {
            "stepId": "313_2",
            "prompt": "Tính nhanh: C = 185 + 549 + 215 – 449",
            "options": [
              {
                "label": "500",
                "value": "500"
              },
              {
                "label": "600",
                "value": "600"
              },
              {
                "label": "450",
                "value": "450"
              }
            ],
            "answer": "500",
            "hints": [
              "Ghép cặp: (185 + 215) và (549 – 449).",
              "185 + 215 = 400; 549 – 449 = 100."
            ],
            "explanation": "C = (185 + 215) + (549 – 449) = 400 + 100 = 500."
          }
        ]
      },
      {
        "id": 314,
        "zoneId": 2,
        "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
        "title": "Bài 314: Dãy số cách đều",
        "subtitle": "Tìm số hạng còn thiếu theo bước nhảy",
        "position": {
          "x": 155,
          "z": -65
        },
        "color": 2533018,
        "badge": "Bia Đá 314: Bậc Thang Cách Đều",
        "steps": [
          {
            "stepId": "314_1",
            "prompt": "Điền số thích hợp: 511; 513; 515; [ ? ]; 519; 521; [ ? ]",
            "options": [
              {
                "label": "517 và 523",
                "value": "517 và 523"
              },
              {
                "label": "516 và 522",
                "value": "516 và 522"
              },
              {
                "label": "518 và 524",
                "value": "518 và 524"
              }
            ],
            "answer": "517 và 523",
            "hints": [
              "Quan sát khoảng cách: 513 – 511 = 2; 515 – 513 = 2.",
              "Mỗi số đứng sau hơn số trước 2 đơn vị (dãy số lẻ liên tiếp)."
            ],
            "explanation": "Quy luật tăng dần 2 đơn vị: 515 + 2 = 517 và 521 + 2 = 523."
          },
          {
            "stepId": "314_2",
            "prompt": "Điền số vào dãy: 215; 220; [ ? ]; 230; [ ? ]; [ ? ]; 245; 250",
            "options": [
              {
                "label": "225, 235, 240",
                "value": "225, 235, 240"
              },
              {
                "label": "224, 234, 239",
                "value": "224, 234, 239"
              },
              {
                "label": "226, 236, 241",
                "value": "226, 236, 241"
              }
            ],
            "answer": "225, 235, 240",
            "hints": [
              "Dãy số tăng cách đều 5 đơn vị.",
              "220 + 5 = 225; 230 + 5 = 235; 235 + 5 = 240."
            ],
            "explanation": "Quy luật tăng 5 đơn vị mỗi bước: các số cần điền là 225, 235, 240."
          }
        ]
      },
      {
        "id": 315,
        "zoneId": 2,
        "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
        "title": "Bài 315: Dãy số tăng tiến & Fibonacci",
        "subtitle": "Quy luật khoảng cách tăng dần và tổng 2 số liền trước",
        "position": {
          "x": 145,
          "z": -55
        },
        "color": 2533018,
        "badge": "Bia Đá 315: Dòng Chảy Fibonacci",
        "steps": [
          {
            "stepId": "315_1",
            "prompt": "Tìm các số còn thiếu: 97; 98; 100; 103; [ ? ]; [ ? ]; 118; [ ? ]",
            "options": [
              {
                "label": "107; 112; 125",
                "value": "107; 112; 125"
              },
              {
                "label": "106; 111; 124",
                "value": "106; 111; 124"
              },
              {
                "label": "108; 113; 126",
                "value": "108; 113; 126"
              }
            ],
            "answer": "107; 112; 125",
            "hints": [
              "Khoảng cách: 98 – 97 = 1; 100 – 98 = 2; 103 – 100 = 3.",
              "Khoảng cách tăng dần +1, +2, +3, +4, +5, +6, +7."
            ],
            "explanation": "103 + 4 = 107; 107 + 5 = 112; 118 + 7 = 125."
          },
          {
            "stepId": "315_2",
            "prompt": "Dãy Fibonacci: 20; [ ? ]; 50; [ ? ]; 130; 210; 340; [ ? ]. Số đầu tiên còn thiếu là bao nhiêu?",
            "options": [
              {
                "label": "30",
                "value": "30"
              },
              {
                "label": "25",
                "value": "25"
              },
              {
                "label": "35",
                "value": "35"
              }
            ],
            "answer": "30",
            "hints": [
              "Trong dãy này, kể từ số thứ ba, mỗi số bằng tổng 2 số liền trước.",
              "20 + [ ? ] = 50 ➔ [ ? ] = 50 – 20 = 30."
            ],
            "explanation": "Quy luật tổng 2 số liền trước: 20 + 30 = 50; 30 + 50 = 80; 50 + 80 = 130... Vậy số còn thiếu đầu tiên là 30."
          }
        ]
      },
      {
        "id": 339,
        "zoneId": 2,
        "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
        "title": "Bài 339: Tính nhanh nhóm tròn chục tròn trăm",
        "subtitle": "Kết hợp giao hoán và kết hợp thông minh",
        "position": {
          "x": 150,
          "z": -55
        },
        "color": 2533018,
        "badge": "Bia Đá 339: Vòng Ghép Hoàn Hảo",
        "steps": [
          {
            "stepId": "339_1",
            "prompt": "Tính nhanh: A = 125 + 73 + 45 + 75 + 127 + 55",
            "options": [
              {
                "label": "500",
                "value": "500"
              },
              {
                "label": "480",
                "value": "480"
              },
              {
                "label": "520",
                "value": "520"
              }
            ],
            "answer": "500",
            "hints": [
              "Nhóm: (125 + 75) + (45 + 55) + (73 + 127).",
              "200 + 100 + 200 = ?"
            ],
            "explanation": "A = (125 + 75) + (45 + 55) + (73 + 127) = 200 + 100 + 200 = 500."
          },
          {
            "stepId": "339_2",
            "prompt": "Tính nhanh: B = 183 + 72 – 83 + 28 + 80",
            "options": [
              {
                "label": "280",
                "value": "280"
              },
              {
                "label": "300",
                "value": "300"
              },
              {
                "label": "260",
                "value": "260"
              }
            ],
            "answer": "280",
            "hints": [
              "Nhóm: (183 – 83) + (72 + 28) + 80.",
              "100 + 100 + 80 = ?"
            ],
            "explanation": "B = (183 – 83) + (72 + 28) + 80 = 100 + 100 + 80 = 280."
          }
        ]
      },
      {
        "id": 340,
        "zoneId": 2,
        "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
        "title": "Bài 340: Dãy số giảm dần và số tam giác",
        "subtitle": "Giải mã dãy số có quy luật biến thiên",
        "position": {
          "x": 155,
          "z": -55
        },
        "color": 2533018,
        "badge": "Bia Đá 340: Vũ Điệu Các Con Số",
        "steps": [
          {
            "stepId": "340_1",
            "prompt": "Tìm 3 số tiếp theo: 598; 587; 576; 565; 554; [ ? ]; [ ? ]; [ ? ]",
            "options": [
              {
                "label": "543; 532; 521",
                "value": "543; 532; 521"
              },
              {
                "label": "544; 533; 522",
                "value": "544; 533; 522"
              },
              {
                "label": "542; 531; 520",
                "value": "542; 531; 520"
              }
            ],
            "answer": "543; 532; 521",
            "hints": [
              "Quy luật giảm dần: 598 – 587 = 11; 587 – 576 = 11.",
              "Mỗi số đứng sau kém số trước 11 đơn vị."
            ],
            "explanation": "Dãy giảm đều 11 đơn vị: 554 – 11 = 543; 543 – 11 = 532; 532 – 11 = 521."
          },
          {
            "stepId": "340_2",
            "prompt": "Tìm số tiếp theo: 109; 110; 112; 115; 119; [ ? ]",
            "options": [
              {
                "label": "124",
                "value": "124"
              },
              {
                "label": "123",
                "value": "123"
              },
              {
                "label": "125",
                "value": "125"
              }
            ],
            "answer": "124",
            "hints": [
              "Khoảng cách: +1, +2, +3, +4...",
              "Số tiếp theo hơn 119 là 5 đơn vị: 119 + 5 = ?"
            ],
            "explanation": "Khoảng cách tăng dần 1 đơn vị mỗi bước: 119 + 5 = 124."
          }
        ]
      }
    ],
    "Zone_3_Archimedes": [
      {
        "id": 318,
        "zoneId": 3,
        "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
        "title": "Bài 318: Đọc và vẽ kim đồng hồ",
        "subtitle": "Xem giờ chính xác theo hệ 12h và 24h",
        "position": {
          "x": 104,
          "z": 56
        },
        "color": 16754470,
        "badge": "Bia Đá 318: Bánh Răng Thời Khắc",
        "steps": [
          {
            "stepId": "318_1",
            "prompt": "Khi đồng hồ chỉ 22 giờ 5 phút, kim phút đang chỉ vào số mấy?",
            "options": [
              {
                "label": "Số 1",
                "value": "Số 1"
              },
              {
                "label": "Số 5",
                "value": "Số 5"
              },
              {
                "label": "Số 10",
                "value": "Số 10"
              }
            ],
            "answer": "Số 1",
            "hints": [
              "22 giờ là 10 giờ đêm (kim giờ chỉ qua số 10 một chút).",
              "Mỗi khoảng cách giữa hai số trên mặt đồng hồ là 5 phút. 5 phút ứng với số 1."
            ],
            "explanation": "5 phút tương ứng với kim phút chỉ thẳng vào vạch số 1."
          },
          {
            "stepId": "318_2",
            "prompt": "Khi đồng hồ chỉ 15 giờ 30 phút, vị trí kim giờ và kim phút như thế nào?",
            "options": [
              {
                "label": "Kim giờ ở giữa số 3 và 4, kim phút chỉ số 6",
                "value": "Kim giờ ở giữa số 3 và 4, kim phút chỉ số 6"
              },
              {
                "label": "Kim giờ chỉ số 3, kim phút chỉ số 6",
                "value": "Kim giờ chỉ số 3, kim phút chỉ số 6"
              },
              {
                "label": "Kim giờ chỉ số 15, kim phút chỉ số 30",
                "value": "Kim giờ chỉ số 15, kim phút chỉ số 30"
              }
            ],
            "answer": "Kim giờ ở giữa số 3 và 4, kim phút chỉ số 6",
            "hints": [
              "15 giờ là 3 giờ chiều.",
              "30 phút là nửa giờ, kim phút chỉ số 6 và kim giờ di chuyển đến chính giữa số 3 và số 4."
            ],
            "explanation": "15 giờ 30 phút (3 rưỡi chiều): kim dài chỉ số 6, kim ngắn ở chính giữa số 3 và 4."
          }
        ]
      },
      {
        "id": 319,
        "zoneId": 3,
        "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
        "title": "Bài 319: Lịch ngày trong tuần",
        "subtitle": "Tính thứ trong tuần bằng chu kỳ 7 ngày",
        "position": {
          "x": 107,
          "z": 54
        },
        "color": 16754470,
        "badge": "Bia Đá 319: Vòng Xoay Năm Tháng",
        "steps": [
          {
            "stepId": "319_1",
            "prompt": "Ngày 25 tháng 9 của một năm là thứ Ba. Hỏi ngày 5 tháng 9 của năm đó là thứ mấy?",
            "options": [
              {
                "label": "Thứ Tư",
                "value": "Thứ Tư"
              },
              {
                "label": "Thứ Ba",
                "value": "Thứ Ba"
              },
              {
                "label": "Thứ Năm",
                "value": "Thứ Năm"
              }
            ],
            "answer": "Thứ Tư",
            "hints": [
              "Lùi từng tuần (7 ngày) từ ngày 25: 25 – 7 = 18 (thứ Ba); 18 – 7 = 11 (thứ Ba); 11 – 7 = 4 (thứ Ba).",
              "Ngày 4 tháng 9 là thứ Ba ➔ Ngày 5 tháng 9 là thứ mấy?"
            ],
            "explanation": "Ngày 4 tháng 9 là thứ Ba, vậy ngày 5 tháng 9 là thứ Tư."
          }
        ]
      },
      {
        "id": 320,
        "zoneId": 3,
        "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
        "title": "Bài 320 (*): Chủ nhật đầu và cuối tháng",
        "subtitle": "Xác định số ngày trong tháng và các ngày Chủ nhật",
        "position": {
          "x": 110,
          "z": 53
        },
        "color": 16754470,
        "badge": "Bia Đá 320: Ngôi Sao Chủ Nhật (*)",
        "steps": [
          {
            "stepId": "320_1",
            "prompt": "Chủ nhật đầu tiên của tháng 9 là ngày 3. Hỏi Chủ nhật cuối cùng của tháng 9 đó là ngày bao nhiêu?",
            "options": [
              {
                "label": "Ngày 24",
                "value": "Ngày 24"
              },
              {
                "label": "Ngày 31",
                "value": "Ngày 31"
              },
              {
                "label": "Ngày 25",
                "value": "Ngày 25"
              }
            ],
            "answer": "Ngày 24",
            "hints": [
              "Tháng 9 có 30 ngày.",
              "Các ngày Chủ nhật trong tháng: ngày 3, ngày 10 (3+7), ngày 17 (10+7), ngày 24 (17+7). Thử tiếp: 24+7 = 31 (vượt quá 30)."
            ],
            "explanation": "Tháng 9 có 30 ngày. Các ngày Chủ nhật là 3, 10, 17, 24. Vậy Chủ nhật cuối cùng là ngày 24."
          }
        ]
      },
      {
        "id": 321,
        "zoneId": 3,
        "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
        "title": "Bài 321: Thời gian tàu hoả lăn bánh",
        "subtitle": "Tính khoảng thời gian trôi qua trong ngày",
        "position": {
          "x": 113,
          "z": 54
        },
        "color": 16754470,
        "badge": "Bia Đá 321: Chuyến Tàu Thời Gian",
        "steps": [
          {
            "stepId": "321_1",
            "prompt": "Tính thời gian đi của một tàu hoả từ Hà Nội lúc 8 giờ sáng và đến Huế lúc 19 giờ cùng ngày.",
            "options": [
              {
                "label": "11 giờ",
                "value": "11 giờ"
              },
              {
                "label": "12 giờ",
                "value": "12 giờ"
              },
              {
                "label": "10 giờ",
                "value": "10 giờ"
              }
            ],
            "answer": "11 giờ",
            "hints": [
              "Thời gian tàu đi = Giờ đến nơi – Giờ khởi hành.",
              "19 giờ – 8 giờ = ?"
            ],
            "explanation": "Thời gian tàu chạy là: 19 – 8 = 11 (giờ)."
          }
        ]
      },
      {
        "id": 322,
        "zoneId": 3,
        "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
        "title": "Bài 322: So sánh tốc độ di chuyển",
        "subtitle": "Đổi đơn vị giờ – phút để so sánh thời gian",
        "position": {
          "x": 116,
          "z": 56
        },
        "color": 16754470,
        "badge": "Bia Đá 322: Đường Đua Tốc Độ",
        "steps": [
          {
            "stepId": "322_1",
            "prompt": "Cùng quãng đường, anh Hiếu đi hết 55 phút, anh Tài đi hết 1 giờ, anh Bình đi hết 65 phút. Hỏi ai đi nhanh nhất?",
            "options": [
              {
                "label": "Anh Hiếu",
                "value": "Anh Hiếu"
              },
              {
                "label": "Anh Tài",
                "value": "Anh Tài"
              },
              {
                "label": "Anh Bình",
                "value": "Anh Bình"
              }
            ],
            "answer": "Anh Hiếu",
            "hints": [
              "Đổi cùng đơn vị phút: 1 giờ = 60 phút.",
              "So sánh: 55 phút < 60 phút < 65 phút. Người đi hết ít thời gian nhất là người đi nhanh nhất."
            ],
            "explanation": "Anh Hiếu mất 55 phút (ít thời gian nhất) nên anh Hiếu đi nhanh nhất."
          }
        ]
      },
      {
        "id": 343,
        "zoneId": 3,
        "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
        "title": "Bài 343: Cân đĩa thăng bằng",
        "subtitle": "Chọn túi quả cân thích hợp để cân thăng bằng",
        "position": {
          "x": 106,
          "z": 66
        },
        "color": 16754470,
        "badge": "Bia Đá 343: Cân Đĩa Cân Bằng",
        "steps": [
          {
            "stepId": "343_1",
            "prompt": "Đĩa trái có 1 túi 400g. Để đĩa cân thăng bằng, cần chọn những túi nào trong 3 túi: Túi A (250g), Túi B (350g), Túi C (150g)?",
            "options": [
              {
                "label": "Túi A và Túi C",
                "value": "Túi A và Túi C"
              },
              {
                "label": "Túi B và Túi C",
                "value": "Túi B và Túi C"
              },
              {
                "label": "Chỉ Túi B",
                "value": "Chỉ Túi B"
              }
            ],
            "answer": "Túi A và Túi C",
            "hints": [
              "Để cân thăng bằng thì tổng khối lượng các túi bên phải phải bằng 400g.",
              "Thử: 250g + 150g = 400g (Túi A + Túi C)."
            ],
            "explanation": "Ta có 250g + 150g = 400g. Vậy chọn túi A và túi C."
          }
        ]
      },
      {
        "id": 344,
        "zoneId": 3,
        "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
        "title": "Bài 344 (*): Khối lượng khuyên tròn & khối hộp",
        "subtitle": "Bài toán suy luận cân đĩa 2 trạng thái (*)",
        "position": {
          "x": 114,
          "z": 66
        },
        "color": 16754470,
        "badge": "Bia Đá 344: Cân Đĩa Bí Ẩn (*)",
        "steps": [
          {
            "stepId": "344_1",
            "prompt": "Cân 1: 7 khuyên tròn thăng bằng với 2 khuyên tròn + 2 túi 15g. Một khuyên tròn nặng bao nhiêu gam?",
            "options": [
              {
                "label": "6 gam",
                "value": "6 gam"
              },
              {
                "label": "5 gam",
                "value": "5 gam"
              },
              {
                "label": "8 gam",
                "value": "8 gam"
              }
            ],
            "answer": "6 gam",
            "hints": [
              "Bớt 2 khuyên tròn ở cả 2 đĩa: 5 khuyên tròn = 2 túi 15g = 30g.",
              "1 khuyên tròn = 30 : 5 = ?"
            ],
            "explanation": "5 khuyên tròn = 30g ➔ 1 khuyên tròn nặng 30 : 5 = 6g."
          },
          {
            "stepId": "344_2",
            "prompt": "Cân 2: 1 khuyên tròn (6g) + 1 khối hộp thăng bằng với 1 túi 15g. Khối hộp nặng bao nhiêu gam?",
            "options": [
              {
                "label": "9 gam",
                "value": "9 gam"
              },
              {
                "label": "8 gam",
                "value": "8 gam"
              },
              {
                "label": "10 gam",
                "value": "10 gam"
              }
            ],
            "answer": "9 gam",
            "hints": [
              "Khối lượng: 6g + Khối hộp = 15g.",
              "Khối hộp = 15g – 6g."
            ],
            "explanation": "Khối hộp nặng: 15 – 6 = 9 (gam)."
          }
        ]
      }
    ],
    "Zone_4_Archimedes": [
      {
        "id": 326,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 326: Điểm thẳng hàng & Đếm đoạn thẳng",
        "subtitle": "Nhận biết điểm nằm giữa và đếm hình tam giác",
        "position": {
          "x": 158,
          "z": 60
        },
        "color": 6732650,
        "badge": "Bia Đá 326: Tọa Độ Thẳng Hàng",
        "steps": [
          {
            "stepId": "326_1",
            "prompt": "Cho hình cánh bướm ABCD có giao điểm 2 đường chéo AC và BD tại E. Khẳng định \"3 điểm B, E, D là 3 điểm thẳng hàng\" là Đúng hay Sai?",
            "imageUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 160\" width=\"300\" height=\"160\"><rect width=\"300\" height=\"160\" fill=\"%23f8fafc\" rx=\"8\" stroke=\"%23cbd5e1\"/><polygon points=\"40,30 260,30 260,130 40,130\" fill=\"none\" stroke=\"%2394a3b8\" stroke-dasharray=\"4\" stroke-width=\"1.5\"/><line x1=\"40\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%233b82f6\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"130\" x2=\"260\" y2=\"30\" stroke=\"%23ec4899\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"30\" x2=\"40\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><line x1=\"260\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><circle cx=\"40\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"40\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"150\" cy=\"80\" r=\"5\" fill=\"%23ef4444\"/><text x=\"25\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">A</text><text x=\"270\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">B</text><text x=\"25\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">D</text><text x=\"270\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">C</text><text x=\"156\" y=\"75\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23ef4444\" font-size=\"14\">E</text></svg>",
            "options": [
              {
                "label": "Đúng",
                "value": "Đúng"
              },
              {
                "label": "Sai",
                "value": "Sai"
              },
              {
                "label": "Không xác định",
                "value": "Không xác định"
              }
            ],
            "answer": "Đúng",
            "hints": [
              "Đoạn thẳng BD đi qua điểm E.",
              "Ba điểm cùng nằm trên một đoạn thẳng là ba điểm thẳng hàng."
            ],
            "explanation": "E là giao điểm của AC và BD nên B, E, D thẳng hàng là Đúng.",
            "explanationImageUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 160\" width=\"300\" height=\"160\"><rect width=\"300\" height=\"160\" fill=\"%23f8fafc\" rx=\"8\" stroke=\"%23cbd5e1\"/><line x1=\"260\" y1=\"30\" x2=\"40\" y2=\"130\" stroke=\"%23eab308\" stroke-width=\"5\" stroke-linecap=\"round\"/><circle cx=\"260\" cy=\"30\" r=\"6\" fill=\"%23ca8a04\"/><circle cx=\"150\" cy=\"80\" r=\"6\" fill=\"%23ca8a04\"/><circle cx=\"40\" cy=\"130\" r=\"6\" fill=\"%23ca8a04\"/><text x=\"270\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23854d0e\" font-size=\"14\">B</text><text x=\"156\" y=\"72\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23854d0e\" font-size=\"14\">E</text><text x=\"25\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23854d0e\" font-size=\"14\">D</text><text x=\"150\" y=\"130\" font-family=\"sans-serif\" font-size=\"12\" fill=\"%2315803d\" text-anchor=\"middle\">Đoạn thẳng BD đi qua điểm E</text></svg>"
          },
          {
            "stepId": "326_2",
            "prompt": "Hình vẽ gồm đoạn AB, CD và hai đoạn chéo AC, BD cắt nhau tại E có tất cả bao nhiêu đoạn thẳng?",
            "imageUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 160\" width=\"300\" height=\"160\"><rect width=\"300\" height=\"160\" fill=\"%23f8fafc\" rx=\"8\" stroke=\"%23cbd5e1\"/><polygon points=\"40,30 260,30 260,130 40,130\" fill=\"none\" stroke=\"%2394a3b8\" stroke-dasharray=\"4\" stroke-width=\"1.5\"/><line x1=\"40\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%233b82f6\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"130\" x2=\"260\" y2=\"30\" stroke=\"%23ec4899\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"30\" x2=\"40\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><line x1=\"260\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><circle cx=\"40\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"40\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"150\" cy=\"80\" r=\"5\" fill=\"%23ef4444\"/><text x=\"25\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">A</text><text x=\"270\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">B</text><text x=\"25\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">D</text><text x=\"270\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">C</text><text x=\"156\" y=\"75\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23ef4444\" font-size=\"14\">E</text></svg>",
            "options": [
              {
                "label": "8 đoạn thẳng",
                "value": "8 đoạn thẳng"
              },
              {
                "label": "6 đoạn thẳng",
                "value": "6 đoạn thẳng"
              },
              {
                "label": "7 đoạn thẳng",
                "value": "7 đoạn thẳng"
              }
            ],
            "answer": "8 đoạn thẳng",
            "hints": [
              "Đoạn thẳng đứng: AB, CD (2 đoạn).",
              "Đoạn AC có điểm E chia thành: AE, EC, AC (3 đoạn). Đoạn BD có điểm E chia thành: BE, ED, BD (3 đoạn)."
            ],
            "explanation": "Tổng số đoạn thẳng là: 2 + 3 + 3 = 8 đoạn thẳng."
          }
        ]
      },
      {
        "id": 327,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 327: Vẽ thêm 1 đoạn thẳng",
        "subtitle": "Tạo thêm số hình chữ nhật và hình tam giác yêu cầu",
        "position": {
          "x": 157,
          "z": 64
        },
        "color": 6732650,
        "badge": "Bia Đá 327: Đường Kẻ Diệu Kỳ",
        "steps": [
          {
            "stepId": "327_1",
            "prompt": "Hình gồm 1 hình chữ nhật lớn chia đôi thành 2 hình chữ nhật đứng (đang có 3 hình chữ nhật). Kẻ thêm 1 đoạn thẳng ngang qua một nửa hình sẽ tạo được bao nhiêu hình chữ nhật?",
            "options": [
              {
                "label": "5 hình chữ nhật",
                "value": "5 hình chữ nhật"
              },
              {
                "label": "4 hình chữ nhật",
                "value": "4 hình chữ nhật"
              },
              {
                "label": "6 hình chữ nhật",
                "value": "6 hình chữ nhật"
              }
            ],
            "answer": "5 hình chữ nhật",
            "hints": [
              "Ban đầu có 2 hình nhỏ + 1 hình bao ngoài = 3 hình.",
              "Khi kẻ thêm 1 đoạn ngang chia 1 ô thành 2 ô con, ô đó tăng thêm 2 hình mới (2 hình con), tổng thành 3 + 2 = 5 hình."
            ],
            "explanation": "Kẻ 1 đoạn thẳng ngang chia 1 hình chữ nhật con thành 2 phần sẽ tạo thêm 2 hình chữ nhật mới, tổng cộng thành 5 hình chữ nhật."
          }
        ]
      },
      {
        "id": 328,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 328: Đếm số hình tam giác phức hợp",
        "subtitle": "Đếm hình đơn và hình ghép chính xác",
        "position": {
          "x": 154,
          "z": 68
        },
        "color": 6732650,
        "badge": "Bia Đá 328: Mắt Thần Đếm Hình",
        "steps": [
          {
            "stepId": "328_1",
            "prompt": "Hình thang có 2 đường chéo giao nhau và một tam giác phụ gắn ở cạnh bên trái có tất cả bao nhiêu hình tam giác?",
            "options": [
              {
                "label": "7 hình tam giác",
                "value": "7 hình tam giác"
              },
              {
                "label": "6 hình tam giác",
                "value": "6 hình tam giác"
              },
              {
                "label": "8 hình tam giác",
                "value": "8 hình tam giác"
              }
            ],
            "answer": "7 hình tam giác",
            "hints": [
              "Đếm các tam giác đơn không bị chia cắt: gồm tam giác trái ngoài cùng và 4 tam giác nhỏ bên trong hình thang.",
              "Đếm các tam giác ghép đôi từ 2 tam giác nhỏ."
            ],
            "explanation": "Gồm 5 tam giác đơn và 2 tam giác ghép lớn, tổng cộng có đúng 7 hình tam giác."
          }
        ]
      },
      {
        "id": 329,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 329: Trung điểm đoạn thẳng",
        "subtitle": "Tính độ dài đoạn thẳng khi biết một nửa",
        "position": {
          "x": 150,
          "z": 69
        },
        "color": 6732650,
        "badge": "Bia Đá 329: Tâm Điểm Cân Bằng",
        "steps": [
          {
            "stepId": "329_1",
            "prompt": "Cho đoạn thẳng AB, M là trung điểm của AB. Biết AM = 6 cm. Độ dài đoạn thẳng AB là bao nhiêu?",
            "options": [
              {
                "label": "12 cm",
                "value": "12 cm"
              },
              {
                "label": "3 cm",
                "value": "3 cm"
              },
              {
                "label": "18 cm",
                "value": "18 cm"
              }
            ],
            "answer": "12 cm",
            "hints": [
              "M là trung điểm của AB nên AM = MB = 6 cm.",
              "Độ dài đoạn AB = AM + MB = 6 + 6."
            ],
            "explanation": "Đoạn thẳng AB dài gấp đôi đoạn AM: 6 × 2 = 12 cm."
          }
        ]
      },
      {
        "id": 330,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 330: Tổng độ dài 3 đoạn thẳng",
        "subtitle": "Phép cộng các số đo độ dài",
        "position": {
          "x": 145,
          "z": 68
        },
        "color": 6732650,
        "badge": "Bia Đá 330: Thước Đo Tam Khúc",
        "steps": [
          {
            "stepId": "330_1",
            "prompt": "Đoạn AB dài 145 cm, BC dài 200 cm, CD dài 165 cm. Tổng độ dài 3 đoạn thẳng đó là bao nhiêu xăng-ti-mét?",
            "options": [
              {
                "label": "510 cm",
                "value": "510 cm"
              },
              {
                "label": "500 cm",
                "value": "500 cm"
              },
              {
                "label": "520 cm",
                "value": "520 cm"
              }
            ],
            "answer": "510 cm",
            "hints": [
              "Tính: 145 + 200 + 165.",
              "145 + 165 = 310; 310 + 200 = ?"
            ],
            "explanation": "145 cm + 200 cm + 165 cm = 310 cm + 200 cm = 510 cm."
          }
        ]
      },
      {
        "id": 331,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 331: Đường gấp khúc 3 đoạn có lời văn",
        "subtitle": "Giải bài toán hai bước tính độ dài đường gấp khúc",
        "position": {
          "x": 142,
          "z": 64
        },
        "color": 6732650,
        "badge": "Bia Đá 331: Chặng Đường Ba Khúc",
        "steps": [
          {
            "stepId": "331_1",
            "prompt": "Một đường gấp khúc gồm 3 đoạn. Đoạn 1 dài 120 cm. Đoạn 2 dài 230 cm và ngắn hơn đoạn 3 là 70 cm. Độ dài đường gấp khúc đó là bao nhiêu?",
            "options": [
              {
                "label": "650 cm",
                "value": "650 cm"
              },
              {
                "label": "580 cm",
                "value": "580 cm"
              },
              {
                "label": "720 cm",
                "value": "720 cm"
              }
            ],
            "answer": "650 cm",
            "hints": [
              "Đoạn 2 ngắn hơn đoạn 3 là 70 cm ➔ Đoạn 3 dài: 230 + 70 = 300 cm.",
              "Độ dài cả đường gấp khúc: 120 + 230 + 300."
            ],
            "explanation": "Đoạn 3 dài: 230 + 70 = 300 cm. Cả đường gấp khúc dài: 120 + 230 + 300 = 650 cm."
          }
        ]
      },
      {
        "id": 332,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 332: Đường gấp khúc ABCDE 4 đoạn",
        "subtitle": "Tính tổng độ dài theo hình vẽ minh họa",
        "position": {
          "x": 142,
          "z": 56
        },
        "color": 6732650,
        "badge": "Bia Đá 332: Khúc Nhạc Quanh Co",
        "steps": [
          {
            "stepId": "332_1",
            "prompt": "Tính độ dài đường gấp khúc ABCDE biết: AB = 35 cm, BC = 35 cm, CD = 23 cm, DE = 35 cm.",
            "options": [
              {
                "label": "128 cm",
                "value": "128 cm"
              },
              {
                "label": "118 cm",
                "value": "118 cm"
              },
              {
                "label": "138 cm",
                "value": "138 cm"
              }
            ],
            "answer": "128 cm",
            "hints": [
              "Độ dài = AB + BC + CD + DE = 35 + 35 + 23 + 35.",
              "35 × 3 = 105; 105 + 23 = ?"
            ],
            "explanation": "Độ dài đường gấp khúc là: 35 + 35 + 23 + 35 = 128 cm."
          }
        ]
      },
      {
        "id": 333,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 333: Đếm đoạn thẳng & hình chữ nhật",
        "subtitle": "Phân tích hình chữ nhật chia đôi theo chiều dọc",
        "position": {
          "x": 145,
          "z": 52
        },
        "color": 6732650,
        "badge": "Bia Đá 333: Khung Tranh Đôi Lớp",
        "steps": [
          {
            "stepId": "333_1",
            "prompt": "Hình chữ nhật ABCD có đoạn EG chia thành 2 hình chữ nhật nhỏ. Hình có bao nhiêu hình chữ nhật và bao nhiêu đoạn thẳng?",
            "options": [
              {
                "label": "3 hình chữ nhật và 9 đoạn thẳng",
                "value": "3 hình chữ nhật và 9 đoạn thẳng"
              },
              {
                "label": "2 hình chữ nhật và 7 đoạn thẳng",
                "value": "2 hình chữ nhật và 7 đoạn thẳng"
              },
              {
                "label": "3 hình chữ nhật và 6 đoạn thẳng",
                "value": "3 hình chữ nhật và 6 đoạn thẳng"
              }
            ],
            "answer": "3 hình chữ nhật và 9 đoạn thẳng",
            "hints": [
              "Hình chữ nhật: AEGD, EBCG và ABCD (3 hình).",
              "Đoạn thẳng: Cạnh trên có AE, EB, AB (3); Cạnh dưới có DG, GC, DC (3); Ba đoạn dọc AD, EG, BC (3). Tổng là 3+3+3."
            ],
            "explanation": "Có 3 hình chữ nhật và 9 đoạn thẳng tất cả."
          }
        ]
      },
      {
        "id": 334,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 334: Đếm tam giác & tứ giác trong HCN",
        "subtitle": "Đếm hình hình học từ các đường chéo và đoạn nối",
        "position": {
          "x": 150,
          "z": 51
        },
        "color": 6732650,
        "badge": "Bia Đá 334: Mạng Lưới Đa Giác",
        "steps": [
          {
            "stepId": "334_1",
            "prompt": "Hình chữ nhật ABCE có điểm D trên cạnh EC nối với B tạo thành các tam giác. Hình có bao nhiêu hình tam giác?",
            "options": [
              {
                "label": "4 hình tam giác",
                "value": "4 hình tam giác"
              },
              {
                "label": "3 hình tam giác",
                "value": "3 hình tam giác"
              },
              {
                "label": "5 hình tam giác",
                "value": "5 hình tam giác"
              }
            ],
            "answer": "4 hình tam giác",
            "hints": [
              "Tam giác góc vuông: ABE, BCD.",
              "Các tam giác chứa cạnh chéo: BDE, BCE."
            ],
            "explanation": "Có 4 hình tam giác gồm: ABE, BCE, BDE và BDC."
          }
        ]
      },
      {
        "id": 335,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 335: Tam giác có đường cắt song song",
        "subtitle": "Đếm số hình tam giác và tứ giác tạo bởi đường song song",
        "position": {
          "x": 154,
          "z": 52
        },
        "color": 6732650,
        "badge": "Bia Đá 335: Tháp Cắt Tầng",
        "steps": [
          {
            "stepId": "335_1",
            "prompt": "Tam giác ABC có đoạn MN song song đáy BC, nối C với N. Hình có bao nhiêu hình tam giác và bao nhiêu hình tứ giác?",
            "options": [
              {
                "label": "4 hình tam giác và 1 hình tứ giác",
                "value": "4 hình tam giác và 1 hình tứ giác"
              },
              {
                "label": "3 hình tam giác và 2 hình tứ giác",
                "value": "3 hình tam giác và 2 hình tứ giác"
              },
              {
                "label": "5 hình tam giác và 1 hình tứ giác",
                "value": "5 hình tam giác và 1 hình tứ giác"
              }
            ],
            "answer": "4 hình tam giác và 1 hình tứ giác",
            "hints": [
              "Tam giác: AMN, MNC, ANC, ABC (4 tam giác).",
              "Tứ giác: BMNC (1 tứ giác)."
            ],
            "explanation": "Có 4 hình tam giác (AMN, MNC, ANC, ABC) và 1 hình tứ giác (BMNC)."
          }
        ]
      },
      {
        "id": 336,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 336: Đếm điểm và tứ giác hình thang vuông",
        "subtitle": "Phân tích điểm, đoạn thẳng trong hình thang vuông",
        "position": {
          "x": 157,
          "z": 56
        },
        "color": 6732650,
        "badge": "Bia Đá 336: Điểm Mốc Đồ Hình",
        "steps": [
          {
            "stepId": "336_1",
            "prompt": "Hình thang vuông ABCD có điểm M trên đáy CD và điểm giao N. Hình có bao nhiêu điểm phân biệt?",
            "options": [
              {
                "label": "6 điểm (A, B, C, D, M, N)",
                "value": "6 điểm (A, B, C, D, M, N)"
              },
              {
                "label": "5 điểm (A, B, C, D, M)",
                "value": "5 điểm (A, B, C, D, M)"
              },
              {
                "label": "7 điểm",
                "value": "7 điểm"
              }
            ],
            "answer": "6 điểm (A, B, C, D, M, N)",
            "hints": [
              "Đếm 4 đỉnh của hình thang: A, B, C, D.",
              "Đếm thêm điểm nằm trên cạnh M và điểm giao nhau N."
            ],
            "explanation": "Hình có đúng 6 điểm được đánh dấu: A, B, C, D, M, N."
          }
        ]
      },
      {
        "id": 337,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 337: Đường gấp khúc MNPQ",
        "subtitle": "Bài toán lời văn so sánh hơn kém đường gấp khúc",
        "position": {
          "x": 148,
          "z": 57
        },
        "color": 6732650,
        "badge": "Bia Đá 337: Nhịp Cầu MNPQ",
        "steps": [
          {
            "stepId": "337_1",
            "prompt": "Đường gấp khúc MNPQ có đoạn MN = 219 cm. Tổng hai đoạn NP và PQ hơn đoạn MN là 180 cm. Độ dài đường gấp khúc MNPQ là bao nhiêu?",
            "options": [
              {
                "label": "618 cm",
                "value": "618 cm"
              },
              {
                "label": "399 cm",
                "value": "399 cm"
              },
              {
                "label": "598 cm",
                "value": "598 cm"
              }
            ],
            "answer": "618 cm",
            "hints": [
              "Tính tổng hai đoạn NP + PQ: 219 + 180 = 399 cm.",
              "Độ dài cả đường MNPQ: MN + (NP + PQ) = 219 + 399."
            ],
            "explanation": "NP + PQ = 219 + 180 = 399 cm. MNPQ = 219 + 399 = 618 cm."
          }
        ]
      },
      {
        "id": 338,
        "zoneId": 4,
        "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
        "title": "Bài 338: Đường gấp khúc 3 đoạn dài hơn",
        "subtitle": "Tìm đoạn thứ ba qua quan hệ so sánh dài hơn",
        "position": {
          "x": 152,
          "z": 63
        },
        "color": 6732650,
        "badge": "Bia Đá 338: Thử Thách Uốn Lượn",
        "steps": [
          {
            "stepId": "338_1",
            "prompt": "Đoạn 1 dài 218 cm, đoạn 2 dài 345 cm và dài hơn đoạn 3 là 165 cm. Độ dài đường gấp khúc đó là bao nhiêu?",
            "options": [
              {
                "label": "743 cm",
                "value": "743 cm"
              },
              {
                "label": "728 cm",
                "value": "728 cm"
              },
              {
                "label": "753 cm",
                "value": "753 cm"
              }
            ],
            "answer": "743 cm",
            "hints": [
              "Đoạn 2 dài hơn đoạn 3 là 165 cm ➔ Đoạn 3 dài: 345 – 165 = 180 cm.",
              "Độ dài cả đường: 218 + 345 + 180."
            ],
            "explanation": "Đoạn 3 dài: 345 – 165 = 180 cm. Tổng độ dài: 218 + 345 + 180 = 743 cm."
          }
        ]
      }
    ],
    "Zone_5_Archimedes": [
      {
        "id": 323,
        "zoneId": 5,
        "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
        "title": "Bài 323 (*): Dãy 9 ô tổng 4 ô liền nhau bằng 600",
        "subtitle": "Bài toán suy luận chu kỳ số học (*)",
        "position": {
          "x": 186,
          "z": -4
        },
        "color": 11225020,
        "badge": "Bia Đá 323: Ma Trận Bốn Số Tuần Hoàn (*)",
        "steps": [
          {
            "stepId": "323_1",
            "prompt": "Dãy có 9 ô: [199] [ ] [ ] [265] [ ] [ ] [58] [ ] [ ]. Tổng 4 ô liền nhau bất kỳ đều bằng 600. Số ở ô thứ hai là bao nhiêu?",
            "options": [
              {
                "label": "78",
                "value": "78"
              },
              {
                "label": "68",
                "value": "68"
              },
              {
                "label": "88",
                "value": "88"
              }
            ],
            "answer": "78",
            "hints": [
              "Vì tổng 4 ô liên tiếp luôn bằng 600 nên các số cách nhau 4 vị trí sẽ bằng nhau (chu kỳ lặp lại 4 số: a1 = a5 = a9; a2 = a6; a3 = a7 = 58; a4 = a8 = 265).",
              "Ta có: a1 + a2 + a3 + a4 = 600 ➔ 199 + a2 + 58 + 265 = 600 ➔ 522 + a2 = 600."
            ],
            "explanation": "Chu kỳ 4 số là 199, 78, 58, 265. Vậy ô thứ hai bằng 600 – 522 = 78."
          }
        ]
      },
      {
        "id": 324,
        "zoneId": 5,
        "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
        "title": "Bài 324 (*): Ghép chữ số có tổng bé nhất",
        "subtitle": "Tối ưu hoá giá trị chữ số theo hàng (*)",
        "position": {
          "x": 194,
          "z": -4
        },
        "color": 11225020,
        "badge": "Bia Đá 324: Tinh Hoa Ghép Số (*)",
        "steps": [
          {
            "stepId": "324_1",
            "prompt": "Cho các chữ số 0; 1; 2; 3; 4; 6. Viết mỗi chữ số vào 1 ô trống: [ ][ ][ ] + [ ][ ][ ] để tổng nhận được là số bé nhất có thể. Tổng bé nhất đó là bao nhiêu?",
            "options": [
              {
                "label": "340",
                "value": "340"
              },
              {
                "label": "350",
                "value": "350"
              },
              {
                "label": "330",
                "value": "330"
              }
            ],
            "answer": "340",
            "hints": [
              "Để tổng bé nhất, hàng trăm phải là 2 chữ số bé nhất khác 0: là 1 và 2.",
              "Hàng chục chọn 2 chữ số bé tiếp theo: 0 và 3. Hàng đơn vị chọn 4 và 6. Phép tính ví dụ: 104 + 236 = 340."
            ],
            "explanation": "Chọn chữ số hàng trăm là 1 và 2; hàng chục là 0 và 3; hàng đơn vị là 4 và 6. Tổng bé nhất là 104 + 236 = 340."
          }
        ]
      },
      {
        "id": 325,
        "zoneId": 5,
        "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
        "title": "Bài 325 (**): Tô màu lưới 24 ô vuông",
        "subtitle": "Bài toán hiệu và tổng số ô tô màu (**)",
        "position": {
          "x": 186,
          "z": 4
        },
        "color": 11225020,
        "badge": "Bia Đá 325: Lưới Màu Kỳ Ảo (**)",
        "steps": [
          {
            "stepId": "325_1",
            "prompt": "Lưới ô vuông gồm 24 ô, hiện tại đã tô màu 5 ô. Cần tô thêm bao nhiêu ô trắng nữa để số ô trắng ít hơn số ô màu là 4 ô?",
            "options": [
              {
                "label": "9 ô",
                "value": "9 ô"
              },
              {
                "label": "8 ô",
                "value": "8 ô"
              },
              {
                "label": "10 ô",
                "value": "10 ô"
              }
            ],
            "answer": "9 ô",
            "hints": [
              "Tổng số ô là 24. Khi số ô trắng ít hơn số ô màu là 4 ô thì số ô màu lúc sau là: (24 + 4) : 2 = 14 ô.",
              "Hiện tại đã tô sẵn 5 ô màu, vậy cần tô thêm: 14 – 5 = ? ô."
            ],
            "explanation": "Số ô màu lúc sau cần đạt là: (24 + 4) : 2 = 14 ô. Hiện có 5 ô đã tô, cần tô thêm: 14 – 5 = 9 ô."
          }
        ]
      },
      {
        "id": 345,
        "zoneId": 5,
        "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
        "title": "Bài 345 (**): Tam giác số ma thuật",
        "subtitle": "Điền các số 1 đến 6 vào 3 cạnh tam giác (**)",
        "position": {
          "x": 194,
          "z": 4
        },
        "color": 11225020,
        "badge": "Bia Đá 345: Tam Giác Ma Thuật Tối Thượng (**)",
        "steps": [
          {
            "stepId": "345_1",
            "prompt": "Điền các số từ 1 đến 6 vào 6 hình tròn trên 3 cạnh tam giác (mỗi cạnh 3 số) sao cho tổng mỗi cạnh bằng 12. Ba số đặt ở 3 đỉnh của hình tam giác phải là những số nào?",
            "options": [
              {
                "label": "4, 5, 6",
                "value": "4, 5, 6"
              },
              {
                "label": "1, 2, 3",
                "value": "1, 2, 3"
              },
              {
                "label": "3, 4, 5",
                "value": "3, 4, 5"
              }
            ],
            "answer": "4, 5, 6",
            "hints": [
              "Tổng 3 cạnh = 12 × 3 = 36. Tổng từ 1 đến 6 là 1+2+3+4+5+6 = 21.",
              "Các đỉnh được tính 2 lần, nên tổng 3 đỉnh = 36 – 21 = 15. Ba số từ 1..6 có tổng bằng 15 duy nhất là: 4, 5, 6."
            ],
            "explanation": "Tổng 3 đỉnh phải bằng 12 × 3 – 21 = 15. Ba số khác nhau trong khoảng 1–6 có tổng bằng 15 là 4, 5, 6."
          },
          {
            "stepId": "345_2",
            "prompt": "Nếu muốn tổng mỗi cạnh tam giác đều bằng 11 thì tổng 3 số ở 3 đỉnh phải bằng bao nhiêu?",
            "options": [
              {
                "label": "12",
                "value": "12"
              },
              {
                "label": "10",
                "value": "10"
              },
              {
                "label": "14",
                "value": "14"
              }
            ],
            "answer": "12",
            "hints": [
              "Tổng 3 cạnh = 11 × 3 = 33.",
              "Tổng 3 đỉnh = Tổng 3 cạnh – Tổng (1+2+3+4+5+6) = 33 – 21 = ?"
            ],
            "explanation": "Tổng 3 số ở 3 đỉnh là: 11 × 3 – 21 = 12 (ví dụ chọn 3 đỉnh là 2, 4, 6)."
          }
        ]
      }
    ],
    "VuonHoa": [
      {
        "id": 1,
        "title": "Hoa Thử Thách #1",
        "subtitle": "Bài 1: Phép cộng có nhớ",
        "position": null,
        "color": 15753874,
        "badge": "🌸 Hoa Sen Hồng",
        "steps": [
          {
            "stepId": "flower_1",
            "prompt": "Tính: 64 + 36",
            "options": [
              {
                "label": "90",
                "value": "90"
              },
              {
                "label": "100",
                "value": "100"
              },
              {
                "label": "99",
                "value": "99"
              }
            ],
            "answer": "100",
            "hints": [
              "Cộng từ phải sang trái: cộng hàng đơn vị trước: 4 + 6 = 10 (viết 0, nhớ 1).",
              "Cộng tiếp hàng chục: 6 + 3 = 9, thêm 1 đã nhớ là 10.",
              "Ghép lại kết quả: 64 + 36 = 100."
            ],
            "explanation": "64 + 36 = 100. Khi cộng 4 + 6 = 10 viết 0 nhớ 1 sang hàng chục."
          }
        ]
      },
      {
        "id": 2,
        "title": "Hoa Thử Thách #2",
        "subtitle": "Bài 2: Phép tính khối lượng",
        "position": null,
        "color": 16757504,
        "badge": "🌻 Hoa Hướng Dương",
        "steps": [
          {
            "stepId": "flower_2",
            "prompt": "Tính: 67kg – 25kg – 20kg",
            "options": [
              {
                "label": "22kg",
                "value": "22kg"
              },
              {
                "label": "32kg",
                "value": "32kg"
              },
              {
                "label": "42kg",
                "value": "42kg"
              }
            ],
            "answer": "22kg",
            "hints": [
              "Thực hiện lần lượt từ trái sang phải: lấy 67kg – 25kg trước.",
              "Ta có: 67kg – 25kg = 42kg. Sau đó lấy 42kg – 20kg = ?",
              "42kg – 20kg = 22kg."
            ],
            "explanation": "67kg – 25kg – 20kg = 42kg – 20kg = 22kg."
          }
        ]
      },
      {
        "id": 3,
        "title": "Hoa Thử Thách #3",
        "subtitle": "Bài 3: So sánh và điền chữ số",
        "position": null,
        "color": 4367861,
        "badge": "💠 Hoa Thanh Tú",
        "steps": [
          {
            "stepId": "flower_3",
            "prompt": "Điền chữ số thích hợp vào chỗ trống: 9__ < 89 + 2",
            "options": [
              {
                "label": "0",
                "value": "0"
              },
              {
                "label": "1",
                "value": "1"
              },
              {
                "label": "2",
                "value": "2"
              }
            ],
            "answer": "0",
            "hints": [
              "Tính kết quả vế phải trước: 89 + 2 = 91.",
              "Ta có: 9__ < 91. Các số có hai chữ số bắt đầu bằng chữ số 9 là 90, 91, 92...",
              "Vì 90 < 91 nên chữ số thích hợp duy nhất điền vào là 0."
            ],
            "explanation": "89 + 2 = 91. Số 90 < 91, vậy chữ số cần điền vào chỗ trống là 0."
          }
        ]
      },
      {
        "id": 4,
        "title": "Hoa Thử Thách #4",
        "subtitle": "Bài 4: Bài toán thùng sách",
        "position": null,
        "color": 15277667,
        "badge": "🌹 Hoa Hồng Nhung",
        "steps": [
          {
            "stepId": "flower_4",
            "prompt": "Từ một thùng sách lấy ra 12 quyển thì còn lại 38 quyển. Hỏi lúc đầu trong thùng có bao nhiêu quyển sách?",
            "options": [
              {
                "label": "50 quyển",
                "value": "50 quyển"
              },
              {
                "label": "26 quyển",
                "value": "26 quyển"
              },
              {
                "label": "48 quyển",
                "value": "48 quyển"
              }
            ],
            "answer": "50 quyển",
            "hints": [
              "Muốn tìm số sách lúc đầu (số bị trừ), ta lấy số sách còn lại (hiệu) cộng với số sách đã lấy ra (số trừ).",
              "Phép tính cần thực hiện: 38 + 12 = ?",
              "38 + 12 = 50 (quyển sách)."
            ],
            "explanation": "Lúc đầu trong thùng có số quyển sách là: 38 + 12 = 50 (quyển)."
          }
        ]
      },
      {
        "id": 5,
        "title": "Hoa Thử Thách #5",
        "subtitle": "Bài 5: Bài toán tuổi mẹ con",
        "position": null,
        "color": 11225020,
        "badge": "💜 Hoa Dạ Yến Thảo",
        "steps": [
          {
            "stepId": "flower_5",
            "prompt": "Hiện nay, tổng số tuổi hai mẹ con Khánh là 52 tuổi, biết Khánh 12 tuổi. Hỏi hiện nay, mẹ Khánh bao nhiêu tuổi?",
            "options": [
              {
                "label": "40 tuổi",
                "value": "40 tuổi"
              },
              {
                "label": "38 tuổi",
                "value": "38 tuổi"
              },
              {
                "label": "42 tuổi",
                "value": "42 tuổi"
              }
            ],
            "answer": "40 tuổi",
            "hints": [
              "Tuổi của mẹ bằng tổng số tuổi của hai mẹ con trừ đi số tuổi của Khánh.",
              "Phép tính: 52 – 12 = ?",
              "52 – 12 = 40 (tuổi)."
            ],
            "explanation": "Tuổi của mẹ Khánh hiện nay là: 52 – 12 = 40 (tuổi)."
          }
        ]
      },
      {
        "id": 6,
        "title": "Hoa Thử Thách #6",
        "subtitle": "Bài 6: Số lớn nhất và số liền sau",
        "position": null,
        "color": 16740419,
        "badge": "🌺 Hoa Lưu Ly Cam",
        "steps": [
          {
            "stepId": "flower_6",
            "prompt": "Tổng của số lớn nhất có hai chữ số với số liền sau của 0 là:",
            "options": [
              {
                "label": "100",
                "value": "100"
              },
              {
                "label": "99",
                "value": "99"
              },
              {
                "label": "101",
                "value": "101"
              }
            ],
            "answer": "100",
            "hints": [
              "Số lớn nhất có hai chữ số là 99.",
              "Số liền sau của 0 là 1 (vì 0 + 1 = 1).",
              "Tính tổng của hai số đó: 99 + 1 = 100."
            ],
            "explanation": "Số lớn nhất có 2 chữ số là 99; số liền sau của 0 là 1. Tổng của chúng là: 99 + 1 = 100."
          }
        ]
      },
      {
        "id": 7,
        "title": "Hoa Thử Thách #7",
        "subtitle": "Bài 7: Xem lịch ngày trong tuần",
        "position": null,
        "color": 2533018,
        "badge": "🌿 Hoa Thủy Tiên Ngọc",
        "steps": [
          {
            "stepId": "flower_7",
            "prompt": "Nếu Chủ nhật tuần này là ngày 22 tháng 5 thì thứ Bảy tuần sau là ngày bao nhiêu tháng 5?",
            "imageUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 280 140\" width=\"280\" height=\"140\"><rect width=\"280\" height=\"140\" fill=\"%23ffffff\" rx=\"10\" stroke=\"%23cbd5e1\" stroke-width=\"1.5\"/><path d=\"M0 10A10 10 0 0 1 10 0h260a10 10 0 0 1 10 10v22H0z\" fill=\"%232563eb\"/><text x=\"140\" y=\"22\" fill=\"%23ffffff\" font-family=\"sans-serif\" font-weight=\"bold\" font-size=\"14\" text-anchor=\"middle\">LỊCH THÁNG 5</text><g font-family=\"sans-serif\" font-size=\"11\" font-weight=\"bold\" fill=\"%2364748b\" text-anchor=\"middle\"><text x=\"30\" y=\"50\">T2</text><text x=\"70\" y=\"50\">T3</text><text x=\"110\" y=\"50\">T4</text><text x=\"150\" y=\"50\">T5</text><text x=\"190\" y=\"50\">T6</text><text x=\"230\" y=\"50\">T7</text><text x=\"260\" y=\"50\" fill=\"%23ef4444\">CN</text></g><g font-family=\"sans-serif\" font-size=\"12\" fill=\"%23334155\" text-anchor=\"middle\"><text x=\"30\" y=\"75\">16</text><text x=\"70\" y=\"75\">17</text><text x=\"110\" y=\"75\">18</text><text x=\"150\" y=\"75\">19</text><text x=\"190\" y=\"75\">20</text><text x=\"230\" y=\"75\">21</text><rect x=\"246\" y=\"60\" width=\"28\" height=\"22\" rx=\"4\" fill=\"%23fee2e2\" stroke=\"%23ef4444\"/><text x=\"260\" y=\"75\" font-weight=\"bold\" fill=\"%23dc2626\">22</text><text x=\"30\" y=\"105\">23</text><text x=\"70\" y=\"105\">24</text><text x=\"110\" y=\"105\">25</text><text x=\"150\" y=\"105\">26</text><text x=\"190\" y=\"105\">27</text><rect x=\"216\" y=\"90\" width=\"28\" height=\"22\" rx=\"4\" fill=\"%23fef08a\" stroke=\"%23ca8a04\"/><text x=\"230\" y=\"105\" font-weight=\"bold\" fill=\"%23854d0e\">?</text><text x=\"260\" y=\"105\">29</text></g></svg>",
            "options": [
              {
                "label": "Ngày 28 tháng 5",
                "value": "Ngày 28 tháng 5"
              },
              {
                "label": "Ngày 29 tháng 5",
                "value": "Ngày 29 tháng 5"
              },
              {
                "label": "Ngày 27 tháng 5",
                "value": "Ngày 27 tháng 5"
              }
            ],
            "answer": "Ngày 28 tháng 5",
            "hints": [
              "Một tuần có 7 ngày. Chủ nhật tuần sau sẽ là ngày: 22 + 7 = 29 tháng 5.",
              "Thứ Bảy tuần sau là ngày liền trước của Chủ nhật tuần sau: 29 – 1 = 28.",
              "Vậy thứ Bảy tuần sau là ngày 28 tháng 5."
            ],
            "explanation": "Chủ nhật tuần sau là ngày 22 + 7 = 29 tháng 5. Thứ Bảy tuần sau là ngày liền trước nên là ngày 28 tháng 5."
          }
        ]
      },
      {
        "id": 8,
        "title": "Hoa Thử Thách #8",
        "subtitle": "Bài 8: Dãy số tăng quy luật",
        "position": null,
        "color": 16754470,
        "badge": "🌼 Hoa Cúc Vạn Thọ",
        "steps": [
          {
            "stepId": "flower_8",
            "prompt": "Điền số thích hợp tiếp theo vào chỗ trống để được dãy số theo quy luật: 1; 4; 7; 10; ...",
            "options": [
              {
                "label": "13",
                "value": "13"
              },
              {
                "label": "12",
                "value": "12"
              },
              {
                "label": "14",
                "value": "14"
              }
            ],
            "answer": "13",
            "hints": [
              "Tìm khoảng cách giữa các số liên tiếp: 4 – 1 = 3; 7 – 4 = 3; 10 – 7 = 3.",
              "Mỗi số đứng sau bằng số đứng trước cộng thêm 3 đơn vị.",
              "Số tiếp theo là: 10 + 3 = 13."
            ],
            "explanation": "Dãy số tăng đều 3 đơn vị: 1 (+3) -> 4 (+3) -> 7 (+3) -> 10 (+3) -> 13."
          }
        ]
      },
      {
        "id": 9,
        "title": "Hoa Thử Thách #9",
        "subtitle": "Bài 9: Dãy số giảm quy luật",
        "position": null,
        "color": 6056896,
        "badge": "🔔 Hoa Chuông Xanh",
        "steps": [
          {
            "stepId": "flower_9",
            "prompt": "Điền số thích hợp tiếp theo vào chỗ trống để được dãy số theo quy luật: 97; 86; 75; 64; ....",
            "options": [
              {
                "label": "53",
                "value": "53"
              },
              {
                "label": "54",
                "value": "54"
              },
              {
                "label": "52",
                "value": "52"
              }
            ],
            "answer": "53",
            "hints": [
              "Tìm quy luật giảm: 97 – 86 = 11; 86 – 75 = 11; 75 – 64 = 11.",
              "Mỗi số đứng sau bằng số đứng trước trừ đi 11 đơn vị.",
              "Số tiếp theo là: 64 – 11 = 53."
            ],
            "explanation": "Dãy số giảm đều 11 đơn vị: 97 (-11) -> 86 (-11) -> 75 (-11) -> 64 (-11) -> 53."
          }
        ]
      },
      {
        "id": 10,
        "title": "Hoa Thử Thách #10",
        "subtitle": "Bài 10: Đếm số có 2 chữ số có tổng bằng 10",
        "position": null,
        "color": 16766287,
        "badge": "👑 Hoa Mặt Trời Hoàng Kim",
        "steps": [
          {
            "stepId": "flower_10",
            "prompt": "Có bao nhiêu số có hai chữ số mà tổng hai chữ số của số đó bằng 10?",
            "options": [
              {
                "label": "9 số",
                "value": "9 số"
              },
              {
                "label": "8 số",
                "value": "8 số"
              },
              {
                "label": "10 số",
                "value": "10 số"
              }
            ],
            "answer": "9 số",
            "hints": [
              "Liệt kê các số có hai chữ số mà tổng 2 chữ số bằng 10 bắt đầu từ hàng chục là 1: số 19 (1 + 9 = 10).",
              "Các số tiếp theo: 28, 37, 46, 55, 64, 73, 82, 91.",
              "Đếm tất cả các số trên: có đúng 9 số thỏa mãn."
            ],
            "explanation": "Các số có 2 chữ số có tổng bằng 10 gồm: 19, 28, 37, 46, 55, 64, 73, 82, 91 -> tổng cộng có 9 số."
          }
        ]
      }
    ],
    "CongVienXanh": [
      {
        "id": 1,
        "title": "Cây Tri Thức #1",
        "subtitle": "Bảng nhân 8: 8 × 7 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #1",
        "steps": [
          {
            "stepId": "tree_1",
            "prompt": "Tính giá trị của phép tính: 8 × 7 = ?",
            "options": [
              {
                "label": "54",
                "value": "54"
              },
              {
                "label": "56",
                "value": "56"
              },
              {
                "label": "58",
                "value": "58"
              }
            ],
            "answer": "56",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 56."
            ],
            "explanation": "8 × 7 = 56."
          }
        ]
      },
      {
        "id": 2,
        "title": "Cây Tri Thức #2",
        "subtitle": "Bảng chia 9: 72 : 9 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #2",
        "steps": [
          {
            "stepId": "tree_2",
            "prompt": "Tính giá trị của phép tính: 72 : 9 = ?",
            "options": [
              {
                "label": "7",
                "value": "7"
              },
              {
                "label": "8",
                "value": "8"
              },
              {
                "label": "9",
                "value": "9"
              }
            ],
            "answer": "8",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 8."
            ],
            "explanation": "72 : 9 = 8."
          }
        ]
      },
      {
        "id": 3,
        "title": "Cây Tri Thức #3",
        "subtitle": "Bảng nhân 6: 6 × 9 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #3",
        "steps": [
          {
            "stepId": "tree_3",
            "prompt": "Tính giá trị của phép tính: 6 × 9 = ?",
            "options": [
              {
                "label": "48",
                "value": "48"
              },
              {
                "label": "54",
                "value": "54"
              },
              {
                "label": "56",
                "value": "56"
              }
            ],
            "answer": "54",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 54."
            ],
            "explanation": "6 × 9 = 54."
          }
        ]
      },
      {
        "id": 4,
        "title": "Cây Tri Thức #4",
        "subtitle": "Bảng chia 8: 56 : 8 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #4",
        "steps": [
          {
            "stepId": "tree_4",
            "prompt": "Tính giá trị của phép tính: 56 : 8 = ?",
            "options": [
              {
                "label": "6",
                "value": "6"
              },
              {
                "label": "7",
                "value": "7"
              },
              {
                "label": "8",
                "value": "8"
              }
            ],
            "answer": "7",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 7."
            ],
            "explanation": "56 : 8 = 7."
          }
        ]
      },
      {
        "id": 5,
        "title": "Cây Tri Thức #5",
        "subtitle": "Bảng nhân 9: 9 × 8 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #5",
        "steps": [
          {
            "stepId": "tree_5",
            "prompt": "Tính giá trị của phép tính: 9 × 8 = ?",
            "options": [
              {
                "label": "64",
                "value": "64"
              },
              {
                "label": "72",
                "value": "72"
              },
              {
                "label": "81",
                "value": "81"
              }
            ],
            "answer": "72",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 72."
            ],
            "explanation": "9 × 8 = 72."
          }
        ]
      },
      {
        "id": 6,
        "title": "Cây Tri Thức #6",
        "subtitle": "Bảng chia 7: 63 : 7 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #6",
        "steps": [
          {
            "stepId": "tree_6",
            "prompt": "Tính giá trị của phép tính: 63 : 7 = ?",
            "options": [
              {
                "label": "8",
                "value": "8"
              },
              {
                "label": "9",
                "value": "9"
              },
              {
                "label": "10",
                "value": "10"
              }
            ],
            "answer": "9",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 9."
            ],
            "explanation": "63 : 7 = 9."
          }
        ]
      },
      {
        "id": 7,
        "title": "Cây Tri Thức #7",
        "subtitle": "Bảng nhân 4: 4 × 9 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #7",
        "steps": [
          {
            "stepId": "tree_7",
            "prompt": "Tính giá trị của phép tính: 4 × 9 = ?",
            "options": [
              {
                "label": "32",
                "value": "32"
              },
              {
                "label": "36",
                "value": "36"
              },
              {
                "label": "40",
                "value": "40"
              }
            ],
            "answer": "36",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 36."
            ],
            "explanation": "4 × 9 = 36."
          }
        ]
      },
      {
        "id": 8,
        "title": "Cây Tri Thức #8",
        "subtitle": "Bảng chia 6: 48 : 6 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #8",
        "steps": [
          {
            "stepId": "tree_8",
            "prompt": "Tính giá trị của phép tính: 48 : 6 = ?",
            "options": [
              {
                "label": "7",
                "value": "7"
              },
              {
                "label": "8",
                "value": "8"
              },
              {
                "label": "9",
                "value": "9"
              }
            ],
            "answer": "8",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 8."
            ],
            "explanation": "48 : 6 = 8."
          }
        ]
      },
      {
        "id": 9,
        "title": "Cây Tri Thức #9",
        "subtitle": "Bảng nhân 7: 7 × 7 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #9",
        "steps": [
          {
            "stepId": "tree_9",
            "prompt": "Tính giá trị của phép tính: 7 × 7 = ?",
            "options": [
              {
                "label": "42",
                "value": "42"
              },
              {
                "label": "49",
                "value": "49"
              },
              {
                "label": "56",
                "value": "56"
              }
            ],
            "answer": "49",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 49."
            ],
            "explanation": "7 × 7 = 49."
          }
        ]
      },
      {
        "id": 10,
        "title": "Cây Tri Thức #10",
        "subtitle": "Bảng chia 9: 81 : 9 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #10",
        "steps": [
          {
            "stepId": "tree_10",
            "prompt": "Tính giá trị của phép tính: 81 : 9 = ?",
            "options": [
              {
                "label": "8",
                "value": "8"
              },
              {
                "label": "9",
                "value": "9"
              },
              {
                "label": "10",
                "value": "10"
              }
            ],
            "answer": "9",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 9."
            ],
            "explanation": "81 : 9 = 9."
          }
        ]
      },
      {
        "id": 11,
        "title": "Cây Tri Thức #11",
        "subtitle": "Bảng nhân 9: 9 × 9 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #11",
        "steps": [
          {
            "stepId": "tree_11",
            "prompt": "Tính giá trị của phép tính: 9 × 9 = ?",
            "options": [
              {
                "label": "72",
                "value": "72"
              },
              {
                "label": "81",
                "value": "81"
              },
              {
                "label": "90",
                "value": "90"
              }
            ],
            "answer": "81",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 81."
            ],
            "explanation": "9 × 9 = 81."
          }
        ]
      },
      {
        "id": 12,
        "title": "Cây Tri Thức #12",
        "subtitle": "Bảng chia 6: 42 : 6 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #12",
        "steps": [
          {
            "stepId": "tree_12",
            "prompt": "Tính giá trị của phép tính: 42 : 6 = ?",
            "options": [
              {
                "label": "6",
                "value": "6"
              },
              {
                "label": "7",
                "value": "7"
              },
              {
                "label": "8",
                "value": "8"
              }
            ],
            "answer": "7",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 7."
            ],
            "explanation": "42 : 6 = 7."
          }
        ]
      },
      {
        "id": 13,
        "title": "Cây Tri Thức #13",
        "subtitle": "Bảng nhân 8: 8 × 6 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #13",
        "steps": [
          {
            "stepId": "tree_13",
            "prompt": "Tính giá trị của phép tính: 8 × 6 = ?",
            "options": [
              {
                "label": "42",
                "value": "42"
              },
              {
                "label": "48",
                "value": "48"
              },
              {
                "label": "54",
                "value": "54"
              }
            ],
            "answer": "48",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 48."
            ],
            "explanation": "8 × 6 = 48."
          }
        ]
      },
      {
        "id": 14,
        "title": "Cây Tri Thức #14",
        "subtitle": "Bảng chia 8: 64 : 8 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #14",
        "steps": [
          {
            "stepId": "tree_14",
            "prompt": "Tính giá trị của phép tính: 64 : 8 = ?",
            "options": [
              {
                "label": "7",
                "value": "7"
              },
              {
                "label": "8",
                "value": "8"
              },
              {
                "label": "9",
                "value": "9"
              }
            ],
            "answer": "8",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 8."
            ],
            "explanation": "64 : 8 = 8."
          }
        ]
      },
      {
        "id": 15,
        "title": "Cây Tri Thức #15",
        "subtitle": "Bảng nhân 7: 7 × 8 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #15",
        "steps": [
          {
            "stepId": "tree_15",
            "prompt": "Tính giá trị của phép tính: 7 × 8 = ?",
            "options": [
              {
                "label": "54",
                "value": "54"
              },
              {
                "label": "56",
                "value": "56"
              },
              {
                "label": "63",
                "value": "63"
              }
            ],
            "answer": "56",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 56."
            ],
            "explanation": "7 × 8 = 56."
          }
        ]
      },
      {
        "id": 16,
        "title": "Cây Tri Thức #16",
        "subtitle": "Bảng chia 5: 45 : 5 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #16",
        "steps": [
          {
            "stepId": "tree_16",
            "prompt": "Tính giá trị của phép tính: 45 : 5 = ?",
            "options": [
              {
                "label": "8",
                "value": "8"
              },
              {
                "label": "9",
                "value": "9"
              },
              {
                "label": "10",
                "value": "10"
              }
            ],
            "answer": "9",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 9."
            ],
            "explanation": "45 : 5 = 9."
          }
        ]
      },
      {
        "id": 17,
        "title": "Cây Tri Thức #17",
        "subtitle": "Bảng nhân 6: 6 × 7 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #17",
        "steps": [
          {
            "stepId": "tree_17",
            "prompt": "Tính giá trị của phép tính: 6 × 7 = ?",
            "options": [
              {
                "label": "36",
                "value": "36"
              },
              {
                "label": "42",
                "value": "42"
              },
              {
                "label": "48",
                "value": "48"
              }
            ],
            "answer": "42",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 42."
            ],
            "explanation": "6 × 7 = 42."
          }
        ]
      },
      {
        "id": 18,
        "title": "Cây Tri Thức #18",
        "subtitle": "Bảng chia 9: 54 : 9 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #18",
        "steps": [
          {
            "stepId": "tree_18",
            "prompt": "Tính giá trị của phép tính: 54 : 9 = ?",
            "options": [
              {
                "label": "5",
                "value": "5"
              },
              {
                "label": "6",
                "value": "6"
              },
              {
                "label": "7",
                "value": "7"
              }
            ],
            "answer": "6",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 6."
            ],
            "explanation": "54 : 9 = 6."
          }
        ]
      },
      {
        "id": 19,
        "title": "Cây Tri Thức #19",
        "subtitle": "Bảng nhân 9: 9 × 5 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #19",
        "steps": [
          {
            "stepId": "tree_19",
            "prompt": "Tính giá trị của phép tính: 9 × 5 = ?",
            "options": [
              {
                "label": "40",
                "value": "40"
              },
              {
                "label": "45",
                "value": "45"
              },
              {
                "label": "50",
                "value": "50"
              }
            ],
            "answer": "45",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 45."
            ],
            "explanation": "9 × 5 = 45."
          }
        ]
      },
      {
        "id": 20,
        "title": "Cây Tri Thức #20",
        "subtitle": "Bảng chia 10: 90 : 10 = ?",
        "position": null,
        "color": 1096065,
        "badge": "🌳 Cây Tri Thức #20",
        "steps": [
          {
            "stepId": "tree_20",
            "prompt": "Tính giá trị của phép tính: 90 : 10 = ?",
            "options": [
              {
                "label": "8",
                "value": "8"
              },
              {
                "label": "9",
                "value": "9"
              },
              {
                "label": "10",
                "value": "10"
              }
            ],
            "answer": "9",
            "hints": [
              "Dựa vào bảng nhân hoặc bảng chia tương ứng để tính nhẩm.",
              "Thử nhân ngược lại: nếu phép chia thì lấy thương nhân số chia.",
              "Kết quả chính xác là 9."
            ],
            "explanation": "90 : 10 = 9."
          }
        ]
      }
    ]
  }
};
