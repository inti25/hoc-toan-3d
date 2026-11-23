import './style.css';
import type { WorldHandle } from './boot/types';
import { WorldSession, classifyZoneTemplate } from './boot/WorldSession';
import { HudPresenter } from './world/loop/HudPresenter';
import type { WorldFrameSnapshot } from './world/loop/types';
import { Adventure, generateFarmMultiplicationProblem, getArchimedesSolvedCount } from './core/adventure';
import { generateQhmjProblems } from './core/qhmjQuestions';
import { qhmjZoneSpawn } from './data/qhmjMap';
import { farmZoneSpawn } from './data/farmMap';
import { qhmjProgressKey } from './world/qhmj/QhmjLayout';
import { BRIDGE_PARTS, LEVEL_XP, TABLES, getLevel, getLevelTitle, type Table } from './data/config';
import { getProduceForAnimalKind } from './data/shopCatalog';
import { CHARACTERS, DEFAULT_AVATAR_ID, getCharacter } from './data/characters';
import { ARCHIMEDES_ZONES } from './data/archimedesTrialMap';
import { FLOWER_COORDS } from './world/SpatialWorld';
import { AudioManager } from './audio/audio';
import {
  getAppsScriptUrl,
  getExplorerProfile,
  saveExplorerProfile,
  logRemoteProgress,
  seedRemoteDatabase,
  getBundledFallbackData,
  loadPlayerProgressFromSheets
} from './core/sheetsClient';
import { normalizePasscode, defaultStorage, profileManager } from './core/profile';
import { sanitizeSaveState, todayDateKey } from './core/state';
import {
  SyncManager,
  formatTimeAgo,
  getSyncStatusLabel,
  runLocalStorageMigration
} from './core/SyncManager';
import { computeProceduralEntityPositions, type RemoteZoneConfig, type RemotePlayerProgress } from './data/remoteTypes';
import { ChallengeDialog, icon } from './quiz/ChallengeDialog';
import { initPWA, isStandalone, canInstallPWA, promptInstallPWA } from './pwa';
import { ShopModal } from './ui/ShopModal';
import { ScreenStack } from './ui/ScreenStack';
import { FarmTrackerHud } from './ui/FarmTrackerHud';
import {
  getFarmAnimalEmoji,
  getFarmAnimalVietnameseName,
  type FarmAnimalTrackerSource
} from './world/farm/FarmGuidance';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const adventure = new Adventure();

let lastSavedPos = { x: -6, z: 6 };
let savePositionTimer: number | undefined;

const syncManager = new SyncManager(adventure, profileManager, {
  getMonolithCount: (s) => getArchimedesSolvedCount(s, worldSession.monolithProblems)
});
const audio = new AudioManager();
const worldSession: WorldSession = new WorldSession({
  adventure,
  onSyncQueue: (isMilestone) => syncManager.queueSync(isMilestone),
  onContentUpdated: () => updateHUD(),
  onDeferredSpawn: (safe) => {
    lastSavedPos = safe;
  }
});
const hudPresenter = new HudPresenter();
let world: WorldHandle | null = null;

let mode: 'bridge' | 'practice' = 'bridge';
let currentDialog = '';
let toastTimer = 0;
let near = false;
let nearFlower = -1;
let nearPortal = false;
let nearMonolith = -1;
let nearParkTree = -1;
let nearShop = false;
let nearFarmAnimalId: string | null = null;
let nearQhmjNode = -1;

function queueSavePosition(x: number, z: number, immediate = false, y?: number) {
  if (!adventure.getState().started) return;
  const distSq = (x - lastSavedPos.x) ** 2 + (z - lastSavedPos.z) ** 2;
  if (!immediate && distSq < 0.05) return;

  const isInQhmj = Boolean(world?.getActiveRegionId?.().startsWith('zone:') &&
    worldSession.zones.some((zn) => `zone:${zn.id}` === world?.getActiveRegionId?.() && classifyZoneTemplate(zn) === 'qhmj'));
  const saveY = isInQhmj ? (y ?? world?.player.position.y) : undefined;

  if (immediate) {
    if (savePositionTimer) clearTimeout(savePositionTimer);
    lastSavedPos = { x, z };
    adventure.savePosition(x, z, saveY);
    return;
  }

  if (savePositionTimer) clearTimeout(savePositionTimer);
  savePositionTimer = window.setTimeout(() => {
    lastSavedPos = { x, z };
    adventure.savePosition(x, z, saveY);
  }, 1000);
}

const challengeDialog = new ChallengeDialog({
  ui: {
    openDialog: (title, body, kind) => openDialog(title, body, kind),
    closeDialog: () => closeDialog(),
    toast: (msg) => toast(msg),
    updateHUD: () => updateHUD(),
    onOpenMap: (zoneId) => openArchimedesMapDialog(zoneId)
  },
  audio: {
    playCue: (cue) => audio.playCue(cue)
  },
  world: {
    burstPlayer: () => world?.burstPlayer(1.0),
    getWorld: () => world! as any
  },
  adventure,
  telemetry: {
    logRemoteProgress
  }
});

const shopModal = new ShopModal({
  adventure,
  world: () => world as any,
  audio,
  updateHUD: () => updateHUD(),
  toast: (msg) => toast(msg),
  openDialog: (title, body, kind) => openDialog(title, body, kind),
  closeDialog: () => closeDialog()
});

function getThemeBadgeIcon(theme?: string): string {
  switch (theme) {
    case 'GARDEN': return '🌸';
    case 'FOREST': return '🌲';
    case 'CRYSTAL': return '💎';
    case 'VILLAGE': return '🏡';
    case 'RUINS':
    default:
      return '🏛️';
  }
}

const app = $('app');
app.innerHTML = `
  <main class="game-shell">
    <canvas id="world" aria-label="Làng Khởi Đầu và Vườn Hoa Tri Thức 3D. Di chuyển bằng WASD, phím mũi tên hoặc bánh xe điều khiển."></canvas>
    <div id="loading" class="loading"><div class="loading-logo-box"><img src="${import.meta.env.BASE_URL}icons/logo-ui.png" alt="Biểu Tượng Vương Quốc" class="loading-logo-img" /></div><strong id="loading-title">Đang mở cánh cổng…</strong><small id="loading-sub" class="loading-sub"></small></div>
    <header class="topbar">
      <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Vương Quốc Học Toán 3D"><span class="brand-mark"><img src="${import.meta.env.BASE_URL}icons/logo-ui.png" alt="Biểu Tượng Vương Quốc" class="brand-logo-img" /></span><span>VƯƠNG QUỐC<small>HỌC TOÁN <b>3D</b></small></span></a>
      <div class="top-right"><span class="village-status"><i id="status-dot"></i><span id="village-status-text">Làng Khởi Đầu</span></span><button id="cloud-status-btn" class="icon-button cloud-status-btn" title="Trạng thái đồng bộ đám mây" aria-label="Trạng thái đồng bộ đám mây"><span class="cloud-status-icon">${icon('cloud')}</span><i id="cloud-status-dot" class="cloud-status-dot idle"></i></button><button id="quest-btn" class="icon-button quest-toggle-btn" title="Nhật ký nhiệm vụ (J)" aria-label="Xem nhiệm vụ & tiến độ">${icon('flag')}</button><button id="sound" class="icon-button" title="Bật / tắt âm thanh" aria-label="Tắt âm thanh">${icon('sound')}</button><button id="settings" class="icon-button" title="Cài đặt" aria-label="Cài đặt">${icon('settings')}</button></div>
    </header>
    <section id="welcome" class="welcome">
      <div class="chapter"><span></span> MỘT CUỘC PHIÊU LƯU NHỎ</div>
      <h1>Vương Quốc<br><span>Học Toán</span><sup>3D</sup></h1>
      <p>Mỗi phép nhân, một điều kỳ diệu.<br>Cùng Milo xây cầu và khám phá Vườn Hoa Tri Thức!</p>
      <div class="choose-label">Chọn người bạn đồng hành</div>
      <div class="avatar-options" role="group" aria-label="Chọn nhân vật">${CHARACTERS.map(c =>
  `<button id="avatar-${c.id}" class="avatar-option" aria-pressed="${c.id === DEFAULT_AVATAR_ID}" data-avatar="${c.id}"><span>${c.emoji}</span>${c.label}</button>`
).join('')}</div>
      <div class="welcome-profile-inputs">
        <div class="welcome-input-col name-col">
          <label for="welcome-name" class="welcome-input-label">Tên dũng sĩ của bạn</label>
          <input id="welcome-name" class="welcome-input" type="text" maxlength="24" placeholder="Ví dụ: Minh Khôi..." autocomplete="off" />
        </div>
        <div class="welcome-input-col class-col">
          <label for="welcome-class" class="welcome-input-label">Lớp</label>
          <input id="welcome-class" class="welcome-input" type="text" maxlength="8" placeholder="Lớp 2" autocomplete="off" />
        </div>
      </div>
      <button id="play" class="primary play-button">Bắt đầu phiêu lưu ${icon('arrow')}</button>
      <button id="learn-welcome" class="text-button">${icon('book')} Khám phá bảng cửu chương</button>
      <button id="restore-welcome" class="text-button restore-welcome-btn">${icon('cloud')} Khôi phục bằng Mã Thám Hiểm</button>
      <div class="welcome-notes"><span>✦ Học qua những chuyến đi</span><span>Không giới hạn thời gian</span></div>
    </section>
    <div id="world-caption" class="world-caption"><span>01</span><div>Làng Khởi Đầu<small>Bảng cửu chương ×1 – ×10 & Vườn Hoa</small></div></div>
    <div id="hud" class="hud" hidden>
      <div class="player-card" title="Chạm để mở Cài đặt & Hồ sơ">
        <span id="avatar-face" class="avatar-face">${CHARACTERS[0].emoji}</span>
        <div class="player-info">
          <strong id="player-name" class="player-name">Dũng Sĩ Tí Hon</strong>
          <div class="player-meta">
            <span id="player-title" class="player-title">Nhà thám hiểm</span>
            <span id="level" class="level-badge" title="Cấp độ hiện tại">1</span>
          </div>
          <div class="xp-track" role="progressbar" aria-label="Tiến độ cấp độ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="xp-fill"></i></div>
          <small id="xp-text">0 / 100 XP</small>
        </div>
      </div>
      <div class="wallet interactive" id="wallet-btn" title="Chạm để mở Tiệm Tạp Hóa Vương Quốc 🛍️">${icon('coin')}<strong id="coins">0</strong><span>xu</span></div>
      <aside id="farm-tracker" class="farm-tracker" hidden aria-label="Theo dõi động vật nông trại">
        <div class="farm-tracker-top">
          <button id="farm-tracker-toggle" type="button" class="farm-tracker-toggle" aria-expanded="true" title="Thu gọn / mở rộng danh sách thú cưng">
            <div class="farm-compass-dial" aria-hidden="true">
              <svg id="farm-compass-arrow" class="farm-compass-arrow" viewBox="0 0 24 24" fill="none">
                <path d="M12 2.5L18.5 19L12 15.6L5.5 19L12 2.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="farm-tracker-target">
              <div class="farm-tracker-target-line">
                <span id="farm-target-name" class="farm-target-name">🐾 Đang tìm thú...</span>
                <span id="farm-target-pin" class="farm-target-pin" hidden>📌</span>
              </div>
              <div class="farm-tracker-meta-line">
                <span id="farm-direction-cue" class="farm-direction-cue">Đi thẳng</span>
                <span class="farm-meta-sep" aria-hidden="true">·</span>
                <span id="farm-target-dist" class="farm-target-dist">0m</span>
                <span id="farm-remaining-badge" class="farm-remaining-badge">Còn 0/0</span>
              </div>
            </div>
            <span class="farm-tracker-chevron" aria-hidden="true">▾</span>
          </button>
        </div>
        <div id="farm-tracker-body" class="farm-tracker-body">
          <div class="farm-tracker-subheader">
            <span id="farm-tracker-count">🐾 Còn 0 / 0 thú</span>
            <small id="farm-tracker-hint">Chạm dòng để ghim</small>
          </div>
          <div id="farm-tracker-list" class="farm-tracker-list" role="list"></div>
          <div id="farm-tracker-celebrate" class="farm-tracker-celebrate" hidden>
            <strong>🎉 Đã cứu hết thú!</strong>
            <p>Hãy đi theo mũi tên về <b>Cổng Về Làng Khởi Đầu</b> nhé.</p>
          </div>
          <div class="farm-tracker-footer">
            <button id="farm-portal-guide-btn" type="button" class="farm-portal-guide-btn" aria-pressed="false">
              🏡 Chỉ đường về Cổng Làng
            </button>
          </div>
        </div>
      </aside>
      <button id="quest-pill" class="active-objective-pill" type="button" title="Mở Nhật Ký Nhiệm Vụ (J)">
        <span>🚩</span>
        <span id="quest-pill-text">Gặp Milo bên bờ sông</span>
      </button>
      <aside class="quest-card" hidden aria-hidden="true">
        <div class="eyebrow">${icon('flag')} CHUYẾN PHIÊU LƯU ĐẦU TIÊN</div>
        <h2 id="quest-title">Một cây cầu, ngàn niềm vui</h2>
        <p id="quest-copy">Milo đang chờ bạn bên dòng sông. Đến gần và chào bạn ấy nhé!</p>
        <div id="quest-steps" class="quest-steps"></div>
        <div class="quest-bottom">
          <span id="quest-progress">Gặp người dẫn đường</span>
          <span class="reward">${icon('star')} +10 XP / câu</span>
        </div>
        <div class="flower-quest-tracker">
          <div class="flower-quest-header">
            <span>🌸 Vườn Hoa Tri Thức</span>
            <strong id="flower-count">0 / 10 hoa nở</strong>
          </div>
          <div class="flower-dots" id="flower-dots"></div>
        </div>
        <div class="archimedes-quest-tracker" id="archimedes-tracker">
          <div class="archimedes-tracker-header">
            <span>🏛️ Vùng Đất Archimedes</span>
            <strong id="monolith-count">0 / 40 Bia Đá</strong>
          </div>
          <div class="archimedes-badges" id="archimedes-badges"></div>
        </div>
      </aside>
      <div class="area-label">${icon('compass')}<span><span id="area-label-text">Làng Khởi Đầu</span><small id="area-label-sub">KHÁM PHÁ · HỌC HỎI · TRƯỞNG THÀNH</small></span></div>
      <button id="milo-label" class="world-label" aria-label="Nói chuyện với Milo"><span class="milo-dot">!</span><strong>Milo</strong><small>Người dẫn đường</small></button>
      <div id="bridge-label" class="world-label landmark"><strong>Cây cầu tình bạn</strong><small id="bridge-count">0 / 6 đoạn cầu</small></div>
      <button id="portal-label" class="world-label" aria-label="Cổng dịch chuyển" hidden><span class="milo-dot">🌀</span><strong>Cổng dịch chuyển</strong><small>Khám phá vùng đất mới</small></button>
      <div class="bottom-bar">
        <div class="controls-hint"><span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Di chuyển</span><span class="divider"></span><kbd>Space</kbd><span>Nhảy</span><span class="divider"></span><kbd>B</kbd><span>Túi đồ</span><span class="divider"></span><kbd>M</kbd><span>Bản đồ</span><span class="divider"></span><span>Kéo chuột để xoay</span></div>
        <div class="toolbar">
          <button id="inventory-btn" class="tool-button special-btn inventory-hud-btn" title="Túi Đồ Dũng Sĩ">🎒<span>Túi Đồ</span></button>
          <button id="archimedes-btn" class="tool-button special-btn">${icon('star')}<span>Bản Đồ</span></button>
          <button id="travel" class="tool-button">${icon('compass')}<span id="travel-text">Đến Vườn Hoa</span></button>
          <button id="learn" class="tool-button">${icon('book')}<span>Sổ cửu chương</span></button>
          <button id="help" class="icon-button" aria-label="Hướng dẫn chơi" title="Hướng dẫn chơi">${icon('help')}</button>
        </div>
      </div>
      <button id="interact" class="interact" hidden><kbd>E</kbd> Tương tác ${icon('arrow')}</button>
      <div id="touch-controls" class="touch-controls">
        <div id="joystick" class="wheel-control" role="group" aria-label="Bánh xe điều khiển di chuyển">
          <div class="wheel-outer">
            <div class="wheel-dir wheel-up" aria-hidden="true">▲</div>
            <div class="wheel-dir wheel-right" aria-hidden="true">►</div>
            <div class="wheel-dir wheel-down" aria-hidden="true">▼</div>
            <div class="wheel-dir wheel-left" aria-hidden="true">◄</div>
            <div class="wheel-ring-rim"></div>
            <div id="joystick-knob" class="wheel-knob" aria-hidden="true">
              <div class="knob-core"></div>
            </div>
          </div>
        </div>
        <div class="touch-actions">
          <button id="jump" class="jump-button" aria-label="Nhảy">${icon('jump')}</button>
        </div>
      </div>
    </div>
    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
    <footer id="menu-footer" class="menu-footer"><span><b>VƯƠNG QUỐC</b> HỌC TOÁN 3D</span><span>Một thế giới nhỏ. Những khám phá lớn.</span><span>Lưu trên thiết bị này ${icon('save')}</span></footer>
    <dialog id="dialog" aria-labelledby="dialog-title"><button id="close-dialog" class="dialog-close" aria-label="Đóng">${icon('close')}</button><div id="dialog-content"></div></dialog>
    <dialog id="image-lightbox" class="image-lightbox" aria-label="Phóng to hình ảnh">
      <div class="lightbox-backdrop"></div>
      <div class="lightbox-wrapper">
        <button id="lightbox-close" type="button" class="lightbox-close-btn" aria-label="Đóng phóng to">${icon('close')}</button>
        <img id="lightbox-img" class="lightbox-img" src="" alt="Hình ảnh chi tiết" />
      </div>
    </dialog>
  </main>`;

const screenStack = new ScreenStack(
  $<HTMLDialogElement>('dialog'),
  [
    $<HTMLElement>('hud'),
    $<HTMLElement>('welcome'),
    document.querySelector('header.topbar') as HTMLElement
  ].filter(Boolean)
);

const farmTrackerHud = new FarmTrackerHud($('farm-tracker'), {
  onFocusChange: (animalId) => world?.setFocusedFarmAnimal?.(animalId)
});

function getActiveFarmZone(activeRegionId?: string): RemoteZoneConfig | null {
  if (!activeRegionId || !activeRegionId.startsWith('zone:')) return null;
  const zoneId = Number(activeRegionId.slice(5));
  if (Number.isNaN(zoneId)) return null;
  const zone = worldSession.zones.find((z) => z.id === zoneId);
  if (!zone || classifyZoneTemplate(zone) !== 'farm') return null;
  return zone;
}

function buildFarmTrackerSources(zone: RemoteZoneConfig): FarmAnimalTrackerSource[] {
  const farmSanctuary = world?.farmSanctuary;
  if (!farmSanctuary) return [];
  const rescuedMap = adventure.getState().farmRescued || {};
  const qList = worldSession.getQuestionsForSheet(zone.sheetName);
  const triggerByAnimalId = new Map(
    farmSanctuary.getInteractTriggers().map((t) => [t.animalId, t])
  );

  return farmSanctuary.animals.map((animal, idx) => {
    const idMatch = animal.id.match(/^farm_[a-z]+_(\d+)$/);
    const parsedIdx = idMatch ? Number(idMatch[1]) : idx;
    const trigger = triggerByAnimalId.get(animal.id);
    const problemTitle = trigger?.problemData?.title ?? qList[parsedIdx]?.title;
    const isRescued =
      rescuedMap[animal.id] === true ||
      trigger?.isActive === false ||
      animal.state === 'HOMEWARD' ||
      animal.state === 'RESTING';

    return {
      id: animal.id,
      index: parsedIdx,
      kind: animal.kind,
      localPos: { x: animal.root.position.x, z: animal.root.position.z },
      rescued: isRescued,
      problemTitle: typeof problemTitle === 'string' ? problemTitle : undefined
    };
  });
}

function toast(message: string, duration = 4200, onClick?: () => void) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  if (onClick) {
    t.classList.add('interactive');
    t.onclick = () => {
      onClick();
      t.hidden = true;
      t.classList.remove('interactive');
    };
  } else {
    t.classList.remove('interactive');
    t.onclick = null;
  }
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    t.hidden = true;
    t.classList.remove('interactive');
  }, duration);
}

function updateHUD() {
  const state = adventure.getState();
  const level = getLevel(state.xp),
    start = LEVEL_XP[level - 1],
    next = LEVEL_XP[level];
  const profile = getExplorerProfile();
  const playerNameEl = document.getElementById('player-name');
  if (playerNameEl) playerNameEl.textContent = profile.nickname || 'Dũng Sĩ Tí Hon';
  const ch = getCharacter(state.avatar);
  $('avatar-face').textContent = ch.emoji;
  const playerTitleEl = document.getElementById('player-title');
  if (playerTitleEl) playerTitleEl.textContent = `${getLevelTitle(level)} · ${ch.title}`;
  $('level').textContent = String(level);
  $('coins').textContent = String(state.coins);
  $('xp-text').textContent = next ? `${state.xp - start} / ${next - start} XP` : `${state.xp} XP · Cấp cao nhất`;
  const percent = next ? Math.min(100, ((state.xp - start) / (next - start)) * 100) : 100;
  $('xp-fill').style.width = `${percent}%`;
  $('xp-fill').parentElement!.setAttribute('aria-valuenow', String(Math.round(percent)));
  // Update avatar button pressed state for all characters
  CHARACTERS.forEach(c => {
    const btn = document.getElementById(`avatar-${c.id}`);
    if (btn) btn.setAttribute('aria-pressed', String(state.avatar === c.id));
  });
  $('play').innerHTML = `${state.started ? 'Tiếp tục phiêu lưu' : 'Bắt đầu phiêu lưu'} ${icon('arrow')}`;
  $('quest-copy').textContent = state.questComplete
    ? 'Bạn đã nối liền hai bờ! Hãy sang Vườn Hoa Tri Thức hoặc quay lại Milo để luyện tập.'
    : state.bridge === BRIDGE_PARTS
      ? 'Cây cầu đã sẵn sàng! Hãy đi qua cầu sang Vườn Hoa Tri Thức bên kia sông.'
      : state.questAccepted
        ? 'Giúp Milo chọn phép nhân đúng. Mỗi câu trả lời sẽ xây thêm một đoạn cầu.'
        : 'Milo đang chờ bạn bên dòng sông. Đến gần và chào bạn ấy nhé!';
  $('quest-title').textContent = state.questComplete ? 'Cây cầu tình bạn đã hoàn thành!' : 'Một cây cầu, ngàn niềm vui';
  const questProgressLabel = state.questComplete
    ? '✓ Hoàn thành cầu tình bạn'
    : state.bridge === BRIDGE_PARTS
      ? 'Qua cầu sang Vườn Hoa'
      : state.questAccepted
        ? `Xây cầu ${state.bridge}/${BRIDGE_PARTS}`
        : 'Gặp Milo bên bờ sông';
  $('quest-progress').textContent = questProgressLabel;
  const questPillText = document.getElementById('quest-pill-text');
  if (questPillText) {
    const drillDone = state.dailyDrill?.date === todayDateKey() ? state.dailyDrill.completedCount : 0;
    questPillText.textContent = state.questComplete
      ? `🌸 ${state.flowers.filter(Boolean).length}/10 hoa · 📅 ${Math.min(5, drillDone)}/5`
      : questProgressLabel;
  }
  $('quest-steps').innerHTML = Array.from(
    { length: BRIDGE_PARTS },
    (_, i) =>
      `<span class="${i < state.bridge ? 'done' : ''}" aria-label="Đoạn ${i + 1}: ${i < state.bridge ? 'đã xây' : 'chưa xây'}">${i < state.bridge ? icon('check') : i + 1}</span>`
  ).join('');
  $('bridge-count').textContent = `${state.bridge} / ${BRIDGE_PARTS} đoạn cầu`;
  $('sound').innerHTML = icon(state.sound ? 'sound' : 'mute');
  $('sound').setAttribute('aria-label', state.sound ? 'Tắt âm thanh' : 'Bật âm thanh');
  audio.enabled = state.sound;

  // Flower quest tracker
  const bloomedCount = state.flowers.filter(Boolean).length;
  $('flower-count').textContent = `${bloomedCount} / 10 hoa nở`;
  $('flower-dots').innerHTML = state.flowers
    .map(
      (bloomed, i) =>
        `<span class="flower-dot ${bloomed ? 'bloomed' : ''}" title="Cây hoa ${i + 1}: ${bloomed ? 'Đã nở hoa' : 'Đang ấp nụ'}">${bloomed ? '🌸' : '🌱'}</span>`
    )
    .join('');

  // Archimedes & Kingdom quest tracker
  const monolithProblems = worldSession.monolithProblems;
  const monolithCount = getArchimedesSolvedCount(state, monolithProblems);
  const totalMonoliths = monolithProblems.length > 0 ? monolithProblems.length : 40;
  $('monolith-count').textContent = `${monolithCount} / ${totalMonoliths} Bia Đá`;
  const zonesForBadges = worldSession.badgeZones.length > 0
    ? worldSession.badgeZones
    : ARCHIMEDES_ZONES;
  $('archimedes-badges').innerHTML = zonesForBadges.map((z, i) => {
    const earned = state.zoneBadges[i];
    return `<span class="archimedes-badge-dot ${earned ? 'earned' : ''}" title="${z.name} (${earned ? 'Đã đạt' : 'Chưa đạt'})">${earned ? '🏆' : '✦'}</span>`;
  }).join('');

  // Tự động đưa vào hàng đợi đồng bộ nền lên Google Sheets
  if (state.started) {
    const isMilestone =
      state.bridge === BRIDGE_PARTS ||
      state.questComplete ||
      bloomedCount === 10 ||
      (monolithCount > 0 && monolithCount === totalMonoliths);
    syncManager.queueSync(isMilestone);
  }
}


function openDialog(title: string, body: string, kind: string) {
  if (world) {
    world.paused = true;
    world.clearInput();
  }
  currentDialog = kind;
  $('dialog-content').innerHTML = `<h2 id="dialog-title">${title}</h2>${body}`;
  const dialog = $<HTMLDialogElement>('dialog');
  if (!dialog.open) {
    screenStack.push(kind);
  } else {
    screenStack.focusPrimaryControl();
  }
}

function closeDialog() {
  $<HTMLDialogElement>('dialog').close();
}

$('dialog').addEventListener('close', () => {
  if (world) {
    world.paused = false;
    world.clearInput();
  }
  currentDialog = '';
  challengeDialog.resetSession();
  screenStack.onClosed();
});

$('close-dialog').onclick = closeDialog;
challengeDialog.initLightboxListeners();

function initWelcomeProfile() {
  const profile = getExplorerProfile();
  const nameInput = $<HTMLInputElement>('welcome-name');
  const classInput = $<HTMLInputElement>('welcome-class');
  if (nameInput) {
    nameInput.value = profile.isAnonymous ? '' : profile.nickname;
  }
  if (classInput) {
    classInput.value = profile.className || 'Lớp 2';
  }
}

let isRegionTransitioning = false;

function showLoadingOverlay(message: string, subtitle = 'Đang chuẩn bị cảnh quan 3D cho vùng đất…') {
  const el = $('loading');
  el.innerHTML = `<div class="loading-logo-box"><img src="${import.meta.env.BASE_URL}icons/logo-ui.png" alt="Biểu Tượng Vương Quốc" class="loading-logo-img" /></div><strong id="loading-title">${message}</strong><small id="loading-sub" class="loading-sub">${subtitle}</small>`;
  el.hidden = false;
}

function hideLoadingOverlay() {
  $('loading').hidden = true;
}

async function teleportWithRegionLoading(
  x: number,
  z: number,
  destinationName?: string,
  y?: number,
  explicitRegionId?: string
) {
  if (!world || isRegionTransitioning) return;

  const targetRegion = explicitRegionId ?? world.spatial.resolveRegionForPoint?.(x, z);
  const currentRegion = world.getActiveRegionId?.();
  const needsRegionSwitch = Boolean(targetRegion && currentRegion && targetRegion !== currentRegion);

  if (!needsRegionSwitch) {
    world.teleport(x, z, y, explicitRegionId);
    audio.playCue('jump');
    world.burstPlayer(1.2);
    queueSavePosition(x, z, true, world.player.position.y);
    if (destinationName) toast(`✨ Đã dịch chuyển đến ${destinationName}!`);
    return;
  }

  isRegionTransitioning = true;
  world.paused = true;
  world.clearInput();
  const cleanName = destinationName?.replace(/^Đến\s+/i, '');
  showLoadingOverlay(cleanName ? `Đang mở cánh cổng đến ${cleanName}…` : 'Đang mở cánh cổng…');

  try {
    // Nhường 1 frame để trình duyệt kịp render lớp phủ loading trước khi parse/compile tài nguyên 3D
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const minWait = new Promise<void>((resolve) => setTimeout(resolve, 220));
    await Promise.all([world.activateRegionAt?.(x, z, explicitRegionId), minWait]);

    world.teleport(x, z, y, explicitRegionId);
    world.resetCamera();
    queueSavePosition(x, z, true, world.player.position.y);
    audio.playCue('jump');
    world.burstPlayer(1.2);
    if (cleanName) toast(`✨ Chào mừng bạn đến ${cleanName}!`);
  } catch (err) {
    console.error('[PortalTransition] Lỗi nạp vùng đất:', err);
    toast('⚠️ Chưa tải được vùng đất đích, vui lòng thử lại!');
  } finally {
    hideLoadingOverlay();
    isRegionTransitioning = false;
    world.paused = false;
  }
}

async function start() {
  const nameInput = $<HTMLInputElement>('welcome-name');
  const classInput = $<HTMLInputElement>('welcome-class');
  const profile = saveExplorerProfile({
    nickname: nameInput?.value,
    className: classInput?.value
  } as any);

  const playBtn = $('play');
  const originalPlayHTML = playBtn.innerHTML;
  playBtn.style.pointerEvents = 'none';
  playBtn.innerHTML = `<span>⏳ Đang mở thế giới 3D...</span>`;
  showLoadingOverlay('Đang chuẩn bị thế giới 3D…', 'Đang khởi tạo Vương Quốc Học Toán 3D…');

  try {
    if (!world) {
      world = await ensureWorld();
    }
    if (worldSession.hasPendingDeferredSpawn) {
      await worldSession.bootSync().catch((err) => {
        console.warn('Lỗi đồng bộ câu hỏi khi vào thế giới:', err);
      });
    }
  } catch (error) {
    playBtn.style.pointerEvents = '';
    playBtn.innerHTML = originalPlayHTML;
    $('loading').innerHTML =
      '<strong>Chưa mở được thế giới 3D</strong><p>Hãy bật tăng tốc đồ họa trong trình duyệt, hoặc thử Chrome / Edge mới hơn.</p><button class="primary" id="retry-launch-btn">Thử lại</button>';
    $('loading').hidden = false;
    $('retry-launch-btn')?.addEventListener('click', () => {
      hideLoadingOverlay();
      void start();
    });
    console.error('Lỗi nạp thế giới 3D:', error);
    return;
  }

  playBtn.style.pointerEvents = '';
  playBtn.innerHTML = originalPlayHTML;
  hideLoadingOverlay();

  adventure.setStarted(true);
  queueSavePosition(world.player.position.x, world.player.position.z, true);
  audio.music(adventure.getState().music);
  world.active = true;
  world.paused = false;
  world.setAvatar(adventure.getState().avatar);
  $('welcome').hidden = true;
  $('hud').hidden = false;
  $('world-caption').hidden = true;
  $('menu-footer').hidden = true;
  document.body.classList.add('playing');
  updateHUD();

  // Tái sử dụng phiên đồng bộ khởi động nếu đang chạy hoặc đã xong (không gọi fetch trùng)
  void worldSession.bootSync().catch((err) => {
    console.warn('Lỗi đồng bộ câu hỏi khi vào thế giới:', err);
  });

  toast(`Chào mừng ${profile.nickname}! Cùng Milo khám phá Vương Quốc nhé! ✨`);
}

function menu() {
  closeDialog();
  if (world) {
    world.active = false;
    world.clearInput();
  }
  $('welcome').hidden = false;
  $('hud').hidden = true;
  $('world-caption').hidden = false;
  $('menu-footer').hidden = false;
  document.body.classList.remove('playing');
  farmTrackerHud.hide();
  initWelcomeProfile();
  updateHUD();
  audio.music(false);
}

$('play').onclick = start;
$('welcome-name')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('play').click();
  }
});
$('welcome-class')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('play').click();
  }
});
initWelcomeProfile();

for (const ch of CHARACTERS) {
  const btn = document.getElementById(`avatar-${ch.id}`);
  if (btn) btn.onclick = () => {
    adventure.setAvatar(ch.id);
    world?.setAvatar(ch.id);
    updateHUD();
  };
}

function talk() {
  if (!world?.active || world.paused) return;
  if (!near) {
    toast('Hãy đến gần Milo — người bạn có chiếc mũ xanh bên bờ sông.');
    return;
  }
  const state = adventure.getState();
  const complete = state.bridge === BRIDGE_PARTS;
  const drillToday = state.dailyDrill?.date === todayDateKey() ? state.dailyDrill : undefined;
  const drillDone = drillToday?.completedCount ?? 0;
  const drillBanner = complete
    ? `<div class="milo-tip"><span>📅</span><p><b>Nhiệm vụ hằng ngày (${Math.min(5, drillDone)} / 5 câu):</b> ${
        drillToday?.rewardClaimed
          ? 'Bạn đã nhận thưởng +25 XP, +15 xu & 1 Cuộn Gợi Ý hôm nay! Tiếp tục luyện thêm nếu muốn nhé.'
          : 'Hoàn thành 5 phép nhân bất kỳ cùng Milo mỗi ngày để nhận thưởng nóng <b>+25 XP, +15 xu & 1 Cuộn Gợi Ý</b>!'
      }</p></div>`
    : `<div class="milo-tip"><span>✦</span><p>Chọn phép nhân cho đúng số viên đá. Mỗi câu đúng: <b>+10 XP, +5 xu</b>. Nếu chưa nhớ, bạn hãy mở Sổ cửu chương để xem lại nhé!</p></div>`;
  openDialog(
    'Chào bạn, mình là Milo!',
    `<div class="dialog-eyebrow">NGƯỜI DẪN ĐƯỜNG CỦA BẠN</div><p class="dialog-copy">${complete ? 'Cây cầu của chúng mình thật đẹp! Bạn có thể chọn luyện bất kỳ bảng cửu chương nào từ <b>bảng ×1 đến bảng ×10</b> hoặc cùng mình làm Nhiệm Vụ Hằng Ngày nhé!' : 'Vườn Hoa Tri Thức bên kia sông đang chờ chúng mình. Hãy giúp mình xây <strong>6 đoạn cầu</strong> bằng những viên đá phép thuật nhé! Bạn có thể luyện tập đầy đủ từ <strong>bảng ×1 đến bảng ×10</strong>.'}</p>${drillBanner}<button id="accept-quest" class="primary wide">${complete ? 'Cùng luyện tập phép nhân' : 'Cùng xây cầu nào!'} ${icon('arrow')}</button><button id="milo-open-book" class="secondary wide">${icon('book')} Mở Sổ cửu chương (Bảng ×1 – ×10)</button>`,
    'milo'
  );
  $('accept-quest').onclick = () => {
    adventure.acceptQuest();
    updateHUD();
    showQuestion(complete ? 'practice' : 'bridge', '', complete);
  };
  $('milo-open-book').onclick = () => {
    learn();
  };
}
$('milo-label').onclick = talk;

function interactAction() {
  if (!world || !world.active || world.paused) return;
  if (nearShop) {
    shopModal.open('shop', 'full');
  } else if (nearParkTree !== -1) {
    openParkTreeDialog(nearParkTree);
  } else if (nearMonolith !== -1) {
    openArchimedesMonolithDialog(nearMonolith, 0);
  } else if (nearFarmAnimalId) {
    openFarmAnimalDialog(nearFarmAnimalId);
  } else if (nearQhmjNode !== -1) {
    const activeReg = world.getActiveRegionId?.() ?? '';
    const activeZoneId = activeReg.startsWith('zone:') ? Number(activeReg.slice(5)) : NaN;
    const qhmjZone = (!Number.isNaN(activeZoneId)
      ? worldSession.zones.find((z) => z.id === activeZoneId && classifyZoneTemplate(z) === 'qhmj')
      : undefined) || worldSession.zones.find((z) => classifyZoneTemplate(z) === 'qhmj');
    if (qhmjZone) {
      void openQhmjNodeDialog(qhmjZone.id, nearQhmjNode);
    }
  } else if (nearPortal) {
    const nearP = world.spatial.getNearPortal();
    if (nearP?.requiresSelection) {
      openParkSelectionDialog();
    } else {
      openArchimedesMapDialog();
    }
  } else if (nearFlower !== -1) {
    openFlowerDialog(nearFlower);
  } else if (near) {
    talk();
  }
}

function openParkSelectionDialog() {
  const parkZones = worldSession.zones.filter((z) => classifyZoneTemplate(z) === 'park');
  if (parkZones.length === 0) return;

  const parkCardsHtml = parkZones.map((pz) => {
    const questions = worldSession.getQuestionsForSheet(pz.sheetName);
    const state = adventure.getState();
    const awakenedCount = state.parkTrees ? state.parkTrees.filter(Boolean).length : 0;
    const totalCount = questions.length;

    return `
      <div class="zone-overview-card" style="margin-bottom:12px;background:#f0fdf4;border:1px solid #bbf7d0">
        <div>
          <div class="zone-card-title">🌳 ${pz.name}</div>
          <div class="zone-card-meta">${pz.badge || 'CÔNG VIÊN TRI THỨC'} · Tọa độ: (${Math.round(pz.center.x)}, ${Math.round(pz.center.z)})</div>
          <p style="font-size:12px;color:#166534;margin:8px 0">
            ${totalCount > 0 ? `Khu bảo tồn thiên nhiên với ${totalCount} Cây Tri Thức cần đánh thức.` : 'Công viên đang trong trạng thái thư giãn.'}
          </p>
          <div style="font-size:12px;font-weight:600;color:#047857">
            Tiến độ: ${awakenedCount} / ${totalCount} cây đã thức tỉnh
          </div>
        </div>
        <button class="primary park-select-portal-btn" data-x="${pz.center.x + 11.5}" data-z="${pz.center.z}" data-name="${pz.name}" style="white-space:nowrap;padding:10px 16px;margin-top:6px">
          🚀 Bước vào ${pz.name}
        </button>
      </div>
    `;
  }).join('');

  openDialog(
    'Cổng dịch chuyển',
    `
    <div class="dialog-eyebrow">CHỌN CÔNG VIÊN TRI THỨC MUỐN ĐẾN</div>
    <p class="dialog-copy">
      Cánh cổng bờ tây kết nối tới <b>${parkZones.length}</b> công viên tri thức. Hãy chọn vùng đất bạn muốn khám phá:
    </p>
    <div class="park-selection-list" style="margin-top:14px">
      ${parkCardsHtml}
    </div>
    <button id="close-park-select-btn" class="secondary wide" style="margin-top:10px">
      Ở lại Làng Khởi Đầu
    </button>
    `,
    'parkSelection'
  );

  $('close-park-select-btn').onclick = closeDialog;

  document.querySelectorAll<HTMLButtonElement>('.park-select-portal-btn').forEach((btn) => {
    btn.onclick = () => {
      const x = Number(btn.dataset.x);
      const z = Number(btn.dataset.z);
      const name = btn.dataset.name || 'Công Viên';
      closeDialog();
      void teleportWithRegionLoading(x, z, name);
    };
  });
}

$('interact').onclick = interactAction;

function showQuestion(nextMode: 'bridge' | 'practice', last = '', countDailyDrill = false) {
  mode = nextMode;
  return challengeDialog.startChallenge({
    type: 'multiplication',
    mode: nextMode,
    lastId: last,
    countDailyDrill
  });
}

function openParkTreeDialog(index: number, stepIndex = 0) {
  const locName = world?.spatial?.getCurrentLocationName();
  const parkZone =
    worldSession.zones.find((z) => classifyZoneTemplate(z) === 'park' && locName === z.name) ||
    worldSession.zones.find((z) => classifyZoneTemplate(z) === 'park');
  const sheetName = parkZone?.sheetName || 'CongVienXanh';
  const parkQuestions = worldSession.getQuestionsForSheet(sheetName);
  if (index < 0 || index >= parkQuestions.length) {
    return;
  }
  return challengeDialog.startChallenge({
    type: 'park_tree',
    index,
    stepIndex,
    questions: parkQuestions,
    zone: parkZone
  });
}

function openFlowerDialog(index: number, stepIndex = 0) {
  const remoteFlowers = worldSession.getQuestionsForSheet('VuonHoa');
  return challengeDialog.startChallenge({
    type: 'flower',
    index,
    stepIndex,
    remoteFlowers
  });
}

function getQhmjProblemsForZone(zone: RemoteZoneConfig) {
  const sheetProblems = worldSession.getQuestionsForSheet(zone.sheetName);
  return sheetProblems.length > 0 ? sheetProblems : generateQhmjProblems(zone.id, 12);
}

function openQhmjNodeDialog(zoneId: number, nodeIndex: number, stepIndex = 0) {
  const zone = worldSession.zones.find((z) => z.id === zoneId) ||
    worldSession.zones.find((z) => classifyZoneTemplate(z) === 'qhmj');
  if (!zone) return;

  const placedNodes = world?.getQhmjNodes?.(zone.id) ?? [];
  if (placedNodes.length > 0) {
    const node = placedNodes.find((n) => n.index === nodeIndex) ?? placedNodes[nodeIndex];
    if (!node) return;
    return challengeDialog.startChallenge({
      type: 'qhmj_node',
      zoneId: zone.id,
      zoneName: zone.name,
      nodeIndex: node.index,
      progressKey: node.progressKey,
      nodeKind: node.kind,
      problem: node.problem,
      allProgressKeys: placedNodes.map((n) => n.progressKey),
      stepIndex
    });
  }

  const problems = getQhmjProblemsForZone(zone);
  const prob = problems[nodeIndex];
  if (!prob) return;
  return challengeDialog.startChallenge({
    type: 'qhmj_node',
    zoneId: zone.id,
    zoneName: zone.name,
    nodeIndex,
    progressKey: qhmjProgressKey(zone.id, prob.id),
    nodeKind: nodeIndex === problems.length - 1 ? 'clock_summit' : 'path_crystal',
    problem: prob,
    allProgressKeys: problems.map((p) => qhmjProgressKey(zone.id, p.id)),
    stepIndex
  });
}

async function openFarmAnimalDialog(animalId: string) {
  if (!world) return;
  const farmZone = worldSession.zones.find((z) => classifyZoneTemplate(z) === 'farm');
  const animal = world.farmSanctuary?.animals.find(a => a.id === animalId);
  const idMatch = animalId.match(/^farm_([a-z]+)_(\d+)$/);
  const fallbackKinds = ['cow', 'pig', 'chicken', 'duck', 'dog'];
  const parsedIdx = idMatch ? Number(idMatch[2]) : 0;
  const kind = animal?.kind || idMatch?.[1] || fallbackKinds[parsedIdx % fallbackKinds.length];
  const animalName = getFarmAnimalVietnameseName(kind);

  const isAlreadyRescued = adventure.getState().farmRescued?.[animalId] === true;
  const trigger = world.farmSanctuary?.getInteractTriggers().find(t => t.animalId === animalId);
  if (isAlreadyRescued || (world.farmSanctuary && (!trigger || !trigger.isActive || animal?.state === 'HOMEWARD' || animal?.state === 'RESTING'))) {
    audio.playCue('correct');
    toast(`💖 Bé ${animalName} đã được bạn cứu về chuồng an toàn rồi!`);
    return;
  }

  const qList = farmZone ? worldSession.getQuestionsForSheet(farmZone.sheetName) : [];
  const pd = trigger?.problemData ?? qList[parsedIdx] ?? generateFarmMultiplicationProblem(parsedIdx, kind as any);
  const totalAnimals = world?.farmSanctuary?.animals?.length || qList.length || 10;

  const outcome = await challengeDialog.startChallenge({
    type: 'farm_animal',
    animalId,
    animalName,
    problemData: pd,
    zoneName: farmZone?.name,
    zoneId: farmZone?.id ?? 8,
    totalAnimals
  });

  if (outcome.status === 'solved' && outcome.isCorrect) {
    world.setFarmRescued?.(adventure.getState().farmRescued || {});
    farmTrackerHud.invalidateSort();

    const rewardItem = getProduceForAnimalKind(kind);
    adventure.addProduceToInventory(rewardItem, 1);

    toast(`🎉 Trả lời đúng! Bé ${animalName} đang vui vẻ chạy về chuồng. +1 Nông sản!`);

    world.burstPlayer(1.2);
    updateHUD();
  }
}

function openArchimedesMapDialog(selectedZoneId = 0) {
  const state = adventure.getState();
  const zones: RemoteZoneConfig[] = worldSession.zones.length > 0 ? worldSession.zones : getBundledFallbackData().zones;
  const currentZone = zones.find((z) => z.id === selectedZoneId);

  const totalMonolithCompleted = getArchimedesSolvedCount(state, worldSession.monolithProblems);
  const totalFlowerCompleted = state.flowers.filter(Boolean).length;
  const badgesEarned = state.zoneBadges.filter(Boolean).length;

  const summarizeZone = (z: RemoteZoneConfig) => {
    const kind = classifyZoneTemplate(z);
    if (kind === 'qhmj') {
      const qList = getQhmjProblemsForZone(z);
      const done = qList.filter((p) => adventure.isProblemSolved(qhmjProgressKey(z.id, p.id))).length;
      return { kind, total: qList.length, done };
    }
    const qList = worldSession.getQuestionsForSheet(z.sheetName);
    const isFlowerZone = kind === 'flower';
    const isParkZone = kind === 'park';
    const isFarmZone = kind === 'farm';
    const farmRescuedCount = Object.values(state.farmRescued || {}).filter(Boolean).length;
    const total = isParkZone
      ? qList.length
      : isFarmZone
        ? (qList.length || (world?.farmSanctuary?.animals?.length ?? 10))
        : (qList.length || (isFlowerZone ? 10 : 0));
    const done = isFarmZone
      ? farmRescuedCount
      : qList.length > 0
        ? qList.filter((p: any) => adventure.isProblemSolved(p.id)).length
        : (isFlowerZone ? totalFlowerCompleted : (isParkZone ? (state.parkTrees ? state.parkTrees.filter(Boolean).length : 0) : 0));
    return { kind, total, done };
  };

  const zoneTabsHtml = [
    `<button class="archimedes-zone-tab" data-zone="0" aria-pressed="${selectedZoneId === 0}">🌐 Toàn Cảnh (${zones.length} Vùng)</button>`,
    `<button class="archimedes-zone-tab" data-zone="-1" aria-pressed="${selectedZoneId === -1}">🏡 Làng Khởi Đầu</button>`,
    ...zones.map((z) => {
      const { total, done } = summarizeZone(z);
      return `<button class="archimedes-zone-tab" data-zone="${z.id}" aria-pressed="${selectedZoneId === z.id}">${getThemeBadgeIcon(z.theme)} ${z.name} (${done}/${total})</button>`;
    })
  ].join('');

  let contentHtml = '';

  if (selectedZoneId === 0) {
    // 1. Toàn cảnh Vương Quốc
    const overviewCardsHtml = [
      `
      <div class="zone-overview-card">
        <div>
          <div class="zone-card-title">🏡 Làng Khởi Đầu</div>
          <div class="zone-card-meta">Trung tâm Vương Quốc · Tọa độ: (0, 0)</div>
          <p style="font-size:12px;color:#456755;margin:8px 0">
            Nơi gặp gỡ Milo dẫn đường, Cây cầu tình bạn (6 đoạn), Cối xay gió và dòng sông thơ mộng.
          </p>
        </div>
        <button class="zone-teleport-btn zone-banner-teleport" data-x="-6" data-z="5" data-name="Làng Khởi Đầu">
          🚀 Về Làng Khởi Đầu
        </button>
      </div>
      `,
      ...zones.map((z) => {
        const { kind, total, done } = summarizeZone(z);
        const isFlowerZone = kind === 'flower';
        const isParkZone = kind === 'park';
        const isFarmZone = kind === 'farm';
        const isQhmjZone = kind === 'qhmj';
        const questSummary = isFlowerZone
          ? `${done}/${total} Cây hoa nở`
          : isParkZone
            ? `${done}/${total} Cây đã thức tỉnh`
            : isFarmZone
              ? `${done}/${total} Thú cưng về chuồng`
              : isQhmjZone
                ? `${done}/${total} Trạm bậc thang`
                : `${done}/${total} Bia đá tri thức`;
        const qhmjSpawn = isQhmjZone ? qhmjZoneSpawn(z) : null;
        const farmSpawn = isFarmZone ? farmZoneSpawn(z) : null;
        const tpX = isQhmjZone ? qhmjSpawn!.x : isFarmZone ? farmSpawn!.x : (z.center.x - z.width / 2 + 4);
        const tpY = isFarmZone ? farmSpawn!.y : undefined;
        const tpZ = isQhmjZone ? qhmjSpawn!.z : isFarmZone ? farmSpawn!.z : z.center.z;
        const tpRegionAttr = isFarmZone || isQhmjZone ? `data-region="zone:${z.id}"` : '';
        const tpYAttr = tpY !== undefined ? `data-y="${tpY}"` : '';
        return `
        <div class="zone-overview-card">
          <div>
            <div class="zone-card-title">${getThemeBadgeIcon(z.theme)} ${z.name}</div>
            <div class="zone-card-meta">${z.badge} · Chủ đề ${z.theme || 'NÔNG TRẠI'} · (${Math.round(z.center.x)}, ${Math.round(z.center.z)})</div>
            <p style="font-size:12px;color:#456755;margin:8px 0">
              Quy mô: ${z.width}m × ${z.depth}m · ${questSummary}
            </p>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="zone-teleport-btn zone-banner-teleport" data-x="${tpX}" ${tpYAttr} data-z="${tpZ}" ${tpRegionAttr} data-name="${z.name}">
              🚀 Đến đảo này
            </button>
            <button class="archimedes-card-action kingdom-zone-inspect-btn" data-zone="${z.id}">
              🔍 Xem thử thách
            </button>
          </div>
        </div>
        `;
      })
    ].join('');

    contentHtml = `
      <div class="zone-overview-grid">
        ${overviewCardsHtml}
      </div>
    `;
  } else if (selectedZoneId === -1) {
    // 2. Làng Khởi Đầu
    contentHtml = `
      <div class="zone-banner">
        <div class="zone-banner-info">
          <h4>🏡 Làng Khởi Đầu</h4>
          <p>Trung tâm kết nối các vùng đất kỳ thú · Vị trí: (X: 0, Z: 0)</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="zone-teleport-btn zone-banner-teleport" data-x="-6" data-z="5" data-name="Làng Khởi Đầu">
            🚀 Dịch chuyển về Làng Khởi Đầu
          </button>
        </div>
      </div>
      <div class="zone-overview-card" style="margin-top:12px">
        <div class="zone-card-title">🌉 Cây cầu tình bạn & Milo</div>
        <p style="font-size:13px;color:#355a47;margin:8px 0">
          Tiến độ xây cầu: <b>${state.bridge} / 6 đoạn</b>.<br>
          Gặp Milo bên bờ sông để cùng luyện tập bảng cửu chương nhân từ ×1 đến ×10!
        </p>
      </div>
    `;
  } else if (selectedZoneId === 6) {
    // 3. Vườn Hoa Tri Thức
    const remoteFlowers = worldSession.getQuestionsForSheet('VuonHoa');
    const flowerList = remoteFlowers.length > 0
      ? remoteFlowers
      : Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: `Hoa Tri Thức #${i + 1}`, subtitle: 'Làm nở hoa bằng cách trả lời đúng' }));

    const flowerCardsHtml = flowerList.map((f: any, i: number) => {
      const flowerId = f.id ?? (i + 1);
      const bloomed = adventure.isProblemSolved(flowerId) || state.flowers[i];
      const flowerPos = world?.flowers[i]?.position ?? (FLOWER_COORDS[i] ? { x: FLOWER_COORDS[i][0], z: FLOWER_COORDS[i][1] } : { x: 13 + (i % 5) * 3, z: -4 + Math.floor(i / 5) * 8 });
      const flowerTitle = f.title || `Hoa Tri Thức Số ${i + 1}`;
      const flowerSubtitle = (f.subtitle && f.subtitle !== f.title) ? f.subtitle : '';
      const flowerPrompt = (f.steps && f.steps[0] ? f.steps[0].prompt : '') || 'Làm nở hoa bằng cách trả lời đúng câu hỏi';
      return `
        <div class="archimedes-monolith-card ${bloomed ? 'completed' : ''}">
          <div class="archimedes-card-header">
            <span class="archimedes-card-page">${f.badge || `Cây Hoa #${flowerId}`}</span>
            <span class="archimedes-card-status">${bloomed ? '🌸 Đã nở' : '🌱 Đang ấp nụ'}</span>
          </div>
          <div class="archimedes-card-title">${flowerTitle}</div>
          ${flowerSubtitle ? `<div class="archimedes-card-sub">${flowerSubtitle}</div>` : ''}
          ${flowerPrompt && flowerPrompt !== flowerSubtitle ? `<div class="archimedes-card-desc">${flowerPrompt}</div>` : ''}
          <div class="archimedes-card-actions">
            <span class="archimedes-card-readonly-tag">${bloomed ? `${icon('check')} Đã nở hoa` : '🌱 Khám phá 3D để giải'}</span>
            <button class="zone-teleport-btn archimedes-card-teleport" data-x="${flowerPos.x - 1.5}" data-z="${flowerPos.z}" data-name="${flowerTitle}">
              🚀 Đến ngay
            </button>
          </div>
        </div>
      `;
    }).join('');

    contentHtml = `
      <div class="zone-banner">
        <div class="zone-banner-info">
          <h4>🌸 Vườn Hoa Tri Thức</h4>
          <p>${flowerList.length} Cây hoa thử thách nở rộ kỳ diệu · Vị trí: (X: 20, Z: 0)</p>
        </div>
        <button class="zone-teleport-btn zone-banner-teleport" data-x="13" data-z="0" data-name="Vườn Hoa Tri Thức">
          🚀 Dịch chuyển đến Vườn Hoa
        </button>
      </div>
      <div class="archimedes-monolith-grid">
        ${flowerCardsHtml}
      </div>
    `;
  } else if (currentZone?.template === 'PARK_SANCTUARY') {
    // 4. Vùng đất Công Viên Tri Thức (PARK_SANCTUARY)
    const remoteParkTrees = worldSession.getQuestionsForSheet(currentZone.sheetName);
    // Chỉ lấy đúng số lượng câu hỏi trên Google Sheets, không tự sinh fallback 20 câu
    const treeList = remoteParkTrees;

    const fallbackParkPositions = computeProceduralEntityPositions('PARK_SANCTUARY', treeList.length, currentZone.center, currentZone.width, currentZone.depth);

    const treeCardsHtml = treeList.length > 0 ? treeList.map((t: any, i: number) => {
      const treeId = t.id ?? (i + 1);
      const awakened = adventure.isParkTreeAwakened(i) || adventure.isProblemSolved(treeId);
      const treePos = world?.parkTrees[i]?.position ?? fallbackParkPositions[i] ?? { x: currentZone.center.x + 11.5, z: currentZone.center.z };
      const treeTitle = t.title || `Cây Tri Thức Số ${i + 1}`;
      const treeSubtitle = (t.subtitle && t.subtitle !== t.title) ? t.subtitle : '';
      const treePrompt = (t.steps && t.steps[0] ? t.steps[0].prompt : '') || 'Đánh thức cây xanh bằng cách trả lời đúng';
      return `
        <div class="archimedes-monolith-card ${awakened ? 'completed' : ''}">
          <div class="archimedes-card-header">
            <span class="archimedes-card-page">${t.badge || `Cây #${treeId}`}</span>
            <span class="archimedes-card-status">${awakened ? '🌳 Đã thức tỉnh' : '🩶 Đang ngủ say'}</span>
          </div>
          <div class="archimedes-card-title">${treeTitle}</div>
          ${treeSubtitle ? `<div class="archimedes-card-sub">${treeSubtitle}</div>` : ''}
          ${treePrompt && treePrompt !== treeSubtitle ? `<div class="archimedes-card-desc">${treePrompt}</div>` : ''}
          <div class="archimedes-card-actions">
            <span class="archimedes-card-readonly-tag">${awakened ? `${icon('check')} Đã thức tỉnh` : '🌳 Đến gần cây để giải'}</span>
            <button class="zone-teleport-btn archimedes-card-teleport" data-x="${treePos.x}" data-z="${treePos.z + 2}" data-name="${treeTitle}">
              🚀 Đến ngay
            </button>
          </div>
        </div>
      `;
    }).join('') : `
      <div style="grid-column: 1 / -1; padding: 28px; text-align: center; color: #475569; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 32px; margin-bottom: 8px;">🌳</div>
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">Công viên đang trong trạng thái thư giãn</div>
        <div style="font-size: 13px; color: #64748b;">Chưa có bài tập nào được giao trên bảng tính cho công viên này.</div>
      </div>
    `;

    contentHtml = `
      <div class="zone-banner" style="background:linear-gradient(135deg,#064e3b,#047857)">
        <div class="zone-banner-info">
          <h4>🌳 ${currentZone.name}</h4>
          <p>${treeList.length} Cây Tri Thức cần được đánh thức · Vị trí: (X: ${Math.round(currentZone.center.x)}, Z: ${Math.round(currentZone.center.z)})</p>
        </div>
        <button class="zone-teleport-btn zone-banner-teleport" data-x="${currentZone.center.x + 14}" data-z="${currentZone.center.z}" data-name="${currentZone.name}">
          🚀 Dịch chuyển đến ${currentZone.name}
        </button>
      </div>
      <div class="archimedes-monolith-grid">
        ${treeCardsHtml}
      </div>
    `;
  } else if (currentZone?.template === 'FARM_SANCTUARY') {
    // 4b. Vùng đất Nông Trại Giải Cứu Thú Cưng (FARM_SANCTUARY)
    const qList = currentZone ? worldSession.getQuestionsForSheet(currentZone.sheetName) : [];
    const totalAnimals = Math.max(world?.farmSanctuary?.animals?.length || 0, qList.length, 10);
    const availableKinds = ['cow', 'pig', 'chicken', 'duck', 'dog'];

    const farmSpawn = farmZoneSpawn(currentZone);
    const animalCardsHtml = Array.from({ length: totalAnimals }, (_, i) => {
      const animalEntity = world?.farmSanctuary?.animals?.[i];
      const qItem = qList[i] as any;
      const kind = animalEntity?.kind || qItem?.kind || qItem?.animalKind || availableKinds[i % availableKinds.length];
      const animalId = animalEntity?.id || `farm_${kind}_${i}`;
      const isRescued = state.farmRescued?.[animalId] === true;
      const aPos = animalEntity?.root?.position;
      const targetX = aPos ? currentZone.center.x + aPos.x : farmSpawn.x;
      const targetY = aPos ? aPos.y : farmSpawn.y;
      const targetZ = aPos ? currentZone.center.z + aPos.z + 2 : farmSpawn.z;
      const name = `${getFarmAnimalVietnameseName(kind)} #${i + 1}`;
      const emoji = getFarmAnimalEmoji(kind);
      const cardTitle = qItem?.title || name;
      const cardSubtitle = (qItem?.subtitle && qItem.subtitle !== qItem.title) ? qItem.subtitle : '';
      const cardPrompt = (qItem?.steps && qItem.steps[0] ? qItem.steps[0].prompt : '') || (isRescued
        ? 'Bé đã giải cứu con vật về chuồng an toàn và nhận nông sản!'
        : 'Đang lang thang ngoài cánh đồng, hãy đến gần giải toán để đưa về chuồng!');
      return `
        <div class="archimedes-monolith-card ${isRescued ? 'completed' : ''}">
          <div class="archimedes-card-header">
            <span class="archimedes-card-page">${emoji} ${name}</span>
            <span class="archimedes-card-status">${isRescued ? '🎉 Đã về chuồng' : '🐾 Đang đi lạc'}</span>
          </div>
          <div class="archimedes-card-title">${cardTitle}</div>
          ${cardSubtitle ? `<div class="archimedes-card-sub">${cardSubtitle}</div>` : ''}
          ${cardPrompt && cardPrompt !== cardSubtitle ? `<div class="archimedes-card-desc">${cardPrompt}</div>` : ''}
          <div class="archimedes-card-actions">
            <span class="archimedes-card-readonly-tag">${isRescued ? `${icon('check')} Đã về chuồng` : '🐾 Gặp thú để giải cứu'}</span>
            <button class="zone-teleport-btn archimedes-card-teleport" data-x="${targetX}" data-y="${targetY}" data-z="${targetZ}" data-region="zone:${currentZone.id}" data-name="${currentZone.name}">
              🚀 Đến chỗ thú cưng
            </button>
          </div>
        </div>
      `;
    }).join('');

    contentHtml = `
      <div class="zone-banner" style="background:linear-gradient(135deg,#3f6212,#65a30d)">
        <div class="zone-banner-info">
          <h4>🏡 ${currentZone.name}</h4>
          <p>${currentZone.title && currentZone.title !== currentZone.name ? `${currentZone.title} · ` : ''}Góc nhìn khám phá gần · Giải cứu ${totalAnimals} thú cưng đi lạc · Vị trí: (X: ${Math.round(currentZone.center.x)}, Z: ${Math.round(currentZone.center.z)})</p>
        </div>
        <button class="zone-teleport-btn zone-banner-teleport" data-x="${farmSpawn.x}" data-y="${farmSpawn.y}" data-z="${farmSpawn.z}" data-region="zone:${currentZone.id}" data-name="${currentZone.name}">
          🚀 Đến Cổng Nông Trại
        </button>
      </div>
      <div class="archimedes-monolith-grid">
        ${animalCardsHtml}
      </div>
    `;
  } else if (currentZone?.template === 'QHMJ_SANCTUARY') {
    const placed = world?.getQhmjNodes?.(currentZone.id) ?? [];
    const problems = placed.length > 0 ? placed.map((n) => n.problem) : getQhmjProblemsForZone(currentZone);
    const spawnPos = qhmjZoneSpawn(currentZone);
    const cardsHtml = problems.map((p, i) => {
      const node = placed[i];
      const key = node?.progressKey ?? qhmjProgressKey(currentZone.id, p.id);
      const isDone = adventure.isProblemSolved(key);
      const tierLabel = node
        ? `Tầng ${node.tier} · ${node.kind === 'jump_gate' ? 'Bệ Bật Nhảy' : node.kind === 'clock_summit' ? 'Đỉnh Đồng Hồ' : 'Tinh Thể'}`
        : `Trạm #${i + 1}`;
      const tp = node?.position ?? { x: spawnPos.x, y: 0.37, z: spawnPos.z };
      const pTitle = p.title || `Thử thách #${i + 1}`;
      const pSub = (p.subtitle && p.subtitle !== pTitle) ? p.subtitle : '';
      const pPrompt = p.steps?.[0]?.prompt || '';
      return `
        <div class="archimedes-monolith-card ${isDone ? 'completed' : ''}">
          <div class="archimedes-card-header">
            <span class="archimedes-card-page">${tierLabel}</span>
            <span class="archimedes-card-status">${isDone ? '✅ Đã giải' : '✨ Thử thách'}</span>
          </div>
          <div class="archimedes-card-title">${pTitle}</div>
          ${pSub ? `<div class="archimedes-card-sub">${pSub}</div>` : ''}
          ${pPrompt && pPrompt !== pSub ? `<div class="archimedes-card-desc">${pPrompt}</div>` : ''}
          <div class="archimedes-card-actions">
            <span class="archimedes-card-readonly-tag">${isDone ? `${icon('check')} Đã mở ấn` : '🔮 Leo trạm để giải'}</span>
            <button class="zone-teleport-btn archimedes-card-teleport" data-x="${tp.x}" data-y="${tp.y}" data-z="${tp.z}" data-name="${pTitle}">
              🚀 Đến trạm
            </button>
          </div>
        </div>
      `;
    }).join('');

    contentHtml = `
      <div class="zone-banner" style="background:linear-gradient(135deg,#7f1d1d,#dc2626)">
        <div class="zone-banner-info">
          <h4>🌀 ${currentZone.name}</h4>
          <p>${problems.length} thử thách chia 3 tầng cao độ · Góc nhìn gần thứ nhất · Tọa độ: (${Math.round(currentZone.center.x)}, ${Math.round(currentZone.center.z)})</p>
        </div>
        <button class="zone-teleport-btn zone-banner-teleport" data-x="${spawnPos.x}" data-z="${spawnPos.z}" data-name="${currentZone.name}">
          🚀 Đến ${currentZone.name}
        </button>
      </div>
      <div class="archimedes-monolith-grid">
        ${cardsHtml}
      </div>
    `;
  } else {
    // 5. Các phân khu Archimedes & Vùng đất tùy biến từ Google Sheets
    const qList = currentZone ? worldSession.getQuestionsForSheet(currentZone.sheetName) : [];
    const monolithCardsHtml = qList.map((m) => {
      const isDone = adventure.isProblemSolved(m.id) || (typeof m.id === 'number' && m.id >= 306 && state.monoliths[m.id - 306]);
      const pPos = m.position || { x: currentZone?.center.x || 0, z: currentZone?.center.z || 0 };
      const mTitle = m.title || `Bia Đá ${m.id}`;
      const mSubtitle = (m.subtitle && m.subtitle !== m.title) ? m.subtitle : '';
      const mPrompt = (m.steps && m.steps[0] ? m.steps[0].prompt : '');
      return `
        <div class="archimedes-monolith-card ${isDone ? 'completed' : ''}" data-id="${m.id}">
          <div class="archimedes-card-header">
            <span class="archimedes-card-page">${m.badge || `Bia Đá #${m.id}`}</span>
            <span class="archimedes-card-status">${isDone ? '🏆 Đã giải' : '✨ Thử thách'}</span>
          </div>
          <div class="archimedes-card-title">${mTitle}</div>
          ${mSubtitle ? `<div class="archimedes-card-sub">${mSubtitle}</div>` : ''}
          ${mPrompt && mPrompt !== mSubtitle ? `<div class="archimedes-card-desc">${mPrompt}</div>` : ''}
          <div class="archimedes-card-actions">
            <span class="archimedes-card-readonly-tag">${isDone ? `${icon('check')} Đã giải` : '🏛️ Đến bia đá để giải'}</span>
            <button class="zone-teleport-btn archimedes-card-teleport" data-x="${pPos.x - 1.5}" data-z="${pPos.z}" data-name="${mTitle}">
              🚀 Đến ngay
            </button>
          </div>
        </div>
      `;
    }).join('');

    contentHtml = `
      <div class="zone-banner">
        <div class="zone-banner-info">
          <h4>${getThemeBadgeIcon(currentZone?.theme)} ${currentZone?.name || 'Vùng Đất Archimedes'}</h4>
          <p>${currentZone?.badge || ''} · Vị trí: (X: ${Math.round(currentZone?.center.x || 0)}, Z: ${Math.round(currentZone?.center.z || 0)})</p>
        </div>
        <button class="zone-teleport-btn zone-banner-teleport" data-x="${(currentZone?.center.x || 100) - (currentZone?.width || 36) / 2 + 4}" data-z="${currentZone?.center.z || 0}" data-name="${currentZone?.name}">
          🚀 Dịch chuyển đến đảo này
        </button>
      </div>
      <div class="archimedes-monolith-grid">
        ${monolithCardsHtml || '<p style="padding:24px;text-align:center;color:#666">Chưa có câu hỏi nào trong vùng đất này trên Google Sheets.</p>'}
      </div>
    `;
  }

  openDialog(
    '🗺️ Bản Đồ Vương Quốc Học Toán 3D',
    `
    <div class="dialog-eyebrow">KHÁM PHÁ TOÀN DIỆN · ĐỒNG BỘ GOOGLE SHEETS & TOÁN 2 ARCHIMEDES</div>
    <div class="archimedes-header-banner">
      <div>
        <h3>${zones.length + 1} Vùng Đất & Hòn Đảo Tri Thức</h3>
        <p>Bản đồ thế giới mở 3D: Làng Khởi Đầu, Vườn Hoa và các Quần đảo chuyên đề.</p>
      </div>
      <div class="archimedes-stats">
        <div class="archimedes-stat-box">
          <strong>${totalMonolithCompleted + totalFlowerCompleted}</strong>
          <small>Thử Thách Đã Giải</small>
        </div>
        <div class="archimedes-stat-box">
          <strong>${badgesEarned} / ${Math.max(5, zones.length)}</strong>
          <small>Huy Chương</small>
        </div>
        <button id="map-sync-sheets-btn" class="zone-banner-teleport" style="background:#2563eb;color:#fff;font-size:11px;padding:6px 12px;margin-left:4px" title="Đồng bộ ngay dữ liệu mới nhất từ Google Sheets">
          🔄 Đồng bộ Sheets
        </button>
      </div>
    </div>
    <div class="archimedes-zone-tabs" role="tablist">
      ${zoneTabsHtml}
    </div>
    ${contentHtml}
    `,
    'archimedesMap'
  );

  const mapSyncBtn = $('map-sync-sheets-btn');
  if (mapSyncBtn) {
    mapSyncBtn.onclick = () => {
      const url = getAppsScriptUrl();
      if (!url) {
        toast('⚠️ Vui lòng dán URL Google Apps Script trong Cài Đặt trước.');
        return;
      }
      toast('⏳ Đang đồng bộ câu hỏi mới nhất từ Google Sheets...');
      worldSession.refreshFromRemote()
        .then((fresh) => {
          if (fresh) {
            toast('✨ Đã cập nhật câu hỏi mới từ Google Sheets!');
            openArchimedesMapDialog(selectedZoneId);
          }
        })
        .catch((err) => {
          toast(`⚠️ Không thể đồng bộ: ${err.message}`);
        });
    };
  }

  document.querySelectorAll<HTMLButtonElement>('.archimedes-zone-tab').forEach((tab) => {
    tab.onclick = () => {
      const zId = Number(tab.dataset.zone ?? '0');
      openArchimedesMapDialog(zId);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('.kingdom-zone-inspect-btn').forEach((btn) => {
    btn.onclick = () => {
      const zId = Number(btn.dataset.zone ?? '0');
      openArchimedesMapDialog(zId);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('.zone-teleport-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const x = Number(btn.dataset.x);
      const z = Number(btn.dataset.z);
      const y = btn.dataset.y !== undefined ? Number(btn.dataset.y) : undefined;
      const regionId = btn.dataset.region || undefined;
      const name = btn.dataset.name || 'đích đến';
      closeDialog();
      void teleportWithRegionLoading(x, z, name, Number.isFinite(y) ? y : undefined, regionId);
    };
  });
}

function openArchimedesMonolithDialog(monolithRef: number | string, stepIndex = 0) {
  return challengeDialog.startChallenge({
    type: 'archimedes',
    monolithRef,
    stepIndex,
    questionsBySheet: worldSession.questionsBySheet,
    zones: worldSession.zones,
    monolithProblems: worldSession.monolithProblems
  });
}

function learn(selected: Table = adventure.getState().table || 1) {
  const state = adventure.getState();
  openDialog(
    'Sổ cửu chương',
    `<div class="dialog-eyebrow">HỌC TỪNG CHÚT, NHỚ THẬT LÂU</div><div class="table-tabs" role="group" aria-label="Chọn bảng cửu chương">${TABLES.map(t => `<button data-table="${t}" aria-pressed="${t === selected}">Bảng ×${t}</button>`).join('')}</div><div class="multiplication-grid">${Array.from({ length: 10 }, (_, i) => {
      const s = state.questionStats[`m${selected}_${i + 1}`];
      return `<div><span>${selected} × ${i + 1}</span><b>= ${selected * (i + 1)}</b><small>${s?.correct ? '✓' : ''}</small></div>`;
    }).join('')}</div><p class="book-note">Dấu ✓ là phép nhân bạn đã trả lời đúng. Mình luyện thêm nhé?</p><button id="practice-table" class="primary wide">Luyện bảng ×${selected} ${icon('arrow')}</button><button id="practice-all" class="text-button centered">Trộn tất cả các bảng (×1 đến ×10)</button>`,
    'book'
  );
  document
    .querySelectorAll<HTMLButtonElement>('[data-table]')
    .forEach(b => (b.onclick = () => learn(Number(b.dataset.table) as Table)));
  $('practice-table').onclick = () => {
    adventure.setTable(selected);
    showQuestion('practice');
  };
  $('practice-all').onclick = () => {
    adventure.setTable(0);
    showQuestion('practice');
  };
}
$('learn').onclick = () => learn();
$('learn-welcome').onclick = () => learn();

$('travel').onclick = () => {
  if (!world?.active || world.paused || isRegionTransitioning) return;
  const locName = world.spatial.getCurrentLocationName();
  const parkZone = worldSession.zones.find((z) => classifyZoneTemplate(z) === 'park' && locName === z.name);
  if (parkZone) {
    void teleportWithRegionLoading(-6, 5, 'Làng Khởi Đầu');
  } else if (locName === 'Làng Khởi Đầu') {
    void teleportWithRegionLoading(13, 0, 'Vườn Hoa Tri Thức');
  } else if (locName === 'Vườn Hoa Tri Thức') {
    void teleportWithRegionLoading(60, 0, 'Đền Cổng Archimedes');
  } else {
    void teleportWithRegionLoading(-6, 5, 'Làng Khởi Đầu');
  }
};

function openQuestDialog() {
  const state = adventure.getState();
  const bloomedCount = state.flowers.filter(Boolean).length;
  const monolithProblems = worldSession.monolithProblems;
  const monolithCount = getArchimedesSolvedCount(state, monolithProblems);
  const totalMonoliths = monolithProblems.length > 0 ? monolithProblems.length : 40;
  const zonesForBadges = worldSession.badgeZones.length > 0
    ? worldSession.badgeZones
    : ARCHIMEDES_ZONES;

  const questCopy = state.questComplete
    ? 'Bạn đã nối liền hai bờ! Hãy sang Vườn Hoa Tri Thức hoặc quay lại Milo để luyện tập.'
    : state.bridge === BRIDGE_PARTS
      ? 'Cây cầu đã sẵn sàng! Hãy đi qua cầu sang Vườn Hoa Tri Thức bên kia sông.'
      : state.questAccepted
        ? 'Giúp Milo chọn phép nhân đúng. Mỗi câu trả lời sẽ xây thêm một đoạn cầu.'
        : 'Milo đang chờ bạn bên dòng sông. Đến gần và chào bạn ấy nhé!';

  const questTitle = state.questComplete ? 'Cây cầu tình bạn đã hoàn thành!' : 'Một cây cầu, ngàn niềm vui';

  const bridgeStepsHtml = Array.from(
    { length: BRIDGE_PARTS },
    (_, i) =>
      `<span class="${i < state.bridge ? 'done' : ''}" aria-label="Đoạn ${i + 1}: ${i < state.bridge ? 'đã xây' : 'chưa xây'}">${i < state.bridge ? icon('check') : i + 1}</span>`
  ).join('');

  const flowerDotsHtml = state.flowers
    .map(
      (bloomed, i) =>
        `<span class="flower-dot ${bloomed ? 'bloomed' : ''}" title="Cây hoa ${i + 1}: ${bloomed ? 'Đã nở hoa' : 'Đang ấp nụ'}">${bloomed ? '🌸' : '🌱'}</span>`
    )
    .join('');

  const archBadgesHtml = zonesForBadges.map((z, i) => {
    const earned = state.zoneBadges[i];
    return `<span class="archimedes-badge-dot ${earned ? 'earned' : ''}" title="${z.name} (${earned ? 'Đã đạt' : 'Chưa đạt'})">${earned ? '🏆' : '✦'}</span>`;
  }).join('');

  const questProgressText = state.questComplete
    ? '✓ Hoàn thành'
    : state.bridge === BRIDGE_PARTS
      ? 'Đi qua cầu để hoàn thành'
      : state.questAccepted
        ? `${state.bridge} / ${BRIDGE_PARTS} đoạn cầu`
        : 'Gặp người dẫn đường';

  const body = `
    <div class="quest-dialog-content">
      <section class="quest-dialog-section">
        <div class="eyebrow">${icon('flag')} CHUYẾN PHIÊU LƯU ĐẦU TIÊN</div>
        <h3 class="quest-dialog-title">${questTitle}</h3>
        <p class="dialog-copy" style="font-size:14px;line-height:1.55;margin:0 0 12px">${questCopy}</p>
        <div class="quest-steps">${bridgeStepsHtml}</div>
        <div class="quest-bottom" style="margin-top:12px">
          <span><b>Tiến độ:</b> ${questProgressText}</span>
          <span class="reward">${icon('star')} +10 XP / câu</span>
        </div>
      </section>

      <section class="quest-dialog-section">
        <div class="flower-quest-header">
          <span style="font-size:13px">🌸 Vườn Hoa Tri Thức</span>
          <strong style="font-size:13px;color:#2e6332">${bloomedCount} / 10 hoa nở</strong>
        </div>
        <div class="flower-dots" style="margin:8px 0">${flowerDotsHtml}</div>
        <small style="color:#6d7e6b;display:block">Tương tác với các cây hoa bên bờ đông để trả lời các thử thách toán học.</small>
      </section>

      <section class="quest-dialog-section">
        <div class="archimedes-tracker-header">
          <span style="font-size:13px">🏛️ Vùng Đất Archimedes</span>
          <strong style="font-size:13px;color:#855416">${monolithCount} / ${totalMonoliths} Bia Đá</strong>
        </div>
        <div class="archimedes-badges" style="margin:8px 0">${archBadgesHtml}</div>
        <button id="quest-dialog-map-btn" class="secondary" style="margin-top:10px;width:100%;padding:10px 14px;font-size:13px;border-radius:10px">${icon('star')} Mở Bản Đồ Khám Phá</button>
      </section>

      <button id="quest-dialog-close-btn" class="primary wide" style="margin-top:10px">Tiếp tục khám phá ${icon('arrow')}</button>
    </div>
  `;

  openDialog('Nhiệm Vụ & Tiến Độ', body, 'quest');
  $('quest-dialog-close-btn').onclick = closeDialog;
  const mapBtn = $('quest-dialog-map-btn');
  if (mapBtn) {
    mapBtn.onclick = () => {
      closeDialog();
      openArchimedesMapDialog();
    };
  }
}

function help() {
  openDialog(
    'Sẵn sàng phiêu lưu?',
    `<div class="help-list">
    <div><b>1</b><p><strong>Khám phá ngôi làng & Vườn hoa</strong>Nhấn WASD / phím mũi tên, hoặc chạm xuống đất để di chuyển. Nhấn nút “Đến Vườn Hoa” để dịch chuyển nhanh qua lại.</p></div>
    <div><b>2</b><p><strong>Làm quen với Milo & Cây cầu</strong>Gặp Milo để nhận nhiệm vụ xây cầu bằng 6 phép nhân đúng.</p></div>
    <div><b>3</b><p><strong>Vườn Hoa 10 Thử Thách</strong>Đến gần 10 cây hoa bên bờ đông và nhấn E để trả lời câu hỏi. Mỗi câu đúng sẽ làm cây hoa bung nở rực rỡ!</p></div>
  </div><div class="milo-tip"><p><b>Space</b>: nhảy · <b>Kéo trên làng</b>: xoay camera · <b>Lăn chuột / Chụm-tách 2 ngón</b>: phóng to / thu nhỏ · <b>Esc</b>: tạm dừng.</p></div><button id="understood" class="primary wide">Mình hiểu rồi! ${icon('check')}</button>`,
    'help'
  );
  $('understood').onclick = closeDialog;
}
function checkDeviceTouch(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.innerWidth <= 1024
  );
}

function isWheelControlEnabled(): boolean {
  const pref = localStorage.getItem('wheel_control');
  if (pref !== null) {
    return pref === 'true';
  }
  return true; // Enabled by default across all devices for Direct Locomotion
}

function updateWheelControlVisibility() {
  const enabled = isWheelControlEnabled();
  document.body.classList.toggle('show-touch-controls', enabled);
  const tc = $('touch-controls');
  if (tc) {
    tc.style.display = enabled ? 'flex' : 'none';
  }
}

function setWheelControlEnabled(val: boolean) {
  localStorage.setItem('wheel_control', String(val));
  updateWheelControlVisibility();
}

function applyRestoredPlayer(player: RemotePlayerProgress) {
  // 1. Phục hồi SaveState
  const parsedState = sanitizeSaveState(player.saveData);
  if (player.avatar) {
    parsedState.avatar = player.avatar as any;
  }
  adventure.restoreState(parsedState);

  // 2. Cập nhật Profile
  saveExplorerProfile({
    nickname: player.nickname,
    className: player.className,
    avatar: player.avatar,
    explorerId: player.explorerId,
    passcode: player.passcode,
    isAnonymous: false
  });

  // 3. Cập nhật HUD & Inputs
  updateHUD();
  initWelcomeProfile();

  // 4. Cập nhật Thế giới 3D nếu đang chạy
  if (world) {
    world.setAvatar(parsedState.avatar);
    world.setBridge(parsedState.bridge);
    world.setFlowersBloomed(parsedState.flowers);
    world.setMonolithsActivated((id, index) => {
      return (
        adventure.isProblemSolved(id) ||
        (typeof id === 'number' && id >= 306 && id < 306 + parsedState.monoliths.length && parsedState.monoliths[id - 306] === true)
      );
    });
    if (parsedState.parkTrees && world.syncAwakenedParkTrees) {
      world.syncAwakenedParkTrees(parsedState.parkTrees);
    }
  }

  closeDialog();
  toast(`🎉 Chào mừng ${player.nickname} trở lại! Tiến trình đã được khôi phục thành công.`);
}

function openRestorePasscodeDialog() {
  openDialog(
    'Khôi phục bằng Mã Thám Hiểm',
    `
    <div class="dialog-eyebrow">ĐỒNG BỘ ĐA THIẾT BỊ · GOOGLE SHEETS</div>
    <p class="dialog-copy" style="font-size:14px;margin-bottom:12px">
      Nhập Mã Thám Hiểm (ví dụ: <b>MTH-882</b>) để khôi phục cấp độ, số xu, cây cầu và các bài toán đã giải từ thiết bị khác.
    </p>
    <div class="restore-input-group">
      <input
        id="restore-passcode-input"
        class="welcome-input passcode-input"
        type="text"
        maxlength="16"
        placeholder="MTH-882"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="characters"
        spellcheck="false"
      />
    </div>
    <button id="restore-lookup-btn" class="primary wide" style="margin-top:12px">
      ${icon('cloud')} Tìm kiếm dữ liệu
    </button>
    <div id="restore-result-box" style="margin-top:12px"></div>
    <button id="restore-cancel-btn" class="text-button centered" style="margin-top:8px">Đóng</button>
    `,
    'cloud'
  );

  const cancelBtn = $('restore-cancel-btn');
  if (cancelBtn) cancelBtn.onclick = closeDialog;

  const inputEl = $<HTMLInputElement>('restore-passcode-input');
  const lookupBtn = $<HTMLButtonElement>('restore-lookup-btn');
  const resultBox = $('restore-result-box');

  const executeLookup = async () => {
    if (!inputEl) return;
    const rawCode = inputEl.value.trim();
    const cleanCode = normalizePasscode(rawCode);
    if (!cleanCode) {
      if (resultBox) {
        resultBox.innerHTML = '<p class="feedback gentle" style="display:block">Vui lòng nhập Mã Thám Hiểm của bạn.</p>';
      }
      inputEl.focus();
      return;
    }

    if (lookupBtn) {
      lookupBtn.disabled = true;
      lookupBtn.innerHTML = '<span>⏳ Đang tìm kiếm trên Google Sheets...</span>';
    }
    if (resultBox) {
      resultBox.innerHTML = '<div style="text-align:center;padding:16px;color:#5a7463"><div class="spinner"></div> Đang kiểm tra sổ PLAYERS...</div>';
    }

    const res = await loadPlayerProgressFromSheets(cleanCode);
    if (lookupBtn) {
      lookupBtn.disabled = false;
      lookupBtn.innerHTML = `${icon('cloud')} Tìm kiếm dữ liệu`;
    }

    if (!res.success || !res.player) {
      if (resultBox) {
        resultBox.innerHTML = `
          <div class="feedback gentle" style="display:block;background:#fceee8;border:1px solid #f2cfc2;padding:12px;border-radius:12px;color:#9b4731">
            <strong>Không tìm thấy dữ liệu!</strong>
            <p style="margin:4px 0 0;font-size:13px">${res.message || 'Kiểm tra lại mã và thử lại nhé.'}</p>
          </div>
        `;
      }
      return;
    }

    const player = res.player;
    const playerChar = getCharacter((player.avatar as any) || DEFAULT_AVATAR_ID);
    const flowerText = `${player.flowersBloomed || 0}/10 hoa nở`;
    const bridgeText = `${player.bridgeParts || 0}/6 nhịp cầu`;
    const monolithText = `${player.monolithsActivated || 0} bia đá`;

    if (resultBox) {
      resultBox.innerHTML = `
        <div class="restore-student-card">
          <div class="restore-student-header">
            <div class="restore-avatar-face">${playerChar.emoji}</div>
            <div class="restore-student-info">
              <h4>${player.nickname} <small style="font-weight:normal;color:#788b7f">(${player.className || 'Tự do'})</small></h4>
              <span>Mã Thám Hiểm: <b>${player.passcode}</b></span>
            </div>
          </div>
          <div class="restore-stats-grid">
            <div class="restore-stat-item">
              <span>Cấp độ</span>
              <strong>Cấp ${player.level}</strong>
            </div>
            <div class="restore-stat-item">
              <span>Kinh nghiệm</span>
              <strong>${player.totalXP} XP</strong>
            </div>
            <div class="restore-stat-item">
              <span>Tiền xu</span>
              <strong>${player.totalCoins} 🪙</strong>
            </div>
          </div>
          <div class="restore-progress-pills">
            <span class="restore-pill">🌉 ${bridgeText}</span>
            <span class="restore-pill">🌸 ${flowerText}</span>
            <span class="restore-pill">🏛️ ${monolithText}</span>
            ${player.lastActiveAt ? `<span class="restore-pill">🕒 ${player.lastActiveAt}</span>` : ''}
          </div>
        </div>
        <p style="font-size:13px;color:#5a7463;line-height:1.5;margin:8px 0 14px">
          Bạn có muốn nạp dữ liệu của bạn <b>${player.nickname}</b> vào thiết bị này không?
        </p>
        <button id="confirm-restore-btn" class="primary wide" style="margin-bottom:8px">
          ${icon('check')} Đồng ý khôi phục tiến trình này
        </button>
      `;

      const confirmBtn = $<HTMLButtonElement>('confirm-restore-btn');
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          applyRestoredPlayer(player);
        };
      }
    }
  };

  if (lookupBtn) lookupBtn.onclick = executeLookup;
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeLookup();
      }
    });
    inputEl.focus();
  }
}

function settings() {
  const state = adventure.getState();
  const profile = getExplorerProfile();
  const stats = Object.values(state.questionStats),
    attempts = stats.reduce((a, s) => a + s.attempts, 0),
    correct = stats.reduce((a, s) => a + s.correct, 0);
  openDialog(
    'Một chút cài đặt',
    `<div class="settings-row"><span>Hiệu ứng âm thanh</span><button id="toggle-sound" class="switch" role="switch" aria-checked="${state.sound}" aria-label="Hiệu ứng âm thanh"><i></i></button></div>
    <div class="settings-row"><span>Nhạc nền nhẹ nhàng</span><button id="toggle-music" class="switch" role="switch" aria-checked="${state.music}" aria-label="Nhạc nền"><i></i></button></div>
    <div class="settings-row"><span>Bánh xe di chuyển (Wheel Control)</span><button id="toggle-wheel" class="switch" role="switch" aria-checked="${isWheelControlEnabled()}" aria-label="Bánh xe di chuyển"><i></i></button></div>

    <div class="sheets-config-box">
      <h4>${icon('crown')} Hồ Sơ & Mã Thám Hiểm</h4>
      <p>Mã Thám Hiểm dùng để đồng bộ tiến trình học tập sang thiết bị khác.</p>
      <div class="passcode-display-row">
        <div>
          <small style="display:block;color:#6b8173;font-size:11px">Mã Thám Hiểm của bạn:</small>
          <strong class="passcode-value" id="current-passcode-display">${profile.passcode || 'Đang tạo...'}</strong>
        </div>
        <button id="copy-passcode-btn" class="passcode-copy-btn" title="Sao chép Mã Thám Hiểm">${icon('copy')} Sao chép</button>
      </div>
      <div class="cloud-sync-status-row">
        <div class="cloud-sync-status-badge">
          <span id="settings-sync-indicator-dot" class="status-indicator-dot ${syncManager.getStatus()}"></span>
          <span id="settings-sync-status-text">${getSyncStatusLabel(syncManager.getStatus(), syncManager.getLastSyncedAt(), syncManager.getLastErrorMessage())}</span>
        </div>
        <small id="settings-sync-time-text" style="color:#6b8173;font-size:11px">
          ${syncManager.getLastSyncedAt() ? `Đồng bộ gần nhất: ${formatTimeAgo(syncManager.getLastSyncedAt())}` : 'Chưa đồng bộ'}
        </small>
      </div>
      <div class="profile-inputs-row">
        <div class="profile-field">
          <label for="profile-name">Tên dũng sĩ:</label>
          <input type="text" id="profile-name" value="${profile.nickname}">
        </div>
        <div class="profile-field">
          <label for="profile-class">Lớp học:</label>
          <input type="text" id="profile-class" value="${profile.className}">
        </div>
      </div>
      <div class="sheets-action-row" style="margin-top:10px">
        <button id="save-profile-btn" class="secondary small">${icon('check')} Lưu hồ sơ</button>
        <button id="force-sync-btn" class="secondary small">${icon('cloud')} Đồng bộ ngay</button>
      </div>
      <button id="settings-restore-btn" class="secondary small wide" style="margin-top:8px">${icon('reset')} Chuyển tài khoản / Khôi phục mã khác</button>
    </div>


    <div class="sheets-config-box">
      <h4>${icon('settings')} Thư Viện Tri Thức Trực Tuyến</h4>
      <p>Câu hỏi và bản đồ được nạp tự động từ Google Sheets của hệ thống.</p>
      <div class="sheets-action-row">
        <button id="refresh-sheets-btn" class="primary small" title="Tải lại câu hỏi mới nhất từ Google Sheets">${icon('reset')} Đồng bộ câu hỏi mới nhất</button>
        <button id="seed-sheets-btn" class="secondary small" title="Khởi tạo lại Cấu hình & Vùng đất mẫu lên Google Sheets">${icon('star')} ⚡ Khởi tạo dữ liệu mẫu</button>
      </div>
    </div>

    <div class="sheets-config-box">
      <h4>${icon('device')} Ứng Dụng Thiết BI (PWA)</h4>
      <p>Cài đặt Vương Quốc Học Toán 3D về màn hình chính của máy tính bảng hoặc điện thoại để mở nhanh và học ngoại tuyến.</p>
      <div class="sheets-action-row">
        ${isStandalone()
      ? '<span class="pwa-installed-badge">✓ Đã cài đặt ứng dụng</span>'
      : canInstallPWA()
        ? `<button id="install-pwa-btn" class="primary small">${icon('download')} 📲 Cài đặt ứng dụng về máy</button>`
        : '<span class="book-note">Có thể thêm vào màn hình chính thông qua menu trình duyệt (Chia sẻ ➔ Thêm vào MH chính).</span>'
    }
      </div>
    </div>

    <div class="progress-summary">
      <span><strong>${state.xp}</strong>XP tích lũy</span>
      <span><strong>${attempts}</strong>Lượt trả lời</span>
      <span><strong>${attempts ? Math.round((correct / attempts) * 100) : 0}%</strong>Trả lời đúng</span>
    </div>
    <p class="book-note">Tiến trình tự lưu trên trình duyệt này, không cần tài khoản. Xóa dữ liệu trình duyệt sẽ xóa tiến trình.</p>
    <button id="save-now" class="secondary wide">${icon('save')} Lưu tiến trình</button>
    <button id="return-menu" class="text-button centered">Về màn hình chính</button>
    <button id="reset-progress" class="text-button danger centered">${icon('reset')} Chơi lại từ đầu</button>`,
    'settings'
  );
  $('toggle-sound').onclick = () => {
    adventure.setAudio(!state.sound, state.music);
    audio.enabled = !state.sound;
    updateHUD();
    settings();
  };
  $('toggle-music').onclick = () => {
    adventure.setAudio(state.sound, !state.music);
    audio.music(!state.music);
    settings();
  };
  $('toggle-wheel').onclick = () => {
    setWheelControlEnabled(!isWheelControlEnabled());
    settings();
  };

  $('refresh-sheets-btn').onclick = () => {
    toast('⏳ Đang tải lại câu hỏi mới nhất từ Google Sheets...');
    worldSession.refreshFromRemote()
      .then((fresh) => {
        if (fresh) {
          toast('✨ Đã tải lại câu hỏi mới nhất từ Google Sheets thành công!');
        }
      })
      .catch((err) => {
        toast(`⚠️ Không thể tải dữ liệu: ${err.message}`);
      });
  };

  $('seed-sheets-btn').onclick = () => {
    const url = getAppsScriptUrl();
    toast('⏳ Đang khởi tạo Cấu hình & Vùng đất mẫu lên Google Sheets...');
    seedRemoteDatabase(url)
      .then((res) => {
        toast(`✨ ${res.message}`);
        return worldSession.refreshFromRemote();
      })
      .catch((err) => {
        toast(`⚠️ Khởi tạo thất bại: ${err.message}`);
      });
  };

  const copyPasscodeBtn = $('copy-passcode-btn');
  if (copyPasscodeBtn) {
    copyPasscodeBtn.onclick = async () => {
      const code = profile.passcode || '';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const ta = document.createElement('textarea');
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        copyPasscodeBtn.innerHTML = `${icon('check')} Đã chép!`;
        toast(`Đã sao chép Mã Thám Hiểm: ${code}`);
        setTimeout(() => {
          if (copyPasscodeBtn) copyPasscodeBtn.innerHTML = `${icon('copy')} Sao chép`;
        }, 2000);
      } catch (_) {
        toast(`Mã Thám Hiểm của bạn: ${code}`);
      }
    };
  }

  const forceSyncBtn = $<HTMLButtonElement>('force-sync-btn');
  if (forceSyncBtn) {
    forceSyncBtn.onclick = async () => {
      forceSyncBtn.disabled = true;
      forceSyncBtn.innerHTML = '<span>⏳ Đang đồng bộ...</span>';
      toast('⏳ Đang đồng bộ tiến trình lên Google Sheets...');
      const ok = await syncManager.flushNow();
      forceSyncBtn.disabled = false;
      forceSyncBtn.innerHTML = `${icon('cloud')} Đồng bộ ngay bây giờ`;
      if (ok) {
        toast('☁️ Đã đồng bộ tiến trình lên Google Sheets thành công!');
      } else {
        toast(`⚠️ Đồng bộ thất bại: ${syncManager.getLastErrorMessage() || 'Kiểm tra lại kết nối mạng'}`);
      }
    };
  }

  const settingsRestoreBtn = $('settings-restore-btn');
  if (settingsRestoreBtn) {
    settingsRestoreBtn.onclick = () => {
      closeDialog();
      openRestorePasscodeDialog();
    };
  }

  $('save-profile-btn').onclick = () => {
    const nameInput = $<HTMLInputElement>('profile-name');
    const classInput = $<HTMLInputElement>('profile-class');
    if (nameInput && classInput) {
      saveExplorerProfile({
        nickname: nameInput.value.trim() || 'Dũng Sĩ Tí Hon',
        className: classInput.value.trim() || 'Lớp 2',
        isAnonymous: false
      });
      updateHUD();
      initWelcomeProfile();
      toast('Đã lưu hồ sơ dũng sĩ!');
    }
  };

  const installPwaBtn = $('install-pwa-btn') as HTMLButtonElement | null;
  if (installPwaBtn) {
    installPwaBtn.onclick = async () => {
      const accepted = await promptInstallPWA();
      if (accepted) {
        toast('🎉 Cài đặt ứng dụng thành công!');
        closeDialog();
      }
    };
  }

  $('save-now').onclick = () => {
    if (adventure.save()) toast('Đã lưu hành trình của bạn trên thiết bị này.');
  };
  $('return-menu').onclick = menu;
  $('reset-progress').onclick = () => {
    openDialog(
      'Bắt đầu lại hành trình?',
      `<p class="dialog-copy">XP, xu, cây cầu, hoa đã nở và lịch sử luyện tập trên thiết bị này sẽ bị xóa. Không thể hoàn tác.</p><button id="confirm-reset" class="primary danger-bg wide">Xóa tiến trình và chơi lại</button><button id="cancel-reset" class="text-button centered">Giữ lại hành trình</button>`,
      'reset'
    );
    $('cancel-reset').onclick = settings;
    $('confirm-reset').onclick = () => {
      if (savePositionTimer) clearTimeout(savePositionTimer);
      adventure.resetProgress();
      const fresh = adventure.getState();
      if (world) {
        world.setBridge(0);
        world.setFlowersBloomed(fresh.flowers);
        world.setMonolithsActivated(fresh.monoliths);
        world.syncAwakenedParkTrees(fresh.parkTrees || []);
        world.setEquippedTrail('');
        world.setInitialPosition(-6, 6);
        world.setAvatar(fresh.avatar);
        world.resetCamera();
      }
      lastSavedPos = { x: -6, z: 6 };
      worldSession.clearDeferredSpawn();
      farmTrackerHud.resetState();

      menu();
      toast('Một hành trình mới đang chờ bạn!');
    };
  };
}
const cloudStatusBtn = $('cloud-status-btn');
if (cloudStatusBtn) {
  cloudStatusBtn.onclick = () => {
    const status = syncManager.getStatus();
    const profile = getExplorerProfile();
    if (status === 'offline' || status === 'error') {
      toast('🔄 Đang thử kết nối và đồng bộ lại lên Google Sheets...');
      void syncManager.flushNow();
    } else if (status === 'syncing') {
      toast('⏳ Đang đồng bộ tiến trình của bé lên đám mây...');
    } else if (status === 'synced') {
      const timeText = formatTimeAgo(syncManager.getLastSyncedAt());
      toast(`☁️ Tiến trình đã được lưu an toàn trên đám mây (${timeText}). Mã: ${profile.passcode}`);
    } else {
      toast(`☁️ Mã Thám Hiểm của bạn: ${profile.passcode}. Sẵn sàng đồng bộ.`);
    }
  };
}

syncManager.onStatusChange((status, lastSyncedAt, errorMsg) => {
  const dot = $('cloud-status-dot');
  const btn = $('cloud-status-btn');
  if (dot) {
    dot.className = `cloud-status-dot ${status}`;
  }
  if (btn) {
    let tooltip = 'Trạng thái đồng bộ đám mây';
    if (status === 'synced') {
      tooltip = `Đã lưu lên đám mây (${formatTimeAgo(lastSyncedAt)})`;
    } else if (status === 'syncing') {
      tooltip = 'Đang đồng bộ lên Google Sheets...';
    } else if (status === 'offline') {
      tooltip = 'Offline - Chờ kết nối mạng để đồng bộ';
    } else if (status === 'error') {
      tooltip = `Lỗi kết nối: ${errorMsg || 'Thử lại'}`;
    }
    btn.title = tooltip;
    btn.setAttribute('aria-label', tooltip);
  }

  const settingsSyncText = $('settings-sync-status-text');
  const settingsSyncDot = $('settings-sync-indicator-dot');
  const settingsSyncTime = $('settings-sync-time-text');
  if (settingsSyncText) {
    settingsSyncText.textContent = getSyncStatusLabel(status, lastSyncedAt, errorMsg);
  }
  if (settingsSyncDot) {
    settingsSyncDot.className = `status-indicator-dot ${status}`;
  }
  if (settingsSyncTime) {
    settingsSyncTime.textContent = lastSyncedAt ? `Đồng bộ gần nhất: ${formatTimeAgo(lastSyncedAt)}` : 'Chưa đồng bộ';
  }
});

$('settings').onclick = settings;
const restoreWelcomeBtn = $('restore-welcome');
if (restoreWelcomeBtn) {
  restoreWelcomeBtn.onclick = () => openRestorePasscodeDialog();
}

document.querySelector('.player-card')?.addEventListener('click', () => settings());
$('sound').onclick = () => {
  const state = adventure.getState();
  adventure.setAudio(!state.sound, state.music);
  updateHUD();
};
$('jump').onclick = () => world?.jump();
$('quest-btn').onclick = () => openQuestDialog();
document.getElementById('quest-pill')?.addEventListener('click', () => openQuestDialog());
$('help').onclick = () => help();

document.addEventListener('keydown', e => {
  if (challengeDialog.handleKeyDown(e)) return;
  if (e.repeat && ['e', 'b', 'm', 'j', ' ', 'Escape'].includes(e.key)) return;
  if ($<HTMLDialogElement>('dialog').open) {
    if (e.key.toLowerCase() === 'b' && currentDialog === 'inventory') {
      e.preventDefault();
      closeDialog();
    }
    if (e.key.toLowerCase() === 'm' && currentDialog === 'archimedesMap') {
      e.preventDefault();
      closeDialog();
    }
    if (e.key.toLowerCase() === 'j' && currentDialog === 'quest') {
      e.preventDefault();
      closeDialog();
    }
    return;
  }
  if (!world?.active) return;
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    e.preventDefault();
    world.keys.add(key);
  }
  if (key === ' ') world.jump();
  if (key === 'e') interactAction();
  if (key === 'b') {
    e.preventDefault();
    shopModal.open('inventory', 'inventory');
  }
  if (key === 'm') {
    e.preventDefault();
    openArchimedesMapDialog();
  }
  if (key === 'j') {
    e.preventDefault();
    openQuestDialog();
  }
  if (key === 'escape') {
    e.preventDefault();
    settings();
  }
});
document.addEventListener('keyup', e => world?.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => {
  world?.clearInput();
});
document.addEventListener('visibilitychange', () => {
  world?.clearInput();
  if (document.hidden) {
    audio.music(false);
    if (world) queueSavePosition(world.player.position.x, world.player.position.z, true);
    void syncManager.flushNow();
  } else if (world?.active) {
    audio.music(adventure.getState().music);
  }
});
window.addEventListener('beforeunload', () => {
  if (world) queueSavePosition(world.player.position.x, world.player.position.z, true);
  void syncManager.flushNow();
});

const joystick = $('joystick');
const knob = $('joystick-knob');
const dirUp = joystick.querySelector<HTMLElement>('.wheel-up');
const dirRight = joystick.querySelector<HTMLElement>('.wheel-right');
const dirDown = joystick.querySelector<HTMLElement>('.wheel-down');
const dirLeft = joystick.querySelector<HTMLElement>('.wheel-left');

let joystickId = -1;

function updateDirectionHighlights(x: number, y: number) {
  const threshold = 0.28;
  dirUp?.classList.toggle('active', y < -threshold);
  dirDown?.classList.toggle('active', y > threshold);
  dirRight?.classList.toggle('active', x > threshold);
  dirLeft?.classList.toggle('active', x < -threshold);
}

function joystickMove(e: PointerEvent) {
  if (e.pointerId !== joystickId) return;
  const r = joystick.getBoundingClientRect();
  const centerX = r.left + r.width / 2;
  const centerY = r.top + r.height / 2;
  const dx = e.clientX - centerX;
  const dy = e.clientY - centerY;
  const dist = Math.hypot(dx, dy);

  // Maximum radius knob can move within the wheel
  const maxRadius = Math.max(26, r.width / 2 - 24);

  if (dist <= 0.001) {
    if (world) world.joystick = { x: 0, y: 0 };
    knob.style.transform = '';
    updateDirectionHighlights(0, 0);
    return;
  }

  const intensity = Math.min(1, dist / maxRadius);
  const normX = (dx / dist) * intensity;
  const normY = (dy / dist) * intensity;

  if (world) world.joystick = { x: normX, y: normY };

  const knobDist = Math.min(dist, maxRadius);
  const knobX = (dx / dist) * knobDist;
  const knobY = (dy / dist) * knobDist;
  knob.style.transform = `translate(${knobX}px,${knobY}px)`;

  updateDirectionHighlights(normX, normY);
}

joystick.addEventListener('pointerdown', e => {
  joystickId = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  knob.style.transition = 'none';
  joystickMove(e);
});

joystick.addEventListener('pointermove', joystickMove);

for (const event of ['pointerup', 'pointercancel'] as const) {
  joystick.addEventListener(event, (e: PointerEvent) => {
    if (e.pointerId === joystickId || joystickId !== -1) {
      joystickId = -1;
      if (world) world.joystick = { x: 0, y: 0 };
      knob.style.transition = 'transform 0.15s ease-out';
      knob.style.transform = '';
      updateDirectionHighlights(0, 0);
    }
  });
}

$('jump').addEventListener('pointerdown', e => {
  e.preventDefault();
  if (world?.active && !world.paused) world.jump();
});

updateWheelControlVisibility();
window.addEventListener('resize', () => {
  if (localStorage.getItem('wheel_control') === null) {
    updateWheelControlVisibility();
  }
});
window.addEventListener(
  'pointerdown',
  e => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (localStorage.getItem('wheel_control') === null && !isWheelControlEnabled()) {
        setWheelControlEnabled(true);
      }
    }
  },
  { once: true }
);

const handlePortalAction = () => {
  const nearP = world?.spatial.getNearPortal();
  if (nearP?.requiresSelection) {
    openParkSelectionDialog();
  } else {
    openArchimedesMapDialog();
  }
};
const invBtn = document.getElementById('inventory-btn') || document.getElementById('shop-btn');
if (invBtn) invBtn.onclick = () => shopModal.open('inventory', 'inventory');
$('wallet-btn').onclick = () => shopModal.open('shop', 'full');
$('archimedes-btn').onclick = () => openArchimedesMapDialog();
$('portal-label').onclick = handlePortalAction;

function onWorldFrame(snapshot: WorldFrameSnapshot) {
  if (!world) return;
  near = snapshot.nearMilo;
  nearFlower = snapshot.nearFlowerIndex;
  nearPortal = snapshot.nearPortal !== null;
  nearMonolith = snapshot.nearMonolithIndex;
  nearParkTree = snapshot.nearParkTreeIndex;
  nearShop = snapshot.nearShop;
  nearFarmAnimalId = snapshot.nearFarmAnimalId;
  nearQhmjNode = snapshot.nearQhmjNodeIndex ?? -1;

  if (!isRegionTransitioning && snapshot.active && !snapshot.paused && !$<HTMLDialogElement>('dialog').open) {
    queueSavePosition(snapshot.playerPosition.x, snapshot.playerPosition.z, false, snapshot.playerPosition.y);
    if (snapshot.portalTransit) {
      if (snapshot.portalTransit.requiresSelection) {
        openParkSelectionDialog();
      } else if (snapshot.portalTransit.target) {
        void teleportWithRegionLoading(
          snapshot.portalTransit.target.x,
          snapshot.portalTransit.target.z,
          snapshot.portalTransit.name,
          undefined,
          snapshot.portalTransit.targetRegionId
        );
      } else {
        audio.playCue('jump');
        world.burstPlayer(1.0);
        queueSavePosition(snapshot.playerPosition.x, snapshot.playerPosition.z, true);
        toast(`✨ ${snapshot.portalTransit.name}!`);
      }
    }
  }

  const activeFarmZone = snapshot.active ? getActiveFarmZone(snapshot.activeRegionId) : null;
  let farmPlayerLocalPos: { x: number; z: number } | null = null;
  if (!activeFarmZone || !world.farmSanctuary) {
    farmTrackerHud.hide();
  } else {
    const farmOrigin = world.farmSanctuary.group?.position ?? {
      x: activeFarmZone.center.x,
      z: activeFarmZone.center.z
    };
    farmPlayerLocalPos = {
      x: snapshot.playerPosition.x - farmOrigin.x,
      z: snapshot.playerPosition.z - farmOrigin.z
    };
    farmTrackerHud.updateCompass(farmPlayerLocalPos, snapshot.cameraYaw ?? 0);
  }

  if (!snapshot.hudPoses) return;

  const locName = snapshot.locationName;
  let subLabel = 'KHÁM PHÁ · HỌC HỎI · TRƯỞNG THÀNH';
  const dynZone = worldSession.zones.find((z) => z.name === locName);
  if (dynZone) {
    subLabel = classifyZoneTemplate(dynZone) === 'park'
      ? 'KHÔNG GIAN XANH · THƯ GIÃN · KHÁM PHÁ'
      : `${dynZone.badge} · CHỦ ĐỀ ${dynZone.theme || 'KHÁM PHÁ'}`;
  } else if (locName === 'Vườn Hoa Tri Thức') subLabel = '10 THỬ THÁCH HOA NỞ';
  else if (locName === 'Đền Cổng Archimedes') subLabel = 'TRUNG TÂM CỔNG KHÔNG GIAN';
  else if (snapshot.inArchimedes) subLabel = '40 BIA ĐÁ TRI THỨC';

  let interactTargetLabel: { html: string; visible: boolean } | undefined;
  if (nearShop) {
    interactTargetLabel = {
      html: `🛍️ <b>Tiệm Tạp Hóa Vương Quốc</b> (Bấm E để vào tiệm) ${icon('arrow')}`,
      visible: !snapshot.paused
    };
  } else if (nearFarmAnimalId) {
    const animal = world.farmSanctuary?.animals.find(a => a.id === nearFarmAnimalId);
    const animalName = animal ? getFarmAnimalVietnameseName(animal.kind) : 'Bé Thú';
    const trigger = world.farmSanctuary?.getInteractTriggers().find(t => t.animalId === nearFarmAnimalId);
    const pd = trigger?.problemData;
    const probTitle = pd?.title || pd?.subtitle || `Bé ${animalName} Cần Giúp Đỡ`;
    const isRescued = adventure.getState().farmRescued?.[nearFarmAnimalId] === true;
    interactTargetLabel = {
      html: `🐾 <b>${probTitle}</b> ${isRescued ? '(Đã về chuồng - Xem lại)' : '(Bấm E để giải bài)'} ${icon('arrow')}`,
      visible: !snapshot.paused
    };
  } else if (nearQhmjNode !== -1) {
    const activeReg = world.getActiveRegionId?.() ?? '';
    const activeZoneId = activeReg.startsWith('zone:') ? Number(activeReg.slice(5)) : NaN;
    const placed = !Number.isNaN(activeZoneId) ? (world.getQhmjNodes?.(activeZoneId) ?? []) : [];
    const node = placed.find((n) => n.index === nearQhmjNode) ?? placed[nearQhmjNode];
    if (node) {
      const done = adventure.isProblemSolved(node.progressKey);
      const nodeTitle = node.problem.title || `Trạm #${nearQhmjNode + 1}`;
      const prefix = node.kind === 'jump_gate' ? '🔓' : node.kind === 'clock_summit' ? '🕰️' : '🔮';
      const actionHint = done
        ? '(Đã hoàn thành - Xem lại)'
        : node.kind === 'jump_gate'
          ? '(Bấm E để mở khóa bệ nhảy)'
          : '(Bấm E để giải bài)';
      interactTargetLabel = {
        html: `${prefix} <b>${nodeTitle}</b> ${actionHint} ${icon('arrow')}`,
        visible: !snapshot.paused
      };
    }
  } else if (nearParkTree !== -1) {
    const parkZone = worldSession.zones.find((z) => classifyZoneTemplate(z) === 'park');
    const sheetName = parkZone?.sheetName || 'CongVienXanh';
    const parkQuestions = worldSession.getQuestionsForSheet(sheetName);
    const prob = parkQuestions[nearParkTree];
    const treeTitle = prob?.title || prob?.subtitle || `Cây Tri Thức #${nearParkTree + 1}`;
    const awakened = adventure.isParkTreeAwakened(nearParkTree) || (prob?.id ? adventure.isProblemSolved(prob.id) : false);
    interactTargetLabel = {
      html: `🌳 <b>${treeTitle}</b> ${awakened ? '(Đã thức tỉnh - Xem lại)' : '(Bấm E để giải bài)'} ${icon('arrow')}`,
      visible: !snapshot.paused
    };
  } else if (nearMonolith !== -1) {
    const dynamicProb = worldSession.monolithProblems[nearMonolith];
    const mId = dynamicProb?.id !== undefined ? dynamicProb.id : (306 + nearMonolith);
    const mTitle = dynamicProb?.title || dynamicProb?.subtitle || `Bia Đá ${mId}`;
    const done = adventure.isProblemSolved(mId) || (typeof mId === 'number' && mId >= 306 && mId < 306 + adventure.getState().monoliths.length && adventure.getState().monoliths[mId - 306]);
    interactTargetLabel = {
      html: `⚡ <b>${mTitle}</b> ${done ? '(Đã kích hoạt - Xem lại)' : '(Bấm E để giải bài)'} ${icon('arrow')}`,
      visible: !snapshot.paused
    };
  } else if (!nearPortal && nearFlower !== -1) {
    const flowerProb = worldSession.getQuestionsForSheet('VuonHoa')[nearFlower];
    const flowerTitle = flowerProb?.title || flowerProb?.subtitle || `Cây Hoa ${nearFlower + 1}`;
    const bloomed = adventure.getState().flowers[nearFlower];
    interactTargetLabel = {
      html: `${icon('flower')} <b>${flowerTitle}</b> ${bloomed ? '(Đã nở - Xem lại)' : '(Bấm E để làm nở hoa)'} ${icon('arrow')}`,
      visible: !snapshot.paused
    };
  }

  hudPresenter.renderSnapshot(snapshot, {
    subLabel,
    interactTargetLabel,
    arrowHtml: icon('arrow')
  });

  if (activeFarmZone && farmPlayerLocalPos) {
    farmTrackerHud.sync({
      animals: buildFarmTrackerSources(activeFarmZone),
      playerLocalPos: farmPlayerLocalPos,
      cameraYaw: snapshot.cameraYaw ?? 0
    });
  }

  if (snapshot.active && !snapshot.paused && snapshot.crossedRiver) {
    const delta = adventure.completeRiverCrossing();
    if (delta.completed) {
      updateHUD();
      audio.playCue('celebrate');
      world.burstPlayer(1.0);
      openDialog(
        'Bạn đã làm được rồi!',
        `<div class="completion-medal">${icon('crown')}</div><p class="dialog-copy centered">Nhờ bạn, hai bờ đã được nối liền.<br><b>Cây cầu tình bạn</b> đã hoàn thành!<br>Hãy khám phá <b>Vườn Hoa Tri Thức</b> ở bờ bên này nhé!</p><div class="completion-rewards"><span>★ +50 XP</span><span>◉ +10 xu</span></div><button id="keep-playing" class="primary wide">Tiếp tục khám phá ${icon('arrow')}</button>`,
        'complete'
      );
      $('keep-playing').onclick = closeDialog;
    }
  }
}

async function ensureWorld(): Promise<WorldHandle> {
  const init = adventure.getState();
  if (init.started && init.position) {
    lastSavedPos = { x: init.position.x, z: init.position.z };
  }

  return worldSession.launch({
    canvas: $<HTMLCanvasElement>('world'),
    initialPosition: (init.started && init.position) ? init.position : null,
    onTeleport: (x, z) => queueSavePosition(x, z, true),
    onJump: () => audio.playCue('jump'),
    onSceneClick: () => interactAction(),
    onFlowerClick: (idx) => openFlowerDialog(idx),
    onMonolithClick: (idx, id) => openArchimedesMonolithDialog(id !== undefined ? id : idx, 0),
    onParkTreeClick: (idx) => openParkTreeDialog(idx),
    onPortalClick: handlePortalAction,
    onShopClick: () => shopModal.open('shop', 'full'),
    onFarmAnimalClick: (animalId) => openFarmAnimalDialog(animalId),
    onQhmjNodeClick: (zoneId, nodeIndex) => { void openQhmjNodeDialog(zoneId, nodeIndex); },
    onFrame: onWorldFrame
  });
}

// Khởi tạo ngay lập tức App Shell (<50ms)
$('loading').hidden = true;
initWelcomeProfile();
updateHUD();
adventure.subscribe(() => {
  updateHUD();
});

// Tự động kiểm tra di chuyển dữ liệu cục bộ lên đám mây (Ticket 04)
void runLocalStorageMigration(adventure, undefined, syncManager, defaultStorage, (msg) => {
  toast(msg);
});

// Tải ngầm 3D engine dưới nền khi luồng chính rảnh (Speculative Preload)
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => {
    worldSession.preloadEngine().catch((err) => console.warn('Preload ngầm 3D:', err));
  });
} else {
  setTimeout(() => {
    worldSession.preloadEngine().catch((err) => console.warn('Preload ngầm 3D:', err));
  }, 100);
}

// Nạp câu hỏi và bản đồ từ Google Sheets dưới nền (cache 30 phút & Stale-While-Revalidate)
worldSession.bootSync().catch((err) => {
  console.warn('Lỗi nạp câu hỏi khởi động:', err);
});

// Read-only game state for browsers that support WebMCP.
interface ModelContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => Promise<object>;
    },
    options: { signal: AbortSignal }
  ): void | Promise<void>;
}
const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
const lifecycle = new AbortController();
if (modelContext?.registerTool) {
  try {
    void Promise.resolve(
      modelContext.registerTool(
        {
          name: 'read_adventure_progress',
          description:
            'Read local progress in Multiplication Kingdom: XP, coins, completed bridge segments and review count.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true },
          execute: async input => {
            if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length)
              throw new Error('Expected an empty object');
            const s = adventure.getState();
            return {
              xp: s.xp,
              coins: s.coins,
              bridgeSegments: s.bridge,
              questComplete: s.questComplete,
              reviewCount: s.review.length,
              flowersBloomed: s.flowers.filter(Boolean).length
            };
          }
        },
        { signal: lifecycle.signal }
      )
    ).catch(() => { });
  } catch {
    /* Optional browser capability; gameplay stays available. */
  }
}
window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });

initPWA({
  onNeedRefresh(update) {
    toast('🎉 Đã có bản cập nhật mới! Nhấn để làm mới', 15000, () => {
      update();
    });
  }
});
