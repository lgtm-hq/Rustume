---
title: "Secrets Rotation"
description: 'Rotate <code>SESSION_SECRET</code>, WorkOS keys, <code>METRICS_TOKEN</code>, and database credentials with minimal downtime.'
category: operations
order: 40
---

Rotate Rustume deployment secrets in order of least user impact. Exact provider
dashboard steps depend on your host; hosted Rustume Cloud uses Railway with
WorkOS and Neon.

## Rotation order

1. `METRICS_TOKEN`
2. `WORKOS_API_KEY` / `WORKOS_CLIENT_ID`
3. `SESSION_SECRET`
4. `DATABASE_URL` credentials

## `METRICS_TOKEN`

Update your scraper authorization header and the deployment environment
variable, then rolling-restart the service. User sessions are unaffected.

## WorkOS keys

Rotate in the WorkOS dashboard, update deployment environment variables,
rolling-restart, and verify a full `/auth/login` → `/auth/callback` flow.
Revoke the previous key after validation.

## `SESSION_SECRET`

Rotating `SESSION_SECRET` invalidates every existing `rustume_session` cookie.
Plan a brief re-authentication window for active users.

1. Generate `openssl rand -hex 32`
2. Update `SESSION_SECRET` in the deployment environment
3. Rolling-restart all instances
4. Verify sign-in works

## `DATABASE_URL`

Create new database credentials in your provider, update `DATABASE_URL`,
rolling-restart, and revoke old credentials after `/health` reports database
connectivity.

## Verification

- `/health` returns OK
- Sign-in completes and resume CRUD works for a test account
- `/metrics` accepts the new bearer token when configured
- Audit events continue writing in cloud mode

See also [Authentication](/docs/cloud/auth/) and the
[environment reference](/docs/deployment/env-reference/).
