# Template design specs

Frozen design references for the twelve bundled Typst templates. The
template-fidelity epic implements sheet chrome and Typst parity against these
documents — not against memory of Reactive Resume (RR) artboards.

## Source of truth

1. **The document sheet** — `apps/web/src/components/doc-editor/docSheet.css`,
   `DocSheet.tsx`, `apps/web/src/lib/docLayout.ts`. **When the sheet and PDF
   disagree, the sheet is the default target** unless a divergence is tagged
   `owner-decision-needed` (#919). It is what the author is looking at while
   they edit, so it is what the export has to reproduce: accent ink, tints,
   chips, level glyphs, faces and column padding all come from the sheet's
   `--doc-sheet-*` properties and `.doc-sheet__*` rules, and the Typst side
   mirrors them (`sheet-mix()` and friends in `_common.typ` restate the CSS
   `color-mix(in srgb, …)` formulas). Page geometry the sheet has no opinion
   on — pagination, page margins on single-column templates — stays with
   Typst.
2. **Typst** — `crates/render/src/typst_engine/templates/<id>.typ` (+ helpers in
   `_common.typ`). Authoritative for everything the sheet does not paint, and
   the place a sheet-parity fix lands.
   **Item composition** (profile labels, education field order, avatar initials,
   keyword presence, level clamp) is owned by
   [`item-presentation.md`](../design/item-presentation.md) (#829) and wins over
   per-template Item composition tables that still describe the pre-unification
   audit.
3. **Layout registry** — column mode, default section columns, `headerStyle`,
   `contactIn`, and sidebar width live in
   [`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs).
   Specs link there instead of duplicating column lists.
4. **Shared fixture** — `tests/fixtures/v3/doc-editor.json`, rendered with
   `cargo run -p rustume-render --example render_json -- <json> --text`
   (template field overridden per audit). RR reference assets under
   AmruthPillai/Reactive-Resume `apps/web/public/templates/{jpg,pdf}/` are
   adapted-from context only.

## Specs

| Template | Layout (see registry) | Accent (default theme) | Spec |
| --- | --- | --- | --- |
| rhyhorn | single / left header | olive `#65a30d` | [rhyhorn.md](./rhyhorn.md) |
| azurill | sidebar-left / center header | amber `#d97706` | [azurill.md](./azurill.md) |
| pikachu | sidebar-left / left header, contact in sidebar | yellow `#ca8a04` | [pikachu.md](./pikachu.md) |
| nosepass | single / left header | blue `#3b82f6` | [nosepass.md](./nosepass.md) |
| bronzor | single / center header | cyan `#0891b2` | [bronzor.md](./bronzor.md) |
| chikorita | sidebar-right / left header | green `#16a34a` | [chikorita.md](./chikorita.md) |
| ditto | sidebar-left / banner | cyan `#0891b2` | [ditto.md](./ditto.md) |
| gengar | sidebar-left / sidebar header | teal `#67b8c8` | [gengar.md](./gengar.md) |
| glalie | sidebar-left / sidebar header | teal `#14b8a6` | [glalie.md](./glalie.md) |
| kakuna | single / boxed header | stone `#78716c` | [kakuna.md](./kakuna.md) |
| leafish | header-split / banner | rose `#9f1239` | [leafish.md](./leafish.md) |
| onyx | single / left header | red `#dc2626` | [onyx.md](./onyx.md) |

## Typography and #701

Schema default `metadata.typography.font` is **IBM Plex Serif** at 14pt with
`lineHeight: 1.5`. Almost every template then re-locks body size (~9–10pt) and
leading (~0.65em) and most lock **IBM Plex Sans**. Issue #701 should:

- **Make configurable (honour metadata):** body font size and line height
  (with a documented, clamped `lineHeight` → Typst `leading` mapping), and
  surface when a control is inert for the active template.
- **Keep as template identity:** the named family pair (Sans vs Serif),
  heading case/chrome, and whether the template paints a full-bleed sidebar
  that ignores `page.margin`. The `template-default` level glyph left this
  list in #919 — it is the sheet's five dots on every template now.

Display sizes (name ~18–28pt, section titles ~8–11pt) stay template-authored.
There is no separate mono face in Typst. Education dates use the muted body face
on the PDF and in Done mode; Edit mode keeps `--doc-font-mono` as a sanctioned
editing affordance (#860).

## Divergence tags

Each template lists concrete deltas with one of:

- `fix-in-typst` — change the Typst template (or `_common.typ`) to match the
  sheet, the stated intent, or to fix a render bug. Since #919 this is where a
  sheet-vs-PDF delta goes by default.
- `fix-in-sheet` — change the document sheet / CSS. Reserved for sheet bugs and
  for the cases where the sheet is the side that is wrong; it is no longer the
  landing place for a plain sheet-vs-PDF disagreement.
- `owner-decision-needed` — sheet and Typst disagree on purpose or the intended
  behaviour is ambiguous; do not "fix" either side without a call.

Slash-separated tags (`fix-in-sheet / owner-decision-needed`) are valid: the
owner call decides the contract, then the remaining side implements it. Do not
treat them as two simultaneous patches.

### Cross-cutting sheet vs PDF notes

These recur on almost every template; each template page repeats only the ones that matter locally.

| Divergence | Tag | Notes |
| --- | --- | --- |
| Experience lead field | — | Closed by #858: **position-first on all 12 templates**, sheet and PDF. Position leads; company and dates follow, styled per each frozen spec. Do not revert the eight previously company-first Typst templates (rhyhorn, bronzor, azurill, chikorita, ditto, gengar, glalie, leafish). |
| Education lead field | — | Closed by #829 / `item-presentation.md`: degree-first, never `" in "`. Per-template tables that still say institution-first are stale. |
| Section-heading chrome is template-specific in Typst; the sheet uses one `.doc-sheet__sec-title` treatment for all `tpl-*` ids | fix-in-typst | Still open. Per-template heading chrome the sheet does draw (`--heading-*` modifiers) is the target; Typst's extra band/rule variants converge onto it. |
| Accent ink, sidebar tint, muted ink | fixed (#919) | Closed: templates paint the raw `primary` seed as accent (`--doc-sheet-accent`), `sheet-sidebar-tint()` for `accent 15%` sidebars under normal ink, and `sheet-muted()` for `text 60%`. The old `darken(15–45%)` accent step is gone; it was an unenforced WCAG-AA convention with no gate behind it. |
| Column padding on full-bleed templates (pikachu, ditto, gengar, glalie) | fixed (#919) | Closed: insets follow `.doc-sheet__side` 1.6rem/0.95rem and `.doc-sheet__main` 1.6rem/1.45rem at 1rem = 12pt. Single-column `page.margin` stays at 48pt — the sheet's scroll-surface padding is not a print margin. |
| Document face | — | Already in lockstep: Sans everywhere except nosepass (`IBM Plex Serif`) and glalie (inherits the engine's Serif default), asserted against `templateDocFontFamily()` by `apps/web/src/lib/__tests__/docLayout.test.ts`. Base size is `metadata.typography.font.size` on both sides — the sheet's 12.5px ≈ 9.4pt is its CSS fallback, not a second source. |
| Profile label | — | Closed by #829: username-first (`auto`). Templates may pass `network` / `network-username` only when a later spec change re-declares that mode. |
| Level glyphs | fixed (#919) | Closed: `template-default` is the sheet's five 6pt dots on all 12 templates (`sheet-level-dots()`), flat accent over a flat `#d6d3d1` track, no outline. Explicit `metadata.levelDisplay` overrides keep `render-level`'s outlined indicators. |
| Skill / interest keywords | fixed (#919) | Closed: `render-item-tag-chips()` paints `.doc-sheet__tag-chip` (999pt radius, `color-mix(accent 10%, bg)` fill, `color-mix(accent 28%, #e7e5e4)` border) for skills and interests on every template. nosepass keeps its boxed skill pill — the pill is already the chip there. Project / custom keywords stay per-template. |
| Avatar without photo | — | Closed by #857: photo-less default is **collapsed**; initials disc is `showInitials` opt-in. Hidden photos collapse. No pikachu exception. |
| Education dates: PDF and Done mode use the muted body face; Edit mode uses `--doc-font-mono` | — | Closed by #860. Documented in [`item-presentation.md`](../design/item-presentation.md). |
| `metadata.typography.font.size` / `lineHeight`: engine emits a top-level `#set text`, then nearly every template re-locks size and leading | fix-in-typst | Tracked by #701 — lift shared resolution into `_common.typ`. |
| `page.margin` on full-bleed templates (pikachu, ditto, gengar, glalie) | decided (#859) | Owner: PDFs keep ignoring it. Template metadata declares `supportsMargins: false`; the editor disables the margin control with an accessible explanation. |

## Related code

- Sheet: `apps/web/src/components/doc-editor/DocSheet.tsx`, `DocSection.tsx`,
  `DocHeader.tsx`, `docSheet.css`
- Layout mirror (client): `apps/web/src/lib/docLayout.ts` (`bundledTemplateLayout`)
- Themes: `get_template_theme` in `crates/render/src/typst_engine/engine.rs`
