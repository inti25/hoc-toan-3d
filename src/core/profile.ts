import type { ExplorerProfile } from '../data/remoteTypes';

export const EXPLORER_PROFILE_KEY = 'aigame3d_explorer_profile';

export const FRIENDLY_NICKNAMES = [
  'Dũng Sĩ Tí Hon',
  'Hiệp Sĩ Rồng',
  'Mèo Dũng Cảm',
  'Nhà Thám Hiểm Nhí',
  'Chiến Binh Ánh Sáng',
  'Sao Băng Nhí'
] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memoryStore = new Map<string, string>();
export const defaultStorage: StorageLike = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch (_) {}
    return memoryStore.get(key) || null;
  },
  setItem: (key: string, val: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        return;
      }
    } catch (_) {}
    memoryStore.set(key, val);
  }
};

export interface ProgressLogRecord {
  zoneId: number | string;
  problemId: number | string;
  stepId?: string;
  isCorrect: boolean;
  score?: number;
  details?: any;
}

export interface ProgressTelemetryPayload {
  action: 'logProgress';
  explorerName: string;
  className: string;
  zoneId: number | string;
  problemId: number | string;
  stepId: string;
  isCorrect: boolean;
  score: number;
  details: any;
}

/**
 * Deep module managing explorer identity, profile persistence,
 * friendly nickname generation, and telemetry serialization.
 */
export class ExplorerProfileManager {
  private memoryFallback?: ExplorerProfile;

  constructor(private storage: StorageLike = defaultStorage) {}

  getProfile(): ExplorerProfile {
    try {
      const raw = this.storage.getItem(EXPLORER_PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const profile: ExplorerProfile = {
            nickname: typeof parsed.nickname === 'string' && parsed.nickname.trim() ? parsed.nickname.trim() : 'Dũng Sĩ Tí Hon',
            className: typeof parsed.className === 'string' && parsed.className.trim() ? parsed.className.trim() : 'Lớp 2',
            isAnonymous: Boolean(parsed.isAnonymous)
          };
          this.memoryFallback = profile;
          return profile;
        }
      }
    } catch (_) {}

    if (this.memoryFallback) {
      return this.memoryFallback;
    }

    const defaultProfile: ExplorerProfile = {
      nickname: 'Dũng Sĩ Tí Hon',
      className: 'Lớp 2',
      isAnonymous: true
    };
    this.memoryFallback = defaultProfile;
    return defaultProfile;
  }

  saveProfile(profile: Partial<ExplorerProfile>): ExplorerProfile {
    const current = this.getProfile();
    const resolved = this.resolveProfileData(profile.nickname, profile.className, current);
    this.memoryFallback = resolved;
    try {
      this.storage.setItem(EXPLORER_PROFILE_KEY, JSON.stringify(resolved));
    } catch (_) {}
    return resolved;
  }

  resolveProfileData(
    inputName?: string,
    inputClass?: string,
    fallbackProfile?: ExplorerProfile
  ): ExplorerProfile {
    const rawName = inputName?.trim() || '';
    const className = inputClass?.trim() || fallbackProfile?.className || 'Lớp 2';

    if (rawName) {
      return {
        nickname: rawName,
        className,
        isAnonymous: false
      };
    }

    if (fallbackProfile && !fallbackProfile.isAnonymous && fallbackProfile.nickname) {
      return {
        nickname: fallbackProfile.nickname,
        className,
        isAnonymous: false
      };
    }

    const randomNick = FRIENDLY_NICKNAMES[Math.floor(Math.random() * FRIENDLY_NICKNAMES.length)];
    return {
      nickname: randomNick,
      className,
      isAnonymous: true
    };
  }

  formatTelemetryPayload(record: ProgressLogRecord): ProgressTelemetryPayload {
    const profile = this.getProfile();
    return {
      action: 'logProgress',
      explorerName: profile.nickname || 'Dũng Sĩ Ẩn Danh',
      className: profile.className || 'Lớp 2',
      zoneId: record.zoneId,
      problemId: record.problemId,
      stepId: record.stepId || '',
      isCorrect: record.isCorrect,
      score: record.score || 0,
      details: record.details
    };
  }
}

export const profileManager = new ExplorerProfileManager();

export function getExplorerProfile(): ExplorerProfile {
  return profileManager.getProfile();
}

export function saveExplorerProfile(profile: Partial<ExplorerProfile>): ExplorerProfile {
  return profileManager.saveProfile(profile);
}
