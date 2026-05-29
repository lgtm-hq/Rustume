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
