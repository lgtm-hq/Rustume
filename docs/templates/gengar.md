# gengar

Identity lives in a tinted 170pt left sidebar (name, contact, photo); main column uses heavier
uppercase underlines.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/gengar.*` (not a
1:1 target).

## Theme

background `#ffffff`, text `#1f2937`, primary `#67b8c8`. Sidebar bg lighten 90%; sidebar text darken
50%.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / 0.65em | Template-locked; sidebar wrapper recolors ink |
| Display | Sidebar name 18pt; main headings 11pt uppercase + 1.5pt rule; sidebar headings 9pt uppercase + 1pt rule | Same family |
| Mono | None | |

**#701:** configurable size/leading; sidebar-as-header identity stays.

## Header composition

- `headerStyle`: `sidebar`; `contactIn`: `sidebar`.
- Photo centered at 80pt when present; **no initials fallback**.
- Contact plain stacked lines (8pt); URL in accent.
- Full-bleed sidebar (`margin: 0`): the page box ignores `page.margin`;
  `content-width()` still subtracts metadata margin for sidebar-ratio math.

## Section-heading chrome

- **Main:** uppercase (text-color title) + 1.5pt accent underline.
- **Sidebar:** uppercase accent + 1pt underline.

## Column structure

[`get_template_layout("gengar")`](../../crates/render/src/typst_engine/template_layout.rs) —
`SidebarLeft`, sidebar header/contact, fixed **170pt**.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Company-first** (bold, linked); position under; date/location right |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | `network-username` |
| Skill keywords | Comma-joined 8pt |
| Interest keywords | Comma-joined 8pt |
| Project keywords | Soft chips |
| Level (`template-default`) | Rounded boxes 8×8pt (radius 1pt) |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet sidebar header/contact placement exists, but heading/level chrome still generic | fix-in-sheet |
| Level boxes vs sheet dots | fix-in-sheet |
| No PDF initials fallback while sheet edit mode shows initials | owner-decision-needed |
| Cross-cutting experience/education order | fix-in-sheet / owner-decision-needed |
| `page.margin` does not inset the page box (full-bleed); `content-width()` still uses it for ratio math | owner-decision-needed / fix-in-sheet (UI only) |
| Typography metadata ignored | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/gengar.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "gengar"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
