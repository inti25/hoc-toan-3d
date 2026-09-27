import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProceduralEntityPositions,
  type RemoteZoneConfig,
  type RemoteProblem
} from '../src/data/remoteTypes';
import {
  getBundledFallbackData,
  sanitizeRemoteProblems,
  resolveZoneProblemsWithPositions,
  saveExplorerProfile,
  getExplorerProfile,
  setAppsScriptUrl,
  getAppsScriptUrl
} from '../src/core/sheetsClient';

test('computeProceduralEntityPositions generates accurate coordinates for all 3 templates', () => {
  const center = { x: 100, z: 50 };

  // 1. CIRCLE_SANCTUARY
  const circlePos = computeProceduralEntityPositions('CIRCLE_SANCTUARY', 4, center, 20, 20);
  assert.equal(circlePos.length, 4);
  // Tất cả các điểm phải nằm cách tâm một khoảng xấp xỉ bán kính
  circlePos.forEach((p) => {
    const dist = Math.hypot(p.x - center.x, p.z - center.z);
    assert.ok(dist >= 5 && dist <= 8, `Distance ${dist} should be near radius 6.5`);
  });

  // 2. FLOWER_BEDS
  const flowerPos = computeProceduralEntityPositions('FLOWER_BEDS', 6, center, 30, 20);
  assert.equal(flowerPos.length, 6);
  // 3 điểm ở nửa trên (z < center.z), 3 điểm ở nửa dưới (z > center.z)
  const topRows = flowerPos.filter((p) => p.z < center.z);
  const bottomRows = flowerPos.filter((p) => p.z > center.z);
  assert.equal(topRows.length, 3);
  assert.equal(bottomRows.length, 3);

  // 3. GRID_SANCTUARY
  const gridPos = computeProceduralEntityPositions('GRID_SANCTUARY', 8, center, 30, 20);
  assert.equal(gridPos.length, 8);
  const row1 = gridPos.filter((p) => p.z < center.z);
  const row2 = gridPos.filter((p) => p.z > center.z);
  assert.equal(row1.length, 4);
  assert.equal(row2.length, 4);
});

test('sanitizeRemoteProblems cleanses whitespace, auto-repairs missing answers in options, and parses hints', () => {
  const dirtyData = [
    {
      id: ' 101 ',
      title: '  Bài 101: Đo lường  ',
      subtitle: ' Tính lít ',
      steps: [
        {
          stepId: ' step_1 ',
          prompt: ' 500L - 200L = ? ',
          options: [' 100L ', ' 200L '], // Thiếu đáp án đúng '300L' trong options
          answer: ' 300L ',
          hints: 'Gợi ý 1 | Gợi ý 2; Gợi ý 3',
          explanation: ' Lấy 500 trừ 200 '
        }
      ]
    },
    // Row hoàn toàn rỗng phải bị loại bỏ an toàn
    { id: '', steps: [] },
    null
  ];

  const sanitized = sanitizeRemoteProblems(dirtyData);
  assert.equal(sanitized.length, 1);

  const prob = sanitized[0];
  assert.equal(prob.id, ' 101 ');
  assert.equal(prob.title, 'Bài 101: Đo lường');
  assert.equal(prob.subtitle, 'Tính lít');

  const step = prob.steps[0];
  assert.equal(step.prompt, '500L - 200L = ?');
  assert.equal(step.answer, '300L');
  // Đáp án đúng '300L' phải được tự động bổ sung vào options
  assert.ok(step.options.some((o) => o.value === '300L'));
  // Hints phải được tách thành 3 phần tử
  assert.equal(step.hints.length, 3);
  assert.deepEqual(step.hints, ['Gợi ý 1', 'Gợi ý 2', 'Gợi ý 3']);
});

test('getBundledFallbackData provides complete fallback for 5 Archimedes zones + Flower Garden', () => {
  const fallback = getBundledFallbackData();
  assert.ok(fallback.zones.length >= 6);

  const flowerZone = fallback.zones.find((z) => z.id === 6);
  assert.ok(flowerZone);
  assert.equal(flowerZone.template, 'FLOWER_BEDS');

  // Kiểm tra các bài toán của Flower Garden
  const flowerQuestions = fallback.questionsBySheet['VuonHoa'];
  assert.equal(flowerQuestions.length, 10);
});

test('resolveZoneProblemsWithPositions preserves explicit coordinates and computes procedural ones', () => {
  const zone: RemoteZoneConfig = {
    id: 1,
    name: 'Khu Thử Nghiệm',
    title: 'Tiêu đề',
    description: 'Mô tả',
    template: 'GRID_SANCTUARY',
    sheetName: 'Zone_Test',
    center: { x: 50, z: 50 },
    width: 24,
    depth: 32,
    color: 0x38bdf8,
    colorHex: '#38bdf8',
    badge: '🏆'
  };

  const problems: RemoteProblem[] = [
    {
      id: 1,
      title: 'Bài 1',
      subtitle: '',
      position: { x: 999, z: 888 }, // Tọa độ thủ công cố định
      steps: []
    },
    {
      id: 2,
      title: 'Bài 2',
      subtitle: '',
      position: null, // Chưa có tọa độ -> cần tự tính
      steps: []
    }
  ];

  const resolved = resolveZoneProblemsWithPositions(zone, problems);
  assert.equal(resolved.length, 2);
  // Bài 1 giữ nguyên tọa độ thủ công
  assert.deepEqual(resolved[0].position, { x: 999, z: 888 });
  // Bài 2 được cấp tọa độ sinh theo template
  assert.ok(resolved[1].position !== null);
  assert.ok(resolved[1].position!.x !== 999);
  assert.equal(resolved[1].zoneId, 1);
});

test('ExplorerProfile and AppsScriptUrl persistence roundtrip', () => {
  setAppsScriptUrl('https://script.google.com/macros/s/test-url/exec');
  assert.equal(getAppsScriptUrl(), 'https://script.google.com/macros/s/test-url/exec');

  saveExplorerProfile({
    nickname: 'Bé Minh Anh',
    className: '2A1 Archimedes',
    isAnonymous: false
  });

  const profile = getExplorerProfile();
  assert.equal(profile.nickname, 'Bé Minh Anh');
  assert.equal(profile.className, '2A1 Archimedes');
  assert.equal(profile.isAnonymous, false);
});
