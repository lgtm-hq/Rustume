import { describe, expect, it } from "vitest";
import { PAGE_WIDTH_PX } from "../docLayout";
import {
  SHEET_SCALE_CSS_VAR,
  SHEET_SCALE_EDIT_FLOOR,
  WCAG_TARGET_MIN_PX,
  sheetHitSizeCss,
  sheetHitSizePx,
  sheetScaleForWidth,
} from "../sheetScale";

describe("sheetScaleForWidth", () => {
  it("stays at full scale when the canvas is at least the design width", () => {
    expect(sheetScaleForWidth(PAGE_WIDTH_PX)).toEqual({ scale: 1, interactive: true });
    expect(sheetScaleForWidth(PAGE_WIDTH_PX + 200)).toEqual({ scale: 1, interactive: true });
  });

  it("scales uniformly below the design width", () => {
    expect(sheetScaleForWidth(430)).toEqual({
      scale: 430 / PAGE_WIDTH_PX,
      interactive: 430 / PAGE_WIDTH_PX >= SHEET_SCALE_EDIT_FLOOR,
    });
  });

  it("marks the sheet non-interactive below the edit floor", () => {
    const narrow = PAGE_WIDTH_PX * SHEET_SCALE_EDIT_FLOOR - 1;
    const info = sheetScaleForWidth(narrow);
    expect(info.scale).toBeCloseTo(narrow / PAGE_WIDTH_PX);
    expect(info.interactive).toBe(false);
  });

  it("treats non-positive widths as a first-paint fallback", () => {
    expect(sheetScaleForWidth(0)).toEqual({ scale: 1, interactive: true });
    expect(sheetScaleForWidth(-10)).toEqual({ scale: 1, interactive: true });
  });
});

describe("sheetHitSizeCss", () => {
  it("emits max(design, 24px / var(--sheet-k)) for the stylesheet contract", () => {
    expect(SHEET_SCALE_CSS_VAR).toBe("--sheet-k");
    expect(sheetHitSizeCss(18)).toBe("max(18px, 24px / var(--sheet-k, 1))");
    expect(sheetHitSizeCss(24)).toBe("max(24px, 24px / var(--sheet-k, 1))");
    expect(sheetHitSizeCss(26)).toBe("max(26px, 24px / var(--sheet-k, 1))");
  });
});

describe("sheetHitSizePx", () => {
  it("keeps design size when it already clears 24 CSS px after scale", () => {
    expect(sheetHitSizePx(26, 1)).toBe(26);
    expect(sheetHitSizePx(24, 1)).toBe(24);
  });

  it("inflates undersized design boxes at full scale", () => {
    expect(sheetHitSizePx(18, 1)).toBe(WCAG_TARGET_MIN_PX);
    expect(sheetHitSizePx(22, 1)).toBe(WCAG_TARGET_MIN_PX);
    expect(sheetHitSizePx(16, 1)).toBe(WCAG_TARGET_MIN_PX);
    expect(sheetHitSizePx(8, 1)).toBe(WCAG_TARGET_MIN_PX);
  });

  it("keeps the painted size at least 24 CSS px for every interactive k", () => {
    const designs = [8, 16, 18, 22, 24, 26];
    const scales = [1, 0.81, SHEET_SCALE_EDIT_FLOOR];
    for (const design of designs) {
      for (const scale of scales) {
        const painted = sheetHitSizePx(design, scale) * scale;
        expect(painted).toBeGreaterThanOrEqual(WCAG_TARGET_MIN_PX - 1e-9);
      }
    }
  });

  it("treats non-positive scale as full size", () => {
    expect(sheetHitSizePx(18, 0)).toBe(WCAG_TARGET_MIN_PX);
    expect(sheetHitSizePx(18, -1)).toBe(WCAG_TARGET_MIN_PX);
  });
});
