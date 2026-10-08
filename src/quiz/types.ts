import type { RemoteProblem, RemoteZoneConfig } from '../data/remoteTypes';
import type { Adventure } from '../core/adventure';
import type { World } from '../world/World';

export type ChallengeType = 'multiplication' | 'flower' | 'park_tree' | 'archimedes' | 'farm_animal';

export type ChallengeSpec =
  | {
      type: 'multiplication';
      mode: 'bridge' | 'practice';
      lastId?: string;
    }
  | {
      type: 'flower';
      index: number;
      remoteFlowers?: RemoteProblem[];
    }
  | {
      type: 'park_tree';
      index: number;
      questions?: RemoteProblem[];
      zone?: RemoteZoneConfig;
    }
  | {
      type: 'archimedes';
      monolithRef: number | string;
      stepIndex?: number;
      questionsBySheet?: Record<string, RemoteProblem[]>;
      zones?: RemoteZoneConfig[];
      monolithProblems?: RemoteProblem[];
    }
  | {
      type: 'farm_animal';
      animalId: string;
      animalName: string;
      problemData: any;
    };

export interface ChallengeRewardSummary {
  xp?: number;
  coins?: number;
  combo?: number;
  leveledUp?: boolean;
  newLevel?: number;
  bridgeParts?: number;
  bloomedIndex?: number;
  monolithId?: number | string;
}

export interface ChallengeOutcome {
  spec: ChallengeSpec;
  status: 'solved' | 'dismissed';
  isCorrect: boolean;
  attempts: number;
  durationMs: number;
  rewards?: ChallengeRewardSummary;
}

export interface ChallengePorts {
  ui: {
    openDialog: (title: string, body: string, kind: string) => void;
    closeDialog: () => void;
    toast: (msg: string) => void;
    updateHUD: () => void;
    onOpenMap?: (selectedZoneId?: number) => void;
  };
  audio: {
    playCue: (cue: 'celebrate' | 'correct' | 'hint' | 'jump') => void;
  };
  world: {
    burstPlayer: () => void;
    getWorld: () => World;
  };
  adventure: Adventure;
  telemetry?: {
    logRemoteProgress: (record: {
      zoneId: number | string;
      problemId: number | string;
      stepId?: string;
      isCorrect: boolean;
      score?: number;
      details?: any;
    }) => Promise<void>;
  };
}

export interface ChallengeSessionPort {
  /**
   * Starts a challenge session with the given specification,
   * encapsulating modal lifecycle, inputs, hints, sound cues,
   * and progress persistence.
   * Resolves when the challenge is completed or dismissed.
   */
  startChallenge(spec: ChallengeSpec): Promise<ChallengeOutcome>;
}
