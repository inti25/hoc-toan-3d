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

export interface ParkTreeAwakenDelta {
  alreadyAwakened: boolean;
  treeIndex: number;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  allTreesCompleted: boolean;
  totalAwakened: number;
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

  savePosition(x: number, z: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    this.state.position = {
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100
    };
    this.save();
  }

  getPosition(): { x: number; z: number } | undefined {
    return this.state.position;
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

  wakeParkTree(index: number, treeId?: number | string): ParkTreeAwakenDelta {
    if (!this.state.parkTrees) {
      this.state.parkTrees = Array(20).fill(false);
    }
    const tIdKey = treeId !== undefined ? String(treeId) : `park_tree_${index + 1}`;
    const alreadyAwakened = (index >= 0 && index < this.state.parkTrees.length && this.state.parkTrees[index]) ||
      this.state.solvedProblems[tIdKey] === true ||
      this.state.solvedProblems[`tree_${index + 1}`] === true;

    if (alreadyAwakened) {
      return {
        alreadyAwakened: true,
        treeIndex: index,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        allTreesCompleted: this.state.parkTrees.every(Boolean),
        totalAwakened: this.state.parkTrees.filter(Boolean).length
      };
    }

    const oldLevel = getLevel(this.state.xp);
    if (index >= 0 && index < this.state.parkTrees.length) {
      this.state.parkTrees[index] = true;
    }
    this.state.solvedProblems[tIdKey] = true;
    this.state.solvedProblems[`park_tree_${index + 1}`] = true;
    this.state.solvedProblems[`tree_${index + 1}`] = true;
    let xpGained = 20;
    let coinsGained = 5;

    const allTreesCompleted = this.state.parkTrees.every(Boolean);
    if (allTreesCompleted) {
      xpGained += 150;
      coinsGained += 50;
    }

    this.state.xp += xpGained;
    this.state.coins += coinsGained;
    const newLevel = getLevel(this.state.xp);
    this.save();

    return {
      alreadyAwakened: false,
      treeIndex: index,
      xpGained,
      coinsGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      allTreesCompleted,
      totalAwakened: this.state.parkTrees.filter(Boolean).length
    };
  }

  isParkTreeAwakened(index: number): boolean {
    if (!this.state.parkTrees) return false;
    return !!this.state.parkTrees[index] || !!this.state.solvedProblems[`park_tree_${index + 1}`] || !!this.state.solvedProblems[`tree_${index + 1}`];
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

  activateMonolith(
    index: number,
    problemId?: number | string,
    zoneIdInput?: number,
    zoneProblemIds?: (number | string)[]
  ): MonolithActivationDelta {
    const idKey = problemId !== undefined ? String(problemId) : String(306 + index);
    const monolith = ARCHIMEDES_MONOLITHS[index];
    const zoneId = zoneIdInput || (monolith ? monolith.zoneId : 1);

    const alreadyActivated = (index >= 0 && index < this.state.monoliths.length && this.state.monoliths[index]) ||
      this.state.solvedProblems[idKey] === true;

    if (alreadyActivated) {
      let stateChanged = false;
      if (index >= 0 && index < this.state.monoliths.length && !this.state.monoliths[index]) {
        this.state.monoliths[index] = true;
        stateChanged = true;
      }
      const numId = Number(problemId);
      if (!isNaN(numId) && numId >= 306) {
        const mIdx = numId - 306;
        if (mIdx >= 0) {
          while (this.state.monoliths.length <= mIdx) {
            this.state.monoliths.push(false);
          }
          if (!this.state.monoliths[mIdx]) {
            this.state.monoliths[mIdx] = true;
            stateChanged = true;
          }
        }
      }
      if (this.state.solvedProblems[idKey] !== true) {
        this.state.solvedProblems[idKey] = true;
        stateChanged = true;
      }
      if (stateChanged) {
        this.save();
      }
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
    const numId = Number(problemId);
    if (!isNaN(numId) && numId >= 306) {
      const mIdx = numId - 306;
      if (mIdx >= 0) {
        while (this.state.monoliths.length <= mIdx) {
          this.state.monoliths.push(false);
        }
        this.state.monoliths[mIdx] = true;
      }
    }
    this.state.solvedProblems[idKey] = true;
    let xpGained = 20;
    let coinsGained = 10;

    const zoneMonoliths = getMonolithsByZone(zoneId);
    const hasStaticZoneMonoliths = zoneMonoliths.length > 0;
    const hasDynamicZoneProblems = Array.isArray(zoneProblemIds) && zoneProblemIds.length > 0;

    let zoneCompletedNow = false;
    if (hasDynamicZoneProblems) {
      zoneCompletedNow = zoneProblemIds.every(
        (id) => this.isProblemSolved(id) || (typeof id === 'number' && id >= 306 && this.state.monoliths[id - 306])
      );
    } else if (hasStaticZoneMonoliths) {
      zoneCompletedNow = zoneMonoliths.every(
        (m) => this.isProblemSolved(m.id) || this.state.monoliths[m.id - 306]
      );
    }

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

  reconcileZoneProgress(
    zones: { id: number; sheetName?: string }[],
    questionsBySheet: Record<string, { id: number | string }[]>
  ): boolean {
    let changed = false;
    for (const [sheet, questions] of Object.entries(questionsBySheet || {})) {
      if (Array.isArray(questions)) {
        questions.forEach((q, idx) => {
          if (this.isProblemSolved(q.id)) {
            if (idx >= 0 && idx < this.state.monoliths.length && !this.state.monoliths[idx]) {
              this.state.monoliths[idx] = true;
              changed = true;
            }
            const num = Number(q.id);
            if (!isNaN(num) && num >= 306) {
              const mIdx = num - 306;
              while (this.state.monoliths.length <= mIdx) {
                this.state.monoliths.push(false);
              }
              if (!this.state.monoliths[mIdx]) {
                this.state.monoliths[mIdx] = true;
                changed = true;
              }
            }
          }
        });
      }
    }

    for (const z of zones) {
      if (z.id >= 1 && z.id <= 5 && !this.state.zoneBadges[z.id - 1]) {
        const sheet = z.sheetName || `Zone_${z.id}_Archimedes`;
        const qList = questionsBySheet[sheet];
        if (Array.isArray(qList) && qList.length > 0) {
          const allSolved = qList.every((q) => this.isProblemSolved(q.id));
          if (allSolved) {
            this.state.zoneBadges[z.id - 1] = true;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this.save();
    }
    return changed;
  }

  getArchimedesSolvedCount(monolithProblems: { id: number | string }[] = []): number {
    return getArchimedesSolvedCount(this.state, monolithProblems);
  }

  restoreState(newState: SaveState): void {
    this.state = newState;
    this.save();
  }

  resetProgress(): void {
    this.state = freshState();
    this.save();
  }
}

export function getArchimedesSolvedCount(
  state: SaveState,
  monolithProblems: { id: number | string }[] = []
): number {
  if (monolithProblems && monolithProblems.length > 0) {
    return monolithProblems.filter(
      (p) =>
        state.solvedProblems[String(p.id)] === true ||
        (typeof p.id === 'number' && p.id >= 306 && state.monoliths[p.id - 306] === true)
    ).length;
  }
  const solvedArchIds = new Set<string>();
  for (const [key, val] of Object.entries(state.solvedProblems || {})) {
    if (val === true && !isNaN(Number(key)) && Number(key) >= 306) {
      solvedArchIds.add(key);
    }
  }
  return Math.max(state.monoliths.filter(Boolean).length, solvedArchIds.size);
}

