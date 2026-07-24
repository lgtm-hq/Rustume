import {
  PAGE_SWIPE_COMMIT_PX,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
  clampPan,
  createPageSwipeState,
  feedPageSwipe,
  isWheelZoomGesture,
  pageDeltaFromBlockedPan,
  resolveWheelInteraction,
  settleZoom,
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
    // Horizontally centered: symmetric range. Top-aligned: content may only
    // move up, far enough to reveal the bottom edge.
    const maxPanX = (PREVIEW_PAGE_WIDTH * zoom - viewportWidth) / 2;
    const maxPanY = PREVIEW_PAGE_HEIGHT * zoom - viewportHeight;

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

    it("clamps horizontal pan symmetrically around the center", () => {
      expect(clampPan(maxPanX + 50, 0, zoom, viewportWidth, viewportHeight)).toEqual({
        x: maxPanX,
        y: 0,
      });
      expect(clampPan(-maxPanX - 50, 0, zoom, viewportWidth, viewportHeight)).toEqual({
        x: -maxPanX,
        y: 0,
      });
    });

    it("only allows panning content up from its top-aligned rest position", () => {
      // Panning down would reveal empty space above the top-aligned paper.
      expect(clampPan(0, 80, zoom, viewportWidth, viewportHeight)).toEqual({ x: 0, y: 0 });
      // Panning up is allowed through the full vertical overflow, so the
      // bottom edge of the page is reachable.
      expect(clampPan(0, -maxPanY - 80, zoom, viewportWidth, viewportHeight)).toEqual({
        x: 0,
        y: -maxPanY,
      });
      expect(clampPan(0, -maxPanY, zoom, viewportWidth, viewportHeight)).toEqual({
        x: 0,
        y: -maxPanY,
      });
    });

    it("clamps vertical pan to zero when content fits vertically", () => {
      const shortViewport = PREVIEW_PAGE_HEIGHT * zoom + 100;
      expect(clampPan(0, -50, zoom, viewportWidth, shortViewport)).toEqual({ x: 0, y: 0 });
    });
  });

  describe("isWheelZoomGesture", () => {
    it("detects ctrl or meta modifier", () => {
      expect(isWheelZoomGesture({ ctrlKey: true, metaKey: false })).toBe(true);
      expect(isWheelZoomGesture({ ctrlKey: false, metaKey: true })).toBe(true);
      expect(isWheelZoomGesture({ ctrlKey: false, metaKey: false })).toBe(false);
    });
  });

  describe("settleZoom", () => {
    it("blends toward the target and snaps when close", () => {
      expect(settleZoom(1, 1.1, 0.5)).toBeCloseTo(1.05, 3);
      expect(settleZoom(1.0002, 1, 0.5)).toBe(1);
    });
  });

  describe("wheelZoomDelta", () => {
    it("scales zoom proportionally to deltaY and clamps to 0.5–2", () => {
      // Small trackpad-like deltas move gradually (not a full 0.1 jump).
      expect(wheelZoomDelta(-8, 1)).toBeCloseTo(1.01, 3);
      expect(wheelZoomDelta(8, 1)).toBeCloseTo(0.99, 3);

      // Large mouse-wheel notches are capped per event.
      expect(wheelZoomDelta(-1000, 1)).toBeCloseTo(1.06, 3);
      expect(wheelZoomDelta(1000, 1)).toBeCloseTo(0.94, 3);

      expect(wheelZoomDelta(-100, 2)).toBe(2);
      expect(wheelZoomDelta(100, 0.5)).toBe(0.5);
    });

    it("normalizes line/page deltaMode into pixel-ish units", () => {
      // One "line" (~16px) at default sensitivity ≈ 0.02 zoom.
      expect(wheelZoomDelta(-1, 1, 1)).toBeCloseTo(1.02, 3);
    });
  });

  describe("resolveWheelInteraction", () => {
    const viewportWidth = 400;
    const viewportHeight = 500;
    const zoom = 1.5;
    const maxPanX = (PREVIEW_PAGE_WIDTH * zoom - viewportWidth) / 2;

    it("at fit zoom, vertical wheel does not arm page navigation", () => {
      expect(
        resolveWheelInteraction({
          panX: 0,
          panY: 0,
          deltaX: 0,
          deltaY: 80,
          zoom: 1,
          viewportWidth,
          viewportHeight,
        }),
      ).toEqual({
        panX: 0,
        panY: 0,
        pageIntentDx: 0,
        pageIntentDy: 80,
        consumeEvent: false,
      });
    });

    it("at fit zoom, horizontal wheel arms page intent (no immediate flip)", () => {
      expect(
        resolveWheelInteraction({
          panX: 0,
          panY: 0,
          deltaX: 40,
          deltaY: 0,
          zoom: 1,
          viewportWidth,
          viewportHeight,
        }),
      ).toEqual({
        panX: 0,
        panY: 0,
        pageIntentDx: 40,
        pageIntentDy: 0,
        consumeEvent: true,
      });
    });

    it("when zoomed, vertical wheel pans without arming page intent", () => {
      const result = resolveWheelInteraction({
        panX: 0,
        panY: 0,
        deltaX: 0,
        deltaY: 80,
        zoom,
        viewportWidth,
        viewportHeight,
      });
      expect(result.pageIntentDx).toBe(0);
      expect(result.consumeEvent).toBe(true);
      expect(result.panY).toBe(-80);
    });

    it("when zoomed, horizontal wheel pans until the edge then arms page intent", () => {
      const mid = resolveWheelInteraction({
        panX: 0,
        panY: 0,
        deltaX: 40,
        deltaY: 0,
        zoom,
        viewportWidth,
        viewportHeight,
      });
      expect(mid.pageIntentDx).toBe(0);
      expect(mid.panX).toBe(-40);

      const atRightEdge = resolveWheelInteraction({
        panX: -maxPanX,
        panY: 0,
        deltaX: 40,
        deltaY: 0,
        zoom,
        viewportWidth,
        viewportHeight,
      });
      expect(atRightEdge.pageIntentDx).toBe(40);
      expect(atRightEdge.panX).toBe(-maxPanX);
    });
  });

  describe("feedPageSwipe", () => {
    it("requires sustained overscroll before committing a page flip", () => {
      let state = createPageSwipeState();
      const first = feedPageSwipe(state, 40, 0, 1_000);
      expect(first.pageDelta).toBe(0);
      expect(first.state.overscroll).toBe(40);
      state = first.state;

      // Below commit threshold — still no flip.
      const almost = feedPageSwipe(state, PAGE_SWIPE_COMMIT_PX - 50, 0, 1_050);
      expect(almost.pageDelta).toBe(0);
      state = almost.state;

      const committed = feedPageSwipe(state, 40, 0, 1_100);
      expect(committed.pageDelta).toBe(1);
      expect(committed.state.overscroll).toBe(0);
    });

    it("ignores diagonal gestures that are not clearly horizontal", () => {
      const result = feedPageSwipe(createPageSwipeState(), 40, 30, 1_000);
      expect(result.pageDelta).toBe(0);
      expect(result.state.overscroll).toBe(0);
    });

    it("resets when the swipe direction reverses", () => {
      let state = feedPageSwipe(createPageSwipeState(), 60, 0, 1_000).state;
      expect(state.overscroll).toBe(60);
      state = feedPageSwipe(state, -60, 0, 1_050).state;
      expect(state.overscroll).toBe(-60);
    });

    it("resets after idle timeout", () => {
      let state = feedPageSwipe(createPageSwipeState(), 80, 0, 1_000).state;
      expect(state.overscroll).toBe(80);
      const afterIdle = feedPageSwipe(state, 80, 0, 1_000 + 500);
      // Idle clear happens first, then this event starts a fresh swipe at 80.
      expect(afterIdle.state.overscroll).toBe(80);
      expect(afterIdle.pageDelta).toBe(0);
    });
  });

  describe("pageDeltaFromBlockedPan", () => {
    it("returns a page delta only when pan was blocked at an edge", () => {
      expect(pageDeltaFromBlockedPan(0, -10, -48)).toBe(0);
      expect(pageDeltaFromBlockedPan(-100, -100, -48)).toBe(1);
      expect(pageDeltaFromBlockedPan(100, 100, 48)).toBe(-1);
      expect(pageDeltaFromBlockedPan(0, 0, 0)).toBe(0);
    });
  });
});
