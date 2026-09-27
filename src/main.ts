import './style.css';
import { Vector3 } from 'three';
import { World } from './world/World';
import { Adventure } from './core/adventure';
import { BRIDGE_PARTS, LEVEL_XP, TABLES, getLevel, type Table } from './data/config';
import { generateQuestion } from './quiz/engine';
import {
  createMultiplicationChallenge,
  createFlowerChallenge,
  createArchimedesChallenge,
  ChallengeSession,
  parseAnswer,
  type MultiplicationChallenge,
  type FlowerChallenge,
  type ArchimedesChallenge
} from './quiz/session';
import {
  ARCHIMEDES_ZONES,
  type ArchimedesMonolith
} from './data/archimedesTrialMap';
import { AudioManager } from './audio/audio';
import {
  loadZonesAndQuestions,
  getAppsScriptUrl,
  getExplorerProfile,
  saveExplorerProfile,
  logRemoteProgress,
  fetchRemoteData,
  resolveZoneProblemsWithPositions,
  seedRemoteDatabase,
  getBundledFallbackData,
  REMOTE_CACHE_KEY
} from './core/sheetsClient';
import type { RemoteZoneConfig, RemoteProblem } from './data/remoteTypes';

const icons: Record<string, string> = {
  crown: '<path d="m3 6 5 4 4-7 4 7 5-4-2 13H5Z"/><path d="M8 15h8"/>',
  book: '<path d="M12 6c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V5c-3-1-7-1-10 1Zm0 0v15"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12m3-9c-5-3-7 2-3 3s3 5-3 3"/>',
  flag: '<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
  jump: '<path d="M12 21V3m-6 6 6-6 6 6"/>',
  save: '<path d="M5 3h12l4 4v14H3V3h2Zm2 0v7h10V3M7 21v-7h10v7"/>',
  flower: '<circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 0 0-3 3c0 2 3 4 3 4s3-2 3-4a3 3 0 0 0-3-3Zm0 13s-3 2-3 4a3 3 0 0 0 6 0c0-2-3-4-3-4ZM2 12a3 3 0 0 0 3 3c2 0 4-3 4-3s-2-3-4-3a3 3 0 0 0-3 3Zm13 0s2 3 4 3a3 3 0 0 0 0-6c-2 0-4 3-4 3Z"/>',
  zoom: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>'
};

const icon = (name: string) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.star}</svg>`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const adventure = new Adventure();
const audio = new AudioManager();
let world: World;
let currentSession: ChallengeSession | undefined;
let mode: 'bridge' | 'practice' = 'bridge';
let currentDialog = '';
let currentInputValue = '';
let toastTimer = 0;
let near = false;
let nearFlower = -1;
let nearPortal = false;
let nearMonolith = -1;
let frameTick = 0;
let activeRemoteZones: RemoteZoneConfig[] = [];
let activeRemoteQuestions: Record<string, RemoteProblem[]> = {};
let activeMonolithProblems: RemoteProblem[] = [];

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

function syncDynamicContent(data: { zones: RemoteZoneConfig[]; questionsBySheet: Record<string, RemoteProblem[]> }) {
  activeRemoteZones = data.zones;
  activeRemoteQuestions = data.questionsBySheet;
  if (!world) return;

  const monolithProblems: RemoteProblem[] = [];
  data.zones.forEach((z) => {
    const list = data.questionsBySheet[z.sheetName] || [];
    const resolved = resolveZoneProblemsWithPositions(z, list);

    // Vườn Hoa Tri Thức là khu vực hoa 3D, tuyệt đối KHÔNG sinh bia đá
    if (z.template === 'FLOWER_BEDS' || z.id === 6 || z.sheetName === 'VuonHoa') {
      return;
    }
    monolithProblems.push(...resolved);
  });
  activeMonolithProblems = monolithProblems;

  world.renderDynamicZones(
    data.zones,
    monolithProblems.map((p) => ({
      id: p.id,
      position: p.position!,
      color: p.color,
      title: p.title
    }))
  );

  world.spatial.setDynamicData(
    data.zones,
    monolithProblems.filter((p) => p.position).map((p) => p.position!)
  );
  updateHUD();
}

const app = $('app');
app.innerHTML = `
  <main class="game-shell">
    <canvas id="world" aria-label="Làng Khởi Đầu và Vườn Hoa Tri Thức 3D. Di chuyển bằng WASD, phím mũi tên hoặc chạm xuống đất."></canvas>
    <div id="loading" class="loading"><span class="loading-crown">${icon('crown')}</span><strong>Đang mở cánh cổng…</strong></div>
    <header class="topbar">
      <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Vương Quốc Học Toán 3D"><span class="brand-mark">${icon('crown')}</span><span>VƯƠNG QUỐC<small>HỌC TOÁN <b>3D</b></small></span></a>
      <div class="top-right"><span class="village-status"><i id="status-dot"></i><span id="village-status-text">Làng Khởi Đầu</span></span><button id="sound" class="icon-button" title="Bật / tắt âm thanh" aria-label="Tắt âm thanh">${icon('sound')}</button><button id="settings" class="icon-button" title="Cài đặt" aria-label="Cài đặt">${icon('settings')}</button></div>
    </header>
    <section id="welcome" class="welcome">
      <div class="chapter"><span></span> MỘT CUỘC PHIÊU LƯU NHỎ</div>
      <h1>Vương Quốc<br><span>Học Toán</span><sup>3D</sup></h1>
      <p>Mỗi phép nhân, một điều kỳ diệu.<br>Cùng Milo xây cầu và khám phá Vườn Hoa Tri Thức!</p>
      <div class="choose-label">Chọn người bạn đồng hành</div>
      <div class="avatar-options" role="group" aria-label="Chọn nhân vật"><button id="boy" class="avatar-option" aria-pressed="true"><span>👦</span>Nhà thám hiểm</button><button id="girl" class="avatar-option" aria-pressed="false"><span>👧</span>Nhà khám phá</button></div>
      <button id="play" class="primary play-button">Bắt đầu phiêu lưu ${icon('arrow')}</button>
      <button id="learn-welcome" class="text-button">${icon('book')} Khám phá bảng cửu chương</button>
      <div class="welcome-notes"><span>✦ Học qua những chuyến đi</span><span>Không giới hạn thời gian</span></div>
    </section>
    <div id="world-caption" class="world-caption"><span>01</span><div>Làng Khởi Đầu<small>Bảng cửu chương ×1 – ×10 & Vườn Hoa</small></div></div>
    <div id="hud" class="hud" hidden>
      <div class="player-card"><span id="avatar-face" class="avatar-face">👦</span><div><strong>Nhà thám hiểm <span id="level">1</span></strong><div class="xp-track" role="progressbar" aria-label="Tiến độ cấp độ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="xp-fill"></i></div><small id="xp-text">0 / 100 XP</small></div></div>
      <div class="wallet">${icon('coin')}<strong id="coins">0</strong><span>xu</span></div>
      <aside class="quest-card">
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
      <button id="portal-label" class="world-label" aria-label="Cổng Archimedes" hidden><span class="milo-dot">🏛️</span><strong>Cổng Archimedes</strong><small>40 Bia Đá Tri Thức</small></button>
      <div class="bottom-bar">
        <div class="controls-hint"><span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Di chuyển</span><span class="divider"></span><kbd>Space</kbd><span>Nhảy</span><span class="divider"></span><span>Kéo chuột để xoay</span></div>
        <div class="toolbar">
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
    <div id="image-lightbox" class="image-lightbox" hidden role="dialog" aria-modal="true" aria-label="Phóng to hình ảnh">
      <div class="lightbox-backdrop"></div>
      <div class="lightbox-wrapper">
        <button id="lightbox-close" class="lightbox-close-btn" aria-label="Đóng phóng to">${icon('close')}</button>
        <img id="lightbox-img" class="lightbox-img" src="" alt="Hình ảnh chi tiết" />
      </div>
    </div>
  </main>`;

function toast(message: string) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ($('toast').hidden = true), 4200);
}

function updateHUD() {
  const state = adventure.getState();
  const level = getLevel(state.xp),
    start = LEVEL_XP[level - 1],
    next = LEVEL_XP[level];
  const profile = getExplorerProfile();
  $('level').textContent = `${level} · ${profile.nickname}`;
  $('coins').textContent = String(state.coins);
  $('xp-text').textContent = next ? `${state.xp - start} / ${next - start} XP` : `${state.xp} XP · Cấp cao nhất`;
  const percent = next ? Math.min(100, ((state.xp - start) / (next - start)) * 100) : 100;
  $('xp-fill').style.width = `${percent}%`;
  $('xp-fill').parentElement!.setAttribute('aria-valuenow', String(Math.round(percent)));
  $('avatar-face').textContent = state.avatar === 'girl' ? '👧' : '👦';
  $('boy').setAttribute('aria-pressed', String(state.avatar === 'boy'));
  $('girl').setAttribute('aria-pressed', String(state.avatar === 'girl'));
  $('play').innerHTML = `${state.started ? 'Tiếp tục phiêu lưu' : 'Bắt đầu phiêu lưu'} ${icon('arrow')}`;
  $('quest-copy').textContent = state.questComplete
    ? 'Bạn đã nối liền hai bờ! Hãy sang Vườn Hoa Tri Thức hoặc quay lại Milo để luyện tập.'
    : state.bridge === BRIDGE_PARTS
      ? 'Cây cầu đã sẵn sàng! Hãy đi qua cầu sang Vườn Hoa Tri Thức bên kia sông.'
      : state.questAccepted
        ? 'Giúp Milo chọn phép nhân đúng. Mỗi câu trả lời sẽ xây thêm một đoạn cầu.'
        : 'Milo đang chờ bạn bên dòng sông. Đến gần và chào bạn ấy nhé!';
  $('quest-title').textContent = state.questComplete ? 'Cây cầu tình bạn đã hoàn thành!' : 'Một cây cầu, ngàn niềm vui';
  $('quest-progress').textContent = state.questComplete
    ? '✓ Hoàn thành'
    : state.bridge === BRIDGE_PARTS
      ? 'Đi qua cầu để hoàn thành'
      : state.questAccepted
        ? `${state.bridge} / ${BRIDGE_PARTS} đoạn cầu`
        : 'Gặp người dẫn đường';
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
  const monolithCount = state.monoliths.filter(Boolean).length;
  const totalMonoliths = activeMonolithProblems.length > 0 ? activeMonolithProblems.length : 40;
  $('monolith-count').textContent = `${monolithCount} / ${totalMonoliths} Bia Đá`;
  const zonesForBadges = activeRemoteZones.length > 0
    ? activeRemoteZones.filter((z) => z.id !== 6 && z.sheetName !== 'VuonHoa')
    : ARCHIMEDES_ZONES;
  $('archimedes-badges').innerHTML = zonesForBadges.map((z, i) => {
    const earned = state.zoneBadges[i];
    return `<span class="archimedes-badge-dot ${earned ? 'earned' : ''}" title="${z.name} (${earned ? 'Đã đạt' : 'Chưa đạt'})">${earned ? '🏆' : '✦'}</span>`;
  }).join('');
}

function openDialog(title: string, body: string, kind: string) {
  world.paused = true;
  world.clearInput();
  currentDialog = kind;
  $('dialog-content').innerHTML = `<h2 id="dialog-title">${title}</h2>${body}`;
  const dialog = $<HTMLDialogElement>('dialog');
  if (!dialog.open) dialog.showModal();
}

function closeDialog() {
  $<HTMLDialogElement>('dialog').close();
}

$('dialog').addEventListener('close', () => {
  world.paused = false;
  world.clearInput();
  currentDialog = '';
  currentSession = undefined;
  currentInputValue = '';
});

$('close-dialog').onclick = closeDialog;

function openLightbox(src: string, alt?: string) {
  const lightbox = $('image-lightbox');
  const img = $<HTMLImageElement>('lightbox-img');
  if (!lightbox || !img) return;
  img.src = src;
  img.alt = alt || 'Hình ảnh chi tiết';
  lightbox.hidden = false;
}

function closeLightbox() {
  const lightbox = $('image-lightbox');
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  const img = $<HTMLImageElement>('lightbox-img');
  if (img) img.src = '';
}

$('lightbox-close').onclick = closeLightbox;
$('image-lightbox').addEventListener('click', (e) => {
  if (e.target === $('image-lightbox') || (e.target as HTMLElement).classList.contains('lightbox-backdrop')) {
    closeLightbox();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const lightbox = $('image-lightbox');
    if (lightbox && !lightbox.hidden) {
      closeLightbox();
      e.stopPropagation();
    }
  }
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const container = target.closest<HTMLElement>('.question-image-container');
  if (container && !container.classList.contains('img-error')) {
    const img = container.querySelector<HTMLImageElement>('.question-inline-img');
    if (img && img.src) {
      openLightbox(img.src, img.alt);
    }
  }
});

function renderQuestionImage(imageUrl?: string, altText?: string, isExplanation = false): string {
  if (!imageUrl) return '';
  return `
    <div class="question-image-container ${isExplanation ? 'explanation-img-container' : ''}">
      <div class="question-image-wrapper">
        <img
          class="question-inline-img"
          src="${imageUrl}"
          alt="${altText || 'Hình minh họa'}"
          loading="lazy"
          onerror="const c = this.closest('.question-image-container'); if(c) c.classList.add('img-error');"
        />
        <div class="img-zoom-overlay">
          <span class="img-zoom-badge">${icon('zoom')} Phóng to</span>
        </div>
      </div>
      <div class="img-error-fallback">
        <span>⚠️ Không thể nạp hình ảnh</span>
        ${/^https?:\/\//.test(imageUrl) ? `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="img-fallback-link">Mở link ↗</a>` : ''}
      </div>
    </div>
  `;
}

function start() {
  adventure.setStarted(true);
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

  // Nạp và đồng bộ dữ liệu từ Google Sheets
  loadZonesAndQuestions((fresh) => {
    syncDynamicContent(fresh);
    toast('✨ Đã cập nhật câu hỏi mới từ Google Sheets!');
  }).then((data) => {
    syncDynamicContent(data);
  });

  toast('Chào bạn! Di chuyển đến Milo, hoặc nhấn "Đến Vườn Hoa" để khám phá!');
}

function menu() {
  closeDialog();
  world.active = false;
  world.clearInput();
  $('welcome').hidden = false;
  $('hud').hidden = true;
  $('world-caption').hidden = false;
  $('menu-footer').hidden = false;
  document.body.classList.remove('playing');
  updateHUD();
  audio.music(false);
}

$('play').onclick = start;
for (const avatar of ['boy', 'girl'] as const)
  $(avatar).onclick = () => {
    adventure.setAvatar(avatar);
    world.setAvatar(avatar);
    updateHUD();
  };

function talk() {
  if (!world.active || world.paused) return;
  if (!near) {
    toast('Hãy đến gần Milo — người bạn có chiếc mũ xanh bên bờ sông.');
    return;
  }
  const state = adventure.getState();
  const complete = state.bridge === BRIDGE_PARTS;
  openDialog(
    'Chào bạn, mình là Milo!',
    `<div class="dialog-eyebrow">NGƯỜI DẪN ĐƯỜNG CỦA BẠN</div><p class="dialog-copy">${complete ? 'Cây cầu của chúng mình thật đẹp! Bạn có thể chọn luyện bất kỳ bảng cửu chương nào từ <b>bảng ×1 đến bảng ×10</b> hoặc cùng mình xây thêm kiến thức nhé!' : 'Vườn Hoa Tri Thức bên kia sông đang chờ chúng mình. Hãy giúp mình xây <strong>6 đoạn cầu</strong> bằng những viên đá phép thuật nhé! Bạn có thể luyện tập đầy đủ từ <strong>bảng ×1 đến bảng ×10</strong>.'}</p><div class="milo-tip"><span>✦</span><p>${complete ? 'Sổ cửu chương có đầy đủ 10 bảng nhân (×1 đến ×10). Bạn có thể chọn riêng từng bảng để luyện tập hoặc trộn lẫn tất cả!' : 'Chọn phép nhân cho đúng số viên đá. Mỗi câu đúng: <b>+10 XP, +5 xu</b>. Nếu chưa nhớ, bạn hãy mở Sổ cửu chương để xem lại nhé!'}</p></div><button id="accept-quest" class="primary wide">${complete ? 'Cùng luyện tập phép nhân' : 'Cùng xây cầu nào!'} ${icon('arrow')}</button><button id="milo-open-book" class="secondary wide">${icon('book')} Mở Sổ cửu chương (Bảng ×1 – ×10)</button>`,
    'milo'
  );
  $('accept-quest').onclick = () => {
    adventure.acceptQuest();
    updateHUD();
    showQuestion(complete ? 'practice' : 'bridge');
  };
  $('milo-open-book').onclick = () => {
    learn();
  };
}
$('milo-label').onclick = talk;

function interactAction() {
  if (!world.active || world.paused) return;
  if (nearMonolith !== -1) {
    openArchimedesMonolithDialog(nearMonolith, 0);
  } else if (nearPortal) {
    openArchimedesMapDialog();
  } else if (nearFlower !== -1) {
    openFlowerDialog(nearFlower);
  } else if (near) {
    talk();
  }
}

$('interact').onclick = interactAction;

function renderMathInputAndNumpad(unit = ''): string {
  return `
    <div class="math-input-container">
      <div id="math-input-box" class="math-input-display placeholder" tabindex="0">?</div>
      ${unit ? `<span class="math-input-unit">${unit}</span>` : ''}
    </div>
    <div class="numpad-container">
      <div class="numpad-grid">
        <button type="button" class="numpad-btn" data-key="1">1</button>
        <button type="button" class="numpad-btn" data-key="2">2</button>
        <button type="button" class="numpad-btn" data-key="3">3</button>
        <button type="button" class="numpad-btn" data-key="4">4</button>
        <button type="button" class="numpad-btn" data-key="5">5</button>
        <button type="button" class="numpad-btn" data-key="6">6</button>
        <button type="button" class="numpad-btn" data-key="7">7</button>
        <button type="button" class="numpad-btn" data-key="8">8</button>
        <button type="button" class="numpad-btn" data-key="9">9</button>
        <button type="button" class="numpad-btn numpad-action" data-key="clear" title="Xóa hết">C</button>
        <button type="button" class="numpad-btn" data-key="0">0</button>
        <button type="button" class="numpad-btn numpad-action" data-key="backspace" title="Xóa lùi">⌫</button>
      </div>
      <button type="button" id="numpad-submit" class="numpad-submit-btn">
        ${icon('check')} Kiểm tra đáp án
      </button>
    </div>
  `;
}

function updateMathInputDisplay(val: string) {
  const box = $('math-input-box');
  if (!box) return;
  if (!val) {
    box.textContent = '?';
    box.classList.add('placeholder');
  } else {
    box.textContent = val;
    box.classList.remove('placeholder');
  }
}

function handleNumpadInput(key: string) {
  if (!currentSession || currentSession.isSolved()) return;
  const box = $('math-input-box');
  if (box) box.classList.remove('shake', 'error');

  if (key === 'backspace') {
    if (currentInputValue.length > 0) {
      currentInputValue = currentInputValue.slice(0, -1);
      updateMathInputDisplay(currentInputValue);
    }
  } else if (key === 'clear') {
    currentInputValue = '';
    updateMathInputDisplay(currentInputValue);
  } else if (/^[0-9]$/.test(key)) {
    if (currentInputValue.length < 4) {
      currentInputValue += key;
      updateMathInputDisplay(currentInputValue);
    }
  }
}

function setupNumpadListeners(onSubmit: (val: string) => void) {
  currentInputValue = '';
  document.querySelectorAll<HTMLButtonElement>('.numpad-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      if (key) handleNumpadInput(key);
    };
  });

  const submitBtn = $('numpad-submit');
  if (submitBtn) {
    submitBtn.onclick = () => {
      if (!currentInputValue) {
        const box = $('math-input-box');
        if (box) {
          box.classList.remove('shake');
          void box.offsetWidth;
          box.classList.add('shake');
        }
        return;
      }
      onSubmit(currentInputValue);
    };
  }

  document.querySelectorAll<HTMLButtonElement>('.comp-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.value ?? '';
      currentInputValue = val;
      updateMathInputDisplay(val);
      onSubmit(val);
    };
  });
}

function showQuestion(nextMode: 'bridge' | 'practice', last = '') {
  mode = nextMode;
  const state = adventure.getState();
  const q = generateQuestion(state, mode, last);
  const challenge = createMultiplicationChallenge(q.a, q.b, mode, Math.random, q.review);
  currentSession = new ChallengeSession(challenge);
  currentInputValue = '';

  const equationHtml = mode === 'bridge'
    ? `${challenge.a} <span>×</span> <span class="missing-factor">[ ? ]</span> <span>=</span> ${challenge.answer} <small>viên đá</small>`
    : `${challenge.a} <span>×</span> ${challenge.b} <span>=</span> ?`;

  const introHtml = mode === 'bridge'
    ? `Mình cần <strong>${challenge.answer} viên đá</strong> để xây cầu. Điền thừa số còn thiếu:`
    : 'Bạn hãy tính và nhập kết quả phép nhân:';

  openDialog(
    mode === 'bridge' ? 'Cùng xây cây cầu!' : 'Mỗi ngày, giỏi hơn một chút',
    `<div class="dialog-eyebrow">${mode === 'bridge' ? `ĐOẠN CẦU ${state.bridge + 1} / ${BRIDGE_PARTS}` : challenge.review ? 'ÔN LẠI PHÉP NHÂN' : 'LUYỆN TẬP CÙNG MILO'}</div>
    <p class="question-intro">${introHtml}</p>
    <div class="equation">${equationHtml}</div>
    ${renderMathInputAndNumpad()}
    <div id="feedback" class="feedback" aria-live="polite"></div>
    <div id="hint-area" class="hint-area" hidden></div>
    <div class="quiz-footer"><button id="hint" class="text-button">${icon('help')} Gợi ý cho mình</button><span>Không giới hạn thời gian</span></div>
    <button id="next-question" class="primary wide" hidden>Tiếp tục ${icon('arrow')}</button>`,
    'quiz'
  );

  setupNumpadListeners(val => submitAnswer(Number(val)));

  $('hint').onclick = () => {
    if (!currentSession) return;
    const hintText = currentSession.requestHint();
    renderHint(hintText);
  };

  $('next-question').onclick = () => {
    if (mode === 'bridge' && adventure.getState().bridge === BRIDGE_PARTS) {
      closeDialog();
      toast('Tuyệt vời! Cầu đã xây xong. Cùng đi qua cầu đến Vườn Hoa Tri Thức nhé!');
    } else {
      showQuestion(mode, challenge.id);
    }
  };
}

function renderHint(hintText: string) {
  if (!currentSession) return;
  const challenge = currentSession.challenge as MultiplicationChallenge;
  const area = $('hint-area');
  area.hidden = false;
  area.innerHTML = `<p>${hintText}</p><div class="stone-groups" aria-label="${challenge.b} nhóm, mỗi nhóm có ${challenge.a} viên đá">${Array.from({ length: challenge.b }, () => `<div class="stone-group">${'<i></i>'.repeat(challenge.a)}</div>`).join('')}</div>`;
}

function submitAnswer(value: number) {
  if (!currentSession || currentSession.isSolved()) return;
  const challenge = currentSession.challenge as MultiplicationChallenge;
  const res = currentSession.submit(value);
  const inputBox = $('math-input-box');

  if (res.isCorrect) {
    const delta = adventure.recordQuizResult({
      isCorrect: true,
      questionId: challenge.id,
      isBridgeMode: mode === 'bridge',
      firstTry: res.attempts === 1,
      responseTimeMs: currentSession.getDurationMs()
    });

    if (mode === 'bridge') {
      world.setBridge(delta.bridge, true);
    }
    if (inputBox) {
      inputBox.classList.remove('shake', 'error');
      inputBox.classList.add('correct');
    }
    document.querySelectorAll<HTMLButtonElement>('.numpad-btn, #numpad-submit').forEach(b => (b.disabled = true));
    const container = document.querySelector<HTMLElement>('.numpad-container');
    if (container) container.style.display = 'none';

    $('feedback').className = 'feedback success';
    $('feedback').textContent = `✓ Chính xác! ${challenge.a} × ${challenge.b} = ${challenge.answer}. +10 XP · +5 xu${delta.combo >= 3 ? ` · Combo ${delta.combo}!` : ''}`;
    $('next-question').hidden = false;
    $('next-question').innerHTML = `${mode === 'bridge' && delta.bridge === BRIDGE_PARTS ? 'Khám phá Vườn Hoa bên kia cầu!' : mode === 'bridge' ? 'Xây đoạn cầu tiếp theo' : 'Thử thêm một câu'} ${icon('arrow')}`;
    $('hint').hidden = true;
    world.burst(world.player.position.clone().add(new Vector3(0, 1, 0)));

    if (delta.leveledUp) {
      audio.playCue('celebrate');
      toast(`Bạn đã đạt cấp ${delta.newLevel}. Thật tuyệt vời!`);
    } else {
      audio.playCue('correct');
    }
    $('next-question').focus();
  } else {
    adventure.recordQuizResult({
      isCorrect: false,
      questionId: challenge.id,
      isBridgeMode: mode === 'bridge',
      firstTry: false,
      responseTimeMs: currentSession.getDurationMs()
    });
    if (inputBox) {
      inputBox.classList.remove('shake');
      void inputBox.offsetWidth;
      inputBox.classList.add('shake', 'error');
    }
    $('feedback').className = 'feedback gentle';
    $('feedback').textContent = '↻ Chưa đúng rồi. Mình cùng đếm lại nhé!';
    renderHint(res.hint);
    audio.playCue('hint');
  }
  updateHUD();
}

function openFlowerDialog(index: number) {
  let remoteFlowers = activeRemoteQuestions['VuonHoa'];
  if (!remoteFlowers || remoteFlowers.length === 0) {
    try {
      const raw = localStorage.getItem(REMOTE_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const questions = parsed?.data?.questionsBySheet || parsed?.questionsBySheet;
        if (questions?.['VuonHoa']?.length) {
          remoteFlowers = questions['VuonHoa'];
          activeRemoteQuestions['VuonHoa'] = remoteFlowers;
        }
      }
    } catch (_) { }
  }

  // Khớp theo ID bài (ProblemId trong Google Sheets là 1..10 tương ứng index 0..9)
  const targetId = index + 1;
  const remoteQ = remoteFlowers && (
    remoteFlowers.find((p) => Number(p.id) === targetId) ||
    remoteFlowers[index]
  );
  let challenge: FlowerChallenge;
  if (remoteQ && remoteQ.steps && remoteQ.steps[0]) {
    const step = remoteQ.steps[0];
    challenge = {
      id: `flower_${index}`,
      kind: 'flower',
      index,
      title: remoteQ.subtitle || remoteQ.title || `Hoa Thử Thách #${index + 1}`,
      badge: remoteQ.badge || `🌸 Hoa Tri Thức #${index + 1}`,
      color: remoteQ.color || 0xec4899,
      prompt: step.prompt,
      imageUrl: step.imageUrl,
      options: step.options.map((o) => ({ value: o.value, label: o.label })),
      answer: step.answer,
      hints: step.hints,
      explanation: step.explanation,
      explanationImageUrl: step.explanationImageUrl,
      flowerQuestion: {
        id: typeof remoteQ.id === 'number' ? remoteQ.id : (parseInt(String(remoteQ.id), 10) || index + 1),
        title: remoteQ.subtitle || remoteQ.title,
        question: step.prompt,
        imageUrl: step.imageUrl,
        options: step.options,
        answer: step.answer,
        hints: step.hints,
        explanation: step.explanation,
        explanationImageUrl: step.explanationImageUrl,
        badge: remoteQ.badge || '',
        color: remoteQ.color || 0xec4899
      }
    };
  } else {
    challenge = createFlowerChallenge(index);
  }
  currentSession = new ChallengeSession(challenge);
  currentInputValue = '';
  const q = challenge.flowerQuestion;
  const isBloomed = adventure.getState().flowers[index];
  const parsed = parseAnswer(challenge.answer);

  function renderFlowerHint(hintText: string, explanation?: string) {
    const area = $('flower-hint-area');
    area.hidden = false;
    const stage = currentSession?.getHintStage() ?? 1;
    const explImg = challenge.explanationImageUrl || q.explanationImageUrl;
    area.innerHTML = `
      <p><strong>💡 Gợi ý cấp ${stage}:</strong> ${hintText}</p>
      ${explanation ? `<p class="hint-explanation"><em>Lời giải: ${explanation}</em></p>` : ''}
      ${renderQuestionImage(explImg, 'Hình minh họa lời giải', true)}
    `;
  }

  function handleFlowerSubmit(choiceVal: string) {
    if (!currentSession || currentSession.isSolved()) return;
    const res = currentSession.submit(choiceVal);
    const inputBox = $('math-input-box');

    if (res.isCorrect) {
      if (inputBox) {
        inputBox.classList.remove('shake', 'error');
        inputBox.classList.add('correct');
      }
      document.querySelectorAll<HTMLButtonElement>('.flower-opt, .numpad-btn, #numpad-submit, .comp-btn').forEach(b => (b.disabled = true));
      const numpadContainer = document.querySelector<HTMLElement>('.numpad-container');
      if (numpadContainer) numpadContainer.style.display = 'none';

      const feedback = $('flower-feedback');
      feedback.className = 'feedback success';
      const delta = adventure.bloomFlower(index);

      if (!delta.alreadyBloomed) {
        world.bloomFlower(index);
        audio.playCue('celebrate');
        feedback.textContent = `✓ Chính xác! Cây hoa số ${index + 1} đã nở hoa rực rỡ! +15 XP · +5 xu`;
        updateHUD();

        logRemoteProgress({
          zoneId: 6,
          problemId: challenge.flowerQuestion?.id || index + 1,
          stepId: `flower_${challenge.flowerQuestion?.id || index + 1}`,
          isCorrect: true,
          score: 15
        });

        if (delta.allFlowersCompleted) {
          setTimeout(() => {
            openDialog(
              '🌸 ĐẠI THÀNH CÔNG: VƯỜN HOA NỞ RỘ! 🌸',
              `
              <div class="completion-medal">${icon('crown')}</div>
              <p class="dialog-copy centered">
                Tuyệt vời! Bạn đã trả lời đúng toàn bộ 10 câu hỏi!<br>
                <b>10 cây hoa thần kỳ</b> đã nở rộ rực rỡ khắp Vườn Hoa Tri Thức!
              </p>
              <div class="completion-rewards">
                <span>★ +100 XP</span><span>◉ +30 xu</span>
              </div>
              <button id="close-grand" class="primary wide">Tự do ngắm vườn hoa ${icon('arrow')}</button>
              `,
              'complete'
            );
            updateHUD();
            $('close-grand').onclick = closeDialog;
          }, 1200);
        }
      } else {
        audio.playCue('correct');
        feedback.textContent = `✓ Chính xác! Cây hoa số ${index + 1} vốn đã nở hoa rất đẹp!`;
      }
      $('flower-hint').hidden = true;
      $('flower-close-btn').hidden = false;
      $('flower-close-btn').onclick = closeDialog;
      $('flower-close-btn').focus();
    } else {
      if (inputBox) {
        inputBox.classList.remove('shake');
        void inputBox.offsetWidth;
        inputBox.classList.add('shake', 'error');
      }
      const feedback = $('flower-feedback');
      feedback.className = 'feedback gentle';
      feedback.textContent = '↻ Chưa đúng rồi. Hãy đọc gợi ý để cùng thử lại nhé!';
      renderFlowerHint(res.hint, res.explanation);
      audio.playCue('hint');
    }
  }

  let bodyControls = '';
  if (parsed.type === 'numeric') {
    bodyControls = renderMathInputAndNumpad(parsed.unit);
  } else if (parsed.type === 'comparison') {
    const compOptions = (challenge.options && challenge.options.length > 0)
      ? challenge.options.map((o: { value: string | number; label: string }) => String(o.value || o.label).trim())
      : ['<', '=', '>'];
    const getCompLabel = (v: string) => {
      if (v === '<') return '&lt;';
      if (v === '>') return '&gt;';
      if (v === '<=' || v === '≤') return '&le;';
      if (v === '>=' || v === '≥') return '&ge;';
      return v;
    };
    bodyControls = `
      <div class="math-input-container">
        <div id="math-input-box" class="math-input-display placeholder" tabindex="0">?</div>
      </div>
      <div class="comp-options">
        ${compOptions.map((op: string) => `<button type="button" class="comp-btn" data-value="${op}">${getCompLabel(op)}</button>`).join('')}
      </div>
    `;
  } else {
    bodyControls = `
      <div class="answers flower-answers">
        ${q.options.map((o: { value: string | number; label: string }, i: number) => `
          <button class="answer flower-opt" data-value="${o.value}">
            <kbd>${i + 1}</kbd><span>${o.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  openDialog(
    `Cây Hoa Số ${index + 1}: ${q.badge}`,
    `
    <div class="dialog-eyebrow">VƯỜN HOA TRI THỨC · BÀI ${index + 1} / 10</div>
    <div class="flower-status-banner ${isBloomed ? 'bloomed' : 'bud'}">
      ${isBloomed ? '🌸 Cây hoa này đã bung nở rực rỡ! Bạn có thể xem lại hoặc thử sức lại.' : '🌱 Búp hoa đang ấp nụ. Hãy giải đúng câu hỏi dưới đây để đánh thức hoa nở nhé!'}
    </div>
    <div class="flower-question-box">
      <div class="flower-question-title">${q.title}</div>
      <div class="flower-question-prompt">${q.question}</div>
      ${renderQuestionImage(challenge.imageUrl || q.imageUrl, q.title)}
    </div>
    ${bodyControls}
    <div id="flower-feedback" class="feedback" aria-live="polite"></div>
    <div id="flower-hint-area" class="hint-area" hidden></div>
    <div class="quiz-footer">
      <button id="flower-hint" class="text-button">${icon('help')} Gợi ý cho mình</button>
      <span>${adventure.getState().flowers.filter(Boolean).length} / 10 cây hoa đã nở</span>
    </div>
    <button id="flower-close-btn" class="primary wide" hidden>Ngắm hoa nở ${icon('arrow')}</button>
    `,
    'flowerQuiz'
  );

  setupNumpadListeners(handleFlowerSubmit);

  document.querySelectorAll<HTMLButtonElement>('.flower-opt').forEach(btn => {
    btn.onclick = () => handleFlowerSubmit(btn.dataset.value ?? '');
  });

  $('flower-hint').onclick = () => {
    if (!currentSession) return;
    const hintText = currentSession.requestHint();
    renderFlowerHint(hintText);
  };
}

function openArchimedesMapDialog(selectedZoneId = 0) {
  const state = adventure.getState();
  const zones: RemoteZoneConfig[] = activeRemoteZones.length > 0 ? activeRemoteZones : getBundledFallbackData().zones;

  const totalMonolithCompleted = state.monoliths.filter(Boolean).length;
  const totalFlowerCompleted = state.flowers.filter(Boolean).length;
  const badgesEarned = state.zoneBadges.filter(Boolean).length;

  const zoneTabsHtml = [
    `<button class="archimedes-zone-tab" data-zone="0" aria-pressed="${selectedZoneId === 0}">🌐 Toàn Cảnh (${zones.length} Vùng)</button>`,
    `<button class="archimedes-zone-tab" data-zone="-1" aria-pressed="${selectedZoneId === -1}">🏡 Làng Khởi Đầu</button>`,
    ...zones.map((z) => {
      const qList = activeRemoteQuestions[z.sheetName] || [];
      const total = qList.length || (z.id === 6 || z.sheetName === 'VuonHoa' ? 10 : 0);
      const done = qList.length > 0
        ? qList.filter((p: any) => adventure.isProblemSolved(p.id)).length
        : (z.id === 6 || z.sheetName === 'VuonHoa' ? totalFlowerCompleted : 0);
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
        const qList = activeRemoteQuestions[z.sheetName] || [];
        const isFlowerZone = z.id === 6 || z.sheetName === 'VuonHoa';
        const total = qList.length || (isFlowerZone ? 10 : 0);
        const done = qList.length > 0
          ? qList.filter((p: any) => adventure.isProblemSolved(p.id)).length
          : (isFlowerZone ? totalFlowerCompleted : 0);
        const questSummary = isFlowerZone
          ? `${done}/${total} Cây hoa nở`
          : `${done}/${total} Bia đá tri thức`;
        return `
        <div class="zone-overview-card">
          <div>
            <div class="zone-card-title">${getThemeBadgeIcon(z.theme)} ${z.name}</div>
            <div class="zone-card-meta">${z.badge} · Chủ đề ${z.theme || 'DI TÍCH'} · (${Math.round(z.center.x)}, ${Math.round(z.center.z)})</div>
            <p style="font-size:12px;color:#456755;margin:8px 0">
              Quy mô: ${z.width}m × ${z.depth}m · ${questSummary}
            </p>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="zone-teleport-btn zone-banner-teleport" data-x="${z.center.x - z.width / 2 + 4}" data-z="${z.center.z}" data-name="${z.name}">
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
        <button class="zone-teleport-btn zone-banner-teleport" data-x="-6" data-z="5" data-name="Làng Khởi Đầu">
          🚀 Dịch chuyển về Làng Khởi Đầu
        </button>
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
    const remoteFlowers = activeRemoteQuestions['VuonHoa'] || [];
    const flowerList = remoteFlowers.length > 0
      ? remoteFlowers
      : Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: `Hoa Tri Thức #${i + 1}`, subtitle: 'Làm nở hoa bằng cách trả lời đúng' }));

    const flowerCardsHtml = flowerList.map((f: any, i: number) => {
      const flowerId = f.id ?? (i + 1);
      const bloomed = adventure.isProblemSolved(flowerId) || state.flowers[i];
      const flowerPos = world?.flowers[i]?.position ?? { x: 13 + (i % 5) * 3, z: -4 + Math.floor(i / 5) * 8 };
      return `
        <div class="archimedes-monolith-card ${bloomed ? 'completed' : ''}">
          <div class="archimedes-card-header">
            <span class="archimedes-card-page">${f.badge || `Cây Hoa #${flowerId}`}</span>
            <span class="archimedes-card-status">${bloomed ? '🌸 Đã nở' : '🌱 Đang ấp nụ'}</span>
          </div>
          <div class="archimedes-card-title">${f.subtitle || f.title || `Hoa Tri Thức Số ${i + 1}`}</div>
          <div class="archimedes-card-sub">${(f.steps && f.steps[0] ? f.steps[0].prompt : f.subtitle) || 'Làm nở hoa bằng cách trả lời đúng câu hỏi'}</div>
          <div class="archimedes-card-actions">
            <button class="archimedes-card-action flower-open-btn" data-index="${i}">
              ${bloomed ? `${icon('check')} Xem lại` : `🌸 Làm nở hoa`}
            </button>
            <button class="zone-teleport-btn archimedes-card-teleport" data-x="${flowerPos.x - 1.5}" data-z="${flowerPos.z}" data-name="${f.title || `Cây Hoa ${i + 1}`}">
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
  } else {
    // 4. Các phân khu Archimedes & Vùng đất tùy biến từ Google Sheets
    const currentZone = zones.find((z) => z.id === selectedZoneId);
    const qList = currentZone ? activeRemoteQuestions[currentZone.sheetName] || [] : [];
    const monolithCardsHtml = qList.map((m) => {
      const isDone = adventure.isProblemSolved(m.id) || (typeof m.id === 'number' && m.id >= 306 && state.monoliths[m.id - 306]);
      const pPos = m.position || { x: currentZone?.center.x || 0, z: currentZone?.center.z || 0 };
      return `
        <div class="archimedes-monolith-card ${isDone ? 'completed' : ''}" data-id="${m.id}">
          <div class="archimedes-card-header">
            <span class="archimedes-card-page">${m.badge || `Bia Đá #${m.id}`}</span>
            <span class="archimedes-card-status">${isDone ? '🏆 Đã giải' : '✨ Thử thách'}</span>
          </div>
          <div class="archimedes-card-title">${m.title || `Bia Đá ${m.id}`}</div>
          <div class="archimedes-card-sub">${m.subtitle || (m.steps && m.steps[0] ? m.steps[0].prompt : '')}</div>
          <div class="archimedes-card-actions">
            <button class="archimedes-card-action monolith-open-btn" data-index="${m.id}">
              ${isDone ? `${icon('check')} Xem lại` : `${icon('star')} Giải bài`}
            </button>
            <button class="zone-teleport-btn archimedes-card-teleport" data-x="${pPos.x - 1.5}" data-z="${pPos.z}" data-name="${m.title || `Bia Đá ${m.id}`}">
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
      fetchRemoteData(url)
        .then((fresh) => {
          if (fresh) {
            syncDynamicContent(fresh);
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
      const name = btn.dataset.name || 'đích đến';
      closeDialog();
      world.teleport(x, z);
      audio.playCue('jump');
      world.burst(world.player.position.clone().add(new Vector3(0, 1.2, 0)));
      toast(`✨ Đã dịch chuyển đến ${name}!`);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('.monolith-open-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const ref = btn.dataset.index ?? '0';
      openArchimedesMonolithDialog(isNaN(Number(ref)) ? ref : Number(ref), 0);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('.flower-open-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const fIdx = Number(btn.dataset.index ?? '0');
      openFlowerDialog(fIdx);
    };
  });
}

function openArchimedesMonolithDialog(monolithRef: number | string, stepIndex = 0) {
  let challenge: ArchimedesChallenge;

  let monolithId = 0;
  if (typeof monolithRef === 'number') {
    if (monolithRef >= 300) {
      monolithId = monolithRef;
    } else if (monolithRef >= 0 && activeMonolithProblems[monolithRef]) {
      monolithId = Number(activeMonolithProblems[monolithRef].id);
    } else {
      monolithId = 306 + monolithRef;
    }
  } else {
    monolithId = Number(monolithRef);
  }

  // 2. Tìm remoteProblem trong activeRemoteQuestions (bỏ qua 'VuonHoa' vì Vườn Hoa chỉ chứa hoa)
  let remoteProblem: RemoteProblem | undefined;
  for (const sheetKey of Object.keys(activeRemoteQuestions)) {
    if (sheetKey === 'VuonHoa') continue;
    const list = activeRemoteQuestions[sheetKey];
    const found = list?.find((p) => Number(p.id) === monolithId);
    if (found) {
      remoteProblem = found;
      break;
    }
  }
  if (!remoteProblem && typeof monolithRef === 'number' && activeMonolithProblems[monolithRef]) {
    remoteProblem = activeMonolithProblems[monolithRef];
    monolithId = Number(remoteProblem.id);
  }

  const monolithIndex = typeof monolithRef === 'number' ? monolithRef : (monolithId - 306);

  if (remoteProblem && remoteProblem.steps && remoteProblem.steps.length > 0) {
    const rStep = remoteProblem.steps[Math.min(stepIndex, remoteProblem.steps.length - 1)] || remoteProblem.steps[0];
    const parentZone = activeRemoteZones.find((z) => {
      const list = activeRemoteQuestions[z.sheetName];
      return list?.some((p) => Number(p.id) === Number(remoteProblem?.id));
    });
    const pId = Number(remoteProblem.id) || monolithId;
    const validZoneId: 1 | 2 | 3 | 4 | 5 = (parentZone?.id && parentZone.id <= 5 ? parentZone.id : 1) as 1 | 2 | 3 | 4 | 5;
    challenge = {
      id: `arch_${pId}_${stepIndex}`,
      kind: 'archimedes',
      monolithId: pId,
      monolithIndex,
      stepIndex,
      totalSteps: remoteProblem.steps.length,
      title: remoteProblem.title || `Thử Thách #${pId}`,
      zoneName: parentZone?.name || 'Vùng Đất Archimedes',
      page: 1,
      badge: remoteProblem.badge || '🏆 Thử Thách',
      color: remoteProblem.color || 0x38bdf8,
      prompt: rStep.prompt,
      imageUrl: rStep.imageUrl,
      options: rStep.options.map((o) => ({ value: o.value, label: o.label })),
      answer: rStep.answer,
      hints: rStep.hints,
      explanation: rStep.explanation,
      explanationImageUrl: rStep.explanationImageUrl,
      diagramSvg: rStep.diagramSvg,
      monolith: {
        id: pId,
        zoneId: validZoneId,
        zoneName: parentZone?.name || 'Vùng Đất Archimedes',
        page: 1,
        title: remoteProblem.title || `Thử Thách #${pId}`,
        subtitle: remoteProblem.subtitle || '',
        badge: remoteProblem.badge || '',
        color: remoteProblem.color || 0x38bdf8,
        position: remoteProblem.position || { x: 0, z: 0 },
        steps: remoteProblem.steps
      },
      step: rStep
    };
  } else {
    challenge = createArchimedesChallenge(monolithId, stepIndex);
  }

  const m = challenge.monolith;
  currentSession = new ChallengeSession(challenge);
  currentInputValue = '';
  const step = challenge.step;
  const isDone = adventure.getState().monoliths[monolithIndex];
  const parsed = parseAnswer(challenge.answer);

  function renderArchimedesHint(hintText: string, explanation?: string) {
    const area = $('arch-hint-area');
    area.hidden = false;
    const stage = currentSession?.getHintStage() ?? 1;
    const explImg = step.explanationImageUrl || challenge.explanationImageUrl;
    area.innerHTML = `
      <p><strong>💡 Gợi ý bước ${stage}:</strong> ${hintText}</p>
      ${explanation ? `<p class="hint-explanation"><em>Lời giải chi tiết: ${explanation}</em></p>` : ''}
      ${renderQuestionImage(explImg, 'Hình minh họa lời giải', true)}
    `;
  }

  function handleArchSubmit(choiceVal: string) {
    if (!currentSession || currentSession.isSolved()) return;
    const res = currentSession.submit(choiceVal);
    const inputBox = $('math-input-box');

    if (res.isCorrect) {
      if (inputBox) {
        inputBox.classList.remove('shake', 'error');
        inputBox.classList.add('correct');
      }
      document.querySelectorAll<HTMLButtonElement>('.arch-opt, .numpad-btn, #numpad-submit, .comp-btn').forEach(b => (b.disabled = true));
      const numpadContainer = document.querySelector<HTMLElement>('.numpad-container');
      if (numpadContainer) numpadContainer.style.display = 'none';

      const feedback = $('arch-feedback');
      feedback.className = 'feedback success';

      const isLastStep = stepIndex + 1 >= challenge.totalSteps;
      logRemoteProgress({
        zoneId: m.zoneId,
        problemId: m.id,
        stepId: step.stepId,
        isCorrect: true,
        score: isLastStep ? 20 : 10
      });

      if (!isLastStep) {
        audio.playCue('correct');
        feedback.textContent = `✓ Chính xác! Bước ${stepIndex + 1} hoàn thành xuất sắc!`;
        $('arch-hint').hidden = true;
        $('arch-next-step').hidden = false;
        $('arch-next-step').onclick = () => openArchimedesMonolithDialog(monolithIndex, stepIndex + 1);
        $('arch-next-step').focus();
      } else {
        const delta = adventure.activateMonolith(monolithIndex);
        world.activateMonolith(monolithIndex);
        audio.playCue('celebrate');
        world.burst(world.player.position.clone().add(new Vector3(0, 1.2, 0)));

        feedback.textContent = delta.alreadyActivated
          ? `✓ Chính xác! Bạn đã ôn luyện lại Bia Đá ${m.id} thành công!`
          : `✓ Xuất sắc! Kích hoạt thành công Bia Đá ${m.id}! +${delta.xpGained} XP · +${delta.coinsGained} xu`;

        updateHUD();
        $('arch-hint').hidden = true;
        $('arch-finish-btn').hidden = false;
        $('arch-finish-btn').focus();

        if (delta.zoneCompleted) {
          setTimeout(() => {
            openDialog(
              `🏆 HOÀN THÀNH: ${m.zoneName.toUpperCase()}! 🏆`,
              `
              <div class="completion-medal">${icon('crown')}</div>
              <p class="dialog-copy centered">
                Kỳ tích! Bạn đã giải trọn vẹn toàn bộ các Bia Đá trong<br>
                <b>${m.zoneName}</b>!<br>
                Đại Huy Chương Khu Vực đã thuộc về bạn!
              </p>
              <div class="completion-rewards">
                <span>★ +50 XP</span><span>◉ +25 xu</span>
              </div>
              <button id="close-zone-grand" class="primary wide">Mở Bản Đồ ${icon('arrow')}</button>
              `,
              'complete'
            );
            updateHUD();
            $('close-zone-grand').onclick = () => openArchimedesMapDialog(m.zoneId);
          }, 1200);
        }

        $('arch-finish-btn').onclick = () => openArchimedesMapDialog(m.zoneId);
      }
    } else {
      logRemoteProgress({
        zoneId: m.zoneId,
        problemId: m.id,
        stepId: step.stepId,
        isCorrect: false,
        score: 0
      });
      if (inputBox) {
        inputBox.classList.remove('shake');
        void inputBox.offsetWidth;
        inputBox.classList.add('shake', 'error');
      }
      const feedback = $('arch-feedback');
      feedback.className = 'feedback gentle';
      feedback.textContent = '↻ Chưa chính xác rồi. Hãy đọc gợi ý để làm lại nhé!';
      renderArchimedesHint(res.hint, res.explanation);
      audio.playCue('hint');
    }
  }

  let bodyControls = '';
  if (parsed.type === 'numeric') {
    bodyControls = renderMathInputAndNumpad(parsed.unit);
  } else if (parsed.type === 'comparison') {
    const compOptions = (step.options && step.options.length > 0)
      ? step.options.map((o: { value: string | number; label: string }) => String(o.value || o.label).trim())
      : ['<', '=', '>'];
    const getCompLabel = (v: string) => {
      if (v === '<') return '&lt;';
      if (v === '>') return '&gt;';
      if (v === '<=' || v === '≤') return '&le;';
      if (v === '>=' || v === '≥') return '&ge;';
      return v;
    };
    bodyControls = `
      <div class="math-input-container">
        <div id="math-input-box" class="math-input-display placeholder" tabindex="0">?</div>
      </div>
      <div class="comp-options">
        ${compOptions.map((op: string) => `<button type="button" class="comp-btn" data-value="${op}">${getCompLabel(op)}</button>`).join('')}
      </div>
    `;
  } else {
    bodyControls = `
      <div class="answers flower-answers">
        ${step.options.map((o, i) => `
          <button class="answer arch-opt" data-value="${o.value}">
            <kbd>${i + 1}</kbd><span>${o.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  openDialog(
    `Bia Đá ${m.id}: ${m.title}`,
    `
    <div class="dialog-eyebrow">${m.zoneName.toUpperCase()} · TRANG ${m.page}</div>
    <div class="flower-status-banner ${isDone ? 'bloomed' : 'bud'}">
      ${isDone ? '🏆 Bia Đá này đã được kích hoạt phát sáng hào quang!' : `⚡ Bia Đá Tri Thức đang chờ bạn giải mã. Hoàn thành để nhận +20 XP và +10 xu!`}
    </div>
    <div class="archimedes-step-indicator">
      ${challenge.totalSteps > 1 ? `Bước ${stepIndex + 1} / ${challenge.totalSteps}` : 'Thử thách hoàn chỉnh'} · ${m.subtitle}
    </div>
    <div class="flower-question-box">
      <div class="flower-question-prompt">${step.prompt}</div>
      ${renderQuestionImage(step.imageUrl || challenge.imageUrl, challenge.title)}
    </div>
    ${bodyControls}
    <div id="arch-feedback" class="feedback" aria-live="polite"></div>
    <div id="arch-hint-area" class="hint-area" hidden></div>
    <div class="quiz-footer">
      <button id="arch-hint" class="text-button">${icon('help')} Xem gợi ý</button>
      <button id="back-map-btn" class="text-button">${icon('compass')} Về bản đồ</button>
    </div>
    <button id="arch-next-step" class="primary wide" hidden>Tiếp tục bước tiếp theo ${icon('arrow')}</button>
    <button id="arch-finish-btn" class="primary wide" hidden>Kích hoạt Bia Đá ${icon('check')}</button>
    `,
    'archimedesQuiz'
  );

  $('back-map-btn').onclick = () => openArchimedesMapDialog(m.zoneId);

  setupNumpadListeners(handleArchSubmit);

  document.querySelectorAll<HTMLButtonElement>('.arch-opt').forEach(btn => {
    btn.onclick = () => handleArchSubmit(btn.dataset.value ?? '');
  });

  $('arch-hint').onclick = () => {
    if (!currentSession) return;
    const hint = currentSession.requestHint();
    renderArchimedesHint(hint);
  };
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
  if (!world.active || world.paused) return;
  const locName = world.spatial.getCurrentLocationName();
  if (locName === 'Làng Khởi Đầu') {
    world.teleport(13, 0);
    toast('Chào mừng bạn đến với Vườn Hoa Tri Thức!');
  } else if (locName === 'Vườn Hoa Tri Thức') {
    world.teleport(60, 0);
    toast('Chào mừng bạn đến Đền Cổng Archimedes!');
  } else {
    world.teleport(-6, 5);
    toast('Đã trở về Làng Khởi Đầu!');
  }
};


function help() {
  openDialog(
    'Sẵn sàng phiêu lưu?',
    `<div class="help-list">
    <div><b>1</b><p><strong>Khám phá ngôi làng & Vườn hoa</strong>Nhấn WASD / phím mũi tên, hoặc chạm xuống đất để di chuyển. Nhấn nút “Đến Vườn Hoa” để dịch chuyển nhanh qua lại.</p></div>
    <div><b>2</b><p><strong>Làm quen với Milo & Cây cầu</strong>Gặp Milo để nhận nhiệm vụ xây cầu bằng 6 phép nhân đúng.</p></div>
    <div><b>3</b><p><strong>Vườn Hoa 10 Thử Thách</strong>Đến gần 10 cây hoa bên bờ đông và nhấn E để trả lời câu hỏi. Mỗi câu đúng sẽ làm cây hoa bung nở rực rỡ!</p></div>
  </div><div class="milo-tip"><p><b>Space</b>: nhảy · <b>Kéo trên làng</b>: xoay camera · <b>Lăn chuột</b>: phóng to / thu nhỏ · <b>Esc</b>: tạm dừng.</p></div><button id="understood" class="primary wide">Mình hiểu rồi! ${icon('check')}</button>`,
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
  return checkDeviceTouch();
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
      <h4>${icon('settings')} Thư Viện Tri Thức Trực Tuyến</h4>
      <p>Câu hỏi và bản đồ được nạp tự động từ Google Sheets của hệ thống.</p>
      <div class="sheets-action-row">
        <button id="refresh-sheets-btn" class="primary small" title="Tải lại câu hỏi mới nhất từ Google Sheets">${icon('reset')} Đồng bộ câu hỏi mới nhất</button>
        <button id="seed-sheets-btn" class="secondary small" title="Khởi tạo lại 50 câu hỏi mẫu lên Google Sheets">${icon('star')} ⚡ Khởi tạo 50 câu mẫu</button>
      </div>
    </div>

    <div class="sheets-config-box">
      <h4>${icon('crown')} Hồ Sơ Dũng Sĩ</h4>
      <p>Thông tin ghi nhận kết quả và nhật ký làm bài trên Google Sheets.</p>
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
      <div class="sheets-action-row">
        <button id="save-profile-btn" class="secondary small">${icon('check')} Lưu hồ sơ</button>
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
    const url = getAppsScriptUrl();
    toast('⏳ Đang tải lại câu hỏi mới nhất từ Google Sheets...');
    fetchRemoteData(url)
      .then((fresh) => {
        if (fresh) {
          syncDynamicContent(fresh);
          toast('✨ Đã tải lại câu hỏi mới nhất từ Google Sheets thành công!');
        }
      })
      .catch((err) => {
        toast(`⚠️ Không thể tải dữ liệu: ${err.message}`);
      });
  };

  $('seed-sheets-btn').onclick = () => {
    const url = getAppsScriptUrl();
    toast('⏳ Đang khởi tạo toàn bộ 50 bài toán lên Google Sheets...');
    seedRemoteDatabase(url)
      .then((res) => {
        toast(`✨ ${res.message}`);
        return fetchRemoteData(url);
      })
      .then((fresh) => {
        if (fresh) syncDynamicContent(fresh);
      })
      .catch((err) => {
        toast(`⚠️ Khởi tạo thất bại: ${err.message}`);
      });
  };

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
      toast('Đã lưu hồ sơ dũng sĩ!');
    }
  };

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
      adventure.resetProgress();
      const fresh = adventure.getState();
      world.setBridge(0);
      world.setFlowersBloomed(fresh.flowers);
      world.setMonolithsActivated(fresh.monoliths);
      world.player.position.set(-6, 0, 6);

      world.setAvatar(fresh.avatar);
      world.resetCamera();
      menu();
      toast('Một hành trình mới đang chờ bạn!');
    };
  };
}
$('settings').onclick = settings;
document.querySelector('.player-card')?.addEventListener('click', () => settings());
$('sound').onclick = () => {
  const state = adventure.getState();
  adventure.setAudio(!state.sound, state.music);
  updateHUD();
};
$('jump').onclick = () => world.jump();

document.addEventListener('keydown', e => {
  if (e.repeat && ['e', ' ', 'Escape'].includes(e.key)) return;
  if ($<HTMLDialogElement>('dialog').open) {
    if (currentDialog === 'quiz' || currentDialog === 'flowerQuiz' || currentDialog === 'archimedesQuiz') {
      const hasMathInput = !!document.getElementById('math-input-box');
      if (hasMathInput && !currentSession?.isSolved()) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleNumpadInput(e.key);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          handleNumpadInput('backspace');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const submitBtn = $<HTMLButtonElement>('numpad-submit');
          if (submitBtn && !submitBtn.disabled) submitBtn.click();
          return;
        }
        if (['<', '>', '=', '≤', '≥'].includes(e.key)) {
          let targetVal = e.key;
          if (e.key === '≤') targetVal = '<=';
          else if (e.key === '≥') targetVal = '>=';
          const compBtn = document.querySelector<HTMLButtonElement>(`.comp-btn[data-value="${targetVal}"]`);
          if (compBtn && !compBtn.disabled) {
            e.preventDefault();
            compBtn.click();
            return;
          }
        }
      } else if (currentSession?.isSolved()) {
        if (e.key === 'Enter' || e.key === ' ') {
          const nextBtn = [
            $('next-question'),
            $('flower-close-btn'),
            $('arch-next-step'),
            $('arch-finish-btn')
          ].find(b => b && !b.hidden);
          if (nextBtn) {
            e.preventDefault();
            nextBtn.click();
            return;
          }
        }
      } else if (/^[123]$/.test(e.key)) {
        const sel = currentDialog === 'flowerQuiz' ? '.flower-opt' : currentDialog === 'archimedesQuiz' ? '.arch-opt' : '.answer';
        const b = document.querySelectorAll<HTMLButtonElement>(sel)[Number(e.key) - 1];
        if (b && !b.disabled) b.click();
      }
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
  if (key === 'escape') {
    e.preventDefault();
    settings();
  }
});
document.addEventListener('keyup', e => world?.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => {
  world?.clearInput();
  if (world?.active && !$<HTMLDialogElement>('dialog').open) settings();
});
document.addEventListener('visibilitychange', () => {
  world?.clearInput();
  if (document.hidden) audio.music(false);
  else if (world?.active) audio.music(adventure.getState().music);
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
    world.joystick = { x: 0, y: 0 };
    knob.style.transform = '';
    updateDirectionHighlights(0, 0);
    return;
  }

  const intensity = Math.min(1, dist / maxRadius);
  const normX = (dx / dist) * intensity;
  const normY = (dy / dist) * intensity;

  world.joystick = { x: normX, y: normY };

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
      world.joystick = { x: 0, y: 0 };
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

try {
  world = new World($<HTMLCanvasElement>('world'));
  const init = adventure.getState();
  world.setBridge(init.bridge);
  world.setFlowersBloomed(init.flowers);
  world.setMonolithsActivated(init.monoliths);
  world.setAvatar(init.avatar);
  world.onJump = () => audio.playCue('jump');
  world.onSceneClick = () => interactAction();
  world.onFlowerClick = idx => openFlowerDialog(idx);
  world.onMonolithClick = idx => openArchimedesMonolithDialog(idx, 0);
  world.onPortalClick = () => openArchimedesMapDialog();
  $('archimedes-btn').onclick = () => openArchimedesMapDialog();
  $('portal-label').onclick = () => openArchimedesMapDialog();

  world.onFrame = (isNear, crossed, _fps, nearFlowerIdx, isNearPortal, nearMonolithIdx) => {
    near = isNear;
    nearFlower = nearFlowerIdx;
    nearPortal = isNearPortal;
    nearMonolith = nearMonolithIdx;

    if (world.active && !world.paused) {
      const transit = world.spatial.checkPortalTransit(0.016);
      if (transit) {
        audio.playCue('jump');
        world.burst(world.player.position.clone().add(new Vector3(0, 1, 0)));
        toast(`✨ ${transit.name}!`);
      }
    }

    if (++frameTick % 3 !== 0) return;

    const locName = world.spatial.getCurrentLocationName();
    const inArchimedes = world.spatial.isInArchimedesRealm();
    const inGarden = world.spatial.isInGarden();
    $('village-status-text').textContent = locName;
    $('area-label-text').textContent = locName;

    let subLabel = 'KHÁM PHÁ · HỌC HỎI · TRƯỞNG THÀNH';
    const dynZone = activeRemoteZones.find((z) => z.name === locName);
    if (dynZone) {
      subLabel = `${dynZone.badge} · CHỦ ĐỀ ${dynZone.theme || 'KHÁM PHÁ'}`;
    } else if (locName === 'Vườn Hoa Tri Thức') subLabel = '10 THỬ THÁCH HOA NỞ';
    else if (locName === 'Đền Cổng Archimedes') subLabel = 'TRUNG TÂM CỔNG KHÔNG GIAN';
    else if (inArchimedes) subLabel = '40 BIA ĐÁ TRI THỨC';

    $('area-label-sub').textContent = subLabel;
    $('travel-text').textContent = locName === 'Làng Khởi Đầu' ? 'Đến Vườn Hoa' : locName === 'Vườn Hoa Tri Thức' ? 'Đến Đền Cổng' : 'Về Làng Khởi Đầu';

    const nearPortalObj = world.spatial.getNearPortal();

    if (nearMonolith !== -1) {
      const dynamicProb = activeMonolithProblems[nearMonolith];
      const mId = dynamicProb?.id ? Number(dynamicProb.id) : (306 + nearMonolith);
      const mTitle = dynamicProb?.title || `Bia Đá ${mId}`;
      const done = adventure.isProblemSolved(mId) || adventure.getState().monoliths[nearMonolith];
      $('interact').innerHTML = `⚡ <b>${mTitle}</b> ${done ? '(Đã kích hoạt - Xem lại)' : '(Bấm E để giải bài)'} ${icon('arrow')}`;
      $('interact').hidden = world.paused;
    } else if (nearPortal) {
      $('interact').innerHTML = `🏛️ <b>${nearPortalObj?.name || 'Cổng Không Gian'}</b> (Bấm E để mở Bản Đồ) ${icon('arrow')}`;
      $('interact').hidden = world.paused;
    } else if (nearFlower !== -1) {
      const bloomed = adventure.getState().flowers[nearFlower];
      $('interact').innerHTML = `${icon('flower')} <b>Cây Hoa ${nearFlower + 1}</b> ${bloomed ? '(Đã nở - Xem lại)' : '(Bấm E để làm nở hoa)'} ${icon('arrow')}`;
      $('interact').hidden = world.paused;
    } else if (isNear) {
      $('interact').innerHTML = `<kbd>E</kbd> Nói chuyện với Milo ${icon('arrow')}`;
      $('interact').hidden = world.paused;
    } else {
      $('interact').hidden = true;
    }

    const m = world.project(new Vector3(-3, 3.5, 1.5)),
      b = world.project(new Vector3(7, .8, 0)),
      portalTargetPos = nearPortalObj ? new Vector3(nearPortalObj.source.x, 3.8, nearPortalObj.source.z) : world.portalPos.clone().add(new Vector3(0, 4.4, 0)),
      p = world.project(portalTargetPos);
    $('milo-label').style.transform = `translate(${m.x}px,${m.y}px) translate(-50%,-100%)`;
    $('bridge-label').style.transform = `translate(${b.x}px,${b.y}px) translate(-50%,15px)`;
    $('portal-label').style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
    $('milo-label').classList.toggle('near', isNear);
    $('portal-label').classList.toggle('near', isNearPortal);
    $('bridge-label').hidden = world.paused || inGarden || inArchimedes;
    $('portal-label').hidden = world.paused || (!inGarden && !isNearPortal);


    if (world.active && !world.paused && crossed) {
      const delta = adventure.completeRiverCrossing();
      if (delta.completed) {
        updateHUD();
        audio.playCue('celebrate');
        world.burst(world.player.position.clone().add(new Vector3(0, 1, 0)));
        openDialog(
          'Bạn đã làm được rồi!',
          `<div class="completion-medal">${icon('crown')}</div><p class="dialog-copy centered">Nhờ bạn, hai bờ đã được nối liền.<br><b>Cây cầu tình bạn</b> đã hoàn thành!<br>Hãy khám phá <b>Vườn Hoa Tri Thức</b> ở bờ bên này nhé!</p><div class="completion-rewards"><span>★ +50 XP</span><span>◉ +10 xu</span></div><button id="keep-playing" class="primary wide">Tiếp tục khám phá ${icon('arrow')}</button>`,
          'complete'
        );
        $('keep-playing').onclick = closeDialog;
      }
    }
  };
  updateHUD();

  // Nạp dữ liệu zones và câu hỏi ngay khi ứng dụng khởi động (áp dụng cache 30 phút & Stale-While-Revalidate)
  loadZonesAndQuestions((fresh) => {
    syncDynamicContent(fresh);
    console.log('✨ [Sheets] Đã đồng bộ câu hỏi mới nhất từ Google Sheets!');
  }).then((data) => {
    syncDynamicContent(data);
    $('loading').hidden = true;
  }).catch((err) => {
    console.warn('Lỗi nạp câu hỏi khởi động:', err);
    $('loading').hidden = true;
  });
} catch (error) {
  $('loading').innerHTML =
    '<strong>Chưa mở được thế giới 3D</strong><p>Hãy bật tăng tốc đồ họa trong trình duyệt, hoặc thử Chrome / Edge mới hơn.</p><button class="primary" onclick="location.reload()">Thử lại</button>';
  console.error(error);
}

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
