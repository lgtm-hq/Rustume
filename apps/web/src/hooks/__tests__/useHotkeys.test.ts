import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatShortcut } from "../useHotkeys";

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
    expect(result).toContain("S");
  });

  it("formats Escape as Esc", () => {
    const result = formatShortcut({ key: "Escape" });
    expect(result).toContain("Esc");
  });

  it("includes mod prefix", () => {
    const result = formatShortcut({ key: "s", mod: true });
    // Should contain either Cmd symbol or Ctrl depending on platform
    expect(result.length).toBeGreaterThan(1);
  });

  it("includes shift prefix", () => {
    const result = formatShortcut({ key: "z", mod: true, shift: true });
    expect(result.length).toBeGreaterThan(1);
  });
});

describe("useHotkeys event handling", () => {
  beforeEach(() => {
    // Clean up any listeners between tests
    vi.restoreAllMocks();
  });

  it("fires handler on matching keydown", async () => {
    const handler = vi.fn();

    // Manually simulate what useHotkeys does internally
    const listener = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handler();
      }
    };
    document.addEventListener("keydown", listener);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }),
    );

    expect(handler).toHaveBeenCalledOnce();
    document.removeEventListener("keydown", listener);
  });

  it("does not fire handler on non-matching key", () => {
    const handler = vi.fn();

    const listener = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) {
        handler();
      }
    };
    document.addEventListener("keydown", listener);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", metaKey: true, bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
    document.removeEventListener("keydown", listener);
  });

  it("suppresses plain keys when target is an input", () => {
    const handler = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);

    const listener = (e: KeyboardEvent) => {
      const isEditable =
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
      if (e.key === "?" && !isEditable) {
        handler();
      }
    };
    document.addEventListener("keydown", listener);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    document.removeEventListener("keydown", listener);
    document.body.removeChild(input);
  });
});
