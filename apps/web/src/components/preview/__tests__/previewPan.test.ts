import {
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
  clampPan,
  isWheelZoomGesture,
  shouldResetPan,
  wheelZoomDelta,
} from "../previewPan";

describe("previewPan", () => {
  describe("shouldResetPan", () => {
    it("returns true at or below 1x zoom", () => {
      expect(shouldResetPan(1)).toBe(true);
      expect(shouldResetPan(0.5)).toBe(true);
      expect(shouldResetPan(0)).toBe(true);
    });

    it("returns false above 1x zoom", () => {
      expect(shouldResetPan(1.1)).toBe(false);
      expect(shouldResetPan(2)).toBe(false);
    });
  });

  describe("clampPan", () => {
    const viewportWidth = 400;
    const viewportHeight = 500;
    const zoom = 1.5;
    const maxPanX = (PREVIEW_PAGE_WIDTH * zoom - viewportWidth) / 2;
    const maxPanY = (PREVIEW_PAGE_HEIGHT * zoom - viewportHeight) / 2;

    it("zeros pan when zoom is at or below 1x", () => {
      expect(clampPan(100, 50, 1, viewportWidth, viewportHeight)).toEqual({ x: 0, y: 0 });
      expect(clampPan(100, 50, 0.5, viewportWidth, viewportHeight)).toEqual({ x: 0, y: 0 });
    });

    it("zeros pan when viewport dimensions are invalid", () => {
      expect(clampPan(100, 50, zoom, 0, viewportHeight)).toEqual({ x: 0, y: 0 });
      expect(clampPan(100, 50, zoom, viewportWidth, 0)).toEqual({ x: 0, y: 0 });
    });

    it("passes through pan within bounds", () => {
      expect(clampPan(10, -20, zoom, viewportWidth, viewportHeight)).toEqual({ x: 10, y: -20 });
    });

    it("clamps pan to horizontal and vertical limits", () => {
      expect(clampPan(maxPanX + 50, 0, zoom, viewportWidth, viewportHeight)).toEqual({
        x: maxPanX,
        y: 0,
      });
      expect(clampPan(-maxPanX - 50, 0, zoom, viewportWidth, viewportHeight)).toEqual({
        x: -maxPanX,
        y: 0,
      });
      expect(clampPan(0, maxPanY + 80, zoom, viewportWidth, viewportHeight)).toEqual({
        x: 0,
        y: maxPanY,
      });
      expect(clampPan(0, -maxPanY - 80, zoom, viewportWidth, viewportHeight)).toEqual({
        x: 0,
        y: -maxPanY,
      });
    });
  });

  describe("isWheelZoomGesture", () => {
    it("detects ctrl or meta modifier", () => {
      expect(isWheelZoomGesture({ ctrlKey: true, metaKey: false })).toBe(true);
      expect(isWheelZoomGesture({ ctrlKey: false, metaKey: true })).toBe(true);
      expect(isWheelZoomGesture({ ctrlKey: false, metaKey: false })).toBe(false);
    });
  });

  describe("wheelZoomDelta", () => {
    it("steps zoom by 0.1 and clamps to 0.5–2", () => {
      expect(wheelZoomDelta(-100, 1)).toBe(1.1);
      expect(wheelZoomDelta(100, 1)).toBe(0.9);
      expect(wheelZoomDelta(-100, 2)).toBe(2);
      expect(wheelZoomDelta(100, 0.5)).toBe(0.5);
    });
  });
});
