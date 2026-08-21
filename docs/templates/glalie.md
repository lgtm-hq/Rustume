# glalie

Traditional teal sidebar resume; title-case underlined headings; inherits engine font family (Serif
by schema default).

Adapted-from context: Reactive Resume artboard `apps/web/public/templates/{jpg,pdf}/glalie.*` (not a
1:1 target).

## Theme

background `#ffffff`, text `#0f172a`, primary `#14b8a6`.

## Typefaces

| Role | Face | Notes |
| --- | --- | --- |
| Body | **Inherits engine `#set text` font/size** (schema default IBM Plex Serif 14pt), then template sets fill only; leading 0.65em, justify true | Unique: family/size not re-locked to Sans/10pt |
| Display | Sidebar name 18pt; main headings 11pt title-case + 1pt rule; sidebar 10pt title-case + 0.75pt rule | No forced uppercase |
| Mono | None | |

**#701:** glalie already demonstrates metadata family/size flowing through — keep that behaviour;
clamp leading; do not hardcode Sans here (identity is "engine typography + traditional chrome").

## Header composition

- `headerStyle`: `sidebar`; `contactIn`: `sidebar`.
- Photo 80pt when present. No-photo default: **collapse**. Initials disc only when
  `picture.effects.showInitials` is true and the URL is empty (#857).
- Full-bleed sidebar (`margin: 0`): the page box ignores `page.margin`;
  `content-width()` still subtracts metadata margin for sidebar-ratio math.

## Section-heading chrome

**Underline, title-case (not uppercased)** for both columns; sidebar slightly smaller.

## Column structure

[`get_template_layout("glalie")`](../../crates/render/src/typst_engine/template_layout.rs) — same
structural shape as gengar (170pt sidebar-left).

Default main / sidebar section ids are defined once in
[`template_layout.rs`](../../crates/render/src/typst_engine/template_layout.rs)
(mirroring `_common.typ`); do not fork lists here.

## Item composition

| Concern | Rule |
| --- | --- |
| Experience order | **Position-first** (bold); company under; date/location right muted (#858) |
| Education order | Institution + degree; date right; score; summary |
| Profile label mode | `network-username` |
| Skill / interest / project keywords | Comma-joined muted |
| Level (`template-default`) | Circles 6pt |

Shared extras from `_common.typ` (experience/education keyword chips + custom
fields; projects/skills custom fields) still apply on top of the native item
bodies above.

## Divergences (sheet vs PDF vs this spec)

| Divergence | Tag |
| --- | --- |
| Sheet locks IBM Plex Serif; PDF honors `metadata.typography.font.family` (schema default Serif) | owner-decision-needed |
| Sheet uppercases section titles; Typst keeps title-case | fix-in-sheet |
| Justify-on in Typst vs sheet left-aligned body | fixed (#860): sheet body (`summary` / entry sum / desc) is justified, both modes |
| Experience lead field was company-first in Typst | fixed (#858) |
| `page.margin` does not inset the page box (full-bleed); `content-width()` still uses it for ratio math | owner-decision-needed (surface in UI) |

### Audit evidence

- Typst: `crates/render/src/typst_engine/templates/glalie.typ`
- Fixture text extract: `tests/fixtures/v3/doc-editor.json` with
  `metadata.template = "glalie"` via
  `crates/render/examples/render_json.rs` (`--text`), except where noted as
  failing to compile.
