# Rustume Brand and Design Language

Direction for anyone — human or agent — making a visual, copy, or interaction decision in
`apps/web`, `apps/site`, or the resume templates. If a change cannot be defended against
this document, it is the change that is wrong, or this document needs an argued update.

## Story

Rustume makes one document, and makes it well. A resume is the most consequential page most
people ever write, and the tools for writing it are rented: you create an account, you paste
your employment history into someone else's database, and when you want the PDF you find the
export behind a paywall. Rustume inverts that. The engine is Rust compiled to WebAssembly and
runs in your browser; the layouts are Typst, not a headless Chrome print hack; the default
deployment is stateless, needs no database and no sign-in, and the whole thing runs from a
Docker image you own. There is a CLI that does the same work from a shell, so your resume can
live in a repo next to everything else you version.

The point is not that Rustume is private in the abstract. It is that the thing you are making
is a document, not a row in a service — and Rustume is a workbench, not a landlord.

## Audience

People who write their own resume and dislike being processed while they do it. In practice:
software and technical people (the repo hands them a CLI, a Docker image, JSON Resume,
LinkedIn and Reactive Resume V3 importers), and privacy-conscious job seekers who would rather
not create an account to edit a text file. They are usually mid-search, under time pressure,
and editing an existing document rather than starting one.

What they already believe when they arrive, and what the interface has to answer:

- **"This will be slow."** Every keystroke will round-trip to a server and the preview will lag.
- **"This is harvesting me."** The free tier is the data-collection tier, and the export is
  the upsell.
- **"The output will look like everyone else's."** Templates that are recognisably a template.

Answer these by demonstration, not by claim. A preview that repaints instantly is the argument
for speed; a working editor before any sign-in prompt is the argument for privacy.

## Design language

The metaphor is already in the repo and it is the right one: a **workshop**. `craft-theme.css`
sets ember on near-black with brass headings; the site says "Forge resumes with quiet craft" and
"Build like a workshop — warm, precise, entirely yours"; the app names its colours `--color-ink`,
`--color-paper`, `--color-sheet` and animates with `ink-drop`. This document makes that explicit
and adds the part that was implicit: **the workshop is dark and quiet so the paper on the bench
is the brightest thing in the room.**

One honest caution. A near-black surface with a single warm accent is, on its own, the most
common look generated tooling produces. The palette alone is not the identity. What makes an
interface recognisably Rustume is the paper/ink material split, serif-set body text, and the
absence of dashboard furniture. Spend effort there, not on the accent hue.

### 1. The sheet is the hero

The resume preview is a printed sheet: light, warm-white, ink-dark, the same in every theme
(`--color-sheet` / `--color-sheet-ink`). Everything around it is bench — recessive, dark, matte.

**Rules out:** theming, tinting, or dark-moding the preview surface; gradients, glows, or
saturated fills anywhere adjacent to it; decorative illustration or stock imagery inside the
app; a preview that is smaller than the editor by default.

### 2. Chrome is tools, not a dashboard

The surrounding UI exists to hold instruments within reach. Controls sit at the edges, label
themselves in plain words, and go quiet when unused.

**Rules out:** stat tiles, metric rows, progress rings, completeness scores, "resume strength"
gauges, streaks, badges, confetti, onboarding checklists, and any widget that reports on the
user rather than acting on the document.

### 3. Serif for reading, mono for machine facts

`Fraunces` display, `Source Serif 4` body, `JetBrains Mono` for anything the machine owns —
identifiers, shortcuts, scope names, file names, versions. Serif body text is unusual in an app
and it is deliberate: it makes the editor read like the document it produces.

**Rules out:** substituting a geometric or neo-grotesque sans (Inter, Geist, system-ui) for
body copy; using the display face for controls and labels; using mono decoratively for prose
or headings; more than three families on a surface.

### 4. Speed is demonstrated, never advertised

Sub-second work gets no spinner. Show the result. If an operation genuinely takes time (server
render, batch export), show determinate progress and say what is running.

**Rules out:** skeleton shimmer used as ambience rather than as a real pending state; artificial
delay or staged "processing" theatre; spinners on operations that complete in under ~300ms;
performance boasts inside the product UI, and any speed number the repo does not measure.

### 5. Claims are scoped to the surface making them

Privacy language must be true of the build the user is looking at. The codebase already
enforces this — `CloudEntry.tsx` carries a comment explaining that "No accounts, no tracking"
was true of a local-only home page and false above a sign-in button, and the empty-library copy
in `HomeLayouts.tsx` branches on `syncEnabled()` before promising anything stays on-device. Note
also that PDF/PNG rendering and template thumbnails are server-side (`POST /api/render/pdf`);
"nothing ever leaves your machine" is not a sentence Rustume can write unqualified.

**Rules out:** blanket privacy or encryption claims not conditioned on deployment mode; padlock
and shield iconography implying guarantees the deployment does not make; marketing superlatives
in product surfaces.

### 6. Contrast is a design constraint, not a QA step

WCAG 2.2 AA is the floor, and it binds at the moment a colour is chosen, not at review. Body
text ≥ 4.5:1, large text and UI/focus indicators ≥ 3:1, against the actual background it lands
on. The app's palette is user-selectable via `@lgtm-hq/turbo-themes` and is normalised through
the `--a11y-*` derived tokens in `apps/web/src/index.css`; the site's craft theme is
hand-authored and is not yet normalised. Resume templates must hold contrast in print and in
grayscale as well as on screen.

**Rules out:** introducing a raw hex value that has not been checked against its background;
low-contrast placeholder, helper, or disabled text used for visual calm; colour as the only
carrier of state; text over a gradient ramp whose whole range has not been audited; text on the
brand accent without a verified on-brand foreground token.

### 7. Motion is small, purposeful, and skippable

Motion confirms that something happened — a save landed, a panel opened. It is short, it does
not move the sheet, and every animation has a `prefers-reduced-motion: reduce` path.

**Rules out:** parallax, scroll-jacking, entrance animation on lists and data, looping ambient
effects, hover transforms that shift layout, and any motion that runs before the user acts.

## Voice and tone

Plain, specific, second person, active voice. State what happened and what to do next. Never
apologise, never exclaim, never blame the user, never use "we". Sentence case everywhere; an
action keeps the same verb from button to confirmation.

Errors say **what failed, why, and what is still safe.** The repo already contains the model
sentence — `"Failed to load resume — your data has not been modified"` — and the model
validation message, `"Add cover letter content before exporting"`. Match those.

Empty states are invitations. The heading names what is missing; the body names the one action
that fills it.

**Before → after**, from real strings:

| Where | Now | Should be |
| --- | --- | --- |
| `ExportModal` PDF-export toast | "Failed to export PDF" | "Could not export the PDF. Your resume is unchanged. Try again." — and where the failure reason is known, say it instead: "…the render service is unreachable. Check that the server is running." |
| `AppErrorFallback` boundary | "An unexpected error occurred." | "Rustume could not render this page. Your resume is saved and unchanged. Reload, or try again." |
| `useHomePage` bulk-unfile toast | "3 resumes could not be unfiled — try again" | "Could not unfile 3 resumes. They are still in their folders. Try again." |
| `EmptyScope` heading in `HomeLayouts` | "Nothing here yet" | "No resumes in Drafts" — the body already names the fix, the heading should too |

Note what the rewrites share: the failure is named as something that happened to a specific
object, the user's data is accounted for, and the next action is a verb they can take now. Note
also what they avoid — a generic handler must not assert a cause it has not established. Attach
the specific sentence to the specific error, and keep the neutral one as the fallback.

## Anti-patterns

Rustume must never look or sound like the category it is arguing with.

**Never looks like:** a purple-to-blue SaaS gradient hero; rounded-blob illustrations of
diverse people at laptops; an ATS-score dial or "your resume is 68% complete" meter; a
testimonial carousel or logo wall; an upgrade banner, trial countdown, or paywalled export; a
modal that interrupts editing to sell something; a template preview that does not match the
rendered PDF; glassmorphism, neon glow, or a bright accent used as a large fill.

**Never sounds like:** "Oops! Something went wrong 😕"; "We're sorry, but…"; "Let's get you set
up!"; "AI-powered"; "Land your dream job"; interview-rate statistics; emoji in product UI copy;
"Submit" on a button whose action has a real name; any sentence whose only content is enthusiasm.

**Never does:** ask for an account before the editor works; collect anything it does not need to
render a document; hide the export; ship a colour that has not been contrast-checked.

## Related

- Parent epic: [#352](https://github.com/lgtm-hq/Rustume/issues/352) — WCAG 2.2 AA and design
  language for app and site
- Evidence this document is built on: `apps/site/src/styles/craft-theme.css`,
  `apps/web/src/index.css`, `apps/site/src/pages/index.astro`, [README](../../README.md)
