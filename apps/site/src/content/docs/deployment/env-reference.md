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
| `RUSTUME_TEMPLATES_DIR` | unset | Directory of `.typ` template overrides (native CLI/server only; see [Templates](/docs/getting-started/templates/#iterating-on-templates)) |
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
| `RESEND_API_KEY` | Resend API key; required together with `EMAIL_FROM` to enable transactional email |
| `EMAIL_FROM` | Sender address for outbound mail (for example `noreply@rustume.com`) |

Set `TRUSTED_PROXY=true` only when the server is behind a trusted proxy and may rely on
`X-Forwarded-For` when calling WorkOS. The same flag enables `X-Real-IP` and append-mode
`X-Forwarded-For` for rate-limit key extraction — see [Rate
Limits](/docs/deployment/rate-limits/#scope).

## Rate limits (cloud mode)

When connected mode is enabled, per-route rate limits apply. See [Rate
Limits](/docs/deployment/rate-limits/) for defaults, route groups, and client behavior.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `RATE_LIMIT_RESUME_CRUD_PER_MIN` | `300` | Resume list/get/create/update/delete and bulk JSON export |
| `RATE_LIMIT_RESUME_CRUD_BURST` | `30` | Short burst allowance for resume CRUD |
| `RATE_LIMIT_IMPORT_PER_MIN` | `10` | Bulk import |
| `RATE_LIMIT_PREVIEW_PER_MIN` | `60` | Preview render |
| `RATE_LIMIT_PDF_PER_MIN` | `20` | PDF render and bulk PDF export |
| `RATE_LIMIT_AUTH_PER_MIN` | `10` | Auth login/callback/logout/me |
| `RATE_LIMIT_HEALTH_PER_MIN` | `60` | Unauthenticated health checks (per IP) |
| `RATE_LIMIT_METRICS_PER_MIN` | `60` | Metrics scrapes (per IP) |
| `RATE_LIMIT_UNAUTHENTICATED_PER_MIN` | `30` | Other unauthenticated traffic (per IP) |
| `RATE_LIMIT_BILLABLE_PER_MIN` | `30` | Templates, parse, validate (available in all connected deployments; env name is historical) |

## Local connected example

```bash
docker compose --profile cloud up postgres
export RUSTUME_CLOUD=true
export DATABASE_URL=postgres://user:password@localhost:5432/rustume
export WORKOS_CLIENT_ID=client_...
export WORKOS_API_KEY=sk_...
export WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
export SESSION_SECRET="$(openssl rand -hex 32)"
export RESEND_API_KEY=re_...
export EMAIL_FROM=noreply@rustume.com
export METRICS_TOKEN="$(openssl rand -hex 32)"
export CORS_ORIGIN=http://localhost:5173
cargo run -p rustume-server
```

Hosted-stack configuration for billing, managed object storage, and infrastructure provisioning is
an operator concern, not a prerequisite for users running the open-source connected features.
