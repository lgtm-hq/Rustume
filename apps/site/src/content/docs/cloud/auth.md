---
title: "Authentication"
description: '<a href="https://workos.com/docs/user-management/authkit">WorkOS AuthKit</a> login, signed <code>rustume_session</code> cookies, and the Cloud account boundary.'
category: cloud
order: 30
---

Connected deployments use WorkOS AuthKit for sign-in and a server-side session stored in PostgreSQL.
Rustume Cloud configures this for hosted users; open-source operators can configure the same login
flow.

## Authentication flow

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/auth/login` | Creates OAuth state cookie and redirects to WorkOS |
| `GET` | `/auth/callback` | Validates OAuth state, exchanges the code, upserts user, sets session cookie |
| `POST` | `/auth/logout` | Deletes session and clears cookie |
| `GET` | `/auth/me` | Returns the authenticated account record |

The `rustume_session` cookie is signed, `HttpOnly`, and `SameSite=Lax`. It is marked `Secure` when
the configured redirect URL uses HTTPS. OAuth state is kept in a short-lived cookie and checked
during callback.

## Account data stored by Rustume

WorkOS AuthKit requires an email address for every user and may receive first/last name from the
identity provider (Google, GitHub, SAML SSO, etc.). Rustume syncs these fields into its own database
on each sign-in so the account UI can greet the user by name.

| Field | Source | Stored in Rustume DB | Shown in UI |
| --- | --- | --- | --- |
| `workos_id` | WorkOS | Yes | No |
| `email` | WorkOS | Yes | Yes |
| `first_name` | WorkOS / IdP | Yes (when available) | Yes |
| `last_name` | WorkOS / IdP | Yes (when available) | Yes |
| `plan` | Paddle / internal | Yes | Yes |

**WorkOS itself also retains these fields** in its User Management dashboard. Deployment operators
with WorkOS dashboard access can view and manage user profiles there.

### What is _not_ stored as account data

OAuth tokens, passwords, and WorkOS session metadata are never persisted by Rustume. The session
cookie references an opaque server-side session ID — not identity claims.

## Resume data boundary

Resume data is separate from account identity: a saved document can contain contact and employment
information authored by the user. Read [Cloud Storage](/docs/cloud/storage/) and
[Encryption](/docs/cloud/encryption/) before operating a connected deployment.

End-to-end encryption of resume content is planned for a future release.

## Operator configuration

```bash
RUSTUME_CLOUD=true
DATABASE_URL=postgres://...
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
WORKOS_REDIRECT_URI=https://your-domain.example/auth/callback
SESSION_SECRET=<at-least-32-characters>
```

If the app is behind a trusted proxy, `TRUSTED_PROXY=true` permits forwarding the client IP to
WorkOS. Do not enable that setting for untrusted proxy headers.
