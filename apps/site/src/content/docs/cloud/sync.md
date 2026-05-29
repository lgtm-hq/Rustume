---
title: "Sync"
description: 'Synchronize account-backed resumes across signed-in devices with offline queueing and conflict handling.'
category: cloud
order: 60
---

Synchronization is the user-facing reason to choose a connected deployment. Rustume Cloud makes it
available immediately after sign-in; open-source operators can provide it from their own
Cloud-configured installation.

## Workflow

1. Edits are saved locally while a device is offline.
2. Create, update, and delete operations are queued durably.
3. Queued mutations upload after reconnecting.
4. Diverged edits are detected before either copy is replaced.
5. Users can use [Version History](/docs/cloud/version-history/) when restoration is needed.

## Choosing hosted or self-hosted sync

| Choice | Setup | Operational responsibility |
| --- | --- | --- |
| Rustume Cloud | Sign in and begin editing | Hosted service operates storage, availability, and backups |
| Self-hosted connected deployment | Configure Cloud mode and identity | Operator runs storage, backup, monitoring, and upgrades |

There is no feature entitlement difference between those choices. Read [Cloud Getting
Started](/docs/cloud/getting-started/) or [Environment Variables](/docs/deployment/env-reference/)
to choose a path.
