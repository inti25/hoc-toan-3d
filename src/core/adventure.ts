import { BRIDGE_PARTS, LEVEL_XP, SAVE_KEY, getLevel, type Table } from '../data/config';
import type { AvatarId } from '../data/characters';
import { ARCHIMEDES_MONOLITHS, getMonolithsByZone } from '../data/archimedesTrialMap';
import { freshState, parseSave, type SaveState } from './state';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultStorage: StorageAdapter = {
  getItem: (key: string) => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
      /* ignore storage failure */
    }
  }
};

export interface QuizProgressDelta {
  isCorrect: boolean;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  combo: number;
  bridge: number;
  bridgeCompleted: boolean;
}

export interface FlowerBloomDelta {
  alreadyBloomed: boolean;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  allFlowersCompleted: boolean;
  totalBloomed: number;
}

export interface CrossingDelta {
  completed: boolean;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
}

export interface MonolithActivationDelta {
  alreadyActivated: boolean;
  monolithIndex: number;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  zoneCompleted: boolean;
  zoneId: number;
  allMonolithsCompleted: boolean;
  totalActivated: number;
}

export class Adventure {
  private state: SaveState;
  private storage: StorageAdapter;

  constructor(initialState?: SaveState, storage: StorageAdapter = defaultStorage) {
    this.storage = storage;
    if (initialState) {
      this.state = initialState;
    } else {
      this.state = parseSave(this.storage.getItem(SAVE_KEY));
    }
  }

  getState(): Readonly<SaveState> {
    return this.state;
  }

  save(): boolean {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return true;
    } catch {
      return false;
    }
  }

  setAvatar(avatar: AvatarId) {
    this.state.avatar = avatar;
    this.save();
  }

  setTable(table: Table | 0) {
    this.state.table = table;
    this.save();
  }

  setAudio(sound: boolean, music: boolean) {
    this.state.sound = sound;
    this.state.music = music;
    this.save();
  }

  setStarted(started = true) {
    this.state.started = started;
    this.save();
  }

  acceptQuest() {
    this.state.questAccepted = true;
    this.save();
  }

  recordQuizResult(options: {
    isCorrect: boolean;
    questionId?: string;
    isBridgeMode?: boolean;
    firstTry?: boolean;
    responseTimeMs?: number;
  }): QuizProgressDelta {
    const { isCorrect, questionId, isBridgeMode = false, firstTry = true, responseTimeMs = 0 } = options;
    const oldLevel = getLevel(this.state.xp);
    let xpGained = 0;
    let coinsGained = 0;
    let bridgeCompleted = false;

    if (questionId) {
      const stat = this.state.questionStats[questionId] ?? {
        attempts: 0,
        correct: 0,
        wrong: 0,
        lastAnsweredAt: '',
        responseTime: 0
      };
      stat.attempts++;
      if (isCorrect) {
        stat.correct++;
      } else {
        stat.wrong++;
      }
      stat.lastAnsweredAt = new Date().toISOString();
      stat.responseTime = Math.round(responseTimeMs);
      this.state.questionStats[questionId] = stat;
    }

    if (isCorrect) {
      this.state.combo++;
      xpGained = 10;
      coinsGained = 5;
      this.state.xp += xpGained;
      this.state.coins += coinsGained;

      if (firstTry && questionId) {
        this.state.review = this.state.review.filter(id => id !== questionId);
      }

      if (isBridgeMode) {
        const nextBridge = Math.min(BRIDGE_PARTS, this.state.bridge + 1);
        if (nextBridge === BRIDGE_PARTS && this.state.bridge < BRIDGE_PARTS) {
          bridgeCompleted = true;
        }
        this.state.bridge = nextBridge;
      }
    } else {
      this.state.combo = 0;
      if (questionId && !this.state.review.includes(questionId)) {
        this.state.review.push(questionId);
      }
    }

    const newLevel = getLevel(this.state.xp);
    const leveledUp = newLevel > oldLevel;

    this.save();

    return {
      isCorrect,
      xpGained,
      coinsGained,
      leveledUp,
      newLevel,
      combo: this.state.combo,
      bridge: this.state.bridge,
      bridgeCompleted
    };
  }

  bloomFlower(index: number, flowerId?: number | string): FlowerBloomDelta {
    const fIdKey = flowerId !== undefined ? String(flowerId) : String(index + 1);
    const alreadyBloomed = (index >= 0 && index < this.state.flowers.length && this.state.flowers[index]) ||
      this.state.solvedProblems[fIdKey] === true ||
      this.state.solvedProblems[`flower_${fIdKey}`] === true;

    if (alreadyBloomed) {
      return {
        alreadyBloomed: true,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        allFlowersCompleted: this.state.flowers.every(Boolean),
        totalBloomed: this.state.flowers.filter(Boolean).length
      };
    }

    const oldLevel = getLevel(this.state.xp);
    if (index >= 0 && index < this.state.flowers.length) {
      this.state.flowers[index] = true;
    }
    this.state.solvedProblems[fIdKey] = true;
    this.state.solvedProblems[`flower_${fIdKey}`] = true;
    let xpGained = 15;
    let coinsGained = 5;

    const allFlowersCompleted = this.state.flowers.every(Boolean);
    if (allFlowersCompleted) {
      xpGained += 100;
      coinsGained += 30;
    }

    this.state.xp += xpGained;
    this.state.coins += coinsGained;
    const newLevel = getLevel(this.state.xp);

    this.save();

    return {
      alreadyBloomed: false,
      xpGained,
      coinsGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      allFlowersCompleted,
      totalBloomed: this.state.flowers.filter(Boolean).length
    };
  }

  completeRiverCrossing(): CrossingDelta {
    const oldLevel = getLevel(this.state.xp);

    if (this.state.bridge === BRIDGE_PARTS && !this.state.questComplete) {
      this.state.questComplete = true;
      const xpGained = 50;
      const coinsGained = 10;
      this.state.xp += xpGained;
      this.state.coins += coinsGained;
      const newLevel = getLevel(this.state.xp);
      this.save();

      return {
        completed: true,
        xpGained,
        coinsGained,
        leveledUp: newLevel > oldLevel,
        newLevel
      };
    }

    return {
      completed: false,
      xpGained: 0,
      coinsGained: 0,
      leveledUp: false,
      newLevel: oldLevel
    };
  }

  isProblemSolved(problemId: number | string): boolean {
    const key = String(problemId);
    return this.state.solvedProblems[key] === true || this.state.solvedProblems[`flower_${key}`] === true;
  }

  activateMonolith(index: number, problemId?: number | string, zoneIdInput?: number): MonolithActivationDelta {
    const idKey = problemId !== undefined ? String(problemId) : String(306 + index);
    const monolith = ARCHIMEDES_MONOLITHS[index];
    const zoneId = zoneIdInput || (monolith ? monolith.zoneId : 1);

    const alreadyActivated = (index >= 0 && index < this.state.monoliths.length && this.state.monoliths[index]) ||
      this.state.solvedProblems[idKey] === true;

    if (alreadyActivated) {
      return {
        alreadyActivated: true,
        monolithIndex: index,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        zoneCompleted: false,
        zoneId,
        allMonolithsCompleted: this.state.monoliths.every(Boolean),
        totalActivated: this.state.monoliths.filter(Boolean).length
      };
    }

    const oldLevel = getLevel(this.state.xp);
    if (index >= 0 && index < this.state.monoliths.length) {
      this.state.monoliths[index] = true;
    }
    this.state.solvedProblems[idKey] = true;
    let xpGained = 20;
    let coinsGained = 10;

    const zoneMonoliths = getMonolithsByZone(zoneId);
    const zoneCompletedNow = zoneMonoliths.length > 0 && zoneMonoliths.every(m => this.state.solvedProblems[String(m.id)] || this.state.monoliths[m.id - 306]);
    let zoneCompleted = false;

    if (zoneCompletedNow && zoneId >= 1 && zoneId <= 5 && !this.state.zoneBadges[zoneId - 1]) {
      this.state.zoneBadges[zoneId - 1] = true;
      zoneCompleted = true;
      xpGained += 50;
      coinsGained += 25;
    }

    const allMonolithsCompleted = this.state.monoliths.every(Boolean);
    if (allMonolithsCompleted) {
      xpGained += 200;
      coinsGained += 100;
    }

    this.state.xp += xpGained;
    this.state.coins += coinsGained;
    const newLevel = getLevel(this.state.xp);

    this.save();

    return {
      alreadyActivated: false,
      monolithIndex: index,
      xpGained,
      coinsGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      zoneCompleted,
      zoneId,
      allMonolithsCompleted,
      totalActivated: this.state.monoliths.filter(Boolean).length
    };
  }

  resetProgress(): void {
    this.state = freshState();
    this.save();
  }
}
