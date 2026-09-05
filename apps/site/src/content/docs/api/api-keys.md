---
title: "API Keys"
description: 'Long-lived credentials for programmatic connected Rustume access in hosted Cloud or a self-hosted deployment.'
category: api
order: 40
---

API keys let users integrate connected Rustume workflows with automation without sharing a browser
session cookie. They are available in the hosted service and in self-hosted connected deployments;
they are not a paid-only feature.

## What a key can do

A key acts as the user who created it. It authorizes every connected route that accepts a session
cookie, such as resume CRUD, import, export, version history, and rendering. Keys are **not
scoped**: there is no read-only or render-only key today.

Two areas stay session-only so a leaked key cannot escalate or hide itself:

- Key management (`GET`/`POST /api/keys`, `DELETE /api/keys/{id}`)
- Account deletion (`DELETE /api/account`)

Requests that carry a key on those routes receive `401 Unauthorized`.

## Creating and using a key

Create a key from the account settings page or with `POST /api/keys` while signed in. The request
body carries only a `name` (1–100 characters) used to label the key. The response includes the
plaintext token exactly once; the server stores a SHA-256 hash and the first eight characters after
the prefix for display.

Tokens start with `rk_` and can be sent either way:

```bash
curl https://rustume.example/api/resumes \
  -H "Authorization: Bearer rk_..."

curl https://rustume.example/api/resumes \
  -H "x-api-key: rk_..."
```

When both a session cookie and a key are present, the session wins. Each user may hold up to 20
active keys; revoke an old key before creating a new one once the cap is reached.

## Revocation and rate limits

Revoke unused or compromised keys with `DELETE /api/keys/{id}`. Revocation is immediate and
recorded in the audit log along with key creation and failed key authentication attempts.

Requests authenticated with a key count against the per-IP bucket for the route group, the route
group's own quota keyed by the key ID, and a per-key quota (`RATE_LIMIT_API_KEY_PER_MIN`,
default 300 requests per minute). See [Rate Limits](/docs/deployment/rate-limits/#api-keys).

Treat an API key like a password and rotate it if it is exposed. Read [Core
Endpoints](/docs/api/core-endpoints/) and [Cloud Endpoints](/docs/api/cloud-endpoints/) for the
operations a key can authorize.
