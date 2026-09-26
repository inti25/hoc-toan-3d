import { makeQuestion, getHint, type Question } from './engine';
import { FLOWER_QUESTIONS, type FlowerQuestion } from '../data/flowerQuestions';
import { ARCHIMEDES_MONOLITHS, type ArchimedesMonolith, type ArchimedesStep } from '../data/archimedesTrialMap';

export type ChallengeKind = 'multiplication' | 'flower' | 'archimedes';

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
  return {
    id: q.id,
    kind: 'multiplication',
    prompt: mode === 'bridge' ? `${q.answer} viên đá` : `${a} × ${b} = ?`,
    options: q.options,
    a,
    b,
    answer: q.answer,
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
      isCorrect = Number(choice) === this.challenge.answer;
    } else {
      isCorrect = String(choice) === this.challenge.answer;
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
