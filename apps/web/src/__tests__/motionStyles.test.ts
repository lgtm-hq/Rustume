import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keyframes allowed to interpolate `opacity`.
 *
 * Every other keyframe runs on a surface that carries text. A partially
 * transparent element is composited toward whatever sits behind it, so its
 * text and its own background blend together and the pair falls below the AA
 * contrast ratio for the length of the animation — which is how an axe scan
 * lands on a failure that does not exist at rest (Rustume#618, turbo-themes#774).
 *
 * The three below animate text-free decoration: `fade-in` is applied only to
 * scrims and overlays, `ink-drop` is a ripple, and `pulse-subtle` is a status
 * dot.
 */
const OPACITY_ALLOWED = new Set(["fade-in", "ink-drop", "pulse-subtle"]);

/** Splits the stylesheet into `@keyframes` blocks keyed by animation name. */
function keyframeBlocks(css: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const pattern = /@keyframes\s+([\w-]+)\s*\{/g;

  for (let match = pattern.exec(css); match !== null; match = pattern.exec(css)) {
    const name = match[1] as string;
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;

    while (index < css.length && depth > 0) {
      const char = css[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      index += 1;
    }

    blocks.set(name, css.slice(start, index - 1));
  }

  return blocks;
}

describe("motion styles", () => {
  const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

  it("zeroes durations and caps iterations under prefers-reduced-motion", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(block).toContain("animation-duration: 0.01ms !important");
    expect(block).toContain("transition-duration: 0.01ms !important");
    // `pulse-subtle` runs `infinite`: a zero-duration animation that never
    // stops still repaints forever.
    expect(block).toContain("animation-iteration-count: 1 !important");
    expect(block).toContain("scroll-behavior: auto !important");
  });

  it("finds the keyframes it means to check", () => {
    // Guards the parser itself: a silent zero-block match would make every
    // assertion below vacuously pass.
    expect([...keyframeBlocks(css).keys()]).toEqual(
      expect.arrayContaining(["slide-up", "toast-slide-in", "tooltip-in"]),
    );
  });

  it("keeps text-bearing keyframes off opacity", () => {
    const offenders = [...keyframeBlocks(css)]
      .filter(([name, body]) => !OPACITY_ALLOWED.has(name) && /\bopacity\s*:/.test(body))
      .map(([name]) => name);

    expect(offenders).toEqual([]);
  });

  it("moves toasts by translation alone so they clear the viewport", () => {
    const blocks = keyframeBlocks(css);

    for (const name of ["toast-slide-in", "toast-slide-out", "toast-swipe-out"]) {
      expect(blocks.get(name)).toMatch(/translateX/);
    }
    // The exit animations rely on leaving the viewport rather than fading,
    // so they must end fully off-canvas.
    expect(blocks.get("toast-slide-out")).toContain("translateX(100%)");
    expect(blocks.get("toast-swipe-out")).toContain("translateX(100%)");
  });
});
