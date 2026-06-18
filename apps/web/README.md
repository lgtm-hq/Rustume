# @rustume/web

SolidJS web application for Rustume — the privacy-first resume builder.

> **Documentation:** [Docs site](https://rustume.com/) ·
> [Web app guide](https://rustume.com/docs/contributing/web-app/) ·
> [Architecture](https://rustume.com/docs/architecture/overview/) ·
> [Docker deployment](https://rustume.com/docs/deployment/docker/) ·
> [CLI](https://rustume.com/docs/cli/usage/) ·
> [Rustume Cloud](https://app.rustume.com/)

## Tech Stack

- **Framework**: SolidJS 1.9
- **Build**: Vite 7.3
- **Styling**: Tailwind CSS 4 + @lgtm-hq/turbo-themes
- **Routing**: @solidjs/router
- **UI**: @kobalte/core (headless components)
- **PWA**: vite-plugin-pwa (Workbox)
- **WASM**: wasm-bindgen (optional, graceful fallback)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- Rust toolchain + wasm-pack (optional, for WASM builds)
- Rustume server running on port 3000 (for preview/PDF rendering)

### Development

```bash
# Install dependencies
bun install

# Start dev server (proxies /api to localhost:3000)
bun run dev

# Build WASM bindings (optional — app works without them)
bun run build:wasm

# Build for production
bun run build
```

### Testing

```bash
# Run tests
bun run test

# Watch mode
bun run test:watch

# Coverage report
bun run test:coverage
```

## Architecture

```text
src/
  api/          # HTTP client + render/parse API
  components/
    builder/    # Resume form editors (BasicsForm, SectionEditor)
    export/     # Export modal (PDF + JSON)
    import/     # Import modal (JSON Resume, LinkedIn, RRV3)
    layout/     # App shell, sidebar, split pane
    preview/    # Live PDF preview
    templates/  # Template picker + theme editor
    ui/         # Shared primitives (Button, Input, Modal, ...)
  hooks/        # Custom hooks (useDebounce, useOnline)
  pages/        # Route pages (Home, Editor)
  stores/       # SolidJS stores (resume, ui, persistence, editorTheme)
  wasm/         # WASM integration layer with fallbacks
```

See also:
[Web app contribution guide](https://rustume.com/docs/contributing/web-app/) ·
[Architecture overview](https://rustume.com/docs/architecture/overview/) ·
[Deployment](https://rustume.com/docs/deployment/docker/)

## Key Design Decisions

- **Offline-first**: WASM parsers run client-side. All data persisted
  to IndexedDB (via WASM) or localStorage (fallback). PWA service
  worker caches static assets.
- **Server optional**: The app works for editing, importing, and JSON
  export without the server. PDF rendering and preview require the
  server API (Typst has native dependencies incompatible with WASM).
- **Graceful degradation**: If WASM fails to load, the app falls back
  to server API for parsing and localStorage for persistence. A warning
  banner is shown but the app remains fully functional.

## Environment Variables

| Variable       | Description           | Default                  |
| -------------- | --------------------- | ------------------------ |
| `VITE_API_URL` | Override API base URL | (none - uses Vite proxy) |
