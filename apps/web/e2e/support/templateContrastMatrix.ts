/**
 * The template x surface contrast matrix.
 *
 * Each entry names an ink and the backdrop it is painted on, as Typst colour
 * expressions resolved against the template's own source. Nothing here is a
 * copied hex value: rename a binding or retune a tint in
 * `crates/render/src/typst_engine/templates/` and the matrix fails rather than
 * quietly measuring a colour the template no longer paints.
 *
 * Pairs were derived by walking every `fill:`, `stroke:` and `line()` in all 12
 * templates and `_common.typ`, recording which enclosing `box`/`rect`/`grid`
 * fill each piece of ink actually lands on. Text that inherits the page-level
 * `set text(fill: text-color)` is covered by the `text-color` rows.
 *
 * That walk was a one-time audit; `uncoveredBindings` below is what keeps it
 * honest. It fails the suite when a template declares a colour no pair
 * measures, so a template that gains a tint cannot stay silently unaudited.
 *
 * Since #919 the suite gates sheet PARITY, not WCAG ratios — resolving these
 * pairs is what detects palette drift. The `role` field records which WCAG
 * floor each pair was (and would again be) gated against, kept because the
 * follow-up work restoring contrast compliance starts from exactly this map.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMED_CHIP_CALL_RE } from "../../src/test/typstPatterns";
import { ContrastRole } from "./contrast";
import { TEMPLATE_DIR, type Palette } from "./typstPalette";

/** One ink-on-backdrop relationship a template paints. */
export interface ContrastPair {
  /** What the pair is, in the report and in failure output. */
  readonly label: string;
  /** Typst colour expression for the ink. */
  readonly ink: string;
  /** Typst colour expression for what sits behind it. */
  readonly backdrop: string;
  /** Selects the WCAG floor; text unless stated. */
  readonly role?: ContrastRole;
}

/**
 * Pairs every template paints, wherever its layout puts them.
 *
 * The profile badge comes from `_common.typ`, which fills the icon chip with
 * `fill.lighten(82%)` and then writes the icon mark in `fill` itself — a
 * self-referential pair that is easy to miss because no template declares it.
 */
const UNIVERSAL_PAIRS: readonly ContrastPair[] = [
  { label: "body text on page", ink: "text-color", backdrop: "bg-color" },
  { label: "muted text on page", ink: "muted-color", backdrop: "bg-color" },
  { label: "accent ink on page", ink: "accent-color", backdrop: "bg-color" },
  {
    label: "section rule on page",
    ink: "accent-color",
    backdrop: "bg-color",
    role: ContrastRole.NonText,
  },
  {
    label: "profile badge mark on its own chip",
    ink: "accent-color",
    backdrop: "accent-color.lighten(82%)",
  },
  {
    label: "profile icon fallback ink on page",
    ink: "#333333",
    backdrop: "bg-color",
  },
  {
    label: "rating indicator outline on page",
    ink: "accent-color",
    backdrop: "bg-color",
    role: ContrastRole.NonText,
  },
];

/**
 * The sheet's `.doc-sheet__tag-chip` treatment, painted by the templates whose
 * `keywordStyle` is `chips` (#919): a body-ink label on the accent-tinted
 * fill, and the mixed border stroked on that same fill. Every chip-style
 * template passes `text-color` / `accent-color` / `bg-color`, so one shared
 * pair set covers them all.
 *
 * Membership is not hand-listed: `pairsFor` includes these pairs for exactly
 * the templates whose SOURCE makes a themed `render-item-tag-chips` call, the
 * same way every other colour here is resolved from what the template actually
 * paints. A template that flips its `keywordStyle` gains or loses the pairs
 * with the call site itself.
 */
const SHEET_CHIP_PAIRS: readonly ContrastPair[] = [
  {
    label: "sheet keyword chip label",
    ink: "text-color",
    backdrop: "sheet-chip-fill(accent-color, bg-color)",
  },
  {
    label: "sheet keyword chip border on its fill",
    ink: "sheet-chip-stroke(accent-color)",
    backdrop: "sheet-chip-fill(accent-color, bg-color)",
    role: ContrastRole.NonText,
  },
];

/**
 * Per-template pairs: tinted panels, chips, coloured bars and any ink a
 * template paints on something other than the bare page.
 */
const TEMPLATE_PAIRS: Readonly<Record<string, readonly ContrastPair[]>> = {
  azurill: [
    { label: "keyword chip ink", ink: "accent-color", backdrop: "light-bg" },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bar-empty",
      role: ContrastRole.NonText,
    },
  ],
  bronzor: [
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
  chikorita: [
    { label: "sidebar panel heading", ink: "accent-color", backdrop: "sidebar-bg" },
    { label: "sidebar panel body text", ink: "text-color", backdrop: "sidebar-bg" },
    { label: "sidebar panel muted text", ink: "muted-color", backdrop: "sidebar-bg" },
    { label: "keyword chip ink", ink: "accent-color", backdrop: "accent-bg" },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "border-color",
      role: ContrastRole.NonText,
    },
  ],
  ditto: [
    { label: "sidebar heading", ink: "accent-color", backdrop: "sidebar-bg" },
    { label: "sidebar body text", ink: "text-color", backdrop: "sidebar-bg" },
    { label: "sidebar muted text", ink: "muted-color", backdrop: "sidebar-bg" },
    { label: "keyword chip ink", ink: "accent-color", backdrop: "light-bg" },
    { label: "header name on accent bar", ink: "white", backdrop: "accent-color" },
    {
      label: "header headline on accent bar",
      ink: "accent-color.lighten(80%)",
      backdrop: "accent-color",
    },
    {
      label: "header contact line on accent bar",
      ink: "accent-color.lighten(85%)",
      backdrop: "accent-color",
    },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
  gengar: [
    { label: "sidebar heading", ink: "accent-color", backdrop: "sidebar-bg" },
    { label: "sidebar body text", ink: "sidebar-text", backdrop: "sidebar-bg" },
    { label: "sidebar muted text", ink: "muted-color", backdrop: "sidebar-bg" },
    {
      // Muted ink the template resolves against the RAIL rather than the page,
      // because the sheet composites `--doc-sheet-muted` (60% alpha) over
      // whatever is behind it. Section renderers shared with the main column
      // keep the page-ground `muted-color` above.
      label: "sidebar-local muted text",
      ink: "sidebar-muted-color",
      backdrop: "sidebar-bg",
    },
    { label: "project tag ink", ink: "accent-color", backdrop: "sidebar-bg" },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
  glalie: [
    { label: "sidebar heading", ink: "accent-color", backdrop: "sidebar-bg" },
    { label: "sidebar body text", ink: "text-color", backdrop: "sidebar-bg" },
    { label: "sidebar muted text", ink: "muted-color", backdrop: "sidebar-bg" },
    {
      // Muted ink the template resolves against the RAIL rather than the page,
      // because the sheet composites `--doc-sheet-muted` (60% alpha) over
      // whatever is behind it. Section renderers shared with the main column
      // keep the page-ground `muted-color` above.
      label: "sidebar-local muted text",
      ink: "sidebar-muted-color",
      backdrop: "sidebar-bg",
    },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "accent-color.lighten(70%)",
      role: ContrastRole.NonText,
    },
  ],
  kakuna: [
    { label: "keyword chip ink", ink: "accent-color", backdrop: "light-bg" },
    {
      label: "header box border on page",
      ink: "border-color",
      backdrop: "bg-color",
      role: ContrastRole.NonText,
    },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
  leafish: [
    { label: "header name on header band", ink: "accent-color", backdrop: "header-bg" },
    { label: "header headline on header band", ink: "header-text-color", backdrop: "header-bg" },
    { label: "contact bar ink", ink: "#ffffff", backdrop: "contact-bar-bg" },
    {
      label: "contact bar separator",
      ink: "separator-color",
      backdrop: "contact-bar-bg",
      role: ContrastRole.NonText,
    },
    { label: "keyword chip ink", ink: "accent-color", backdrop: "tag-bg" },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
  nosepass: [
    { label: "date badge muted ink", ink: "muted-color", backdrop: "light-gray" },
    { label: "keyword chip body text", ink: "text-color", backdrop: "light-gray" },
    {
      label: "section rule and skill box border",
      ink: "border-color",
      backdrop: "bg-color",
      role: ContrastRole.NonText,
    },
    {
      label: "skill bullet filled vs hollow outline",
      ink: "accent-color",
      backdrop: "bg-color",
      role: ContrastRole.NonText,
    },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
  onyx: [
    { label: "keyword chip ink", ink: "accent-color", backdrop: "accent-color.lighten(92%)" },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
  pikachu: [
    { label: "sidebar heading", ink: "accent-color", backdrop: "sidebar-bg" },
    { label: "sidebar body text", ink: "sidebar-text-color", backdrop: "sidebar-bg" },
    { label: "sidebar muted text", ink: "muted-color", backdrop: "sidebar-bg" },
    { label: "section pill ink on accent", ink: "white", backdrop: "accent-color" },
    { label: "avatar initials on accent", ink: "white", backdrop: "accent-color" },
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "sidebar-bg.darken(15%)",
      role: ContrastRole.NonText,
    },
  ],
  rhyhorn: [
    {
      label: "rating indicator fill vs empty",
      ink: "accent-color",
      backdrop: "bg-color.darken(10%)",
      role: ContrastRole.NonText,
    },
  ],
};

/**
 * True when a template's Typst source paints the themed sheet chips: a
 * `render-item-tag-chips` call passing BOTH `accent` and `bg` (the helper only
 * paints the `.doc-sheet__tag-chip` treatment when both are non-none). The
 * membership this derives is pinned by the spec's chip-membership test, so a
 * heuristic miss cannot drift silently.
 */
export function paintsThemedChips(templateId: string): boolean {
  const source = readFileSync(join(TEMPLATE_DIR, `${templateId}.typ`), "utf8");
  return THEMED_CHIP_CALL_RE.test(source);
}

/** Every pair audited for one template. */
export function pairsFor(templateId: string): readonly ContrastPair[] {
  const specific = TEMPLATE_PAIRS[templateId];
  if (!specific) {
    throw new Error(`no contrast matrix entry for template ${templateId}`);
  }
  const chipPairs = paintsThemedChips(templateId) ? SHEET_CHIP_PAIRS : [];
  return [...UNIVERSAL_PAIRS, ...chipPairs, ...specific];
}

/**
 * Colour bindings that are declared but never painted, so no pair measures them.
 *
 * Listed by binding NAME rather than by template on purpose: a per-template
 * escape hatch would excuse that template's whole palette, including the tint
 * it gains next year. Naming the binding keeps the exemption as narrow as the
 * claim behind it, and makes adding one a deliberate act a reviewer can see.
 *
 * Every entry carries a comment saying why it is never painted. If a binding IS
 * painted somewhere, it belongs in the matrix above, not here.
 */
export const UNPAINTED_BINDINGS: ReadonlySet<string> = new Set([
  // The user-facing brand seed. Since #919 every template paints it — but
  // always through the `accent-color` binding that aliases it
  // (`accent-color = primary-color`, asserted by the parity spec) and the
  // `sheet-*` tints derived from it, so the accent and tint pairs above are
  // where the seed is measured. No pair names the seed itself.
  "primary-color",
]);

/**
 * Binding names the matrix measures for one template, as ink or as backdrop.
 *
 * Only a pair whose expression IS a bare binding name counts. A pair naming
 * `bg-color.darken(10%)` measures that derived tint; it says nothing about the
 * contrast of `bg-color` itself, so it must not be credited with covering it.
 */
function measuredBindings(templateId: string): ReadonlySet<string> {
  return new Set(pairsFor(templateId).flatMap((pair) => [pair.ink, pair.backdrop]));
}

/**
 * Report every colour binding of a template that no pair measures.
 *
 * `parsePalette` returns exactly the bindings that resolved to a colour, so
 * anything in it either lands in the matrix or is named in
 * `UNPAINTED_BINDINGS`. Returns one human-readable line per gap, naming the
 * template and the binding, so the next person can act on the failure without
 * re-deriving the audit.
 */
export function uncoveredBindings(templateId: string, palette: Palette): string[] {
  const measured = measuredBindings(templateId);
  return Object.keys(palette)
    .filter((binding) => !measured.has(binding) && !UNPAINTED_BINDINGS.has(binding))
    .map(
      (binding) =>
        `${templateId}: binding "${binding}" resolves to a colour but no matrix pair measures it`,
    );
}
