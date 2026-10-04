import type { SaveState, QuestionStat } from './state';
import { sanitizeSaveState } from './state';
import { BRIDGE_PARTS, getLevel } from '../data/config';
import type { Adventure } from './adventure';
import { profileManager, ExplorerProfileManager, defaultStorage, type StorageLike } from './profile';
import {
  savePlayerProgressToSheets,
  loadPlayerProgressFromSheets,
  type RemotePlayerProgress,
  type SavePlayerProgressPayload
} from './sheetsClient';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
export type SyncStatusListener = (
  status: SyncStatus,
  lastSyncedAt: number | null,
  errorMessage?: string
) => void;

/**
 * Thuật toán Hợp Nhất Thành Tích Cực Đại (Union-Max Sync Algorithm)
 * Đảm bảo trẻ em không bao giờ bị mất thành quả học tập khi chơi trên nhiều thiết bị
 */
export function mergeStates(local: SaveState, remote: SaveState): SaveState {
  const xp = Math.max(local.xp || 0, remote.xp || 0);
  const coins = Math.max(local.coins || 0, remote.coins || 0);
  const bridge = Math.min(BRIDGE_PARTS, Math.max(local.bridge || 0, remote.bridge || 0));
  const questAccepted = Boolean(local.questAccepted || remote.questAccepted || bridge > 0);
  const questComplete = Boolean(local.questComplete || remote.questComplete || bridge >= BRIDGE_PARTS);
  const combo = Math.max(local.combo || 0, remote.combo || 0);
  const started = Boolean(local.started || remote.started);
  const avatar = local.avatar || remote.avatar || 'boy';
  const table = local.table !== undefined ? local.table : (remote.table || 0);
  const sound = local.sound !== undefined ? local.sound : (remote.sound !== undefined ? remote.sound : true);
  const music = local.music !== undefined ? local.music : (remote.music !== undefined ? remote.music : false);

  // Phép hợp từng phần tử hoa tri thức (10 đóa hoa)
  const flowers = Array.from({ length: 10 }, (_, i) =>
    Boolean(local.flowers?.[i] || remote.flowers?.[i])
  );

  // Phép hợp bia đá Archimedes (tối thiểu 40)
  const maxMonoliths = Math.max(40, local.monoliths?.length || 0, remote.monoliths?.length || 0);
  const monoliths = Array.from({ length: maxMonoliths }, (_, i) =>
    Boolean(local.monoliths?.[i] || remote.monoliths?.[i])
  );

  // Phép hợp huy chương vùng đất (tối thiểu 5)
  const maxBadges = Math.max(5, local.zoneBadges?.length || 0, remote.zoneBadges?.length || 0);
  const zoneBadges = Array.from({ length: maxBadges }, (_, i) =>
    Boolean(local.zoneBadges?.[i] || remote.zoneBadges?.[i])
  );

  // Phép hợp cây công viên (20 cây)
  const parkTrees = Array.from({ length: 20 }, (_, i) =>
    Boolean(local.parkTrees?.[i] || remote.parkTrees?.[i])
  );

  // Gộp dictionary bài toán đã giải
  const solvedProblems: Record<string, boolean> = {
    ...(local.solvedProblems || {}),
    ...(remote.solvedProblems || {})
  };

  flowers.forEach((done, i) => {
    if (done) {
      solvedProblems[`flower_${i + 1}`] = true;
      solvedProblems[String(i + 1)] = true;
    }
  });

  monoliths.forEach((done, i) => {
    if (done) {
      solvedProblems[String(306 + i)] = true;
    }
  });

  for (const [k, val] of Object.entries(solvedProblems)) {
    if (val === true) {
      const num = Number(k);
      if (!isNaN(num) && num >= 306) {
        const mIdx = num - 306;
        if (mIdx >= 0) {
          while (monoliths.length <= mIdx) {
            monoliths.push(false);
          }
          monoliths[mIdx] = true;
        }
      }
    }
  }

  for (let i = 0; i < 10; i++) {
    if (solvedProblems[`flower_${i + 1}`] || solvedProblems[String(i + 1)]) {
      flowers[i] = true;
    }
  }

  parkTrees.forEach((done, i) => {
    if (done) {
      solvedProblems[`park_tree_${i + 1}`] = true;
      solvedProblems[`tree_${i + 1}`] = true;
    }
  });

  for (let i = 0; i < 20; i++) {
    if (solvedProblems[`park_tree_${i + 1}`] || solvedProblems[`tree_${i + 1}`]) {
      parkTrees[i] = true;
    }
  }

  // Hợp nhất lịch sử làm bài (QuestionStats)
  const questionStats: Record<string, QuestionStat> = {};
  const allStatKeys = new Set([
    ...Object.keys(local.questionStats || {}),
    ...Object.keys(remote.questionStats || {})
  ]);

  for (const key of allStatKeys) {
    const l = local.questionStats?.[key];
    const r = remote.questionStats?.[key];
    if (l && r) {
      const correct = Math.max(l.correct, r.correct);
      const wrong = Math.max(l.wrong, r.wrong);
      const attempts = Math.max(l.attempts, r.attempts, correct + wrong);
      const lastAnsweredAt = (l.lastAnsweredAt && (!r.lastAnsweredAt || l.lastAnsweredAt > r.lastAnsweredAt))
        ? l.lastAnsweredAt
        : (r.lastAnsweredAt || '');
      const responseTime = Math.min(
        l.responseTime > 0 ? l.responseTime : Infinity,
        r.responseTime > 0 ? r.responseTime : Infinity
      );
      questionStats[key] = {
        attempts,
        correct,
        wrong,
        lastAnsweredAt,
        responseTime: responseTime === Infinity ? 0 : responseTime
      };
    } else if (l) {
      questionStats[key] = { ...l };
    } else if (r) {
      questionStats[key] = { ...r };
    }
  }

  const review = [...new Set([...(local.review || []), ...(remote.review || [])])].slice(0, 100);
  const position = local.position || remote.position;

  return {
    version: 1,
    xp,
    coins,
    bridge,
    questAccepted,
    questComplete,
    combo,
    started,
    avatar,
    table,
    sound,
    music,
    flowers,
    monoliths,
    zoneBadges,
    parkTrees,
    solvedProblems,
    questionStats,
    review,
    position
  };
}

export interface SyncManagerOptions {
  debounceMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  enableAutoSync?: boolean;
  saveFn?: (payload: SavePlayerProgressPayload) => Promise<{
    success: boolean;
    message: string;
    passcode?: string;
    lastActiveAt?: string;
  }>;
  loadFn?: (identifier: string) => Promise<{
    success: boolean;
    player?: RemotePlayerProgress;
    message?: string;
  }>;
  getMonolithCount?: (state: SaveState) => number;
}

/**
 * Quản lý Hàng đợi Đồng bộ có Độ trễ (Throttled Sync Queue)
 * Bảo vệ hạ tầng Google Apps Script khỏi bị quá tải, tự động thử lại khi mất mạng
 */
export class SyncManager {
  private status: SyncStatus = 'idle';
  private lastSyncedAt: number | null = null;
  private lastErrorMessage: string = '';
  private debounceTimer: any = null;
  private retryTimer: any = null;
  private retryCount = 0;
  private isSyncing = false;
  private syncPendingAgain = false;
  private listeners = new Set<SyncStatusListener>();

  private debounceMs: number;
  private maxRetries: number;
  private baseRetryDelayMs: number;
  private enableAutoSync: boolean;
  private saveFn: (payload: SavePlayerProgressPayload) => Promise<{
    success: boolean;
    message: string;
    passcode?: string;
    lastActiveAt?: string;
  }>;
  private loadFn: (identifier: string) => Promise<{
    success: boolean;
    player?: RemotePlayerProgress;
    message?: string;
  }>;

  constructor(
    private adventure: Adventure,
    private profileMgr: ExplorerProfileManager = profileManager,
    options: SyncManagerOptions = {}
  ) {
    this.debounceMs = options.debounceMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 5000;
    this.enableAutoSync = options.enableAutoSync ?? true;
    this.saveFn = options.saveFn ?? savePlayerProgressToSheets;
    this.loadFn = options.loadFn ?? loadPlayerProgressFromSheets;
    this.getMonolithCount = options.getMonolithCount;
  }

  private getMonolithCount?: (state: SaveState) => number;

  getStatus(): SyncStatus {
    return this.status;
  }

  getLastSyncedAt(): number | null {
    return this.lastSyncedAt;
  }

  getLastErrorMessage(): string {
    return this.lastErrorMessage;
  }

  onStatusChange(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    // Gọi ngay lập tức với trạng thái hiện tại
    listener(this.status, this.lastSyncedAt, this.lastErrorMessage);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus, errorMessage = '') {
    this.status = status;
    this.lastErrorMessage = errorMessage;
    for (const listener of this.listeners) {
      try {
        listener(this.status, this.lastSyncedAt, this.lastErrorMessage);
      } catch (_) {}
    }
  }

  /**
   * Đưa tiến trình vào hàng đợi đồng bộ
   * @param isMilestone Nếu là mốc quan trọng (hoàn thành cầu, hoa nở hết, v.v.), đẩy ngay lập tức không chờ debounce
   */
  queueSync(isMilestone = false): void {
    if (!this.enableAutoSync) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (isMilestone) {
      void this.flushNow();
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flushNow();
    }, this.debounceMs);
    if (this.debounceTimer && typeof this.debounceTimer.unref === 'function') {
      this.debounceTimer.unref();
    }
  }

  /**
   * Đẩy dữ liệu lên Google Sheets ngay lập tức
   */
  async flushNow(): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.isSyncing) {
      this.syncPendingAgain = true;
      return false;
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      const profile = this.profileMgr.getProfile();
      const state = this.adventure.getState();

      const payload: SavePlayerProgressPayload = {
        action: 'savePlayerProgress',
        explorerId: profile.explorerId || '',
        passcode: profile.passcode || '',
        nickname: profile.nickname || 'Dũng Sĩ Tí Hon',
        className: profile.className || 'Lớp 2',
        avatar: profile.avatar || state.avatar || 'boy',
        level: getLevel(state.xp),
        totalXP: state.xp,
        totalCoins: state.coins,
        bridgeParts: state.bridge,
        flowersBloomed: state.flowers.filter(Boolean).length,
        monolithsActivated: this.getMonolithCount
          ? this.getMonolithCount(state)
          : Math.max(
              state.monoliths.filter(Boolean).length,
              Object.keys(state.solvedProblems || {}).filter(
                (k) => state.solvedProblems[k] && !isNaN(Number(k)) && Number(k) >= 306
              ).length
            ),
        treesAwakened: (state.parkTrees || []).filter(Boolean).length,
        saveData: state
      };

      const result = await this.saveFn(payload);

      if (result.success) {
        this.lastSyncedAt = Date.now();
        this.retryCount = 0;
        this.setStatus('synced');
        return true;
      } else {
        const isOffline = /mất kết nối|offline|network|timeout/i.test(result.message || '');
        this.setStatus(isOffline ? 'offline' : 'error', result.message);
        this.scheduleRetry();
        return false;
      }
    } catch (err: any) {
      const msg = err?.message || 'Lỗi mạng khi đồng bộ';
      const isOffline = /mất kết nối|offline|network|timeout/i.test(msg);
      this.setStatus(isOffline ? 'offline' : 'error', msg);
      this.scheduleRetry();
      return false;
    } finally {
      this.isSyncing = false;
      if (this.syncPendingAgain) {
        this.syncPendingAgain = false;
        void this.flushNow();
      }
    }
  }

  /**
   * Tải dữ liệu đám mây về và hòa giải bằng thuật toán Union-Max
   */
  async pullAndMerge(): Promise<boolean> {
    const profile = this.profileMgr.getProfile();
    const code = profile.passcode || profile.explorerId;
    if (!code) return false;

    this.setStatus('syncing');

    try {
      const res = await this.loadFn(code);
      if (res.success && res.player && res.player.saveData) {
        const remoteState = sanitizeSaveState(res.player.saveData);
        const localState = this.adventure.getState();
        const merged = mergeStates(localState, remoteState);

        this.adventure.restoreState(merged);
        this.lastSyncedAt = Date.now();
        this.setStatus('synced');
        return true;
      } else {
        this.setStatus('idle');
        return false;
      }
    } catch (err: any) {
      this.setStatus('offline', err?.message || 'Không thể tải dữ liệu đám mây');
      return false;
    }
  }

  private scheduleRetry(): void {
    if (this.retryCount >= this.maxRetries) return;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    const delay = Math.min(60000, this.baseRetryDelayMs * Math.pow(2, this.retryCount));
    this.retryCount++;

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flushNow();
    }, delay);
    if (this.retryTimer && typeof this.retryTimer.unref === 'function') {
      this.retryTimer.unref();
    }
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.listeners.clear();
  }
}

/**
 * Định dạng thời gian trôi qua thân thiện cho học sinh và giáo viên
 */
export function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'Chưa đồng bộ';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 10) return 'Vừa xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return new Date(timestamp).toLocaleDateString('vi-VN');
}

/**
 * Chuyển đổi mã trạng thái sang mô tả trực quan kèm biểu tượng
 */
export function getSyncStatusLabel(
  status: SyncStatus,
  lastSyncedAt: number | null,
  errorMessage?: string
): string {
  switch (status) {
    case 'synced':
      return '☁️ Đã lưu lên đám mây';
    case 'syncing':
      return '🔄 Đang đồng bộ...';
    case 'offline':
      return '⚡ Offline (Chờ mạng)';
    case 'error':
      return `⚠️ Lỗi kết nối (${errorMessage || 'Thử lại'})`;
    case 'idle':
    default:
      return '☁️ Sẵn sàng đồng bộ';
  }
}

/**
 * Kiểm tra xem người chơi đã có dữ liệu học tập trên máy chưa
 */
export function hasLocalProgress(state: SaveState): boolean {
  if (!state) return false;
  return Boolean(
    (state.xp && state.xp > 0) ||
    (state.coins && state.coins > 0) ||
    (state.bridge && state.bridge > 0) ||
    state.started ||
    (state.flowers && state.flowers.some(Boolean)) ||
    (state.monoliths && state.monoliths.some(Boolean)) ||
    (state.parkTrees && state.parkTrees.some(Boolean)) ||
    (state.zoneBadges && state.zoneBadges.some(Boolean)) ||
    (state.solvedProblems && Object.keys(state.solvedProblems).length > 0) ||
    (state.questionStats && Object.keys(state.questionStats).length > 0)
  );
}

export const MIGRATION_KEY = 'aigame3d_cloud_migrated_v1';

export interface MigrationResult {
  migrated: boolean;
  reason: 'already_migrated' | 'no_local_progress' | 'uploaded' | 'upload_failed';
  passcode: string;
  message?: string;
}

/**
 * Tự động di chuyển (migration) dữ liệu từ trình duyệt (localStorage) lên Google Sheets
 * Đảm bảo những người chơi trước bản cập nhật không bị thất lạc tiến trình
 */
export async function runLocalStorageMigration(
  adventure: Adventure,
  profileMgr: ExplorerProfileManager = profileManager,
  syncManager: SyncManager,
  storage: StorageLike = defaultStorage,
  onNotify?: (msg: string) => void
): Promise<MigrationResult> {
  const profile = profileMgr.getProfile();
  const alreadyMigrated = storage.getItem(MIGRATION_KEY);
  if (alreadyMigrated) {
    return {
      migrated: false,
      reason: 'already_migrated',
      passcode: profile.passcode || ''
    };
  }

  const state = adventure.getState();
  const hasProgress = hasLocalProgress(state);

  if (!hasProgress) {
    storage.setItem(MIGRATION_KEY, new Date().toISOString());
    return {
      migrated: false,
      reason: 'no_local_progress',
      passcode: profile.passcode || ''
    };
  }

  try {
    const success = await syncManager.flushNow();
    if (success) {
      storage.setItem(MIGRATION_KEY, new Date().toISOString());
      if (onNotify) {
        onNotify(`☁️ Đã sao lưu dữ liệu của bé lên đám mây (Mã: ${profile.passcode})`);
      }
      return {
        migrated: true,
        reason: 'uploaded',
        passcode: profile.passcode || ''
      };
    } else {
      return {
        migrated: false,
        reason: 'upload_failed',
        passcode: profile.passcode || '',
        message: syncManager.getLastErrorMessage()
      };
    }
  } catch (err: any) {
    return {
      migrated: false,
      reason: 'upload_failed',
      passcode: profile.passcode || '',
      message: err?.message || 'Lỗi mạng khi di chuyển dữ liệu'
    };
  }
}

