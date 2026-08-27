/**
 * Read the colour palette a Typst resume template actually declares.
 *
 * The audit gates colours parsed from `crates/render/src/typst_engine/templates/`
 * rather than a hand-copied table, so a template that changes its accent, its
 * muted ink or a fill tint cannot drift away from the matrix that guards it.
 * The matrix only declares RELATIONSHIPS (which ink lands on which backdrop);
 * the values always come from the source.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { darken, lighten, mixSrgb } from "./contrast";

/** Directory holding the 12 Typst templates and their shared `_common.typ`. */
export const TEMPLATE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "crates",
  "render",
  "src",
  "typst_engine",
  "templates",
);

/**
 * Every shipped template id, in the order `TEMPLATES` lists them in
 * `crates/render/src/typst_engine/engine.rs`.
 */
export const TEMPLATE_IDS = [
  "azurill",
  "bronzor",
  "chikorita",
  "ditto",
  "gengar",
  "glalie",
  "kakuna",
  "leafish",
  "nosepass",
  "onyx",
  "pikachu",
  "rhyhorn",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Resolved colour bindings of one template, keyed by their Typst names. */
export type Palette = Readonly<Record<string, string>>;

const LET_RE = /^\s*(?:#)?let\s+([a-z][a-z0-9-]*)\s*=\s*(.+?)\s*$/gim;
const THEME_DEFAULT_RE =
  /^rgb\(\s*data\.metadata\.theme\.at\([^,]+,\s*default:\s*"(#[0-9a-f]{3,6})"\s*\)\s*\)$/i;
const RGB_LITERAL_RE = /^rgb\(\s*"(#[0-9a-f]{3,6})"\s*\)$/i;
const HEX_LITERAL_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6})$/i;
const MODIFIER_RE = /^(.+?)\.(lighten|darken)\(\s*(\d+(?:\.\d+)?)%\s*\)$/i;
const SHEET_CALL_RE = /^(sheet-[a-z][a-z0-9-]*)\(\s*(.+?)\s*\)$/i;

/**
 * One `sheet-*` tint helper, as declared in `_common.typ`.
 *
 * `base` is non-null only when the helper hard-codes its second operand (the
 * chip border mixes into a literal `#e7e5e4`); otherwise the caller supplies it.
 */
export interface SheetHelper {
  readonly name: string;
  readonly pct: number;
  readonly base: string | null;
}

/** `#let sheet-x(a, b) = sheet-mix(a, b, 15)` — the whole helper grammar. */
const SHEET_HELPER_RE =
  /^#let\s+(sheet-[a-z][a-z0-9-]*)\([^)]*\)\s*=\s*sheet-mix\(\s*[^,]+?\s*,\s*(.+?)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s*$/gm;

/**
 * Parse the `sheet-*` helpers out of `_common.typ`.
 *
 * The percentages are read from the Typst source rather than restated here:
 * a hand-copied table is a third place the sheet's formulas live, and it can
 * drift from `_common.typ` (which mirrors `docSheet.css`) without any test
 * noticing. `sheet-mix` itself is variadic in its percentage and is handled
 * directly by the evaluator.
 */
export function parseSheetHelpers(commonSource: string): ReadonlyMap<string, SheetHelper> {
  const helpers = new Map<string, SheetHelper>();
  for (const [, name, base, pct] of commonSource.matchAll(SHEET_HELPER_RE)) {
    const literal = RGB_LITERAL_RE.exec(base) ?? HEX_LITERAL_RE.exec(base);
    helpers.set(name.toLowerCase(), {
      name,
      pct: Number(pct),
      base: literal ? literal[1].toLowerCase() : null,
    });
  }
  return helpers;
}

/** Read `_common.typ` and parse its `sheet-*` helpers. */
export function readSheetHelpers(templateDir = TEMPLATE_DIR): ReadonlyMap<string, SheetHelper> {
  return parseSheetHelpers(readFileSync(join(templateDir, "_common.typ"), "utf8"));
}

/** The shipped helpers, resolved once at load from `_common.typ`. */
export const SHEET_HELPERS = readSheetHelpers();

/**
 * Evaluate one Typst colour expression against already-resolved bindings.
 *
 * Returns `null` for anything outside the grammar the templates use — a
 * conditional, a helper call, an alpha hex — so the caller can skip a binding
 * that carries no auditable colour instead of inventing a number for it.
 */
export function evaluateExpression(expression: string, resolved: Palette): string | null {
  const expr = expression.trim();

  const modifier = MODIFIER_RE.exec(expr);
  if (modifier) {
    const base = evaluateExpression(modifier[1], resolved);
    if (base === null) {
      return null;
    }
    const factor = Number(modifier[3]) / 100;
    return modifier[2].toLowerCase() === "lighten" ? lighten(base, factor) : darken(base, factor);
  }

  const sheetCall = SHEET_CALL_RE.exec(expr);
  if (sheetCall) {
    const name = sheetCall[1].toLowerCase();
    const args = sheetCall[2].split(",").map((arg) => arg.trim());
    const resolveArg = (arg: string): string | null => evaluateExpression(arg, resolved);
    const top = resolveArg(args[0]);
    if (top === null) {
      return null;
    }
    if (name === "sheet-mix") {
      const base = resolveArg(args[1]);
      const pct = Number(args[2]?.replace(/%$/, ""));
      return base !== null && Number.isFinite(pct) ? mixSrgb(top, base, pct) : null;
    }
    const helper = SHEET_HELPERS.get(name);
    if (helper === undefined) {
      return null;
    }
    const base = helper.base ?? resolveArg(args[1]);
    return base !== null ? mixSrgb(top, base, helper.pct) : null;
  }

  const themed = THEME_DEFAULT_RE.exec(expr);
  if (themed) {
    return themed[1].toLowerCase();
  }

  const literal = RGB_LITERAL_RE.exec(expr) ?? HEX_LITERAL_RE.exec(expr);
  if (literal) {
    return literal[1].toLowerCase();
  }

  if (Object.hasOwn(resolved, expr)) {
    return resolved[expr];
  }

  return null;
}

/**
 * Parse the colour bindings of a Typst template source.
 *
 * Bindings are resolved in source order, which is also dependency order: a
 * template declares `primary-color` before the tints derived from it.
 */
export function parsePalette(source: string): Palette {
  const resolved: Record<string, string> = {};
  for (const match of source.matchAll(LET_RE)) {
    const [, name, expression] = match;
    const value = evaluateExpression(expression, resolved);
    if (value !== null) {
      resolved[name] = value;
    }
  }
  return resolved;
}

/** Read and parse one template's palette from disk. */
export function readPalette(templateId: TemplateId, templateDir = TEMPLATE_DIR): Palette {
  return parsePalette(readFileSync(join(templateDir, `${templateId}.typ`), "utf8"));
}

/**
 * Resolve an arbitrary Typst colour expression against a template's palette.
 *
 * The matrix uses this for backdrops a template composes inline rather than
 * binding to a name — `accent-color.lighten(92%)` chips, for instance.
 */
export function resolveColor(palette: Palette, expression: string, templateId: string): string {
  const value = evaluateExpression(expression, palette);
  if (value === null) {
    throw new Error(
      `template ${templateId} cannot resolve the colour expression "${expression}" — ` +
        "the contrast matrix and the Typst source have drifted apart",
    );
  }
  return value;
}
