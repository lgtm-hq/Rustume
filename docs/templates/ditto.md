# ditto

Full-bleed accent banner header with contact; fixed tinted left sidebar; compact 9pt body.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/ditto.*` (not a
1:1 target).

## Theme

background `#ffffff`, text `#1f2937`, primary `#0891b2`, used raw as accent ink. Banner fill is the
solid accent; sidebar tint is `color-mix(accent 15%, bg)` (#919).

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans **9pt** / leading **0.6em** | Slightly denser than the 10pt peers |
| Display | Name 22pt bold white on banner; main headings 9pt uppercase bottom-stroke; sidebar 8pt uppercase + rule | Same family |
| Mono | None | |

**#701:** configurable size/leading with ditto's denser defaults as the template baseline; banner +
160pt sidebar stay identity. `margin: 0` for full-bleed banner/sidebar.

## Header composition

- `headerStyle`: `banner`; `contactIn`: `banner`.
- Full-width accent bar: optional picture, white name, lightened headline, contact joined with ` | `.
- No-photo default: **collapse**. Initials disc only when `picture.effects.showInitials` is true
  and the URL is empty (#857).
- Sidebar continues below the banner (layout `full-header-sidebar`).

## Section-heading chrome

- **Main:** uppercase accent title with 1.5pt bottom stroke.
- **Sidebar:** smaller uppercase + 0.5pt rule.

## Column structure

[`get_template_layout("ditto")`](../../crates/render/src/typst_engine/template_layout.rs) —
`SidebarLeft`, banner, fixed **160pt** sidebar.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Position-first** (bold); company under (accent, linked when a URL is set); date/location right (#858) |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | `network-username` |
| Skill keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Interest / project keywords | Soft chips |
| Level (`template-default`) | Sheet-parity five dots: 4.5pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.25pt apart (#919) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet banner tint/boxing approximates banner but not ditto's solid accent fill + white type. The solid banner is ditto's identity, so flattening it onto the sheet's tinted band is not a given — same carve-out as nosepass's skill pill | owner-decision-needed |
| Body 9pt / 0.6em leading is ditto's frozen typeface baseline (see the table above); the sheet reads the shared base size — converging either side changes an identity choice | owner-decision-needed |
| Experience lead field was company-first in Typst | fixed (#858) |
| `page.margin` inert (full-bleed) | decided (#859) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/ditto.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "ditto"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
