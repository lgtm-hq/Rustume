# pikachu

Bold yellow-tinted left sidebar holding photo/contact; main column uses filled accent heading bands.

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/pikachu.*` (not
a 1:1 target).

## Theme

background `#ffffff`, text `#1c1917`, primary `#ca8a04`. Accent ink is the raw primary, as the
sheet paints `--doc-sheet-accent`. Sidebar fill is `color-mix(accent 15%, bg)` under normal
document ink, matching `.doc-sheet--sidebar-tint .doc-sheet__side` (#919).

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
- No-photo default: **collapse** the sidebar slot (reflow). Initials disc only when
  `picture.effects.showInitials` is true and the URL is empty (#857). Same contract as the other
  eleven templates — no pikachu exception.

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
| Skill keywords | Comma-joined muted — the sheet's `keywordStyle: "plain"` (`.doc-sheet--keywords-plain`) |
| Interest keywords | Comma-joined muted — the sheet's `keywordStyle: "plain"` (`.doc-sheet--keywords-plain`) |
| Project / custom keywords | Middot ` · ` joined |
| Level (`template-default`) | Sheet-parity five dots: 4.5pt circles, flat accent fill up to the level, flat `#d6d3d1` after it, 2.25pt apart (#919) |

Experience in main: **position** bold over company + date (the #858 contract).

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Heading chrome: the sheet already selects pikachu's `headingStyle: "band"` + `sidebarHeadingStyle: "plain"` (`bundledTemplateLayout`); only Typst's extra band geometry differs | fix-in-typst |
| Profile label order: both sheet and PDF use the `auto` order (username, then network, then URL label) — pikachu passes `label-mode: "auto"`; do not reintroduce per-template `network` modes | fixed (#829) |
| Photo-less avatar: PDF/Done-mode collapse; edit keeps a placeholder; initials are `showInitials` opt-in | fixed (#857) |
| Education on sheet uses degree-first row layout even when education sits in the sidebar | fix-in-typst |
| Column padding follows `.doc-sheet__side` / `.doc-sheet__main` | fixed (#919) |
| Accent, sidebar tint and level dots follow the sheet; keywords stay the sheet's plain comma list | fixed (#919) |
| `page.margin` inert — document as intentional; editor disables the control | decided (#859) |
| Typography honouring incomplete across templates | fix-in-typst (#701) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/pikachu.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "pikachu"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
