---
title: "Development Setup"
description: "Guide for setting up and running Rustume locally for development."
category: contributing
order: 10
---

This guide covers native development for the [Rustume](https://github.com/lgtm-hq/Rustume) monorepo.
For [Docker](/docs/deployment/docker/)-only usage, see [Docker
deployment](/docs/deployment/docker/).

## Prerequisites

| Tool | Install |
| --- | --- |
| [Rust](https://www.rust-lang.org/) | [rustup](https://rustup.rs/) |
| [`wasm32-unknown-unknown`](https://doc.rust-lang.org/nightly/rustc/platform-support/wasm32-unknown-unknown.html) target | `rustup target add wasm32-unknown-unknown` |
| [wasm-pack](https://rustwasm.github.io/wasm-pack/) | `cargo install wasm-pack` |
| [bun](https://bun.sh) | [bun.sh](https://bun.sh) |
| [Python 3.11+](https://www.python.org/) | For [lintro](https://github.com/lgtm-hq/py-lintro) |
| [uv](https://docs.astral.sh/uv/) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

Optional: [`cargo-watch`](https://github.com/watchexec/cargo-watch) for auto-reload (`cargo install
cargo-watch`).

## Initial setup

```bash
git clone https://github.com/lgtm-hq/Rustume.git
cd Rustume
make setup

```

`make setup` runs:

1. `check-deps` — verifies [cargo](https://doc.rust-lang.org/cargo/), [bun](https://bun.sh),
   [wasm-pack](https://rustwasm.github.io/wasm-pack/),
   [`wasm32-unknown-unknown`](https://doc.rust-lang.org/nightly/rustc/platform-support/wasm32-unknown-unknown.html)
   target
2. `install` — `cargo fetch` + `bun install` in `apps/web`
3. `wasm` — builds [WASM](https://developer.mozilla.org/en-US/docs/WebAssembly) bindings to
   `apps/web/wasm`

## Development servers

```bash
make dev

```

Starts two processes:

| Service | URL |
| --- | --- |
| [Rust](https://www.rust-lang.org/) API server | [http://localhost:3000](http://localhost:3000) |
| [Vite](https://vite.dev/) dev server | [http://localhost:5173](http://localhost:5173) |

Use port 5173 for development — [Vite](https://vite.dev/) proxies API calls to the
[Rust](https://www.rust-lang.org/) server. [Swagger UI](https://swagger.io/tools/swagger-ui/):
[http://localhost:3000/swagger-ui/](http://localhost:3000/swagger-ui/) — see [API
overview](/docs/api/overview/).

### Auto-reload

```bash
make dev-watch   # requires cargo-watch

```

Restarts the [Rust](https://www.rust-lang.org/) server on file changes. [Vite](https://vite.dev/)
[HMR](https://vite.dev/guide/features.html#hot-module-replacement) handles web hot reload
automatically.

## Build targets

```bash
make build         # WASM + server + web production bundle
make wasm          # WASM only
make server-build  # release server binary
make web-build     # production web bundle
make preview       # serve production build locally

```

## Running tests

```bash
make test                              # all workspace tests
cargo test -p rustume-schema           # single crate
cargo test -p rustume-server           # server integration tests
cd apps/web && bun run test            # Vitest for web app

```

See [Architecture overview](/docs/architecture/overview/) for the full test matrix.

## Typst template overrides

Native CLI and server builds embed Typst templates at compile time. To iterate on a template
without rebuilding Rust, copy `crates/render/src/typst_engine/templates/*.typ` into a directory and
set `RUSTUME_TEMPLATES_DIR` to that path. Files present in the override directory replace the
embedded copy on each render; missing names fall back to the embedded defaults. The WASM build
always uses embedded templates only.

```bash
mkdir -p ~/rustume-templates
cp crates/render/src/typst_engine/templates/*.typ ~/rustume-templates/
export RUSTUME_TEMPLATES_DIR=~/rustume-templates
# edit templates, then re-run preview/PDF without cargo build
```

See [Templates](/docs/getting-started/templates/#iterating-on-templates) and
[Environment variables](/docs/deployment/env-reference/) for more detail.

## Cloud development

To develop [Rustume Cloud](/docs/cloud/overview/) features locally:

```bash
cp .env.example .env
# Set RUSTUME_CLOUD=true, DATABASE_URL, WORKOS_*, SESSION_SECRET
docker compose --profile cloud up    # starts Postgres + server on :3000
make web                             # Vite frontend only (avoid port clash with Docker API)

```

[WorkOS](https://workos.com/) development credentials required for auth flows — see [Environment
variables](/docs/deployment/env-reference/) and [Authentication](/docs/cloud/auth/).

## Project layout

```text
Rustume/
├── crates/          Rust workspace (cli, parser, render, schema, schema-macros, server, storage, utils)
├── apps/web/        SolidJS resume builder
├── apps/site/       Astro documentation site
├── bindings/wasm/   wasm-pack output for the web app (not under crates/)
├── docker/          Dockerfile
├── docs/            Legacy markdown docs
└── scripts/         CI and utility scripts

```

## Troubleshooting

**Swagger UI download fails at build time** — set `SWAGGER_UI_DOWNLOAD_URL` to a local zip. See
[CONTRIBUTING.md](https://github.com/lgtm-hq/Rustume/blob/main/CONTRIBUTING.md).

**`wasm32-unknown-unknown` target missing** — run `rustup target add wasm32-unknown-unknown`.

**Port 3000 in use** — set `PORT=3001` and update [Vite](https://vite.dev/) proxy config.

## Next steps

- [Linting](/docs/contributing/linting/) — code quality checks
- [Web app](/docs/contributing/web-app/) — [SolidJS](https://www.solidjs.com/) structure
- [Architecture](/docs/architecture/overview/) — crate map
