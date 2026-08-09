import { describe, expect, it } from "vitest";
import { PAGE_WIDTH_PX } from "../docLayout";
import { SHEET_SCALE_EDIT_FLOOR, sheetScaleForWidth } from "../sheetScale";

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
