/** A4 preview dimensions at 1x zoom (CSS pixels). */
export const PREVIEW_PAGE_WIDTH = 595;
export const PREVIEW_PAGE_HEIGHT = 842;

/** Per-frame blend toward the target zoom (0–1). Higher = snappier. */
export const ZOOM_SMOOTHING = 0.32;

/**
 * Move `current` toward `target` for rAF-smoothed zoom.
 * Snaps when close enough to avoid endless sub-pixel updates.
 */
export function settleZoom(
  current: number,
  target: number,
  factor: number = ZOOM_SMOOTHING,
): number {
  const delta = target - current;
  if (Math.abs(delta) < 0.0005) return target;
  return Math.round((current + delta * factor) * 1000) / 1000;
}

/** Pan is only meaningful when zoomed beyond fit (1x). */
export function shouldResetPan(zoom: number): boolean {
  return zoom <= 1;
}

/**
 * Clamp pan offset so the paper stays within the viewport when zoomed in.
 * The paper is horizontally centered but top-aligned at rest (`items-start
 * justify-center`), so x pans symmetrically around the center while y may
 * only move content up — just far enough to reveal the bottom edge.
 */
export function clampPan(
  panX: number,
  panY: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  if (shouldResetPan(zoom) || viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0 };
  }

  const contentWidth = PREVIEW_PAGE_WIDTH * zoom;
  const contentHeight = PREVIEW_PAGE_HEIGHT * zoom;

  const maxPanX = Math.max(0, (contentWidth - viewportWidth) / 2);
  const maxPanY = Math.max(0, contentHeight - viewportHeight);

  return {
    // `|| 0` normalizes the -0 that Math.min/max can produce around zero.
    x: Math.max(-maxPanX, Math.min(maxPanX, panX)) || 0,
    y: Math.max(-maxPanY, Math.min(0, panY)) || 0,
  };
}

/** Keyboard pan step in CSS pixels per arrow-key press. */
export const KEYBOARD_PAN_STEP = 48;

/** Ctrl/Meta + wheel zooms; plain wheel pans / may change pages.
 *  Trackpad pinch-to-zoom arrives as wheel events with ctrlKey set. */
export function isWheelZoomGesture(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.ctrlKey || event.metaKey;
}

/** Zoom units per normalized wheel-delta pixel. Tuned for trackpad pinch. */
export const WHEEL_ZOOM_SENSITIVITY = 0.00125;

/** Max absolute zoom change from a single wheel/pinch event. */
export const WHEEL_ZOOM_MAX_STEP = 0.06;

/** Minimum |deltaX| (normalized px) before an event counts toward a page swipe. */
export const PAGE_WHEEL_THRESHOLD = 24;

/** Horizontal must outweigh vertical by this factor to count as a page swipe. */
export const PAGE_SWIPE_DOMINANCE = 2.5;

/** Accumulated blocked horizontal overscroll (px) required to commit a page flip. */
export const PAGE_SWIPE_COMMIT_PX = 140;

/** Reset an incomplete swipe if the wheel is idle this long. */
export const PAGE_SWIPE_IDLE_MS = 220;

/** Normalize a wheel delta axis to approximate CSS pixels. */
export function normalizeWheelDelta(delta: number, deltaMode: number = 0): number {
  // WheelEvent.DOM_DELTA_PIXEL = 0, DOM_DELTA_LINE = 1, DOM_DELTA_PAGE = 2
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * 800;
  return delta;
}

export type PageSwipeState = {
  /** Signed overscroll toward next (+) / previous (−) page. */
  overscroll: number;
  lastAt: number;
};

export function createPageSwipeState(): PageSwipeState {
  return { overscroll: 0, lastAt: 0 };
}

/**
 * Accumulate intentional horizontal overscroll into a page flip.
 * Tiny / diagonal trackpad noise is ignored; a sustained swipe is required.
 *
 * @param intentDx Normalized horizontal delta when armed for page nav, else 0.
 */
export function feedPageSwipe(
  state: PageSwipeState,
  intentDx: number,
  intentDy: number,
  now: number,
  options?: {
    commitPx?: number;
    dominance?: number;
    idleMs?: number;
    threshold?: number;
  },
): { state: PageSwipeState; pageDelta: -1 | 0 | 1 } {
  const commitPx = options?.commitPx ?? PAGE_SWIPE_COMMIT_PX;
  const dominance = options?.dominance ?? PAGE_SWIPE_DOMINANCE;
  const idleMs = options?.idleMs ?? PAGE_SWIPE_IDLE_MS;
  const threshold = options?.threshold ?? PAGE_WHEEL_THRESHOLD;

  let overscroll = state.overscroll;
  if (state.lastAt > 0 && now - state.lastAt > idleMs) {
    overscroll = 0;
  }

  if (
    intentDx === 0 ||
    Math.abs(intentDx) < threshold ||
    Math.abs(intentDx) < Math.abs(intentDy) * dominance
  ) {
    // Unarmed or not clearly horizontal — clear any in-progress swipe.
    return { state: { overscroll: 0, lastAt: now }, pageDelta: 0 };
  }

  if (overscroll !== 0 && Math.sign(overscroll) !== Math.sign(intentDx)) {
    overscroll = 0;
  }
  overscroll += intentDx;

  if (Math.abs(overscroll) >= commitPx) {
    return {
      state: { overscroll: 0, lastAt: now },
      pageDelta: overscroll > 0 ? 1 : -1,
    };
  }

  return { state: { overscroll, lastAt: now }, pageDelta: 0 };
}

/**
 * Compute next zoom from a wheel/pinch delta.
 * Proportional to |deltaY| so trackpad pinch is gradual; discrete mouse-wheel
 * notches still move a noticeable but capped amount. Precision is 0.001 so
 * small pinch events are not rounded away.
 */
export function wheelZoomDelta(deltaY: number, currentZoom: number, deltaMode: number = 0): number {
  const normalized = normalizeWheelDelta(deltaY, deltaMode);
  let delta = -normalized * WHEEL_ZOOM_SENSITIVITY;
  delta = Math.max(-WHEEL_ZOOM_MAX_STEP, Math.min(WHEEL_ZOOM_MAX_STEP, delta));
  const next = currentZoom + delta;
  return Math.max(0.5, Math.min(2, Math.round(next * 1000) / 1000));
}

export type WheelInteractionResult = {
  panX: number;
  panY: number;
  /**
   * Normalized horizontal delta to feed into {@link feedPageSwipe} when this
   * event is armed for page navigation (fit-zoom horizontal, or zoomed and
   * blocked at a horizontal edge). 0 when not armed.
   */
  pageIntentDx: number;
  /** Normalized vertical delta (for dominance checks in the swipe accumulator). */
  pageIntentDy: number;
  /** Caller should preventDefault when true (custom pan or armed page swipe). */
  consumeEvent: boolean;
};

/**
 * Resolve a plain (non-zoom) wheel gesture over the preview.
 *
 * - Vertical always pans the page (or defers to native overflow at ≤1x).
 * - Horizontal may arm page navigation; the caller accumulates intent via
 *   {@link feedPageSwipe} so accidental trackpad nudges do not flip pages.
 * - When zoomed in, horizontal pans first and only arms page nav once further
 *   panning is blocked at the left/right edge.
 */
export function resolveWheelInteraction(options: {
  panX: number;
  panY: number;
  deltaX: number;
  deltaY: number;
  deltaMode?: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}): WheelInteractionResult {
  const {
    panX,
    panY,
    deltaX,
    deltaY,
    deltaMode = 0,
    zoom,
    viewportWidth,
    viewportHeight,
  } = options;

  const dx = normalizeWheelDelta(deltaX, deltaMode);
  const dy = normalizeWheelDelta(deltaY, deltaMode);

  if (shouldResetPan(zoom)) {
    // Fit zoom: vertical → native overflow; horizontal → arm page swipe.
    if (Math.abs(dx) < Math.abs(dy) || dx === 0) {
      return {
        panX: 0,
        panY: 0,
        pageIntentDx: 0,
        pageIntentDy: dy,
        consumeEvent: false,
      };
    }
    return {
      panX: 0,
      panY: 0,
      pageIntentDx: dx,
      pageIntentDy: dy,
      consumeEvent: true,
    };
  }

  // Scroll right (dx > 0) moves content left (panX decreases), matching
  // trackpad / mouse-wheel conventions.
  const proposedX = panX - dx;
  const proposedY = panY - dy;
  const clamped = clampPan(proposedX, proposedY, zoom, viewportWidth, viewportHeight);

  const blockedLeft = dx < 0 && clamped.x === panX && proposedX > panX;
  const blockedRight = dx > 0 && clamped.x === panX && proposedX < panX;
  const pageIntentDx = blockedLeft || blockedRight ? dx : 0;

  return {
    panX: clamped.x,
    panY: clamped.y,
    pageIntentDx,
    pageIntentDy: dy,
    // Consume whenever we own the gesture (zoomed pan, or armed edge swipe).
    consumeEvent: true,
  };
}

/**
 * After a keyboard pan attempt, decide whether Left/Right should flip pages.
 * Returns 0 when the pan moved, or when not at the matching edge.
 */
export function pageDeltaFromBlockedPan(
  previousX: number,
  nextX: number,
  attemptedDeltaX: number,
): -1 | 0 | 1 {
  if (attemptedDeltaX === 0 || nextX !== previousX) return 0;
  // ArrowRight pans content left (negative pan delta) → next page at right edge.
  if (attemptedDeltaX < 0) return 1;
  if (attemptedDeltaX > 0) return -1;
  return 0;
}
