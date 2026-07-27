# Rustume UX Patterns

Adoption decisions for Rustume's six hard interaction surfaces. Each section names **one**
pattern, cites the source it comes from, says what current behaviour it replaces and in which
file, and records why the runners-up lost.

This document exists to stop these decisions being re-litigated. If you disagree with one,
argue against the citation and update the section — do not quietly implement the runner-up.

Read [`BRAND.md`](BRAND.md) first. Where a pattern and the design language disagree, the
design language wins and the pattern is the wrong pattern.

## Ground truth this document is built on

Three facts about the running code decide most of what follows. They are cited, not assumed.

1. **Preview and PDF rendering are server-side.** `renderPreview` and `renderPdf` in
   `apps/web/src/api/render.ts` both POST the whole resume to the API and wait for a blob.
   The preview re-renders as the user types, debounced 500 ms
   (`apps/web/src/components/preview/Preview.tsx:276`). There is no local render path in the
   browser, so no pattern here may assume zero-latency preview. Every one of them needs a
   latency story and a failure story.
2. **The preview is a raster image, not a document.** `Preview.tsx:742` renders the result
   into an `<img>`. The client holds no map from a resume section to a region of the page.
3. **Undo already exists and already coalesces.** `apps/web/src/stores/undoHistory.ts` keeps
   50 states with a 500 ms burst debounce, wired to toolbar buttons and `Cmd+Z`
   (`apps/web/src/pages/Editor.tsx:321`). Several actions that look like they need a
   confirmation dialog are already reversible.

## Decision summary

| Surface | Pattern | Source | Replaces | Cost |
| --- | --- | --- | --- | --- |
| Editor + live preview | Preview, with an explicit stale state | [ui-patterns.com — Preview](https://ui-patterns.com/patterns/LivePreview) | Blanking the sheet on render error, `Preview.tsx:676` | Issue [#641](https://github.com/lgtm-hq/Rustume/issues/641) |
| Template switching | Undo offered at the point of action, not a confirmation | [NN/g — Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/) | Silent theme overwrite + immediate close, `TemplatePicker.tsx:15` | Issue [#642](https://github.com/lgtm-hq/Rustume/issues/642) |
| Import | Preview the result before committing | [NN/g — Preventing User Errors](https://www.nngroup.com/articles/user-mistakes/) | Immediate document replacement, `ImportModal.tsx:100` | Issue [#643](https://github.com/lgtm-hq/Rustume/issues/643) |
| Export | Feedback scaled to the response-time limits | [NN/g — Progress Indicators](https://www.nngroup.com/articles/progress-indicators/) | Unbounded indeterminate spinner, `ExportModal.tsx:145` | Issue [#644](https://github.com/lgtm-hq/Rustume/issues/644) |
| Offline and sync | Persistent banner for unresolved state | [uxpatterns.dev — Notification](https://uxpatterns.dev/patterns/user-feedback/notification) | Conflict toast + silent write block, `cloudStorage.ts:95` | Issue [#645](https://github.com/lgtm-hq/Rustume/issues/645) |
| Empty and first run | Status + learning cue + pathway | [NN/g — Designing Empty States](https://www.nngroup.com/articles/empty-state-interface-design/) | "Start editing to see preview", `Preview.tsx:706` | Issue [#646](https://github.com/lgtm-hq/Rustume/issues/646) |

---

## 1. Editor and live preview

### Current behaviour

`apps/web/src/components/preview/Preview.tsx` debounces the serialised resume by 500 ms
(`:276`), POSTs it via `renderPreview`, and swaps the returned PNG into an `<img>`. Results are
cached for 60 s keyed on the full payload (`api/render.ts:32`). While a render is in flight and
a previous page exists, an overlay with `role="status"` announces "Updating preview" (`:752`).

There is no scroll linking and no change highlighting; a repository-wide search for scroll
synchronisation between the editor and the preview returns nothing.

On render failure the code sets `previewUrl` back to the last cached render and comments that it
will "keep showing last cached preview" (`:325`). It does not: the guard at `:676` is
`when={previewUrl() && !error()}`, so a non-null error takes the fallback branch and the sheet
goes blank behind an error line. A transient network blip empties the document the user is
looking at.

### Pattern

**Preview** — [ui-patterns.com/patterns/LivePreview](https://ui-patterns.com/patterns/LivePreview).
The pattern's solution statement is to let users preview the consequences of an action before
committing, updating continuously throughout the interaction. Rustume already does the
continuous half. What the pattern requires and Rustume does not deliver is the correspondence
guarantee: what is on the sheet must be a render of what is in the editor, or must say that it
is not.

Adopt: **keep the last good render on screen at all times, and mark it stale whenever it does
not correspond to the current editor state** — during an in-flight render, after a failed
render, and while offline. Never blank the sheet for a recoverable condition.

### Why it fits Rustume

`BRAND.md` §1 makes the sheet the hero and the brightest thing in the room. A surface that
empties itself on a dropped request is the single most expensive thing this UI can do, because
the sheet is the whole argument. §4 asks for the result to be shown rather than a spinner; a
stale-but-labelled render is a result, an empty rectangle is not.

It also fits the architecture rather than fighting it. Because rendering is a server round trip
(ground truth 1), staleness is a normal steady state here, not an edge case. The pattern that
handles a normal steady state honestly beats one that treats every round trip as instantaneous.

### Runners-up, and why they lost

- **Scroll linking (editor pane scroll drives preview pane scroll).** The obvious ask, and it
  loses on ground truth 2: the preview is a raster PNG with no section coordinates in the
  client. Linking would require the Typst renderer to emit per-section anchors and the API to
  return them — a `crates/render` change, not a web change. Not rejected on merit; rejected as
  out of scope for a pattern decision, and blocked until the render service can describe its own
  output.
- **Change highlighting (flash the region that changed).** Same coordinate blocker, plus it is
  ruled out on its own terms: `BRAND.md` §7 requires that motion "does not move the sheet", and
  §1 forbids tinting the preview surface. A highlight is a tint on the sheet.
- **Skeleton screen while rendering** —
  [uxpatterns.dev/patterns/user-feedback/skeleton](https://uxpatterns.dev/patterns/user-feedback/skeleton).
  Its stated core value is preventing cumulative layout shift. The preview is a fixed box
  (`PREVIEW_PAGE_WIDTH` / `PREVIEW_PAGE_HEIGHT` in `previewPan.ts`), so there is no shift to
  prevent, and `BRAND.md` §4 rules out skeleton shimmer used as ambience.

### Accessibility consequence

The "Updating preview" live region fires on every settled debounce cycle. On a pane that
re-renders as the user types, a polite live region tied to in-flight state is a screen-reader
metronome. Announce **settled outcomes** — rendered, stale, failed — not each request. This is
the precise risk #623 flags as its highest-priority manual check, and this section is the
recommendation that check should be run against.

Staleness must not be carried by opacity alone. `Preview.tsx:746` currently signals loading with
`opacity-50` on the image, which is invisible to a screen reader and marginal at low vision.
`BRAND.md` §6 forbids colour as the only carrier of state; NN/g's
[error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) ask for
redundant indicators rather than colour alone. Pair the visual state with text.

**Cost:** needs an issue — [#641](https://github.com/lgtm-hq/Rustume/issues/641).

---

## 2. Template switching

### Current behaviour

`apps/web/src/components/templates/TemplatePicker.tsx`. Hovering a card reveals Preview and Use
buttons. Preview opens a lightbox showing
`getTemplateThumbnailUrl(template.id)` — a server-rendered thumbnail of the template's **own
sample content**, not the user's resume. `handleSelect` (`:15`) calls `updateTemplate(id)` and
`updateTheme(template.theme)`, clears the lightbox, and closes the modal.

Two consequences are undisclosed. First, `updateTheme` (`stores/resume.ts:744`) `Object.assign`s
the template's colours over the user's, so any theme customisation is overwritten with no
warning. Second, layout normalisation in `LayoutEditor.tsx:40` appends any section absent from
the layout to the last column — the answer to "content the new template has no slot for" is
currently "it silently reappears at the bottom of the last column".

Selection state on a card is a border ring plus an unlabelled checkmark SVG (`:319`).

### Pattern

**Undo offered at the point of action, in preference to a confirmation dialog** —
[NN/g, Confirmation Dialogs Can Prevent User Errors (If Not
Overused)](https://www.nngroup.com/articles/confirmation-dialog/). The article's rules are that
confirmations are for serious or irreversible consequences and never for routine actions,
because a generic "are you sure?" trains automatic Yes-clicking and provides no protection;
Nielsen's own conclusion is to go to great lengths to provide undo rather than lean on warnings.
[User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/) adds the
half that matters here: make undo discoverable in visible UI, not only via a keyboard shortcut.

Adopt: **switching a template stays a single un-confirmed click, and produces a notification
that names what changed and offers Undo.**

This is cheap because the mechanism already exists. `updateTemplate` and `updateTheme` fire
synchronously inside one handler, and `undoHistory.ts` coalesces a 500 ms burst into one entry,
so a single undo already reverts both the template and the colours. What is missing is not the
capability; it is telling the user the colours changed and that the change is reversible.

### Why it fits Rustume

A resume builder's template picker exists to be explored. `BRAND.md` §2 wants chrome that acts
on the document and gets out of the way; a modal that interrupts exploration to ask permission
for a reversible change is dashboard furniture. And `BRAND.md`'s voice rules require an action to
keep the same verb from button to confirmation — "Use template" should be followed by a sentence
about the template, not a question about it.

The notification also carries the honest part Rustume currently omits: the template brought its
own colours with it. `BRAND.md` §5 requires claims to be true of the surface making them; the
inverse duty is that a surface must not stay silent about what it just overwrote.

### Runners-up, and why they lost

- **Confirmation modal before switching.** Loses directly on the cited article: template
  switching is routine, reversible and exploratory, exactly the class of action the article says
  must not be confirmed. It would also be the second modal opened on top of the first.
- **Preview the candidate template rendered with the user's own content.** The honest ideal, and
  what [ui-patterns.com Preview](https://ui-patterns.com/patterns/LivePreview) would actually
  prescribe. It loses on cost, not on merit: by ground truth 1 each candidate is a full server
  render, so previewing a grid of templates multiplies render load by the number of cards, and
  `BRAND.md` §4 will not accept the resulting wait. Revisit if the render service ever gains a
  cheap thumbnail-with-content endpoint. The offline half of this problem is #61's, not this
  document's.
- **Presenting displaced sections in a "not used by this template" tray.** Deferred rather than
  rejected: it is the right long-term answer, but it presumes templates declare their slots, and
  `TemplateInfo` (`apps/web/src/wasm/types.ts:302`) carries no slot metadata today. Until a
  template can say what it cannot render, a tray would be guesswork.

### Accessibility consequence

The notification must be a polite live region so the theme overwrite reaches a screen reader
rather than only the eye.

The selected-template indicator is a colour ring plus an SVG with no accessible name, so
selection is conveyed by shape and colour only — a `BRAND.md` §6 violation and a WCAG 1.4.1
failure. The grid is a list of `div`s rather than a radio group, so there is no programmatic
"selected" state at all. Both belong to #622's expanded rule set and #623's manual pass; fix them
with this adoption rather than filing them twice.

**Cost:** needs an issue — [#642](https://github.com/lgtm-hq/Rustume/issues/642).

---

## 3. Import

### Current behaviour

`apps/web/src/components/import/ImportModal.tsx`. A dashed `div` handles drag events with a
transparent `<input type="file">` stretched over it (`:244`). Format is guessed: a `.zip`
extension means LinkedIn, otherwise the JSON is sniffed — `basics && meta` means Reactive Resume
V3, a `sections.summary` key means native Rustume, a bare `basics` means JSON Resume, anything
else throws "Unrecognized resume format" (`:160`). Parsing runs in WASM when available and falls
back to `POST /api/parse`.

On success `applyImported` (`:100`) calls `importResume(normalized)`, which replaces the
currently open resume outright, toasts "Resume imported successfully" and closes the modal.

There is no mapping step, no way to correct a wrong format guess, and no partial-failure report:
whatever the parser could not map is dropped without being named. The user's first sight of the
result is their own document already overwritten.

### Pattern

**Preview the result of a significant action before committing to it** —
[NN/g, Preventing User Errors: Avoiding Conscious
Mistakes](https://www.nngroup.com/articles/user-mistakes/). The article prescribes previewing the
results of a significant action before the user commits, which closes the gulf of evaluation
without making any change.

Adopt: **import gains a review step between parse and apply.** One screen, not a wizard, showing
the detected format with a control to correct it, a summary of what was parsed, an explicit list
of what did not come across, and Import / Cancel. Nothing touches the open document until Import
is pressed.

One screen answers all three of the sub-problems at once: the format control is the ambiguity
resolution, the omissions list is the partial-failure report, and the summary is the mapping
disclosure.

### Why it fits Rustume

Import is the highest-stakes action in the product for exactly the audience `BRAND.md` names:
people mid-search, editing an existing document, arriving from LinkedIn or another builder. The
current flow makes a silent heuristic guess and then destroys the open document with it.

It is also the place where Rustume's honesty commitment is most testable. `BRAND.md` §5 requires
claims to be scoped to what is true, and the voice rules require errors to say what failed, why,
and what is still safe. An importer that drops fields without saying which ones is making an
implicit claim of completeness the code does not support.

### Runners-up, and why they lost

- **A multi-step mapping wizard** —
  [ui-patterns.com Wizard](https://ui-patterns.com/patterns/Wizard),
  [uxpatterns.dev Wizard](https://uxpatterns.dev/patterns/advanced/wizard). Loses because
  Rustume's importers are fixed-schema: four named formats, each a deterministic Rust transform.
  There is no per-field decision for the user to make, so a mapping wizard would be ceremony over
  a transform that has no degrees of freedom. uxpatterns.dev's own "when not to use" for Wizard —
  when the surface is small — applies. Revisit only if a generic CSV importer ever ships.
- **Import silently, rely on undo.** Attractive given ground truth 3, and it loses on the
  confirmation-dialog article's own boundary: undo substitutes for confirmation when the
  consequence is legible. A wholesale document replacement whose omissions were never named is
  not legible, so there is nothing for the user to decide to undo.
- **Format chosen up front by the user instead of sniffed.** Loses on recognition over recall
  ([NN/g](https://www.nngroup.com/articles/recognition-and-recall/)) — most users do not know
  which of four formats their file is. Sniffing first and showing the guess for correction puts
  recognition where recall was.

### Accessibility consequence

[uxpatterns.dev — File
Input](https://uxpatterns.dev/patterns/forms/file-input) gives the contract Rustume's drop zone
does not meet: a drop zone needs `role="button"` and `tabindex="0"`, the selected filename must
be announced through `aria-live="polite"`, and the page lists "`<div>` drop zones without role or
keyboard handlers" as an explicit anti-pattern. Rustume's zone is a bare `div`; keyboard users
reach the overlaid input, which works but is undiscoverable and unannounced. The same page names
"losing the selected file on validation failure" as an anti-pattern — the review step fixes that
by construction, since the parse result survives a rejected import.

The error box (`:303`) is correctly `role="alert"`, but it is painted with raw `bg-red-50` /
`text-red-700` utilities outside the `--a11y-*` derived tokens `BRAND.md` §6 requires. Route it
through the token system as part of #622's contrast work.

**Cost:** needs an issue — [#643](https://github.com/lgtm-hq/Rustume/issues/643).

---

## 4. Export

### Current behaviour

`apps/web/src/components/export/ExportModal.tsx`. PDF export calls `downloadPdf` →
`renderPdf` → a single POST returning a blob, then triggers a browser download. While it runs,
the download arrow is swapped for an indeterminate spinner and the button gets `aria-busy` and
`disabled` (`:126`). There is no elapsed time, no estimate, no cancel, and no upper bound: a slow
or wedged render service produces a spinner that spins forever.

"Done" is a success toast plus the modal closing. Failure is a toast plus an inline `role="alert"`
carrying the raw error message.

JSON export is synchronous and local, and correctly has no progress affordance at all.

### Pattern

**Feedback scaled to the response-time limits** — [NN/g, Progress Indicators Make a Slow System
Less Insufferable](https://www.nngroup.com/articles/progress-indicators/), against the thresholds
in [Response Times: The 3 Important
Limits](https://www.nngroup.com/articles/response-times-3-important-limits/). The rules are
explicit: under 1 s show no indicator because it distracts; 1–10 s a looped animation; over 10 s
a percent-done indicator, because a looped animation leaves users unable to distinguish progress
from a hang — and past 10 s the user needs a way to interrupt. Users shown a progress indicator
were willing to wait roughly three times longer.

Adopt, in three bands that match what the code can honestly report:

- **Under ~300 ms** (JSON export): no indicator. Already correct.
- **1–10 s** (typical PDF render): the current looped spinner, plus honest status text naming
  what is running — the render happens on the server, and saying so is the difference between a
  wait and a mystery.
- **Over 10 s**: escalate. A true percent-done is not available — `fetchBlob` in
  `apps/web/src/api/client.ts` awaits one response with no progress events, so a percentage would
  be fiction, which `BRAND.md` §4 forbids ("any speed number the repo does not measure"). Show
  elapsed time, which is real, and offer Cancel, which is implementable client-side with an
  `AbortController`.

"Done" also needs scoping. `downloadBlob` clicks a synthetic anchor; whether the file lands in a
downloads folder or opens a save dialog is the browser's decision, not Rustume's. The completion
message may name the file, but it may not claim to know where it went.

### Why it fits Rustume

`BRAND.md` §4 already states this rule in the product's own words: sub-second work gets no
spinner, and an operation that genuinely takes time — "server render, batch export" — shows
determinate progress and says what is running. The NN/g thresholds are the numbers behind that
sentence, and the escalation band is where the design language and the architecture meet: the
render is remote, so it can hang, so there must be an exit.

### Runners-up, and why they lost

- **A completeness meter or progress ring** —
  [ui-patterns.com Completeness meter](https://ui-patterns.com/patterns/CompletenessMeter).
  Rejected outright. `BRAND.md` §2 rules out progress rings, completeness scores and any widget
  that reports on the user rather than acting on the document. This is a case where a real
  pattern is simply not for this product.
- **A skeleton of the PDF while it renders.** Loses for the same reason as in the preview
  section: there is no layout shift to prevent, and shimmer as ambience is out under
  `BRAND.md` §4.
- **Toast-only feedback with no state left in the modal.**
  [uxpatterns.dev Notification](https://uxpatterns.dev/patterns/user-feedback/notification) is
  explicit that critical feedback must not auto-dismiss before it can be read, and that a
  transient toast is the wrong channel when the user will need to revisit the message. An export
  failure is exactly that message. Keep the inline `role="alert"`.

### Accessibility consequence

`aria-busy` on the in-flight button is right and should stay. `disabled` on it is not: disabling
the control the user just activated destroys focus, dropping the user to the document body
mid-operation, and a disabled element is skipped by assistive technology so the busy state it
carries is never reached. Use `aria-disabled` with a no-op handler so focus and the announcement
survive. This is the same class of focus-management failure #622 expects WCAG 2.2 SC 2.4.11 to
surface, and it will not be caught by an automated scan.

The elapsed-time and completion messages belong in a polite live region. The failure message
belongs in the existing `role="alert"`, and per NN/g's
[error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) should be
human-readable rather than the raw thrown message currently passed through at `:52` — `BRAND.md`
already supplies the model sentence for this exact toast.

**Cost:** needs an issue — [#644](https://github.com/lgtm-hq/Rustume/issues/644).

---

## 5. Offline and sync

### Current behaviour

Connectivity comes from `useOnline()` (`apps/web/src/hooks/useOnline.ts`), which reads
`navigator.onLine` and the browser's online/offline events. That reports link-layer state, not
whether the render API is reachable: a captive portal or a stopped dev server both read as
online, and a reachable API on a flaky link can read as offline.

The preview pane shows an offline icon and "Preview unavailable offline" when no cached render
exists (`Preview.tsx:687`). The home page carries a `StatusStrip` showing resume count, last
edit, "on-device storage" or "cloud storage", and sync on/off — good, honest, and already
consistent with `BRAND.md` §5.

The editor has none of this. `stores/resume.ts` maintains `isSaving` (`:369`) and autosaves on a
debounce (`scheduleSave`, `:429`), but the editor toolbar (`Editor.tsx:676`) surfaces neither.
The only save feedback in the editor is a toast fired by `Cmd+S` (`Editor.tsx:315`), and the only
unsaved-work protection is a `window.confirm` in `useNavigationGuard`.

Conflicts are the sharpest gap. `showResumeVersionConflictToast`
(`apps/web/src/stores/cloudStorage.ts:95`) raises a warning toast — "Resume was updated
elsewhere. Reload to see latest changes." — with a Reload action, and calls
`blockCloudWritesUntilReload`. After that toast fades, the resume keeps accepting edits that no
longer reach the cloud, with nothing on screen saying so, and the only offered exit is a reload
that discards them.

### Pattern

**Persistent banner for unresolved system state, in place of a transient toast** —
[uxpatterns.dev, Notification](https://uxpatterns.dev/patterns/user-feedback/notification). The
page separates three variations by lifetime: toast for low-risk confirmations and recoverable
issues, inline alert where context matters more than reach, and persistent banner for
high-priority system status that stays until resolved or acknowledged. Its stated rule is not to
auto-dismiss critical feedback before it can be read.
[NN/g, Visibility of System
Status](https://www.nngroup.com/articles/visibility-system-status/) supplies the duty: when the
system state changes underneath the user, say so explicitly, because withholding it erodes trust.

Adopt: **sync state is persistent product state and gets a persistent element in the editor
chrome.** One status affordance covering saving, saved, offline, read-only, and
conflict-blocked. A resume whose writes are blocked must say so continuously, for as long as it
is true.

Two supporting rules follow from the code:

- Phrase the disclosure from **the last render or save outcome**, not from `navigator.onLine`.
  The browser flag is a proxy for a question the app can answer directly, and a wrong "Offline"
  label is worse than none.
- "Blocked" is a state, not an event. It must survive the toast, the modal, and the tab.

### Why it fits Rustume

`BRAND.md` §5 makes truthfulness about persistence a first-class constraint and cites
`StatusStrip` and `HomeLayouts` as the code already doing it. The editor is the surface where the
promise matters most and where it is currently unmade: a user editing a conflict-blocked resume
is being allowed to believe their work is being saved.

The status element also fits §2 — an instrument at the edge of the bench, quiet when nothing is
wrong — rather than a widget reporting on the user.

### Reconciliation with open issues

This section deliberately does not design the resolution UI.

- **#43** owns conflict resolution: the 409 signal, keep-mine / keep-theirs / side-by-side, and
  writing the resolution back with the current version token. What this document adds is that the
  conflict must be **disclosed persistently** until #43's resolution flow exists, because today
  the disclosure lasts a few seconds and the condition lasts until reload.
- **#61** owns offline availability of templates and themes. This document covers how offline is
  *disclosed*, not what remains usable.
- **#360** (share settings) and **#362** (API key management) both introduce network-dependent
  controls in the editor and account pages. They should consume the same status element rather
  than each inventing a connectivity affordance.

### Runners-up, and why they lost

- **The current toast.** Loses on the cited pattern's own lifetime rule: the state persists, the
  toast does not.
- **A blocking modal on conflict.**
  [uxpatterns.dev Modal](https://uxpatterns.dev/patterns/content-management/modal) lists "when
  users need simultaneous access to background content" under when not to use. A conflict is
  precisely when the user needs to see their document, so locking them out of it to report the
  conflict is backwards.
- **Autosave alone** — [ui-patterns.com Autosave](https://ui-patterns.com/patterns/autosave).
  The right underlying mechanic, and Rustume already implements it. It loses as a *decision*
  because it is silent by construction and disclosure is the open question, not persistence.

### Accessibility consequence

State transitions announce through a polite live region; a conflict or read-only transition is a
`role="alert"`. State must never be carried by a coloured dot alone — `StatusStrip` already gets
this right by pairing its dot with a text label, and the editor element should copy that
structure.

Placement matters for WCAG 2.2 SC 2.4.11, Focus Not Obscured. #622 names sticky headers, the
preview pane and toasts as the likely offenders in this app. A persistent banner is a fourth
candidate: it must not overlay a focused control in the editor pane. Reserve layout space for it
rather than floating it.

**Cost:** needs an issue — [#645](https://github.com/lgtm-hq/Rustume/issues/645).

---

## 6. Empty and first-run states

### Current behaviour

The home page is in good shape and already distinguishes three cases in
`apps/web/src/pages/home/HomeLayouts.tsx`: `EmptyLibrary` (`:206`) with Create and Import
actions and copy that branches on `syncEnabled()`, `NoSearchMatches` (`:250`) with a
clear-filters escape, and `EmptyScope` (`:290`) for an empty folder. That three-way split is
already the correct structure and should not be redesigned.

The editor is where the gap is. A new or cleared resume shows the preview pane's
`Start editing to see preview` (`Preview.tsx:706`) on an otherwise blank sheet. It reports no
status, offers no action, and is visually indistinguishable from a failed or still-loading
render — the exact confusion the source below identifies.

The template picker's empty state ("No templates available. Check that the server is running and
try again.", `TemplatePicker.tsx:117`) is honest and already names the likely cause.

### Pattern

**NN/g's three guidelines for empty states in complex applications** —
[Designing Empty States in Complex Applications: 3
Guidelines](https://www.nngroup.com/articles/empty-state-interface-design/). Every empty state
must (1) communicate system status, because a blank container leaves users unsure whether the
system is loading or has errored; (2) provide a learning cue about what will fill the space; and
(3) provide a direct pathway to the key task.

Adopt: **apply all three to the editor's first-run preview state.** Name what is missing, say
that the sheet is empty rather than broken, and offer the one action that fills it — Import,
which for Rustume's stated audience of people editing an existing document is the likelier first
move than typing from scratch.

`EmptyLibrary` already satisfies (1) and (3) and needs only the learning cue. The wording fix for
`EmptyScope`'s "Nothing here yet" heading is already prescribed in `BRAND.md`'s voice table and
belongs to whoever implements that table, not to this document.

### Why it fits Rustume

`BRAND.md`'s voice section says it in the product's own words: empty states are invitations, the
heading names what is missing and the body names the one action that fills it. The three
guidelines are the structural version of that sentence, and the preview pane is the one surface
that currently fails it.

The audience argument reinforces the choice of action. `BRAND.md` describes users who are
mid-search and "editing an existing document rather than starting one", and the repo already
hands them JSON Resume, LinkedIn and Reactive Resume V3 importers. Offering Import from the empty
sheet matches what they actually arrived to do.

### Runners-up, and why they lost

- **An onboarding tour or coach marks.**
  [NN/g, Onboarding Tutorials vs. Contextual
  Help](https://www.nngroup.com/articles/onboarding-tutorials/) finds that upfront push
  revelations interrupt, do not improve task performance, and are quickly forgotten, and
  recommends help triggered when the user would benefit right now. `BRAND.md` §2 independently
  rules out onboarding checklists. Rejected twice over.
- **Blank Slate with demo content** —
  [ui-patterns.com Blank Slate](https://ui-patterns.com/patterns/BlankSlate), which suggests
  sample data and screenshots. It loses on Rustume's single-document model: a sample resume
  loaded into the editor is indistinguishable from the user's own, autosaves like the user's own
  (`scheduleSave`, `stores/resume.ts:429`), and there is no "this is a sample" affordance to
  distinguish it. Sample content in a workbench that saves everything is a data-integrity hazard,
  not a learning cue.
- **A first-run wizard.** Loses on `BRAND.md`'s hard rule that the product never asks for
  anything before the editor works, and on
  [uxpatterns.dev Wizard](https://uxpatterns.dev/patterns/advanced/wizard)'s own "when not to
  use" for small surfaces.

### Accessibility consequence

An empty state that replaces content must announce the transition politely, per
[uxpatterns.dev Empty
States](https://uxpatterns.dev/patterns/user-feedback/empty-states), which asks for live-region
announcement of state changes and `aria-describedby` tying labels to status text. In the preview
pane this shares a live region with the render status from section 1 — they are the same
region and must not fight over it.

`EmptyLibrary` already carries an instructive comment about not diluting `text-stone` with an
alpha modifier, because doing so drops the hint below 4.5:1. Any new empty-state copy inherits
that constraint; `BRAND.md` §6 forbids low-contrast helper text used for visual calm.

**Cost:** needs an issue — [#646](https://github.com/lgtm-hq/Rustume/issues/646).

---

## What this document does not decide

- **Conflict resolution mechanics.** #43.
- **What works offline**, as opposed to how offline is disclosed. #61.
- **Share and API-key surfaces.** #360 and #362. Both should consume section 5's status element
  rather than inventing their own.
- **The specific WCAG criteria to test and the audit artefact.** #622 and #623. Every
  accessibility consequence recorded above is an input to those, not a substitute.
- **Copy rewrites already prescribed** in `BRAND.md`'s voice table.

## Related

- [`BRAND.md`](BRAND.md) — brand story, design language, voice, anti-patterns
- Parent epic: [#352](https://github.com/lgtm-hq/Rustume/issues/352) — WCAG 2.2 AA and design
  language for app and site
- Sources: [UX Patterns for Developers](https://uxpatterns.dev/),
  [UI Patterns](https://ui-patterns.com/patterns),
  [Nielsen Norman Group](https://www.nngroup.com/)
