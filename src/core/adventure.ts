import { BRIDGE_PARTS, SAVE_KEY, getLevel, type Table } from '../data/config';
import type { AvatarId } from '../data/characters';
import { ARCHIMEDES_MONOLITHS, getMonolithsByZone } from '../data/archimedesTrialMap';
import { entityKey, freshState, parseSave, todayDateKey, type SaveState } from './state';
import { getShopItem, type ShopItem } from '../data/shopCatalog';
import { farmRaceProgressKey } from '../data/farmRaceMap';

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
  doubleXpApplied?: boolean;
  dailyDrillCompletedNow?: boolean;
}

export interface FlowerBloomDelta {
  alreadyBloomed: boolean;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  allFlowersCompleted: boolean;
  totalBloomed: number;
  doubleXpApplied?: boolean;
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
  doubleXpApplied?: boolean;
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
  doubleXpApplied?: boolean;
}

export interface EntitySolveDelta {
  alreadySolved: boolean;
  entityKey: string;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  zoneCompleted: boolean;
  doubleXpApplied: boolean;
}

export type AdventureListener = (state: Readonly<SaveState>) => void;

export class Adventure {
  private state: SaveState;
  private storage: StorageAdapter;
  private listeners = new Set<AdventureListener>();

  constructor(initialState?: SaveState, storage: StorageAdapter = defaultStorage) {
    this.storage = storage;
    if (initialState) {
      this.state = initialState;
    } else {
      this.state = parseSave(this.storage.getItem(SAVE_KEY));
    }
  }

  subscribe(listener: AdventureListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        /* ignore subscriber errors */
      }
    }
  }

  getState(): Readonly<SaveState> {
    return this.state;
  }

  save(): boolean {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.state));
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  private applyDoubleXpCharm(baseXp: number): { xp: number; applied: boolean } {
    if (baseXp > 0 && this.state.charms && this.state.charms['charm_double_xp'] > 0) {
      this.state.charms['charm_double_xp']--;
      return { xp: baseXp * 2, applied: true };
    }
    return { xp: baseXp, applied: false };
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

  savePosition(x: number, z: number, y?: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const roundedY = typeof y === 'number' && Number.isFinite(y) ? Math.round(y * 100) / 100 : undefined;
    this.state.position =
      roundedY !== undefined
        ? { x: Math.round(x * 100) / 100, y: roundedY, z: Math.round(z * 100) / 100 }
        : { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
    this.save();
  }

  getPosition(): { x: number; y?: number; z: number } | undefined {
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
    countDailyDrill?: boolean;
  }): QuizProgressDelta {
    const {
      isCorrect,
      questionId,
      isBridgeMode = false,
      firstTry = true,
      responseTimeMs = 0,
      countDailyDrill = false
    } = options;
    const oldLevel = getLevel(this.state.xp);
    let xpGained = 0;
    let coinsGained = 0;
    let bridgeCompleted = false;
    let dailyDrillCompletedNow = false;

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

    let doubleXpApplied = false;
    if (isCorrect) {
      this.state.combo++;
      const doubled = this.applyDoubleXpCharm(10);
      doubleXpApplied = doubled.applied;
      xpGained = doubled.xp;
      coinsGained = 5;

      if (countDailyDrill) {
        const today = todayDateKey();
        if (!this.state.dailyDrill || this.state.dailyDrill.date !== today) {
          this.state.dailyDrill = { date: today, completedCount: 0, rewardClaimed: false };
        }
        this.state.dailyDrill.completedCount++;
        if (this.state.dailyDrill.completedCount >= 5 && !this.state.dailyDrill.rewardClaimed) {
          this.state.dailyDrill.rewardClaimed = true;
          dailyDrillCompletedNow = true;
          xpGained += 25;
          coinsGained += 15;
          if (!this.state.charms) this.state.charms = {};
          this.state.charms['charm_hint_scroll'] = Math.min(99, (this.state.charms['charm_hint_scroll'] || 0) + 1);
        }
      }

      this.state.xp += xpGained;
      this.state.coins += coinsGained;

      if (firstTry && questionId) {
        this.state.review = this.state.review.filter((id) => id !== questionId);
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
      bridgeCompleted,
      doubleXpApplied,
      dailyDrillCompletedNow
    };
  }

  bloomFlower(index: number, flowerId?: number | string): FlowerBloomDelta {
    const fIdKey = flowerId !== undefined ? String(flowerId) : String(index + 1);
    const eKey = entityKey(6, fIdKey);
    const alreadyBloomed =
      (index >= 0 && index < this.state.flowers.length && this.state.flowers[index]) ||
      this.state.solvedProblems[fIdKey] === true ||
      this.state.solvedProblems[`flower_${fIdKey}`] === true ||
      this.state.solvedEntities?.[eKey] !== undefined;

    if (alreadyBloomed) {
      return {
        alreadyBloomed: true,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        allFlowersCompleted: this.state.flowers.every(Boolean),
        totalBloomed: this.state.flowers.filter(Boolean).length,
        doubleXpApplied: false
      };
    }

    const oldLevel = getLevel(this.state.xp);
    if (index >= 0 && index < this.state.flowers.length) {
      this.state.flowers[index] = true;
    }
    this.state.solvedProblems[fIdKey] = true;
    this.state.solvedProblems[`flower_${fIdKey}`] = true;
    if (!this.state.solvedEntities) this.state.solvedEntities = {};
    this.state.solvedEntities[eKey] = { solvedAt: new Date().toISOString(), attempts: 1 };

    const doubled = this.applyDoubleXpCharm(15);
    let xpGained = doubled.xp;
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
      totalBloomed: this.state.flowers.filter(Boolean).length,
      doubleXpApplied: doubled.applied
    };
  }

  wakeParkTree(index: number, treeId?: number | string, zoneId = 7, zoneTotal?: number): ParkTreeAwakenDelta {
    if (!this.state.parkTrees) {
      this.state.parkTrees = Array(20).fill(false);
    }
    if (!this.state.solvedEntities) {
      this.state.solvedEntities = {};
    }
    const tIdKey = treeId !== undefined ? String(treeId) : `park_tree_${index + 1}`;
    const eKey = entityKey(zoneId, tIdKey);
    const alreadyAwakened =
      this.state.solvedEntities[eKey] !== undefined ||
      (zoneId === 7 &&
        ((index >= 0 && index < this.state.parkTrees.length && this.state.parkTrees[index]) ||
          this.state.solvedProblems[tIdKey] === true ||
          this.state.solvedProblems[`tree_${index + 1}`] === true));

    if (alreadyAwakened) {
      return {
        alreadyAwakened: true,
        treeIndex: index,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        allTreesCompleted: this.state.parkTrees.every(Boolean),
        totalAwakened: this.state.parkTrees.filter(Boolean).length,
        doubleXpApplied: false
      };
    }

    const oldLevel = getLevel(this.state.xp);
    if (index >= 0 && index < this.state.parkTrees.length) {
      this.state.parkTrees[index] = true;
    }
    this.state.solvedEntities[eKey] = { solvedAt: new Date().toISOString(), attempts: 1 };
    if (zoneId === 7) {
      this.state.solvedProblems[tIdKey] = true;
      this.state.solvedProblems[`park_tree_${index + 1}`] = true;
      this.state.solvedProblems[`tree_${index + 1}`] = true;
    }

    const doubled = this.applyDoubleXpCharm(20);
    let xpGained = doubled.xp;
    let coinsGained = 5;

    const targetTotal = zoneTotal && zoneTotal > 0 ? zoneTotal : this.state.parkTrees.length;
    const zoneDoneCount = Object.keys(this.state.solvedEntities).filter((k) => k.startsWith(`${zoneId}:`)).length;
    const allTreesCompleted =
      zoneId === 7 ? this.state.parkTrees.slice(0, targetTotal).every(Boolean) : zoneDoneCount >= targetTotal;
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
      totalAwakened: this.state.parkTrees.filter(Boolean).length,
      doubleXpApplied: doubled.applied
    };
  }

  isParkTreeAwakened(index: number, zoneId = 7, treeId?: number | string): boolean {
    if (treeId !== undefined && this.state.solvedEntities?.[entityKey(zoneId, treeId)] !== undefined) {
      return true;
    }
    if (this.state.solvedEntities?.[entityKey(zoneId, `park_tree_${index + 1}`)] !== undefined) {
      return true;
    }
    if (zoneId !== 7) return false;
    if (!this.state.parkTrees) return false;
    return (
      !!this.state.parkTrees[index] ||
      !!this.state.solvedProblems[`park_tree_${index + 1}`] ||
      !!this.state.solvedProblems[`tree_${index + 1}`]
    );
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

  isProblemSolved(problemId: number | string, zoneId?: number): boolean {
    if (zoneId !== undefined && this.state.solvedEntities?.[entityKey(zoneId, problemId)] !== undefined) {
      return true;
    }
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
    const eKey = entityKey(zoneId, idKey);

    const isLegacyArchimedes = typeof problemId === 'number' && problemId >= 306 && problemId <= 345;
    const legacyIndex = isLegacyArchimedes ? (problemId as number) - 306 : problemId === undefined ? index : -1;

    const alreadyActivated =
      this.state.solvedEntities?.[eKey] !== undefined ||
      (legacyIndex >= 0 && legacyIndex < this.state.monoliths.length && this.state.monoliths[legacyIndex]) ||
      this.state.solvedProblems[idKey] === true;

    if (alreadyActivated) {
      let stateChanged = false;
      if (legacyIndex >= 0 && legacyIndex < this.state.monoliths.length && !this.state.monoliths[legacyIndex]) {
        this.state.monoliths[legacyIndex] = true;
        stateChanged = true;
      }
      const numId = Number(problemId);
      if (!isNaN(numId) && numId >= 306 && numId <= 345) {
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
      if (!this.state.solvedEntities) this.state.solvedEntities = {};
      if (!this.state.solvedEntities[eKey]) {
        this.state.solvedEntities[eKey] = { solvedAt: new Date().toISOString(), attempts: 1 };
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
        totalActivated: this.state.monoliths.filter(Boolean).length,
        doubleXpApplied: false
      };
    }

    const oldLevel = getLevel(this.state.xp);
    if (isLegacyArchimedes || problemId === undefined) {
      if (legacyIndex >= 0 && legacyIndex < this.state.monoliths.length) {
        this.state.monoliths[legacyIndex] = true;
      }
    }
    const numId = Number(problemId);
    if (!isNaN(numId) && numId >= 306 && numId <= 345) {
      const mIdx = numId - 306;
      if (mIdx >= 0) {
        while (this.state.monoliths.length <= mIdx) {
          this.state.monoliths.push(false);
        }
        this.state.monoliths[mIdx] = true;
      }
    }
    this.state.solvedProblems[idKey] = true;
    if (!this.state.solvedEntities) this.state.solvedEntities = {};
    this.state.solvedEntities[eKey] = { solvedAt: new Date().toISOString(), attempts: 1 };

    const doubled = this.applyDoubleXpCharm(20);
    let xpGained = doubled.xp;
    let coinsGained = 10;

    const zoneMonoliths = getMonolithsByZone(zoneId);
    const hasStaticZoneMonoliths = zoneMonoliths.length > 0;
    const hasDynamicZoneProblems = Array.isArray(zoneProblemIds) && zoneProblemIds.length > 0;

    let zoneCompletedNow = false;
    if (hasDynamicZoneProblems) {
      zoneCompletedNow = zoneProblemIds.every(
        (id) => this.isProblemSolved(id, zoneId) || (typeof id === 'number' && id >= 306 && this.state.monoliths[id - 306])
      );
    } else if (hasStaticZoneMonoliths) {
      zoneCompletedNow = zoneMonoliths.every(
        (m) => this.isProblemSolved(m.id, zoneId) || (typeof m.id === 'number' && m.id >= 306 && this.state.monoliths[m.id - 306])
      );
    }

    let zoneCompleted = false;
    while (this.state.zoneBadges.length < zoneId) {
      this.state.zoneBadges.push(false);
    }
    if (zoneCompletedNow && zoneId >= 1 && !this.state.zoneBadges[zoneId - 1]) {
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
      totalActivated: this.state.monoliths.filter(Boolean).length,
      doubleXpApplied: doubled.applied
    };
  }

  reconcileZoneProgress(
    zones: { id: number; sheetName?: string }[],
    questionsBySheet: Record<string, { id: number | string }[]>
  ): boolean {
    let changed = false;
    for (const [, questions] of Object.entries(questionsBySheet || {})) {
      if (Array.isArray(questions)) {
        questions.forEach((q) => {
          if (this.isProblemSolved(q.id)) {
            const num = Number(q.id);
            if (!isNaN(num) && num >= 306 && num <= 345) {
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
      const sheet = z.sheetName || `Zone_${z.id}_Archimedes`;
      const qList = questionsBySheet[sheet];
      if (z.id >= 1 && z.id <= 5 && !this.state.zoneBadges[z.id - 1]) {
        if (Array.isArray(qList) && qList.length > 0) {
          const allSolved = qList.every((q) => this.isProblemSolved(q.id, z.id));
          if (allSolved) {
            this.state.zoneBadges[z.id - 1] = true;
            changed = true;
          }
        }
      } else if ((z as { template?: string }).template === 'QHMJ_SANCTUARY' && Array.isArray(qList) && qList.length > 0) {
        const allSolved = qList.every((q) => this.isProblemSolved(`qhmj_${z.id}_${q.id}`, z.id));
        if (allSolved && !this.state.zoneBadges[z.id - 1]) {
          while (this.state.zoneBadges.length < z.id) {
            this.state.zoneBadges.push(false);
          }
          this.state.zoneBadges[z.id - 1] = true;
          changed = true;
        }
      } else if ((z as { template?: string }).template === 'FARM_RACE' && Array.isArray(qList) && qList.length > 0) {
        const allSolved = qList.every((q) => this.isProblemSolved(farmRaceProgressKey(z.id, q.id), z.id));
        if (allSolved && !this.state.zoneBadges[z.id - 1]) {
          while (this.state.zoneBadges.length < z.id) {
            this.state.zoneBadges.push(false);
          }
          this.state.zoneBadges[z.id - 1] = true;
          changed = true;
        }
      }
    }

    if (changed) {
      this.save();
    }
    return changed;
  }

  solveQhmjNode(options: {
    progressKey: string;
    zoneId: number;
    allProgressKeys: string[];
  }): {
    alreadySolved: boolean;
    xpGained: number;
    coinsGained: number;
    leveledUp: boolean;
    newLevel: number;
    zoneCompleted: boolean;
    doubleXpApplied: boolean;
  } {
    const eKey = entityKey(options.zoneId, options.progressKey);
    if (this.state.solvedProblems[options.progressKey] === true || this.state.solvedEntities?.[eKey] !== undefined) {
      return {
        alreadySolved: true,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        zoneCompleted: Boolean(this.state.zoneBadges[options.zoneId - 1]),
        doubleXpApplied: false
      };
    }

    const oldLevel = getLevel(this.state.xp);
    this.state.solvedProblems[options.progressKey] = true;
    if (!this.state.solvedEntities) this.state.solvedEntities = {};
    this.state.solvedEntities[eKey] = { solvedAt: new Date().toISOString(), attempts: 1 };

    const doubled = this.applyDoubleXpCharm(25);
    let xpGained = doubled.xp;
    let coinsGained = 10;

    const allSolved =
      options.allProgressKeys.length > 0 &&
      options.allProgressKeys.every((k) => this.state.solvedProblems[k] === true);
    let zoneCompleted = false;
    if (allSolved && options.zoneId >= 1 && !this.state.zoneBadges[options.zoneId - 1]) {
      while (this.state.zoneBadges.length < options.zoneId) {
        this.state.zoneBadges.push(false);
      }
      this.state.zoneBadges[options.zoneId - 1] = true;
      zoneCompleted = true;
      xpGained += 100;
      coinsGained += 50;
    }

    this.state.xp += xpGained;
    this.state.coins += coinsGained;
    const newLevel = getLevel(this.state.xp);
    this.save();

    return {
      alreadySolved: false,
      xpGained,
      coinsGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      zoneCompleted,
      doubleXpApplied: doubled.applied
    };
  }

  /**
   * Unified entity solver for Farm rescues and dynamic v2 entities.
   */
  solveFarmAnimal(options: {
    zoneId: number;
    animalId: string;
    totalAnimals?: number;
    firstTry?: boolean;
  }): EntitySolveDelta {
    const eKey = entityKey(options.zoneId, options.animalId);
    const alreadySolved =
      this.state.solvedEntities?.[eKey] !== undefined || this.state.farmRescued?.[options.animalId] === true;

    if (alreadySolved) {
      return {
        alreadySolved: true,
        entityKey: eKey,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        zoneCompleted: Boolean(this.state.zoneBadges[options.zoneId - 1]),
        doubleXpApplied: false
      };
    }

    const oldLevel = getLevel(this.state.xp);
    if (!this.state.farmRescued) this.state.farmRescued = {};
    this.state.farmRescued[options.animalId] = true;
    if (!this.state.solvedEntities) this.state.solvedEntities = {};
    this.state.solvedEntities[eKey] = {
      solvedAt: new Date().toISOString(),
      attempts: options.firstTry === false ? 2 : 1
    };

    const baseXp = 25 + (options.firstTry ? 5 : 0);
    const doubled = this.applyDoubleXpCharm(baseXp);
    let xpGained = doubled.xp;
    let coinsGained = 10;

    const total = options.totalAnimals && options.totalAnimals > 0 ? options.totalAnimals : 10;
    const rescuedCount = Object.values(this.state.farmRescued).filter(Boolean).length;
    let zoneCompleted = false;
    if (rescuedCount >= total && options.zoneId >= 1 && !this.state.zoneBadges[options.zoneId - 1]) {
      while (this.state.zoneBadges.length < options.zoneId) {
        this.state.zoneBadges.push(false);
      }
      this.state.zoneBadges[options.zoneId - 1] = true;
      zoneCompleted = true;
      xpGained += 120;
      coinsGained += 50;
    }

    this.state.xp += xpGained;
    this.state.coins += coinsGained;
    const newLevel = getLevel(this.state.xp);
    this.save();

    return {
      alreadySolved: false,
      entityKey: eKey,
      xpGained,
      coinsGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      zoneCompleted,
      doubleXpApplied: doubled.applied
    };
  }

  /**
   * Records a solved FARM_RACE checkpoint gate without duplicating rewards on replay.
   */
  solveFarmRaceCheckpoint(options: {
    zoneId: number;
    progressKey: string;
    firstTry?: boolean;
  }): {
    alreadySolved: boolean;
    xpGained: number;
    coinsGained: number;
    leveledUp: boolean;
    newLevel: number;
    doubleXpApplied: boolean;
  } {
    const eKey = entityKey(options.zoneId, options.progressKey);
    const alreadySolved =
      this.state.solvedProblems[options.progressKey] === true ||
      this.state.solvedEntities?.[eKey] !== undefined;

    if (alreadySolved) {
      return {
        alreadySolved: true,
        xpGained: 0,
        coinsGained: 0,
        leveledUp: false,
        newLevel: getLevel(this.state.xp),
        doubleXpApplied: false
      };
    }

    const oldLevel = getLevel(this.state.xp);
    this.state.solvedProblems[options.progressKey] = true;
    if (!this.state.solvedEntities) this.state.solvedEntities = {};
    this.state.solvedEntities[eKey] = {
      solvedAt: new Date().toISOString(),
      attempts: options.firstTry === false ? 2 : 1
    };

    const baseXp = 20 + (options.firstTry !== false ? 5 : 0);
    const doubled = this.applyDoubleXpCharm(baseXp);
    const xpGained = doubled.xp;
    const coinsGained = 8;

    this.state.xp += xpGained;
    this.state.coins += coinsGained;
    const newLevel = getLevel(this.state.xp);
    this.save();

    return {
      alreadySolved: false,
      xpGained,
      coinsGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      doubleXpApplied: doubled.applied
    };
  }

  /**
   * Records completion of a FARM_RACE run, awards podium rewards, and unlocks zone badge when all checkpoints are solved.
   */
  completeFarmRace(options: {
    zoneId: number;
    rank: number;
    elapsedMs: number;
    solvedCount: number;
    totalCheckpoints: number;
  }): {
    xpGained: number;
    coinsGained: number;
    leveledUp: boolean;
    newLevel: number;
    zoneCompleted: boolean;
    isNewBestRank: boolean;
    isNewBestTime: boolean;
  } {
    const oldLevel = getLevel(this.state.xp);
    if (!this.state.farmRaceRecords) this.state.farmRaceRecords = {};

    const key = String(options.zoneId);
    const prev = this.state.farmRaceRecords[key];
    const cleanRank = Math.max(1, Math.min(5, Math.floor(options.rank)));
    const cleanTimeMs = Math.max(0, Math.round(options.elapsedMs));
    const isNewBestRank = !prev || cleanRank < prev.bestRank;
    const isNewBestTime = !prev || prev.bestTimeMs === 0 || (cleanTimeMs > 0 && cleanTimeMs < prev.bestTimeMs);

    this.state.farmRaceRecords[key] = {
      bestRank: prev ? Math.min(prev.bestRank, cleanRank) : cleanRank,
      bestTimeMs:
        prev && prev.bestTimeMs > 0 && cleanTimeMs > 0
          ? Math.min(prev.bestTimeMs, cleanTimeMs)
          : (prev?.bestTimeMs || cleanTimeMs),
      racesCompleted: (prev?.racesCompleted || 0) + 1
    };

    const podiumTable: Record<number, { xp: number; coins: number }> = {
      1: { xp: 60, coins: 30 },
      2: { xp: 40, coins: 20 },
      3: { xp: 25, coins: 15 },
      4: { xp: 15, coins: 10 },
      5: { xp: 15, coins: 10 }
    };
    const podium = podiumTable[cleanRank] ?? podiumTable[5];
    let xpGained = podium.xp;
    let coinsGained = podium.coins;

    let zoneCompleted = false;
    if (
      options.totalCheckpoints > 0 &&
      options.solvedCount >= options.totalCheckpoints &&
      options.zoneId >= 1 &&
      !this.state.zoneBadges[options.zoneId - 1]
    ) {
      while (this.state.zoneBadges.length < options.zoneId) {
        this.state.zoneBadges.push(false);
      }
      this.state.zoneBadges[options.zoneId - 1] = true;
      zoneCompleted = true;
      xpGained += 80;
      coinsGained += 40;
    }

    this.state.xp += xpGained;
    this.state.coins += coinsGained;
    const newLevel = getLevel(this.state.xp);
    this.save();

    return {
      xpGained,
      coinsGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      zoneCompleted,
      isNewBestRank,
      isNewBestTime
    };
  }

  getArchimedesSolvedCount(monolithProblems: { id: number | string }[] = []): number {
    return getArchimedesSolvedCount(this.state, monolithProblems);
  }

  buyShopItem(itemId: string): { success: boolean; message: string; item?: ShopItem; state: Readonly<SaveState> } {
    const item = getShopItem(itemId);
    if (!item) {
      return { success: false, message: 'Vật phẩm không tồn tại!', state: this.state };
    }
    if (item.purchasable === false || item.type === 'produce') {
      return { success: false, message: 'Nông sản chỉ nhận được khi giải cứu thú ở Nông Trại!', state: this.state };
    }

    if (!this.state.inventory) this.state.inventory = [];
    if (!this.state.charms) this.state.charms = {};

    if (item.type === 'trail' && this.state.inventory.includes(item.id)) {
      return { success: false, message: 'Bé đã sở hữu hiệu ứng bước chân này rồi!', state: this.state };
    }

    if (this.state.coins < item.price) {
      return {
        success: false,
        message: `Bé cần thêm ${item.price - this.state.coins} xu để đổi lấy ${item.name}!`,
        state: this.state
      };
    }

    if (item.type === 'trail') {
      this.state.coins -= item.price;
      this.state.inventory.push(item.id);
      if (!this.state.equippedTrail) {
        this.state.equippedTrail = item.id;
      }
    } else if (item.type === 'charm') {
      if ((this.state.charms[item.id] || 0) >= 99) {
        return { success: false, message: 'Túi bùa loại này đã đầy (99 cái)!', state: this.state };
      }
      this.state.coins -= item.price;
      this.state.charms[item.id] = Math.min(99, (this.state.charms[item.id] || 0) + 1);
    }

    this.save();
    return {
      success: true,
      message: `Bé đã đổi thành công ${item.name}!`,
      item,
      state: this.state
    };
  }

  consumeCharm(charmId: string): boolean {
    if (!this.state.charms || (this.state.charms[charmId] || 0) <= 0) {
      return false;
    }
    this.state.charms[charmId]--;
    this.save();
    return true;
  }

  equipTrail(trailId: string): { success: boolean; message: string } {
    if (!trailId) {
      this.state.equippedTrail = '';
      this.save();
      return { success: true, message: 'Đã gỡ hiệu ứng bước chân.' };
    }

    if (!this.state.inventory || !this.state.inventory.includes(trailId)) {
      return { success: false, message: 'Bé chưa sở hữu hiệu ứng này!' };
    }

    this.state.equippedTrail = trailId;
    this.save();
    return { success: true, message: 'Đã trang bị hiệu ứng bước chân!' };
  }

  getEquippedTrail(): string {
    return this.state.equippedTrail || '';
  }

  getCharmCount(charmId: string): number {
    return this.state.charms?.[charmId] || 0;
  }

  getProduceCount(produceId: string): number {
    return this.state.produceBag?.[produceId] || 0;
  }

  getTotalProduceCount(): number {
    return Object.values(this.state.produceBag || {}).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
  }

  restoreState(newState: SaveState): void {
    this.state = newState;
    this.save();
  }

  resetProgress(): void {
    this.state = freshState();
    this.save();
  }

  // --- Nông Trại Vui Vẻ (Farm Sanctuary) ---
  isFarmRescued(animalId: string): boolean {
    if (!this.state.farmRescued) return false;
    return this.state.farmRescued[animalId] === true;
  }

  setFarmRescued(animalId: string, rescued: boolean = true): void {
    if (!this.state.farmRescued) this.state.farmRescued = {};
    this.state.farmRescued[animalId] = rescued;
    this.save();
  }

  addProduceToInventory(produceId: string, count: number = 1): void {
    if (count <= 0) return;
    if (!this.state.produceBag) this.state.produceBag = {};
    this.state.produceBag[produceId] = Math.min(999, (this.state.produceBag[produceId] || 0) + Math.floor(count));
    this.save();
  }

  sellProduce(produceId: string, count: number = 1): { success: boolean; coinsGained: number; message: string } {
    const item = getShopItem(produceId);
    if (!item || item.type !== 'produce') {
      return { success: false, coinsGained: 0, message: 'Vật phẩm này không phải nông sản!' };
    }
    const owned = this.getProduceCount(produceId);
    const sellQty = Math.max(1, Math.floor(count));
    if (owned < sellQty) {
      return { success: false, coinsGained: 0, message: `Bé chưa có đủ ${item.name} để bán!` };
    }
    const unitPrice = item.sellPrice ?? item.price;
    const coinsGained = unitPrice * sellQty;
    this.state.produceBag[produceId] = owned - sellQty;
    if (this.state.produceBag[produceId] <= 0) {
      delete this.state.produceBag[produceId];
    }
    this.state.coins += coinsGained;
    this.save();
    return {
      success: true,
      coinsGained,
      message: `Đã bán ${sellQty} ${item.name} nhận +${coinsGained} xu!`
    };
  }

  tradeProduceForCharm(charmId: string): { success: boolean; message: string } {
    if (!this.state.produceBag) this.state.produceBag = {};
    if (!this.state.charms) this.state.charms = {};

    if (charmId === 'charm_double_xp') {
      const truffles = this.state.produceBag['produce_truffle'] || 0;
      if (truffles < 2) {
        return { success: false, message: 'Cần 2 Nấm Quý Truffle để đổi Bùa Sao Băng (x2 XP)!' };
      }
      this.state.produceBag['produce_truffle'] = truffles - 2;
      if (this.state.produceBag['produce_truffle'] <= 0) delete this.state.produceBag['produce_truffle'];
      this.state.charms['charm_double_xp'] = Math.min(99, (this.state.charms['charm_double_xp'] || 0) + 1);
      this.save();
      return { success: true, message: 'Đã đổi 2 Nấm Quý Truffle lấy 1 Bùa Sao Băng!' };
    }

    if (charmId === 'charm_hint_scroll') {
      const total = this.getTotalProduceCount();
      if (total < 3) {
        return { success: false, message: 'Cần 3 nông sản bất kỳ để đổi Cuộn Giấy Thông Thái!' };
      }
      let remaining = 3;
      for (const key of Object.keys(this.state.produceBag)) {
        if (remaining <= 0) break;
        const have = this.state.produceBag[key] || 0;
        const take = Math.min(have, remaining);
        if (take > 0) {
          this.state.produceBag[key] = have - take;
          if (this.state.produceBag[key] <= 0) delete this.state.produceBag[key];
          remaining -= take;
        }
      }
      this.state.charms['charm_hint_scroll'] = Math.min(99, (this.state.charms['charm_hint_scroll'] || 0) + 1);
      this.save();
      return { success: true, message: 'Đã đổi 3 nông sản lấy 1 Cuộn Giấy Thông Thái!' };
    }

    return { success: false, message: 'Loại bùa này chưa hỗ trợ đổi bằng nông sản!' };
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

// Hàm tự động sinh câu hỏi Toán dựa theo bảng cửu chương cho nông trại
export function generateFarmMultiplicationProblem(
  animalIndex: number,
  species: string = 'cow'
): any {
  const tables = [2, 3, 4, 5];
  const table = tables[animalIndex % tables.length];
  const multiplier = Math.floor(Math.random() * 9) + 1;
  const result = table * multiplier;

  const names: Record<string, string> = {
    cow: 'bò',
    calf: 'bê',
    pig: 'heo',
    piglet: 'heo con',
    chicken: 'gà',
    chick: 'gà con',
    duck: 'vịt',
    duckling: 'vịt con',
    dog: 'cún'
  };
  const animalName = names[species] || 'bạn thú';

  const isWordProblem = Math.random() > 0.5;

  let prompt = '';
  if (isWordProblem) {
    prompt = `Bác nông dân có ${multiplier} chuồng ${animalName}, mỗi chuồng có ${table} con. Hỏi có tất cả bao nhiêu con ${animalName}?`;
  } else {
    prompt = `Giải phép tính để cứu ${animalName} nhé:\n${table} × ${multiplier} = ?`;
  }

  const wrong1 = result + table;
  const wrong2 = result - table > 0 ? result - table : result + multiplier;
  let wrong3 = (table + 1) * multiplier;
  if (wrong3 === result || wrong3 === wrong1 || wrong3 === wrong2) {
    wrong3 = result + 2;
  }

  const choices = [result, wrong1, wrong2, wrong3].sort(() => Math.random() - 0.5);
  const options = choices.map((c, i) => String.fromCharCode(65 + i) + '. ' + c);
  const answerIdx = choices.indexOf(result);
  const answerLetter = String.fromCharCode(65 + answerIdx);

  return {
    id: `farm_${species}_${animalIndex}`,
    title: `Bài ${animalIndex + 1}: Cứu Bé ${animalName}`,
    subtitle: `Phép tính nhân cứu bé ${animalName}`,
    ZoneName: 'Nông Trại Vui Vẻ',
    Problem: prompt,
    Hint: `Nhẩm bảng nhân ${table} xem sao! (${table} × ${multiplier})`,
    Explain: `${table} nhân với ${multiplier} bằng ${result}.`,
    Options: options.join('\n'),
    Answer: answerLetter
  };
}
