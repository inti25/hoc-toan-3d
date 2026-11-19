/**
 * Thuần logic điều khiển zoom camera (cuộn chuột & vuốt 2 ngón) và phân tách
 * cử chỉ xoay 1 ngón / tap / pinch đa chạm cho toàn bộ Vương Quốc.
 * Không phụ thuộc DOM hay Three.js để kiểm thử trực tiếp trên Node.
 */

export const CAMERA_ZOOM_LIMITS = {
  close: { minDist: 0.35, maxDist: 14 },
  isometric: { minDist: 23, maxDist: 60 }
} as const;

export interface CameraDistanceLimits {
  readonly minDist: number;
  readonly maxDist: number;
}

export function getCameraDistanceLimits(isCloseCam: boolean): CameraDistanceLimits {
  return isCloseCam ? CAMERA_ZOOM_LIMITS.close : CAMERA_ZOOM_LIMITS.isometric;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeWheelZoomDistance(
  currentDistance: number,
  deltaY: number,
  isCloseCam: boolean,
  isTrackpadPinch = false
): number {
  const { minDist, maxDist } = getCameraDistanceLimits(isCloseCam);
  const step = (isCloseCam ? 0.008 : 0.025) * (isTrackpadPinch ? 2.5 : 1);
  return clamp(currentDistance + deltaY * step, minDist, maxDist);
}

/**
 * Tính khoảng cách camera mới khi người chơi chụm/tách 2 ngón tay.
 * - Tách 2 ngón ra xa (`nextSpanPx > prevSpanPx`) => giảm distance (zoom in / phóng gần).
 * - Chụm 2 ngón lại gần (`nextSpanPx < prevSpanPx`) => tăng distance (zoom out / thu xa).
 */
export function computePinchZoomDistance(
  currentDistance: number,
  prevSpanPx: number,
  nextSpanPx: number,
  isCloseCam: boolean
): number {
  const { minDist, maxDist } = getCameraDistanceLimits(isCloseCam);
  const clampedCurrent = clamp(currentDistance, minDist, maxDist);
  if (
    !Number.isFinite(prevSpanPx) ||
    !Number.isFinite(nextSpanPx) ||
    prevSpanPx < 8 ||
    nextSpanPx < 8
  ) {
    return clampedCurrent;
  }
  const floor = isCloseCam ? 1.2 : 0;
  const next = (clampedCurrent + floor) * (prevSpanPx / nextSpanPx) - floor;
  return clamp(next, minDist, maxDist);
}

export type PinchOrbitMove =
  | { kind: 'none' }
  | { kind: 'orbit'; dx: number; dy: number }
  | { kind: 'pinch'; prevSpan: number; nextSpan: number };

export interface PinchPointerUpResult {
  shouldTap: boolean;
  x: number;
  y: number;
}

/**
 * Quản lý trạng thái đa chạm trên canvas camera:
 * - 1 ngón: xoay `yaw`/`pitch` hoặc tap tương tác khi thả tay mà chưa kéo quá 2px.
 * - 2+ ngón: khóa xoay camera 1 ngón, phát sự kiện `pinch`, và chặn tap nhầm cho tới khi nhấc hết tay.
 */
export class PinchOrbitController {
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private primaryPointerId = -1;
  private primaryMoved = false;
  private pinchActive = false;
  private pinchLockUntilAllUp = false;
  private lastPinchSpan = 0;

  private measureFirstTwoSpan(): number {
    const it = this.activePointers.values();
    const first = it.next().value;
    const second = it.next().value;
    if (!first || !second) return 0;
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  public pointerDown(id: number, x: number, y: number): void {
    this.activePointers.set(id, { x, y });
    if (this.activePointers.size === 1) {
      this.primaryPointerId = id;
      this.primaryMoved = false;
      this.pinchActive = false;
      this.pinchLockUntilAllUp = false;
      this.lastPinchSpan = 0;
    } else if (this.activePointers.size >= 2) {
      this.pinchActive = true;
      this.pinchLockUntilAllUp = true;
      this.primaryMoved = true;
      this.lastPinchSpan = this.measureFirstTwoSpan();
    }
  }

  public pointerMove(id: number, x: number, y: number): PinchOrbitMove {
    const prev = this.activePointers.get(id);
    if (!prev) {
      return { kind: 'none' };
    }
    this.activePointers.set(id, { x, y });

    if (this.activePointers.size >= 2) {
      const nextSpan = this.measureFirstTwoSpan();
      if (this.pinchActive && this.lastPinchSpan >= 8 && nextSpan >= 8) {
        const prevSpan = this.lastPinchSpan;
        this.lastPinchSpan = nextSpan;
        return { kind: 'pinch', prevSpan, nextSpan };
      }
      this.pinchActive = true;
      this.pinchLockUntilAllUp = true;
      this.primaryMoved = true;
      this.lastPinchSpan = nextSpan;
      return { kind: 'none' };
    }

    if (this.pinchLockUntilAllUp || id !== this.primaryPointerId) {
      return { kind: 'none' };
    }

    const dx = x - prev.x;
    const dy = y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      this.primaryMoved = true;
    }
    return { kind: 'orbit', dx, dy };
  }

  public pointerUp(
    id: number,
    x: number,
    y: number,
    cancelled = false
  ): PinchPointerUpResult {
    if (!this.activePointers.has(id)) {
      return { shouldTap: false, x, y };
    }
    this.activePointers.delete(id);

    const shouldTap =
      !cancelled &&
      this.activePointers.size === 0 &&
      id === this.primaryPointerId &&
      !this.primaryMoved &&
      !this.pinchLockUntilAllUp;

    if (this.activePointers.size < 2) {
      this.pinchActive = false;
      this.lastPinchSpan = 0;
    }

    if (this.activePointers.size === 0) {
      this.primaryPointerId = -1;
      this.primaryMoved = false;
      this.pinchLockUntilAllUp = false;
    }

    return { shouldTap, x, y };
  }

  public reset(): void {
    this.activePointers.clear();
    this.primaryPointerId = -1;
    this.primaryMoved = false;
    this.pinchActive = false;
    this.pinchLockUntilAllUp = false;
    this.lastPinchSpan = 0;
  }

  public getActivePointerCount(): number {
    return this.activePointers.size;
  }

  public isPinching(): boolean {
    return this.pinchActive;
  }
}
