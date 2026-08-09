# kakuna

Single-column stone resume whose identity is a centered name block inside a stroked rounded box.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/kakuna.*` (not a 1:1 target).

## Theme

background `#ffffff`, text `#422006`, primary `#78716c`.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / leading **0.7em** | Slightly looser leading |
| Display | Name 24pt **light** weight inside the box; headings 10pt semibold uppercase with trailing rule on the same row | Same family |
| Mono | None |

**#701:** configurable size/leading; boxed header + light name weight stay identity.

## Header composition

- `headerStyle`: `boxed`; `contactIn`: `header` (contact inside the box, middot-joined).
- Picture optional inside the box; no initials fallback.
- Box: 1pt `border-color` stroke, 4pt radius, padded.

## Section-heading chrome

**Rule row:** semibold uppercase title + trailing accent rule (kakuna/nosepass family of chrome).

## Column structure

[`get_template_layout("kakuna")`](../../crates/render/src/typst_engine/template_layout.rs) — `Single`, boxed header.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | `network-username` |
| Skill keywords | Comma-joined |
| Interest keywords | ` — ` + comma list |
| Project keywords | Soft chips on some items; skills comma |
| Level (`template-default`) | Rounded squares 8×8pt |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet `headerStyle: boxed` draws a stroked banner approximation; Typst centers a full-width padded box including contact | fix-in-sheet |
| Heading trailing-rule chrome missing | fix-in-sheet |
| Light name weight not mirrored | fix-in-sheet |
| Cross-cutting item composition | fix-in-sheet / owner-decision-needed |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/kakuna.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "kakuna"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
