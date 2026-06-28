---
title: "Rate Limits"
description: "Per-route request limits for Rustume Cloud and connected deployments, including defaults, configuration, and client behavior."
category: deployment
order: 25
---

Rustume applies **in-memory, per-key rate limits** when connected mode is enabled (`RUSTUME_CLOUD=true`
with a configured database). Limits protect service capacity and control the cost of CPU-heavy
operations (preview and PDF rendering) without blocking normal editing workflows.

Self-hosted operators can tune or effectively disable limits by raising environment values. Browser-local
deployments without connected mode do not install these middleware layers.

## Scope

| Deployment | Rate limiting |
| --- | --- |
| Browser-local (no `RUSTUME_CLOUD`) | Not applied |
| Self-hosted connected | Applied; operator-configurable via env vars |
| Rustume Cloud | Applied with production defaults |

Limits are keyed by **authenticated user ID** for signed-in routes and by **client IP** for
unauthenticated traffic. When `TRUSTED_PROXY=true`, IP extraction uses `X-Real-IP` and append-mode
`X-Forwarded-For` from a trusted reverse proxy.

## Default limits

All values are **requests per minute** unless noted.

### Authenticated routes

| Route group | Default | Burst | Examples |
| --- | ---: | ---: | --- |
| Resume CRUD | 300 | 30 | List, get, create, update, delete, `GET /api/resumes/export` |
| Resume import | 10 | — | `POST /api/resumes/import` |
| Preview render | 60 | — | `POST /api/render/preview` |
| PDF render & bulk PDF export | 20 | — | `POST /api/render/pdf`, `GET /api/resumes/export/pdf` |
| Auth | 10 | — | Login, callback, logout, `/auth/me` |
| Parse & utility | 30 | — | Templates, parse, validate |

Resume CRUD allows short bursts (for example rapid autosave) via a separate burst bucket.

### Unauthenticated routes (per IP)

| Route group | Default | Examples |
| --- | ---: | --- |
| Health | 60 | `GET /health` |
| Metrics | 60 | `GET /metrics` (still requires `METRICS_TOKEN`) |
| Other unauthenticated | 30 | Any route reached without a session |

When `RUSTUME_REQUIRE_AUTH=true` (hosted Rustume Cloud), unauthenticated clients cannot reach
render or connected API routes; the unauthenticated bucket mainly covers probes and stray traffic.

## Bulk export cap

Bulk export endpoints enforce a separate **resume-count cap**, independent of per-minute rate limits.

Bulk JSON export (`GET /api/resumes/export`) counts against the **resume CRUD** limit group.
Bulk PDF export (`GET /api/resumes/export/pdf`) counts against the **PDF** limit group and
renders each resume sequentially.

| Endpoint | Rate limit group | Maximum resumes per request |
| --- | --- | ---: |
| `GET /api/resumes/export` | Resume CRUD | 50 |
| `GET /api/resumes/export/pdf` | PDF | 50 |

**Trigger:** before any data is returned, the server counts all resumes you own. If the count
exceeds 50, the entire request fails with `413 Payload Too Large` and an error message — there is
no silent truncation to the 50 most recently updated resumes.

**At or below 50:** the response includes every owned resume (ordered by `updated_at`, most recent
first). The server fetches up to 51 rows in one query so the cap check and payload load cannot
race under concurrent writes.

**Above 50:** bulk export cannot return the full library in one call. Export resumes individually,
delete or archive older entries, or split work across multiple accounts — **pagination is not
available** on these endpoints today.

The cap complements PDF rate limits by bounding per-request CPU and memory even when requests are
spaced apart.

## Configuration

Override defaults with environment variables (see [Environment
Variables](/docs/deployment/env-reference/#rate-limits-cloud-mode)):

```bash
RATE_LIMIT_RESUME_CRUD_PER_MIN=300
RATE_LIMIT_RESUME_CRUD_BURST=30
RATE_LIMIT_IMPORT_PER_MIN=10
RATE_LIMIT_PREVIEW_PER_MIN=60
RATE_LIMIT_PDF_PER_MIN=20
RATE_LIMIT_AUTH_PER_MIN=10
RATE_LIMIT_HEALTH_PER_MIN=60
RATE_LIMIT_METRICS_PER_MIN=60
RATE_LIMIT_UNAUTHENTICATED_PER_MIN=30
RATE_LIMIT_BILLABLE_PER_MIN=30   # templates, parse, validate (not subscription-gated)
TRUSTED_PROXY=true   # only behind a trusted reverse proxy
```

Invalid values log a warning and fall back to the built-in default.

## HTTP 429 response

When a limit is exceeded, the API returns `429 Too Many Requests` with:

```json
{
  "error": "Too many requests. Please try again shortly.",
  "retry_after": 12
}
```

Response headers include `Retry-After`, `X-RateLimit-Remaining: 0`, and `X-RateLimit-Reset`
(Unix timestamp). The web app shows a brief toast for save operations and retries with backoff.

## Operator notes

- Limits are **process-local** (in-memory token buckets). Horizontal scaling multiplies effective
  capacity per instance; tune env vars if you run multiple replicas.
- PDF and preview limits exist because Typst rendering is CPU-bound. Normal interactive editing
  should stay well below defaults.
- Subscription grace and expiry rules are separate from rate limits; see [Subscription
  Management](/docs/pricing/management/).

## Read next

- [Environment Variables](/docs/deployment/env-reference/) — full configuration reference
- [Cloud Endpoints](/docs/api/cloud-endpoints/) — routes protected by these limits
- [Hosting Economics](/docs/pricing/hosting-economics/) — what hosted billing funds
