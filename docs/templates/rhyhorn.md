# rhyhorn

Single-column olive resume with a split name/contact header and uppercase underlined section titles.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/rhyhorn.*` (not
a 1:1 target).

## Theme

background `#ffffff`, text `#000000`, primary `#65a30d`, used raw as accent ink (#919).

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | IBM Plex Sans 10pt / leading 0.65em | Hardcoded in template; overrides engine `#set text` from metadata |
| Display | Same family, name 24pt bold; section titles 11pt bold uppercase | No separate display family |
| Mono | None in Typst | Sheet mono dates are sheet-only |

**#701:** size + lineHeight should become configurable; **IBM Plex Sans** and the uppercase
underline heading stay identity.

## Header composition

- `headerStyle`: `left` — name/headline left; contact stacked right (`contactIn`: `header`).
- Picture: optional, left of the name when visible (`avatar-beside`, default 64pt).
- No-photo default: **collapse** the slot (name/contact reflow). Initials disc only when
  `picture.effects.showInitials` is true and the URL is empty (#857).
- Accent: thin horizontal rule under the header block.

## Section-heading chrome

**Underline + uppercase.** Title in accent, full-width 0.5pt accent rule beneath.

## Column structure

See [`get_template_layout("rhyhorn")`](../../crates/render/src/typst_engine/template_layout.rs) —
`LayoutMode::Single`, all sections in main, empty sidebar.

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Education order | **institution** (bold) + date right; then `format-degree(studyType, area)`; then score; then summary |
| Profile label mode | URL present → `username`; else `network-username` |
| Skill keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Interest keywords | Themed pill chips (`render-item-tag-chips`, #919) |
| Level (`template-default`) | Sheet-parity five dots: 6pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.5pt apart (#919) |

Experience leads with **position — company** and date right; location on its own muted line (#858).

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet experience field order vs Typst | fixed (#858) |
| Sheet heading chrome lacks uppercase underline | fix-in-typst |
| Sheet always draws level dots; native glyph was rounded squares | fixed (#919) |
| Interest keywords as sheet chips vs Typst `— list` | fixed (#919) |
| No-photo initials on sheet (edit) vs omitted in PDF | fixed (#857): Done/PDF collapse; edit keeps a placeholder; initials are `showInitials` opt-in |
| Hardcoded 10pt / 0.65em ignores metadata typography | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/rhyhorn.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "rhyhorn"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
