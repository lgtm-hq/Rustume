# azurill

Centered header over a proportional left sidebar; amber accents; main vs sidebar heading weights
differ.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/azurill.*` (not
a 1:1 target).

## Theme

background `#ffffff`, text `#1f2937`, primary `#d97706`. Accent ink is the raw primary, as the
sheet paints `--doc-sheet-accent` (#919). No full-bleed column fill: the primary shows only
through keyword chips and level dots.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / 0.65em | Template-locked |
| Display | Name 26pt bold tracking 0.03em; main headings 11pt bold uppercase; sidebar headings 9pt semibold uppercase | Same family |
| Mono | None | |

**#701:** configurable size/leading; keep Sans + dual heading scale as identity.

## Header composition

- `headerStyle`: `center`; `contactIn`: `header` (horizontal contact row under the headline).
- Picture: centered above the name when visible.
- No-photo default: **collapse**. Initials disc only when `picture.effects.showInitials` is true
  and the URL is empty (#857).
- Columns below use `two-column` with default `(1fr, 2fr)` sidebar-left via `sidebar-ratio-columns`.

## Section-heading chrome

- **Main:** uppercase accent title + 1.5pt accent underline.
- **Sidebar:** smaller semibold uppercase + 0.75pt underline.

## Column structure

[`get_template_layout("azurill")`](../../crates/render/src/typst_engine/template_layout.rs) —
`SidebarLeft`, `headerStyle: Center`, `contactIn: Header`, proportional width (`sidebar_width:
None`).

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Education order | **institution** bold + degree under; date right; score as `Score: …`; summary |
| Profile label mode | `username` |
| Skill keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Interest keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Level (`template-default`) | Sheet-parity five dots: 6pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.5pt apart (#919) |

Experience: **position** bold over company; date/location right column (#858).

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet heading chrome is single-style; Typst has main vs sidebar weights | fix-in-typst |
| Native level bars vs sheet dots | fixed (#919) |
| Profile sheet label (username-first) matches Typst `username` — OK; still diverges when only network is set | fix-in-typst |
| Skill / interest keywords now share the sheet's pill chips | fixed (#919) |
| Accent ink, level dots and keyword chips follow the sheet | fixed (#919) |
| Experience lead field was company-first in Typst | fixed (#858) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/azurill.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "azurill"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
