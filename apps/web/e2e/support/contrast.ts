/**
 * Colour maths for the template contrast audit.
 *
 * Mirrors `apps/site/scripts/check-craft-contrast.mjs` (same luminance and
 * ratio maths) with the additions this audit needs: Typst's `lighten`/`darken`
 * operators, and a print surface model. Gradient ramp sampling is deliberately
 * not duplicated here — no template paints ink on a gradient, and the guard in
 * `template-contrast.spec.ts` fails if one appears.
 *
 * The two surfaces exist because the 12 resume templates are a single Typst
 * document rendered by two backends — `typst-render` to PNG for the on-screen
 * preview and `typst-pdf` for the export. The colour VALUES are identical, so
 * the surfaces only diverge in how a reader's device resolves them: a monitor
 * shows sRGB, and a monochrome office printer — the overwhelmingly common way a
 * resume actually reaches a human — collapses hue to a single ink. Two colours
 * that separate on screen can converge to the same grey on paper, which is the
 * failure class the print surface exists to catch. It is NOT uniformly stricter
 * than the screen surface; it is a different projection.
 */

/** Contrast floor for text, WCAG 2.1 SC 1.4.3 (AA, normal size). */
export const TEXT_FLOOR = 4.5;

/**
 * Contrast floor for non-text content, WCAG 2.1 SC 1.4.11.
 *
 * Applies to rules, borders, bullets and rating indicators — marks that carry
 * meaning (a section boundary, a proficiency level) rather than prose.
 */
export const NON_TEXT_FLOOR = 3;

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A colour role, which selects the floor a pair is gated against. */
export const ContrastRole = {
  Text: "text",
  NonText: "non-text",
} as const;

export type ContrastRole = (typeof ContrastRole)[keyof typeof ContrastRole];

/** Render target a pair is measured on. */
export const Surface = {
  Screen: "screen",
  Print: "print",
} as const;

export type Surface = (typeof Surface)[keyof typeof Surface];

/** Every surface the audit measures, in report order. */
export const SURFACES = [Surface.Screen, Surface.Print] as const;

/** The floor a role must clear, regardless of surface. */
export function floorFor(role: ContrastRole): number {
  return role === ContrastRole.Text ? TEXT_FLOOR : NON_TEXT_FLOOR;
}

/**
 * Convert a hex colour to RGB channels.
 *
 * Anything else — 8-digit alpha hex, `rgb()`, a colour name — would parse to
 * NaN and silently report a bogus ratio, so it is rejected.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.trim();
  if (!HEX_RE.test(value)) {
    throw new Error(`unsupported color value: ${hex} (only #rgb / #rrggbb are supported)`);
  }
  const digits = value.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : digits;
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Convert RGB channels back to a hex colour. */
export function rgbToHex(rgb: readonly number[]): string {
  return `#${rgb
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG relative luminance of a hex colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Typst's `color.lighten(factor)` for an `rgb()` colour.
 *
 * Typst stores `rgb("#…")` as `palette::rgb::Rgba<Srgb, f32>` and delegates to
 * palette's `Lighten`, which raises each GAMMA-ENCODED channel toward its
 * maximum: `c + (1 - c) * factor`. Doing this in linear light instead would
 * produce visibly different colours, so the encoding matters.
 */
export function lighten(hex: string, factor: number): string {
  return rgbToHex(
    hexToRgb(hex).map((channel) => {
      const c = channel / 255;
      return (c + (1 - c) * factor) * 255;
    }),
  );
}

/**
 * Typst's `color.darken(factor)` for an `rgb()` colour.
 *
 * palette's `Darken` lowers each gamma-encoded channel toward its minimum,
 * which for RGB is zero: `c - c * factor`.
 */
export function darken(hex: string, factor: number): string {
  return rgbToHex(
    hexToRgb(hex).map((channel) => {
      const c = channel / 255;
      return c * (1 - factor) * 255;
    }),
  );
}

/**
 * Project a colour onto a monochrome printer's single ink.
 *
 * Uses BT.601 luma over the gamma-encoded channels, which is what a greyscale
 * print driver applies. This is deliberately NOT WCAG relative luminance: that
 * would be a no-op, because the contrast ratio is already luminance-only, and
 * the print surface would then be an exact copy of the screen surface. BT.601
 * weights hue differently, so hues that separate on screen can converge here —
 * the thing worth gating.
 */
export function toPrintGrey(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return rgbToHex([luma, luma, luma]);
}

/** Project a colour onto a render surface. */
export function project(hex: string, surface: Surface): string {
  return surface === Surface.Print ? toPrintGrey(hex) : hex;
}

/** Contrast ratio between two colours as resolved on a given surface. */
export function surfaceRatio(foreground: string, background: string, surface: Surface): number {
  return contrastRatio(project(foreground, surface), project(background, surface));
}
