export type AudioCue = 'correct' | 'hint' | 'jump' | 'celebrate';

export class AudioManager {
  private context?: AudioContext;
  private timer?: number;
  private note = 0;
  enabled = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockOnce = () => {
        this.unlock();
        window.removeEventListener('pointerdown', unlockOnce);
        window.removeEventListener('keydown', unlockOnce);
        window.removeEventListener('touchstart', unlockOnce);
      };
      window.addEventListener('pointerdown', unlockOnce, { passive: true, once: true });
      window.addEventListener('keydown', unlockOnce, { passive: true, once: true });
      window.addEventListener('touchstart', unlockOnce, { passive: true, once: true });
    }
  }

  unlock() {
    if (typeof AudioContext === 'undefined') return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  tone(frequency: number, duration = .15, delay = 0, volume = .06) {
    if (!this.enabled || typeof AudioContext === 'undefined') return;
    this.unlock();
    if (!this.context) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .02);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  playCue(cue: AudioCue) {
    switch (cue) {
      case 'correct':
        this.correct();
        break;
      case 'hint':
        this.hint();
        break;
      case 'jump':
        this.jump();
        break;
      case 'celebrate':
        this.celebrate();
        break;
    }
  }

  correct() {
    [523.25, 659.25, 783.99].forEach((n, i) => this.tone(n, .3, i * .1));
  }

  hint() {
    this.tone(392, .18);
    this.tone(440, .18, .14);
  }

  jump() {
    this.tone(480, .1);
  }

  celebrate() {
    [523, 659, 784, 1047].forEach((n, i) => this.tone(n, .45, i * .13));
  }

  music(on: boolean) {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (on && typeof window !== 'undefined') {
      this.timer = window.setInterval(() => {
        const notes = [262, 330, 392, 330, 294, 349, 440, 349];
        this.tone(notes[this.note++ % notes.length], .65, 0, .018);
      }, 850);
    }
  }
}
