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

/**
 * Bảng chữ cái thân thiện cho trẻ em, loại trừ các ký tự dễ nhầm lẫn (0/O, 1/I/l)
 */
export const PASSCODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Tạo Mã Thám Hiểm định dạng thân thiện: MTH-XXX (ví dụ: MTH-882, MTH-9KP)
 */
export function generateExplorerPasscode(): string {
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += PASSCODE_ALPHABET.charAt(Math.floor(Math.random() * PASSCODE_ALPHABET.length));
  }
  return `MTH-${suffix}`;
}

/**
 * Tạo Explorer ID ngẫu nhiên không trùng lặp
 */
export function generateExplorerId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Chuẩn hóa Mã Thám Hiểm (bỏ khoảng trắng, viết hoa, tự động thêm tiền tố MTH- nếu cần)
 */
export function normalizePasscode(input: string): string {
  if (!input) return '';
  let clean = input.trim().toUpperCase().replace(/\s+/g, '');
  // Nếu học sinh gõ 3 ký tự (ví dụ: 882 hoặc 9KP), tự động thêm MTH-
  if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/i.test(clean)) {
    clean = `MTH-${clean}`;
  } else if (/^MTH[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/i.test(clean)) {
    clean = `MTH-${clean.slice(3)}`;
  }
  return clean;
}

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
          const nickname = typeof parsed.nickname === 'string' && parsed.nickname.trim()
            ? parsed.nickname.trim()
            : 'Dũng Sĩ Tí Hon';
          const className = typeof parsed.className === 'string' && parsed.className.trim()
            ? parsed.className.trim()
            : 'Lớp 2';
          const isAnonymous = Boolean(parsed.isAnonymous);

          let explorerId = typeof parsed.explorerId === 'string' && parsed.explorerId.trim()
            ? parsed.explorerId.trim()
            : '';
          let passcode = typeof parsed.passcode === 'string' && parsed.passcode.trim()
            ? normalizePasscode(parsed.passcode)
            : '';

          let shouldPersist = false;
          if (!explorerId) {
            explorerId = generateExplorerId();
            shouldPersist = true;
          }
          if (!passcode) {
            passcode = generateExplorerPasscode();
            shouldPersist = true;
          }

          const profile: ExplorerProfile = {
            nickname,
            className,
            isAnonymous,
            explorerId,
            passcode,
            avatar: typeof parsed.avatar === 'string' && parsed.avatar.trim() ? parsed.avatar.trim() : undefined
          };

          if (shouldPersist) {
            try {
              this.storage.setItem(EXPLORER_PROFILE_KEY, JSON.stringify(profile));
            } catch (_) {}
          }

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
      isAnonymous: true,
      explorerId: generateExplorerId(),
      passcode: generateExplorerPasscode()
    };
    try {
      this.storage.setItem(EXPLORER_PROFILE_KEY, JSON.stringify(defaultProfile));
    } catch (_) {}
    this.memoryFallback = defaultProfile;
    return defaultProfile;
  }

  saveProfile(profile: Partial<ExplorerProfile>): ExplorerProfile {
    const current = this.getProfile();
    const resolved = this.resolveProfileData(profile.nickname, profile.className, current);
    resolved.explorerId = profile.explorerId?.trim() || current.explorerId || generateExplorerId();
    resolved.passcode = profile.passcode ? normalizePasscode(profile.passcode) : (current.passcode || generateExplorerPasscode());
    resolved.avatar = profile.avatar || current.avatar;


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
        isAnonymous: false,
        explorerId: fallbackProfile?.explorerId,
        passcode: fallbackProfile?.passcode
      };
    }

    if (fallbackProfile && !fallbackProfile.isAnonymous && fallbackProfile.nickname) {
      return {
        nickname: fallbackProfile.nickname,
        className,
        isAnonymous: false,
        explorerId: fallbackProfile?.explorerId,
        passcode: fallbackProfile?.passcode
      };
    }

    const randomNick = FRIENDLY_NICKNAMES[Math.floor(Math.random() * FRIENDLY_NICKNAMES.length)];
    return {
      nickname: randomNick,
      className,
      isAnonymous: true,
      explorerId: fallbackProfile?.explorerId,
      passcode: fallbackProfile?.passcode
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

