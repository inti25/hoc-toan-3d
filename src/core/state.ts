import { BRIDGE_PARTS, SAVE_KEY, TABLES, type Table } from '../data/config';
import { ALL_AVATAR_IDS, type AvatarId } from '../data/characters';
export interface QuestionStat { attempts: number; correct: number; wrong: number; lastAnsweredAt: string; responseTime: number }
export interface SaveState {
  version: 1; xp: number; coins: number; bridge: number; questAccepted: boolean; questComplete: boolean;
  avatar: AvatarId; table: Table | 0; sound: boolean; music: boolean; combo: number;
  questionStats: Record<string, QuestionStat>; review: string[]; started: boolean;
  flowers: boolean[];
  monoliths: boolean[];
  zoneBadges: boolean[];
  parkTrees: boolean[];
  farmRescued: Record<string, boolean>;
  solvedProblems: Record<string, boolean>;
  position?: { x: number; z: number };
  inventory: string[];
  equippedTrail: string;
  charms: Record<string, number>;
}
export const freshState = (): SaveState => ({
  version: 1,
  xp: 0,
  coins: 0,
  bridge: 0,
  questAccepted: false,
  questComplete: false,
  avatar: 'boy',
  table: 0,
  sound: true,
  music: false,
  combo: 0,
  questionStats: {},
  review: [],
  started: false,
  flowers: Array(10).fill(false),
  monoliths: Array(40).fill(false),
  zoneBadges: Array(5).fill(false),
  parkTrees: Array(20).fill(false),
  farmRescued: {},
  solvedProblems: {},
  inventory: [],
  equippedTrail: '',
  charms: {}
});
const positive = (v: unknown, max = 10000000): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
export function parseSave(raw: string | null): SaveState {
  const base = freshState();
  if (!raw) return base;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object' || !('version' in v) || v.version !== 1) return base;
    const d = v as Record<string, unknown>;
    base.xp = positive(d.xp); base.coins = positive(d.coins); base.bridge = positive(d.bridge, BRIDGE_PARTS);
    base.questAccepted = d.questAccepted === true || base.bridge > 0;
    base.questComplete = d.questComplete === true && base.bridge === BRIDGE_PARTS;
    base.avatar = ALL_AVATAR_IDS.includes(d.avatar as AvatarId) ? d.avatar as AvatarId : 'boy';
    base.table = TABLES.includes(d.table as Table) ? d.table as Table : 0;
    base.sound = d.sound !== false; base.music = d.music === true; base.started = d.started === true;
    base.combo = positive(d.combo, 10000);
    if (d.questionStats && typeof d.questionStats === 'object') {
      for (const [id, value] of Object.entries(d.questionStats).slice(0, 100)) {
        if (!/^m([1-9]|10)_([1-9]|10)$/.test(id) || !value || typeof value !== 'object') continue;
        const s = value as Record<string, unknown>;
        const correct = positive(s.correct), wrong = positive(s.wrong);
        base.questionStats[id] = { attempts: correct + wrong, correct, wrong, responseTime: positive(s.responseTime), lastAnsweredAt: typeof s.lastAnsweredAt === 'string' ? s.lastAnsweredAt.slice(0, 40) : '' };
      }
    }
    if (Array.isArray(d.review)) base.review = [...new Set(d.review.filter((id): id is string => typeof id === 'string' && /^m([1-9]|10)_([1-9]|10)$/.test(id)))].slice(0, 100);
    if (d.solvedProblems && typeof d.solvedProblems === 'object') {
      for (const [k, val] of Object.entries(d.solvedProblems as Record<string, unknown>)) {
        if (val === true) base.solvedProblems[String(k)] = true;
      }
    }
    if (d.farmRescued && typeof d.farmRescued === 'object') {
      for (const [k, val] of Object.entries(d.farmRescued as Record<string, unknown>)) {
        if (val === true) base.farmRescued[String(k)] = true;
      }
    }
    if (Array.isArray(d.flowers)) {
      const fl = d.flowers;
      base.flowers = Array.from({ length: 10 }, (_, i) => fl[i] === true);
    }
    for (let i = 0; i < 10; i++) {
      if (base.flowers[i]) {
        base.solvedProblems[`flower_${i + 1}`] = true;
        base.solvedProblems[String(i + 1)] = true;
      } else if (base.solvedProblems[`flower_${i + 1}`] === true || base.solvedProblems[String(i + 1)] === true) {
        base.flowers[i] = true;
      }
    }
    if (Array.isArray(d.monoliths)) {
      const mo = d.monoliths;
      base.monoliths = Array.from({ length: Math.max(40, mo.length) }, (_, i) => mo[i] === true);
    }
    base.monoliths.forEach((isDone, idx) => {
      if (isDone) {
        base.solvedProblems[String(306 + idx)] = true;
      }
    });
    for (const [k, val] of Object.entries(base.solvedProblems)) {
      if (val === true) {
        const num = Number(k);
        if (!isNaN(num) && num >= 306) {
          const mIdx = num - 306;
          if (mIdx >= 0) {
            while (base.monoliths.length <= mIdx) {
              base.monoliths.push(false);
            }
            base.monoliths[mIdx] = true;
          }
        }
      }
    }
    if (Array.isArray(d.zoneBadges)) {
      const zb = d.zoneBadges;
      base.zoneBadges = Array.from({ length: Math.max(5, zb.length) }, (_, i) => zb[i] === true);
    }
    if (Array.isArray(d.parkTrees)) {
      const pt = d.parkTrees;
      base.parkTrees = Array.from({ length: 20 }, (_, i) => pt[i] === true);
    }
    for (let i = 0; i < 20; i++) {
      if (base.parkTrees[i]) {
        base.solvedProblems[`park_tree_${i + 1}`] = true;
        base.solvedProblems[`tree_${i + 1}`] = true;
      } else if (base.solvedProblems[`park_tree_${i + 1}`] === true || base.solvedProblems[`tree_${i + 1}`] === true) {
        base.parkTrees[i] = true;
      }
    }
    if (d.position && typeof d.position === 'object') {
      const p = d.position as Record<string, unknown>;
      const x = typeof p.x === 'number' && Number.isFinite(p.x) ? Math.round(p.x * 100) / 100 : undefined;
      const z = typeof p.z === 'number' && Number.isFinite(p.z) ? Math.round(p.z * 100) / 100 : undefined;
      if (x !== undefined && z !== undefined) {
        base.position = { x, z };
      }
    }
    if (Array.isArray(d.inventory)) {
      base.inventory = [...new Set(d.inventory.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    }
    if (typeof d.equippedTrail === 'string') {
      base.equippedTrail = d.equippedTrail;
    }
    if (d.charms && typeof d.charms === 'object') {
      for (const [k, v] of Object.entries(d.charms as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          base.charms[k] = Math.floor(v);
        }
      }
    }
    return base;
  } catch { return base; }
}
export function loadState(): SaveState { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return freshState(); } }
export function saveState(state: SaveState): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; } }

export function sanitizeSaveState(data: any): SaveState {
  if (!data) return freshState();
  if (typeof data === 'string') return parseSave(data);
  return parseSave(JSON.stringify(data));
}
