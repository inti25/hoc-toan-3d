import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HudPresenter } from '../src/world/loop/HudPresenter';
import type { HudPresentationState } from '../src/world/loop/types';

interface MockElement {
  id: string;
  textContent: string;
  innerHTML: string;
  hidden: boolean;
  style: { transform: string };
  classList: {
    classes: Set<string>;
    toggle(name: string, force?: boolean): boolean;
  };
  writeCounts: {
    textContent: number;
    innerHTML: number;
    hidden: number;
    transform: number;
    classList: number;
  };
}

function createMockElement(id: string): MockElement {
  const writeCounts = {
    textContent: 0,
    innerHTML: 0,
    hidden: 0,
    transform: 0,
    classList: 0
  };

  let _textContent = '';
  let _innerHTML = '';
  let _hidden = false;
  let _transform = '';
  const classes = new Set<string>();

  return {
    id,
    get textContent() {
      return _textContent;
    },
    set textContent(val: string) {
      writeCounts.textContent++;
      _textContent = val;
    },
    get innerHTML() {
      return _innerHTML;
    },
    set innerHTML(val: string) {
      writeCounts.innerHTML++;
      _innerHTML = val;
    },
    get hidden() {
      return _hidden;
    },
    set hidden(val: boolean) {
      writeCounts.hidden++;
      _hidden = val;
    },
    style: {
      get transform() {
        return _transform;
      },
      set transform(val: string) {
        writeCounts.transform++;
        _transform = val;
      }
    },
    classList: {
      classes,
      toggle(name: string, force?: boolean) {
        writeCounts.classList++;
        const shouldAdd = force !== undefined ? force : !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      }
    },
    writeCounts
  };
}

test('HudPresenter dirty checks text updates to prevent layout thrashing', () => {
  const elements = new Map<string, MockElement>();
  const getEl = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id));
    }
    return elements.get(id) as unknown as HTMLElement;
  };

  const presenter = new HudPresenter(getEl);

  const state1: HudPresentationState = {
    locName: 'Làng Khởi Đầu',
    subLabel: 'KHÁM PHÁ · HỌC HỎI',
    travelText: 'Đến Vườn Hoa',
    interactHtml: '<b>Nói chuyện với Milo</b>',
    interactHidden: false,
    isNearMilo: true,
    isNearPortal: false
  };

  presenter.render(state1);

  const villageStatus = elements.get('village-status-text')!;
  const areaLabel = elements.get('area-label-text')!;
  const areaSub = elements.get('area-label-sub')!;
  const travel = elements.get('travel-text')!;
  const interact = elements.get('interact')!;
  const miloLabel = elements.get('milo-label')!;

  assert.equal(villageStatus.textContent, 'Làng Khởi Đầu');
  assert.equal(villageStatus.writeCounts.textContent, 1);
  assert.equal(areaLabel.writeCounts.textContent, 1);
  assert.equal(areaSub.textContent, 'KHÁM PHÁ · HỌC HỎI');
  assert.equal(areaSub.writeCounts.textContent, 1);
  assert.equal(travel.textContent, 'Đến Vườn Hoa');
  assert.equal(travel.writeCounts.textContent, 1);
  assert.equal(interact.innerHTML, '<b>Nói chuyện với Milo</b>');
  assert.equal(interact.writeCounts.innerHTML, 1);
  assert.equal(interact.hidden, false);
  assert.equal(miloLabel.classList.classes.has('near'), true);

  // Render identical state again (simulating 60fps frames with stationary player)
  presenter.render(state1);

  // Writes must be suppressed (0 additional DOM writes)
  assert.equal(villageStatus.writeCounts.textContent, 1, 'villageStatus should not be re-written');
  assert.equal(areaLabel.writeCounts.textContent, 1, 'areaLabel should not be re-written');
  assert.equal(areaSub.writeCounts.textContent, 1, 'areaSub should not be re-written');
  assert.equal(travel.writeCounts.textContent, 1, 'travel should not be re-written');
  assert.equal(interact.writeCounts.innerHTML, 1, 'interactHtml should not be re-written');
  assert.equal(interact.writeCounts.hidden, 1, 'interactHidden should not be re-written');
  assert.equal(miloLabel.writeCounts.classList, 1, 'classList should not be re-written');
});

test('HudPresenter suppresses 3D label transforms when position delta < 0.5px threshold', () => {
  const elements = new Map<string, MockElement>();
  const getEl = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id));
    }
    return elements.get(id) as unknown as HTMLElement;
  };

  const presenter = new HudPresenter(getEl);

  const baseState: HudPresentationState = {
    locName: 'Làng Khởi Đầu',
    subLabel: '',
    travelText: '',
    interactHtml: '',
    interactHidden: true,
    isNearMilo: false,
    isNearPortal: false,
    miloPose: { x: 300, y: 400, visible: true }
  };

  presenter.render(baseState);
  const miloEl = elements.get('milo-label')!;
  assert.equal(miloEl.writeCounts.transform, 1);
  assert.equal(miloEl.style.transform, 'translate(300px,400px) translate(-50%,-100%)');

  // Sub-pixel jitter: moved by 0.3px in X, 0.2px in Y (distance = sqrt(0.09 + 0.04) = 0.36px < 0.5px)
  presenter.render({
    ...baseState,
    miloPose: { x: 300.3, y: 400.2, visible: true }
  });

  // Transform write must be suppressed!
  assert.equal(
    miloEl.writeCounts.transform,
    1,
    'Sub-pixel movement under 0.5px must be suppressed to avoid layout thrashing'
  );

  // Significant movement: moved by 1.2px
  presenter.render({
    ...baseState,
    miloPose: { x: 301.5, y: 400, visible: true }
  });

  assert.equal(miloEl.writeCounts.transform, 2, 'Movement >= 0.5px must trigger transform update');
  assert.equal(miloEl.style.transform, 'translate(301.5px,400px) translate(-50%,-100%)');
});

test('HudPresenter reset() clears caches and allows re-application of values', () => {
  const elements = new Map<string, MockElement>();
  const getEl = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id));
    }
    return elements.get(id) as unknown as HTMLElement;
  };

  const presenter = new HudPresenter(getEl);

  const state: HudPresentationState = {
    locName: 'Vườn Hoa Tri Thức',
    subLabel: '10 THỬ THÁCH',
    travelText: 'Đến Đền Cổng',
    interactHtml: 'Cây Hoa',
    interactHidden: false,
    isNearMilo: false,
    isNearPortal: false
  };

  presenter.render(state);
  const villageStatus = elements.get('village-status-text')!;
  assert.equal(villageStatus.writeCounts.textContent, 1);

  presenter.reset();

  // Rendering identical state after reset should write again because memo cache is cleared
  presenter.render(state);
  assert.equal(villageStatus.writeCounts.textContent, 2, 'Render after reset must re-apply values');
});

test('HudPresenter.renderSnapshot formats portal, Milo, and pause-hidden states from WorldFrameSnapshot', () => {
  const elements = new Map<string, MockElement>();
  const getEl = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id));
    }
    return elements.get(id) as unknown as HTMLElement;
  };

  const presenter = new HudPresenter(getEl);

  // 1. Near Milo in Starter Village
  presenter.renderSnapshot(
    {
      active: true,
      paused: false,
      fps: 60,
      playerPosition: { x: -4, z: 2 },
      locationName: 'Làng Khởi Đầu',
      inGarden: false,
      inArchimedes: false,
      nearMilo: true,
      crossedRiver: false,
      nearFlowerIndex: -1,
      nearMonolithIndex: -1,
      nearParkTreeIndex: -1,
      nearShop: false,
      nearFarmAnimalId: null,
      nearPortal: null,
      portalTransit: null,
      hudPoses: {
        miloPose: { x: 100, y: 120, visible: true },
        bridgePose: { x: 200, y: 150, visible: true },
        portalPose: { x: 300, y: 180, visible: false }
      }
    },
    { subLabel: 'KHÁM PHÁ', arrowHtml: '→' }
  );

  assert.equal(elements.get('travel-text')!.textContent, 'Đến Vườn Hoa');
  assert.equal(elements.get('interact')!.hidden, false);
  assert.ok(elements.get('interact')!.innerHTML.includes('Nói chuyện với Milo'));
  assert.equal(elements.get('bridge-label')!.hidden, false);
  assert.equal(elements.get('portal-label')!.hidden, true);

  // 2. Paused near farm portal -> hides interact & floating labels
  presenter.renderSnapshot(
    {
      active: true,
      paused: true,
      fps: 60,
      playerPosition: { x: -8, z: 14 },
      locationName: 'Làng Khởi Đầu',
      inGarden: false,
      inArchimedes: false,
      nearMilo: false,
      crossedRiver: false,
      nearFlowerIndex: -1,
      nearMonolithIndex: -1,
      nearParkTreeIndex: -1,
      nearShop: false,
      nearFarmAnimalId: null,
      nearPortal: { id: 'village_to_farm', name: 'Nông Trại Vui Vẻ' },
      portalTransit: null
    },
    { subLabel: 'KHÁM PHÁ', arrowHtml: '→' }
  );

  assert.equal(elements.get('interact')!.hidden, true);
  assert.equal(elements.get('bridge-label')!.hidden, true);
  assert.equal(elements.get('portal-label')!.hidden, true);
});

test('HudPresenter hides milo-label and bridge-label on other lands even when camera projects origin into view', () => {
  const elements = new Map<string, MockElement>();
  const getEl = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id));
    }
    return elements.get(id) as unknown as HTMLElement;
  };
  const presenter = new HudPresenter(getEl);

  // Player in Starter Village -> both labels visible
  presenter.renderSnapshot(
    {
      active: true,
      paused: false,
      fps: 60,
      playerPosition: { x: -6, z: 6 },
      activeRegionId: 'core',
      locationName: 'Làng Khởi Đầu',
      inGarden: false,
      inArchimedes: false,
      nearMilo: false,
      crossedRiver: false,
      nearFlowerIndex: -1,
      nearMonolithIndex: -1,
      nearParkTreeIndex: -1,
      nearShop: false,
      nearFarmAnimalId: null,
      nearPortal: null,
      portalTransit: null,
      hudPoses: {
        miloPose: { x: 400, y: 300, visible: true },
        bridgePose: { x: 700, y: 320, visible: true },
        portalPose: { x: 0, y: 0, visible: false }
      }
    },
    { subLabel: 'KHÁM PHÁ', arrowHtml: '→' }
  );
  assert.equal(elements.get('milo-label')!.hidden, false);
  assert.equal(elements.get('bridge-label')!.hidden, false);

  // Player moves to QHMJ / Park / Farm (even with x <= 35 and hudPoses visible=true toward origin)
  for (const land of [
    { activeRegionId: 'zone:8', locationName: 'Con Đường Bậc Thang', x: -400, z: -400 },
    { activeRegionId: 'zone:7', locationName: 'Công Viên Xanh', x: -45, z: 0 },
    { activeRegionId: 'zone:9', locationName: 'Nông Trại Vui Vẻ', x: -10, z: 60 }
  ]) {
    presenter.renderSnapshot(
      {
        active: true,
        paused: false,
        fps: 60,
        playerPosition: { x: land.x, z: land.z },
        activeRegionId: land.activeRegionId,
        locationName: land.locationName,
        inGarden: false,
        inArchimedes: false,
        nearMilo: false,
        crossedRiver: false,
        nearFlowerIndex: -1,
        nearMonolithIndex: -1,
        nearParkTreeIndex: -1,
        nearShop: false,
        nearFarmAnimalId: null,
        nearPortal: null,
        portalTransit: null,
        hudPoses: {
          miloPose: { x: 500, y: 300, visible: true },
          bridgePose: { x: 600, y: 310, visible: true },
          portalPose: { x: 0, y: 0, visible: false }
        }
      },
      { subLabel: 'KHÁM PHÁ', arrowHtml: '→' }
    );
    assert.equal(elements.get('milo-label')!.hidden, true, `${land.locationName}: milo-label must be hidden`);
    assert.equal(elements.get('bridge-label')!.hidden, true, `${land.locationName}: bridge-label must be hidden`);
  }
});
