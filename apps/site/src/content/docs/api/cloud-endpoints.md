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
| `PATCH` | `/api/account` | Change the display username (`{"username": "swift-otter-4821"}`); `400` on an invalid handle, `409` when already taken |
| `DELETE` | `/api/account` | Permanently delete the account and all associated data (body: `{"confirmation":"DELETE"}`); own limit of 5/min (`RATE_LIMIT_ACCOUNT_DELETE_PER_MIN`), per user and shared per IP |

**Profile shape change.** `GET /auth/me` returns `username`, an editable handle. Accounts created
after this release get a friendly adjective-noun-number handle at sign-up (for example
`swift-otter-4821`); accounts that existed before it (and any row written by an older replica
during the rollout) carry their hyphen-stripped account id as the handle until the user picks a
new one on the Account page. It no longer returns `first_name` or `last_name`. This release neither reads nor writes legal names; migration `010_usernames.sql`
keeps the legacy columns (and leaves `username` nullable) so that pre-username replicas keep
working during a rolling deploy, and a later release drops them. External consumers of `/auth/me`
should read `username` for display.

The username rules (3–32 UTF-16 code units, lowercase letters, digits, and single interior
hyphens, a reserved-word list) are shared verbatim between the server and the bundled web client.

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
