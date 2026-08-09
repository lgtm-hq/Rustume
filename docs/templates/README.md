# Template design specs

Frozen design references for the twelve bundled Typst templates. The
template-fidelity epic implements sheet chrome and Typst parity against these
documents — not against memory of Reactive Resume (RR) artboards.

## Source of truth

1. **Typst** — `crates/render/src/typst_engine/templates/<id>.typ` (+ helpers in
   `_common.typ`). When the sheet and PDF disagree, the Typst source is the
   default target unless a divergence is tagged `owner-decision-needed`.
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
There is no separate mono face in Typst; the sheet's `--font-mono` dates are a
sheet-only convention until an owner decision says otherwise.

## Divergence tags

Each template lists concrete deltas with one of:

- `fix-in-sheet` — change the document sheet / CSS to match Typst.
- `fix-in-typst` — change the Typst template (or `_common.typ`) to match the
  stated intent or to fix a render bug.
- `owner-decision-needed` — sheet and Typst disagree on purpose or the intended
  behaviour is ambiguous; do not "fix" either side without a call.

### Cross-cutting sheet vs PDF notes

These recur on almost every template; each template page repeats only the ones that matter locally.

| Divergence | Tag | Notes |
| --- | --- | --- |
| Experience lead field: sheet draws **position** over `company · date`; eight Typst templates lead with **company** (rhyhorn, bronzor, azurill, chikorita, ditto, gengar, glalie, leafish) while **pikachu, nosepass, onyx, kakuna are already position-first** (sheet-aligned) | fix-in-sheet | Sheet follows `docs/design/doc-editor.md` §1.7; company-first Typst still mirrors the adapted-from RR artboard. Pick one contract for the fidelity epic; do not "fix" the four position-first templates toward company. |
| Education lead field: sheet draws **studyType** then `institution · area`; Typst leads with **institution** then `format-degree(studyType, area)` | fix-in-sheet / owner-decision-needed | Same split as experience. Score is often omitted on the sheet. |
| Section-heading chrome is template-specific in Typst; the sheet uses one `.doc-sheet__sec-title` treatment for all `tpl-*` ids | fix-in-sheet | Per-template heading chrome is the sheet-chrome epic's job; this audit freezes the Typst target. |
| Profile label: sheet prefers **username** else network; Typst `label-mode` varies per template | fix-in-sheet | Honour each template's `label-mode` once sheet chrome is per-template. |
| Level glyphs: sheet always draws five dots; Typst `template-default` is bars / squares / dots / text bullets per template, and `metadata.levelDisplay` can override | fix-in-sheet | Sheet should follow `levelDisplay`, with `template-default` matching the template native glyph. |
| Skill / interest keywords: sheet uses soft tag chips for skills (and experience/education extras); Typst mixes comma lists, middots, chips, and `— keywords` | fix-in-sheet | Match the Typst treatment named in each template spec. |
| Avatar without photo: sheet shows an initials disc in edit mode and hides the avatar in Done mode; Typst usually omits the picture entirely | owner-decision-needed | Only **pikachu** draws a PDF initials fallback today. |
| Mono dates: sheet uses `--font-mono` for education dates; Typst uses muted body face | owner-decision-needed | Mono is a sheet editing affordance; decide whether PDF should match. |
| `metadata.typography.font.size` / `lineHeight`: engine emits a top-level `#set text`, then nearly every template re-locks size and leading | fix-in-typst | Tracked by #701 — lift shared resolution into `_common.typ`. |

## Related code

- Sheet: `apps/web/src/components/doc-editor/DocSheet.tsx`, `DocSection.tsx`,
  `DocHeader.tsx`, `docSheet.css`
- Layout mirror (client): `apps/web/src/lib/docLayout.ts` (`bundledTemplateLayout`)
- Themes: `get_template_theme` in `crates/render/src/typst_engine/engine.rs`
