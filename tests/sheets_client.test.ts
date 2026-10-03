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
  getAppsScriptUrl
} from '../src/core/sheetsClient';

test('computeProceduralEntityPositions generates accurate coordinates for all 3 templates', () => {
  const center = { x: 100, z: 50 };

  // 1. CIRCLE_SANCTUARY
  const circlePos = computeProceduralEntityPositions('CIRCLE_SANCTUARY', 4, center, 20, 20);
  assert.equal(circlePos.length, 4);
  // Tất cả các điểm phải nằm trên vành hồ quanh bán kính LAKE_MONOLITH_RADIUS (14.4m)
  circlePos.forEach((p) => {
    const dist = Math.hypot(p.x - center.x, p.z - center.z);
    assert.ok(dist >= 14 && dist <= 15, `Distance ${dist} should be near lake monolith radius 14.4`);
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
  gridPos.forEach((p) => {
    const dist = Math.hypot(p.x - center.x, p.z - center.z);
    assert.ok(dist >= 14 && dist <= 15, `Distance ${dist} should be near lake monolith radius 14.4`);
  });
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

  // Toàn bộ câu hỏi được nạp động từ Google Sheets (questionsBySheet ban đầu rỗng)
  assert.deepEqual(fallback.questionsBySheet, {});
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
      position: { x: 50, z: 65.5 }, // Tọa độ thủ công hợp lệ trên vành hồ (d = 15.5m)
      steps: []
    },
    {
      id: 2,
      title: 'Bài 2',
      subtitle: '',
      position: null, // Chưa có tọa độ -> cần tự tính
      steps: []
    },
    {
      id: 3,
      title: 'Bài 3',
      subtitle: '',
      position: { x: 999, z: 888 }, // Tọa độ sai lệch (nằm ngoài vành hồ) -> tự sửa lại
      steps: []
    }
  ];

  const resolved = resolveZoneProblemsWithPositions(zone, problems);
  assert.equal(resolved.length, 3);
  // Bài 1 giữ nguyên tọa độ thủ công hợp lệ
  assert.deepEqual(resolved[0].position, { x: 50, z: 65.5 });
  // Bài 2 được cấp tọa độ sinh theo template
  assert.ok(resolved[1].position !== null);
  assert.equal(resolved[1].zoneId, 1);
  // Bài 3 có tọa độ sai lệch được tự sửa lại trên vành hồ hợp lệ
  assert.ok(resolved[2].position !== null);
  const dist3 = Math.hypot(resolved[2].position!.x - 50, resolved[2].position!.z - 50);
  assert.ok(dist3 >= 14 && dist3 <= 17.5, `Auto-repaired position must be on shore ring, got ${dist3}`);
});

test('ExplorerProfile persistence and immutable AppsScriptUrl', () => {
  assert.ok(getAppsScriptUrl().startsWith('https://script.google.com/macros/s/'));

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

test('sanitizeRemoteProblems resolves Google Drive links, Base64, and extracts markdown images', () => {
  const problems = [
    {
      id: 201,
      title: 'Bài 201: Hình học',
      steps: [
        {
          stepId: '201_1',
          prompt: 'Đếm hình: ![Hình vẽ](https://example.com/shape.png) Có bao nhiêu hình vuông?',
          imageUrl: 'https://drive.google.com/file/d/DRIVE_123456/view?usp=sharing',
          options: ['4', '5'],
          answer: '5',
          explanation: 'Quan sát: ![Lời giải](https://drive.google.com/open?id=DRIVE_EXPLAIN_789) Ta thấy có 5 hình vuông.',
          explanationImageUrl: ''
        },
        {
          stepId: '201_2',
          prompt: 'Quan sát hình: ![Đoạn thẳng](https://example.com/line.png)',
          options: ['2', '3'],
          answer: '3',
          explanation: 'Có 3 đoạn thẳng.'
        }
      ]
    }
  ];

  const sanitized = sanitizeRemoteProblems(problems);
  assert.equal(sanitized.length, 1);
  const s1 = sanitized[0].steps[0];
  // Direct imageUrl takes precedence and converts Google Drive share link
  assert.equal(s1.imageUrl, 'https://lh3.googleusercontent.com/d/DRIVE_123456');
  // ExplanationImageUrl extracted from markdown in explanation and converts Google Drive link
  assert.equal(s1.explanationImageUrl, 'https://lh3.googleusercontent.com/d/DRIVE_EXPLAIN_789');
  assert.equal(s1.explanation, 'Quan sát: Ta thấy có 5 hình vuông.');

  const s2 = sanitized[0].steps[1];
  // When imageUrl is empty, extracted from markdown in prompt
  assert.equal(s2.imageUrl, 'https://example.com/line.png');
  assert.equal(s2.prompt, 'Quan sát hình:');
});
