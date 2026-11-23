export interface ModalEntry {
  kind: string;
  previousFocus: HTMLElement | null;
}

/**
 * Manages modal overlay focus trapping and background interactivity
 * following game-ui-ux screen-stack rules.
 */
export class ScreenStack {
  private stack: ModalEntry[] = [];

  constructor(
    private readonly dialogEl: HTMLDialogElement,
    private readonly backgroundRoots: HTMLElement[]
  ) {}

  get topKind(): string {
    return this.stack[this.stack.length - 1]?.kind ?? '';
  }

  get isOpen(): boolean {
    return this.dialogEl.open;
  }

  push(kind: string): void {
    const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    const prev = active && !this.dialogEl.contains(active) ? active : null;
    this.stack.push({ kind, previousFocus: prev });
    this.setBackgroundInteractive(false);
    if (!this.dialogEl.open) {
      this.dialogEl.showModal();
    }
    this.focusPrimaryControl();
  }

  onClosed(): void {
    const popped = this.stack.pop();
    this.stack = [];
    this.setBackgroundInteractive(true);
    const restore = popped?.previousFocus;
    if (restore && typeof restore.focus === 'function' && restore.isConnected) {
      try {
        restore.focus();
      } catch {
        /* ignore focus errors on detached elements */
      }
    }
  }

  focusPrimaryControl(): void {
    const candidate = this.dialogEl.querySelector<HTMLElement>(
      '.answer:not(:disabled), .numpad-btn:not(:disabled), .comp-btn:not(:disabled), button.primary:not([hidden]):not(:disabled), input:not(:disabled), #close-dialog'
    );
    if (candidate && typeof candidate.focus === 'function') {
      try {
        candidate.focus();
      } catch {
        /* ignore */
      }
    }
  }

  private setBackgroundInteractive(enabled: boolean): void {
    for (const el of this.backgroundRoots) {
      if (!el) continue;
      if ('inert' in el) {
        (el as HTMLElement & { inert: boolean }).inert = !enabled;
      }
      if (enabled) {
        el.removeAttribute('aria-hidden');
      } else {
        el.setAttribute('aria-hidden', 'true');
      }
    }
  }
}
