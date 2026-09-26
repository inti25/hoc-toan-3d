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
  type MultiplicationChallenge,
  type ArchimedesChallenge
} from './quiz/session';
import {
  ARCHIMEDES_MONOLITHS,
  ARCHIMEDES_ZONES,
  getMonolithById,
  getMonolithsByZone,
  type ArchimedesMonolith
} from './data/archimedesTrialMap';
import { AudioManager } from './audio/audio';

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
  flower: '<circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 0 0-3 3c0 2 3 4 3 4s3-2 3-4a3 3 0 0 0-3-3Zm0 13s-3 2-3 4a3 3 0 0 0 6 0c0-2-3-4-3-4ZM2 12a3 3 0 0 0 3 3c2 0 4-3 4-3s-2-3-4-3a3 3 0 0 0-3 3Zm13 0s2 3 4 3a3 3 0 0 0 0-6c-2 0-4 3-4 3Z"/>'
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
let toastTimer = 0;
let near = false;
let nearFlower = -1;
let nearPortal = false;
let nearMonolith = -1;
let frameTick = 0;

const app = $('app');
app.innerHTML = `
  <main class="game-shell">
    <canvas id="world" aria-label="Làng Khởi Đầu và Vườn Hoa Tri Thức 3D. Di chuyển bằng WASD, phím mũi tên hoặc chạm xuống đất."></canvas>
    <div id="loading" class="loading"><span class="loading-crown">${icon('crown')}</span><strong>Đang mở cánh cổng…</strong></div>
    <header class="topbar">
      <a class="brand" href="/" aria-label="Vương Quốc Học Toán 3D"><span class="brand-mark">${icon('crown')}</span><span>VƯƠNG QUỐC<small>HỌC TOÁN <b>3D</b></small></span></a>
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
    <div id="world-caption" class="world-caption"><span>01</span><div>Làng Khởi Đầu<small>Bảng ×2 · ×5 · ×10 & Vườn Hoa</small></div></div>
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
          <button id="archimedes-btn" class="tool-button special-btn">${icon('star')}<span>Bản Đồ Archimedes</span></button>
          <button id="travel" class="tool-button">${icon('compass')}<span id="travel-text">Đến Vườn Hoa</span></button>
          <button id="learn" class="tool-button">${icon('book')}<span>Sổ cửu chương</span></button>
          <button id="help" class="icon-button" aria-label="Hướng dẫn chơi" title="Hướng dẫn chơi">${icon('help')}</button>
        </div>
      </div>
      <button id="interact" class="interact" hidden><kbd>E</kbd> Tương tác ${icon('arrow')}</button>
      <div id="touch-controls" class="touch-controls"><div id="joystick" class="joystick" role="group" aria-label="Cần điều khiển di chuyển"><div id="joystick-knob"></div></div><button id="jump" class="jump-button" aria-label="Nhảy">${icon('jump')}</button></div>
    </div>
    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
    <footer id="menu-footer" class="menu-footer"><span><b>AI</b>GAME3D<span class="dotcom">.COM</span></span><span>Một thế giới nhỏ. Những khám phá lớn.</span><span>Lưu trên thiết bị này ${icon('save')}</span></footer>
    <dialog id="dialog" aria-labelledby="dialog-title"><button id="close-dialog" class="dialog-close" aria-label="Đóng">${icon('close')}</button><div id="dialog-content"></div></dialog>
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
  $('level').textContent = String(level);
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

  // Archimedes quest tracker
  const monolithCount = state.monoliths.filter(Boolean).length;
  $('monolith-count').textContent = `${monolithCount} / 40 Bia Đá`;
  $('archimedes-badges').innerHTML = ARCHIMEDES_ZONES.map((z, i) => {
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
});

$('close-dialog').onclick = closeDialog;

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
    `<div class="dialog-eyebrow">NGƯỜI DẪN ĐƯỜNG CỦA BẠN</div><p class="dialog-copy">${complete ? 'Cây cầu của chúng mình thật đẹp! ' + (state.questComplete ? 'Bạn muốn cùng mình luyện thêm phép nhân không?' : 'Bạn hãy đi qua cầu đến Vườn Hoa Tri Thức bên kia nhé. Mình cũng luôn sẵn sàng luyện tập cùng bạn!') : 'Vườn Hoa Tri Thức bên kia sông đang chờ chúng mình. Hãy giúp mình xây <strong>6 đoạn cầu</strong> bằng những viên đá phép thuật nhé!'}</p><div class="milo-tip"><span>✦</span><p>${complete ? 'Cứ thong thả, không cần vội. Mỗi lần thử là một lần bạn tiến bộ!' : 'Chọn phép nhân cho đúng số viên đá. Mỗi câu đúng: <b>+10 XP, +5 xu</b>. Nếu chưa đúng, chúng mình cùng đếm lại!'}</p></div><button id="accept-quest" class="primary wide">${complete ? 'Cùng luyện tập' : 'Cùng xây cầu nào!'} ${icon('arrow')}</button>`,
    'milo'
  );
  $('accept-quest').onclick = () => {
    adventure.acceptQuest();
    updateHUD();
    showQuestion(complete ? 'practice' : 'bridge');
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

function showQuestion(nextMode: 'bridge' | 'practice', last = '') {
  mode = nextMode;
  const state = adventure.getState();
  const q = generateQuestion(state, mode, last);
  const challenge = createMultiplicationChallenge(q.a, q.b, mode, Math.random, q.review);
  currentSession = new ChallengeSession(challenge);

  openDialog(
    mode === 'bridge' ? 'Cùng xây cây cầu!' : 'Mỗi ngày, giỏi hơn một chút',
    `<div class="dialog-eyebrow">${mode === 'bridge' ? `ĐOẠN CẦU ${state.bridge + 1} / ${BRIDGE_PARTS}` : challenge.review ? 'ÔN LẠI PHÉP NHÂN' : 'LUYỆN TẬP CÙNG MILO'}</div><p class="question-intro">${mode === 'bridge' ? `Mình cần <strong>${challenge.answer} viên đá</strong>. Phép nhân nào đúng?` : 'Bạn tìm được kết quả không?'}</p><div class="equation">${mode === 'bridge' ? `<span class="stone-symbol">◆</span> ${challenge.answer} <small>viên đá</small>` : `${challenge.a} <span>×</span> ${challenge.b} <span>=</span> ?`}</div><div class="answers">${challenge.options.map((o, i) => `<button class="answer" data-value="${o.value}"><kbd>${i + 1}</kbd><span>${o.label}</span></button>`).join('')}</div><div id="feedback" class="feedback" aria-live="polite"></div><div id="hint-area" class="hint-area" hidden></div><div class="quiz-footer"><button id="hint" class="text-button">${icon('help')} Gợi ý cho mình</button><span>Không giới hạn thời gian</span></div><button id="next-question" class="primary wide" hidden>Tiếp tục ${icon('arrow')}</button>`,
    'quiz'
  );

  document.querySelectorAll<HTMLButtonElement>('.answer').forEach(button =>
    (button.onclick = () => submitAnswer(Number(button.dataset.value), button))
  );

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

function submitAnswer(value: number, button: HTMLButtonElement) {
  if (!currentSession || currentSession.isSolved() || button.disabled) return;
  const challenge = currentSession.challenge as MultiplicationChallenge;
  const res = currentSession.submit(value);

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
    document.querySelectorAll<HTMLButtonElement>('.answer').forEach(b => (b.disabled = true));
    button.classList.add('correct');
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
    button.classList.add('incorrect');
    button.disabled = true;
    $('feedback').className = 'feedback gentle';
    $('feedback').textContent = '↻ Chưa đúng rồi. Mình cùng đếm lại nhé!';
    renderHint(res.hint);
    audio.playCue('hint');
  }
  updateHUD();
}

function openFlowerDialog(index: number) {
  const challenge = createFlowerChallenge(index);
  currentSession = new ChallengeSession(challenge);
  const q = challenge.flowerQuestion;
  const isBloomed = adventure.getState().flowers[index];

  function renderFlowerHint(hintText: string, explanation?: string) {
    const area = $('flower-hint-area');
    area.hidden = false;
    const stage = currentSession?.getHintStage() ?? 1;
    area.innerHTML = `
      <p><strong>💡 Gợi ý cấp ${stage}:</strong> ${hintText}</p>
      ${explanation ? `<p class="hint-explanation"><em>Lời giải: ${explanation}</em></p>` : ''}
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
    </div>
    <div class="answers flower-answers">
      ${q.options.map((o, i) => `
        <button class="answer flower-opt" data-value="${o.value}">
          <kbd>${i + 1}</kbd><span>${o.label}</span>
        </button>
      `).join('')}
    </div>
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

  document.querySelectorAll<HTMLButtonElement>('.flower-opt').forEach(btn => {
    btn.onclick = () => {
      if (!currentSession) return;
      const res = currentSession.submit(btn.dataset.value ?? '');
      if (res.isCorrect) {
        document.querySelectorAll<HTMLButtonElement>('.flower-opt').forEach(b => (b.disabled = true));
        btn.classList.add('correct');
        const feedback = $('flower-feedback');
        feedback.className = 'feedback success';
        const delta = adventure.bloomFlower(index);

        if (!delta.alreadyBloomed) {
          world.bloomFlower(index);
          audio.playCue('celebrate');
          feedback.textContent = `✓ Chính xác! Cây hoa số ${index + 1} đã nở hoa rực rỡ! +15 XP · +5 xu`;
          updateHUD();

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
      } else {
        btn.classList.add('incorrect');
        btn.disabled = true;
        const feedback = $('flower-feedback');
        feedback.className = 'feedback gentle';
        feedback.textContent = '↻ Chưa đúng rồi. Hãy đọc gợi ý để cùng thử lại nhé!';
        renderFlowerHint(res.hint, res.explanation);
        audio.playCue('hint');
      }
    };
  });

  $('flower-hint').onclick = () => {
    if (!currentSession) return;
    const hintText = currentSession.requestHint();
    renderFlowerHint(hintText);
  };
}

function openArchimedesMapDialog(selectedZoneId = 0) {
  const state = adventure.getState();
  const totalCompleted = state.monoliths.filter(Boolean).length;
  const filteredMonoliths = selectedZoneId === 0
    ? ARCHIMEDES_MONOLITHS
    : getMonolithsByZone(selectedZoneId);

  const zoneTabsHtml = [
    `<button class="archimedes-zone-tab" data-zone="0" aria-pressed="${selectedZoneId === 0}">Tất cả (40)</button>`,
    ...ARCHIMEDES_ZONES.map(z => {
      const zMonoliths = getMonolithsByZone(z.id);
      const zDone = zMonoliths.filter(m => state.monoliths[m.id - 306]).length;
      return `<button class="archimedes-zone-tab" data-zone="${z.id}" aria-pressed="${selectedZoneId === z.id}">${z.title} (${zDone}/${zMonoliths.length})</button>`;
    })
  ].join('');

  const monolithsGridHtml = filteredMonoliths.map(m => {
    const isDone = state.monoliths[m.id - 306];
    return `
      <div class="archimedes-monolith-card ${isDone ? 'completed' : ''}" data-id="${m.id}">
        <div class="archimedes-card-header">
          <span class="archimedes-card-page">Trang ${m.page}</span>
          <span class="archimedes-card-status">${isDone ? '🏆 Đã giải' : '✨ Thử thách'}</span>
        </div>
        <div class="archimedes-card-title">${m.title}</div>
        <div class="archimedes-card-sub">${m.subtitle}</div>
        <div class="archimedes-card-actions">
          <button class="archimedes-card-action" data-index="${m.id - 306}">
            ${isDone ? `${icon('check')} Xem lại` : `${icon('star')} Giải bài`}
          </button>
          <button class="archimedes-card-teleport" data-id="${m.id}" data-x="${m.position.x}" data-z="${m.position.z}" title="Dịch chuyển tức thời đến trước Bia Đá 3D">
            🚀 Đến ngay
          </button>
        </div>
      </div>
    `;
  }).join('');

  openDialog(
    '🏛️ Vùng Đất Luyện Tập Archimedes',
    `
    <div class="dialog-eyebrow">CHỦ ĐỀ 15: LUYỆN TẬP CHUNG · TOÁN 2 ARCHIMEDES</div>
    <div class="archimedes-header-banner">
      <div>
        <h3>40 Thử Thách Bia Đá Tri Thức</h3>
        <p>Khám phá 5 phân khu chuyên đề từ trang 128 đến 139 trong sách.</p>
      </div>
      <div class="archimedes-stats">
        <div class="archimedes-stat-box">
          <strong>${totalCompleted} / 40</strong>
          <small>Bia Đá Đã Kích Hoạt</small>
        </div>
        <div class="archimedes-stat-box">
          <strong>${state.zoneBadges.filter(Boolean).length} / 5</strong>
          <small>Đại Huy Chương</small>
        </div>
      </div>
    </div>
    <div class="archimedes-zone-tabs" role="tablist">
      ${zoneTabsHtml}
    </div>
    <div class="archimedes-monolith-grid">
      ${monolithsGridHtml}
    </div>
    `,
    'archimedesMap'
  );

  document.querySelectorAll<HTMLButtonElement>('.archimedes-zone-tab').forEach(tab => {
    tab.onclick = () => {
      const zId = Number(tab.dataset.zone ?? '0');
      openArchimedesMapDialog(zId);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('.archimedes-card-action').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const mIdx = Number(btn.dataset.index ?? '0');
      openArchimedesMonolithDialog(mIdx, 0);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('.archimedes-card-teleport').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const x = Number(btn.dataset.x);
      const z = Number(btn.dataset.z);
      const id = btn.dataset.id;
      closeDialog();
      world.teleport(x - 1.5, z);
      toast(`Đã dịch chuyển đến trước Bia Đá ${id}!`);
    };
  });

  document.querySelectorAll<HTMLElement>('.archimedes-monolith-card').forEach(card => {
    card.onclick = () => {
      const mId = Number(card.dataset.id ?? '306');
      openArchimedesMonolithDialog(mId - 306, 0);
    };
  });
}


function openArchimedesMonolithDialog(monolithIndex: number, stepIndex = 0) {
  const challenge = createArchimedesChallenge(monolithIndex, stepIndex);
  currentSession = new ChallengeSession(challenge);
  const m = challenge.monolith;
  const step = challenge.step;
  const isDone = adventure.getState().monoliths[monolithIndex];

  function renderArchimedesHint(hintText: string, explanation?: string) {
    const area = $('arch-hint-area');
    area.hidden = false;
    const stage = currentSession?.getHintStage() ?? 1;
    area.innerHTML = `
      <p><strong>💡 Gợi ý bước ${stage}:</strong> ${hintText}</p>
      ${explanation ? `<p class="hint-explanation"><em>Lời giải chi tiết: ${explanation}</em></p>` : ''}
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
    </div>
    <div class="answers flower-answers">
      ${step.options.map((o, i) => `
        <button class="answer arch-opt" data-value="${o.value}">
          <kbd>${i + 1}</kbd><span>${o.label}</span>
        </button>
      `).join('')}
    </div>
    <div id="arch-feedback" class="feedback" aria-live="polite"></div>
    <div id="arch-hint-area" class="hint-area" hidden></div>
    <div class="quiz-footer">
      <button id="arch-hint" class="text-button">${icon('help')} Xem gợi ý</button>
      <button id="back-map-btn" class="text-button">${icon('compass')} Về bản đồ Archimedes</button>
    </div>
    <button id="arch-next-step" class="primary wide" hidden>Tiếp tục bước tiếp theo ${icon('arrow')}</button>
    <button id="arch-finish-btn" class="primary wide" hidden>Kích hoạt Bia Đá ${icon('check')}</button>
    `,
    'archimedesQuiz'
  );

  $('back-map-btn').onclick = () => openArchimedesMapDialog(m.zoneId);

  document.querySelectorAll<HTMLButtonElement>('.arch-opt').forEach(btn => {
    btn.onclick = () => {
      if (!currentSession) return;
      const res = currentSession.submit(btn.dataset.value ?? '');
      if (res.isCorrect) {
        document.querySelectorAll<HTMLButtonElement>('.arch-opt').forEach(b => (b.disabled = true));
        btn.classList.add('correct');
        const feedback = $('arch-feedback');
        feedback.className = 'feedback success';

        const isLastStep = stepIndex + 1 >= challenge.totalSteps;
        if (!isLastStep) {
          audio.playCue('correct');
          feedback.textContent = `✓ Chính xác! Bước ${stepIndex + 1} hoàn thành xuất sắc!`;
          $('arch-hint').hidden = true;
          $('arch-next-step').hidden = false;
          $('arch-next-step').onclick = () => openArchimedesMonolithDialog(monolithIndex, stepIndex + 1);
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
                <button id="close-zone-grand" class="primary wide">Mở Bản Đồ Archimedes ${icon('arrow')}</button>
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
        btn.classList.add('incorrect');
        btn.disabled = true;
        const feedback = $('arch-feedback');
        feedback.className = 'feedback gentle';
        feedback.textContent = '↻ Chưa chính xác rồi. Hãy đọc gợi ý để làm lại nhé!';
        renderArchimedesHint(res.hint, res.explanation);
        audio.playCue('hint');
      }
    };
  });

  $('arch-hint').onclick = () => {
    if (!currentSession) return;
    const hint = currentSession.requestHint();
    renderArchimedesHint(hint);
  };
}

function learn(selected: Table = adventure.getState().table || 2) {
  const state = adventure.getState();
  openDialog(
    'Sổ cửu chương',
    `<div class="dialog-eyebrow">HỌC TỪNG CHÚT, NHỚ THẬT LÂU</div><div class="table-tabs" role="group" aria-label="Chọn bảng cửu chương">${TABLES.map(t => `<button data-table="${t}" aria-pressed="${t === selected}">Bảng ×${t}</button>`).join('')}</div><div class="multiplication-grid">${Array.from({ length: 10 }, (_, i) => {
      const s = state.questionStats[`m${selected}_${i + 1}`];
      return `<div><span>${selected} × ${i + 1}</span><b>= ${selected * (i + 1)}</b><small>${s?.correct ? '✓' : ''}</small></div>`;
    }).join('')}</div><p class="book-note">Dấu ✓ là phép nhân bạn đã trả lời đúng. Mình luyện thêm nhé?</p><button id="practice-table" class="primary wide">Luyện bảng ×${selected} ${icon('arrow')}</button><button id="practice-all" class="text-button centered">Trộn cả 3 bảng ×2, ×5, ×10</button>`,
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
  if (world.spatial.isInArchimedesRealm()) {
    world.teleport(-6, 5);
    toast('Đã trở về Làng Khởi Đầu!');
  } else if (world.spatial.isInGarden()) {
    world.teleport(60, 0);
    toast('Chào mừng bạn đến Đền Cổng Archimedes!');
  } else {
    world.teleport(13, 0);
    toast('Chào mừng bạn đến với Vườn Hoa Tri Thức!');
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
$('help').onclick = help;

function settings() {
  const state = adventure.getState();
  const stats = Object.values(state.questionStats),
    attempts = stats.reduce((a, s) => a + s.attempts, 0),
    correct = stats.reduce((a, s) => a + s.correct, 0);
  openDialog(
    'Một chút cài đặt',
    `<div class="settings-row"><span>Hiệu ứng âm thanh</span><button id="toggle-sound" class="switch" role="switch" aria-checked="${state.sound}" aria-label="Hiệu ứng âm thanh"><i></i></button></div><div class="settings-row"><span>Nhạc nền nhẹ nhàng</span><button id="toggle-music" class="switch" role="switch" aria-checked="${state.music}" aria-label="Nhạc nền"><i></i></button></div><div class="progress-summary"><span><strong>${state.xp}</strong>XP tích lũy</span><span><strong>${attempts}</strong>Lượt trả lời</span><span><strong>${attempts ? Math.round((correct / attempts) * 100) : 0}%</strong>Trả lời đúng</span></div><p class="book-note">Tiến trình tự lưu trên trình duyệt này, không cần tài khoản. Xóa dữ liệu trình duyệt sẽ xóa tiến trình.</p><button id="save-now" class="secondary wide">${icon('save')} Lưu tiến trình</button><button id="return-menu" class="text-button centered">Về màn hình chính</button><button id="reset-progress" class="text-button danger centered">${icon('reset')} Chơi lại từ đầu</button>`,
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
$('sound').onclick = () => {
  const state = adventure.getState();
  adventure.setAudio(!state.sound, state.music);
  updateHUD();
};
$('jump').onclick = () => world.jump();

document.addEventListener('keydown', e => {
  if (e.repeat && ['e', ' ', 'Escape'].includes(e.key)) return;
  if ($<HTMLDialogElement>('dialog').open) {
    if ((currentDialog === 'quiz' || currentDialog === 'flowerQuiz' || currentDialog === 'archimedesQuiz') && /^[123]$/.test(e.key)) {
      const sel = currentDialog === 'flowerQuiz' ? '.flower-opt' : currentDialog === 'archimedesQuiz' ? '.arch-opt' : '.answer';
      const b = document.querySelectorAll<HTMLButtonElement>(sel)[Number(e.key) - 1];
      if (b && !b.disabled) b.click();
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
let joystickId = -1;
function joystickMove(e: PointerEvent) {
  if (e.pointerId !== joystickId) return;
  const r = joystick.getBoundingClientRect();
  let x = (e.clientX - r.left - r.width / 2) / 34,
    y = (e.clientY - r.top - r.height / 2) / 34;
  const l = Math.max(1, Math.hypot(x, y));
  x /= l;
  y /= l;
  world.joystick = { x, y };
  $('joystick-knob').style.transform = `translate(${x * 30}px,${y * 30}px)`;
}
joystick.addEventListener('pointerdown', e => {
  joystickId = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  joystickMove(e);
});
joystick.addEventListener('pointermove', joystickMove);
for (const event of ['pointerup', 'pointercancel'])
  joystick.addEventListener(event, () => {
    joystickId = -1;
    world.joystick = { x: 0, y: 0 };
    $('joystick-knob').style.transform = '';
  });

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
    if (locName === 'Vườn Hoa Tri Thức') subLabel = '10 THỬ THÁCH HOA NỞ';
    else if (locName === 'Đền Cổng Archimedes') subLabel = 'TRUNG TÂM CỔNG KHÔNG GIAN';
    else if (locName === 'Thung Lũng Tính Toán') subLabel = 'CHUYÊN ĐỀ 1: PHÉP TÍNH NHANH (BÀI 306 - 313)';
    else if (locName === 'Suối Nguồn Dãy Số') subLabel = 'CHUYÊN ĐỀ 2: QUY LUẬT DÃY SỐ (BÀI 314 - 321)';
    else if (locName === 'Đồi Thời Gian') subLabel = 'CHUYÊN ĐỀ 3: THỜI GIAN & ĐO LƯỜNG (BÀI 322 - 329)';
    else if (locName === 'Rừng Hình Học') subLabel = 'CHUYÊN ĐỀ 4: HÌNH HỌC TRỰC QUAN (BÀI 330 - 337)';
    else if (locName === 'Đỉnh Núi Tư Duy Sao') subLabel = 'CHUYÊN ĐỀ 5: TỔNG HỢP & NÂNG CAO (BÀI 338 - 345)';
    else if (inArchimedes) subLabel = '40 BIA ĐÁ TRI THỨC';

    $('area-label-sub').textContent = subLabel;
    $('travel-text').textContent = inArchimedes ? 'Về Làng Khởi Đầu' : inGarden ? 'Đến Đền Archimedes' : 'Đến Vườn Hoa';

    const nearPortalObj = world.spatial.getNearPortal();

    if (nearMonolith !== -1) {
      const m = ARCHIMEDES_MONOLITHS[nearMonolith];
      const done = adventure.getState().monoliths[nearMonolith];
      $('interact').innerHTML = `⚡ <b>Bia Đá ${m.id}</b> ${done ? '(Đã kích hoạt - Xem lại)' : '(Bấm E để giải bài)'} ${icon('arrow')}`;
      $('interact').hidden = world.paused;
    } else if (nearPortal) {
      $('interact').innerHTML = `🏛️ <b>${nearPortalObj?.name || 'Cổng Archimedes'}</b> (Bấm E để mở Bản Đồ) ${icon('arrow')}`;
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
  $('loading').hidden = true;
  updateHUD();
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
    ).catch(() => {});
  } catch {
    /* Optional browser capability; gameplay stays available. */
  }
}
window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
