# onyx

Single-column red-accent resume; split header like rhyhorn; uppercase bottom-stroke headings; dot
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
- No-photo default: **collapse** the slot (name/contact reflow). Initials disc only when
  `picture.effects.showInitials` is true and the URL is empty (#857).

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
| Skill / interest keywords | Themed pill chips (`render-item-tag-chips`, #919) — the sheet's `keywordStyle: "chips"` |
| Project keywords | Soft accent chips (template-local) |
| Level (`template-default`) | Sheet-parity five dots: 4.5pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.25pt apart (#919) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Visually close to rhyhorn on the sheet today; Typst heading chrome still differs (levels and keyword chips converged in #919; experience is position-first on both as of #858) | fix-in-typst |
| Profile `network` when linked vs sheet username-first | fix-in-typst |
| Level squares vs sheet dots | fixed (#919) |
| Experience lead field | fixed (#858) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/onyx.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "onyx"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
