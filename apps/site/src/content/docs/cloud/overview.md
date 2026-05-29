---
title: "Cloud Overview"
description: 'Use hosted Rustume Cloud for ready-to-use sign-in and synchronization, or deploy the same Cloud-capable application yourself.'
category: cloud
order: 10
---

Rustume works locally without an account, and it can also run as a connected application with
account-backed storage and synchronization. Rustume Cloud is the hosted option: sign in and start
working without provisioning a database, identity provider, backups, or monitoring.

## Same capabilities, different operations

The open-source application and the hosted service share the same functional Cloud surface. A
subscription pays for an operated deployment, not access to otherwise hidden product features.

| Experience | Who operates it | Persistence and sync | Product capabilities |
| --- | --- | --- | --- |
| Browser-local use | You and your browser | IndexedDB on one device | Builder, templates, import, export |
| Self-hosted Cloud configuration | You | Your PostgreSQL-backed deployment | Full connected feature set |
| Rustume Cloud | Rustume | Hosted storage and sync, ready after sign-in | Full connected feature set |

## Connected features

Whether hosted by Rustume or configured in an open-source deployment, connected mode includes:

- [Authentication](/docs/cloud/auth/) and account-backed storage
- [Cloud synchronization](/docs/cloud/sync/) across signed-in devices
- [Encrypted storage](/docs/cloud/encryption/)
- [Public pages and password-protected sharing](/docs/cloud/public-pages/)
- [Version history and restore](/docs/cloud/version-history/)
- [API keys](/docs/api/api-keys/) for programmatic workflows

The [hosting options](/docs/pricing/plans/) page compares operational responsibility rather than
feature entitlements.

## Privacy boundary

Authentication records use an opaque WorkOS identifier rather than copying profile fields into
Rustume account records. Saved resumes can naturally contain names, contact details, and work
history, so all operators must treat stored documents and backups as sensitive personal data.

Read [Encryption](/docs/cloud/encryption/) for storage-protection choices and
[Backups](/docs/operations/backups/) for operator responsibilities.

## Read next

Users of the hosted service can start with [Cloud Getting Started](/docs/cloud/getting-started/).
Operators enabling the same capabilities in their own deployment should also read [Environment
Variables](/docs/deployment/env-reference/) and [Cloud Stack](/docs/architecture/cloud-stack/).
