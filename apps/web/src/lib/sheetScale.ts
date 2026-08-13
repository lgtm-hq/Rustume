/**
 * Miniature scale for the document sheet on narrow viewports (#813, spec §3.1).
 *
 * The sheet's internal layout is always the design width (`PAGE_WIDTH_PX`).
 * When the canvas is narrower, a uniform `transform: scale(k)` paints a
 * faithful miniature — the same line breaks and page guides as print — instead
 * of reflowing. Below {@link SHEET_SCALE_EDIT_FLOOR} the editor switches to
 * read-only (Done) mode: a usability floor, not a WCAG 2.5.8 escape. While
 * editing is on, hit areas inverse-scale so they stay ≥24 CSS px after
 * `transform: scale(k)` for every interactive k in
 * [{@link SHEET_SCALE_EDIT_FLOOR}, 1].
 */

import { PAGE_WIDTH_PX } from "./docLayout";

/**
 * Minimum scale at which sheet editing stays interactive; below it the sheet
 * renders as a read-only miniature.
 *
 * 0.45 is a usability floor (hit boxes at 24/k become large relative to the
 * miniature). SC 2.5.8 on this surface is met by inverse-scaled hit areas
 * (`max(designSize, 24px / var(--sheet-k))`), not by refusing to edit.
 * Other WCAG 2.2 AA criteria stay on epic #352.
 */
export const SHEET_SCALE_EDIT_FLOOR = 0.45;

/** WCAG 2.5.8 Target Size (Minimum) in CSS pixels. */
export const WCAG_TARGET_MIN_PX = 24;

/**
 * Live miniature scale on the scaled subtree. Unitless (e.g. `0.81`), so
 * `24px / var(--sheet-k)` yields a design-space length.
 */
export const SHEET_SCALE_CSS_VAR = "--sheet-k";

/**
 * CSS `max()` that keeps a design-space hit box at least
 * {@link WCAG_TARGET_MIN_PX} CSS pixels after `transform: scale(k)`.
 *
 * Visual glyphs may stay at `designPx`; the tap box uses this expression.
 * Stylesheets that cannot import this helper use the equivalent
 * `max(<design>px, 24px / var(--sheet-k, 1))`.
 */
export function sheetHitSizeCss(designPx: number): string {
  return `max(${designPx}px, ${WCAG_TARGET_MIN_PX}px / var(${SHEET_SCALE_CSS_VAR}, 1))`;
}

/**
 * Design-space size that paints as at least {@link WCAG_TARGET_MIN_PX} CSS
 * pixels after `transform: scale(scale)`.
 */
export function sheetHitSizePx(designPx: number, scale: number): number {
  const k = scale > 0 ? scale : 1;
  return Math.max(designPx, WCAG_TARGET_MIN_PX / k);
}

/** Result of mapping an available canvas width onto the sheet's design width. */
export interface SheetScale {
  /** Uniform scale factor `k = min(1, available / designWidth)`. */
  scale: number;
  /** Whether the canvas is wide enough for pointer editing (usability floor). */
  interactive: boolean;
}

/**
 * Compute the miniature scale for a measured available width.
 *
 * `availablePx` is the canvas width the sheet may occupy (parent content box,
 * after drawer chrome). Non-positive widths fall back to full scale so a
 * first-paint race before measurement does not collapse the sheet.
 */
export function sheetScaleForWidth(
  availablePx: number,
  designWidth: number = PAGE_WIDTH_PX,
  editFloor: number = SHEET_SCALE_EDIT_FLOOR,
): SheetScale {
  if (!(availablePx > 0) || !(designWidth > 0)) {
    return { scale: 1, interactive: true };
  }
  const scale = Math.min(1, availablePx / designWidth);
  return { scale, interactive: scale >= editFloor };
}
