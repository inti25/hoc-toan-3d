import { makeQuestion, getHint, type Question } from './engine';
import { FLOWER_QUESTIONS, type FlowerQuestion } from '../data/flowerQuestions';
import { ARCHIMEDES_MONOLITHS, type ArchimedesMonolith, type ArchimedesStep } from '../data/archimedesTrialMap';

export type ChallengeKind = 'multiplication' | 'flower' | 'archimedes';

export type AnswerType = 'numeric' | 'comparison' | 'choice';

export interface ParsedAnswer {
  type: AnswerType;
  raw: string;
  expectedNumber?: number;
  unit?: string;
  expectedChar?: string;
}

export function parseAnswer(rawAnswer: string | number): ParsedAnswer {
  const str = String(rawAnswer).trim();

  const compMatch = str.match(/^([<>=]|<=|>=|≤|≥|=>|=<)$/);
  if (compMatch) {
    let normalized = str;
    if (str === '≤' || str === '=<') normalized = '<=';
    else if (str === '≥' || str === '=>') normalized = '>=';

    return {
      type: 'comparison',
      raw: str,
      expectedChar: normalized
    };
  }

  const singleNumberUnitMatch = str.match(/^(\d+)\s*([a-zA-ZÀ-ỹℓ]+.*)?$/);
  if (
    singleNumberUnitMatch &&
    !str.includes(';') &&
    !str.includes(',') &&
    !str.includes('và') &&
    !str.includes('=') &&
    !str.includes('hình') &&
    !str.includes('đoạn') &&
    !str.includes('điểm') &&
    !str.includes('Ngày')
  ) {
    const num = Number(singleNumberUnitMatch[1]);
    const unit = (singleNumberUnitMatch[2] || '').trim();
    return {
      type: 'numeric',
      raw: str,
      expectedNumber: num,
      unit
    };
  }

  return {
    type: 'choice',
    raw: str
  };
}

export interface ChallengeOption {
  value: string | number;
  label: string;
}

export interface BaseChallenge {
  id: string;
  kind: ChallengeKind;
  prompt: string;
  options: ChallengeOption[];
}

export interface MultiplicationChallenge extends BaseChallenge {
  kind: 'multiplication';
  a: number;
  b: number;
  answer: number;
  expectedInput: number;
  mode: 'bridge' | 'practice';
  review: boolean;
  question: Question;
}

export interface FlowerChallenge extends BaseChallenge {
  kind: 'flower';
  index: number;
  title: string;
  badge: string;
  color: number;
  answer: string;
  hints: string[];
  explanation: string;
  imageUrl?: string;
  explanationImageUrl?: string;
  flowerQuestion: FlowerQuestion;
}

export interface ArchimedesChallenge extends BaseChallenge {
  kind: 'archimedes';
  monolithId: number;
  monolithIndex: number;
  stepIndex: number;
  totalSteps: number;
  title: string;
  zoneName: string;
  page: number;
  badge: string;
  color: number;
  answer: string;
  hints: string[];
  explanation: string;
  imageUrl?: string;
  explanationImageUrl?: string;
  diagramSvg?: string;
  monolith: ArchimedesMonolith;
  step: ArchimedesStep;
}

export type Challenge = MultiplicationChallenge | FlowerChallenge | ArchimedesChallenge;

export function createMultiplicationChallenge(
  a: number,
  b: number,
  mode: 'bridge' | 'practice',
  random = Math.random,
  review = false
): MultiplicationChallenge {
  const q = makeQuestion(a, b, mode, random);
  q.review = review;
  const expectedInput = mode === 'bridge' ? b : q.answer;
  return {
    id: q.id,
    kind: 'multiplication',
    prompt: mode === 'bridge' ? `${a} × [ ? ] = ${q.answer} viên đá` : `${a} × ${b} = ?`,
    options: q.options,
    a,
    b,
    answer: q.answer,
    expectedInput,
    mode,
    review,
    question: q
  };
}

export function createFlowerChallenge(index: number): FlowerChallenge {
  const q = FLOWER_QUESTIONS[index];
  return {
    id: `flower_${index}`,
    kind: 'flower',
    index,
    title: q.title,
    badge: q.badge,
    color: q.color,
    prompt: q.question,
    options: q.options.map(o => ({ value: o.value, label: o.label })),
    answer: q.answer,
    hints: q.hints,
    explanation: q.explanation,
    imageUrl: q.imageUrl,
    explanationImageUrl: q.explanationImageUrl,
    flowerQuestion: q
  };
}

export function createArchimedesChallenge(monolithIndex: number, stepIndex = 0): ArchimedesChallenge {
  const m = ARCHIMEDES_MONOLITHS[monolithIndex];
  const step = m.steps[Math.min(stepIndex, m.steps.length - 1)];
  return {
    id: `archimedes_${m.id}_${stepIndex}`,
    kind: 'archimedes',
    monolithId: m.id,
    monolithIndex,
    stepIndex,
    totalSteps: m.steps.length,
    title: m.title,
    zoneName: m.zoneName,
    page: m.page,
    badge: m.badge,
    color: m.color,
    prompt: step.prompt,
    options: step.options.map(o => ({ value: o.value, label: o.label })),
    answer: step.answer,
    hints: step.hints,
    explanation: step.explanation,
    imageUrl: step.imageUrl,
    explanationImageUrl: step.explanationImageUrl,
    diagramSvg: step.diagramSvg,
    monolith: m,
    step
  };
}

export interface SubmitResult {
  isCorrect: boolean;
  attempts: number;
  hintStage: number;
  hint: string;
  explanation?: string;
}

export class ChallengeSession {
  private attempts = 0;
  private hintStage = 0;
  private solved = false;
  private startTimestamp: number;

  constructor(readonly challenge: Challenge) {
    this.startTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  isSolved(): boolean {
    return this.solved;
  }

  getAttempts(): number {
    return this.attempts;
  }

  getHintStage(): number {
    return this.hintStage;
  }

  getDurationMs(): number {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Math.max(0, Math.round(now - this.startTimestamp));
  }

  requestHint(): string {
    const maxStages = this.challenge.kind === 'multiplication' ? 3 : this.challenge.hints.length;
    this.hintStage = Math.min(maxStages, this.hintStage + 1);
    return this.resolveHint(this.hintStage);
  }

  submit(choice: string | number): SubmitResult {
    this.attempts++;
    let isCorrect = false;

    if (this.challenge.kind === 'multiplication') {
      const num = Number(choice);
      if (this.challenge.mode === 'bridge') {
        isCorrect = num === this.challenge.expectedInput || num === this.challenge.answer;
      } else {
        isCorrect = num === this.challenge.answer;
      }
    } else {
      const parsed = parseAnswer(this.challenge.answer);
      if (parsed.type === 'numeric') {
        const cleanChoice = String(choice).trim();
        const numOnly = Number(cleanChoice.replace(/[^0-9]/g, ''));
        isCorrect =
          cleanChoice === parsed.raw ||
          Number(choice) === parsed.expectedNumber ||
          (cleanChoice.length > 0 && numOnly === parsed.expectedNumber);
      } else if (parsed.type === 'comparison') {
        const cleanChoice = String(choice).trim();
        let normChoice = cleanChoice;
        if (cleanChoice === '≤' || cleanChoice === '=<') normChoice = '<=';
        else if (cleanChoice === '≥' || cleanChoice === '=>') normChoice = '>=';
        isCorrect =
          cleanChoice === parsed.raw ||
          cleanChoice === parsed.expectedChar ||
          normChoice === parsed.expectedChar;
      } else {
        isCorrect = String(choice).trim() === String(this.challenge.answer).trim();
      }
    }

    if (isCorrect) {
      this.solved = true;
      return {
        isCorrect: true,
        attempts: this.attempts,
        hintStage: this.hintStage,
        hint: '',
        explanation: this.challenge.kind !== 'multiplication' ? this.challenge.explanation : undefined
      };
    }

    // Wrong answer advances the hint stage
    const maxStages = this.challenge.kind === 'multiplication' ? 3 : this.challenge.hints.length;
    this.hintStage = Math.min(maxStages, this.hintStage + 1);
    const hint = this.resolveHint(this.hintStage);

    return {
      isCorrect: false,
      attempts: this.attempts,
      hintStage: this.hintStage,
      hint,
      explanation:
        this.challenge.kind !== 'multiplication' && this.hintStage >= maxStages
          ? this.challenge.explanation
          : undefined
    };
  }

  private resolveHint(stage: number): string {
    if (this.challenge.kind === 'multiplication') {
      return getHint(this.challenge.question, stage);
    }
    const idx = Math.max(0, Math.min(this.challenge.hints.length - 1, stage - 1));
    return this.challenge.hints[idx] ?? '';
  }
}
