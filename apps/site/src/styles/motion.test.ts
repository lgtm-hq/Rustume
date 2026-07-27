import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const globalCss = readFileSync(resolve(here, "./global.css"), "utf8");
const searchDropdown = readFileSync(resolve(here, "../components/SearchDropdown.astro"), "utf8");

/** Body of the sitewide `prefers-reduced-motion` block. */
function reducedMotionBlock(css: string): string {
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThan(-1);

  let depth = 0;
  let index = css.indexOf("{", start);
  const open = index;

  while (index < css.length) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
    index += 1;
  }

  return css.slice(open, index);
}

describe("site motion", () => {
  it("zeroes durations and caps iterations under prefers-reduced-motion", () => {
    const block = reducedMotionBlock(globalCss);

    expect(block).toContain("animation-duration: 0.01ms !important");
    expect(block).toContain("transition-duration: 0.01ms !important");
    expect(block).toContain("animation-iteration-count: 1 !important");
  });

  it("unsets smooth scrolling, which the shorthand block must reach", () => {
    // `html` declares `scroll-behavior: smooth`; the universal selector in the
    // reduced-motion block is what overrides it.
    expect(globalCss).toContain("scroll-behavior: smooth");
    expect(reducedMotionBlock(globalCss)).toContain("scroll-behavior: auto !important");
  });

  it("never transitions colour on the theme picker", () => {
    // A theme swap rewrites every `--turbo-*` property at once. Transitioning
    // `color` crossfades the label's ink against a background that has already
    // changed, so the control fails AA mid-swap (turbo-themes#774).
    for (const selector of [".theme-picker-trigger {", ".theme-picker-option {"]) {
      const start = globalCss.indexOf(selector);
      expect(start, `${selector} not found`).toBeGreaterThan(-1);

      const rule = globalCss.slice(start, globalCss.indexOf("}", start));
      expect(rule).toContain("transition:");
      expect(rule).not.toMatch(/^\s*color\s/m);
    }
  });

  it("names transitioned properties instead of using the `all` shorthand", () => {
    // `transition: all` sweeps up `color` and `background`, which every theme
    // swap rewrites — the same mid-blend hazard, reintroduced by accident.
    expect(globalCss).not.toMatch(/transition:\s*all\b/);
    expect(searchDropdown).not.toMatch(/transition:\s*all\b/);
  });
});
