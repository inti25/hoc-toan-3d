import {
  buildFarmTrackerSnapshot,
  computeCompassGuidance,
  type CompassGuidance,
  type FarmAnimalTrackerSource,
  type FarmTrackedAnimalView,
  type FarmTrackerSnapshot
} from '../world/farm/FarmGuidance';

export interface FarmTrackerHudOptions {
  onFocusChange?: (animalId: string | null) => void;
}

export interface FarmTrackerSyncParams {
  animals: ReadonlyArray<FarmAnimalTrackerSource>;
  playerLocalPos: { x: number; z: number };
  cameraYaw: number;
  returnPortalLocalPos?: { x: number; z: number };
  forceResort?: boolean;
  nowMs?: number;
}

const COMPASS_ROTATE_EPSILON_DEG = 0.6;
const RESORT_INTERVAL_MS = 1000;

export class FarmTrackerHud {
  private readonly root: HTMLElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly compassArrow: SVGElement;
  private readonly targetNameEl: HTMLElement;
  private readonly targetPinEl: HTMLElement;
  private readonly directionCueEl: HTMLElement;
  private readonly targetDistEl: HTMLElement;
  private readonly remainingBadgeEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly countEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly celebrateEl: HTMLElement;
  private readonly portalBtn: HTMLButtonElement;
  private readonly onFocusChange?: (animalId: string | null) => void;

  private collapsed = false;
  private userCollapsedPreference: boolean | null = null;
  private pinnedAnimalId: string | null = null;
  private guideToPortal = false;
  private orderedIds: string[] = [];
  private lastSortAtMs = 0;
  private forceResortPending = true;
  private lastFocusedAnimalId: string | null = null;
  private lastAllRescued = false;

  private lastTargetLocalPos: { x: number; z: number } | null = null;
  private lastArrowDeg = Number.NaN;
  private lastCueText = '';
  private lastDistText = '';
  private lastIsNear: boolean | null = null;

  private lastTargetName = '';
  private lastPinVisible: boolean | null = null;
  private lastRemainingBadge = '';
  private lastCountText = '';
  private lastHintText = '';
  private lastPortalBtnText = '';
  private lastPortalBtnActive: boolean | null = null;

  private lastSyncParams: FarmTrackerSyncParams | null = null;
  private readonly rowElements = new Map<string, HTMLButtonElement>();
  private readonly handleResizeBound = () => this.handleViewportResize();

  constructor(root: HTMLElement, options: FarmTrackerHudOptions = {}) {
    this.root = root;
    this.onFocusChange = options.onFocusChange;

    this.toggleBtn = this.requireEl<HTMLButtonElement>('#farm-tracker-toggle');
    this.compassArrow = this.requireEl<SVGElement>('#farm-compass-arrow');
    this.targetNameEl = this.requireEl<HTMLElement>('#farm-target-name');
    this.targetPinEl = this.requireEl<HTMLElement>('#farm-target-pin');
    this.directionCueEl = this.requireEl<HTMLElement>('#farm-direction-cue');
    this.targetDistEl = this.requireEl<HTMLElement>('#farm-target-dist');
    this.remainingBadgeEl = this.requireEl<HTMLElement>('#farm-remaining-badge');
    this.bodyEl = this.requireEl<HTMLElement>('#farm-tracker-body');
    this.countEl = this.requireEl<HTMLElement>('#farm-tracker-count');
    this.hintEl = this.requireEl<HTMLElement>('#farm-tracker-hint');
    this.listEl = this.requireEl<HTMLElement>('#farm-tracker-list');
    this.celebrateEl = this.requireEl<HTMLElement>('#farm-tracker-celebrate');
    this.portalBtn = this.requireEl<HTMLButtonElement>('#farm-portal-guide-btn');

    this.setCollapsed(this.isCompactViewport(), false);

    this.toggleBtn.addEventListener('click', () => {
      const next = !this.collapsed;
      this.userCollapsedPreference = next;
      this.setCollapsed(next, false);
    });

    this.listEl.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const row = target?.closest<HTMLButtonElement>('.farm-tracker-row');
      const animalId = row?.dataset.animalId;
      if (!animalId) return;

      if (this.guideToPortal) {
        this.guideToPortal = false;
        this.pinnedAnimalId = animalId;
      } else {
        this.pinnedAnimalId = this.pinnedAnimalId === animalId ? null : animalId;
      }

      if (this.shouldAutoCollapseOnSelect()) {
        this.userCollapsedPreference = true;
        this.setCollapsed(true, false);
      }

      this.resyncImmediately();
    });

    this.portalBtn.addEventListener('click', () => {
      if (this.lastAllRescued) {
        this.guideToPortal = true;
        if (this.shouldAutoCollapseOnSelect()) {
          this.userCollapsedPreference = true;
          this.setCollapsed(true, false);
        }
        this.resyncImmediately();
        return;
      }

      this.guideToPortal = !this.guideToPortal;
      if (this.guideToPortal && this.shouldAutoCollapseOnSelect()) {
        this.userCollapsedPreference = true;
        this.setCollapsed(true, false);
      }
      this.resyncImmediately();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResizeBound);
    }
  }

  private requireEl<T extends Element>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`FarmTrackerHud missing required element: ${selector}`);
    }
    return el;
  }

  private isCompactViewport(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 || window.innerHeight <= 620;
  }

  private shouldAutoCollapseOnSelect(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 700 || window.innerHeight <= 620;
  }

  private handleViewportResize(): void {
    if (this.userCollapsedPreference !== null) return;
    this.setCollapsed(this.isCompactViewport(), false);
  }

  private setCollapsed(collapsed: boolean, fromAuto: boolean): void {
    void fromAuto;
    this.collapsed = collapsed;
    this.root.classList.toggle('collapsed', collapsed);
    this.bodyEl.hidden = collapsed;
    this.toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  }

  private resyncImmediately(): void {
    if (!this.lastSyncParams) return;
    this.sync({
      ...this.lastSyncParams,
      nowMs: typeof performance !== 'undefined' ? performance.now() : Date.now()
    });
  }

  /**
   * Cập nhật góc quay kim la bàn mượt ở tốc độ khung hình mà không gây churn DOM.
   */
  public updateCompass(playerLocalPos: { x: number; z: number }, cameraYaw: number): void {
    if (this.root.hidden || !this.lastTargetLocalPos) return;
    const compass = computeCompassGuidance(playerLocalPos, cameraYaw, this.lastTargetLocalPos);
    this.applyCompass(compass);
  }

  public sync(params: FarmTrackerSyncParams): void {
    this.lastSyncParams = params;
    const now = params.nowMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const allowResort =
      Boolean(params.forceResort) ||
      this.forceResortPending ||
      now - this.lastSortAtMs >= RESORT_INTERVAL_MS;

    const snapshot = buildFarmTrackerSnapshot({
      animals: params.animals,
      playerLocalPos: params.playerLocalPos,
      cameraYaw: params.cameraYaw,
      pinnedAnimalId: this.pinnedAnimalId,
      guideToPortal: this.guideToPortal,
      previousOrderIds: this.orderedIds,
      allowResort,
      returnPortalLocalPos: params.returnPortalLocalPos
    });

    this.pinnedAnimalId = snapshot.effectivePinnedId;
    this.guideToPortal = snapshot.guideToPortalActive && !snapshot.allRescued ? this.guideToPortal : false;
    this.lastAllRescued = snapshot.allRescued;
    this.orderedIds = snapshot.orderedIds;
    if (snapshot.didResort || allowResort) {
      this.lastSortAtMs = now;
      this.forceResortPending = false;
    }

    if (this.root.hidden) {
      this.root.hidden = false;
    }
    if (typeof document !== 'undefined') {
      document.body.classList.add('in-farm-sanctuary');
    }

    this.renderSnapshot(snapshot);

    if (snapshot.focusedAnimalId !== this.lastFocusedAnimalId) {
      this.lastFocusedAnimalId = snapshot.focusedAnimalId;
      this.onFocusChange?.(snapshot.focusedAnimalId);
    }
  }

  public hide(): void {
    if (!this.root.hidden) {
      this.root.hidden = true;
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('in-farm-sanctuary');
    }
    this.guideToPortal = false;
    this.lastTargetLocalPos = null;
    if (this.lastFocusedAnimalId !== null) {
      this.lastFocusedAnimalId = null;
      this.onFocusChange?.(null);
    }
  }

  public invalidateSort(): void {
    this.forceResortPending = true;
    this.lastSortAtMs = 0;
  }

  public resetState(): void {
    this.pinnedAnimalId = null;
    this.guideToPortal = false;
    this.orderedIds = [];
    this.lastSortAtMs = 0;
    this.forceResortPending = true;
    this.lastSyncParams = null;
    this.lastTargetLocalPos = null;
    this.lastArrowDeg = Number.NaN;
    this.hide();
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResizeBound);
    }
  }

  private renderSnapshot(snapshot: FarmTrackerSnapshot): void {
    this.lastTargetLocalPos = snapshot.target.localPos;
    this.applyCompass(snapshot.compass);

    const targetLabel = `${snapshot.target.emoji} ${snapshot.target.label}`;
    if (targetLabel !== this.lastTargetName) {
      this.lastTargetName = targetLabel;
      this.targetNameEl.textContent = targetLabel;
    }

    const showPin = snapshot.target.kind === 'animal' && snapshot.target.isPinned;
    if (showPin !== this.lastPinVisible) {
      this.lastPinVisible = showPin;
      this.targetPinEl.hidden = !showPin;
    }

    const badgeText = snapshot.allRescued
      ? 'Xong!'
      : `Còn ${snapshot.remainingCount}/${snapshot.totalCount}`;
    if (badgeText !== this.lastRemainingBadge) {
      this.lastRemainingBadge = badgeText;
      this.remainingBadgeEl.textContent = badgeText;
    }

    const countText = snapshot.allRescued
      ? '🎉 Đã cứu hết thú!'
      : `🐾 Còn ${snapshot.remainingCount} / ${snapshot.totalCount} thú`;
    if (countText !== this.lastCountText) {
      this.lastCountText = countText;
      this.countEl.textContent = countText;
    }

    const hintText = snapshot.allRescued
      ? 'Hướng về Cổng Làng'
      : snapshot.guideToPortalActive
        ? 'Đang chỉ về Cổng Làng'
        : snapshot.effectivePinnedId
          ? 'Chạm lại để bỏ ghim'
          : 'Chạm dòng để ghim';
    if (hintText !== this.lastHintText) {
      this.lastHintText = hintText;
      this.hintEl.textContent = hintText;
    }

    this.root.classList.toggle('is-portal-guide', snapshot.guideToPortalActive);
    this.root.classList.toggle('is-all-rescued', snapshot.allRescued);

    const portalBtnActive = snapshot.guideToPortalActive;
    const portalBtnText = snapshot.allRescued
      ? '🏡 Đang chỉ đường về Cổng Làng'
      : portalBtnActive
        ? '🐾 Quay lại tìm thú cưng'
        : '🏡 Chỉ đường về Cổng Làng';
    if (portalBtnText !== this.lastPortalBtnText) {
      this.lastPortalBtnText = portalBtnText;
      this.portalBtn.textContent = portalBtnText;
    }
    if (portalBtnActive !== this.lastPortalBtnActive) {
      this.lastPortalBtnActive = portalBtnActive;
      this.portalBtn.classList.toggle('active', portalBtnActive);
      this.portalBtn.setAttribute('aria-pressed', String(portalBtnActive));
    }

    if (snapshot.allRescued) {
      this.listEl.hidden = true;
      this.celebrateEl.hidden = false;
      this.clearUnusedRows(new Set());
      return;
    }

    this.listEl.hidden = false;
    this.celebrateEl.hidden = true;
    this.renderAnimalList(snapshot.remainingAnimals);
  }

  private applyCompass(compass: CompassGuidance): void {
    const roundedDeg = compass.arrowDeg;
    if (
      Number.isNaN(this.lastArrowDeg) ||
      Math.abs(roundedDeg - this.lastArrowDeg) >= COMPASS_ROTATE_EPSILON_DEG
    ) {
      this.lastArrowDeg = roundedDeg;
      this.compassArrow.style.transform = `rotate(${roundedDeg.toFixed(1)}deg)`;
    }

    if (compass.directionText !== this.lastCueText) {
      this.lastCueText = compass.directionText;
      this.directionCueEl.textContent = compass.directionText;
    }

    const distText = `${Math.max(0, Math.round(compass.distanceMeters))}m`;
    if (distText !== this.lastDistText) {
      this.lastDistText = distText;
      this.targetDistEl.textContent = distText;
    }

    if (compass.isNear !== this.lastIsNear) {
      this.lastIsNear = compass.isNear;
      this.root.classList.toggle('is-near', compass.isNear);
    }
  }

  private createRowElement(id: string): HTMLButtonElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'farm-tracker-row';
    row.setAttribute('role', 'listitem');
    row.dataset.animalId = id;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'farm-row-emoji';
    iconWrap.setAttribute('aria-hidden', 'true');

    const info = document.createElement('span');
    info.className = 'farm-row-info';

    const title = document.createElement('strong');
    title.className = 'farm-row-title';

    const sub = document.createElement('small');
    sub.className = 'farm-row-sub';

    info.append(title, sub);

    const right = document.createElement('span');
    right.className = 'farm-row-right';

    const dist = document.createElement('span');
    dist.className = 'farm-row-dist';

    const status = document.createElement('span');
    status.className = 'farm-row-status';

    right.append(dist, status);
    row.append(iconWrap, info, right);
    return row;
  }

  private updateRowElement(row: HTMLButtonElement, item: FarmTrackedAnimalView): void {
    row.classList.toggle('active', item.isActiveTarget);
    row.classList.toggle('pinned', item.isPinned);
    row.setAttribute('aria-pressed', String(item.isPinned));

    const emojiEl = row.querySelector<HTMLElement>('.farm-row-emoji');
    const titleEl = row.querySelector<HTMLElement>('.farm-row-title');
    const subEl = row.querySelector<HTMLElement>('.farm-row-sub');
    const distEl = row.querySelector<HTMLElement>('.farm-row-dist');
    const statusEl = row.querySelector<HTMLElement>('.farm-row-status');

    if (emojiEl && emojiEl.textContent !== item.emoji) {
      emojiEl.textContent = item.emoji;
    }

    const titleText = item.shortTitle ? `${item.displayName} · ${item.shortTitle}` : item.displayName;
    if (titleEl && titleEl.textContent !== titleText) {
      titleEl.textContent = titleText;
    }

    if (subEl && subEl.textContent !== item.areaHint) {
      subEl.textContent = item.areaHint;
    }

    const distText = `${Math.max(0, Math.round(item.distanceMeters))}m`;
    if (distEl && distEl.textContent !== distText) {
      distEl.textContent = distText;
    }

    const statusText = item.isPinned ? '📌 Đã ghim' : item.isActiveTarget ? '🎯 Gần nhất' : '';
    if (statusEl && statusEl.textContent !== statusText) {
      statusEl.textContent = statusText;
    }
  }

  private clearUnusedRows(keepIds: ReadonlySet<string>): void {
    for (const [id, el] of this.rowElements.entries()) {
      if (!keepIds.has(id)) {
        el.remove();
        this.rowElements.delete(id);
      }
    }
  }

  private renderAnimalList(items: ReadonlyArray<FarmTrackedAnimalView>): void {
    const activeIds = new Set(items.map((item) => item.id));
    this.clearUnusedRows(activeIds);

    const orderedNodes: HTMLButtonElement[] = [];
    for (const item of items) {
      let row = this.rowElements.get(item.id);
      if (!row) {
        row = this.createRowElement(item.id);
        this.rowElements.set(item.id, row);
      }
      this.updateRowElement(row, item);
      orderedNodes.push(row);
    }

    const currentChildren = Array.from(this.listEl.children);
    const matchesOrder =
      currentChildren.length === orderedNodes.length &&
      orderedNodes.every((node, i) => currentChildren[i] === node);

    if (!matchesOrder) {
      this.listEl.replaceChildren(...orderedNodes);
    }
  }
}
