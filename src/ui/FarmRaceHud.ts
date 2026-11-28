import type { FarmRaceHudSnapshot, FarmRaceLeaderboardEntry } from '../world/farm/FarmRaceLogic';

export interface FarmRaceHudOptions {
  onRecoverToTrack?: () => void;
  onOpenLobby?: () => void;
}

const COMPASS_ROTATE_EPSILON_DEG = 0.6;

export function formatRaceTimeMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getRankBadgeText(rank: number, total: number): string {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
  return `${medal} Hạng ${rank}/${total}`;
}

export class FarmRaceHud {
  private readonly root: HTMLElement;
  private readonly rankEl: HTMLElement;
  private readonly cpEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly boostFillEl: HTMLElement;
  private readonly boostTrackEl: HTMLElement;
  private readonly boostLabelEl: HTMLElement;
  private readonly offtrackEl: HTMLElement;
  private readonly recoverBtn: HTMLButtonElement;
  private readonly gateAlertEl: HTMLElement;
  private readonly gateAlertTextEl: HTMLElement;
  private readonly gateReturnBtn: HTMLButtonElement;
  private readonly sideEl: HTMLElement;
  private readonly sideToggleBtn: HTMLButtonElement;
  private readonly sideBodyEl: HTMLElement;
  private readonly compassArrow: SVGElement;
  private readonly targetNameEl: HTMLElement;
  private readonly directionCueEl: HTMLElement;
  private readonly targetDistEl: HTMLElement;
  private readonly progressBadgeEl: HTMLElement;
  private readonly leaderboardEl: HTMLElement;
  private readonly sideRecoverBtn: HTMLButtonElement;
  private readonly lobbyBtn: HTMLButtonElement;
  private readonly countdownEl: HTMLElement;
  private readonly countdownValueEl: HTMLElement;

  private readonly onRecoverToTrack?: () => void;
  private readonly onOpenLobby?: () => void;

  private collapsed = false;
  private userCollapsedPreference: boolean | null = null;
  private readonly rowElements = new Map<string, HTMLElement>();
  private readonly handleResizeBound = () => this.handleViewportResize();

  private lastRankText = '';
  private lastCpText = '';
  private lastAllSolved: boolean | null = null;
  private lastTimerText = '';
  private lastBoostPct = -1;
  private lastBoostActive: boolean | null = null;
  private lastBoostLabel = '';
  private lastOfftrack: boolean | null = null;
  private lastGateAlertVisible: boolean | null = null;
  private lastGateAlertText = '';
  private lastArrowDeg = Number.NaN;
  private lastTargetLabel = '';
  private lastCueText = '';
  private lastDistText = '';
  private lastProgressBadge = '';
  private lastCountdownText = '';
  private lastCountdownHidden: boolean | null = null;

  constructor(root: HTMLElement, options: FarmRaceHudOptions = {}) {
    this.root = root;
    this.onRecoverToTrack = options.onRecoverToTrack;
    this.onOpenLobby = options.onOpenLobby;

    this.rankEl = this.requireEl<HTMLElement>('#farm-race-rank');
    this.cpEl = this.requireEl<HTMLElement>('#farm-race-checkpoints');
    this.timerEl = this.requireEl<HTMLElement>('#farm-race-timer');
    this.boostFillEl = this.requireEl<HTMLElement>('#farm-race-boost-fill');
    this.boostTrackEl = this.requireEl<HTMLElement>('#farm-race-boost-track');
    this.boostLabelEl = this.requireEl<HTMLElement>('#farm-race-boost-label');
    this.offtrackEl = this.requireEl<HTMLElement>('#farm-race-offtrack');
    this.recoverBtn = this.requireEl<HTMLButtonElement>('#farm-race-recover-btn');
    this.gateAlertEl = this.requireEl<HTMLElement>('#farm-race-gate-alert');
    this.gateAlertTextEl = this.requireEl<HTMLElement>('#farm-race-gate-alert-text');
    this.gateReturnBtn = this.requireEl<HTMLButtonElement>('#farm-race-gate-return-btn');
    this.sideEl = this.requireEl<HTMLElement>('#farm-race-side');
    this.sideToggleBtn = this.requireEl<HTMLButtonElement>('#farm-race-side-toggle');
    this.sideBodyEl = this.requireEl<HTMLElement>('#farm-race-side-body');
    this.compassArrow = this.requireEl<SVGElement>('#farm-race-compass-arrow');
    this.targetNameEl = this.requireEl<HTMLElement>('#farm-race-target-name');
    this.directionCueEl = this.requireEl<HTMLElement>('#farm-race-direction-cue');
    this.targetDistEl = this.requireEl<HTMLElement>('#farm-race-target-dist');
    this.progressBadgeEl = this.requireEl<HTMLElement>('#farm-race-progress-badge');
    this.leaderboardEl = this.requireEl<HTMLElement>('#farm-race-leaderboard');
    this.sideRecoverBtn = this.requireEl<HTMLButtonElement>('#farm-race-side-recover-btn');
    this.lobbyBtn = this.requireEl<HTMLButtonElement>('#farm-race-lobby-btn');
    this.countdownEl = this.requireEl<HTMLElement>('#farm-race-countdown');
    this.countdownValueEl = this.requireEl<HTMLElement>('#farm-race-countdown-value');

    this.setCollapsed(this.isCompactViewport());

    this.sideToggleBtn.addEventListener('click', () => {
      const next = !this.collapsed;
      this.userCollapsedPreference = next;
      this.setCollapsed(next);
    });

    this.recoverBtn.addEventListener('click', () => this.onRecoverToTrack?.());
    this.gateReturnBtn.addEventListener('click', () => this.onRecoverToTrack?.());
    this.sideRecoverBtn.addEventListener('click', () => this.onRecoverToTrack?.());
    this.lobbyBtn.addEventListener('click', () => this.onOpenLobby?.());

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResizeBound);
    }
  }

  private requireEl<T extends Element>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`FarmRaceHud missing required element: ${selector}`);
    }
    return el;
  }

  private isCompactViewport(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 || window.innerHeight <= 620;
  }

  private handleViewportResize(): void {
    if (this.userCollapsedPreference !== null) return;
    this.setCollapsed(this.isCompactViewport());
  }

  private setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.sideEl.classList.toggle('collapsed', collapsed);
    this.sideBodyEl.hidden = collapsed;
    this.sideToggleBtn.setAttribute('aria-expanded', String(!collapsed));
  }

  public sync(snapshot: FarmRaceHudSnapshot): void {
    if (this.root.hidden) {
      this.root.hidden = false;
    }
    if (typeof document !== 'undefined') {
      document.body.classList.add('in-farm-race');
    }

    const rankText = getRankBadgeText(snapshot.rank, snapshot.totalRacers);
    if (rankText !== this.lastRankText) {
      this.lastRankText = rankText;
      this.rankEl.textContent = rankText;
    }

    const cpText = snapshot.allCheckpointsSolved
      ? `🔓 Đủ ${snapshot.totalCheckpoints}/${snapshot.totalCheckpoints} · Về đích!`
      : `🔒 Trạm ${snapshot.checkpointsSolved}/${snapshot.totalCheckpoints}`;
    if (cpText !== this.lastCpText) {
      this.lastCpText = cpText;
      this.cpEl.textContent = cpText;
    }
    if (snapshot.allCheckpointsSolved !== this.lastAllSolved) {
      this.lastAllSolved = snapshot.allCheckpointsSolved;
      this.root.classList.toggle('is-finish-unlocked', snapshot.allCheckpointsSolved);
    }

    const timerText = `⏱ ${formatRaceTimeMs(snapshot.elapsedMs)}`;
    if (timerText !== this.lastTimerText) {
      this.lastTimerText = timerText;
      this.timerEl.textContent = timerText;
    }

    const boostPct = snapshot.boostActive && snapshot.boostMax > 0
      ? Math.max(0, Math.min(100, Math.round((snapshot.boostRemaining / snapshot.boostMax) * 100)))
      : 0;
    if (boostPct !== this.lastBoostPct) {
      this.lastBoostPct = boostPct;
      this.boostFillEl.style.width = `${boostPct}%`;
      this.boostTrackEl.setAttribute('aria-valuenow', String(boostPct));
    }
    if (snapshot.boostActive !== this.lastBoostActive) {
      this.lastBoostActive = snapshot.boostActive;
      this.root.classList.toggle('is-boost-active', snapshot.boostActive);
    }
    const boostLabel = snapshot.boostActive
      ? `⚡ Nitro ${snapshot.boostRemaining.toFixed(1)}s`
      : '⚡ Chờ trạm';
    if (boostLabel !== this.lastBoostLabel) {
      this.lastBoostLabel = boostLabel;
      this.boostLabelEl.textContent = boostLabel;
    }

    const showOfftrack = snapshot.isOffTrack && snapshot.phase === 'RACING';
    if (showOfftrack !== this.lastOfftrack) {
      this.lastOfftrack = showOfftrack;
      this.offtrackEl.hidden = !showOfftrack;
    }

    const showGateAlert =
      snapshot.phase === 'RACING' && (snapshot.finishBlocked || snapshot.skippedCheckpointAhead);
    if (showGateAlert !== this.lastGateAlertVisible) {
      this.lastGateAlertVisible = showGateAlert;
      this.gateAlertEl.hidden = !showGateAlert;
    }
    if (showGateAlert) {
      const nextNum = snapshot.nextUnsolvedIndex !== null ? snapshot.nextUnsolvedIndex + 1 : 1;
      const alertText = snapshot.finishBlocked
        ? `🔒 Vạch đích đang khóa! Còn ${snapshot.missingCheckpointsCount} trạm chưa giải (Trạm #${nextNum}).`
        : `⚠️ Bạn đã đi qua Trạm #${nextNum}! Hãy quay lại giải câu hỏi để mở khóa vạch đích.`;
      if (alertText !== this.lastGateAlertText) {
        this.lastGateAlertText = alertText;
        this.gateAlertTextEl.textContent = alertText;
      }
    }

    const countdownHidden = snapshot.phase !== 'COUNTDOWN' || snapshot.countdownNumber <= 0;
    if (countdownHidden !== this.lastCountdownHidden) {
      this.lastCountdownHidden = countdownHidden;
      this.countdownEl.hidden = countdownHidden;
    }
    if (!countdownHidden) {
      const cText = String(snapshot.countdownNumber);
      if (cText !== this.lastCountdownText) {
        this.lastCountdownText = cText;
        this.countdownValueEl.textContent = cText;
      }
    }

    // Compass & next target
    const deg = snapshot.compass.arrowDeg;
    if (Number.isNaN(this.lastArrowDeg) || Math.abs(deg - this.lastArrowDeg) >= COMPASS_ROTATE_EPSILON_DEG) {
      this.lastArrowDeg = deg;
      this.compassArrow.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    }

    const targetLabel = `${snapshot.nextTarget.emoji} ${snapshot.nextTarget.label}`;
    if (targetLabel !== this.lastTargetLabel) {
      this.lastTargetLabel = targetLabel;
      this.targetNameEl.textContent = targetLabel;
    }

    if (snapshot.compass.directionText !== this.lastCueText) {
      this.lastCueText = snapshot.compass.directionText;
      this.directionCueEl.textContent = snapshot.compass.directionText;
    }

    const distText = `${Math.max(0, Math.round(snapshot.compass.distanceMeters))}m`;
    if (distText !== this.lastDistText) {
      this.lastDistText = distText;
      this.targetDistEl.textContent = distText;
    }

    const progText = `${snapshot.progressPercent}%`;
    if (progText !== this.lastProgressBadge) {
      this.lastProgressBadge = progText;
      this.progressBadgeEl.textContent = progText;
    }

    this.renderLeaderboard(snapshot.leaderboard);
  }

  private renderLeaderboard(entries: ReadonlyArray<FarmRaceLeaderboardEntry>): void {
    const activeIds = new Set(entries.map((e) => e.id));
    for (const [id, el] of this.rowElements.entries()) {
      if (!activeIds.has(id)) {
        el.remove();
        this.rowElements.delete(id);
      }
    }

    const orderedNodes: HTMLElement[] = [];
    for (const item of entries) {
      let row = this.rowElements.get(item.id);
      if (!row) {
        row = document.createElement('div');
        row.className = 'farm-race-lb-row';
        row.setAttribute('role', 'listitem');

        const rankSpan = document.createElement('span');
        rankSpan.className = 'farm-race-lb-rank';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'farm-race-lb-name';

        const progSpan = document.createElement('span');
        progSpan.className = 'farm-race-lb-prog';

        row.append(rankSpan, nameSpan, progSpan);
        this.rowElements.set(item.id, row);
      }

      row.classList.toggle('is-player', item.isPlayer);

      const rankEl = row.querySelector<HTMLElement>('.farm-race-lb-rank');
      const nameEl = row.querySelector<HTMLElement>('.farm-race-lb-name');
      const progEl = row.querySelector<HTMLElement>('.farm-race-lb-prog');

      const rankStr = `#${item.rank}`;
      if (rankEl && rankEl.textContent !== rankStr) rankEl.textContent = rankStr;

      const nameStr = `${item.emoji} ${item.name}`;
      if (nameEl && nameEl.textContent !== nameStr) nameEl.textContent = nameStr;

      const progStr = item.finished ? '🏁 Xong' : `${item.progressPercent}%`;
      if (progEl && progEl.textContent !== progStr) progEl.textContent = progStr;

      orderedNodes.push(row);
    }

    const currentChildren = Array.from(this.leaderboardEl.children);
    const sameOrder =
      currentChildren.length === orderedNodes.length &&
      orderedNodes.every((n, i) => currentChildren[i] === n);
    if (!sameOrder) {
      this.leaderboardEl.replaceChildren(...orderedNodes);
    }
  }

  public hide(): void {
    if (!this.root.hidden) {
      this.root.hidden = true;
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('in-farm-race');
    }
    this.lastOfftrack = null;
    this.lastGateAlertVisible = null;
    this.lastCountdownHidden = null;
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResizeBound);
    }
  }
}
