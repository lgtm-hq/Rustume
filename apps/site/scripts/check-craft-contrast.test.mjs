import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AA_FLOOR,
  CRAFT_THEME_PATH,
  GRADIENT_STEPS,
  auditTheme,
  contrastRatio,
  formatFailure,
  gradientRamp,
  hexToRgb,
  mixToward,
  parseCustomProperties,
  parseGradientStops,
  relativeLuminance,
} from "./check-craft-contrast.mjs";

/** Minimal token set that clears the floor everywhere. */
const PASSING_TOKENS = {
  "--turbo-bg-base": "#14110e",
  "--turbo-bg-surface": "#1a1612",
  "--turbo-text-primary": "#f0ebe3",
  "--turbo-text-secondary": "#b8aa98",
  "--turbo-body-primary": "#f0ebe3",
  "--turbo-body-secondary": "#b8aa98",
  "--turbo-accent-link": "#e8622a",
  "--turbo-link-default": "#e8622a",
  "--turbo-heading-h1": "#f0ebe3",
  "--turbo-heading-h2": "#e8dcc8",
  "--turbo-heading-h3": "#d4b86a",
  "--turbo-heading-h4": "#e8622a",
  "--turbo-heading-h5": "#b8943f",
  "--turbo-heading-h6": "#c4b8a8",
  "--site-accent": "#e8622a",
  "--site-accent-light": "#d4b86a",
  "--turbo-code-inline-fg": "#d4b86a",
  "--turbo-code-inline-bg": "#2a2318",
  "--turbo-code-block-fg": "#f0ebe3",
  "--turbo-code-block-bg": "#221c17",
  "--turbo-table-header-fg": "#d4b86a",
  "--turbo-table-thead-bg": "#221c17",
  "--turbo-table-cell-bg": "#1a1612",
  "--turbo-table-stripe": "#1f1a15",
  "--turbo-panel-header-fg": "#f0ebe3",
  "--turbo-panel-header-bg": "#14110e",
  "--turbo-message-body-fg": "#f0ebe3",
  "--turbo-message-bg": "#1a1612",
  "--turbo-message-header-bg": "#221c17",
  "--turbo-text-inverse": "#14110e",
  "--turbo-brand-primary": "#e8622a",
  "--turbo-dropdown-item-hover": "#221c17",
  "--turbo-text-on-brand": "#14110e",
  "--gradient-primary": "linear-gradient(135deg, #e8622a 0%, #dd581d 100%)",
};

describe("hexToRgb", () => {
  it("expands shorthand hex", () => {
    expect(hexToRgb("#abc")).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it.each(["rgb(20, 17, 14)", "#14110eff", "chocolate", "color-mix(in srgb, #fff 50%, #000)", ""])(
    "rejects non-hex value %s",
    (value) => {
      expect(() => hexToRgb(value)).toThrow(/unsupported color value/);
    },
  );
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#e8622a", "#14110e")).toBeCloseTo(
      contrastRatio("#14110e", "#e8622a"),
      10,
    );
  });

  it.each([
    ["#f0ebe3", "#14110e", 15.85],
    ["#e8622a", "#1a1612", 5.32],
    ["#d4b86a", "#2a2318", 8.04],
  ])("clears the floor for known-pass pair %s on %s", (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 1);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_FLOOR);
  });

  it.each([
    ["#c44e1a", "#14110e", 3.99],
    ["#8a7d6c", "#1a1612", 4.48],
    ["#e8622a", "#c44e1a", 1.39],
  ])("stays below the floor for known-fail pair %s on %s", (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 1);
    expect(contrastRatio(fg, bg)).toBeLessThan(AA_FLOOR);
  });

  it("matches the WCAG luminance of pure channels", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
  });
});

describe("gradientRamp", () => {
  it("samples 21 points inclusive of both stops", () => {
    const ramp = gradientRamp("#000000", "#ffffff");

    expect(ramp).toHaveLength(GRADIENT_STEPS + 1);
    expect(ramp[0]).toBe("#000000");
    expect(ramp.at(-1)).toBe("#ffffff");
    expect(ramp[10]).toBe(mixToward("#000000", "#ffffff", 0.5));
  });

  it("returns a single sample when there is no second stop", () => {
    expect(gradientRamp("#e8622a", undefined)).toEqual(["#e8622a"]);
  });

  it("catches a ramp that passes at both stops but fails mid-ramp", () => {
    // sRGB blends linearly per channel, luminance does not: the interior of
    // this teal -> copper ramp sits below the chord between its endpoints.
    const ink = "#14110e";
    const from = "#129d8d";
    const to = "#c16e31";

    expect(contrastRatio(ink, from)).toBeGreaterThanOrEqual(AA_FLOOR);
    expect(contrastRatio(ink, to)).toBeGreaterThanOrEqual(AA_FLOOR);

    const ratios = gradientRamp(from, to).map((sample) => contrastRatio(ink, sample));

    expect(Math.min(...ratios)).toBeLessThan(AA_FLOOR);
    expect(Math.min(...ratios)).toBeCloseTo(4.55, 1);
  });
});

describe("parseCustomProperties", () => {
  it("extracts declarations from a theme block", () => {
    const css = `[data-theme="craft"] {\n  --turbo-bg-base: #14110e;\n  --font-body: "Archivo", sans-serif;\n}`;

    expect(parseCustomProperties(css)).toEqual({
      "--turbo-bg-base": "#14110e",
      "--font-body": '"Archivo", sans-serif',
    });
  });

  it("ignores declarations from other selectors", () => {
    const css = [
      ":root {\n  --turbo-bg-base: #ffffff;\n}",
      '[data-theme="craft"] {\n  --turbo-bg-base: #14110e;\n}',
      '[data-theme="craft-light"] {\n  --turbo-bg-base: #f5efe4;\n}',
    ].join("\n");

    expect(parseCustomProperties(css)).toEqual({ "--turbo-bg-base": "#14110e" });
  });

  it("fails when the audited selector is absent", () => {
    expect(() => parseCustomProperties(":root {\n  --turbo-bg-base: #14110e;\n}")).toThrow(
      /selector \[data-theme="craft"\] not found/,
    );
  });
});

describe("parseGradientStops", () => {
  it("returns both stops", () => {
    expect(parseGradientStops("linear-gradient(135deg, #e8622a 0%, #dd581d 100%)")).toEqual([
      "#e8622a",
      "#dd581d",
    ]);
  });

  it("rejects gradients that are not two-stop", () => {
    expect(() => parseGradientStops("linear-gradient(135deg, #e8622a 0%)")).toThrow(/found 1/);
  });

  it("rejects alpha hex stops", () => {
    expect(() => parseGradientStops("linear-gradient(135deg, #e8622aff 0%, #dd581d 100%)")).toThrow(
      /unsupported color value/,
    );
  });
});

describe("auditTheme", () => {
  it("passes a compliant token set", () => {
    expect(auditTheme(PASSING_TOKENS)).toEqual([]);
  });

  it("reports the token, ratio and pair for ink that fails on a backdrop", () => {
    const failures = auditTheme({ ...PASSING_TOKENS, "--turbo-text-secondary": "#8a7d6c" });

    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatchObject({
      token: "--turbo-text-secondary",
      foreground: "#8a7d6c",
      against: "--turbo-bg-base",
      background: "#14110e",
    });
    expect(failures[0].ratio).toBeLessThan(AA_FLOOR);
    expect(formatFailure(failures[0])).toContain(
      "--turbo-text-secondary #8a7d6c on --turbo-bg-base #14110e",
    );
  });

  it("reports a gradient that fails only in its interior", () => {
    const failures = auditTheme({
      ...PASSING_TOKENS,
      "--gradient-primary": "linear-gradient(135deg, #129d8d 0%, #c16e31 100%)",
    });

    expect(failures).toHaveLength(1);
    expect(failures[0].token).toBe("--turbo-text-on-brand");
    expect(failures[0].against).toContain("#129d8d -> #c16e31");
    expect(failures[0].background).not.toBe("#129d8d");
    expect(failures[0].background).not.toBe("#c16e31");
  });

  it("fails loudly when a gated token is missing", () => {
    const { "--turbo-text-on-brand": _omitted, ...tokens } = PASSING_TOKENS;

    expect(() => auditTheme(tokens)).toThrow(/missing required token --turbo-text-on-brand/);
  });

  it("rejects a non-hex token value", () => {
    expect(() =>
      auditTheme({ ...PASSING_TOKENS, "--turbo-text-primary": "rgb(240, 235, 227)" }),
    ).toThrow(/unsupported color value/);
  });

  it("keeps the shipped craft theme compliant", () => {
    const tokens = parseCustomProperties(readFileSync(CRAFT_THEME_PATH, "utf8"));

    expect(auditTheme(tokens)).toEqual([]);
  });
});
