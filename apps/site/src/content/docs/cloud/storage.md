---
title: "Cloud Storage"
description: "Account-backed resume persistence in PostgreSQL for hosted Cloud or a self-hosted connected deployment."
category: cloud
order: 40
---

When a user is signed in to a connected deployment, the web app persists resumes on the server
instead of relying only on browser-local data. Hosted Rustume Cloud operates this database for
users; a self-hosted deployment can expose the same behavior. Storage uses
[PostgreSQL](https://www.postgresql.org/) for account-backed resume records.

## Resume endpoints

All routes below require the `rustume_session` cookie.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/resumes` | List owned resume summaries |
| `POST` | `/api/resumes` | Create a resume |
| `GET` | `/api/resumes/{id}` | Fetch an owned resume |
| `PUT` | `/api/resumes/{id}` | Update title and/or data |
| `DELETE` | `/api/resumes/{id}` | Delete an owned resume |
| `POST` | `/api/resumes/import` | Import locally held resumes |

Stored resumes can participate in [synchronization](/docs/cloud/sync/), [version
history](/docs/cloud/version-history/), and [public sharing](/docs/cloud/public-pages/). These
capabilities are part of connected Rustume, not paid feature unlocks.

## Import behavior

The signed-in web app can copy locally held resumes into account-backed storage:

1. It gathers existing browser resumes.
2. It sends resume records to `/api/resumes/import`.
3. The server retains owned IDs when possible.
4. Local data remains on the device after copying.

## Protection and operations

Resume documents must be treated as sensitive personal data in the database and in backups. Use
[Encrypted Storage](/docs/cloud/encryption/) for data-protection choices and
[Backups](/docs/operations/backups/) when operating your own PostgreSQL deployment.
