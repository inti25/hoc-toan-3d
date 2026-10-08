import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.resolve('apps-script/Code.gs'), 'utf-8');

function loadScript(): any {
  const context = vm.createContext({ console, Math, Number, String, Object, Array, JSON, isNaN });
  return vm.runInContext(
    source +
      '\n;({ ZONE_TEMPLATES, ZONE_TEMPLATE_ORDER, QUEST_HEADERS, CONFIG_HEADERS, generateMultiplicationRows,' +
      ' createZoneFromTemplate, handleSeedDatabase });',
    context
  );
}

class FakeSheet {
  rows: any[][] = [];
  constructor(public name: string) {}
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows[0]?.length ?? 0; }
  appendRow(r: any[]) { this.rows.push(r); }
  setFrozenRows() {}
  setColumnWidth() {}
  clear() { this.rows = []; }
  getRange(row: number, col: number, nRows = 1, nCols = 1) {
    const sheet = this;
    return {
      getValues: () => {
        const out: any[][] = [];
        for (let r = 0; r < nRows; r++) {
          const line: any[] = [];
          for (let c = 0; c < nCols; c++) line.push(sheet.rows[row - 1 + r]?.[col - 1 + c] ?? '');
          out.push(line);
        }
        return out;
      },
      setValues: (vals: any[][]) => {
        vals.forEach((v, r) => {
          sheet.rows[row - 1 + r] = sheet.rows[row - 1 + r] || [];
          v.forEach((x, c) => { sheet.rows[row - 1 + r][col - 1 + c] = x; });
        });
      },
      setValue: (v: any) => {
        sheet.rows[row - 1] = sheet.rows[row - 1] || [];
        sheet.rows[row - 1][col - 1] = v;
      },
      setNumberFormat() {},
      setFontWeight() { return this; },
      setBackground() { return this; }
    } as any;
  }
}

class FakeSpreadsheet {
  sheets = new Map<string, FakeSheet>();
  getSheetByName(n: string) { return this.sheets.get(n) ?? null; }
  insertSheet(n: string) { const s = new FakeSheet(n); this.sheets.set(n, s); return s; }
}

test('Code.gs no longer embeds hardcoded seed questions', () => {
  assert.equal(source.includes('SEED_DATA'), false);
});

test('generateMultiplicationRows sinh câu cửu chương hợp lệ, đáp án đúng, không trùng phép tính', () => {
  const gs = loadScript();
  for (let run = 0; run < 50; run++) {
    const rows = gs.generateMultiplicationRows(7, 20) as any[][];
    assert.equal(rows.length, 20);
    const prompts = new Set<string>();
    rows.forEach((row, i) => {
      assert.equal(row.length, gs.QUEST_HEADERS.length);
      assert.equal(row[0], `mul_7_${i + 1}`);
      const m = /^(\d+) × (\d+) = \?$/.exec(row[4]);
      assert.ok(m, `prompt không đúng định dạng: ${row[4]}`);
      prompts.add(row[4]);
      const answer = Number(m![1]) * Number(m![2]);
      assert.equal(Number(row[10]), answer);
      const options = [row[6], row[7], row[8], row[9]].map(Number);
      assert.equal(new Set(options).size, 4, 'đáp án phải khác nhau');
      assert.ok(options.every((o) => o > 0));
      assert.equal(options.filter((o) => o === answer).length, 1);
      assert.equal(String(row[11]).split(' | ').length, 3);
    });
    assert.equal(prompts.size, 20);
  }
});

test('createZoneFromTemplate hỗ trợ cả 6 template và ghi CONFIG + tab câu hỏi', () => {
  const gs = loadScript();
  assert.deepEqual([...gs.ZONE_TEMPLATE_ORDER].sort(), [
    'CIRCLE_SANCTUARY', 'FARM_SANCTUARY', 'FLOWER_BEDS', 'GRID_SANCTUARY', 'PARK_SANCTUARY', 'PROCEDURAL_SANCTUARY'
  ]);
  const ss = new FakeSpreadsheet();
  gs.handleSeedDatabase(ss, null);
  assert.ok(ss.getSheetByName('CONFIG'));
  assert.ok(ss.getSheetByName('LOGS'));
  assert.ok(ss.getSheetByName('PLAYERS'));

  let expectedId = 0;
  for (const key of gs.ZONE_TEMPLATE_ORDER) {
    expectedId++;
    const res = gs.createZoneFromTemplate(ss, `Vung ${key}`, key, 0);
    assert.equal(res.zoneId, expectedId);
    assert.equal(res.template, key);
    assert.equal(res.count, gs.ZONE_TEMPLATES[key].questionCount);
    const quest = ss.getSheetByName(res.sheetName)!;
    assert.equal(quest.rows.length, res.count + 1);
  }

  const config = ss.getSheetByName('CONFIG')!;
  const headers = config.rows[0];
  const templateCol = headers.indexOf('Template');
  assert.deepEqual(config.rows.slice(1).map((r) => r[templateCol]), [...gs.ZONE_TEMPLATE_ORDER]);

  const custom = gs.createZoneFromTemplate(ss, 'Nong Trai', 'FARM_SANCTUARY', 12);
  assert.equal(custom.count, 12);
  assert.equal(config.rows[config.rows.length - 1][headers.indexOf('QuestionCount')], 12);
});

test('handleSeedDatabase không xóa vùng đất đã có', () => {
  const gs = loadScript();
  const ss = new FakeSpreadsheet();
  gs.handleSeedDatabase(ss, null);
  gs.createZoneFromTemplate(ss, 'Giu Lai', 'GRID_SANCTUARY', 0);
  const before = ss.getSheetByName('CONFIG')!.rows.length;
  gs.handleSeedDatabase(ss, null);
  assert.equal(ss.getSheetByName('CONFIG')!.rows.length, before);
});
