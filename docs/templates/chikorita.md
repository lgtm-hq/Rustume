# chikorita

Left header above a main+right-sidebar split; green accents; thick bottom-stroke main headings.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/chikorita.*`
(not a 1:1 target).

## Theme

background `#ffffff`, text `#166534`, primary `#16a34a`.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / 0.65em | Template-locked |
| Display | Name 26pt; main headings 10pt uppercase in a bottom-stroke box; sidebar 9pt uppercase + thin rule | Same family |
| Mono | None | |

**#701:** configurable size/leading; keep green identity + dual heading chrome.

## Header composition

- `headerStyle`: `left`; `contactIn`: `header` (inline contact under headline).
- Picture above name when visible. No-photo default: **collapse**. Initials disc only when
  `picture.effects.showInitials` is true and the URL is empty (#857).
- Columns: main left / sidebar right via `two-column` defaults `(2fr, 1fr)`.

## Section-heading chrome

- **Main:** uppercase accent title inside a full-width box with **2pt bottom stroke**.
- **Sidebar:** uppercase + 0.5pt underline.

## Column structure

[`get_template_layout("chikorita")`](../../crates/render/src/typst_engine/template_layout.rs) —
`SidebarRight`, left header, proportional width.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Education order | Institution + degree under; date right; score; summary |
| Profile label mode | `network-username` |
| Skill keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Interest keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Experience order | **Position-first** (bold) over company (accent); date/location right (#858) |
| Project keywords | Soft chips |
| Level (`template-default`) | Sheet-parity five dots: 4.5pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.25pt apart (#919) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet does not swap visual sidebar to the right from `layoutMode` chrome alone without matching heading styles | fix-in-typst |
| Main bottom-stroke headings vs the sheet's underline + uppercase chrome (`bundledTemplateLayout`: `chromeUnderlineChips`) — stroke weight and dual scales remain Typst extras | fix-in-typst |
| Experience lead field was company-first in Typst | fixed (#858) |
| Typography metadata ignored | fix-in-typst (#701) |
| **Body starts on page 2** — PDF page 1 held only the header because the tinted sidebar wrapped in an unbreakable Typst `box`, forcing the two-column grid onto the next page. Fixed in #855 by using a breakable `block` for the sidebar fill. | fixed (#855) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/chikorita.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "chikorita"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
