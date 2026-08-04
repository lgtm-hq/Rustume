# Rustume Document Editor — Normative UI/UX & Data-Model Specification

**Source of truth:** owner prototype at `apps/web/src/prototypes/EditableSheet.tsx` (3,824 lines),
`docModel.ts`, `shared.ts`, `Studio.tsx`, seed data `data/fde.json` (worktree `Rustume-prod-0490`,
branch `local/prod-0.49.0`, commits `ec98d9a` → `86e909f` → `fe6e835`). **Comparison baseline:**
draft PR #788 (`rustume-785`, `apps/web/src/components/doc-editor/`, `crates/schema/src/`).

**Owner framing (binding):** the deliverable is NOT the prototype's visual skin. It is (a) the
**component library** (summary component, experience component, item pop-up modal, interests/chips
component, add-section block, add-item block, per-section add buttons, …) that per-template layouts
compose, and (b) the **single-page edit model**: one flowing sheet, inline editing directly on the
document body, pop-up modals for structured entry, hover affordances, drag & drop, page-break
indicators, floating page-count pill. Kept from production: undo/redo, version history, export,
theme selection, template selection, Edit/Done top-bar toggle. Dropped: split view,
editor/split/review modes, section-editing sidebar.

Design lineage the prototype cites explicitly (commit `86e909f`): the **Home Assistant dashboard
edit-mode pattern** — sections are outlined draggable cards with a grip and a pencil menu; dashed
placeholder blocks are the "add" affordances; the whole card is the drag surface with presses on
controls vetoed.

---

## 1. Component inventory

Every component below exists in the prototype. Names are the prototype's; implementers may rename to
project conventions but must keep responsibilities and behavior identical.

### 1.1 State container — `useEditableResume()` (→ `EditableCtx`)

The single editor store/controller. One instance per document; every component receives it as `ctx`.

**State:**

- `doc` — Solid store of the whole `ResumeDoc` (see §4). Persisted to `localStorage`
  (`rustume.studio.liveDoc.v3`) on every change via a `JSON.stringify(doc)` tracking effect; also
  stashed in HMR `hot.data` so refresh cannot lose edits. In production this maps to the
  server-persisted resume + autosave.
- `editMode: boolean` (default true in the prototype; production default should be view/Done).
<!-- markdownlint-disable-next-line MD013 -->
- `modal: null | {kind:"item", sectionId, editId?} | {kind:"custom-section"} | {kind:"language", editId?} | {kind:"photo"}`
  — exactly one modal at a time.
- `fmtOpen` — floating format toolbar visibility (armed rich LiveText).
- `sectionsOpen`, `templatesOpen` — the two panels.
- Item drag: `dragging: {sectionId, id} | null`, `dropAt: {sectionId, index} | null`.
- Section drag (separate channel): `secDragging: string | null`,
  `secDropAt: {page, col, index} | null`.
- Undo: `undoStack`/`redoStack` (arrays of full-doc snapshots), `canUndo()`/`canRedo()` signals.

**Operations (the mutation API a production store must expose):**

- `setDoc` (exposed as an undo-recording `commitDoc` wrapper: records `path:<joined store path>`
  key, then writes),
- `tpl()` / `setTemplate(t)` — resolves the active template, merging `metadata.theme` overrides over
  the template palette; `setTemplate` records undo, writes `metadata.template`,
  `metadata.theme {primary, background, text}`, and **resets `metadata.layout` to that template's
  default columns** via `layoutForTemplate` (customs preserved, appended to the side/main column).
- `toggleSection(id)` — flips `visible` on fixed or custom section, then runs
  `repairMissingSections()` (a section toggled on while absent from the layout must be placed or it
  never renders).
- `repairMissingSections()` — re-attaches any visible section missing from the layout (side-ish ids
  `profiles/skills/languages/interests/education/certifications` and customs → column 1, else column
  0; target page = last page that already has sidebar content). Also strips `itemBreaks` from
  non-main sections (only
  `experience, education, projects, volunteer, awards, certifications, publications, references` may
  hold item breaks). Automatic repairs never record undo.
- `addCustomSection(title)` — id `c_<rand>`, name defaulting to "Custom section",
  `{columns:1, separateLinks:true, visible:true, items:[]}`, placed at end of side column
  (`ensureInLayout(id, 1)`).
- `renameSection(id, title)` — trims; no-op when blank.
- Item CRUD: `getItems(sectionId)`, `saveItem(sectionId, item, editId?)` (edit merges over the
  existing item preserving id; add merges over `emptyItemFor(sectionId)` with a fresh id and
  `visible:true`), `removeItem(sectionId, itemId)` (also removes the item's entry from
  `metadata.itemBreaks`), `moveItemInSection(sectionId, id, toIndex)` (drop index is "insert before
  pre-removal index"; when source < target the target shifts down one; no-op moves don't record
  undo).
- Section layout ops: `columnNeighbors(id)` (index/count of the section within its column flattened
  **across pages**), `moveSectionInColumn(id, ±1)` (one visible step; crosses page boundaries as one
  continuous stack — never a silent multi-page jump), `moveSection(id, {page, col, index})` (exact
  drag target; creates pages/columns as needed; clamps index; **clears any `itemBreaks` for that
  section** since a whole-section move invalidates mid-section splits),
  `removePageBreakAt(pageIndex)` (see §3.4).
- Undo: `record(key="")` pushes a pre-mutation `structuredClone(unwrap(doc))` snapshot; same-key
  calls within **900 ms coalesce** (photo sliders, repeated toggles); stacks capped at **100**; any
  record clears the redo stack. `undo()`/`redo()` swap snapshots via `reconcile()`. NOTE (bug pinned
  in commit `fe6e835`): snapshots must clone the **unwrapped** store — `structuredClone` on a store
  proxy throws `DataCloneError`.
- `pushLiveDoc()` — export JSON download; `preparePdfExport()` — leaves edit mode, closes
  panels/modals, adds `studio-pdf-export` class to `<html>`/`<body>`, returns
  `{pageWidth: 860, pageHeight: 1122, doc}`.

### 1.2 Top bar (host chrome — `Studio.tsx`)

Dark chrome bar (`#0c0a09`, bottom border `#292524`) above the canvas. Left: brand + document name
(mono) + an **"editing" badge** (accent-filled pill, uppercase .62rem) shown only in edit mode.
Right, in order: **Undo** `↩` / **Redo** `↪` icon buttons (2.1rem square ghosts, disabled at 35%
opacity when stack empty, titles "Undo (⌘Z)"/"Redo (⌘⇧Z)"), a 1px separator, **Templates** and
**Sections** ghost toggles (`.active` = filled `#292524` state while their panel is open), **Export
JSON**, **Export PDF**, and the primary **Edit/Done** button (light `#fafaf9` pill, label flips
`Done` ⇄ `Edit`). Canvas below is a scrollable centered column on `#1c1917` with a radial highlight;
when the Sections panel is docked open, the canvas gets `padding-left:16.5rem` so the panel never
overlaps the sheet. Production adds (per owner): version history and theme selection controls in
this bar.

### 1.3 `EditableSheet` — the sheet engine

Props: `ctx`, `variant` (chrome flavor; production uses one), `focusedSection`, `onFocusSection`.
Renders, in order: `FormatToolbar`, `Modals`, `SectionsPanel`, `TemplatesPanel`, `PageCountPill`,
then a `.sheet-stack` (centered flex column, `width:min(860px,100%)`) of one `.page-sheet`
`<article>` per rendered page (`renderPages(doc)`, §3), each preceded (pages ≥ 2) by a
`.page-break-rule`. Each sheet carries classes
`sheet page-sheet sheet-<variant> tpl-<templateId> layout-<mode> head-<headerStyle>` + `is-editing`,
`data-page`, and CSS custom props `--acc` (primary), `--ink` (text), `--mut` (muted), `--side-w`,
`--page-h:1122px`. Sheet look: white, `border-radius:4px`, heavy drop shadow, base font
`"IBM Plex Sans", Inter, system-ui` at **12.5px / 1.45**. Sheets size to content (no fixed height);
A4 overflow is signaled by guides (§3.3). Global effects owned here: Escape closes any modal;
⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z (or Ctrl+Y) undo/redo hotkeys that **pass through when focus is in
`input, textarea, [contenteditable="true"]`** (never steal native field undo); page-count
measurement (§3.5); sidebar resize (§3.2).

<!-- markdownlint-disable-next-line MD013 -->
### 1.4 Page body compositors — `SingleColumn`, `MainColumn`, `SideColumn`, `NameHeader`, `ContactBlock`, `SheetAvatar`

These are the **template-layout layer** — the part each template owns (§3.6):

- `NameHeader` — `.sheet-head`: `LiveText.name` (1.7rem, 700) over `LiveText.headline` (accent
  color, .88rem, 500). Variant `head-in-side` when placed in a sidebar.
- `ContactBlock` — a `SectionChrome id="basics" title="Contact"` whose body is icon rows (email /
  phone / location / optional link), each `ContactIcon` + `LiveText.side-val` inline-editable.
  `compact` prop switches column list (`.contact-list`) to wrapping inline row (`.contact-inline`)
  for header/banner placements. **`basics` is template-owned chrome: no grip, no pencil, no menu,
  not draggable** (`isLayoutSection()` false).
- `SheetAvatar` — button wrapping either the photo `<img>` or an initials disc (accent bg, two
  initials from `basics.name`, fallback "·"). Applies picture size (clamped ≤120 on-sheet),
  border-radius (≤ size/2), grayscale filter, rotation transform, border, offset box-shadow
  (`shadowSize/2 px` x/y offset, 0 blur). Click (edit mode only; disabled otherwise) opens the Photo
  modal; title "Edit profile photo".
- `SideColumn` — `<aside class="sheet-side">` (tinted `color-mix(var(--acc) 15%, #fff)` background,
  `padding:1.6rem .95rem 2rem`); page 0 optionally hosts NameHeader (headerStyle `sidebar`),
  avatar + ContactBlock (contactIn `sidebar`), then `SectionList` of that page's column-1 ids;
  carries the resize handle in edit mode.
- `MainColumn` — `.sheet-main` (`padding:1.6rem 1.45rem 2rem`), NameHeader on page 0 unless the
  header lives in the sidebar, then `SectionList` of column-0 ids.
- `SingleColumn` — `.sheet-single`; page 0 renders a `.sheet-banner` (avatar + NameHeader + compact
  ContactBlock when `contactIn:"header"`), then one `SectionList` over `[...main, ...side]` ids.
- `header-split` mode: page-0 `.sheet-banner` (optionally `banner-tint` accent wash; avatar + name +
  compact contact when `contactIn:"banner"`), then a two-column `.split-cols` grid below; column
  order (side-first vs main-first) is a per-template choice.

### 1.5 `SectionChrome` — the universal section card

The core reusable container wrapping **every** section body. Props:
`id, ctx, title, variant, editMode, focused?, onFocus?, onAdd?, addLabel?, children`.

Visual structure:

- `<section class="sec" data-sec=...>` —
  `margin-bottom:.7rem; border-radius:6px; padding:.2rem .15rem; position:relative`.
- `.sec-bar` header row: **drag grip** (`.sec-grip`, 3×3 dot `mdi-drag` icon, 22px hit target,
  hidden at `opacity:0` until card hover/focus/drag, `cursor:grab`) — `<h2>` title (uppercase,
  .64rem, 700, letter-spacing .12em, accent color; templates restyle freely) — **pencil button**
  (`.sec-pencil`, `mdi-pencil`, 24px, also opacity-0 until hover; hover/menu-open state gets accent
  color + tinted bg + border).
- `.sec-body` children.
- Optional dashed **add block** (§1.10) after the body when `editMode && onAdd`.
- Absolutely-positioned `.sec-slot` drop indicator bars (3px accent, radius 2, `top:-5px` /
  `bottom:-5px`) shown before/after during section drag (§2.5).

Edit-mode card state (`.sheet.is-editing .sec-edit`): **1.5px dashed border**
`color-mix(var(--acc) 30%, #c7c1b8)`, `border-radius:12px`, `padding:.5rem .6rem .6rem`, translucent
white fill (55%), `cursor:grab`, `user-select:none`. Hover / menu-open: border darkens to
`color-mix(var(--acc) 60%, #a8a29e)` + solid white fill. Focused (last clicked): **solid** accent
border + white fill. While dragged: `opacity:.45`, `cursor:grabbing`. All transitions `.12s ease`.

Pencil menu (`.sec-menu`, white popover anchored top-right of the card, radius 10, shadow, .3rem
padding; closes on outside mousedown or Escape): **[addLabel]** (when `onAdd`), **Move up**
(disabled at column top), **Move down** (disabled at column bottom — bounds from `columnNeighbors`,
i.e. cross-page aware), **Move to sidebar / main column** (hidden on single-column templates),
separator, **Rename title…** (a text prompt seeded with the current title; commit on non-empty
change), **Hide section** (danger red; calls `toggleSection`). Every action closes the menu first.

### 1.6 `SectionList` — column renderer + Add-section block

Renders a `SectionView` per section id in a column, then (edit mode) the **`.add-section-block`**: a
full-width dashed placeholder (`2px dashed #cfc9bd`, radius 12, min-height 3.2rem, uppercase .64rem
label "＋ Add section", 60% opacity resting → full opacity + accent tint on hover). Click opens the
Sections panel. It **doubles as the end-of-column drop target** for section drags
(`index: MAX_SAFE_INTEGER` sentinel; `drop-hint` class shows the same accent-tinted active look
while hovered by a drag).

`SectionView` gates rendering: hidden sections never render; **empty sections (no visible items /
blank summary) collapse entirely in view mode but stay in edit mode** so the add affordance remains.
Solid note pinned in the code: key section lists by id (`For`), not position (`Index`) — positional
reuse caused stale-closure bugs on reorder.

### 1.7 Section body components (`renderSection` variants)

All bodies live inside `SectionChrome`; per-type rendering:

- **Summary** — no items; body is one rich `LiveText` (`html`, `multiline`, class `.summary`,
  .84rem) bound to `sections.summary.content`. Only slice 0 renders content (a summary never
  continues onto later pages). Add block: none.
- **Experience** (`ExperienceEntry` inside `SortableEntry`, class `.entry`) — `.entry-pos` position
  (700, .88rem); `.entry-meta` row: `.entry-co` company (accent, .78rem, 600) + `.entry-date`
  (muted, .68rem, nowrap); `.entry-loc` location row with small pin icon; `.entry-sum` rich HTML
  summary (`innerHTML`); `TagChips`; `ExtraFieldsView`. Add label "Add experience".
- **Education** (class `.edu-entry`) — `.edu-degree` studyType (fallback text "Degree"),
  `.edu-school` = `institution · area` (accent), `.edu-date` (JetBrains Mono, .64rem, muted),
  optional `.entry-sum` HTML, TagChips, ExtraFieldsView. Add label "Add education".
- **Profiles** (compact row `.profile-row.icon-row`) — brand `ProfileIcon` (built-in glyphs for
  GitHub/LinkedIn, generic globe fallback; keyed off `icon || network` lowercased) +
  username-or-network as `.side-link` (underlined; **clicks prevented in edit mode**, live link in
  view mode). Add label "Add profile".
- **Languages / Skills** (compact row `.lang-row`, skills add `.skill-row`) — `.lang-name`
  (ellipsized single line for languages; skills wrap fully with dots on line 1's trailing edge) +
  `.lang-dots`: five 6px circles, filled `≤ level` with accent. Skills may show `TagChips` on a
  full-width second row. Add labels "Add language"/"Add skill". **On row hover in edit mode the dots
  fade to `opacity:0` to yield space to the remove ✕** (§2.2).
- **Interests** — plain `<ul class="custom-list">` of names (no per-item hover chrome; items managed
  via modal/add block). Add label "Add interest".
- **Custom sections** — chip list (`.skill-chip` pills: accent-tinted bg, 999px radius, .68rem 600).
  In edit mode each chip reveals an inline `✕` (`.chip-x`, opacity 0 → 1 on chip hover/focus-within,
  red on hover) that removes the item directly — no modal round-trip for removal. Add label "Add
  item".
- **Projects / Awards / Certifications / Publications / Volunteer / References** (generic `.entry`)
  — `.entry-top` flex row: `.entry-pos` name + right-aligned `.entry-date`; optional `.entry-desc`
  (one-line description, .78rem); optional `.entry-sum` HTML; TagChips; ExtraFieldsView. Add label
  "Add item". When empty in edit mode: italic `.empty-hint` "No items yet — use + to add one."

Shared sub-views: **`TagChips`** (soft accent pill per keyword, wraps, `.28rem` gap, hidden when
empty) and **`ExtraFieldsView`** (rows of uppercase muted label + value, .7rem; only fields with
non-blank label or value).

### 1.8 `SortableEntry` — universal item row chrome

Wraps every structured item. Props: `ctx, sectionId, itemId, index` (global index in the section's
**full** items array, not the page slice), `class`, `compact?`,
`onEdit, onRemove, onMoveUp?, onMoveDown?, children`.

Structure: relative-positioned row; optional `.entry-slot` drop bars (3px accent) before/after;
edit-mode-only left **grip** `.entry-handle` (`⋮⋮` text glyph, absolutely positioned full-height
1rem strip on the left edge, opacity 0 → 1 on row hover/focus-within, `cursor:grab`); edit-mode-only
`EntryActions`; then children. Rows get left padding (~`.85rem`–`1.05rem`) to reserve the grip
strip. `edit-ready` rows disable text selection (`user-select:none`) and show `cursor:grab` — except
armed LiveText, which restores selection. Dragged row: `opacity:.4`.

### 1.9 `EntryActions` — the hover action pill

**Full rows (non-compact):** a floating pill at the row's **top-right** (`.entry-actions`: white bg,
1px `#e7e5e4` border, 999px radius, 2px padding, soft shadow `0 6px 18px rgba(28,25,23,.14)`),
opacity 0 + `pointer-events:none` until row hover or focus-within (`.12s ease` fade). Contents, left
→ right, each a 26px circular ghost button: **✎ Edit** (accent tint on hover), **↑ Move up** / **↓
Move down** (rendered only when a neighbor exists in that direction; accent tint on hover), **−
Remove** (red `#b91c1c` text + `#fef2f2` bg on hover). All buttons `stopPropagation`.

**Compact rows (sidebar: profiles/languages/skills):** no pill and no arrows (drag covers reorder).
A single bare inline **✕** vertically centered at the row's right edge (18px, muted `#b3ada3`, red
on hover); the **whole row is the edit affordance** — click anywhere (except grip/buttons) opens the
item modal; `cursor:pointer`; row hover gets a soft tinted bg and the tooltip "Click to edit · hold
to drag".

### 1.10 `.add-block` — per-section dashed add button

Rendered under a section's items in edit mode: full-width, min-height 2.9rem,
`2px dashed color-mix(var(--acc) 38%, #c7c1b8)`, radius 10, uppercase .66rem 700 label with an
`mdi-plus` icon, accent-leaning text color. Resting `opacity:.55`; parent-card hover, card focus, or
its own focus-visible raises to 1; self-hover adds accent border + 7% accent fill. Click opens the
section's Add modal.

### 1.11 Editable text opens its typed modal (superseded LiveText)

> **Owner decision (2026-08-04, PR #805 verification):** the prototype's armed in-place
> `LiveText` editing described here was **rejected and superseded**. There is no in-place
> `contentEditable` anywhere. The production primitive is `EditableField`:

- View (Done) mode: inert rendered text; an empty value renders nothing.
- Edit mode: the value is plain rendered content whose only affordances are the hover
  underline (40%-accent, offset 3px) and the tooltip "Double-click to edit".
- **Double-click — or keyboard activation — opens the field's typed pop-up modal**: plain
  fields get a one-input dialog (`Edit · <Field>`; Enter saves), the summary and cover
  letter get the **full markdown editor** (`MiniRichEditor`, §1.13) in their dialog.
  Structured entries open the `ItemModal` (§1.13) on row double-click.
- The dialog commits **once**, on Save, and only when the text changed — one edit, one
  undo entry. **Escape**, the backdrop, Cancel and the ✕ all discard the draft (the
  Escape-reverts decision now lives in the modal). No `window.prompt` anywhere.
- Uses: name, headline, contact email/phone/location (plain), summary and cover letter
  (markdown dialog), section titles (rename dialog).

### 1.12 Rich-text editing lives in the modals (superseded FormatToolbar)

> **Owner decision (2026-08-04):** the floating format bar is **removed** along with
> in-place editing. Rich text is edited exclusively through `MiniRichEditor` (§1.13)
> inside the modals — same toolbar contract (bold / italic / bulleted / numbered / link
> with an inline URL row, never a prompt; no underline or strikethrough, since markdown
> has neither), writing **markdown** through the pure command engine.

### 1.13 Modal system

`ModalShell`: fixed backdrop (`rgba(12,10,9,.55)` + 2px blur, z-50, click closes), centered white
card `min(520px,100%)`, radius 14; header (title + ✕), scrollable body (column, .8rem gap), footer
right-aligned **Cancel** (ghost) + **Save/Add** (dark primary). Escape closes (global handler).
Closing by any path other than submit **discards** edits (no confirm).

**`ItemModal`** — add/edit for any item section. Title: `"Add · <Section label>"` /
`"Edit · <Section label>"`; submit label `Add`/`Save`. Local field state seeded from the existing
item; **saving goes through one `saveItem` call = one undo entry**. Field sets per section (first
field autofocused):

- _experience_: Title/position, Company + Location (two-column `.field-row`), Dates (free text),
  **Highlights** rich editor (hint "Use the toolbar for bold, lists, and links."). On save, blank
  company/position fall back to "Company"/"Role".
- _education_: Institution, Degree/type, Area/place, Dates, Summary rich editor. Fallback
  institution "Institution"; `score` saved as `""`.
- _profiles_: Network (placeholder "GitHub"), Username. Fallback network "Network"; icon/url saved
  empty.
- _languages / skills_: Name + **Proficiency picker**: five equal-width cards (1–5) each showing the
  number over a tiny label (Beginner / Elementary / Conversational / Fluent / Native); selected card
  gets accent border + 12% accent fill. Saved `level` clamps to 1–5 (default 3) and **`description`
  is auto-set to the level label**.
- _projects_: Name, Description (2-row textarea), Highlights rich editor.
- _everything else + custom sections_: Name, Description textarea (custom sections only), Summary
  rich editor; generic saves also carry `level` (default 3).
- **Tags** (`TagInput`) appended for experience/education/projects/skills/languages/custom: chip
  box; Enter or comma commits a chip (commas stripped, dedup, trim), Backspace on empty draft pops
  the last chip, blur commits, each chip has an ✕; hint "Press Enter to add. Shown as chips on the
  resume."
- **Custom fields** (`ExtraFieldsEditor`) appended for experience/education/projects/skills/custom:
  rows of `Field name | Value | ✕` above a dashed "+ Add field" button; hint "Add anything else for
  this item — e.g. URL label, role, stack note." Blank rows (no label and no value) are dropped on
  save.

**`MiniRichEditor`** (modal-local rich field): label, bordered box with a light toolbar (B/I/U, sep,
• list / 1. list, sep, Link) over a contentEditable body (min 110px / max 240px, placeholder via
`:empty:before`), optional hint line. Accent focus ring on focus-within.

**`CustomSectionModal`** — single "Section title" input (placeholder "e.g. AI Tooling"), hint
"Placed in the side column by default. Toggle visibility anytime in Sections." Submit = Add.

**`PhotoModal`** (`.photo-modal`, 420px) — footer is a single **Done** (no cancel: photo edits apply
live and each slider burst is one coalesced undo entry). Empty state: full-width dashed **"Click to
upload — JPG, PNG, or WebP"** drop-style button opening a hidden file input
(`image/jpeg,image/png,image/webp`); file is read to a data URL and un-hides the photo. With photo:
live preview (all effects applied) beside **Replace** (ghost) and **Remove** (danger; clears url and
sets `hidden:true`); then sliders **Size** 32–200 step 4 (px readout) and **Border radius**
0–size/2; toggle rows (title + explainer + checkbox) **Hidden** / **Grayscale** / **Border**;
**Rotation** slider 0–360; and a 2×2 grid: Border color (text, placeholder "Theme primary" — empty
string means accent), Border width 0–10, Shadow color (hex with alpha), Shadow size 0–20.

### 1.14 `SectionsPanel` — master visibility list

Docked fixed panel, top-left under the top bar (220px, dark `#1c1917`, radius 14, scrollable; the
canvas shifts right rather than being overlapped). Header "Sections" + ✕. Hint: "Toggle what appears
on the page. Layout still follows the template." One toggle row per fixed section, then a "CUSTOM"
subheading with custom sections, then a dashed **"+ Add custom section"** button (opens
CustomSectionModal). Each row (`SectionToggleRow`): eye / eye-off icon + label; **on** = light text
on `#292524`; **off** = muted with `line-through` label. Click = `toggleSection`. This panel is
_visibility + creation only_ — all editing happens on the sheet (owner: no sidebar-based section
editing).

### 1.15 `TemplatesPanel` — template drawer

Right-edge drawer (`min(300px, 92vw)`, dark, slides in `.22s ease` with a dimmed blurred backdrop;
Escape/backdrop-click closes). Grid of 2-across **template cards**: each a `TemplateMiniPreview` — a
3:4 paper miniature that mirrors the template's real structure (banner strip for header-split,
tinted side column with avatar dot + line placeholders, name/headline bars, text lines) in the
template's own colors — over the template name. Active card: accent border + glow ring. Click
applies the template (`setTemplate`: palette + default layout) and closes. A vertical "Templates"
edge tab (`.tpl-tab`) exists for standalone use; the Studio top bar hides it and drives the drawer
from its own button.

### 1.16 `PageCountPill` + `SheetOverflowGuides` + `.page-break-rule`

- **Page-count pill**: fixed bottom-center floating pill (dark, 999px radius, `aria-live="polite"`):
  bold count + uppercase "page/pages". Count = measured pages (§3.5), min 1.
- **Overflow guides**: edit-mode-only dashed accent horizontal rules (`.page-guide`, 40%-accent 1px
  dashed, inset .35rem from sheet edges) drawn across a sheet at every `n × 1122px` of that sheet's
  content height — the "your content crosses an A4 boundary here" indicator. Measured from child
  `offsetTop + offsetHeight` (max), ResizeObserver-driven; a ≤20px overhang tolerance suppresses a
  final guide.
- **Page-break rule** (between stacked sheets, pages ≥ 2): full-width dashed separator with a
  centered uppercase **"Page N"** label chip riding the line, plus (edit mode) a **"Remove page
  break"** pill button → `removePageBreakAt(pageIndex)` (§3.4).

### 1.17 Icons

Inline SVGs, no icon library: `PlusIcon` (mdi-plus), `PencilIcon` (mdi-pencil), `DragGridIcon` (3×3
dots), `ContactIcon` (email/phone/location/link), `ProfileIcon` (github/linkedin/globe), `EyeIcon`
(open/closed). Production should map these to the project's icon system 1:1.

---

## 2. Interaction catalog

### 2.1 Mode model

Single surface, two modes toggled by the top-bar button:

- **View ("Done" pressed)**: clean document. No dashed cards, grips, pencils, pills, add blocks,
  guides; links are live; LiveText inert; avatar not clickable. Page-break rules and the page-count
  pill remain (minus the remove button / guides).
- **Edit**: every section becomes an HA-style dashed card; all affordances active. `editMode` also
  flips `.is-editing` on each sheet, which is the CSS switch for all edit chrome.

### 2.2 Hover affordances (exact inventory)

| Surface                                | Resting                                                               | On hover                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section card                           | dashed 30%-accent border, translucent fill; grip & pencil `opacity:0` | border → 60% accent, solid white fill; grip + pencil fade in (.12s)                                                                                                          |
| Focused section card                   | solid accent border (persists)                                        | same + hover chrome                                                                                                                                                          |
| Full item row (`.entry`, `.edu-entry`) | transparent; grip & pill hidden                                       | 5%-accent row tint; left `⋮⋮` grip fades in; top-right floating pill (✎ / ↑ / ↓ / −) fades in                                                                                |
| Compact row (profile/lang/skill)       | plain                                                                 | row tint (`#faf8f4` + hairline or 6% accent); grip fades in; bare right-edge ✕ fades in; **proficiency dots fade out** to yield to ✕; tooltip "Click to edit · hold to drag" |
| Custom-section chip                    | pill                                                                  | inline `✕` fades in inside the chip; ✕ hover turns red                                                                                                                       |
| LiveText (unarmed)                     | plain text                                                            | 40%-accent underline (summary: slight dim instead)                                                                                                                           |
| Add block / Add-section block          | 55–60% opacity dashed                                                 | full opacity, accent border + tint (add block also wakes on parent-card hover)                                                                                               |
| Sidebar edge (edit mode)               | invisible 8px strip                                                   | 2px accent-ish line fades in; `cursor:col-resize`                                                                                                                            |
| Pencil / grip themselves               | ghost                                                                 | accent-tinted chip (pencil), tinted grab chip (grip)                                                                                                                         |

All affordance reveals are opacity/background transitions at `.12s ease`; drop indicators and drag
ghosts have no animation (instant).

### 2.3 Click-to-edit flows

- **Field text (EditableField)**: double-click → typed field dialog → Save commits (Enter on
  one-line dialogs); Escape/Cancel/backdrop discard. One save = one undo entry.
- **Structured items**: pencil-pill ✎ (full rows) or row click (compact rows) → `ItemModal`
  pre-filled → Save (single undo entry) or Cancel/backdrop/Escape/✕ (discard).
- **Section focus**: clicking anywhere in a section marks it `focused` (solid accent border); one
  focused section at a time (host-level signal).
- **Avatar** → Photo modal. **Section title** → pencil menu → "Rename title…" prompt.
- **Remove**: pill **−** / compact **✕** / chip **✕** remove immediately — **no confirmation** (undo
  is the safety net).

### 2.4 Item drag & drop (within a section)

- **Drag surfaces**: the `⋮⋮` grip _and the whole row_ (whole-surface drag, HA-style). A drag that
  started on `button, input, textarea, [contenteditable="true"], .live.armed` is vetoed
  (`preventDefault`) so controls and armed text keep native behavior. Grip drags `stopPropagation`
  so the row doesn't double-fire; nested rows drag independently of their section card. Never
  `preventDefault` on `mousedown` of a drag surface (pinned bug: it kills Chromium dragstart) —
  selection is suppressed via `user-select:none` instead.
- **Payload**: HTML5 DnD, MIME `application/x-entry`, `{sectionId, id}`, `effectAllowed:"move"`;
  mirrored in `ctx.dragging` for reactive UI.
- **Targets**: other rows of the **same section only** (cross-section item drops are not accepted).
  `dragenter` _and_ `dragover` both set the drop index (dragenter makes fast drags register). Drop
  index = row's global index, +1 if pointer is in the bottom half of the row.
- **Indicators**: dragged row at `opacity:.4`; a 3px accent `.entry-slot` bar before the target row
  (or after the last row).
- **Drop**: `moveItemInSection` (records undo unless a no-op). Drag end/leave clears both signals.
- Reorder is also available without drag via the pill's ↑/↓ (full rows only; hidden at ends).

### 2.5 Section drag & drop (blocks across columns/pages)

- **Drag surfaces**: the header grip _and the whole card_ (same veto rules; presses on entry rows
  are claimed by the entry drag first — entries carry `.edit-ready`, which the card's veto list
  includes).
- **Payload**: MIME `application/x-section`, `{id}`; mirrored in `secDragging`.
- **Targets**: any other section card in any column of any page (drop index = that card's
  `{page, col, index}`, +1 for bottom half) and every column's **Add-section block** as the
  end-of-column target (`index: MAX_SAFE_INTEGER` + `drop-hint` styling).
- **Indicators**: dragged card `opacity:.45`; absolutely positioned 3px accent `.sec-slot` bars
  (before/after) — absolute so indicators **never shift layout under a stationary pointer** (pinned
  bug).
- **Drop** → `moveSection(id, target)`: exact insert, same-column index correction, auto-create
  missing pages/columns, drop that section's item-breaks. Dedup + empty-page cleanup via
  `writeLayout` (a section id may appear only once in the raw layout; a page is kept only if some
  column is non-empty).
- Menu alternatives: **Move up/down** = one visible neighbor swap treating the column as a
  continuous cross-page stack; **Move to sidebar/main** = append to end of the other column on the
  same page.

### 2.6 Add flows

- **Add item**: dashed add block under the section (label per type: Add experience / education /
  profile / language / skill / interest / item) — shown only on the section's **last slice** when
  it's split across pages (`canAdd`) — or the pencil menu's first entry. Both open the Add
  `ItemModal`.
- **Add section**: end-of-column Add-section block (or top-bar "Sections") → Sections panel → toggle
  a hidden fixed section on (auto-placed by `repairMissingSections`) or "+ Add custom section" →
  title modal → custom section appended to the side column.
- **Add custom field / tag**: inside `ItemModal` (§1.13).

### 2.7 Remove flows

- Items: pill −, compact ✕, chip ✕ (all instant, undoable; also cleans the item's page-break
  marker).
- Sections: pencil menu → **Hide section** (visibility off — data preserved; also the Sections panel
  eye-toggle). There is **no destructive section delete** in the prototype, including for customs
  (see Open questions).
- Page break: "Remove page break" on the rule between pages (§3.4).
- Photo: PhotoModal → Remove.

### 2.8 Keyboard & undo

- ⌘/Ctrl+Z undo; ⌘/Ctrl+Shift+Z or Ctrl+Y redo — globally, except when focus is in any
  input/textarea/contentEditable (native field undo wins). Top-bar ↩/↪ mirror with disabled states.
- Escape: disarm LiveText / close modal / close pencil menu / close templates drawer.
- Enter: commit single-line LiveText; add tag in TagInput (as does comma); Backspace in empty tag
  input pops last tag.
- Undo granularity: one entry per user action; 900 ms same-key coalescing for slider/typing bursts;
  snapshot-based (whole doc, ~25 KB), 100-deep; automatic layout repairs are transparent to undo.

### 2.9 Persistence & export (prototype-level; production maps to API)

Autosave every mutation (localStorage in the prototype). Export JSON downloads the live doc. Export
PDF = `preparePdfExport()` then `window.print()` with `@page { size: 860px 1122px; margin: 0 }` and
a `studio-pdf-export` stylesheet that hides every piece of editor chrome (top bar, drawers, panels,
pill, rules, guides, add blocks, grips, pills, resize handle) and de-styles edit borders — the
printed sheet must be pixel-identical to view mode.

---

## 3. Layout & pagination model

### 3.1 Page geometry

CSS-pixel A4 at ~96dpi: **page height 1122px, sheet width 860px** (`PAGE_HEIGHT_PX` /
`PAGE_WIDTH_PX`). The on-screen sheet is `width:min(860px,100%)`; sheets **size to their content**
(no fixed-height page frames) — A4 boundaries are communicated by guides and the pill, not by
clipping. HTML-UI PDF export prints at exactly 860×1122.

### 3.2 Columns & templates

A template (`shared.ts Template`) declares: `layoutMode`
(`single | sidebar-left | sidebar-right | header-split`), `defaultColumns: [main[], side[]]`,
`headerStyle` (`left | center | banner | boxed | sidebar`), `contactIn`
(`sidebar | header | banner`), palette (`primary/background/text/muted`), and optional
`sidebarWidth` (px; 0 ⇒ equal split for header-split). Grid:
`grid-template-columns: var(--side-w) 1fr` (mirrored for sidebar-right; `1fr 1fr` when equal),
`align-items:start` (columns must NOT stretch to the taller sibling — pinned bug: stretching
invented voids). The sidebar is user-resizable in edit mode via an 8px edge handle
(`role="separator"`, aria-value 160–360, clamped, persisted in localStorage
`rustume.studio.sidebarWidth`); pointer-capture drag, direction-aware for right sidebars.

### 3.3 The layout data structure

`metadata.layout: string[][][]` = **pages → columns → section ids**, plus
`metadata.itemBreaks: Record<sectionId, itemId[]>` = items that start a new page (mid-section
splits). Derivation pipeline (all in `docModel.ts`, all pure):

1. `layoutPages` — raw pages with cross-page dedup (first occurrence of a section id wins;
   duplicates cause re-render bugs).
2. `expandItemBreakPages` — a section with N break markers occupies N+1 consecutive pages **in the
   same column**; missing pages/columns are created.
3. `renderPages` — strips section ids whose slice has no content on that page/column
   (`sectionHasSliceContent`: summary only on slice 0; item sections need a non-empty slice from
   `itemSlicesForSection`), then drops trailing empty pages. Result feeds the sheet stack.
4. Per-instance: `sectionSliceIndex(doc, id, page, col)` (counted on **pre-strip** expanded pages so
   indices stay aligned with `itemBreaks`) selects which item slice a given rendered section shows;
   slices > 0 render the title as **`"<Title> (cont.)"`**.

### 3.4 Page breaks

- **Creating**: the prototype UI never creates breaks explicitly; extra pages come from
  `metadata.layout` having multiple pages (via drags to later pages) or from pre-existing
  `itemBreaks` data. (Deliberate gap — see Open questions for an explicit "insert page break"
  affordance.)
- **Removing** (`removePageBreakAt(pageIndex)`): prefer clearing an **item-break** continuation
  shared across the boundary (find sections present in the same column of both rendered pages with
  slice > 0; delete the responsible break id); otherwise **merge** raw page `pageIndex` into
  `pageIndex-1` column-wise (dedup-preserving). One undo entry.
- **Guards**: item breaks are only honored on main-flow sections
  (`experience, education, projects, volunteer, awards, certifications, publications, references`);
  repairs strip them elsewhere (chip/side sections over-fragmented into empty sheets).

### 3.5 Page count

Measured, not derived: sum each rendered sheet's per-column content heights (children's
`offsetTop+offsetHeight` max, guides excluded), take `max(mainTotal, sideTotal)`, `ceil(/1122)`,
then `max(sheetCount, byHeight)`. Recomputed via ResizeObserver + reactive deps (pages, edit mode,
itemBreaks, layout, sidebar width). Explicitly **no auto-fit / orphan packing** (pinned: it invented
phantom sheets and double-counted tall sidebars). The pill and the overflow guides measure from the
same source so they always agree.

### 3.6 How templates compose the library (normative architecture)

Two layers:

- **Shared component library** (template-agnostic): SectionChrome, SortableEntry, EntryActions,
  section bodies, LiveText, modals, add blocks, SectionsPanel, TemplatesPanel, guides/pill/rules,
  the ctx store. These own _all_ behavior.
- **Template layer** (per template): a layout shell = `layoutMode` compositor choice +
  `defaultColumns` + header/banner/contact placement (`headerStyle`, `contactIn`) + palette +
  `sidebarWidth` + a scoped stylesheet keyed by `tpl-<id>` that restyles only presentation (heading
  treatment, sidebar tint, banner borders, name typography — e.g. pikachu's filled accent h2 chips
  in the main column vs bare accent uppercase in the sidebar; nosepass's h2 with trailing rule;
  kakuna's boxed banner). Templates never re-implement interactions; the `basics` block is the one
  piece of chrome the template owns outright (no drag/menu).

---

## 4. Data model — prototype `docModel.ts` vs `crates/schema`

### 4.1 Shape agreement

The prototype was deliberately built on the production resume JSON (`fde.json` **is** a production
doc): `basics` (name, headline, email, phone, location, url, customFields, picture), fixed section
map incl. `coverLetter` + `custom` record, `metadata.template/layout/theme`. Picture and effects
match field-for-field (`crates/schema/src/basics.rs` `Picture`/`PictureEffects`).
`metadata.layout: Vec<Vec<Vec<String>>>` already exists in `crates/schema/src/metadata.rs`.
`Section<T>` common meta (`id, name, columns, separateLinks, visible, items`) matches
`SectionMeta`+`ItemSection`.

### 4.2 Field-by-field deltas (prototype ⟶ schema)

| Area                         | Prototype (`docModel.ts` + what the UI writes)                                                                                                  | `crates/schema` today                                                                                                                                                                                            | Required schema change                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `metadata.itemBreaks`        | `Record<sectionId, itemId[]>` — **the pagination feature**                                                                                      | absent                                                                                                                                                                                                           | **Add** `item_breaks: HashMap<String, Vec<String>>` (serde `itemBreaks`, `#[serde(default)]`, omit-when-empty). Renderer must honor it (§4.3).                                                                                                                                                                                                                                                                           |
| Experience item              | `+ keywords: string[]`, `+ customFields: {id,label,value}[]` (modal writes both)                                                                | `Experience` has neither                                                                                                                                                                                         | **Add** `keywords` + `custom_fields` (see custom-fields row).                                                                                                                                                                                                                                                                                                                                                            |
| Education item               | `+ keywords`, `+ customFields`                                                                                                                  | `Education` has neither                                                                                                                                                                                          | Same.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Project item                 | `+ customFields` (keywords exist)                                                                                                               | `Project` has `keywords`, no custom fields                                                                                                                                                                       | Add `custom_fields`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Skill item                   | `+ customFields` (keywords exist)                                                                                                               | no custom fields                                                                                                                                                                                                 | Add `custom_fields`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Per-item custom fields shape | `{id, label, value}`                                                                                                                            | `shared::CustomField` is `{id, icon, name, value}` (basics-only)                                                                                                                                                 | Decide: reuse `CustomField` with `name` (frontend maps label→name) — preferred — or add a `label` alias. Extend to the item types above.                                                                                                                                                                                                                                                                                 |
| Levels                       | UI writes 1–5; picker labels Beginner…Native; languages/skills `description` auto-set from level                                                | `level: u8` range 0–5, default **1**                                                                                                                                                                             | Keep 0–5 (0 = "unrated/hidden" stays legal); align UI default (3) client-side. No schema change required, but note default divergence.                                                                                                                                                                                                                                                                                   |
| `NamedItem` genericization   | one loose shape for awards/certs/pubs/volunteer/references/interests (`name/description/level/keywords/date/location/summary/url/customFields`) | distinct typed items: `Award{title,awarder}`, `Certification{name,issuer}`, `Publication{name,publisher}`, `Volunteer{organization,position,location}`, `Reference{name,description}`, `Interest{name,keywords}` | **Keep the typed schema.** The prototype's generic ItemModal must grow per-type field mappings (award: title/awarder; certification: name/issuer; publication: name/publisher; volunteer: organization/position/location; reference: name/description). The prototype currently writes `name/description` into these types — that is prototype shorthand, not a schema directive.                                        |
| `SectionMeta.columns`        | present but unused by the sheet UI (chips/rows are single-flow)                                                                                 | `columns 1–5` used by form-builder rendering                                                                                                                                                                     | Keep in schema; new editor may ignore for now (Open question: expose per-section columns?).                                                                                                                                                                                                                                                                                                                              |
| `url` on items               | optional; modal writes `{label:"",href:""}` for most types                                                                                      | non-optional `Url` with empty default                                                                                                                                                                            | Compatible as-is.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Theme                        | `metadata.theme {primary, background, text}` overrides template palette; `muted` comes from template only                                       | `Theme` identical + validation                                                                                                                                                                                   | None. `muted` stays template-level (client concern).                                                                                                                                                                                                                                                                                                                                                                     |
| Template ids/defaults        | 12 templates with `layoutMode/defaultColumns/headerStyle/contactIn/sidebarWidth` in client code                                                 | schema stores only `template: String`; server default `rhyhorn`                                                                                                                                                  | Template descriptors stay client/renderer-side (registry). Ensure descriptor exists per supported id.                                                                                                                                                                                                                                                                                                                    |
| Sidebar width                | client px (160–360), localStorage only                                                                                                          | `page.sidebar_ratio: Option<f32>` 0.1–0.5 (**pt-based ratio**, not px — see memory note: sidebar_width is pt not px in production)                                                                               | Map: persist the resize as `sidebar_ratio = side_w / 860` (clamped .1–.5) if the width should follow the document; else keep it a device preference. **Owner decision needed** (§6).                                                                                                                                                                                                                                     |
| Content format               | rich text is TipTap-ish **HTML** (`innerHTML` commits, `execCommand`)                                                                           | `metadata.content_format: html (default) \| markdown`; PR #788 editor writes **markdown**                                                                                                                        | **Conflict to resolve**: prototype interactions assume HTML contentEditable; production doc-editor declared markdown. Whichever format the new editor writes, it must set `contentFormat` accordingly and be consistent across LiveText, modals, and the renderer. Recommend: keep the PR #788 markdown pipeline and re-implement LiveText/MiniRichEditor on it (same UX contract, §1.11–1.12), avoiding a third format. |
| `emptyItemFor` defaults      | client-side blank items per type                                                                                                                | `Default` impls + cuid2 ids server-side                                                                                                                                                                          | Align id generation (cuid2 in production, not `Math.random` slugs).                                                                                                                                                                                                                                                                                                                                                      |
| Doc-level extras in fde.json | `metadata.css/page/typography/notes/levelDisplay` present and untouched by the editor                                                           | all exist in schema                                                                                                                                                                                              | None — the editor must round-trip unknown/untouched metadata losslessly.                                                                                                                                                                                                                                                                                                                                                 |

### 4.3 Export / render adjustments

The Typst/PDF renderer and any HTML export must be taught:

1. **`itemBreaks`** — replicate `expandItemBreakPages` + `itemSlicesForSection` + "(cont.)" titles
   exactly (pure functions in §3.3 are the reference implementation; port them, don't re-derive).
2. **Per-item `keywords` chips** on experience/education (render as soft tag chips) and
   **`customFields`** label/value rows on experience/education/projects/skills.
3. **Layout semantics**: page/column layout dedup rules, empty-slice stripping, trailing-empty-page
   drop — renderer output must match the on-screen pagination (the 860×1122 CSS-pixel geometry is
   the shared contract).
4. **Section visibility/empty-collapse** parity: hidden or empty sections never render.
5. Level display continues to honor `metadata.levelDisplay`; the sheet's five-dot row corresponds to
   `circle`/template-default.

Migration: all additions are `#[serde(default)]`-compatible — existing resumes deserialize
unchanged; no data migration needed. New fields are omitted when empty to keep old clients happy.

---

## 5. Delta vs PR #788 (current doc-editor)

PR #788 state (worktree `rustume-785`, HEAD `17e1d92`): SolidJS + `@thisbeyond/solid-dnd`; host
`apps/web/src/pages/DocEditor.tsx` (route `/edit/:id`; legacy form builder only under
`?ff=form-builder`); components under `apps/web/src/components/doc-editor/`; sheet styled by one BEM
stylesheet `docSheet.css` (everything nested under `.doc-sheet`).

### 5.1 Survives as-is (keep)

- **Architecture invariants** that the prototype's ctx maps onto cleanly: `docEdits.ts` as the
  single write boundary ("one function = one store action = one undo entry"; components never touch
  `setStore`), autosave via `resumeStore` `markDirty()` + debounced `persistResume`, navigation
  guard, snapshot undo in `stores/undoHistory.ts` (deep-clone stack, limit 50, 500 ms coalescing) —
  functionally equivalent to the prototype's snapshot/900 ms/100 model; keep the production numbers
  or align, either is fine.
- **Top bar**: Undo/Redo with disabled states + `Mod+Z`/`Mod+Shift+Z`/`Mod+Y` hotkeys with
  `skipWhenEditable`, Import, Export (server render stays the artifact of record), History
  (VersionHistory modal), Edit/Done toggle, Templates + Sections triggers, page-count text, mode
  initialization (blank resume opens in edit, else done). All owner-mandated keeps.
- **`SheetMode` contract** (`sheetMode.ts`): `"edit" | "done"` context + the rule that Done renders
  plain document content (no chrome, no placeholders, no dialogs). Matches the prototype's mode
  model exactly.
- **Markdown pipeline**: markdown-native store (#786), one-time HTML→markdown migration stamping
  `metadata.contentFormat`, `markdown.ts` pure selection transforms constrained to what
  `html_to_typst.rs` survives, `MarkdownView` rendering links as spans (document, not navigation
  surface). This is the recommended resolution of the §4.2 format conflict — the prototype's
  `execCommand`/innerHTML mechanics are replaced, its UX contract kept.
- **`itemFields.ts`** per-section field specs and `ItemDialog`'s generated form incl. correctly
  **typed** fields for awards/certs/pubs/volunteer/references (answers §4.2's NamedItem row),
  `emptyItemFor`/`generateId` (cuid-style), reseed-on-open-only.
- **Template layouts from the server** (`GET /api/templates`, `TemplateLayout`, sidebarWidth in
  **pt** converted to a clamped ratio; `applyTemplate` skipping a re-pick of the current template),
  `--doc-sheet-pt`/`cqw` scaling so stored point sizes match the Typst render, theme CSS vars from
  `metadata.theme`.
- **A11y patterns** the prototype lacks: LiveRegion announcements for moves, chrome revealed by
  `opacity` (never `display:none`) so controls stay focusable, `@media (hover:none)` forcing chrome
  visible, refocus-by-id after commit redraws, `aria-label="Page N of M"`.
- Item **Duplicate** and per-item **Hide/Show** + Hidden badge (not in the prototype; keep as
  additive).
- SectionsPanel extras worth keeping: custom-section **delete** (trash) — resolves Open question 5 —
  and the Notes textarea.

### 5.2 Replaced by prototype behavior (rework)

- **Page model**: #788 renders fixed A4 frames (`aspect-ratio:210/297`, `overflow:hidden`) and
  merely _reports_ overflow ("Content overflows page N"); new pages exist only via an explicit
  NewPageZone drop. The prototype's model is normative: **content-sized sheets, dashed A4 overflow
  guides at 1122px intervals, measured page count in a floating bottom-center pill, page-break rules
  with "Page N" labels and a "Remove page break" action, `metadata.itemBreaks` mid-section splits
  with "(cont.)" titles, `removePageBreakAt` merge semantics** (§3). The overflow status text and
  NewPageZone go away (end-of-column Add-section block + moveSection auto-page-creation replace the
  latter).
- **Drag surfaces**: #788 drags start **from the handle only** (`dragActivators` on
  `.doc-sheet__drag-handle`). Prototype is normative: **whole-card / whole-row drag** with the
  control/armed-text veto list (§2.4–2.5), grip retained as an explicit affordance. Keep solid-dnd
  if it can express this; the veto rules and indicator behavior are the spec.
- **Drop indicators**: #788 uses outline/tint on the target (`--drop` classes). Prototype is
  normative: **3px accent slot bars at the exact insertion index** (before/after, absolutely
  positioned, no layout shift), dragged source at ~0.4 opacity, Add-section block as end-of-column
  target with `drop-hint`. The `DragOverlay` text pill may stay.
- **Inline editing affordance**: #788's `InlineText` is a button that swaps to an `<input>` on
  single click/Enter/Space; hover shows tint + inset underline. Prototype is normative for the
  _feel_: **double-click-to-arm contentEditable-style editing in place with caret at the pointer**,
  subtle accent underline on hover, Enter/blur commit, and the **floating FormatToolbar** for rich
  fields. Reconcile: keep #788's commit latch, changed-only commit, Escape-reverts (prototype's
  Escape-still-commits is the bug — Open question 3 resolves toward #788), and refocus-by-id; adopt
  the prototype's arming gesture, pointer-caret placement, and hover styling. `MarkdownEditor`'s
  textarea-with-toolbar remains the _modal_ rich field (MiniRichEditor equivalent); for on-sheet
  rich blocks (summary), the prototype's in-place editing with the floating toolbar replaces the
  swap-to-textarea, implemented over the markdown command layer.
- **Section chrome**: #788 shows a chrome row of icon buttons (handle, up/down/prev/next, hide,
  rename/delete). Prototype is normative: **grip + pencil in the section header, actions
  consolidated into the pencil dropdown menu** (Add item / Move up / Move down / Move to
  sidebar|main / Rename / Hide) with disabled bounds, HA dashed-card styling incl. focused state
  (§1.5). Rename moves from InlineText-on-title to the menu → but see Open question 1 (inline title
  editing is the better production answer; #788 already has it).
- **Item chrome**: #788's `.doc-sheet__item-actions` icon row → prototype's **floating top-right
  pill** (✎ ↑ ↓ −) for full rows and the **compact row contract** (row click = edit, bare ✕, dots
  yield on hover) for sidebar sections (§1.9). #788's Duplicate/Hide join the pill (order: ✎ ↑ ↓ ⧉ 👁
  −) or the pencil-menu equivalent — implementer's choice, but the pill reveal/placement is fixed.
- **Add affordances**: #788's "Add {noun}" buttons become the prototype's **dashed add blocks**
  (per-section, §1.10) and the **dashed Add-section block per column** (§1.6); "Add section"
  currently at sheet level moves into each column's end.
- **SectionsPanel/TemplatesDrawer chrome**: keep the production `Drawer` mechanics, restyle per
  prototype (eye toggles with line-through off-state; template cards with structural mini-previews —
  #788's server thumbnails are an acceptable upgrade over the CSS miniatures, keep them, but add the
  active ring and layout-summary line already present).
- **Header/contact**: #788's `DocHeader` (contact placeholders in edit, region logic) survives, but
  gains the prototype's `contactIn`/`headerStyle` placement matrix incl. sidebar avatar+contact
  block and banner variants (§1.4), and the **avatar → PhotoModal** flow (both have it; keep #788's
  `PhotoDialog` with `lib/imageUpload` processing — it is a superset of the prototype's modal).
- **Sidebar resize**: absent in #788 (widths come from template pt). Add the prototype's edge-drag
  handle (§3.2) writing `page.sidebar_ratio` (pending Open question 7).

### 5.3 Missing entirely in #788 (build new)

- `metadata.itemBreaks` end-to-end: schema field, docModel-equivalent pure pagination pipeline
  (`expandItemBreakPages` / `itemSlicesForSection` / `renderPages` / slice indices / "(cont.)"),
  removal UX, repair guards (§3.3–3.4).
- Overflow guides, page-count pill, page-break rules (visual pagination layer, §1.16).
- Floating FormatToolbar for on-sheet rich text (§1.12, reimplemented over markdown commands).
- Whole-surface drag + slot-bar indicators + Add-section-block drop target (§2.4–2.5).
- Focused-section state (solid accent border on last-clicked card).
- Per-item `keywords`/`customFields` on experience/education (+customFields on projects/skills):
  schema additions (§4.2), ItemDialog TagInput + ExtraFieldsEditor widgets (#788 has comma-separated
  keywords input — upgrade to chip TagInput per §1.13), TagChips/ExtraFieldsView renderers, Typst
  render support.
- Pencil dropdown menu component (section options).
- Move-to-other-column as a _menu_ action exists in #788 as prev/next buttons — keep semantics,
  relocate into the menu.
- Undo/redo **buttons** exist in #788 ✓; nothing missing there.
- Theme selection UI: absent from both the prototype page and DocEditor.tsx (only the legacy Editor
  mounts ThemeEditor). Owner keep-list requires it — mount a theme control in the doc-editor top bar
  (new work).

---

## 6. Open questions (owner decisions needed)

1. **Rename UX**: SectionChrome's "Rename title…" uses `window.prompt`. Ship an inline-editable
   `<h2>` (LiveText) or a small popover instead? (Prompt is clearly placeholder-grade.)
2. **Link insertion** in rich text also uses `window.prompt` (both FormatToolbar and
   MiniRichEditor). Needs a real link popover.
3. **Escape semantics in LiveText**: Escape disarms but the subsequent blur still commits changed
   text — i.e. there is no true "revert" for inline edits (undo covers it). Intentional, or should
   Escape restore the original value?
4. **Rich-text format**: HTML (prototype mechanics, `execCommand`) vs markdown (PR #788 +
   `contentFormat` schema). Recommendation in §4.2; needs sign-off since it dictates
   LiveText/FormatToolbar implementation.
5. **Custom section deletion**: prototype only ever hides sections (data preserved); customs
   accumulate forever in the Sections panel. Add a destructive "Delete custom section"?
6. **Explicit page-break insertion**: breaks can be removed but never _created_ directly (only
   implied by drags/pre-existing data). Add "insert page break before this item/section" (e.g. in
   the pencil/entry menus)?
7. **Sidebar width persistence**: device preference (localStorage, prototype) vs document property
   (`page.sidebar_ratio`)? Affects export fidelity — an exported PDF should probably match what the
   user saw.
8. **Cross-section item drag**: item drags are same-section only. Accept as spec, or allow moving
   e.g. a project into experience (probably not — type mismatch)?
9. **Typed item modals**: confirm the per-type field mappings for
   awards/certifications/publications/volunteer/references (§4.2 "NamedItem" row) since the
   prototype flattened them to name/description.
10. **Interests editing**: interests render as a plain list with no per-item hover chrome (unlike
    every other section) — add is modal-only, remove requires… nothing exists. Give interests the
    compact-row or chip treatment (chips seem intended, matching custom sections)?
11. **Cover letter**: excluded from the canvas (`CANVAS_EXCLUDED`) and untouched by the prototype.
    Where does cover-letter editing live in the new editor?
12. **Language modal vs generic ItemModal**: the `{kind:"language"}` modal variant is an alias of
    ItemModal on `languages` — keep single modal kind in production.
13. **Proficiency scale labels** (Beginner/Elementary/Conversational/Fluent/Native) — confirm as the
    canonical 1–5 labels, and whether `description` should keep being auto-overwritten from the
    level (prototype behavior) or stay free text (schema allows both).
14. **`separateLinks` / `columns` section meta**: unused by the sheet UI. Drop from the new editor's
    UI scope or expose in the pencil menu?
15. **Photo aspect ratio**: schema has `aspect_ratio` but the modal never exposes it (always 1). In
    scope?
