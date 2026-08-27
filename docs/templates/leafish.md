# leafish

Two-tier rose header band above equal columns; `custom` defaults into the right column.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/leafish.*` (not
a 1:1 target).

## Theme

background `#ffffff`, text `#1f2937`, primary `#9f1239`, used raw as accent ink. The tier-1 band is
`color-mix(accent 12%, bg)` under normal ink, matching `.doc-sheet__banner--tint` (#919); the
contact bar keeps its solid rose fill.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / 0.65em | Template-locked |
| Display | Name 24pt bold accent on tier-1; headings 9pt uppercase + 1.5pt bottom stroke | Same family |
| Mono | None | |

**#701:** configurable size/leading; two-tier header + equal columns stay identity. Sidebar ratio
intentionally not wired (#84).

## Header composition

- `headerStyle`: `banner`; `contactIn`: `banner` (tier-2 bar).
- Tier 1: name/headline left, optional picture + personal URL right, light rose fill, top radius 6pt.
- Tier 2: darker bar with email/phone/location joined by `|`, bottom radius 6pt.
- No-photo default: **collapse** the picture cell; URL may still show on the right. Initials disc
  only when `picture.effects.showInitials` is true and the URL is empty (#857).

## Section-heading chrome

**Bottom-stroke uppercase** (same style both columns).

## Column structure

[`get_template_layout("leafish")`](../../crates/render/src/typst_engine/template_layout.rs) —
`HeaderSplit`, equal columns; **custom in sidebar/right column**.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Position-first** (bold); company under (accent, linked when a URL is set); date/location right muted (#858) |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | `network-username` |
| Skill / interest keywords | Themed pill chips (`render-item-tag-chips`, #919) — the sheet's `keywordStyle: "chips"` |
| Project keywords | Soft accent chips (template-local) |
| Level (`template-default`) | Sheet-parity five dots: 4.5pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.25pt apart (#919) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet banner is one band; Typst is explicitly two-tier (wash + contact bar). The two-tier header is leafish's identity, so flattening it onto the sheet's single banner is not a given — same carve-out as nosepass's skill pill | owner-decision-needed |
| Keyword chips: the sheet selects leafish's `keywordStyle: "chips"`, and Typst paints `.doc-sheet__tag-chip` for skills and interests | fixed (#919) |
| Experience lead field was company-first in Typst | fixed (#858) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/leafish.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "leafish"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
