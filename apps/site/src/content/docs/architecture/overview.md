---
title: "Architecture Overview"
description: '<a href="https://www.rust-lang.org/">Rust</a> workspace crate map, dependency flow, and component responsibilities.'
category: architecture
order: 10
---

[Rustume](/) follows a modular [Rust](https://www.rust-lang.org/) workspace architecture. Core logic
lives in shared crates; delivery surfaces ([CLI](/docs/cli/usage/), [server](/docs/api/overview/),
[WASM](https://developer.mozilla.org/en-US/docs/WebAssembly), [web
app](/docs/contributing/web-app/)) are thin adapters.

## High-level diagram

![Rustume workspace crate map — WASM, CLI, Server, Web, and shared crates](/assets/images/arch-crate-map.png)

*Core logic lives in shared crates; delivery surfaces are thin adapters.*

## Crate responsibilities

| Crate | Purpose |
| --- | --- |
| `rustume-schema` | Resume data types, validation, [JSON Schema](https://json-schema.org/) definitions |
| `rustume-parser` | Import parsers for [JSON Resume](https://jsonresume.org/), [LinkedIn](https://www.linkedin.com/), [Reactive Resume](https://rxresu.me/) |
| `rustume-render` | [Typst](https://typst.app/)-based PDF/PNG generation with 12 [templates](/docs/getting-started/templates/) |
| `rustume-storage` | Platform-agnostic storage abstraction ([IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), memory) |
| `rustume-utils` | Shared utilities (ID generation, string, date, color, HTML→[Typst](https://typst.app/)) |
| `rustume-cli` | [Command-line interface](/docs/cli/usage/) binary |
| `rustume-server` | [REST API](/docs/api/overview/) with [OpenAPI](/docs/api/overview/) documentation ([Axum](https://github.com/tokio-rs/axum)) |
| `rustume-wasm` | [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) bindings for browser usage |
| `apps/web` | [SolidJS](https://www.solidjs.com/) resume builder ([Vite](https://vite.dev/)) |
| `apps/site` | [Astro](https://astro.build/) documentation site (this site) |

## Dependency flow

![Crate dependency flow — utils and schema at the core, parser/render/storage above, cli/server/wasm on top](/assets/images/arch-dependency-flow.png)

Core crates (`utils`, `schema`) have no dependencies on higher-level crates. This keeps
[WASM](https://developer.mozilla.org/en-US/docs/WebAssembly) bundle size minimal and allows
[CLI](/docs/cli/usage/) and server to share identical parsing and rendering logic.

## Server crate structure (Cloud)

When [`RUSTUME_CLOUD=true`](/docs/deployment/env-reference/) the server adds:

![Cloud server crate layout — auth, database, routes, and observability modules](/assets/images/arch-server-structure.png)

[Self-hosted](/docs/deployment/self-hosting/) mode skips Cloud auth and database initialization —
the same connected capabilities are enabled when an operator configures the required services.
Hosted billing controls use of the Rustume-operated deployment, not application feature access.

## Web app structure

![SolidJS web app layout — components, stores, api, wasm, and pages](/assets/images/arch-web-structure.png)

Persistence store routes to
[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) or [cloud
API](/docs/api/cloud-endpoints/) based on auth state.

## Rendering pipeline

1. `ResumeData` JSON validated against schema
2. Rich-text HTML fields sanitized and converted to [Typst](https://typst.app/) markup
3. [Typst](https://typst.app/) template selected from `metadata.template`
4. Theme colors injected from `metadata.theme`
5. [Typst](https://typst.app/) compiles to PDF; PNG preview renders page 0 (or specified page)

No browser or headless Chrome — [Typst](https://typst.app/) runs natively in
[Rust](https://www.rust-lang.org/).

## Testing strategy

- **Unit tests** — inline `#[cfg(test)]` in each crate
- **Integration tests** — `tests/` directories per crate
- **Web tests** — [Vitest](https://vitest.dev/) for stores and API client
- **CLI tests** — `crates/cli/tests/cli_tests.rs`

Run all: `make test` — see [Development setup](/docs/contributing/development/) and
[Linting](/docs/contributing/linting/).

## See also

- [Cloud stack](/docs/architecture/cloud-stack/) — hosted production infrastructure
- [Data model](/docs/architecture/data-model/) — [PostgreSQL](https://www.postgresql.org/) schema
- [Contributing](/docs/contributing/development/) — development setup
