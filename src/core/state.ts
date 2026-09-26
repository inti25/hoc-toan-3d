import { BRIDGE_PARTS, SAVE_KEY, TABLES, type Table } from '../data/config';
export interface QuestionStat { attempts: number; correct: number; wrong: number; lastAnsweredAt: string; responseTime: number }
export interface SaveState {
  version: 1; xp: number; coins: number; bridge: number; questAccepted: boolean; questComplete: boolean;
  avatar: 'boy' | 'girl'; table: Table | 0; sound: boolean; music: boolean; combo: number;
  questionStats: Record<string, QuestionStat>; review: string[]; started: boolean;
  flowers: boolean[];
  monoliths: boolean[];
  zoneBadges: boolean[];
}
export const freshState = (): SaveState => ({ version: 1, xp: 0, coins: 0, bridge: 0, questAccepted: false, questComplete: false, avatar: 'boy', table: 0, sound: true, music: false, combo: 0, questionStats: {}, review: [], started: false, flowers: Array(10).fill(false), monoliths: Array(40).fill(false), zoneBadges: Array(5).fill(false) });
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
    base.avatar = d.avatar === 'girl' ? 'girl' : 'boy';
    base.table = TABLES.includes(d.table as Table) ? d.table as Table : 0;
    base.sound = d.sound !== false; base.music = d.music === true; base.started = d.started === true;
    base.combo = positive(d.combo, 10000);
    if (d.questionStats && typeof d.questionStats === 'object') {
      for (const [id, value] of Object.entries(d.questionStats).slice(0, 30)) {
        if (!/^m(2|5|10)_([1-9]|10)$/.test(id) || !value || typeof value !== 'object') continue;
        const s = value as Record<string, unknown>;
        const correct = positive(s.correct), wrong = positive(s.wrong);
        base.questionStats[id] = { attempts: correct + wrong, correct, wrong, responseTime: positive(s.responseTime), lastAnsweredAt: typeof s.lastAnsweredAt === 'string' ? s.lastAnsweredAt.slice(0, 40) : '' };
      }
    }
    if (Array.isArray(d.review)) base.review = [...new Set(d.review.filter((id): id is string => typeof id === 'string' && /^m(2|5|10)_([1-9]|10)$/.test(id)))].slice(0, 30);
    if (Array.isArray(d.flowers)) {
      const fl = d.flowers;
      base.flowers = Array.from({ length: 10 }, (_, i) => fl[i] === true);
    }
    if (Array.isArray(d.monoliths)) {
      const mo = d.monoliths;
      base.monoliths = Array.from({ length: 40 }, (_, i) => mo[i] === true);
    }
    if (Array.isArray(d.zoneBadges)) {
      const zb = d.zoneBadges;
      base.zoneBadges = Array.from({ length: 5 }, (_, i) => zb[i] === true);
    }
    return base;
  } catch { return base; }
}
export function loadState(): SaveState { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return freshState(); } }
export function saveState(state: SaveState): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; } }
