/**
 * Gate the hand-authored craft theme against WCAG 2.x AA contrast.
 *
 * `apps/site/src/styles/craft-theme.css` is the one theme Rustume authors
 * itself, so it never passes through turbo-themes' token normalizer. This
 * script is the audit that stands in for it. It is modelled on turbo-themes'
 * `scripts/normalize-wcag-aa-tokens.mjs` (same luminance/ratio maths, same
 * gradient sampling rationale) with one deliberate difference: it CHECKS and
 * fails, it never rewrites. The CSS is hand-authored and its palette is a
 * design statement — drift must be fixed by a human, not silently averaged
 * toward black or white.
 *
 * Retires once lgtm-hq/turbo-themes#840 promotes Craft to a first-class theme
 * family and the site consumes the published, already-normalized tokens.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit } from "node:process";

/**
 * Contrast floor. Deliberately above the 4.5:1 axe/WCAG threshold so rounding,
 * gradient sampling granularity and future nudges keep real headroom.
 */
export const AA_FLOOR = 4.75;

/** Interior steps taken along `--gradient-primary`; 20 steps = 21 samples. */
export const GRADIENT_STEPS = 20;

/** Backgrounds every ink token must stay readable on. */
export const BACKDROP_TOKENS = ["--turbo-bg-base", "--turbo-bg-surface"];

/**
 * Tokens painted as ink on the page backdrop.
 *
 * State fills (`--turbo-state-*`) and `--turbo-bg-overlay` are intentionally
 * absent: those are fills, not ink, and gating them here would audit a pair
 * that is never rendered. Fill/ink pairs that ARE rendered together are
 * declared in `TOKEN_PAIRS` instead.
 */
export const INK_TOKENS = [
  "--turbo-text-primary",
  "--turbo-text-secondary",
  "--turbo-body-primary",
  "--turbo-body-secondary",
  "--turbo-accent-link",
  "--turbo-link-default",
  "--turbo-heading-h1",
  "--turbo-heading-h2",
  "--turbo-heading-h3",
  "--turbo-heading-h4",
  "--turbo-heading-h5",
  "--turbo-heading-h6",
  "--site-accent",
  "--site-accent-light",
];

/** Explicit ink-on-fill pairs the theme declares together. */
export const TOKEN_PAIRS = [
  ["--turbo-code-inline-fg", "--turbo-code-inline-bg"],
  ["--turbo-code-block-fg", "--turbo-code-block-bg"],
  ["--turbo-table-header-fg", "--turbo-table-thead-bg"],
  ["--turbo-table-header-fg", "--turbo-table-cell-bg"],
  ["--turbo-table-header-fg", "--turbo-table-stripe"],
  ["--turbo-panel-header-fg", "--turbo-panel-header-bg"],
  ["--turbo-message-body-fg", "--turbo-message-bg"],
  ["--turbo-message-body-fg", "--turbo-message-header-bg"],
  ["--turbo-text-inverse", "--turbo-brand-primary"],
  ["--turbo-text-primary", "--turbo-dropdown-item-hover"],
  ["--turbo-body-primary", "--turbo-dropdown-item-hover"],
];

/** Ink painted on top of `--gradient-primary` (CTA fills). */
export const GRADIENT_TOKEN = "--gradient-primary";

/** Ink token gated against the whole gradient ramp. */
export const GRADIENT_INK_TOKEN = "--turbo-text-on-brand";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parse `--custom-property: value;` declarations out of a CSS source.
 *
 * @param {string} css
 * @returns {Record<string, string>}
 */
export function parseCustomProperties(css) {
  /** @type {Record<string, string>} */
  const properties = {};
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    properties[match[1]] = match[2].trim();
  }
  return properties;
}

/**
 * Convert a hex colour to RGB channels.
 *
 * Anything else — 8-digit alpha hex, `rgb()`, `color-mix()`, a colour name —
 * would parse to NaN and silently report a bogus ratio, so it is rejected.
 *
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
  const value = String(hex).trim();
  if (!HEX_RE.test(value)) {
    throw new Error(`unsupported color value: ${hex} (only #rgb / #rrggbb are supported)`);
  }
  const digits = value.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  return /** @type {[number, number, number]} */ (
    [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
  );
}

/**
 * Convert RGB channels back to a hex colour.
 *
 * @param {number[]} rgb
 * @returns {string}
 */
export function rgbToHex(rgb) {
  return `#${rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * WCAG relative luminance.
 *
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colours.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Blend `hex` toward `target` by `t` (0..1) in sRGB, the way a browser paints a
 * linear gradient.
 *
 * @param {string} hex
 * @param {string} target
 * @param {number} t
 * @returns {string}
 */
export function mixToward(hex, target, t) {
  const from = hexToRgb(hex);
  const to = hexToRgb(target);
  return rgbToHex(from.map((v, i) => v + (to[i] - v) * t));
}

/**
 * Sample a two-stop linear gradient into discrete backgrounds.
 *
 * Clearing the floor at both stops is NOT sufficient. sRGB blending is linear
 * per channel but luminance is not, so the interior of a ramp sits below the
 * chord between its endpoints and contrast dips there. turbo-themes#774 caught
 * gruvbox-light-soft doing exactly that: 4.75:1 and 4.79:1 at the ends, 4.46:1
 * at 60% along. Sampling the ramp is what makes the audit match what a reader
 * actually sees on a button.
 *
 * @param {string} from
 * @param {string} to
 * @param {number} [steps]
 * @returns {string[]}
 */
export function gradientRamp(from, to, steps = GRADIENT_STEPS) {
  if (!to) {
    return [from];
  }
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    samples.push(mixToward(from, to, i / steps));
  }
  return samples;
}

/**
 * Extract the hex stops of a two-stop `linear-gradient(...)` value.
 *
 * @param {string} value
 * @returns {[string, string]}
 */
export function parseGradientStops(value) {
  const stops = [...String(value).matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]);
  if (stops.length !== 2) {
    throw new Error(`expected exactly 2 hex stops in gradient, found ${stops.length}: ${value}`);
  }
  // Force the hex guard so an 8-digit alpha stop fails loudly here.
  stops.forEach((stop) => hexToRgb(stop));
  return /** @type {[string, string]} */ (stops);
}

/**
 * Read a token, failing loudly when it is missing.
 *
 * @param {Record<string, string>} tokens
 * @param {string} name
 * @returns {string}
 */
function requireToken(tokens, name) {
  const value = tokens[name];
  if (!value) {
    throw new Error(`missing required token ${name} in craft-theme.css`);
  }
  return value;
}

/**
 * @typedef {object} ContrastFailure
 * @property {string} token Foreground token that failed.
 * @property {string} foreground Foreground colour compared.
 * @property {string} against Background token (or gradient description).
 * @property {string} background Background colour compared.
 * @property {number} ratio Measured contrast ratio.
 * @property {number} required Required floor.
 */

/**
 * Audit every gated pair in a parsed craft theme.
 *
 * @param {Record<string, string>} tokens
 * @param {number} [floor]
 * @returns {ContrastFailure[]}
 */
export function auditTheme(tokens, floor = AA_FLOOR) {
  /** @type {ContrastFailure[]} */
  const failures = [];

  /**
   * @param {string} token
   * @param {string} foreground
   * @param {string} against
   * @param {string} background
   */
  const gate = (token, foreground, against, background) => {
    const ratio = contrastRatio(foreground, background);
    if (ratio < floor) {
      failures.push({ token, foreground, against, background, ratio, required: floor });
    }
  };

  for (const backdrop of BACKDROP_TOKENS) {
    const background = requireToken(tokens, backdrop);
    for (const token of INK_TOKENS) {
      gate(token, requireToken(tokens, token), backdrop, background);
    }
  }

  for (const [fgToken, bgToken] of TOKEN_PAIRS) {
    gate(fgToken, requireToken(tokens, fgToken), bgToken, requireToken(tokens, bgToken));
  }

  // The whole ramp, not just its ends — see gradientRamp().
  const [from, to] = parseGradientStops(requireToken(tokens, GRADIENT_TOKEN));
  const ink = requireToken(tokens, GRADIENT_INK_TOKEN);
  const ramp = gradientRamp(from, to);
  let worstSample = ramp[0];
  let worstRatio = Number.POSITIVE_INFINITY;
  for (const sample of ramp) {
    const ratio = contrastRatio(ink, sample);
    if (ratio < worstRatio) {
      worstRatio = ratio;
      worstSample = sample;
    }
  }
  if (worstRatio < floor) {
    failures.push({
      token: GRADIENT_INK_TOKEN,
      foreground: ink,
      against: `${GRADIENT_TOKEN} ramp ${from} -> ${to}`,
      background: worstSample,
      ratio: worstRatio,
      required: floor,
    });
  }

  return failures;
}

/**
 * Render one failure as a CI log line.
 *
 * @param {ContrastFailure} failure
 * @returns {string}
 */
export function formatFailure(failure) {
  return (
    `${failure.token} ${failure.foreground} on ${failure.against} ${failure.background}: ` +
    `${failure.ratio.toFixed(2)}:1 (needs ${failure.required}:1)`
  );
}

/** Default location of the theme this script audits. */
export const CRAFT_THEME_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "styles",
  "craft-theme.css",
);

/**
 * Audit the craft theme file and report to stdout.
 *
 * @param {string} [path]
 * @returns {number} Process exit code.
 */
export function main(path = CRAFT_THEME_PATH) {
  const prefix = "[check-craft-contrast]";
  /** @type {ContrastFailure[]} */
  let failures;
  try {
    failures = auditTheme(parseCustomProperties(readFileSync(path, "utf8")));
  } catch (error) {
    console.error(`${prefix} ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${prefix} FAIL ${formatFailure(failure)}`);
    }
    console.error(
      `${prefix} ${failures.length} contrast failure(s) in ${path}. ` +
        "Fix the palette by hand — this checker never rewrites the theme.",
    );
    return 1;
  }

  console.log(`${prefix} craft theme clears ${AA_FLOOR}:1 on every gated pair`);
  return 0;
}

if (argv[1] && fileURLToPath(import.meta.url) === resolve(argv[1])) {
  exit(main());
}
