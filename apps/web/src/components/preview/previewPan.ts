/** A4 preview dimensions at 1x zoom (CSS pixels). */
export const PREVIEW_PAGE_WIDTH = 595;
export const PREVIEW_PAGE_HEIGHT = 842;

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
    x: Math.max(-maxPanX, Math.min(maxPanX, panX)),
    // `|| 0` normalizes the -0 that Math.max(-0, ...) can produce.
    y: Math.max(-maxPanY, Math.min(0, panY)) || 0,
  };
}

/** Keyboard pan step in CSS pixels per arrow-key press. */
export const KEYBOARD_PAN_STEP = 48;

/** Ctrl/Meta + wheel zooms; plain wheel keeps page navigation. */
export function isWheelZoomGesture(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.ctrlKey || event.metaKey;
}

/** Compute next zoom level from a wheel delta (matches button step of 0.1). */
export function wheelZoomDelta(deltaY: number, currentZoom: number): number {
  const step = 0.1;
  const delta = deltaY > 0 ? -step : step;
  return Math.max(0.5, Math.min(2, Math.round((currentZoom + delta) * 10) / 10));
}
