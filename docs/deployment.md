# Deployment

Rustume ships as a single container that serves both the SolidJS resume builder
and the Rust API.

## Prerequisites

- **Docker** with BuildKit enabled (Docker Desktop or Docker Engine 20.10+)
- For building from source: network access to GitHub (Rust crates, bun release,
  wasm-pack)

Native development (without Docker) requires Rust, wasm-pack, bun, and the
`wasm32-unknown-unknown` target — see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Option A: Pull from GHCR

Published release images are pushed when a `v*.*.*` tag is created (same tag
that triggers binary releases). Use `latest` or a semver tag:

```bash
docker pull ghcr.io/lgtm-hq/rustume:latest
docker run -p 3000:3000 ghcr.io/lgtm-hq/rustume:latest
```

Open <http://localhost:3000>. The same process also exposes:

- `GET /health` for container health checks
- `/swagger-ui/` for API documentation
- `/api-docs/openapi.json` for the OpenAPI document

If `docker pull` returns `manifest unknown`, the release image may not be
published yet (wait for the Docker workflow on the tag, or use Option B).

## Option B: Build from source

When GHCR is unavailable or you need a custom build:

```bash
git clone https://github.com/lgtm-hq/Rustume.git
cd Rustume
docker build -t rustume -f docker/Dockerfile .
docker run -p 3000:3000 rustume
```

Behind corporate TLS inspection, ensure Docker trusts your proxy CA. The
Dockerfile runs `update-ca-certificates` before downloading bun; you may still
need to add custom CAs to Docker Desktop.

## Verify installation

```bash
curl -sf http://localhost:3000/health
```

A successful response confirms the API is listening.

## Docker Compose

The root `docker-compose.yml` supports both pull and local build:

```bash
docker compose up          # Pull ghcr.io/lgtm-hq/rustume:latest
docker compose up --build  # Build from docker/Dockerfile when GHCR is unavailable
```

## Verifying Image Signatures

Published release images are signed with Sigstore keyless signing via the
`lgtm-ci` reusable Docker workflow. Verify a pulled image with:

```bash
cosign verify ghcr.io/lgtm-hq/rustume:latest \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity-regexp="github.com/lgtm-hq/Rustume"
```

SLSA provenance and SBOM attestations are attached during publish. Verify
provenance with:

```bash
cosign verify-attestation --type slsaprovenance ghcr.io/lgtm-hq/rustume:latest
```

## Image Tags

| Tag | When published | Use for |
| --- | --- | --- |
| `latest`, `0.15.0`, `0.15`, `0` | `v*.*.*` git tag push | Production self-hosting |
| `main`, `sha-<commit>` | `main` branch push (path-filtered) | Bleeding-edge / CI |
| `build-<run>-<arch>` | CI staging only | Internal; not for pulls |

CI publishes `latest` and semver tags only when the workflow runs on a version
tag and receives the tag name as `version` (for example `v0.15.0`).

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port inside the container. |
| `RUST_LOG` | `info` | Rust tracing filter. Use `debug` for more server logs. |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins for API requests. Set explicitly in production (e.g. `https://your-domain.com`). |
| `RUSTUME_STATIC_DIR` | `/app/web` | Directory containing the built web app. |

The root `docker-compose.yml` sets `CORS_ORIGIN` to `http://localhost:3000`.
The server binary defaults to `*` when unset.

## Reverse Proxy

Rustume is designed for local or single-user deployments. If you expose it on
the internet, place it behind a reverse proxy that provides TLS and any required
access control.

Example Caddy configuration:

```caddyfile
rustume.example.com {
  reverse_proxy rustume:3000
}
```

## Persistence

The server is stateless. Resume data is stored in the browser by the web app and
sent to the API only when parsing, previewing, or exporting. Back up browser data
by exporting resumes from the UI.
