import { Vector3 } from 'three';
import type { Adventure } from '../core/adventure';
import type { World } from '../world/World';
import { BRIDGE_PARTS } from '../data/config';
import { generateQuestion } from './engine';
import {
  createMultiplicationChallenge,
  createFlowerChallenge,
  createArchimedesChallenge,
  ChallengeSession,
  parseAnswer,
  type ParsedAnswer,
  type MultiplicationChallenge,
  type FlowerChallenge,
  type ArchimedesChallenge
} from './session';
import type { RemoteZoneConfig, RemoteProblem } from '../data/remoteTypes';

export const icons: Record<string, string> = {
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
  zoom: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  device: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>'
};

export const icon = (name: string): string =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.star}</svg>`;

export function openLightbox(src: string, alt?: string): void {
  const lightbox = document.getElementById('image-lightbox') as HTMLDialogElement | null;
  const img = document.getElementById('lightbox-img') as HTMLImageElement | null;
  if (!lightbox || !img) return;
  img.src = src;
  img.alt = alt || 'Hình ảnh chi tiết';
  if (!lightbox.open) {
    lightbox.showModal();
  }
}

export function closeLightbox(): void {
  const lightbox = document.getElementById('image-lightbox') as HTMLDialogElement | null;
  if (!lightbox || !lightbox.open) return;
  lightbox.close();
  const img = document.getElementById('lightbox-img') as HTMLImageElement | null;
  if (img) img.src = '';
}

export function isLightboxOpen(): boolean {
  const lightbox = document.getElementById('image-lightbox') as HTMLDialogElement | null;
  return Boolean(lightbox && lightbox.open);
}

export function renderQuestionImage(imageUrl?: string, altText?: string, isExplanation = false): string {
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

export interface ChallengeDialogHost {
  openDialog: (title: string, body: string, kind: string) => void;
  closeDialog: () => void;
  playCue: (cue: 'celebrate' | 'correct' | 'hint' | 'jump') => void;
  updateHUD: () => void;
  burstPlayer: () => void;
  toast: (msg: string) => void;
  adventure: Adventure;
  getWorld: () => World;
  logRemoteProgress: (record: {
    zoneId: number | string;
    problemId: number | string;
    stepId?: string;
    isCorrect: boolean;
    score?: number;
    details?: any;
  }) => Promise<void>;
  onOpenMap?: (selectedZoneId?: number) => void;
}

/**
 * Deep UI module that encapsulates challenge presentation:
 * - Multi-slot and numeric input rendering with virtual numpad
 * - Touch and keyboard navigation across answer slots
 * - Tiered hint expansions and diagram/explanation rendering
 * - Image zoom lightbox integration
 * - Multiplication, Flower, and Archimedes Trial modals
 */
export class ChallengeDialog {
  private currentSession?: ChallengeSession;
  private isMultiSlot = false;
  private currentSlotValues: string[] = [];
  private activeSlotIndex = 0;
  private currentInputValue = '';
  private currentMode: 'bridge' | 'practice' = 'bridge';

  constructor(private host: ChallengeDialogHost) {}

  getSession(): ChallengeSession | undefined {
    return this.currentSession;
  }

  resetSession(): void {
    this.currentSession = undefined;
    this.currentInputValue = '';
    this.currentSlotValues = [];
  }

  isLightboxOpen(): boolean {
    return isLightboxOpen();
  }

  closeLightbox(): void {
    closeLightbox();
  }

  initLightboxListeners(): void {
    const lightbox = document.getElementById('image-lightbox') as HTMLDialogElement | null;
    const closeBtn = document.getElementById('lightbox-close');

    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeLightbox();
      };
    }

    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || (e.target as HTMLElement).classList.contains('lightbox-backdrop')) {
          closeLightbox();
        }
      });

      lightbox.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeLightbox();
      });
    }

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
  }

  // -------------------------------------------------------------
  // Keyboard Routing for Active Challenges
  // -------------------------------------------------------------
  handleKeyDown(e: KeyboardEvent): boolean {
    if (this.isLightboxOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeLightbox();
        return true;
      }
      return false;
    }

    const dialog = document.getElementById('dialog') as HTMLDialogElement | null;
    if (!dialog || !dialog.open) return false;

    const hasMathInput = Boolean(
      document.getElementById('math-input-box') || document.querySelector('.multi-slot-container')
    );

    if (hasMathInput && !this.currentSession?.isSolved()) {
      if (this.isMultiSlot) {
        if (e.key === 'Tab' || e.key === 'ArrowRight') {
          e.preventDefault();
          this.selectSlot((this.activeSlotIndex + 1) % this.currentSlotValues.length);
          return true;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.selectSlot((this.activeSlotIndex - 1 + this.currentSlotValues.length) % this.currentSlotValues.length);
          return true;
        }
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        this.handleNumpadInput(e.key);
        return true;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        this.handleNumpadInput('backspace');
        return true;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.isMultiSlot) {
          if (this.currentSlotValues[this.activeSlotIndex]) {
            const unfilled = this.currentSlotValues.findIndex((v, i) => !v && i > this.activeSlotIndex);
            if (unfilled !== -1) {
              this.selectSlot(unfilled);
              return true;
            }
          }
        }
        const submitBtn = document.getElementById('numpad-submit') as HTMLButtonElement | null;
        if (submitBtn && !submitBtn.disabled) submitBtn.click();
        return true;
      }

      if (['<', '>', '=', '≤', '≥'].includes(e.key)) {
        let targetVal = e.key;
        if (e.key === '≤') targetVal = '<=';
        else if (e.key === '≥') targetVal = '>=';
        const compBtn = document.querySelector<HTMLButtonElement>(`.comp-btn[data-value="${targetVal}"]`);
        if (compBtn && !compBtn.disabled) {
          e.preventDefault();
          compBtn.click();
          return true;
        }
      }
    } else if (dialog.open && !this.currentSession?.isSolved() && /^[1-9]$/.test(e.key)) {
      const optBtns = document.querySelectorAll<HTMLButtonElement>('.flower-opt, .arch-opt, .answer');
      const num = Number(e.key) - 1;
      if (optBtns.length > 0 && optBtns[num] && !optBtns[num].disabled) {
        e.preventDefault();
        optBtns[num].click();
        return true;
      }
    } else if (this.currentSession?.isSolved()) {
      if (e.key === 'Enter' || e.key === ' ') {
        const nextBtn = [
          document.getElementById('next-question'),
          document.getElementById('flower-close-btn'),
          document.getElementById('arch-next-step'),
          document.getElementById('arch-finish-btn')
        ].find((b) => b && !b.hidden) as HTMLElement | undefined;
        if (nextBtn) {
          e.preventDefault();
          nextBtn.click();
          return true;
        }
      }
    }

    return false;
  }

  // -------------------------------------------------------------
  // Multiplication Challenge Dialog
  // -------------------------------------------------------------
  openMultiplication(nextMode: 'bridge' | 'practice', lastId = ''): void {
    this.currentMode = nextMode;
    const state = this.host.adventure.getState();
    const q = generateQuestion(state, this.currentMode, lastId);
    const challenge = createMultiplicationChallenge(q.a, q.b, this.currentMode, Math.random, q.review);
    this.currentSession = new ChallengeSession(challenge);
    this.currentInputValue = '';
    this.isMultiSlot = false;

    const equationHtml =
      this.currentMode === 'bridge'
        ? `${challenge.a} <span>×</span> <span class="missing-factor">[ ? ]</span> <span>=</span> ${challenge.answer} <small>viên đá</small>`
        : `${challenge.a} <span>×</span> ${challenge.b} <span>=</span> ?`;

    const introHtml =
      this.currentMode === 'bridge'
        ? `Mình cần <strong>${challenge.answer} viên đá</strong> để xây cầu. Điền thừa số còn thiếu:`
        : 'Bạn hãy tính và nhập kết quả phép nhân:';

    this.host.openDialog(
      this.currentMode === 'bridge' ? 'Cùng xây cây cầu!' : 'Mỗi ngày, giỏi hơn một chút',
      `<div class="dialog-eyebrow">${this.currentMode === 'bridge' ? `ĐOẠN CẦU ${state.bridge + 1} / ${BRIDGE_PARTS}` : challenge.review ? 'ÔN LẠI PHÉP NHÂN' : 'LUYỆN TẬP CÙNG MILO'}</div>
      <p class="question-intro">${introHtml}</p>
      <div class="equation">${equationHtml}</div>
      ${this.renderMathInputAndNumpad()}
      <div id="feedback" class="feedback" aria-live="polite"></div>
      <div id="hint-area" class="hint-area" hidden></div>
      <div class="quiz-footer"><button id="hint" class="text-button">${icon('help')} Gợi ý cho mình</button><span>Không giới hạn thời gian</span></div>
      <button id="next-question" class="primary wide" hidden>Tiếp tục ${icon('arrow')}</button>`,
      'quiz'
    );

    this.setupNumpadListeners((val) => this.submitMultiplicationAnswer(Number(val), challenge));

    const hintBtn = document.getElementById('hint');
    if (hintBtn) {
      hintBtn.onclick = () => {
        if (!this.currentSession) return;
        const hintText = this.currentSession.requestHint();
        this.renderMultiplicationHint(hintText, challenge);
      };
    }

    const nextBtn = document.getElementById('next-question');
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (this.currentMode === 'bridge' && this.host.adventure.getState().bridge === BRIDGE_PARTS) {
          this.host.closeDialog();
          this.host.toast('Tuyệt vời! Cầu đã xây xong. Cùng đi qua cầu đến Vườn Hoa Tri Thức nhé!');
        } else {
          this.openMultiplication(this.currentMode, challenge.id);
        }
      };
    }
  }

  private renderMultiplicationHint(hintText: string, challenge: MultiplicationChallenge): void {
    const area = document.getElementById('hint-area');
    if (!area) return;
    area.hidden = false;
    area.innerHTML = `<p>${hintText}</p><div class="stone-groups" aria-label="${challenge.b} nhóm, mỗi nhóm có ${challenge.a} viên đá">${Array.from({ length: challenge.b }, () => `<div class="stone-group">${'<i></i>'.repeat(challenge.a)}</div>`).join('')}</div>`;
  }

  private submitMultiplicationAnswer(value: number, challenge: MultiplicationChallenge): void {
    if (!this.currentSession || this.currentSession.isSolved()) return;
    const res = this.currentSession.submit(value);
    const inputBox = document.getElementById('math-input-box');

    if (res.isCorrect) {
      const delta = this.host.adventure.recordQuizResult({
        isCorrect: true,
        questionId: challenge.id,
        isBridgeMode: this.currentMode === 'bridge',
        firstTry: res.attempts === 1,
        responseTimeMs: this.currentSession.getDurationMs()
      });

      if (this.currentMode === 'bridge') {
        this.host.getWorld().setBridge(delta.bridge, true);
      }
      if (inputBox) {
        inputBox.classList.remove('shake', 'error');
        inputBox.classList.add('correct');
      }
      document.querySelectorAll<HTMLButtonElement>('.numpad-btn, #numpad-submit').forEach((b) => (b.disabled = true));
      const container = document.querySelector<HTMLElement>('.numpad-container');
      if (container) container.style.display = 'none';

      const feedback = document.getElementById('feedback');
      if (feedback) {
        feedback.className = 'feedback success';
        feedback.textContent = `✓ Chính xác! ${challenge.a} × ${challenge.b} = ${challenge.answer}. +10 XP · +5 xu${delta.combo >= 3 ? ` · Combo ${delta.combo}!` : ''}`;
      }

      const nextQuestion = document.getElementById('next-question') as HTMLButtonElement | null;
      if (nextQuestion) {
        nextQuestion.hidden = false;
        nextQuestion.innerHTML = `${this.currentMode === 'bridge' && delta.bridge === BRIDGE_PARTS ? 'Khám phá Vườn Hoa bên kia cầu!' : this.currentMode === 'bridge' ? 'Xây đoạn cầu tiếp theo' : 'Thử thêm một câu'} ${icon('arrow')}`;
        nextQuestion.focus();
      }

      const hintEl = document.getElementById('hint');
      if (hintEl) hintEl.hidden = true;

      this.host.burstPlayer();

      if (delta.leveledUp) {
        this.host.playCue('celebrate');
        this.host.toast(`Bạn đã đạt cấp ${delta.newLevel}. Thật tuyệt vời!`);
      } else {
        this.host.playCue('correct');
      }
    } else {
      this.host.adventure.recordQuizResult({
        isCorrect: false,
        questionId: challenge.id,
        isBridgeMode: this.currentMode === 'bridge',
        firstTry: false,
        responseTimeMs: this.currentSession.getDurationMs()
      });
      if (inputBox) {
        inputBox.classList.remove('shake');
        void inputBox.offsetWidth;
        inputBox.classList.add('shake', 'error');
      }
      const feedback = document.getElementById('feedback');
      if (feedback) {
        feedback.className = 'feedback gentle';
        feedback.textContent = '↻ Chưa đúng rồi. Mình cùng đếm lại nhé!';
      }
      this.renderMultiplicationHint(res.hint, challenge);
      this.host.playCue('hint');
    }
    this.host.updateHUD();
  }

  // -------------------------------------------------------------
  // Flower Trial Dialog
  // -------------------------------------------------------------
  openFlower(index: number, remoteFlowers?: RemoteProblem[]): void {
    const targetId = index + 1;
    const remoteQ =
      remoteFlowers &&
      (remoteFlowers.find((p) => Number(p.id) === targetId) || remoteFlowers[index]);

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

    this.currentSession = new ChallengeSession(challenge);
    this.currentInputValue = '';
    const q = challenge.flowerQuestion;
    const isBloomed = this.host.adventure.getState().flowers[index];
    const parsed = parseAnswer(challenge.answer);

    const renderFlowerHint = (hintText: string, explanation?: string) => {
      const area = document.getElementById('flower-hint-area');
      if (!area) return;
      area.hidden = false;
      const stage = this.currentSession?.getHintStage() ?? 1;
      const explImg = challenge.explanationImageUrl || q.explanationImageUrl;
      area.innerHTML = `
        <p><strong>💡 Gợi ý cấp ${stage}:</strong> ${hintText}</p>
        ${explanation ? `<p class="hint-explanation"><em>Lời giải: ${explanation}</em></p>` : ''}
        ${renderQuestionImage(explImg, 'Hình minh họa lời giải', true)}
      `;
    };

    const handleFlowerSubmit = (choiceVal: string | string[]) => {
      if (!this.currentSession || this.currentSession.isSolved()) return;
      const res = this.currentSession.submit(choiceVal);
      const inputBox = document.getElementById('math-input-box');

      if (res.isCorrect) {
        if (inputBox) {
          inputBox.classList.remove('shake', 'error');
          inputBox.classList.add('correct');
        }
        if (this.isMultiSlot) {
          document.querySelectorAll<HTMLElement>('.math-slot-box').forEach((b) => {
            b.classList.remove('shake', 'error', 'active');
            b.classList.add('correct');
          });
        }
        document
          .querySelectorAll<HTMLButtonElement>('.flower-opt, .numpad-btn, #numpad-submit, .comp-btn, .slot-nav-btn')
          .forEach((b) => (b.disabled = true));
        const numpadContainer = document.querySelector<HTMLElement>('.numpad-container');
        if (numpadContainer) numpadContainer.style.display = 'none';
        const slotNavBar = document.querySelector<HTMLElement>('.slot-nav-bar');
        if (slotNavBar) slotNavBar.style.display = 'none';

        const feedback = document.getElementById('flower-feedback');
        if (feedback) feedback.className = 'feedback success';
        const delta = this.host.adventure.bloomFlower(index);

        if (!delta.alreadyBloomed) {
          this.host.getWorld().bloomFlower(index);
          this.host.playCue('celebrate');
          if (feedback) feedback.textContent = `✓ Chính xác! Cây hoa số ${index + 1} đã nở hoa rực rỡ! +15 XP · +5 xu`;
          this.host.updateHUD();

          this.host.logRemoteProgress({
            zoneId: 6,
            problemId: challenge.flowerQuestion?.id || index + 1,
            stepId: `flower_${challenge.flowerQuestion?.id || index + 1}`,
            isCorrect: true,
            score: 15
          });

          if (delta.allFlowersCompleted) {
            setTimeout(() => {
              this.host.openDialog(
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
              this.host.updateHUD();
              const grandBtn = document.getElementById('close-grand');
              if (grandBtn) grandBtn.onclick = this.host.closeDialog;
            }, 1200);
          }
        } else {
          this.host.playCue('correct');
          if (feedback) feedback.textContent = `✓ Chính xác! Cây hoa số ${index + 1} vốn đã nở hoa rất đẹp!`;
        }

        const hintBtn = document.getElementById('flower-hint');
        if (hintBtn) hintBtn.hidden = true;
        const closeBtn = document.getElementById('flower-close-btn') as HTMLButtonElement | null;
        if (closeBtn) {
          closeBtn.hidden = false;
          closeBtn.onclick = this.host.closeDialog;
          closeBtn.focus();
        }
      } else {
        if (inputBox) {
          inputBox.classList.remove('shake');
          void inputBox.offsetWidth;
          inputBox.classList.add('shake', 'error');
        }
        if (this.isMultiSlot && res.slotResults) {
          res.slotResults.forEach((correct, idx) => {
            const box = document.getElementById(`slot-box-${idx}`);
            if (box) {
              box.classList.remove('shake', 'error', 'correct');
              void box.offsetWidth;
              if (correct) {
                box.classList.add('correct');
              } else {
                box.classList.add('shake', 'error');
              }
            }
          });
          const firstWrong = res.slotResults.findIndex((c) => !c);
          if (firstWrong !== -1) {
            this.selectSlot(firstWrong);
          }
        }
        const feedback = document.getElementById('flower-feedback');
        if (feedback) {
          feedback.className = 'feedback gentle';
          const correctCount = res.slotResults ? res.slotResults.filter(Boolean).length : 0;
          const totalSlots = res.slotResults ? res.slotResults.length : 0;
          if (totalSlots > 1 && correctCount > 0) {
            feedback.textContent = `↻ Bạn đã làm đúng ${correctCount}/${totalSlots} ô. Hãy xem lại ô màu đỏ và đọc gợi ý nhé!`;
          } else {
            feedback.textContent = '↻ Chưa đúng rồi. Hãy đọc gợi ý để cùng thử lại nhé!';
          }
        }
        renderFlowerHint(res.hint, res.explanation);
        this.host.playCue('hint');
      }
    };

    let bodyControls = '';
    if (parsed.type === 'multi' && parsed.slots && parsed.slots.length > 0) {
      bodyControls = this.renderMultiSlotInputAndNumpad(parsed.slots);
    } else if (parsed.type === 'numeric') {
      bodyControls = this.renderMathInputAndNumpad(parsed.unit);
    } else if (parsed.type === 'comparison') {
      const compOptions =
        challenge.options && challenge.options.length > 0
          ? challenge.options.map((o) => String(o.value || o.label).trim())
          : ['<', '=', '>'];
      bodyControls = this.renderComparisonControls(compOptions);
    } else {
      bodyControls = `
        <div class="answers flower-answers">
          ${q.options
            .map(
              (o, i) => `
            <button class="answer flower-opt" data-value="${o.value}">
              <kbd>${i + 1}</kbd><span>${o.label}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `;
    }

    this.host.openDialog(
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
        <span>${this.host.adventure.getState().flowers.filter(Boolean).length} / 10 cây hoa đã nở</span>
      </div>
      <button id="flower-close-btn" class="primary wide" hidden>Ngắm hoa nở ${icon('arrow')}</button>
      `,
      'flowerQuiz'
    );

    this.setupNumpadListeners(handleFlowerSubmit);

    document.querySelectorAll<HTMLButtonElement>('.flower-opt').forEach((btn) => {
      btn.onclick = () => handleFlowerSubmit(btn.dataset.value ?? '');
    });

    const hintBtn = document.getElementById('flower-hint');
    if (hintBtn) {
      hintBtn.onclick = () => {
        if (!this.currentSession) return;
        const hintText = this.currentSession.requestHint();
        renderFlowerHint(hintText);
      };
    }
  }

  // -------------------------------------------------------------
  // Archimedes Monolith Trial Dialog
  // -------------------------------------------------------------
  openArchimedes(
    monolithRef: number | string,
    stepIndex = 0,
    activeRemoteQuestions: Record<string, RemoteProblem[]> = {},
    activeRemoteZones: RemoteZoneConfig[] = [],
    activeMonolithProblems: RemoteProblem[] = []
  ): void {
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

    const monolithIndex = typeof monolithRef === 'number' ? monolithRef : monolithId - 306;

    if (remoteProblem && remoteProblem.steps && remoteProblem.steps.length > 0) {
      const rStep = remoteProblem.steps[Math.min(stepIndex, remoteProblem.steps.length - 1)] || remoteProblem.steps[0];
      const parentZone = activeRemoteZones.find((z) => {
        const list = activeRemoteQuestions[z.sheetName];
        return list?.some((p) => Number(p.id) === Number(remoteProblem?.id));
      });
      const pId = Number(remoteProblem.id) || monolithId;
      const validZoneId = (parentZone?.id && parentZone.id <= 5 ? parentZone.id : 1) as 1 | 2 | 3 | 4 | 5;
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
    this.currentSession = new ChallengeSession(challenge);
    this.currentInputValue = '';
    const step = challenge.step;
    const isDone = this.host.adventure.getState().monoliths[monolithIndex];
    const parsed = parseAnswer(challenge.answer);

    const renderArchimedesHint = (hintText: string, explanation?: string) => {
      const area = document.getElementById('arch-hint-area');
      if (!area) return;
      area.hidden = false;
      const stage = this.currentSession?.getHintStage() ?? 1;
      const explImg = step.explanationImageUrl || challenge.explanationImageUrl;
      area.innerHTML = `
        <p><strong>💡 Gợi ý bước ${stage}:</strong> ${hintText}</p>
        ${explanation ? `<p class="hint-explanation"><em>Lời giải chi tiết: ${explanation}</em></p>` : ''}
        ${renderQuestionImage(explImg, 'Hình minh họa lời giải', true)}
      `;
    };

    const handleArchSubmit = (choiceVal: string | string[]) => {
      if (!this.currentSession || this.currentSession.isSolved()) return;
      const res = this.currentSession.submit(choiceVal);
      const inputBox = document.getElementById('math-input-box');

      if (res.isCorrect) {
        if (inputBox) {
          inputBox.classList.remove('shake', 'error');
          inputBox.classList.add('correct');
        }
        if (this.isMultiSlot) {
          document.querySelectorAll<HTMLElement>('.math-slot-box').forEach((b) => {
            b.classList.remove('shake', 'error', 'active');
            b.classList.add('correct');
          });
        }
        document
          .querySelectorAll<HTMLButtonElement>('.arch-opt, .numpad-btn, #numpad-submit, .comp-btn, .slot-nav-btn')
          .forEach((b) => (b.disabled = true));
        const numpadContainer = document.querySelector<HTMLElement>('.numpad-container');
        if (numpadContainer) numpadContainer.style.display = 'none';
        const slotNavBar = document.querySelector<HTMLElement>('.slot-nav-bar');
        if (slotNavBar) slotNavBar.style.display = 'none';

        const feedback = document.getElementById('arch-feedback');
        if (feedback) feedback.className = 'feedback success';

        const isLastStep = stepIndex + 1 >= challenge.totalSteps;
        this.host.logRemoteProgress({
          zoneId: m.zoneId,
          problemId: m.id,
          stepId: step.stepId,
          isCorrect: true,
          score: isLastStep ? 20 : 10
        });

        if (!isLastStep) {
          this.host.playCue('correct');
          if (feedback) feedback.textContent = `✓ Chính xác! Bước ${stepIndex + 1} hoàn thành xuất sắc!`;
          const hintBtn = document.getElementById('arch-hint');
          if (hintBtn) hintBtn.hidden = true;
          const nextStepBtn = document.getElementById('arch-next-step') as HTMLButtonElement | null;
          if (nextStepBtn) {
            nextStepBtn.hidden = false;
            nextStepBtn.onclick = () =>
              this.openArchimedes(monolithIndex, stepIndex + 1, activeRemoteQuestions, activeRemoteZones, activeMonolithProblems);
            nextStepBtn.focus();
          }
        } else {
          const delta = this.host.adventure.activateMonolith(monolithIndex);
          this.host.getWorld().activateMonolith(monolithIndex);
          this.host.playCue('celebrate');
          this.host.burstPlayer();

          if (feedback) {
            feedback.textContent = delta.alreadyActivated
              ? `✓ Chính xác! Bạn đã ôn luyện lại Bia Đá ${m.id} thành công!`
              : `✓ Xuất sắc! Kích hoạt thành công Bia Đá ${m.id}! +${delta.xpGained} XP · +${delta.coinsGained} xu`;
          }

          this.host.updateHUD();
          const hintBtn = document.getElementById('arch-hint');
          if (hintBtn) hintBtn.hidden = true;
          const finishBtn = document.getElementById('arch-finish-btn') as HTMLButtonElement | null;
          if (finishBtn) {
            finishBtn.hidden = false;
            finishBtn.onclick = this.host.closeDialog;
            finishBtn.focus();
          }

          if (delta.zoneCompleted) {
            setTimeout(() => {
              this.host.openDialog(
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
                <button id="close-zone-grand" class="primary wide">Tiếp tục khám phá ${icon('arrow')}</button>
                `,
                'complete'
              );
              this.host.updateHUD();
              const closeZoneBtn = document.getElementById('close-zone-grand');
              if (closeZoneBtn) closeZoneBtn.onclick = this.host.closeDialog;
            }, 1200);
          }
        }
      } else {
        this.host.logRemoteProgress({
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
        if (this.isMultiSlot && res.slotResults) {
          res.slotResults.forEach((correct, idx) => {
            const box = document.getElementById(`slot-box-${idx}`);
            if (box) {
              box.classList.remove('shake', 'error', 'correct');
              void box.offsetWidth;
              if (correct) {
                box.classList.add('correct');
              } else {
                box.classList.add('shake', 'error');
              }
            }
          });
          const firstWrong = res.slotResults.findIndex((c) => !c);
          if (firstWrong !== -1) {
            this.selectSlot(firstWrong);
          }
        }
        const feedback = document.getElementById('arch-feedback');
        if (feedback) {
          feedback.className = 'feedback gentle';
          const correctCount = res.slotResults ? res.slotResults.filter(Boolean).length : 0;
          const totalSlots = res.slotResults ? res.slotResults.length : 0;
          if (totalSlots > 1 && correctCount > 0) {
            feedback.textContent = `↻ Bạn đã làm đúng ${correctCount}/${totalSlots} ô. Hãy xem lại ô màu đỏ và đọc gợi ý nhé!`;
          } else {
            feedback.textContent = '↻ Chưa chính xác rồi. Hãy đọc gợi ý để làm lại nhé!';
          }
        }
        renderArchimedesHint(res.hint, res.explanation);
        this.host.playCue('hint');
      }
    };

    let bodyControls = '';
    if (parsed.type === 'multi' && parsed.slots && parsed.slots.length > 0) {
      bodyControls = this.renderMultiSlotInputAndNumpad(parsed.slots);
    } else if (parsed.type === 'numeric') {
      bodyControls = this.renderMathInputAndNumpad(parsed.unit);
    } else if (parsed.type === 'comparison') {
      const compOptions =
        step.options && step.options.length > 0
          ? step.options.map((o) => String(o.value || o.label).trim())
          : ['<', '=', '>'];
      bodyControls = this.renderComparisonControls(compOptions);
    } else {
      bodyControls = `
        <div class="answers arch-answers">
          ${step.options
            .map(
              (o, i) => `
            <button class="answer arch-opt" data-value="${o.value}">
              <kbd>${i + 1}</kbd><span>${o.label}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `;
    }

    this.host.openDialog(
      `Bia Đá #${m.id}: ${m.title}`,
      `
      <div class="dialog-eyebrow">${m.zoneName.toUpperCase()} · BƯỚC ${stepIndex + 1} / ${challenge.totalSteps}</div>
      <div class="flower-status-banner ${isDone ? 'bloomed' : 'bud'}">
        ${isDone ? '✨ Bia đá này đã được bạn thắp sáng! Có thể luyện tập lại để nhận thêm XP.' : '🔒 Bia đá đang đợi bạn giải câu đố để thắp sáng nguồn năng lượng cổ xưa.'}
      </div>
      <div class="flower-question-box">
        <div class="flower-question-prompt">${step.prompt}</div>
        ${step.diagramSvg ? `<div class="step-diagram-svg">${step.diagramSvg}</div>` : ''}
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

    const backMapBtn = document.getElementById('back-map-btn');
    if (backMapBtn) {
      backMapBtn.onclick = () => this.host.onOpenMap?.(m.zoneId);
    }

    this.setupNumpadListeners(handleArchSubmit);

    document.querySelectorAll<HTMLButtonElement>('.arch-opt').forEach((btn) => {
      btn.onclick = () => handleArchSubmit(btn.dataset.value ?? '');
    });

    const hintBtn = document.getElementById('arch-hint');
    if (hintBtn) {
      hintBtn.onclick = () => {
        if (!this.currentSession) return;
        const hint = this.currentSession.requestHint();
        renderArchimedesHint(hint);
      };
    }
  }

  // -------------------------------------------------------------
  // Internal UI Renderers & Numpad Listeners
  // -------------------------------------------------------------
  private renderMathInputAndNumpad(unit = ''): string {
    this.isMultiSlot = false;
    this.currentInputValue = '';
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

  private renderMultiSlotInputAndNumpad(slots: ParsedAnswer[]): string {
    this.isMultiSlot = true;
    this.currentSlotValues = new Array(slots.length).fill('');
    this.activeSlotIndex = 0;

    return `
      <div class="multi-slot-wrapper">
        <div class="multi-slot-container" role="group" aria-label="Các ô điền đáp án">
          ${slots
            .map(
              (slot, idx) => `
            ${idx > 0 ? '<span class="slot-arrow">➔</span>' : ''}
            <div class="math-slot-item ${idx === 0 ? 'active' : ''}" data-slot-index="${idx}">
              <span class="slot-badge">${idx + 1}</span>
              <div id="slot-box-${idx}" class="math-slot-box ${idx === 0 ? 'active' : ''} placeholder" tabindex="0">?</div>
              ${slot.unit ? `<span class="math-input-unit">${slot.unit}</span>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
        <div class="slot-nav-bar">
          <button type="button" id="prev-slot-btn" class="slot-nav-btn" title="Ô trước" disabled>◀ Ô trước</button>
          <span id="slot-status-indicator" class="slot-nav-indicator">Ô 1 / ${slots.length}</span>
          <button type="button" id="next-slot-btn" class="slot-nav-btn" title="Ô sau" ${slots.length <= 1 ? 'disabled' : ''}>Ô sau ▶</button>
        </div>
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

  private renderComparisonControls(compOptions: string[]): string {
    const getCompLabel = (v: string) => {
      if (v === '<') return '&lt;';
      if (v === '>') return '&gt;';
      if (v === '<=' || v === '≤') return '&le;';
      if (v === '>=' || v === '≥') return '&ge;';
      return v;
    };
    return `
      <div class="math-input-container">
        <div id="math-input-box" class="math-input-display placeholder" tabindex="0">?</div>
      </div>
      <div class="comp-options">
        ${compOptions.map((op) => `<button type="button" class="comp-btn" data-value="${op}">${getCompLabel(op)}</button>`).join('')}
      </div>
    `;
  }

  private selectSlot(index: number): void {
    if (index < 0 || index >= this.currentSlotValues.length) return;
    this.activeSlotIndex = index;
    document.querySelectorAll<HTMLElement>('.math-slot-item').forEach((item) => {
      const idx = Number(item.dataset.slotIndex);
      item.classList.toggle('active', idx === this.activeSlotIndex);
    });
    document.querySelectorAll<HTMLElement>('.math-slot-box').forEach((box, idx) => {
      box.classList.toggle('active', idx === this.activeSlotIndex);
    });
    const ind = document.getElementById('slot-status-indicator');
    if (ind) ind.textContent = `Ô ${this.activeSlotIndex + 1} / ${this.currentSlotValues.length}`;
    const prevBtn = document.getElementById('prev-slot-btn') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('next-slot-btn') as HTMLButtonElement | null;
    if (prevBtn) prevBtn.disabled = this.activeSlotIndex === 0;
    if (nextBtn) nextBtn.disabled = this.activeSlotIndex === this.currentSlotValues.length - 1;
  }

  private updateSlotDisplay(index: number, val: string): void {
    const box = document.getElementById(`slot-box-${index}`);
    if (!box) return;
    if (!val) {
      box.textContent = '?';
      box.classList.add('placeholder');
    } else {
      box.textContent = val;
      box.classList.remove('placeholder');
    }
  }

  private updateMathInputDisplay(val: string): void {
    const box = document.getElementById('math-input-box');
    if (!box) return;
    if (!val) {
      box.textContent = '?';
      box.classList.add('placeholder');
    } else {
      box.textContent = val;
      box.classList.remove('placeholder');
    }
  }

  private handleNumpadInput(key: string): void {
    if (!this.currentSession || this.currentSession.isSolved()) return;

    if (this.isMultiSlot) {
      const curVal = this.currentSlotValues[this.activeSlotIndex] || '';
      const box = document.getElementById(`slot-box-${this.activeSlotIndex}`);
      if (box) box.classList.remove('shake', 'error');

      if (key === 'backspace') {
        if (curVal.length > 0) {
          this.currentSlotValues[this.activeSlotIndex] = curVal.slice(0, -1);
          this.updateSlotDisplay(this.activeSlotIndex, this.currentSlotValues[this.activeSlotIndex]);
        }
      } else if (key === 'clear') {
        this.currentSlotValues[this.activeSlotIndex] = '';
        this.updateSlotDisplay(this.activeSlotIndex, '');
      } else if (/^[0-9]$/.test(key)) {
        if (curVal.length < 5) {
          this.currentSlotValues[this.activeSlotIndex] = curVal + key;
          this.updateSlotDisplay(this.activeSlotIndex, this.currentSlotValues[this.activeSlotIndex]);
        }
      }
      return;
    }

    const box = document.getElementById('math-input-box');
    if (box) box.classList.remove('shake', 'error');

    if (key === 'backspace') {
      if (this.currentInputValue.length > 0) {
        this.currentInputValue = this.currentInputValue.slice(0, -1);
        this.updateMathInputDisplay(this.currentInputValue);
      }
    } else if (key === 'clear') {
      this.currentInputValue = '';
      this.updateMathInputDisplay(this.currentInputValue);
    } else if (/^[0-9]$/.test(key)) {
      if (this.currentInputValue.length < 5) {
        this.currentInputValue += key;
        this.updateMathInputDisplay(this.currentInputValue);
      }
    }
  }

  private setupNumpadListeners(onSubmit: (val: any) => void): void {
    this.currentInputValue = '';
    document.querySelectorAll<HTMLButtonElement>('.numpad-btn').forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        if (key) this.handleNumpadInput(key);
      };
    });

    if (this.isMultiSlot) {
      document.querySelectorAll<HTMLElement>('.math-slot-item, .math-slot-box').forEach((el) => {
        el.onclick = () => {
          const slotIdx = Number(el.dataset.slotIndex ?? el.closest('.math-slot-item')?.getAttribute('data-slot-index'));
          if (!isNaN(slotIdx)) {
            this.selectSlot(slotIdx);
          }
        };
      });

      const prevBtn = document.getElementById('prev-slot-btn');
      if (prevBtn) {
        prevBtn.onclick = () => this.selectSlot(this.activeSlotIndex - 1);
      }
      const nextBtn = document.getElementById('next-slot-btn');
      if (nextBtn) {
        nextBtn.onclick = () => this.selectSlot(this.activeSlotIndex + 1);
      }
    }

    const submitBtn = document.getElementById('numpad-submit');
    if (submitBtn) {
      submitBtn.onclick = () => {
        if (this.isMultiSlot) {
          const emptyIdx = this.currentSlotValues.findIndex((v) => !v);
          if (emptyIdx !== -1) {
            this.selectSlot(emptyIdx);
            const box = document.getElementById(`slot-box-${emptyIdx}`);
            if (box) {
              box.classList.remove('shake');
              void box.offsetWidth;
              box.classList.add('shake');
            }
            return;
          }
          onSubmit(this.currentSlotValues);
          return;
        }

        if (!this.currentInputValue) {
          const box = document.getElementById('math-input-box');
          if (box) {
            box.classList.remove('shake');
            void box.offsetWidth;
            box.classList.add('shake');
          }
          return;
        }
        onSubmit(this.currentInputValue);
      };
    }

    document.querySelectorAll<HTMLButtonElement>('.comp-btn').forEach((btn) => {
      btn.onclick = () => {
        const val = btn.dataset.value ?? '';
        this.currentInputValue = val;
        this.updateMathInputDisplay(val);
        onSubmit(val);
      };
    });
  }
}
