# kakuna

Single-column stone resume whose identity is a centered name block inside a stroked rounded box.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/kakuna.*` (not a
1:1 target).

## Theme

background `#ffffff`, text `#422006`, primary `#78716c`.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / leading **0.7em** | Slightly looser leading |
| Display | Name 24pt **light** weight inside the box; headings 10pt semibold uppercase with trailing rule on the same row | Same family |
| Mono | None | |

**#701:** configurable size/leading; boxed header + light name weight stay identity.

## Header composition

- `headerStyle`: `boxed`; `contactIn`: `header` (contact inside the box, middot-joined).
- Picture optional inside the box. No-photo default: **collapse**. Initials disc only when
  `picture.effects.showInitials` is true and the URL is empty (#857).
- Box: 1pt `border-color` stroke, 4pt radius, padded.

## Section-heading chrome

**Rule row:** semibold uppercase title + trailing accent rule (kakuna/nosepass family of chrome).

## Column structure

[`get_template_layout("kakuna")`](../../crates/render/src/typst_engine/template_layout.rs) —
`Single`, boxed header.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Position-first** (semibold); `— company` muted on the same line; location on its own row — already sheet-aligned |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | `network-username` |
| Skill keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Interest keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Project keywords | Soft chips on some items; skills comma |
| Level (`template-default`) | Sheet-parity five dots: 6pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.5pt apart (#919) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet `headerStyle: boxed` draws a stroked banner approximation; Typst centers a full-width padded box including contact | fix-in-typst |
| Heading trailing-rule chrome missing | fix-in-typst |
| Light name weight not mirrored | fix-in-typst |
| Experience lead field | fixed (#858) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/kakuna.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "kakuna"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
