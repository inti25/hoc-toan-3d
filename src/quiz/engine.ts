import { TABLES, type Table } from '../data/config';
import type { SaveState } from '../core/state';
export interface Option { value: number; label: string }
export interface Question { id: string; a: number; b: number; answer: number; options: Option[]; review: boolean }
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1));[result[i], result[j]] = [result[j], result[i]]; } return result;
}
export function makeQuestion(a: number, b: number, mode: 'bridge' | 'practice', random = Math.random): Question {
  const answer = a * b;
  const neighbors = [b > 1 ? b - 1 : b + 2, b < 10 ? b + 1 : b - 2];
  const options = [b, ...neighbors].map(n => ({ value: a * n, label: mode === 'bridge' ? `${a} × ${n}` : `${a * n}` }));
  return { id: `m${a}_${b}`, a, b, answer, options: shuffle(options, random), review: false };
}
export function generateQuestion(state: SaveState, mode: 'bridge' | 'practice', previous = '', random = Math.random): Question {
  const allowed = state.table ? [state.table] : [...TABLES];
  const reviews = state.review.filter(id => id !== previous && allowed.includes(Number(id.split('_')[0].slice(1)) as Table));
  if (reviews.length && random() < .7) {
    const id = reviews[Math.floor(random() * reviews.length)]; const [a, b] = id.slice(1).split('_').map(Number);
    return { ...makeQuestion(a, b, mode, random), review: true };
  }
  const candidates = allowed.flatMap(a => Array.from({ length: 10 }, (_, i) => ({ a, b: i + 1 }))).filter(({ a, b }) => `m${a}_${b}` !== previous);
  const q = candidates[Math.floor(random() * candidates.length)];
  return makeQuestion(q.a, q.b, mode, random);
}
export const validateAnswer = (q: Question, selected: number): boolean => selected === q.answer;
export function recordAnswer(state: SaveState, q: Question, correct: boolean, responseTime: number) {
  const stat = state.questionStats[q.id] ?? { attempts: 0, correct: 0, wrong: 0, lastAnsweredAt: '', responseTime: 0 };
  stat.attempts++; stat[correct ? 'correct' : 'wrong']++; stat.lastAnsweredAt = new Date().toISOString(); stat.responseTime = Math.round(responseTime);
  state.questionStats[q.id] = stat;
  if (!correct && !state.review.includes(q.id)) state.review.push(q.id);
  // An answer corrected with a hint stays queued until a later unassisted answer.
  state.combo = correct ? state.combo + 1 : 0;
}
export function getHint(q: Question, stage: number): string {
  if (stage === 1) return `Có ${q.b} nhóm, mỗi nhóm ${q.a} viên đá. Hãy đếm từng nhóm nhé!`;
  if (stage === 2) return `Cộng các nhóm lại: ${Array(q.b).fill(q.a).join(' + ')} = ?`;
  return `${q.b} nhóm, mỗi nhóm ${q.a} viên đá: ${q.a} × ${q.b} = ${q.answer}. Mình cùng thử lại nhé!`;
}
