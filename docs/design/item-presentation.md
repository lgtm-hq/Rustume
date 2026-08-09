# Item presentation contract

**Owner:** sheet (`DocSection` / `DocHeader`) and Typst (`_common.typ` + per-template
renderers) share one composition contract. Template-specific *styling* (typeface, chip vs
plain keywords, date badge vs muted text) is allowed; field order, label preference, and
fallback rules are not. Divergences that users read as data bugs are regressions against
this document (#829).

Related: [doc-editor.md](./doc-editor.md) §1.7 (sheet body chrome), template design specs
under `docs/templates/` when present (#827).

---

## Profiles

| Rule | Value |
| --- | --- |
| Visible label | **Username first**, then network, then URL |
| Modes | `username` (default / `auto`), `network`, `network-username` |
| Sheet | `profileEntryLabel` → username-or-network as the link text |
| Typst | `profile-entry-label` / `render-profile-entry` default `label-mode: "auto"` |

`auto` means the same preference order as `username`. A template may pass `network` or
`network-username` only when its frozen design spec declares that mode.

---

## Avatar

| Rule | Value |
| --- | --- |
| When the template shows an avatar slot | Always draw it |
| Photo set and not hidden | Render the photo (shared effects) |
| No photo (or empty URL) | **Initials disc** from `basics.name` (up to two grapheme initials) |
| Sheet Done mode | Initials disc still draws (not edit-only) |
| Typst | `render-avatar` (photo or initials); do not gate the slot on `has-visible-picture` alone |

Templates that omit an avatar slot entirely (no call site) stay avatar-free.

---

## Education

Composition is **degree-first**. Never join `studyType` and `area` with `" in "`.

| Line | Fields | Notes |
| --- | --- | --- |
| Primary | `studyType` | Degree / qualification only |
| Secondary | `institution · area` | Middot join; omit empty parts |
| Date | `date` | Separate (header column, badge, or own row) — never folded into the degree line |
| Optional | `score`, `summary`, keywords, custom fields | After the lines above |

Helpers: Typst `education-degree` / `education-school`; sheet `educationDegree` /
`educationSchool`. Legacy `format-degree` returns `studyType` only and must not reintroduce
the `"in"` join.

---

## Keywords

| Rule | Value |
| --- | --- |
| Presence | Always render non-empty `keywords` for every item type that carries them |
| Style | Template-owned (pill chips, comma/middot plain text, bold, …) |
| Sheet | Soft accent pills (`TagChips`) |
| Typst | Native per-template keyword rendering; experience/education also via `section-item-extras` chips |

Missing keywords in PDF or sheet text is a parity bug regardless of style.

---

## Level display

Shared definition for skills and languages:

| Rule | Value |
| --- | --- |
| Range | Integer **0–5** after clamp (`clamp-level` / `clampLevel`) |
| `0` | Unrated — **no** indicator |
| `1`–`5` | Fill that many of five indicators |
| Default sheet chrome | Five dots (filled ≤ level) |
| Typst default | Template-native shape via `rating-indicators` when `metadata.levelDisplay` is `template-default` |
| Overrides | `circle` / `square` / `progress-bar` / `text` / `hidden` via `metadata.levelDisplay` |

The numeric meaning of each step is identical on both surfaces; only the glyph may differ.

---

## Checklist for new templates

1. Profiles use `label-mode: "auto"` (or a mode declared in the template spec).
2. Avatar call sites use `render-avatar` when the design includes a slot.
3. Education uses `education-degree` + `education-school` (never `"… in …"`).
4. Every keyword-bearing section prints keywords.
5. Levels go through `clamp-level` / `should-render-level` / `render-level`.
