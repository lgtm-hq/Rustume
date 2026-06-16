# Rustume Cloud infrastructure

Terraform modules and environment wiring for the operated Rustume Cloud stack.

## Layout

| Path | Purpose |
| --- | --- |
| `modules/railway/` | Railway service deployed from CI-built GHCR images |

Environment roots (for example `infra/staging/`, `infra/production/`) land with
Phase 1 Terraform work ([#243](https://github.com/lgtm-hq/Rustume/issues/243)).
They compose the modules here with Neon, DNS, and observability providers.

## Deploy model

Rustume Cloud does **not** compile Rust on Railway. CI publishes signed images from
`docker/Dockerfile`; Railway pulls the pre-built artifact. See
[docs/operations/rustume-cloud-deploy.md](../docs/operations/rustume-cloud-deploy.md).
