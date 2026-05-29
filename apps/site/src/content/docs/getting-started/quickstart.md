---
title: "Quickstart"
description: 'Get Rustume running locally with <code>make setup</code>, <code>make dev</code>, or <a href="/docs/deployment/docker/">Docker</a> in under five minutes.'
category: getting-started
order: 10
---

[Rustume](/) ships as a [SolidJS](https://www.solidjs.com/) resume builder backed by a
[Rust](https://www.rust-lang.org/) API. You can develop locally with the
[Makefile](https://github.com/lgtm-hq/Rustume/blob/main/Makefile) or run a single
[Docker](https://www.docker.com/) container for a production-like setup.

## Prerequisites

For native development you need:

- **[Rust](https://www.rust-lang.org/)** via [rustup](https://rustup.rs/) with the
  `wasm32-unknown-unknown` target
- **[wasm-pack](https://rustwasm.github.io/wasm-pack/)** — `cargo install wasm-pack`
- **[bun](https://bun.sh)**
- **[Python 3.11+](https://www.python.org/)** and **[uv](https://docs.astral.sh/uv/)** — for
[lintro](https://github.com/lgtm-hq/py-lintro) linting (optional for running the app)

For Docker-only setup you only need [Docker](https://www.docker.com/) with
[BuildKit](https://docs.docker.com/build/buildkit/) enabled.

## Native development

```bash
git clone https://github.com/lgtm-hq/Rustume.git
cd Rustume
make setup   # verify deps, install packages, build WASM
make dev     # API on :3000, Vite dev server on :5173

```

Open [http://localhost:5173](http://localhost:5173) for the editor. The [Vite](https://vite.dev/)
dev server proxies API calls to the [Rust](https://www.rust-lang.org/) server on port `3000`.

Verify the API is healthy:

```bash
curl -sf http://localhost:3000/health
# → ok

```

Interactive [OpenAPI](https://www.openapis.org/) documentation is available at
[http://localhost:3000/swagger-ui/](http://localhost:3000/swagger-ui/).

## Docker quick start

Pull the published image and run:

```bash
docker pull ghcr.io/lgtm-hq/rustume:latest
docker run -p 3000:3000 ghcr.io/lgtm-hq/rustume:latest

```

Open [http://localhost:3000](http://localhost:3000). The container serves both the web UI and the
API from a single process.

Alternatively, use [Docker Compose](https://docs.docker.com/compose/) from the repository root:

```bash
docker compose up          # pull ghcr.io/lgtm-hq/rustume:latest
docker compose up --build  # build locally when GHCR is unavailable

```

## What you get

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Container health check |
| `GET /api/templates` | List resume templates |
| `POST /api/parse` | Import [JSON Resume](https://jsonresume.org/), [LinkedIn](https://www.linkedin.com/), or [Reactive Resume](https://rxresu.me/) |
| `POST /api/render/pdf` | Export PDF |
| `/swagger-ui/` | [OpenAPI](https://www.openapis.org/) documentation |

## Next steps

- [Browse the 12 templates](/docs/getting-started/templates/) and pick a layout
- [Import an existing resume](/docs/getting-started/import-formats/) from
[JSON Resume](https://jsonresume.org/), [LinkedIn](https://www.linkedin.com/), or [Reactive
Resume](https://rxresu.me/)
- Deploy with [Docker](/docs/deployment/docker/) for [self-hosting](/docs/deployment/self-hosting/)
