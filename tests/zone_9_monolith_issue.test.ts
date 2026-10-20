import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GeometryBuilder } from '../src/world/geom';
import { ArchimedesZoneBuilder, type Obstacle } from '../src/world/ArchimedesZoneBuilder';
import { Adventure } from '../src/core/adventure';
import { freshState } from '../src/core/state';
import { resolveZoneProblemsWithPositions } from '../src/core/sheetsClient';
import type { RemoteZoneConfig, RemoteProblem } from '../src/data/remoteTypes';

test('Zone 9: all crystal columns must appear on map and unsolved 222_1 must not be lit up', () => {
  // Setup Zone 9 configuration
  const zone9: RemoteZoneConfig = {
    id: 9,
    name: 'Mỏ Pha Lê',
    title: 'Khám Phá Mỏ Pha Lê',
    description: 'Vùng thử thách cửu chương',
    template: 'GRID_SANCTUARY',
    theme: 'CRYSTAL',
    decorDensity: 'MEDIUM',
    sheetName: 'Zone_9_MoPhaLe',
    center: { x: 120, z: -100 },
    width: 24,
    depth: 32,
    color: 0xa855f7,
    colorHex: '#a855f7',
    badge: '💎 Huy Hiệu Pha Lê',
    active: true,
    startAt: ''
  };

  // Questions in Zone 9 including 222_1, 222_2, 222_3
  const rawQuestions: RemoteProblem[] = [
    {
      id: '222_1',
      title: 'Bài 1',
      steps: [
        {
          stepId: '222_1_1',
          prompt: '7 × 8 = ?',
          options: [{ label: '56', value: '56' }, { label: '54', value: '54' }],
          answer: '56',
          hints: ['7 x 8 = 56'],
          explanation: '7 x 8 = 56'
        }
      ]
    },
    {
      id: '222_2',
      title: 'Bài 2',
      steps: [
        {
          stepId: '222_2_1',
          prompt: '7 × 9 = ?',
          options: [{ label: '63', value: '63' }, { label: '62', value: '62' }],
          answer: '63',
          hints: ['7 x 9 = 63'],
          explanation: '7 x 9 = 63'
        }
      ]
    },
    {
      id: '222_3',
      title: 'Bài 3',
      steps: [
        {
          stepId: '222_3_1',
          prompt: '8 × 8 = ?',
          options: [{ label: '64', value: '64' }, { label: '65', value: '65' }],
          answer: '64',
          hints: ['8 x 8 = 64'],
          explanation: '8 x 8 = 64'
        }
      ]
    }
  ];

  const resolved = resolveZoneProblemsWithPositions(zone9, rawQuestions);
  assert.equal(resolved.length, 3);

  // Player state: player has some previous progress in legacy monoliths (e.g. monoliths[0] = true),
  // but has NEVER solved problem 222_1
  const state = freshState();
  state.monoliths[0] = true; // Legacy monolith 0 was solved in an earlier zone
  const adventure = new Adventure(state);

  assert.equal(adventure.isProblemSolved('222_1'), false, 'Problem 222_1 is NOT solved');
  assert.equal(adventure.isProblemSolved('222_2'), false, 'Problem 222_2 is NOT solved');
  assert.equal(adventure.isProblemSolved('222_3'), false, 'Problem 222_3 is NOT solved');

  const scene = new THREE.Scene();
  const geom = new GeometryBuilder();
  const obstacles: Obstacle[] = [];
  const zoneBuilder = new ArchimedesZoneBuilder(scene, geom, obstacles);

  // Positioned monoliths payload as passed in World.renderDynamicZones
  const positionedMonoliths = resolved.map((p) => ({
    id: p.id,
    position: p.position!,
    color: p.color,
    title: p.title
  }));

  // Use the updated entity creation logic from World.ts
  const existingIds = new Set(zoneBuilder.monoliths.map((m) => String(m.id)));
  positionedMonoliths.forEach((pm) => {
    if (!pm.position || pm.id === undefined || pm.id === null) return;
    const strId = String(pm.id);
    if (!existingIds.has(strId)) {
      zoneBuilder.createMonolithEntity(pm.id, pm.position.x, pm.position.z, pm.color || 0x38bdf8, pm.title);
      existingIds.add(strId);
    }
  });

  // Check 1: ALL 3 crystal columns must be created on map
  assert.equal(
    zoneBuilder.monoliths.length,
    3,
    `Expected 3 crystal columns on map, but got ${zoneBuilder.monoliths.length}`
  );

  // Check 2: Problem IDs must be preserved as '222_1', '222_2', '222_3'
  assert.equal(String(zoneBuilder.monoliths[0].id), '222_1');
  assert.equal(String(zoneBuilder.monoliths[1].id), '222_2');
  assert.equal(String(zoneBuilder.monoliths[2].id), '222_3');

  // Sync activation state using fixed adventure logic (as in main.ts)
  const currentState = adventure.getState();
  zoneBuilder.setMonolithsActivated((id, index) => {
    return (
      adventure.isProblemSolved(id) ||
      (typeof id === 'number' && id >= 306 && id < 306 + currentState.monoliths.length && currentState.monoliths[id - 306] === true)
    );
  });

  // Check 3: 222_1 MUST NOT be lit up (activated) because it has not been solved!
  assert.equal(
    zoneBuilder.monoliths[0].activated,
    false,
    'Problem 222_1 must NOT be glowing/activated because it was not solved!'
  );
  assert.equal(
    zoneBuilder.monoliths[0].beam?.visible,
    false,
    'Beam of 222_1 must be hidden'
  );

  // Check 4: When 222_1 is actually solved later, it lights up properly!
  adventure.activateMonolith(0, '222_1', 9);
  assert.equal(adventure.isProblemSolved('222_1'), true, 'Problem 222_1 should now be solved');

  zoneBuilder.setMonolithsActivated((id, index) => {
    return (
      adventure.isProblemSolved(id) ||
      (typeof id === 'number' && id >= 306 && id < 306 + adventure.getState().monoliths.length && adventure.getState().monoliths[id - 306] === true)
    );
  });

  assert.equal(
    zoneBuilder.monoliths[0].activated,
    true,
    'Problem 222_1 must now be glowing/activated after being solved!'
  );
  assert.equal(
    zoneBuilder.monoliths[0].beam?.visible,
    true,
    'Beam of 222_1 must now be visible after being solved'
  );
  // Unsolved 222_2 and 222_3 remain unlit
  assert.equal(zoneBuilder.monoliths[1].activated, false);
  assert.equal(zoneBuilder.monoliths[2].activated, false);
});

test('ChallengeDialog correctly resolves problem 222_1 and does not mark it as done prematurely', async () => {
  const { ChallengeDialog } = await import('../src/quiz/ChallengeDialog');
  const elements: Record<string, any> = {};
  (globalThis as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: (id: string) =>
      elements[id] || {
        classList: { add: () => {}, remove: () => {} },
        style: {},
        textContent: '',
        innerHTML: '',
        hidden: false,
        focus: () => {}
      },
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const state = freshState();
  state.monoliths[0] = true; // Legacy monolith 0 completed
  const adventure = new Adventure(state);

  let openedTitle = '';
  let openedBody = '';
  const dialog = new ChallengeDialog({
    adventure,
    openDialog: (title, body) => {
      openedTitle = title;
      openedBody = body;
    },
    closeDialog: () => {}
  });

  const rawProblem: RemoteProblem = {
    id: '222_1',
    title: 'Phép Nhân Pha Lê',
    steps: [
      {
        stepId: '222_1_1',
        prompt: '9 × 6 = ?',
        options: [{ label: '54', value: '54' }, { label: '56', value: '56' }],
        answer: '54',
        hints: ['9 x 6 = 54'],
        explanation: '9 x 6 = 54'
      }
    ]
  };

  dialog.startChallenge({
    type: 'archimedes',
    monolithRef: '222_1',
    questionsBySheet: {
      Zone_9_MoPhaLe: [rawProblem]
    },
    zones: [
      {
        id: 9,
        name: 'Mỏ Pha Lê',
        title: 'Mỏ Pha Lê',
        template: 'GRID_SANCTUARY',
        theme: 'CRYSTAL',
        sheetName: 'Zone_9_MoPhaLe',
        center: { x: 100, z: 100 },
        width: 24,
        depth: 32,
        color: 0xa855f7,
        colorHex: '#a855f7',
        badge: '💎 Huy Hiệu',
        active: true
      }
    ],
    monolithProblems: [rawProblem]
  });

  // Verify that the dialog opened for the actual problem
  assert.equal(openedTitle, 'Bia Đá #222_1: Phép Nhân Pha Lê');
  // It must show that the monolith is waiting to be solved, NOT already lit/activated
  assert.equal(openedBody.includes('🔒 Bia đá đang đợi bạn giải câu đố'), true, 'Should indicate monolith is waiting to be solved');
  assert.equal(openedBody.includes('✨ Bia đá này đã được bạn thắp sáng'), false, 'Should NOT be marked as already lit/activated');
  assert.equal(openedBody.includes('9 × 6 = ?'), true, 'Should render question prompt');
});

