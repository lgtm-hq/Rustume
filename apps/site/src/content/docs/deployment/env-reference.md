---
title: "Environment Variables"
description: 'Configuration reference for self-hosted server operation and connected Cloud mode with PostgreSQL and WorkOS.'
category: deployment
order: 30
---

## Deployment modes

| Mode | What it enables | Who configures services |
| --- | --- | --- |
| Browser-local/default | Stateless API and browser persistence | No external services required |
| Self-hosted connected mode | Account-backed storage, sync, sharing, and history | The operator |
| Rustume Cloud | The same connected capabilities on a ready-to-use hosted deployment | Rustume |

Hosted users do not configure environment variables. This page is for operators running the
open-source application or maintaining the hosted service.

## Common settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port |
| `RUST_LOG` | `info` | Rust tracing filter |
| `CORS_ORIGIN` | `*` | Allowed browser origins; set an explicit origin for credentialed requests |
| `RUSTUME_STATIC_DIR` | `/app/web` | Built web UI directory |
| `SENTRY_DSN` | unset | Optional Sentry error tracking |
| `METRICS_TOKEN` | unset | Required bearer token for `/metrics` to return telemetry |

## Connected mode settings

Cloud state is initialized when `RUSTUME_CLOUD` is true and `DATABASE_URL` is non-empty. Once
enabled, these identity and persistence settings are required:

| Variable | Purpose |
| --- | --- |
| `RUSTUME_CLOUD` | Set to `true` or `1` to enable connected mode |
| `DATABASE_URL` | PostgreSQL connection string |
| `WORKOS_CLIENT_ID` | WorkOS AuthKit application client ID |
| `WORKOS_API_KEY` | Server-side WorkOS API key |
| `WORKOS_REDIRECT_URI` | Registered OAuth callback URL |
| `SESSION_SECRET` | Session signing secret, at least 32 characters |

Set `TRUSTED_PROXY=true` only when the server is behind a trusted proxy and may rely on
`X-Forwarded-For` when calling WorkOS.

## Local connected example

```bash
docker compose --profile cloud up postgres
export RUSTUME_CLOUD=true
export DATABASE_URL=postgres://user:password@localhost:5432/rustume
export WORKOS_CLIENT_ID=client_...
export WORKOS_API_KEY=sk_...
export WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
export SESSION_SECRET="$(openssl rand -hex 32)"
export METRICS_TOKEN="$(openssl rand -hex 32)"
export CORS_ORIGIN=http://localhost:5173
cargo run -p rustume-server
```

Hosted-stack configuration for billing, managed object storage, and infrastructure provisioning is
an operator concern, not a prerequisite for users running the open-source connected features.
