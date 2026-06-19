# Secrets Rotation Runbook

Operator guide for rotating Rustume Cloud and self-hosted secrets without
unnecessary downtime. Public documentation mirrors this content at
`apps/site/src/content/docs/operations/secrets-rotation.md`.

## Scope

This runbook covers application secrets configured via environment variables.
Database credential rotation follows your PostgreSQL provider's procedure
(Neon, Railway Postgres, or self-managed).

## Rotation Order (Least Disruptive First)

1. `METRICS_TOKEN`
2. `WORKOS_API_KEY` / `WORKOS_CLIENT_ID`
3. `SESSION_SECRET`
4. `DATABASE_URL` credentials

## `METRICS_TOKEN`

1. Generate a new random token (32+ bytes).
2. Update the scraper or monitoring job authorization header.
3. Update the deployment environment variable.
4. Rolling restart the Rustume service.
5. Revoke the old token after metrics scrapes succeed.

No user sessions are affected.

## WorkOS Keys (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`)

1. Create or rotate credentials in the WorkOS dashboard.
2. Confirm redirect URIs still match the deployment (`/auth/callback`).
3. Update Railway (or your host) environment variables.
4. Rolling restart the service.
5. Verify `/auth/login` completes a full sign-in flow.
6. Revoke the previous WorkOS key in the dashboard.

## `SESSION_SECRET`

Rotating `SESSION_SECRET` **invalidates all existing `rustume_session` cookies**.
There is no dual-secret grace period in the current implementation.

1. Announce a short maintenance window if users are actively signed in.
2. Generate a new secret (`openssl rand -hex 32`).
3. Update `SESSION_SECRET` in the deployment environment.
4. Rolling restart all Rustume instances simultaneously.
5. Confirm users can sign in again via WorkOS.
6. Remove the old secret from secret stores.

## `DATABASE_URL`

1. Create a new database role/password in your provider.
2. Update connection strings in the deployment environment.
3. Rolling restart Rustume and verify `/health` reports database connectivity.
4. Revoke the old database credentials after traffic stabilizes.

For managed providers, prefer provider-native rotation workflows that support
connection draining.

## Verification Checklist

- [ ] `/health` returns OK
- [ ] `/auth/login` → callback → signed-in session works
- [ ] Resume list/create/update/delete succeeds for a test account
- [ ] `/metrics` accepts the new bearer token (if configured)
- [ ] Audit events continue writing after restart (cloud mode)

## References

- [Environment reference](/docs/deployment/env-reference/)
- [Cloud authentication](/docs/cloud/auth/)
- [SECURITY.md](https://github.com/lgtm-hq/Rustume/blob/main/SECURITY.md)
