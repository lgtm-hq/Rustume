---
title: "Docker Deployment"
description: 'Run Rustume from <code>ghcr.io/lgtm-hq/rustume</code>, build from source, verify signatures, and use <a href="https://docs.docker.com/compose/">Docker Compose</a>.'
category: deployment
order: 10
---

[Rustume](/) ships as a single [Docker](https://www.docker.com/) container that serves both the
[SolidJS](https://www.solidjs.com/) resume builder and the [Rust](https://www.rust-lang.org/) API.

## Prerequisites

- **[Docker](https://www.docker.com/)** with [BuildKit](https://docs.docker.com/build/buildkit/)
  enabled ([Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Docker
  Engine](https://docs.docker.com/engine/) 20.10+)
- For building from source: network access to [GitHub](https://github.com/)
  ([Rust](https://www.rust-lang.org/) crates, [bun](https://bun.sh) release,
  [wasm-pack](https://rustwasm.github.io/wasm-pack/))

Native development (without [Docker](https://www.docker.com/)) requires
[Rust](https://www.rust-lang.org/), [wasm-pack](https://rustwasm.github.io/wasm-pack/),
[bun](https://bun.sh), and the `wasm32-unknown-unknown` target — see [Development
setup](/docs/contributing/development/).

## Option A: Pull from GHCR

Published release images are pushed when a `v*.*.*` tag is created. Use `latest` or a
[semver](https://semver.org/) tag:

```bash
docker pull ghcr.io/lgtm-hq/rustume:latest
docker run -p 3000:3000 ghcr.io/lgtm-hq/rustume:latest

```

Open [http://localhost:3000](http://localhost:3000). The same process also exposes:

- `GET /health` — container health checks
- `/swagger-ui/` — API documentation
- `/api-docs/openapi.json` — [OpenAPI](https://www.openapis.org/) document

If `docker pull` returns `manifest unknown`, the release image may not be published yet. Use Option
B or wait for the [Docker workflow](https://github.com/lgtm-hq/Rustume/actions) on the tag.

## Option B: Build from source

```bash
git clone https://github.com/lgtm-hq/Rustume.git
cd Rustume
docker build -t rustume -f docker/Dockerfile .
docker run -p 3000:3000 rustume

```

On Apple Silicon, build for your native platform if you hit
[Rosetta](https://en.wikipedia.org/wiki/Rosetta_(software)) errors:

```bash
docker build --platform linux/arm64 -t rustume -f docker/Dockerfile .

```

## Verify installation

```bash
curl -sf http://localhost:3000/health

```

## Docker Compose

The root `docker-compose.yml` supports both pull and local build:

```bash
docker compose up          # Pull ghcr.io/lgtm-hq/rustume:latest
docker compose up --build  # Build from docker/Dockerfile

```

For [Rustume Cloud](/docs/cloud/overview/) local development, use the cloud profile (requires
[PostgreSQL](/docs/deployment/env-reference/) env vars):

```bash
cp .env.example .env
docker compose --profile cloud up

```

## Image tags

| Tag | When published | Use for |
| --- | --- | --- |
| `latest`, `0.16.0`, `0.16`, `0` | `v*.*.*` git tag push | Production self-hosting |
| `main`, `sha-<commit>` | `main` branch push | Bleeding-edge / CI |
| `build-<run>-<arch>` | CI staging only | Internal; not for pulls |

## Supply chain verification

Release images are signed with [Sigstore keyless
signing](https://docs.sigstore.dev/cosign/signing/signing_with_containers/). See [Supply
chain](/docs/deployment/supply-chain/) for `cosign verify` commands and
[SBOM](https://www.cisa.gov/sbom) attestation checks.
