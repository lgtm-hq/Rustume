import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@solidjs/testing-library";
import { formatShortcut, useHotkeys, type Shortcut } from "../useHotkeys";

afterEach(cleanup);

describe("formatShortcut", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("formats a plain key", () => {
    const result = formatShortcut({ key: "s" });
    expect(result).toBe("S");
  });

  it("formats Escape as Esc", () => {
    const result = formatShortcut({ key: "Escape" });
    expect(result).toBe("Esc");
  });

  it("includes mod prefix (non-Mac uses Ctrl)", () => {
    // In jsdom, navigator.userAgent does not contain "Mac", so Ctrl path is used
    const result = formatShortcut({ key: "s", mod: true });
    expect(result).toContain("Ctrl");
    expect(result).toContain("S");
  });

  it("includes shift prefix (non-Mac uses Shift)", () => {
    const result = formatShortcut({ key: "z", mod: true, shift: true });
    expect(result).toContain("Ctrl");
    expect(result).toContain("Shift");
    expect(result).toContain("Z");
  });
});

describe("useHotkeys", () => {
  afterEach(cleanup);

  function createShortcut(overrides: Partial<Shortcut> = {}): Shortcut {
    return {
      key: "s",
      handler: vi.fn(),
      label: "Test",
      category: "Test",
      ...overrides,
    };
  }

  it("fires handler on matching keydown with mod", () => {
    const handler = vi.fn();
    const shortcut = createShortcut({ key: "s", mod: true, handler });

    renderHook(() => useHotkeys([shortcut]));

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
    );

    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire handler on non-matching key", () => {
    const handler = vi.fn();
    const shortcut = createShortcut({ key: "s", mod: true, handler });

    renderHook(() => useHotkeys([shortcut]));

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when mod is required but not pressed", () => {
    const handler = vi.fn();
    const shortcut = createShortcut({ key: "s", mod: true, handler });

    renderHook(() => useHotkeys([shortcut]));

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: false, bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("matches shift when required", () => {
    const handler = vi.fn();
    const shortcut = createShortcut({ key: "z", mod: true, shift: true, handler });

    renderHook(() => useHotkeys([shortcut]));

    // Without shift — should not fire
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: false, bubbles: true }),
    );
    expect(handler).not.toHaveBeenCalled();

    // With shift — should fire
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it("suppresses plain keys when target is an editable element", () => {
    const handler = vi.fn();
    const shortcut = createShortcut({ key: "?", shift: true, handler });

    renderHook(() => useHotkeys([shortcut]));

    const input = document.createElement("input");
    document.body.appendChild(input);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("allows mod combos even in editable elements", () => {
    const handler = vi.fn();
    const shortcut = createShortcut({ key: "s", mod: true, handler });

    renderHook(() => useHotkeys([shortcut]));

    const input = document.createElement("input");
    document.body.appendChild(input);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));

    expect(handler).toHaveBeenCalledOnce();
    document.body.removeChild(input);
  });

  it("cleans up listeners on cleanup", () => {
    const handler = vi.fn();
    const shortcut = createShortcut({ key: "s", mod: true, handler });

    const { cleanup: hookCleanup } = renderHook(() => useHotkeys([shortcut]));
    hookCleanup();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
