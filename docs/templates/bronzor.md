# bronzor

Centered single-column cyan resume; uppercase underlined headings; square rating glyphs.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/bronzor.*` (not
a 1:1 target).

## Theme

background `#ffffff`, text `#1f2937`, primary `#0891b2`.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / 0.65em | Template-locked |
| Display | Name 24pt centered; headings 11pt bold uppercase + 0.5pt rule | Same family |
| Mono | None | |

**#701:** configurable size/leading; Sans + centered header identity.

## Header composition

- `headerStyle`: `center`; `contactIn`: `header`.
- Picture centered above name when present. No-photo default: **collapse**. Initials disc only when
  `picture.effects.showInitials` is true and the URL is empty (#857).
- Contact wrapped horizontally under the headline.

## Section-heading chrome

**Underline + uppercase** (same family as rhyhorn): accent title, 0.5pt rule.

## Column structure

[`get_template_layout("bronzor")`](../../crates/render/src/typst_engine/template_layout.rs) —
`Single`, center header.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Position-first** (bold) `— company`; date right; location on its own muted line (#858) |
| Education order | Institution + date; then degree; score; summary (rhyhorn-like) |
| Profile label mode | URL → `username`; else `network-username` |
| Skill / project keywords | Comma-joined muted |
| Interest keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Level (`template-default`) | Sheet-parity five dots: 6pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.5pt apart (#919) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet header is not distinctly centered/contact-wrapped per bronzor | fix-in-typst |
| Heading underline + uppercase missing on sheet | fix-in-typst |
| Level squares vs sheet dots | fixed (#919) |
| Experience lead field was company-first in Typst | fixed (#858) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/bronzor.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "bronzor"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
