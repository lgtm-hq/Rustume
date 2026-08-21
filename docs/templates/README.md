# Template design specs

Frozen design references for the twelve bundled Typst templates. The
template-fidelity epic implements sheet chrome and Typst parity against these
documents — not against memory of Reactive Resume (RR) artboards.

## Source of truth

1. **Typst** — `crates/render/src/typst_engine/templates/<id>.typ` (+ helpers in
   `_common.typ`). When the sheet and PDF disagree, the Typst source is the
   default target unless a divergence is tagged `owner-decision-needed`.
   **Item composition** (profile labels, education field order, avatar initials,
   keyword presence, level clamp) is owned by
   [`item-presentation.md`](../design/item-presentation.md) (#829) and wins over
   per-template Item composition tables that still describe the pre-unification
   audit.
2. **Layout registry** — column mode, default section columns, `headerStyle`,
   `contactIn`, and sidebar width live in
   [`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs).
   Specs link there instead of duplicating column lists.
3. **Shared fixture** — `tests/fixtures/v3/doc-editor.json`, rendered with
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
  heading case/chrome, native `template-default` level glyph, and whether the
  template paints a full-bleed sidebar that ignores `page.margin`.

Display sizes (name ~18–28pt, section titles ~8–11pt) stay template-authored.
There is no separate mono face in Typst. Education dates use the muted body face
on the PDF and in Done mode; Edit mode keeps `--doc-font-mono` as a sanctioned
editing affordance (#860).

## Divergence tags

Each template lists concrete deltas with one of:

- `fix-in-sheet` — change the document sheet / CSS to match Typst.
- `fix-in-typst` — change the Typst template (or `_common.typ`) to match the
  stated intent or to fix a render bug.
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
| Section-heading chrome is template-specific in Typst; the sheet uses one `.doc-sheet__sec-title` treatment for all `tpl-*` ids | fix-in-sheet | Per-template heading chrome is the sheet-chrome epic's job; this audit freezes the Typst target. |
| Profile label | — | Closed by #829: username-first (`auto`). Templates may pass `network` / `network-username` only when a later spec change re-declares that mode. |
| Level glyphs: sheet always draws five dots; Typst `template-default` is bars / squares / dots / text bullets per template, and `metadata.levelDisplay` can override | fix-in-sheet | Sheet should follow `levelDisplay`, with `template-default` matching the template native glyph. |
| Skill / interest keywords: sheet uses soft tag chips for skills (and experience/education extras); Typst mixes comma lists, middots, chips, and `— keywords` | fix-in-sheet | Match the Typst treatment named in each template spec. |
| Avatar without photo | — | Closed by #857: photo-less default is **collapsed**; initials disc is `showInitials` opt-in. Hidden photos collapse. No pikachu exception. |
| Mono dates: sheet uses `--doc-font-mono` for education dates; Typst uses muted body face | — | Closed by #860: Done mode uses the muted body face (PDF). Edit mode keeps mono as a sanctioned editing affordance. Documented in [`item-presentation.md`](../design/item-presentation.md). |
| `metadata.typography.font.size` / `lineHeight`: engine emits a top-level `#set text`, then nearly every template re-locks size and leading | fix-in-typst | Tracked by #701 — lift shared resolution into `_common.typ`. |

## Related code

- Sheet: `apps/web/src/components/doc-editor/DocSheet.tsx`, `DocSection.tsx`,
  `DocHeader.tsx`, `docSheet.css`
- Layout mirror (client): `apps/web/src/lib/docLayout.ts` (`bundledTemplateLayout`)
- Themes: `get_template_theme` in `crates/render/src/typst_engine/engine.rs`
