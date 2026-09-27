import { ARCHIMEDES_ZONES, ARCHIMEDES_MONOLITHS } from '../data/archimedesTrialMap';
import { FLOWER_QUESTIONS } from '../data/flowerQuestions';
import {
  computeProceduralEntityPositions,
  type RemoteZoneConfig,
  type RemoteProblem,
  type ExplorerProfile
} from '../data/remoteTypes';

export const APPS_SCRIPT_URL_KEY = 'aigame3d_apps_script_url';
export const EXPLORER_PROFILE_KEY = 'aigame3d_explorer_profile';
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
 * Lấy cấu hình URL Apps Script (ưu tiên localStorage, rồi .env, fallback sang DEFAULT_APPS_SCRIPT_URL)
 */
export function getAppsScriptUrl(): string {
  const saved = safeStorage.getItem(APPS_SCRIPT_URL_KEY);
  if (saved && saved.trim()) return saved.trim();
  try {
    const envUrl = (import.meta as any)?.env?.VITE_APPS_SCRIPT_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim();
  } catch (_) {}
  return DEFAULT_APPS_SCRIPT_URL;
}

/**
 * Lưu URL Apps Script tùy chỉnh từ người dùng/giáo viên
 */
export function setAppsScriptUrl(url: string): void {
  safeStorage.setItem(APPS_SCRIPT_URL_KEY, url.trim());
}

/**
 * Lấy hồ sơ dũng sĩ (biệt danh & lớp)
 */
export function getExplorerProfile(): ExplorerProfile {
  try {
    const raw = safeStorage.getItem(EXPLORER_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { nickname: 'Dũng Sĩ Tí Hon', className: 'Lớp 2', isAnonymous: true };
}

/**
 * Lưu hồ sơ dũng sĩ
 */
export function saveExplorerProfile(profile: ExplorerProfile): void {
  safeStorage.setItem(EXPLORER_PROFILE_KEY, JSON.stringify(profile));
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
      sheetName: 'VuonHoa',
      center: { x: 22, z: 0 },
      width: 26,
      depth: 20,
      color: 0xec4899,
      colorHex: '#ec4899',
      badge: '🌸 Tinh Thể Vườn Hoa'
    }
  ];

  const questionsBySheet: Record<string, RemoteProblem[]> = {};

  ARCHIMEDES_ZONES.forEach((z) => {
    const sheetName = `Zone_${z.id}_Archimedes`;
    const monoliths = ARCHIMEDES_MONOLITHS.filter((m) => m.zoneId === z.id);
    questionsBySheet[sheetName] = monoliths.map((m) => ({
      id: m.id,
      zoneId: m.zoneId,
      zoneName: m.zoneName,
      title: m.title,
      subtitle: m.subtitle,
      position: { ...m.position },
      color: m.color,
      badge: m.badge,
      steps: m.steps.map((s) => ({
        stepId: s.stepId,
        prompt: s.prompt,
        options: [...s.options],
        answer: s.answer,
        hints: [...s.hints],
        explanation: s.explanation,
        diagramSvg: s.diagramSvg
      }))
    }));
  });

  questionsBySheet['VuonHoa'] = FLOWER_QUESTIONS.map((fq) => ({
    id: fq.id,
    title: `Hoa Thử Thách #${fq.id}`,
    subtitle: fq.title,
    position: null, // Sẽ tự tính toán theo FLOWER_BEDS template
    color: fq.color,
    badge: fq.badge,
    steps: [
      {
        stepId: `flower_${fq.id}`,
        prompt: fq.question,
        options: fq.options.map((opt) => ({ label: opt.label, value: opt.value })),
        answer: fq.answer,
        hints: [...fq.hints],
        explanation: fq.explanation
      }
    ]
  }));

  return { zones: defaultZones, questionsBySheet };
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

        return {
          stepId: String(s.stepId || `${id}_${sIdx + 1}`).trim(),
          prompt: prompt || 'Giải bài toán sau:',
          options,
          answer: answer || (options[0]?.value ?? ''),
          hints,
          explanation: String(s.explanation || '').trim(),
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
  // 1. Kiểm tra cache và thời hạn 30 phút
  const { data: cachedData, isExpired } = getCachedRemoteData();
  const initialData = cachedData || getBundledFallbackData();

  // Nếu cache còn hiệu lực (< 30 phút) và đã có dữ liệu: hoàn toàn không gọi mạng
  if (!isExpired && cachedData) {
    return initialData;
  }

  // 2. Cache hết hạn (> 30 phút) hoặc chưa có cache: Ngầm kích hoạt fetch nếu có URL (Stale-While-Revalidate)
  const scriptUrl = getAppsScriptUrl();
  if (scriptUrl) {
    fetchRemoteData(scriptUrl)
      .then((fresh) => {
        if (fresh && onFreshData) {
          onFreshData(fresh);
        }
      })
      .catch((err) => {
        console.warn('Apps Script background sync bypassed, using cached/bundled data:', err.message);
      });
  }

  return initialData;
}

/**
 * Gọi API trực tiếp từ Google Apps Script
 */
export async function fetchRemoteData(scriptUrl: string): Promise<{
  zones: RemoteZoneConfig[];
  questionsBySheet: Record<string, RemoteProblem[]>;
} | null> {
  const url = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=getAll&_t=${Date.now()}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const json = await response.json();
  if (json.status !== 'success' || !Array.isArray(json.zones)) {
    throw new Error(json.message || 'Cấu trúc dữ liệu Apps Script không hợp lệ');
  }

  const sanitizedZones: RemoteZoneConfig[] = json.zones.map((z: any) => ({
    id: Number(z.id) || 1,
    name: String(z.name || 'Vùng Đất Mới').trim(),
    title: String(z.title || '').trim(),
    description: String(z.description || '').trim(),
    template: (['FLOWER_BEDS', 'CIRCLE_SANCTUARY', 'GRID_SANCTUARY'].includes(z.template)
      ? z.template
      : 'GRID_SANCTUARY') as any,
    sheetName: String(z.sheetName || '').trim(),
    center: {
      x: Number(z.center?.x) || 0,
      z: Number(z.center?.z) || 0
    },
    width: Number(z.width) || 24,
    depth: Number(z.depth) || 32,
    color: Number(z.color) || 0x38bdf8,
    colorHex: String(z.colorHex || '#38bdf8'),
    badge: String(z.badge || '🏆 Huy Chương Thám Hiểm')
  }));

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

  const profile = getExplorerProfile();
  const payload = {
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

  return problems.map((prob, idx) => {
    // Nếu có tọa độ tùy chỉnh PosX/PosZ thì ưu tiên, nếu không dùng tọa độ sinh tự động
    const finalPos = prob.position || proceduralCoords[idx] || { x: zone.center.x, z: zone.center.z };
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

  const bundle = getBundledFallbackData();
  const payload = {
    action: 'seedDatabase',
    zones: bundle.zones,
    questionsBySheet: bundle.questionsBySheet
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
    // Cập nhật lại cache cục bộ
    try {
      safeStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(bundle));
    } catch (_) {}
    return { success: true, message: result.message || 'Khởi tạo thành công!' };
  } else {
    throw new Error(result.message || 'Lỗi từ Apps Script khi seed database');
  }
}
