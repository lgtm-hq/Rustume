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
const SHEET_CALL_RE =
  /^(sheet-mix|sheet-sidebar-tint|sheet-muted|sheet-rule|sheet-chip-fill|sheet-chip-stroke)\(\s*(.+?)\s*\)$/i;

/**
 * Mix percentage each `sheet-*` tint helper in `_common.typ` bakes in. Keep in
 * lockstep with the helper bodies (which themselves mirror `docSheet.css`).
 */
const SHEET_CALL_PCT: Readonly<Record<string, number>> = {
  "sheet-sidebar-tint": 15,
  "sheet-muted": 60,
  "sheet-rule": 35,
  "sheet-chip-fill": 10,
};

/** `.doc-sheet__tag-chip` border mix base, from `sheet-chip-stroke`. */
const SHEET_CHIP_STROKE_BASE = "#e7e5e4";

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
    if (name === "sheet-mix") {
      const top = resolveArg(args[0]);
      const base = resolveArg(args[1]);
      const pct = Number(args[2]?.replace(/%$/, ""));
      return top !== null && base !== null && Number.isFinite(pct) ? mixSrgb(top, base, pct) : null;
    }
    if (name === "sheet-chip-stroke") {
      const accent = resolveArg(args[0]);
      return accent !== null ? mixSrgb(accent, SHEET_CHIP_STROKE_BASE, 28) : null;
    }
    const top = resolveArg(args[0]);
    const base = resolveArg(args[1]);
    return top !== null && base !== null ? mixSrgb(top, base, SHEET_CALL_PCT[name]) : null;
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
