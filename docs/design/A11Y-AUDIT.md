# Manual Accessibility Audit

**Date:** 2026-07-28
**Scope:** `apps/web` (editor, live preview, layout editor, template picker, import/export
dialogs, command palette, rich text editor, home library, account, offline/PWA) and
`apps/site` (home, docs, docs search, pricing, theme switcher, template gallery).
**Checklist:** [The A11Y Project checklist](https://www.a11yproject.com/checklist/), read
against WCAG 2.2 AA — the floor [`BRAND.md`](BRAND.md) binds as a design principle.
**Commit audited:** `96afa07` (after #618, #620, #622, #624 landed).
**Browser:** Chromium via Playwright 1.61, production builds served by `vite preview` /
`astro preview`.

This is the manual half of the accessibility work. It deliberately does **not** restate what
the automated suites already cover — `apps/web/e2e/accessibility.spec.ts` and
`apps/site/e2e/accessibility.spec.ts` scan WCAG 2.2 A/AA with `target-size` enabled, and both
were green at the audited commit. Automated scanning reaches roughly a third of WCAG success
criteria. Everything below is the other two thirds.

## What this audit can and cannot establish

**Verified here**, by reading source and by driving a real browser: focus order against DOM
order, focus traps and focus restoration, tab-reachability of every interactive control,
visible focus indicators, landmark and heading structure, reflow at 320 px and 200 % zoom,
target sizes, presence and wiring of live regions, forced-colors rendering, and whether an
ARIA pattern is implemented as declared.

**Not verified here**, because it needs a human at a screen reader: whether an announcement is
*useful*, whether a label is *meaningful* rather than merely present, and whether the reading
order *makes sense*. Those rows are marked **NEEDS-HUMAN** and carry a one-line instruction for
the verifier. **No screen-reader criterion in this document is recorded as a pass.** An open
item is honest; a fabricated pass is not, and that asymmetry is the reason #623 exists.

### Legend

| Mark | Meaning |
| --- | --- |
| **pass** | Verified by code reading or a browser measurement stated in the evidence column. |
| **fail** | Verified failure, with a linked follow-up issue. Not fixed in this pass. |
| **NEEDS-HUMAN** | Cannot be settled without a screen reader and a human listener. |
| **not reproduced** | Suspected, actively probed, and not observed. Stated as an absence of evidence, not as proof of correctness. |

Measurements below quote the probe output verbatim. The probes themselves were temporary and
are not committed; ["How to re-run this audit"](#how-to-re-run-this-audit) says how to
reconstruct them.

---

## App — global chrome (`apps/web`)

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.4.1 Bypass Blocks — skip link | **fail** ([#661](https://github.com/lgtm-hq/Rustume/issues/661)) | `AppShell.tsx:21` renders `<a href="#main-content">`, `:141` renders `<main id="main-content" tabindex={-1}>`. Tab → skip link focused; Enter → `location.hash === "#main-content"` but `document.activeElement` is still the `<a>`; next Tab → "Toggle sidebar", `insideMain: false`. The link bypasses nothing. `apps/site` does this correctly. |
| 1.3.1 Landmarks unique and labelled | pass | Home: 1 `main`, 1 `banner`, 1 `contentinfo`, `nav[aria-label="Primary"]`. Editor: 1 `main`, `nav` "Primary" + "Resume sections", 0 `contentinfo` (footer deliberately hidden on the editor — `AppShell.tsx:150-152`). No duplicates, all navs named. |
| 1.3.1 / 2.4.6 Heading structure | **fail** ([#670](https://github.com/lgtm-hq/Rustume/issues/670)) | Home: 0 `h1`. Editor: 0 `h1`; outline starts `h2:Personal Information → h3:Website → h3:Profile Photo → h3:Section Visibility`. Account: 1 `h1` ("Account") — correct. axe's `page-has-heading-one` is `best-practice`-tagged, so the WCAG-tag scans never run it. |
| 2.4.7 Focus Visible | pass | Tab sweep over 20 editor controls: every stop reports a computed `outline: solid 2px` or `solid 3px`. No stop relied on `box-shadow` alone. |
| 2.4.3 Focus Order — top-level tab order | pass | 45-step Tab sweep across the editor: 0 inversions between tab order and DOM order (`docIndex` monotonically increasing at every step). |
| 4.1.3 Status Messages — offline transition | **fail** ([#668](https://github.com/lgtm-hq/Rustume/issues/668)) | `AppShell.tsx:130-135`. With the context offline, the "Offline" pill renders and its ancestor chain is `span → div → div → div → header → div` — no `role`, no `aria-live`. The state change is visual only. `SaveIndicator` in the same file (`:176`) gets this right. |
| 4.1.3 Status Messages — save state | NEEDS-HUMAN | `AppShell.tsx:176-180` is `role="status" aria-live="polite"` and cycles Saving… → Unsaved → Saved. **With VoiceOver on, type continuously in the Full Name field for 30 s and confirm the save indicator does not narrate every state flip over your typing.** |
| 2.4.11 Focus Not Obscured — sticky header | not reproduced | See [SC 2.4.11](#sc-2411-focus-not-obscured). |

## App — editor form pane

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.1.1 Keyboard — every control reachable | pass | 45-step Tab sweep reaches the view toggles, toolbar (Import / History / template / Export), sidebar pin, all 20 section tabs, all Basics fields, the photo upload button, preview zoom controls, the preview viewport, and the section-visibility panel. No control required a pointer. |
| 2.4.3 Focus Order — visual vs DOM | pass | The sweep's rects ascend within each pane and move left-to-right across panes (rail x≈8 → form x≈204 → preview x≈1152). Matches the visual reading order. |
| 3.3.2 Labels or Instructions | NEEDS-HUMAN | Every field resolves a label via Kobalte `TextField` (`Input.tsx`, `TextArea.tsx`); required fields render "Full Name\*". **With VoiceOver on, tab through the Basics form and confirm each field's announcement names the field, its required state, and any format expectation — not just a word.** |
| 1.3.2 Meaningful Sequence — reading order | NEEDS-HUMAN | **With VoiceOver's rotor set to "Read all from here" at the top of the editor, confirm the sidebar, form and preview are read as three distinct regions and that the preview does not interleave with the form.** |
| 2.5.8 Target Size (Minimum) | pass | Covered by the automated `target-size` rule (#622); re-confirmed here for the controls the scans could not reach at the time: layout move controls 28×28, rich-text toolbar 28×28, "Expand editor" 26×26. All clear of the 24 px floor. |

## App — live preview

The issue named this the highest-risk surface. It is.

| Criterion | Status | Evidence |
| --- | --- | --- |
| 4.1.3 Status Messages — announces on every re-render | **fail** ([#666](https://github.com/lgtm-hq/Rustume/issues/666)) | `Preview.tsx:752-757` renders the loading overlay as `<div role="status">` with `<span class="sr-only">Updating preview</span>`. `role="status"` carries an implicit `aria-live="polite"` — inherited, not chosen; nothing in the file states an intent. A MutationObserver over `document.body`, counting inserted nodes that are or contain a live region, recorded **24 insertions of "Updating preview"** while typing "Ada Lovelace" (12 characters) at 600 ms intervals — just over the 500 ms debounce at `Preview.tsx:276`. Two announcements per keystroke. |
| 4.1.3 Status Messages — first render | pass | `Preview.tsx:711-713` is a second `role="status"` ("Rendering…") shown only when there is no preview yet. A genuine first-load pending state, announced once. Correct as-is. |
| 4.1.2 — preview image is not in a live region | pass | The `<img alt="Resume preview">` ancestor chain is eight generic `div`s deep with no `role` and no `aria-live` at any level. The image swap itself is silent, which is right. |
| 1.1.1 Non-text Content — preview alt text | NEEDS-HUMAN | The preview is a server-rendered PNG of the whole resume behind `alt="Resume preview"`. The alt is present and the document's content is available in the editor beside it, so this is defensible — but "defensible" is not "verified". **With VoiceOver on, navigate to the preview image and judge whether "Resume preview" tells you what you need, or whether you would want the page count and current page instead.** |
| 2.2.2 Pause, Stop, Hide | pass | The preview repaints only in response to user edits, debounced 500 ms (`Preview.tsx:276`). Nothing auto-updates unprompted. |

## App — command palette

`apps/web/src/components/ui/CommandPalette.tsx`. It does implement combobox/listbox with
`aria-activedescendant` — the issue's suspicion that it might be arrow handlers only was
wrong. What it gets wrong is subtler.

| Criterion | Status | Evidence |
| --- | --- | --- |
| 4.1.2 Name, Role, Value — focus model | **fail** ([#664](https://github.com/lgtm-hq/Rustume/issues/664)) | Options are `<button role="option">` (`:238-243`), which are natively tabbable. On open, focus is on the input with `aria-activedescendant="command-option-0"`. One **Tab** moves DOM focus to `button#command-option-0`. A subsequent **ArrowDown** leaves DOM focus on option 0 while the input's `aria-activedescendant` and `[aria-selected=true]` both move to option 1 — `mismatch: true`. A screen reader follows DOM focus, so it reports option 0 while Enter runs option 1. The dialog's own footer ("↑↓ navigate") instructs the user into this state. |
| 4.1.3 Status Messages — empty result set | **fail** ([#665](https://github.com/lgtm-hq/Rustume/issues/665)) | Query `zzzzqqqqxxxx`: `[role=option]` count drops 7 → 0, `aria-activedescendant` is correctly removed, "No matching commands" renders as a plain `<p>` (`:225`), and live regions inside the dialog: **0**. The transition is silent. |
| 2.1.2 No Keyboard Trap | pass | Escape closes the palette from any state (`:160-163`); the Kobalte `Dialog` handles overlay dismissal. |
| 2.4.3 Focus Order — focus on open | pass | `:126` focuses the input in a microtask after open; measured `activeIsInput: true`. |
| 2.4.3 Focus Order — focus on close | **fail** ([#662](https://github.com/lgtm-hq/Rustume/issues/662)) | Shares the root cause with the other dialogs — see below. |
| 1.3.1 — group headings | NEEDS-HUMAN | Section headings ("Recent", and each `action.group`) render as styled `div`s inside the listbox (`:233`), which a `listbox` may not own. Structurally suspect, but it did not produce a measurable defect. **With VoiceOver on, open the palette and arrow through the list; confirm you can tell where "Recent" ends and the command groups begin.** |

## App — dialogs (import, export, template picker, shortcuts, version history, sign-in)

All app dialogs are genuine `@kobalte/core` primitives — a grep for hand-rolled
`role="dialog"` in `apps/web/src` returns nothing. The issue's concern about hand-rolled
equivalents applies to `apps/site`, not here.

| Criterion | Status | Evidence |
| --- | --- | --- |
| 4.1.2 — dialogs use accessible primitives | pass | `Modal.tsx:1` and `CommandPalette.tsx:1` import Kobalte `Dialog`; `AuthMenu`/`EditorThemeSelector` use `DropdownMenu`; `Sidebar` uses `Tooltip`; `Toast` uses the toast primitive. No hand-rolled `role="dialog"` anywhere in `apps/web/src`. |
| 2.4.3 Focus Order — focus on open | pass | Import dialog: `focusInsideDialog: true`, initial focus on "Choose a resume file to import". Export dialog: `focusInsideDialog: true`, initial focus on the PDF option. |
| 2.4.3 Focus Order — focus on close | **fail** ([#662](https://github.com/lgtm-hq/Rustume/issues/662)) | Import via Escape → `activeElement: BODY`. Import via the Close button → `BODY`. Export via Escape → `BODY`. Confirmed by the user-visible symptom: the next **Tab** after closing lands on **"Skip to content"**, the first tab stop of the document. Affects all ten `Modal` consumers. |
| 1.3.2 Meaningful Sequence — close button placement | **fail** ([#663](https://github.com/lgtm-hq/Rustume/issues/663)) | `Modal.tsx:45-48` gives `Dialog.CloseButton` `absolute top-4 right-4`, but `Dialog.Content` has no `relative` — its computed `position` is `static`. Measured with the template picker open at 1280×720: dialog `{x:352, y:113, w:576, h:495}`, close button `{x:1228, y:16, w:36, h:36}`, `closeInsideDialog: false`. The control paints in the viewport corner, 876 px from its dialog. |
| 2.4.7 Focus Visible — inside dialogs | pass | Every tabbable in the template picker (8 controls) reports a `3px` outline on focus. |
| 2.1.2 No Keyboard Trap | pass | Escape dismisses every dialog tested; `dialogsOpen: 0` after. |
| 3.3.1 Error Identification — import errors | NEEDS-HUMAN | `ImportModal.tsx:305` uses `role="alert"` for the failure path and `:278-279` `role="status" aria-live="polite"` for progress. Wiring is present and deliberate. **With VoiceOver on, import a deliberately malformed JSON file and confirm the error is announced once, names the file and the reason, and does not clash with the progress status.** |
| 3.3.1 Error Identification — export errors | NEEDS-HUMAN | `ExportModal.tsx:230` uses `role="alert"`. **With VoiceOver on, trigger an export with the render service stopped and confirm the failure is announced and states what is still safe** (`BRAND.md` requires "what failed, why, and what is still safe"). |

## App — layout editor

`@thisbeyond/solid-dnd`. #622 rebuilt these affordances; this audits the merged state.

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.5.7 Dragging Movements | pass | Per-section move controls sit outside the draggable card (`DraggableSection.tsx:133-159`), 56 of them on a default two-column resume, each 28×28, each labelled per section ("Move Cover Letter up"). Every rearrangement the drag supports is reachable with a single click. |
| 4.1.2 — card role after #622's rework | pass | Cards are `role="group"` with `aria-roledescription="draggable section"` and `aria-label`, not `role="option"` (`DraggableSection.tsx:83-85`); columns are `role="group"` with a name (`DroppableColumn.tsx:41`). The explicit `group` is required — a bare `div` maps to `generic`, where `aria-roledescription` and `aria-label` are prohibited. Measured: `{"role":"group","roleDesc":"draggable section","label":"Cover Letter","tabindex":"0"}`. |
| 2.1.1 Keyboard | pass | Space picks up, arrows move, Space/Enter drops, Escape cancels and restores (`LayoutEditor.tsx:256-304`). Tab traverses card → its move controls → next card, in visual order: `["coverLetter-ArrowDown","coverLetter-ArrowRight","profiles","profiles-ArrowUp",…]`. Disabled boundary controls are correctly skipped. |
| 3.3.2 Labels or Instructions | **fail** ([#671](https://github.com/lgtm-hq/Rustume/issues/671)) | The card announces as "Cover Letter, draggable section, group" and nothing more: `aria-describedby: null`, and `role="group"` implies no interaction. The instructions exist only in an unassociated `<p>` (`LayoutEditor.tsx:491-495`) and in the live region *after* the user has already guessed Space. `aria-grabbed`/`aria-selected`/`aria-pressed` are all `null` while picked up — #622 removed `aria-selected` deliberately, leaving the one-shot announcement as the only signal. |
| 4.1.3 Status Messages — reorder announcements | NEEDS-HUMAN | `LiveRegion.tsx` is `aria-live="polite" aria-atomic="true"`, and `announceLive` clears then re-sets to force a re-read. Measured after Space: `"Picked up Cover Letter. Use arrow keys to move, Enter or Space to drop, Escape to cancel."` The wiring is right and the politeness is explicit. **With VoiceOver on, pick up a section and move it four times in a row; confirm each move is announced once, in order, and that the queue does not lag behind your keypresses.** |
| 2.5.7 — pointer dragging itself | NEEDS-HUMAN | Flagged in PR #657 as having no automated coverage; still true. **Drag a section between columns with a mouse and confirm the drop lands where the overlay indicated.** Not a screen-reader item, but equally unautomated. |

## App — rich text editor (TipTap)

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.1.2 No Keyboard Trap | pass | From inside `.tiptap`, the first Tab is swallowed by ProseMirror and the second moves out: trail `[{name:"Summary",inEditor:true}, {name:"Zoom out",inEditor:false}, …]`. Escapable, so not a trap — but the swallowed first press is worth a human's opinion (below). |
| 4.1.2 Name, Role, Value | pass | `.tiptap` reports `role="textbox"`, `aria-label="Summary"`, `aria-multiline="true"`, `contenteditable="true"`. This is #622's fix holding. |
| 4.1.2 — toolbar | pass | Wrapper carries `role="toolbar"`; Bold / Italic / Underline / Link / Bullet List / Ordered List each expose `aria-pressed` and measure 28×28. |
| 2.1.1 Keyboard — first Tab is consumed | NEEDS-HUMAN | Not a WCAG failure (a second press escapes), but potentially confusing. **With VoiceOver on, type in the Summary editor and press Tab once; confirm you can tell that focus has not moved, rather than being left unsure.** |

## App — toasts

| Criterion | Status | Evidence |
| --- | --- | --- |
| 4.1.3 Status Messages — politeness | **fail** ([#667](https://github.com/lgtm-hq/Rustume/issues/667)) | Every toast renders `<li role="status" aria-live="assertive" aria-atomic="true" tabindex="0">`. Assertive is the Kobalte default; `Toast.tsx:137-152` passes no priority and `show()` (`:163`) never sets one. So "New resume created" and "Layout updated to 2 columns" interrupt whatever a screen reader is saying. The file already distinguishes severity for dismissal timing (`DEFAULT_DURATION`, `:35`) but not for politeness. |
| 2.2.1 Timing Adjustable | pass | Kobalte pauses the dismissal timer on interaction: a 4 s success toast was still present after **6 s** of hover (`afterHover6s: 1`). |
| 1.3.1 — list semantics | pass | `Toast.tsx:147-150` sets `role="none"` on the `<ol>` with a documented reason: Kobalte's `<li role="status">` children are not listitems. The labelled region (`role="region"`, "Notifications (alt+T)") and the per-toast status carry the meaning. |
| 2.4.11 Focus Not Obscured — toast stack | not reproduced | See [SC 2.4.11](#sc-2411-focus-not-obscured). |
| 2.2.1 — reaching a toast action by keyboard | NEEDS-HUMAN | Toasts are `tabindex="0"` inside a top-layer region whose only documented entry point is Kobalte's `alt+T`, which the UI never mentions. **With VoiceOver on, trigger a toast that carries an action button and try to reach that button before the toast dismisses, without using a mouse.** |

## App — home library

| Criterion | Status | Evidence |
| --- | --- | --- |
| 1.4.10 Reflow (320 px) | **fail** ([#669](https://github.com/lgtm-hq/Rustume/issues/669)) | At 320×512: `scrollWidth: 349` vs `clientWidth: 320`. Offender is `div.ml-auto.flex.flex-wrap.items-center.gap-2.shrink-0` (`HomeLayouts.tsx:155`), width 333, right edge 349 — the sort/view control cluster. `shrink-0` and `flex-wrap` on the same element contradict each other. |
| 4.1.2 — view and scope toggles | pass | List / Grid / Gallery view buttons expose `aria-pressed` (`"false"/"true"/"false"`); the sidebar toggle exposes `aria-pressed`, `aria-expanded` and `aria-controls`. |
| 4.1.3 Status Messages — view/scope changes | NEEDS-HUMAN | `StatusStrip.tsx:51` is `role="status" aria-live="polite"` reading `"view: grid · scope: all"`. Wiring is deliberate. **With VoiceOver on, switch view three times in a row and confirm the strip announces the new state each time without reading the whole strip's history.** |
| 1.3.1 Landmarks — scope groups | pass | `HomeSidebar.tsx:348`, `:366`, `:445` use `role="group"` with `aria-labelledby` pointing at real heading ids. |

## App — account, offline, PWA

| Criterion | Status | Evidence |
| --- | --- | --- |
| 1.3.1 / 2.4.6 Headings — account | pass | 1 `h1` ("Account"), 1 `main`. The only app route that gets this right. |
| 4.1.3 — offline transition | **fail** ([#668](https://github.com/lgtm-hq/Rustume/issues/668)) | Recorded under global chrome above. |
| 1.4.1 Use of Color — offline indicator | pass | The pill pairs a colour dot with the literal text "Offline" (`AppShell.tsx:131-134`); colour is not the only carrier. |
| 2.3.3 Animation from Interactions | pass | The offline dot's `animate-pulse-subtle` carries `motion-reduce:animate-none` (`AppShell.tsx:132`). #624 made all animations translation/scale-only with a sitewide reduced-motion block; the three surviving opacity keyframes are text-free. |
| 1.4.13 Content on Hover or Focus | NEEDS-HUMAN | Preview and offline states carry no hover-triggered content in the app; the site's nav dropdown is covered below. **No action needed unless a human finds a hover-only affordance this pass missed.** |

---

## Site — global chrome (`apps/site`)

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.4.1 Bypass Blocks — skip link | pass | Tab → "Skip to content" (`href="#main-content"`, visible at `top: 12`); Enter; next Tab → focus is **inside `<main>`** (`insideMain: true`). This is the behaviour the app's skip link should have and does not. |
| 1.3.1 Landmarks | pass | `/`, `/docs/`, `/faq/`, `/cloud/` each report 1 `main`, 1 `banner`, 1 `contentinfo`, `nav[aria-label="Main"]`. Docs article pages add `nav[aria-label="Documentation"]` (17 links) and `aside[aria-label="On this page"]`. |
| 1.3.1 Heading structure — footer | **fail** ([#676](https://github.com/lgtm-hq/Rustume/issues/676)) | `h2 → h4` skip on `/docs/`, `/faq/`, `/cloud/` and every docs article. Both offenders resolve to `.footer-col` in `Footer.astro` ("Docs", "Community"). `/` passes only because its own content supplies `h3`s. axe's `heading-order` is `best-practice`-tagged, so the site scan never runs it. |
| 1.3.1 Heading structure — pages | pass | Exactly one `h1` per page: "Forge resumes with quiet craft", "Documentation", "Frequently asked questions", "Rustume Cloud", "Quickstart". |
| 2.4.8 Location | pass | `DocsSidebar.astro:33` sets `aria-current="page"` on the active doc; measured on a docs article: `nav[aria-label="Documentation"]` reports `current: ["page"]`. `DocsOnThisPage.astro:117` sets `aria-current="location"` on the active TOC entry. |
| 2.4.7 Focus Visible | pass | 14-step Tab sweep on `/docs/`: every stop reports `outline: auto 1px` or `auto 3px`. |
| 1.4.13 Content on Hover or Focus — nav dropdown | pass | `NavDropdown.astro`. Focusing the trigger opens the panel (`is-open`, `aria-expanded="true"`, panel `visibility: visible`, `role="group"` named "Docs pages"). **Hoverable:** 220 ms close delay and the panel is inside the hover target. **Dismissible:** Escape closes it and returns focus to the trigger (`activeIsTrigger: true`). **Persistent:** stays until blur or Escape. Panel links are keyboard-reachable — Tab from the trigger lands on "Quickstart" inside the panel. |

## Site — docs search

`SearchDropdown.astro`. This is the hand-rolled dialog the issue asked about.

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.4.3 Focus Order — containment | **fail** ([#672](https://github.com/lgtm-hq/Rustume/issues/672)) | `:39` declares `role="dialog"` and the trigger declares `aria-haspopup="dialog"`, but nothing contains focus. With the dialog open and `opacity: 1`: `aria-modal: null`, `main[inert]: false`, `main[aria-hidden]: null`. Six Tab presses, dialog still open the whole time: "Select theme" → "GitHub" → "CLI" → "Rustume Cloud" → "Pricing" → "API", **all outside the dialog**. One Tab leaves. |
| 2.4.3 Focus Order — on open and on Escape | pass | Focus lands on the Pagefind input on open (`focusInside: true`), via the documented cross-frame retry at `:70-94`. This is #620 holding. |
| 4.1.3 Status Messages — result count | **fail** ([#673](https://github.com/lgtm-hq/Rustume/issues/673)) | Query `resume`: `messageText: "31 results for resume"`, `resultCount: 5`, **live regions inside `#search-menu`: 0**. The count arrives silently. |
| 1.3.1 — closed state removed from the tree | pass | The panel is hidden with `visibility: hidden` (`:308`) rather than the `hidden` attribute. `visibility: hidden` does remove it from the accessibility tree and from the tab order, so the closed state is correct. |
| 2.4.6 Headings and Labels — result quality | NEEDS-HUMAN | **With VoiceOver on, search "export" and arrow through the results; confirm each result announces a title you can distinguish from the others, rather than repeated boilerplate.** |

## Site — theme switcher

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.4.3 Focus Order — on selection | **fail** ([#674](https://github.com/lgtm-hq/Rustume/issues/674)) | `applyFromPicker` (`:232-239`) calls `setOpen(false)`, which sets `hidden` on the panel while the focused option is inside it. Pure keyboard path (focus trigger, Enter, ArrowDown, Enter): theme applied (trigger label became "Frappé"), `panelHidden: true`, **`document.activeElement: BODY`**. |
| 4.1.3 Status Messages — theme change | **fail** ([#674](https://github.com/lgtm-hq/Rustume/issues/674)) | Same interaction: `liveRegions: 0`. The page repaints entirely and nothing is announced. The swatch that carries the visual confirmation is correctly `aria-hidden="true"` (`:52`), so there is no fallback. |
| 1.3.1 / 4.1.2 — listbox structure | **fail** ([#675](https://github.com/lgtm-hq/Rustume/issues/675)) | `role="listbox"` owns `div[role="presentation"] > (p + div) > button[role="option"]`. Measured children: `[{tag:"div",role:"presentation",innerRoles:["p[-]","div[-]"]}, …]`, `optionCount: 44`. `presentation` removes the wrapper's own role but not its descendants', so the listbox owns a `<p>` and a generic `<div>`, and the "Dark"/"Light" group headings are structurally orphaned. |
| 4.1.2 — aria-activedescendant placement | **fail** ([#675](https://github.com/lgtm-hq/Rustume/issues/675)) | `aria-activedescendant` is set on `#theme-picker-panel` (`:108`, `:202`, `:228`), which has no `tabindex` and never receives DOM focus — `moveActive` (`:114`) calls `option.focus()`. Measured: `panelActiveDescendant` matches `domFocusId`, but the attribute sits on the wrong element. Inert rather than user-visible: roving DOM focus is doing the work. |
| 2.4.3 Focus Order — on Escape | pass | Escape closes the panel and returns focus to the trigger (`active: "theme-picker-trigger"`). Only the selection path is broken. |
| 1.4.1 Use of Color | pass | Each option pairs its colour swatch (`aria-hidden="true"`) with a text label and a "Light"/"Dark" mode word. |

## Site — template gallery

The best-implemented dialog in either app. Recorded as the model the search dialog should copy.

| Criterion | Status | Evidence |
| --- | --- | --- |
| 2.4.3 Focus Order — containment | pass | `aria-modal: "true"`, `body > main` and `body > header` both `inert`, the dialog's own `<header>` **not** inert (this is #620's fix holding). Five Tab presses cycle between exactly two stops, both `inDialog: true`. |
| 2.4.3 Focus Order — open and close | pass | Opens with focus on "Close preview"; Escape restores focus to the originating card (`isCard: true`, `"Preview rhyhorn template"`). |
| 1.1.1 Non-text Content | pass | The card thumbnail is `alt=""` with the name in adjacent text; the dialog image gets `alt="rhyhorn resume template preview"` set on open (`TemplateGallery.astro:107`). |
| 2.1.1 Keyboard — scrollable region | pass | `.template-modal-body` is `role="group" tabindex="0" aria-label="Template preview"` with `scrollHeight: 933` over `clientHeight: 585` — genuinely scrollable, and reachable without a pointer. |
| 2.5.8 Target Size | pass | Close button 26×28; cards 178×320. |

## Site — pricing

| Criterion | Status | Evidence |
| --- | --- | --- |
| 1.3.1 — table structure | pass | Real `<table>` with `<th scope="col">` on all three headers ("Feature", "Self-hosted OSS", "Rustume Cloud"). |
| 1.3.1 — table caption | NEEDS-HUMAN | No `<caption>`. The table follows a heading that names it, which is usually enough. **With VoiceOver on, enter the pricing table using table navigation and confirm you can tell what the table is about without leaving it.** |
| 1.4.1 Use of Color / 1.1.1 | NEEDS-HUMAN | Availability is carried by a `✅` emoji in the cell text — not colour, so 1.4.1 is not at risk, but the announcement is a Unicode name rather than a word. Note `BRAND.md` rules out emoji in product UI copy. **With VoiceOver on, read across one feature row and confirm the included/excluded state is unambiguous.** |

---

## Cross-cutting dimensions

### Keyboard-only, end to end

Both apps were driven by Tab, Shift+Tab, arrows, Space, Enter and Escape only. Every
interactive control in the audited surfaces was reachable. The failures are not
*reachability* — they are **focus destination**: the app's skip link
([#661](https://github.com/lgtm-hq/Rustume/issues/661)), every app dialog on close
([#662](https://github.com/lgtm-hq/Rustume/issues/662)), the site's theme selection
([#674](https://github.com/lgtm-hq/Rustume/issues/674)), and the site's search dialog
containment ([#672](https://github.com/lgtm-hq/Rustume/issues/672)). Three of those four end
with focus on `<body>`, which is the single most common way this class of bug presents.

### 200 % zoom (SC 1.4.4)

Simulated as a 640×400 viewport against a 1280×800 baseline.

| Surface | Result |
| --- | --- |
| App editor | pass — `scrollWidth 640 == clientWidth 640` |
| Site `/docs/` | pass — `scrollWidth 640 == clientWidth 640` |

### 400 % reflow / 320 px (SC 1.4.10)

Simulated as a 320×512 viewport, which is 1280 px at 400 %.

| Surface | `scrollWidth` / `clientWidth` | Result |
| --- | --- | --- |
| App home | 349 / 320 | **fail** ([#669](https://github.com/lgtm-hq/Rustume/issues/669)) |
| App editor | 320 / 320 | pass at the document level — but the preview pane clips its content rather than reflowing it (descendants measured out to `right: 765`). The pane has its own pan/zoom, so this is arguably a permitted scrolling sub-region; **a human should confirm the preview is still usable at 320 px.** |
| Site `/` | 320 / 320 | pass |
| Site `/docs/` | 320 / 320 | pass |
| Site `/cloud/` | 320 / 320 | pass |
| Site `/faq/` | 324 / 320 | **fail** ([#677](https://github.com/lgtm-hq/Rustume/issues/677)) |

### Forced colors / high contrast (SC 1.4.11, 2.4.7, 1.4.1)

Emulated with `page.emulateMedia({ forcedColors: "active" })` and driven by real Tab presses
(programmatic `.focus()` does not trigger `:focus-visible` and gives a false negative here).

| Check | Result |
| --- | --- |
| Focus indicators survive | **pass.** All 20 app stops and all 14 site stops report a computed `outline` of `solid 2px`/`solid 3px` (app) or `auto 1px`/`auto 3px` (site). The `focus-visible:ring-*` utilities are `box-shadow`, which forced colors strips (`boxShadow: "none"` under forced colors where it was set without) — but Chromium's UA focus outline takes over, so every control stays indicated. **Note this is a UA fallback, not an authored `@media (forced-colors: active)` block. It holds today; it is not guaranteed by anything in this repo.** |
| `forced-color-adjust: none` escapes | pass — 0 elements in the app opt out of the forced palette. |
| Colour-only affordances | NEEDS-HUMAN — 10 app nodes carry `text-accent` as an icon-only affordance (collapsed sidebar rail, pin button), and site theme swatches flatten to a single colour. Both are `aria-hidden` or paired with text. **In Windows High Contrast, open the collapsed editor sidebar rail and the site theme picker and confirm the selected item is still distinguishable.** This is PR #657's "icon-only accent affordances" note, still open — axe's `color-contrast` does not evaluate icons. |

---

## SC 2.4.11 Focus Not Obscured

Issue [#622](https://github.com/lgtm-hq/Rustume/issues/622) deferred this criterion here and
named three suspects. All three were probed by driving real keyboard focus and asking
`document.elementFromPoint` what actually paints at the focused element's corners and centre.

| Suspect | Result |
| --- | --- |
| Sticky editor toolbar (`header.sticky`, `z-30`, 57 px tall) | **not reproduced.** 40 Tab stops at 1024×620: zero focused elements were painted over by the header. A static scan does find three controls whose rects intersect the header band at rest (e.g. a sidebar entry at `top: -18`), but the browser's scroll-into-view moves them clear before focus lands. |
| Bottom-right toast stack (`fixed bottom-4 right-4 z-50`) | **not reproduced.** At 1280×720 the stack occupies `{x:944, y:648, w:320, h:56}` and overlaps exactly one control's rect, with `topElementIsToast: false` — the toast does not paint over it. Re-probed at 1024×620 with a toast present: no keyboard-focused control was covered. |
| Split-view preview pane | **not reproduced.** 60 Tab stops at 900×560 in split view: the only flagged element was the skip link at `left: -9999`, which is its unfocused off-screen position and a probe artefact, not a defect. |

**This is an absence of evidence, not proof of conformance.** Three viewports and one browser
were tested. SC 2.4.11 is only partly machine-checkable, and a human at an unusual window size,
with browser zoom applied, or with the OS text size increased could still find a case. No
follow-up issue is filed, because filing one for an unreproduced failure would be as dishonest
as recording a pass for one.

PR #657's other deferred notes:

- **Hover-state contrast is not scanned systematically** — still true. Not measured in this
  pass either; it needs a systematic hover sweep, which is a different kind of tool from this
  audit. Carrying forward as a known gap.
- **`toast-slide-in` / `toast-slide-out` opacity keyframes** — resolved by #624.
- **Icon-only accent affordances** — recorded above as NEEDS-HUMAN under forced colors.
- **Pointer dragging has no automated coverage** — recorded above under the layout editor.

---

## Tally

| Surface | pass | fail | NEEDS-HUMAN |
| --- | ---: | ---: | ---: |
| App — global chrome | 3 | 3 | 1 |
| App — editor form pane | 3 | 0 | 2 |
| App — live preview | 3 | 1 | 1 |
| App — command palette | 2 | 3 | 1 |
| App — dialogs | 4 | 2 | 2 |
| App — layout editor | 3 | 1 | 2 |
| App — rich text editor | 3 | 0 | 1 |
| App — toasts | 3 | 1 | 1 |
| App — home library | 2 | 1 | 1 |
| App — account / offline / PWA | 3 | 1 | 1 |
| Site — global chrome | 6 | 1 | 0 |
| Site — docs search | 2 | 2 | 1 |
| Site — theme switcher | 2 | 4 | 0 |
| Site — template gallery | 5 | 0 | 0 |
| Site — pricing | 1 | 0 | 2 |
| Cross-cutting (zoom, reflow, forced colors) | 7 | 2 | 2 |
| **Total** | **52** | **22** | **18** |

The 22 fail rows resolve to **17 distinct defects** — the dialog focus-restore bug
([#662](https://github.com/lgtm-hq/Rustume/issues/662)) and the theme-picker defects are each
recorded on more than one surface.

## Follow-up issues

None of these are fixed in this pass; the deliverable is the audit.

| # | Title | Surface | SC |
| --- | --- | --- | --- |
| [#661](https://github.com/lgtm-hq/Rustume/issues/661) | Skip link does not move focus to main content | app chrome | 2.4.1 |
| [#662](https://github.com/lgtm-hq/Rustume/issues/662) | Closing a dialog strands focus on `document.body` | app dialogs | 2.4.3 |
| [#663](https://github.com/lgtm-hq/Rustume/issues/663) | Modal close button renders in the viewport corner | app dialogs | 1.3.2 |
| [#664](https://github.com/lgtm-hq/Rustume/issues/664) | Command palette listbox is tabbable, desyncing `aria-activedescendant` | command palette | 4.1.2 |
| [#665](https://github.com/lgtm-hq/Rustume/issues/665) | Command palette empty result set is not announced | command palette | 4.1.3 |
| [#666](https://github.com/lgtm-hq/Rustume/issues/666) | Live preview announces on every re-render while typing | live preview | 4.1.3 |
| [#667](https://github.com/lgtm-hq/Rustume/issues/667) | Every toast is announced assertively | toasts | 4.1.3 |
| [#668](https://github.com/lgtm-hq/Rustume/issues/668) | Going offline is not announced | app chrome | 4.1.3 |
| [#669](https://github.com/lgtm-hq/Rustume/issues/669) | Home library toolbar forces horizontal scrolling at 320 px | home library | 1.4.10 |
| [#670](https://github.com/lgtm-hq/Rustume/issues/670) | Home and editor pages have no `h1` | app chrome | 1.3.1, 2.4.6 |
| [#671](https://github.com/lgtm-hq/Rustume/issues/671) | Layout editor cards expose no operating instructions | layout editor | 3.3.2 |
| [#672](https://github.com/lgtm-hq/Rustume/issues/672) | Search dialog does not contain focus | docs search | 2.4.3 |
| [#673](https://github.com/lgtm-hq/Rustume/issues/673) | Docs search result count is not announced | docs search | 4.1.3 |
| [#674](https://github.com/lgtm-hq/Rustume/issues/674) | Selecting a theme strands focus and announces nothing | theme switcher | 2.4.3, 4.1.3 |
| [#675](https://github.com/lgtm-hq/Rustume/issues/675) | Theme picker listbox owns non-option elements | theme switcher | 1.3.1, 4.1.2 |
| [#676](https://github.com/lgtm-hq/Rustume/issues/676) | Footer headings skip from `h2` to `h4` | site chrome | 1.3.1 |
| [#677](https://github.com/lgtm-hq/Rustume/issues/677) | FAQ resource tags overflow the viewport at 320 px | site FAQ | 1.4.10 |

Two suppressions in the site suite are **not** in scope for these issues and were left alone:
`color-contrast` and `link-in-text-block`, the latter tracked by
[#648](https://github.com/lgtm-hq/Rustume/issues/648).

---

## How to re-run this audit

### 1. The automated floor

Run these first. Everything above assumes they are green, and re-auditing on top of a red
suite wastes the manual effort.

Run from the repository root. Each suite runs in a subshell so the second `cd` is not
resolved relative to the first.

```bash
make setup                  # builds apps/web/wasm; needed before any web e2e run
(cd apps/web  && bun run test && bunx playwright test accessibility)
(cd apps/site && bunx playwright test accessibility)
```

Both suites scan WCAG 2.2 A/AA with `target-size` explicitly enabled and guard against a
silently skipped rule (`assertRuleEvaluated`). They cover roughly a third of the success
criteria; everything in this document is the rest.

### 2. The manual probes

The probes used here were temporary Playwright specs that logged JSON rather than asserting,
so a run produces evidence to read rather than a pass/fail. To reconstruct one, add a spec
under `apps/web/e2e/` or `apps/site/e2e/`, import the suite's own `test` fixture (so the app
gets its stubbed render endpoints and the site gets its font blocks), and log measurements
with `console.log`. Run it with the list reporter and grep your prefixes out of the output.

```bash
cd apps/web && PLAYWRIGHT_REUSE_SERVER=1 bunx playwright test <spec> \
  --project=chromium --reporter=list 2>&1 | grep -E '^MY_PREFIX'
```

The measurements to reproduce, in the order they earn their keep:

1. **Focus destination.** After every dialog close, skip-link activation and menu selection,
   read `document.activeElement`. Then press Tab once more and read it again — if the next
   stop is "Skip to content", focus was lost to `<body>`. This one check found four of the
   seventeen defects.
2. **Live-region churn.** Install a `MutationObserver` on `document.body`, count inserted
   nodes matching `[aria-live],[role=status],[role=alert]`, then type ~12 characters at
   intervals just over the surface's debounce. A count near zero is correct; a count near the
   character count is a screen-reader spam bug.
3. **Tab order vs DOM order.** Press Tab N times; at each stop record
   `Array.from(document.querySelectorAll("*")).indexOf(document.activeElement)`. Count
   inversions.
4. **Focus obscured (SC 2.4.11).** At each Tab stop, sample `document.elementFromPoint` at the
   focused element's four corners and centre, and check whether the returned node belongs to a
   sticky or fixed overlay. Do this at several viewport sizes; a single size proves little.
5. **Reflow.** Set the viewport to 320×512 and compare
   `document.documentElement.scrollWidth` to `clientWidth` on every route. axe has no reflow
   rule, so this must be its own assertion.
6. **Forced colors.** `page.emulateMedia({ forcedColors: "active" })`, then walk the page with
   **real `Tab` presses** and read the computed `outline` at each stop. Programmatic `.focus()`
   does not trigger `:focus-visible` and will report a false failure.
7. **ARIA pattern integrity.** For any `combobox`/`listbox`, first establish which focus model
   the widget claims, then check that one:
   - **`aria-activedescendant`** (app command palette): DOM focus must stay on the combobox —
     `document.activeElement` is the input, never an option — and
     `input.getAttribute("aria-activedescendant")` must equal
     `[role=option][aria-selected=true]`'s id. A widget where Tab can move DOM focus into the
     list is not implementing this model, whatever it declares.
   - **Roving DOM focus** (site theme picker): `document.activeElement` must be the selected
     option, and `aria-activedescendant` should not be present at all — least of all on a
     container that never receives focus.

### 3. What still needs a human

Work the **NEEDS-HUMAN** rows above with VoiceOver (macOS) or NVDA (Windows). Each row carries
its own one-line instruction. Record the outcome by editing the row in place and dating the
change — do not delete a NEEDS-HUMAN row without recording what was heard.

### 4. Known traps

- **`reducedMotion: "reduce"` is inert** in this Playwright setup. #618 measured that
  `matchMedia` still reports `no-preference`, so the `prefers-reduced-motion` rules in
  `apps/web/src/index.css` never engage. Do not use it to test #624's work.
- **`role="status"` is `aria-live="polite"` by default.** Live-region defects here split two
  ways: politeness inherited rather than chosen ([#666](https://github.com/lgtm-hq/Rustume/issues/666),
  [#667](https://github.com/lgtm-hq/Rustume/issues/667)), and no live region at all
  ([#665](https://github.com/lgtm-hq/Rustume/issues/665),
  [#668](https://github.com/lgtm-hq/Rustume/issues/668),
  [#673](https://github.com/lgtm-hq/Rustume/issues/673),
  [#674](https://github.com/lgtm-hq/Rustume/issues/674)). When you add one, say in a comment
  why that politeness is right.
- **`role="presentation"` does not remove descendants** from the accessibility tree, only the
  element's own role. This is what breaks the site theme picker's listbox.
- **The site needs a real build.** Pagefind only exists after `bun run build`; the search
  dialog silently degrades otherwise. That is what #620 fixed.
- **axe rules tagged `best-practice` do not run** under a WCAG-tag selection —
  `page-has-heading-one` and `heading-order` among them. Two of the defects above live
  precisely in that gap.

## Related

- Parent epic: [#352](https://github.com/lgtm-hq/Rustume/issues/352) — WCAG 2.2 AA and design
  language for app and site
- This audit: [#623](https://github.com/lgtm-hq/Rustume/issues/623)
- Preceding work: [#618](https://github.com/lgtm-hq/Rustume/issues/618) (contrast),
  [#620](https://github.com/lgtm-hq/Rustume/issues/620) (site dialogs and Pagefind),
  [#622](https://github.com/lgtm-hq/Rustume/issues/622) (WCAG 2.2 tags, SC 2.5.7),
  [#624](https://github.com/lgtm-hq/Rustume/issues/624) (reduced motion)
- Design language and the contrast principle this audit is read against:
  [`BRAND.md`](BRAND.md)
- Interaction patterns for the audited surfaces: [`UX-PATTERNS.md`](UX-PATTERNS.md)
