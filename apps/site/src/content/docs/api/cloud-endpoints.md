---
title: "Cloud Endpoints"
description: 'Authentication, stored resumes, synchronization, publishing, and history operations for connected Rustume deployments.'
category: api
order: 30
---

Connected endpoints are available in hosted Rustume Cloud and when an open-source operator enables
Cloud mode with PostgreSQL, WorkOS, and a session secret. See [Environment
Variables](/docs/deployment/env-reference/).

## Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/auth/login` | None | Redirect to WorkOS AuthKit |
| `GET` | `/auth/callback` | OAuth state | Exchange code and establish session |
| `POST` | `/auth/logout` | Cookie when present | Delete session and clear cookie |
| `GET` | `/auth/me` | Cookie | Return the authenticated account |

## Resume storage

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/resumes` | List authenticated user's summaries |
| `POST` | `/api/resumes` | Create a resume |
| `GET` | `/api/resumes/{id}` | Fetch owned resume data |
| `PUT` | `/api/resumes/{id}` | Update title and/or resume data |
| `DELETE` | `/api/resumes/{id}` | Delete an owned resume |
| `POST` | `/api/resumes/import` | Import locally stored resumes |
| `GET` | `/api/resumes/export` | Bulk JSON export (max 50 resumes) |
| `GET` | `/api/resumes/export/pdf` | Bulk PDF export as ZIP (max 50 resumes) |

Export endpoints enforce a resume-count cap and route-specific rate limits:

JSON export uses the resume CRUD limit group; PDF export uses the PDF limit group (same as
`POST /api/render/pdf`). See [Rate Limits](/docs/deployment/rate-limits/#bulk-export-cap).

## Account

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/account/export` | GDPR data-portability download as one streamed JSON document (see below) |
| `DELETE` | `/api/account` | Permanently delete the account and all associated data (body: `{"confirmation":"DELETE"}`) |

The account export is an explicit allow-list of the account-linked data Rustume stores:

| Field | Contents |
| --- | --- |
| `exported_at` | UTC timestamp of when the export was generated |
| `account` | Profile: `id`, `email`, `first_name`, `last_name`, `plan`, `created_at` |
| `policy_acceptances` | Terms/Privacy versions accepted, with timestamp and client IP |
| `subscriptions` | Hosted-billing subscriptions ever attached to the account |
| `resumes` | Every resume: id, title, sharing state (`is_public`, `public_slug`), timestamps, full document |
| `resume_snapshots` | Every retained version-history snapshot, per resume |
| `audit_events` | The account's own audit trail (event type, resource, client IP, metadata), oldest first |

Not included: session rows (short-lived credential material, not information about the person),
internal identifiers such as the WorkOS user id and Paddle customer id, and password hashes for
protected shares.

The export is not subject to the 50-resume cap or to subscription gating. It has its own rate
limit (5 per minute, charged to the user and to a shared per-IP bucket like every signed-in
route) and a per-process ceiling of concurrent downloads (`RATE_LIMIT_ACCOUNT_EXPORT_CONCURRENCY`,
default 2), beyond which the request is refused with `503` and `Retry-After`. Both `429` and `503` carry the same `{ "error", "retry_after" }`
body. Every export and deletion is written to the
audit log. See [Rate Limits](/docs/deployment/rate-limits/#account-export-is-not-capped).

## Connected workflows

The connected API also backs [synchronization](/docs/cloud/sync/), [public
pages](/docs/cloud/public-pages/), [version history](/docs/cloud/version-history/), and scoped [API
keys](/docs/api/api-keys/). Consult the generated OpenAPI document for exact route bodies and
responses in the deployed release.

These workflows are not feature entitlements tied to a hosted subscription. Operators running the
open-source connected application can expose the same functional API surface.

## Operational endpoints

| Method | Path | Requirement | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Includes persistence checks when connected mode is configured |
| `GET` | `/metrics` | Bearer `METRICS_TOKEN` | Prometheus exposition |
