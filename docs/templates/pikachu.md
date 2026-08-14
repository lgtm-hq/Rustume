# pikachu

Bold yellow-tinted left sidebar holding photo/contact; main column uses filled accent heading bands.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/pikachu.*` (not
a 1:1 target).

## Theme

background `#ffffff`, text `#1c1917`, primary `#ca8a04`. Sidebar bg = primary lighten 85%; sidebar
text = primary darken 60%.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / 0.65em | Template-locked (also historically the only template that experimented with reading `typography`) |
| Display | Name 26pt in main; main section titles white on accent band; sidebar titles 9pt uppercase, no rule | Same family |
| Mono | None | |

**#701:** pikachu is the reference for honouring size/lineHeight once lifted to `_common.typ`; keep
band headings + sidebar tint as identity. Full-bleed sidebar uses `margin: 0` — page.margin inert by
design (surface in UI).

## Header composition

- `headerStyle`: `left` (name/headline in **main** via `main-before`).
- `contactIn`: `sidebar` under a "Contact" sidebar heading, with icons via `contact-item`.
- Picture: centered in sidebar, default **80pt**.
- **No-photo fallback: initials disc** (accent fill, white initials from `basics.name`) —
  unique among the twelve.

## Section-heading chrome

- **Main:** filled accent **band** (2pt radius) with uppercase white title.
- **Sidebar:** plain uppercase accent title, no underline.

## Column structure

[`get_template_layout("pikachu")`](../../crates/render/src/typst_engine/template_layout.rs) —
`SidebarLeft`, fixed **180pt** sidebar (ratio-aware).

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Education order | Stacked (not side-by-side): institution → degree → score → date → summary — sized for the narrow sidebar default |
| Profile label mode | `network` |
| Skill keywords | Comma-joined 8pt muted |
| Interest keywords | Comma-joined 8pt muted under name |
| Project / custom keywords | Middot ` · ` joined |
| Level (`template-default`) | Circles 6pt |

Experience in main: **position** bold over company + date (the #858 contract).

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet lacks filled heading bands / plain sidebar titles | fix-in-sheet |
| Sheet profile prefers username; Typst uses `network` | fix-in-sheet |
| Sheet Done-mode hides empty avatar; PDF always shows initials fallback | owner-decision-needed |
| Education on sheet uses degree-first row layout even when education sits in the sidebar | fix-in-sheet |
| `page.margin` inert — document as intentional; surface in editor | owner-decision-needed / fix-in-sheet (UI only) |
| Typography honouring incomplete across templates | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/pikachu.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "pikachu"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
