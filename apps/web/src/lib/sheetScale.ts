/**
 * Miniature scale for the document sheet on narrow viewports (#813, spec §3.1).
 *
 * The sheet's internal layout is always the design width (`PAGE_WIDTH_PX`).
 * When the canvas is narrower, a uniform `transform: scale(k)` paints a
 * faithful miniature — the same line breaks and page guides as print — instead
 * of reflowing. Below {@link SHEET_SCALE_EDIT_FLOOR}, interaction targets fall
 * under WCAG 2.5.8, so the editor switches to read-only (Done) mode.
 */

import { PAGE_WIDTH_PX } from "./docLayout";

/**
 * Minimum scale at which sheet editing stays interactive. Below this floor
 * (targets shrink under the 24 CSS-px WCAG 2.5.8 minimum) the sheet renders
 * as a read-only miniature.
 */
export const SHEET_SCALE_EDIT_FLOOR = 0.45;

/** Result of mapping an available canvas width onto the sheet's design width. */
export interface SheetScale {
  /** Uniform scale factor `k = min(1, available / designWidth)`. */
  scale: number;
  /** Whether pointer editing stays above the WCAG target-size floor. */
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
