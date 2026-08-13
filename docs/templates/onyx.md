# onyx

Single-column red-accent resume; split header like rhyhorn; uppercase bottom-stroke headings; square
levels.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/onyx.*` (not a
1:1 target).

## Theme

background `#ffffff`, text `#111827`, primary `#dc2626`.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / 0.65em | Template-locked |
| Display | Name 26pt; headings 10pt bold uppercase in a 1.5pt bottom-stroke box | Same family |
| Mono | None | |

**#701:** configurable size/leading; red identity + bottom-stroke headings stay.

## Header composition

- `headerStyle`: `left`; `contactIn`: `header` — name/headline left (picture beside name),
  contact stacked right.
- No-photo: omit picture.

## Section-heading chrome

**Bottom-stroke uppercase band-line** (box with bottom stroke only, not a filled band).

## Column structure

[`get_template_layout("onyx")`](../../crates/render/src/typst_engine/template_layout.rs) — `Single`,
left header (same structural bucket as rhyhorn).

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Position-first** (bold, text ink); company in accent below, `· location` muted — already sheet-aligned |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | URL → `network`; else `network-username` |
| Skill / project keywords | Soft accent chips |
| Interest keywords | ` — ` + comma list |
| Level (`template-default`) | Squares 8×8pt (radius 0) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Visually close to rhyhorn on the sheet today; Typst headings/levels/keyword chips differ — and item composition does too (onyx is position-first, rhyhorn company-first) | fix-in-sheet |
| Profile `network` when linked vs sheet username-first | fix-in-sheet |
| Level squares vs sheet dots | fix-in-sheet |
| Cross-cutting experience/education order | fix-in-sheet / owner-decision-needed |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/onyx.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "onyx"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
