import { ARCHIMEDES_ZONES } from '../data/archimedesTrialMap';
import seedData from '../data/seedData.json';
import {
  computeProceduralEntityPositions,
  computeArchipelagoOrbitalPosition,
  type RemoteZoneConfig,
  type RemoteProblem,
  type ExplorerProfile,
  type RemotePlayerProgress,
  type SavePlayerProgressPayload
} from '../data/remoteTypes';
import { usesLakeTerrain, isValidLakePosition } from '../data/lakeLand';
import { resolveImageUrl, extractMarkdownImage } from './imageResolver';
import {
  EXPLORER_PROFILE_KEY,
  getExplorerProfile,
  saveExplorerProfile,
  profileManager,
  ExplorerProfileManager
} from './profile';

export {
  EXPLORER_PROFILE_KEY,
  getExplorerProfile,
  saveExplorerProfile,
  profileManager,
  ExplorerProfileManager
};
export type {
  RemoteZoneConfig,
  RemoteProblem,
  ExplorerProfile,
  RemotePlayerProgress,
  SavePlayerProgressPayload
};

export const APPS_SCRIPT_URL_KEY = 'aigame3d_apps_script_url';
export const REMOTE_CACHE_KEY = 'aigame3d_remote_data_cache';
export const REMOTE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 phút

export interface CachedRemotePayload {
  timestamp: number;
  data: {
    zones: RemoteZoneConfig[];
    questionsBySheet: Record<string, RemoteProblem[]>;
  };
}

// Mock storage cho môi trường Node.js testing và safe wrapper cho localStorage
const memoryStore = new Map<string, string>();
export const safeStorage = {
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

/**
 * Đọc dữ liệu cache và kiểm tra hạn sử dụng 30 phút
 */
export function getCachedRemoteData(): {
  data: { zones: RemoteZoneConfig[]; questionsBySheet: Record<string, RemoteProblem[]> } | null;
  isExpired: boolean;
  cachedAt: number;
} {
  try {
    const raw = safeStorage.getItem(REMOTE_CACHE_KEY);
    if (!raw) return { data: null, isExpired: true, cachedAt: 0 };
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object') {
      // Định dạng mới: { timestamp: number, data: { zones, questionsBySheet } }
      if (typeof parsed.timestamp === 'number' && parsed.data && Array.isArray(parsed.data.zones)) {
        const isExpired = Date.now() - parsed.timestamp >= REMOTE_CACHE_TTL_MS;
        return { data: parsed.data, isExpired, cachedAt: parsed.timestamp };
      }
      // Tương thích ngược: Định dạng cũ { zones, questionsBySheet } không có timestamp
      if (Array.isArray(parsed.zones)) {
        return { data: parsed, isExpired: true, cachedAt: 0 };
      }
    }
  } catch (_) {}
  return { data: null, isExpired: true, cachedAt: 0 };
}

/**
 * Lưu dữ liệu tải từ Google Sheets vào cache với timestamp hiện tại
 */
export function saveRemoteDataToCache(data: {
  zones: RemoteZoneConfig[];
  questionsBySheet: Record<string, RemoteProblem[]>;
}): void {
  try {
    const payload: CachedRemotePayload = {
      timestamp: Date.now(),
      data
    };
    safeStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby1BaZUX9yfq1aW543kiSBnSP7-LP0AGQJkHUGF44hf5HB73p6WCAdNTvv13vSh0hvf/exec';

/**
 * Lấy cấu hình URL Apps Script (ưu tiên biến môi trường VITE_APPS_SCRIPT_URL, fallback sang DEFAULT_APPS_SCRIPT_URL)
 * Không cho phép thay đổi từ giao diện người dùng.
 */
export function getAppsScriptUrl(): string {
  try {
    const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_APPS_SCRIPT_URL) ||
      (typeof globalThis !== 'undefined' && (globalThis as any)?.process?.env?.VITE_APPS_SCRIPT_URL);
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim();
  } catch (_) {}
  return DEFAULT_APPS_SCRIPT_URL;
}

/**
 * Sinh bộ dữ liệu mặc định (Bundled Fallback) từ mã nguồn hiện tại
 */
export function getBundledFallbackData(): {
  zones: RemoteZoneConfig[];
  questionsBySheet: Record<string, RemoteProblem[]>;
} {
  const defaultZones: RemoteZoneConfig[] = [
    ...ARCHIMEDES_ZONES.map((z) => ({
      id: z.id,
      name: z.name,
      title: z.title,
      description: z.description,
      template: (z.id === 3 || z.id === 5 ? 'CIRCLE_SANCTUARY' : 'GRID_SANCTUARY') as any,
      theme: (z.id === 2 || z.id === 4 ? 'FOREST' : (z.id === 3 ? 'CRYSTAL' : 'RUINS')) as any,
      decorDensity: (z.id === 2 || z.id === 4 ? 'HIGH' : 'MEDIUM') as any,
      sheetName: `Zone_${z.id}_Archimedes`,
      center: { ...z.center },
      width: z.id === 4 ? 28 : (z.id === 5 ? 22 : 24),
      depth: z.id === 4 ? 34 : (z.id === 5 ? 24 : 32),
      color: z.color,
      colorHex: `#${z.color.toString(16).padStart(6, '0')}`,
      badge: z.badge
    })),
    {
      id: 6,
      name: 'Vườn Hoa Tri Thức',
      title: 'Vườn Hoa Rực Rỡ',
      description: 'Đánh thức 10 đóa hoa tri thức bằng các bài toán ứng dụng',
      template: 'FLOWER_BEDS',
      theme: 'GARDEN',
      decorDensity: 'HIGH',
      sheetName: 'VuonHoa',
      center: { x: 22, z: 0 },
      width: 26,
      depth: 20,
      color: 0xec4899,
      colorHex: '#ec4899',
      badge: '🌸 Tinh Thể Vườn Hoa'
    }
  ];

  return { zones: defaultZones, questionsBySheet: {} };
}

/**
 * Bộ Lọc Phục Hồi Dữ Liệu (Resilient Data Sanitizer)
 * Tự động chuẩn hóa câu hỏi, sửa lỗi khoảng trắng và bù đắp các trường còn thiếu
 */
export function sanitizeRemoteProblems(rawList: any[]): RemoteProblem[] {
  if (!Array.isArray(rawList)) return [];
  const validProblems: RemoteProblem[] = [];

  rawList.forEach((raw) => {
    if (!raw || (!raw.id && raw.id !== 0)) return;

    const id = raw.id;
    const title = String(raw.title || `Bài ${id}`).trim();
    const subtitle = String(raw.subtitle || '').trim();
    const pos = (raw.position && typeof raw.position.x === 'number' && typeof raw.position.z === 'number')
      ? { x: Number(raw.position.x), z: Number(raw.position.z) }
      : null;

    const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
    const validSteps = rawSteps
      .map((s: any, sIdx: number) => {
        if (!s) return null;
        let prompt = String(s.prompt || '').trim();
        let answer = String(s.answer || '').trim();
        if (!prompt && !answer) return null; // Bỏ qua step hoàn toàn rỗng

        // Tự động khôi phục nếu ô bị lỗi công thức #ERROR! từ Google Sheets (do chứa dấu = hoặc so sánh)
        const isFormulaError = (val: string) => /^#(ERROR|NAME|VALUE|REF|N\/A)!?$/i.test(val);
        if (isFormulaError(answer)) {
          answer = '=';
        }

        // Chuẩn hóa options
        let options: { label: string; value: string }[] = [];
        if (Array.isArray(s.options)) {
          options = s.options
            .map((opt: any) => {
              let val = typeof opt === 'object' ? String(opt.value || opt.label || '') : String(opt);
              val = val.trim();
              if (isFormulaError(val)) {
                val = '=';
              }
              return { label: val, value: val };
            })
            .filter((opt: { label: string; value: string }) => opt.value.length > 0);

          // Loại bỏ trùng lặp nếu có nhiều ô lỗi được khôi phục
          const seenVals = new Set<string>();
          options = options.filter((opt) => {
            if (seenVals.has(opt.value)) return false;
            seenVals.add(opt.value);
            return true;
          });
        }

        // Nếu options chưa chứa answer đúng, tự động thêm vào
        if (answer && !options.some((o: { label: string; value: string }) => o.value === answer)) {
          options.unshift({ label: answer, value: answer });
        }

        // Chuẩn hóa hints
        let hints: string[] = [];
        if (Array.isArray(s.hints)) {
          hints = s.hints.map((h: any) => String(h).trim()).filter((h: string) => h.length > 0);
        } else if (typeof s.hints === 'string') {
          hints = s.hints.split(/[|;]/).map((h: string) => h.trim()).filter((h: string) => h.length > 0);
        }

        // Xử lý ImageUrl và Prompt (hỗ trợ cả cột ImageUrl và cú pháp Markdown ![alt](url))
        let imageUrl = resolveImageUrl(s.imageUrl);
        if (!imageUrl && prompt) {
          const extractedPrompt = extractMarkdownImage(prompt);
          prompt = extractedPrompt.cleanText;
          if (extractedPrompt.imageUrl) {
            imageUrl = extractedPrompt.imageUrl;
          }
        }

        // Xử lý ExplanationImageUrl và Explanation (hỗ trợ cả cột ExplanationImageUrl và Markdown)
        let explanation = String(s.explanation || '').trim();
        let explanationImageUrl = resolveImageUrl(s.explanationImageUrl);
        if (!explanationImageUrl && explanation) {
          const extractedExpl = extractMarkdownImage(explanation);
          explanation = extractedExpl.cleanText;
          if (extractedExpl.imageUrl) {
            explanationImageUrl = extractedExpl.imageUrl;
          }
        }

        return {
          stepId: String(s.stepId || `${id}_${sIdx + 1}`).trim(),
          prompt: prompt || 'Giải bài toán sau:',
          imageUrl,
          options,
          answer: answer || (options[0]?.value ?? ''),
          hints,
          explanation,
          explanationImageUrl,
          diagramSvg: s.diagramSvg ? String(s.diagramSvg) : undefined
        };
      })
      .filter((s: any): s is NonNullable<typeof s> => s !== null);

    if (validSteps.length > 0) {
      validProblems.push({
        id,
        zoneId: raw.zoneId ? Number(raw.zoneId) : undefined,
        zoneName: raw.zoneName ? String(raw.zoneName) : undefined,
        title,
        subtitle,
        position: pos,
        color: raw.color ? Number(raw.color) : undefined,
        badge: raw.badge ? String(raw.badge) : undefined,
        steps: validSteps
      });
    }
  });

  return validProblems;
}

/**
 * Nạp dữ liệu với cơ chế Cache 30 phút và Stale-While-Revalidate:
 * 1. Nếu cache còn hạn (< 30 phút): Trả về ngay lập tức dữ liệu cache, KHÔNG gọi mạng.
 * 2. Nếu cache đã quá 30 phút (hoặc chưa có cache):
 *    - Trả về ngay lập tức dữ liệu cache có sẵn (hoặc bundled fallback) để không chặn trải nghiệm người dùng
 *    - Ngầm fetch từ Apps Script, cập nhật cache và gọi callback `onFreshData` khi có dữ liệu mới
 */
export async function loadZonesAndQuestions(
  onFreshData?: (data: { zones: RemoteZoneConfig[]; questionsBySheet: Record<string, RemoteProblem[]> }) => void
): Promise<{ zones: RemoteZoneConfig[]; questionsBySheet: Record<string, RemoteProblem[]> }> {
  // 1. Kiểm tra cache
  const { data: cachedData, isExpired } = getCachedRemoteData();
  const scriptUrl = getAppsScriptUrl();

  const hasCachedData = cachedData && Array.isArray(cachedData.zones) && cachedData.zones.length > 0;

  // Nếu cache còn hiệu lực (< 30 phút) và đã có dữ liệu:
  if (!isExpired && hasCachedData) {
    return cachedData!;
  }

  // Nếu có cache nhưng đã hết hạn: trả về cache trước, ngầm fetch cập nhật mới (Stale-While-Revalidate)
  if (hasCachedData) {
    if (scriptUrl) {
      fetchRemoteData(scriptUrl)
        .then((fresh) => {
          if (fresh && onFreshData) {
            onFreshData(fresh);
          }
        })
        .catch((err) => {
          console.warn('Apps Script background sync bypassed:', err.message);
        });
    }
    return cachedData!;
  }

  // 2. Chưa có cache câu hỏi (lần đầu vào game): nạp từ Apps Script
  if (scriptUrl) {
    try {
      const fresh = await fetchRemoteData(scriptUrl);
      if (fresh) {
        if (onFreshData) onFreshData(fresh);
        return fresh;
      }
    } catch (err: any) {
      console.warn('Lần đầu nạp dữ liệu từ Apps Script thất bại:', err?.message);
    }
  }

  return getBundledFallbackData();
}

/**
 * Chuẩn hóa danh sách cấu hình phân khu / vùng đất
 */
export function sanitizeRemoteZones(rawList: any[]): RemoteZoneConfig[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((z: any, idx: number) => {
    let cx = Number(z.center?.x ?? z.CenterX) || 0;
    let cz = Number(z.center?.z ?? z.CenterZ) || 0;
    // Nếu để trống tọa độ hoặc là (0, 0), tự động xếp theo quỹ đạo vòng cung quanh biển
    if (cx === 0 && cz === 0) {
      const orb = computeArchipelagoOrbitalPosition(idx, rawList.length);
      cx = orb.x;
      cz = orb.z;
    }

    const rawTheme = String(z.theme || z.Theme || '').toUpperCase();
    const validTheme = ['GARDEN', 'RUINS', 'FOREST', 'CRYSTAL', 'VILLAGE'].includes(rawTheme)
      ? (rawTheme as any)
      : (z.template === 'FLOWER_BEDS' ? 'GARDEN' : 'RUINS');

    const rawDensity = String(z.decorDensity || z.DecorDensity || '').toUpperCase();
    const validDensity = ['LOW', 'MEDIUM', 'HIGH'].includes(rawDensity)
      ? (rawDensity as any)
      : 'MEDIUM';

    return {
      id: Number(z.id ?? z.ZoneId) || idx + 1,
      name: String(z.name || z.ZoneName || 'Vùng Đất Mới').trim(),
      title: String(z.title || z.Title || '').trim(),
      description: String(z.description || z.Description || '').trim(),
      template: (['FLOWER_BEDS', 'CIRCLE_SANCTUARY', 'GRID_SANCTUARY', 'PARK_SANCTUARY'].includes(z.template)
        ? z.template
        : 'GRID_SANCTUARY') as any,
      theme: validTheme,
      decorDensity: validDensity,
      sheetName: String(z.sheetName || z.SheetName || '').trim(),
      center: { x: cx, z: cz },
      width: Number(z.width ?? z.Width) || 24,
      depth: Number(z.depth ?? z.Depth) || 32,
      color: Number(z.color) || 0x38bdf8,
      colorHex: String(z.colorHex || z.ColorHex || '#38bdf8'),
      badge: String(z.badge || z.Badge || '🏆 Huy Chương Thám Hiểm')
    };
  });
}

/**
 * Gọi API trực tiếp từ Google Apps Script
 */
export async function fetchRemoteData(scriptUrl: string): Promise<{
  zones: RemoteZoneConfig[];
  questionsBySheet: Record<string, RemoteProblem[]>;
} | null> {
  const url = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=getAll&_t=${Date.now()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Lỗi kết nối máy chủ Google Sheets (${response.status} ${response.statusText})`);
  }

  const json = await response.json();
  if (json.status !== 'success' || !Array.isArray(json.zones)) {
    throw new Error(json.message || 'Cấu trúc dữ liệu Apps Script không hợp lệ');
  }

  const sanitizedZones: RemoteZoneConfig[] = sanitizeRemoteZones(json.zones);

  const sanitizedQuestions: Record<string, RemoteProblem[]> = {};
  if (json.questions && typeof json.questions === 'object') {
    Object.keys(json.questions).forEach((sheetKey) => {
      sanitizedQuestions[sheetKey] = sanitizeRemoteProblems(json.questions[sheetKey]);
    });
  }

  const finalPayload = { zones: sanitizedZones, questionsBySheet: sanitizedQuestions };
  saveRemoteDataToCache(finalPayload);

  return finalPayload;
}

/**
 * Ghi nhận tiến trình học sinh lên tab LOGS trên Google Sheets
 */
export async function logRemoteProgress(record: {
  zoneId: number | string;
  problemId: number | string;
  stepId?: string;
  isCorrect: boolean;
  score?: number;
  details?: any;
}): Promise<void> {
  const scriptUrl = getAppsScriptUrl();
  if (!scriptUrl) return; // Không cấu hình Sheets URL thì bỏ qua âm thầm

  const payload = profileManager.formatTelemetryPayload(record);

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Tránh preflight OPTIONS với Apps Script
      body: JSON.stringify(payload),
      mode: 'no-cors'
    });
  } catch (err) {
    console.warn('Gửi nhật ký tiến trình lên Sheets thất bại:', err);
  }
}

/**
 * Chuẩn bị danh sách bài toán hoàn chỉnh cho một vùng đất (áp dụng Procedural Layout)
 */
export function resolveZoneProblemsWithPositions(
  zone: RemoteZoneConfig,
  problems: RemoteProblem[]
): RemoteProblem[] {
  const proceduralCoords = computeProceduralEntityPositions(
    zone.template,
    problems.length,
    zone.center,
    zone.width,
    zone.depth
  );

  const isLake = usesLakeTerrain(zone.template);

  return problems.map((prob, idx) => {
    // Nếu có tọa độ tùy chỉnh PosX/PosZ thì ưu tiên, nhưng nếu là đảo hồ mà tọa độ cũ rơi vào mặt nước thì nắn về vành bờ
    let finalPos = prob.position;
    if (finalPos && isLake && !isValidLakePosition(zone.center, finalPos)) {
      finalPos = null;
    }
    finalPos = finalPos || proceduralCoords[idx] || { x: zone.center.x, z: zone.center.z };

    return {
      ...prob,
      zoneId: zone.id,
      zoneName: zone.name,
      color: prob.color || zone.color,
      badge: prob.badge || zone.badge,
      position: finalPos
    };
  });
}

/**
 * Gửi toàn bộ 50 câu hỏi mặc định lên Google Sheets qua Apps Script API
 */
export async function seedRemoteDatabase(customUrl?: string): Promise<{ success: boolean; message: string }> {
  const url = (customUrl || getAppsScriptUrl()).trim();
  if (!url) {
    throw new Error('Chưa cấu hình URL Google Apps Script');
  }

  const payload = {
    action: 'seedDatabase',
    zones: seedData.zones,
    questionsBySheet: seedData.questionsBySheet
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}`);
  }

  const result = await response.json();
  if (result.status === 'success') {
    // Cập nhật lại cache cục bộ với dữ liệu vừa seed
    try {
      saveRemoteDataToCache(seedData as any);
    } catch (_) {}
    return { success: true, message: result.message || 'Khởi tạo thành công!' };
  } else {
    throw new Error(result.message || 'Lỗi từ Apps Script khi seed database');
  }
}

/**
 * Lưu tiến trình học sinh lên tab PLAYERS trên Google Sheets (Bảo vệ đồng bộ nền)
 */
export async function savePlayerProgressToSheets(
  payload: SavePlayerProgressPayload,
  customUrl?: string
): Promise<{ success: boolean; message: string; passcode?: string; lastActiveAt?: string }> {
  const scriptUrl = (customUrl || getAppsScriptUrl()).trim();
  if (!scriptUrl) {
    return { success: false, message: 'Chưa cấu hình URL Google Apps Script' };
  }

  if (!payload.explorerId && !payload.passcode) {
    return { success: false, message: 'Cần explorerId hoặc passcode để lưu tiến trình' };
  }

  const bodyData: SavePlayerProgressPayload = {
    ...payload,
    action: 'savePlayerProgress'
  };

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      return { success: false, message: `HTTP Error ${response.status}` };
    }

    const result = await response.json();
    if (result.status === 'success') {
      return {
        success: true,
        message: result.message || 'Đã lưu tiến trình thành công',
        passcode: result.passcode,
        lastActiveAt: result.lastActiveAt
      };
    } else {
      return {
        success: false,
        message: result.message || 'Lỗi khi lưu dữ liệu lên Apps Script'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Không thể kết nối đến máy chủ Google Sheets'
    };
  }
}

/**
 * Tải tiến trình học sinh từ tab PLAYERS theo Mã Thám Hiểm hoặc ExplorerId
 */
export async function loadPlayerProgressFromSheets(
  identifier: string,
  customUrl?: string
): Promise<{ success: boolean; player?: RemotePlayerProgress; message?: string }> {
  const cleanId = (identifier || '').trim().toUpperCase();
  if (!cleanId) {
    return { success: false, message: 'Mã Thám Hiểm hoặc ExplorerId không hợp lệ' };
  }

  const scriptUrl = (customUrl || getAppsScriptUrl()).trim();
  if (!scriptUrl) {
    return { success: false, message: 'Chưa cấu hình URL Google Apps Script' };
  }

  try {
    const url = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=loadPlayerProgress&identifier=${encodeURIComponent(cleanId)}&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      return { success: false, message: `Lỗi kết nối máy chủ (${response.status})` };
    }

    const data = await response.json();
    if (data.status === 'success' && data.player) {
      return { success: true, player: data.player, message: data.message };
    } else if (data.status === 'not_found') {
      return { success: false, message: data.message || 'Không tìm thấy dữ liệu học sinh' };
    } else {
      return { success: false, message: data.message || 'Lỗi xử lý dữ liệu từ Apps Script' };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Không thể kết nối đến máy chủ Google Sheets' };
  }
}

