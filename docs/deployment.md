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
  --certificate-identity-regexp='^https://github\.com/lgtm-hq/lgtm-ci/\.github/workflows/reusable-docker\.yml@refs/.*$'
```

SLSA provenance and SBOM attestations are attached during publish. Verify
provenance with:

```bash
cosign verify-attestation --type https://slsa.dev/provenance/v1 ghcr.io/lgtm-hq/rustume:latest \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity-regexp='^https://github\.com/lgtm-hq/lgtm-ci/\.github/workflows/reusable-docker\.yml@refs/.*$'
```

## Image Tags

| Tag | When published | Use for |
| --- | --- | --- |
| `latest`, `0.15.0`, `0.15`, `0` | `v*.*.*` git tag push | Production self-hosting and Rustume Cloud production |
| `main`, `sha-<commit>` | `main` branch push (path-filtered) | Rustume Cloud staging / bleeding-edge self-hosting |
| `build-<run>-<arch>` | CI staging only | Internal; not for pulls |

CI publishes `latest` and semver tags only when the workflow runs on a version
tag and receives the tag name as `version` (for example `v0.15.0`).

## Rustume Cloud (operated hosting)

Operated Rustume Cloud deploys the same GHCR images CI builds for releases — Railway pulls
the image instead of compiling from GitHub source. Staging tracks `:main` (or a pinned
`:sha-<commit>`); production tracks release semver tags or a digest pin. Full runbook:
[docs/operations/rustume-cloud-deploy.md](operations/rustume-cloud-deploy.md).

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port inside the container. |
| `RUST_LOG` | `info` | Rust tracing filter. Use `debug` for more server logs. |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins for API requests. Set explicitly in production (e.g. `https://your-domain.com`). |
| `RUSTUME_STATIC_DIR` | `/app/web` | Directory containing the built web app. |
| `DATABASE_URL` | compose: local postgres | PostgreSQL connection string for persistent resume storage. When unset, the server falls back to stateless mode (browser-only storage). |
| `RUSTUME_ENCRYPT_AT_REST` | `true` (self-hosted) / `false` (cloud) | Encrypt resume payloads with AES-256-GCM before writing to Postgres. |
| `RUSTUME_ENCRYPTION_KEY` | unset | Hex-encoded 32-byte key (`openssl rand -hex 32`). Takes priority over the key file. |
| `RUSTUME_ENCRYPTION_KEY_FILE` | `/data/.encryption_key` | Key file location; a random key is auto-generated here on first start if no key is configured. |

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

`docker compose up` runs Postgres alongside the server. Resume data is stored
server-side in the `rustume_pgdata` volume and encrypted at rest by default,
so it survives browser wipes, reinstalls, and device switches. On first start
the server seeds an implicit local user (no login required) and auto-generates
an encryption key at `/data/.encryption_key` (the `rustume_data` volume).

If `DATABASE_URL` is not set (for example when running the bare binary), the
server falls back to the legacy stateless mode: resume data stays in the
browser and is sent to the API only for parsing, previewing, or exporting.

Self-hosted mode trusts the local network: the resume API requires no
authentication, so anyone who can reach the server can read and write resumes.
Keep it on a trusted LAN or add access control at a reverse proxy. Change the
default Postgres credentials if the database port is exposed.

## Backup

Two artifacts are needed for full recovery — the database dump alone is
encrypted garbage without the key, and the key alone has nothing to decrypt:

```bash
# 1. Encryption key (once — it never changes). If you set
#    RUSTUME_ENCRYPTION_KEY_FILE, copy that path instead.
docker compose cp rustume:/data/.encryption_key ./rustume-encryption.key.backup

# 2. Postgres data (regularly) — uses the credentials the container runs with
docker compose exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'   > rustume-backup.sql
```

To restore, stop the server first (`docker compose stop rustume`), place the
key back at the configured key file path (or set `RUSTUME_ENCRYPTION_KEY` to
its hex contents), restore the SQL dump, then start the server again. The
server refuses to start if encrypted rows exist that the configured key
cannot decrypt.

`docker compose down` preserves the named volumes (`rustume_pgdata`,
`rustume_data`). **`docker compose down -v` destroys all resume data and the
encryption key.**
