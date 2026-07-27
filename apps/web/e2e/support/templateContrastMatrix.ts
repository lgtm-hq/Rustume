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
 */
import { ContrastRole } from "./contrast";

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
    { label: "sidebar panel heading", ink: "accent-color", backdrop: "light-bg" },
    { label: "sidebar panel body text", ink: "text-color", backdrop: "light-bg" },
    { label: "sidebar panel muted text", ink: "muted-color", backdrop: "light-bg" },
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

/** Every pair audited for one template. */
export function pairsFor(templateId: string): readonly ContrastPair[] {
  const specific = TEMPLATE_PAIRS[templateId];
  if (!specific) {
    throw new Error(`no contrast matrix entry for template ${templateId}`);
  }
  return [...UNIVERSAL_PAIRS, ...specific];
}
