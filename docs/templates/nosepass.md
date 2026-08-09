# nosepass

Serif single-column resume with a thick accent header underline and title+trailing-rule section
headings.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/nosepass.*` (not
a 1:1 target).

## Theme

background `#ffffff`, text `#1f2937`, primary `#3b82f6`.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | **IBM Plex Serif** 10pt / 0.65em | Template identity — only nosepass hardcodes Serif |
| Display | Name 28pt bold in accent; section titles 11pt bold title-case with trailing rule | Serif |
| Mono | None | |

**#701:** size/leading configurable; **Serif family stays identity** (do not let a global Sans
default restyle nosepass).

## Header composition

- `headerStyle`: `left`; `contactIn`: `header`.
- Header sits in a box with a **3pt accent bottom stroke**.
- Picture optional above the name; no initials fallback.
- Contact as an inline row.

## Section-heading chrome

**Rule (title + trailing line).** Title (not uppercased) beside a 1pt rule on the same row
(`border-color`).

## Column structure

[`get_template_layout("nosepass")`](../../crates/render/src/typst_engine/template_layout.rs) —
`Single`, left header.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Position-first** (accent bold); company below, `· location` muted; date via `date-badge` — already sheet-aligned |
| Education order | Institution (accent bold) + degree; score inline as `· GPA: …`; date via `date-badge` |
| Profile label mode | `network-username` |
| Skill keywords | Comma-joined inside bordered skill chips |
| Interest keywords | ` — ` + comma list inside the interest chip row |
| Level (`template-default`) | Filled/outline `●` text bullets inside the skill chip |

Skills render as wrapped bordered chips, not rows.

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| **Typst compile failure** on languages row: `stroke: (dash: "dotted") + border-color` is invalid Typst (`cannot add dictionary and color`) — fixture does not render | fix-in-typst |
| Sheet uses Sans (`--font-body`); PDF is Serif | fix-in-sheet |
| Sheet headings are uppercase-ish generic; Typst is title-case + trailing rule | fix-in-sheet |
| Skill presentation (chip cloud vs compact rows) | fix-in-sheet |
| Level text bullets vs sheet dots | fix-in-sheet |
| Cross-cutting experience/education order | fix-in-sheet / owner-decision-needed |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/nosepass.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "nosepass"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
