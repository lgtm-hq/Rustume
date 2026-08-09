# ditto

Full-bleed accent banner header with contact; fixed tinted left sidebar; compact 9pt body.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/ditto.*` (not a 1:1 target).

## Theme

background `#ffffff`, text `#1f2937`, primary `#0891b2`. Banner fill uses accent; sidebar tint = primary lighten.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans **9pt** / leading **0.6em** | Slightly denser than the 10pt peers |
| Display | Name 22pt bold white on banner; main headings 9pt uppercase bottom-stroke; sidebar 8pt uppercase + rule | Same family |
| Mono | None |

**#701:** configurable size/leading with ditto's denser defaults as the template baseline; banner + 160pt sidebar stay identity. `margin: 0` for full-bleed banner/sidebar.

## Header composition

- `headerStyle`: `banner`; `contactIn`: `banner`.
- Full-width accent bar: optional picture, white name, lightened headline, contact joined with ` | `.
- No-photo: omit picture.
- Sidebar continues below the banner (layout `full-header-sidebar`).

## Section-heading chrome

- **Main:** uppercase accent title with 1.5pt bottom stroke.
- **Sidebar:** smaller uppercase + 0.5pt rule.

## Column structure

[`get_template_layout("ditto")`](../../crates/render/src/typst_engine/template_layout.rs) — `SidebarLeft`, banner, fixed **160pt** sidebar.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | `network-username` |
| Skill keywords | Comma-joined 7pt |
| Interest / project keywords | Soft chips |
| Level (`template-default`) | Circles 6pt when level > 0 |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet banner tint/boxing approximates banner but not ditto's solid accent fill + white type | fix-in-sheet |
| Body 9pt denser leading not mirrored on sheet | fix-in-sheet |
| Cross-cutting item composition | fix-in-sheet / owner-decision-needed |
| `page.margin` inert (full-bleed) | owner-decision-needed (surface in UI) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/ditto.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "ditto"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
