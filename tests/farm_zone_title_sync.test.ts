import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpatialWorld } from '../src/world/SpatialWorld';
import { FarmSanctuary } from '../src/world/farm/FarmSanctuary';
import { ChallengeDialog } from '../src/quiz/ChallengeDialog';
import { Adventure } from '../src/core/adventure';
import type { ChallengePorts } from '../src/quiz/types';
import type { RemoteProblem, RemoteZoneConfig } from '../src/data/remoteTypes';
import { formatPortalOverlay } from '../src/world/loop/HudPresenter';
import { buildFarmPortalLinks } from '../src/world/World';

function setupMockDom() {
  const doc = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => ({
      classList: { add: () => {}, remove: () => {} },
      style: {},
      textContent: '',
      innerHTML: '',
      hidden: false,
      focus: () => {}
    }),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  (globalThis as any).document = doc;
}

function createMockFarmLibrary() {
  const mockLibrary = new THREE.Group();
  for (const name of [
    'chicken', 'chick', 'cow', 'calf', 'duck', 'duckling', 'pig', 'piglet', 'dog',
    'pen_fence', 'pen_gate', 'feed_trough', 'water_trough', 'coop', 'hay_bale',
    'chicken_shelter', 'duck_shelter', 'cow_shelter', 'pig_shelter', 'dog_shelter',
    'egg', 'milk', 'egg_basket', 'duck_egg', 'truffle'
  ]) {
    const node = new THREE.Group();
    node.name = name;
    mockLibrary.add(node);
  }
  return mockLibrary;
}

const farmZoneFromSheet: RemoteZoneConfig = {
  id: 8,
  name: 'Nông trại hỗn loạn',
  title: 'Khám Phá Nông trại hỗn loạn',
  description: 'Khu vực thử thách cửu chương (Nông trại giải cứu thú cưng)',
  template: 'FARM_SANCTUARY',
  theme: 'VILLAGE',
  decorDensity: 'MEDIUM',
  sheetName: 'Zone_8_NongTrai',
  center: { x: 0, z: 80 },
  width: 24,
  depth: 32,
  color: 8702998,
  colorHex: '#84cc16',
  badge: '🌟 Huy Hiệu Nông trại hỗn loạn',
  active: true,
  startAt: ''
};

test('SpatialWorld.getCurrentLocationName returns Google Sheets farm name everywhere in FARM_SANCTUARY at (0, 80)', () => {
  const spatial = new SpatialWorld();
  spatial.setDynamicData([farmZoneFromSheet]);

  // Arrival point (-8, 90), center (0, 80), east side (10, 80), outer pasture (0, 108)
  spatial.teleport(-8, 90);
  assert.equal(spatial.getCurrentLocationName(), 'Nông trại hỗn loạn');

  spatial.teleport(0, 80);
  assert.equal(spatial.getCurrentLocationName(), 'Nông trại hỗn loạn');

  spatial.teleport(10, 80);
  assert.equal(spatial.getCurrentLocationName(), 'Nông trại hỗn loạn');
  assert.equal(spatial.isInGarden(), false, 'Farm pasture at (10, 80) must not be treated as Vườn Hoa Tri Thức');

  spatial.teleport(0, 108);
  assert.equal(spatial.getCurrentLocationName(), 'Nông trại hỗn loạn');
});

test('Farm portal links and portal overlay label show Google Sheets farm name instead of park label', () => {
  const portals = buildFarmPortalLinks([farmZoneFromSheet]);
  const entrance = portals.find((p) => p.id === 'village_to_farm');
  const exit = portals.find((p) => p.id === 'z8_to_village_farm');

  assert.ok(entrance, 'Farm entrance portal should exist');
  assert.ok(exit, 'Farm return portal should exist');
  assert.match(entrance.name, /Nông trại hỗn loạn/);

  const entranceOverlay = formatPortalOverlay(entrance, false, '→');
  assert.match(entranceOverlay.portalLabelHtml, /Nông trại hỗn loạn/);
  assert.doesNotMatch(entranceOverlay.portalLabelHtml, /Công Viên Tri Thức/);
  assert.match(entranceOverlay.interactHtml, /Nông trại hỗn loạn/);

  const exitOverlay = formatPortalOverlay(exit, false, '→');
  assert.match(exitOverlay.portalLabelHtml, /Về Làng Khởi Đầu/);
  assert.doesNotMatch(exitOverlay.portalLabelHtml, /Công Viên Tri Thức/);
});

test('ChallengeDialog farm animal eyebrow uses Google Sheets zone name when provided', () => {
  setupMockDom();
  let opened: { title: string; body: string; kind: string } | null = null;
  const ports: ChallengePorts = {
    ui: {
      openDialog: (title, body, kind) => {
        opened = { title, body, kind };
      },
      closeDialog: () => {},
      toast: () => {},
      updateHUD: () => {}
    },
    audio: { playCue: () => {} },
    world: { burstPlayer: () => {}, getWorld: () => ({} as any) },
    adventure: new Adventure()
  };

  const dialog = new ChallengeDialog(ports);
  dialog.openFarmAnimal(
    'farm_cow_0',
    'Bò Sữa',
    {
      id: '224_1',
      title: 'Bài 4.1',
      subtitle: 'Tính',
      steps: [{ prompt: '18 : 3 + 28 : 4', options: [{ label: '13', value: '13' }], answer: '13' }]
    },
    0,
    farmZoneFromSheet.name
  );

  assert.ok(opened);
  const eyebrow = opened.body.match(/<div class="dialog-eyebrow">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(eyebrow, /NÔNG TRẠI HỖN LOẠN/);
  assert.doesNotMatch(eyebrow, /NÔNG TRẠI VUI VẺ/);
});

test('FarmSanctuary.syncQuestions updates animal problem titles when Google Sheets data refreshes', () => {
  const farm = new FarmSanctuary();
  const mockLibrary = createMockFarmLibrary();

  const initialQuestions: RemoteProblem[] = [
    {
      id: 'old_1',
      title: 'Tiêu đề cũ',
      steps: [{ stepId: 's1', prompt: '1+1', options: [{ label: '2', value: '2' }], answer: '2', hints: [], explanation: '' }]
    }
  ];
  farm.setupFromLibrary(mockLibrary, {}, initialQuestions);
  assert.equal(farm.getInteractTriggers()[0].problemData.title, 'Tiêu đề cũ');

  const freshQuestions: RemoteProblem[] = [
    {
      id: '224_1',
      title: 'Bài 4.1',
      subtitle: 'Tính',
      steps: [{ stepId: '224_1_1', prompt: '18 : 3 + 28 : 4', options: [{ label: '13', value: '13' }], answer: '13', hints: [], explanation: '' }]
    },
    {
      id: '224_2',
      title: 'Bài 4.2',
      subtitle: 'Tính',
      steps: [{ stepId: '224_2_1', prompt: '189 + 24 : 4', options: [{ label: '195', value: '195' }], answer: '195', hints: [], explanation: '' }]
    }
  ];
  farm.syncQuestions(freshQuestions);

  const triggers = farm.getInteractTriggers();
  assert.equal(triggers.length, 2);
  assert.equal(triggers[0].problemData.title, 'Bài 4.1');
  assert.equal(triggers[1].problemData.title, 'Bài 4.2');
});
