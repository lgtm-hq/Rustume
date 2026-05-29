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

## Account data boundary

Rustume records an opaque `workos_id` for identity linkage rather than persisting WorkOS profile
details such as email, name, avatar, or OAuth tokens as separate account fields. Hosted billing
metadata identifies service access; it does not decide whether product functionality is exposed.

Resume data is different from identity metadata: a saved document can contain contact and employment
information. Read [Cloud Storage](/docs/cloud/storage/) and [Encryption](/docs/cloud/encryption/)
before operating a connected deployment.

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
