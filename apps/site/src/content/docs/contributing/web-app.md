---
title: "Web App"
description: "SolidJS resume builder structure, stores, components, and WASM integration."
category: contributing
order: 30
---

The [Rustume](/) web app (`apps/web/`) is a [SolidJS](https://www.solidjs.com/) [single-page
application (SPA)](https://developer.mozilla.org/en-US/docs/Glossary/SPA) built with
[Vite](https://vite.dev/). It runs offline-first with [WASM](/docs/architecture/overview/) +
[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) local storage. In
connected Cloud mode, signed-in persistence synchronizes through authenticated server storage.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [SolidJS](https://www.solidjs.com/) (signals, fine-grained reactivity) |
| Build | [Vite](https://vite.dev/) + [bun](https://bun.sh) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Rich text | [TipTap](https://tiptap.dev/) editor |
| Local storage | [WASM](/docs/architecture/overview/) → [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) |
| API client | Fetch wrappers in `api/` — see [Cloud endpoints](/docs/api/cloud-endpoints/) |
| Tests | [Vitest](https://vitest.dev/) + [jsdom](https://github.com/jsdom/jsdom) |

## Directory structure

```text
apps/web/src/
├── index.tsx           App entry + router
├── App.tsx             Root component, auth probe on mount
├── pages/
│   ├── Home.tsx        Resume list, create/import
│   ├── Editor.tsx      Main builder + preview split view
│   └── NotFound.tsx    404 page
├── components/
│   ├── builder/        Section editors (basics, experience, skills)
│   ├── preview/        Live PDF/PNG preview panel
│   ├── templates/      Template picker, theme editor
│   ├── import/         Import modal (JSON, LinkedIn, Reactive Resume)
│   ├── export/         PDF/JSON export modal
│   ├── Auth/           Sign-in menu, cloud import prompt
│   ├── layout/         AppShell, Sidebar, SplitPane
│   └── ui/             Buttons, modals, inputs, toast
├── stores/
│   ├── resume.ts       Active resume state, validation, auto-save
│   ├── persistence.ts  Local/cloud storage routing
│   ├── cloudStorage.ts Cloud API wrappers
│   ├── auth.ts         Session state, sign-in/out
│   ├── ui.ts           Modals, sidebar, loading states
│   └── editorTheme.ts  Code editor theme preference
├── api/
│   ├── client.ts       Base fetch with error handling
│   ├── resumes.ts      Cloud CRUD endpoints
│   ├── auth.ts         Auth probe, logout
│   └── render.ts       PDF/preview API calls
├── hooks/
│   ├── useOnline.ts    Offline detection
│   ├── useDebounce.ts  Debounced auto-save
│   └── useHotkeys.ts   Keyboard shortcuts
└── wasm/
    ├── index.ts        WASM module loader
    └── types.ts        ResumeData TypeScript types

```

## State management

[SolidJS](https://www.solidjs.com/) stores use `createStore` and `createSignal` — no external state
library.

**resume.ts** — central resume editing state:

- `loadResume(id)` — fetch from persistence layer
- Auto-save on debounced changes (500ms)
- `validateResumeData()` — client-side schema check before save

**persistence.ts** — storage abstraction:

```typescript
// Routes to cloud or local based on auth
if (isCloudAuthenticated()) {
  await saveCloudResume(id, data);
} else {
  await saveToWasmStorage(id, data);
}

```

**auth.ts** — probes `GET /auth/me` on app load, exposes `user` and `plan`.

## WASM integration

The `rustume-wasm` crate compiles to `apps/web/wasm/` via
[wasm-pack](https://rustwasm.github.io/wasm-pack/):

```bash
make wasm
# cd bindings/wasm && wasm-pack build --release --target web

```

[WASM](https://developer.mozilla.org/en-US/docs/WebAssembly) provides:

- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) read/write for resume
  JSON
- Resume list enumeration
- ID generation

Falls back to `localStorage` when [WASM](https://developer.mozilla.org/en-US/docs/WebAssembly) fails
to load (with user notice).

## Routing

Client-side routing via [`@solidjs/router`](https://github.com/solidjs/solid-router):

| Path | Page |
| --- | --- |
| `/` | Home (resume list) |
| `/editor/:id` | Editor for resume [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier) |
| `*` | NotFound |

The [Rust](https://www.rust-lang.org/) server serves `index.html` for all non-API routes ([SPA
fallback](https://developer.mozilla.org/en-US/docs/Glossary/SPA)).

## Preview and export

Preview panel calls `POST /api/render/preview` for PNG rendering — see [Core
endpoints](/docs/api/core-endpoints/). Skips requests when offline (shows cached preview or
message).

Export modal offers:

- PDF via `POST /api/render/pdf`
- JSON download (client-side blob)

## Development

```bash
cd apps/web
bun install
bun run dev        # :5173, proxies API to :3000
bun run test       # Vitest
bun run build      # production bundle → dist/

```

Production build output is copied into the [Docker](/docs/deployment/docker/) image at `/app/web`
and served by the [Rust](https://www.rust-lang.org/) server.

## Cloud components

When [`RUSTUME_CLOUD=true`](/docs/deployment/env-reference/) on the server:

- `AuthMenu.tsx` — sign-in and sign-out controls when Cloud mode is enabled — see
  [Authentication](/docs/cloud/auth/)
- `CloudImportPrompt.tsx` — one-time local → cloud migration — see [Getting
  started](/docs/cloud/getting-started/)
- `cloudStorage.ts` — typed wrappers for `/api/resumes/*`

The web app detects cloud mode by probing `/auth/me` — no build-time flag required.

## Testing

```bash
cd apps/web && bun run test

```

Tests cover stores (persistence, auth, cloud storage), API client, hooks, and key components.
Coverage reports generated in CI via `ci-web-coverage.sh`.

## See also

- [Development setup](/docs/contributing/development/) — `make dev` workflow
- [Cloud storage](/docs/cloud/storage/) — API the web app calls
- [Architecture overview](/docs/architecture/overview/) — full crate map
- [Import formats](/docs/getting-started/import-formats/) — [JSON Resume](https://jsonresume.org/),
  [LinkedIn](https://www.linkedin.com/), [Reactive Resume](https://rxresu.me/)
