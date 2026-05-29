---
title: "Backups"
description: 'Recovery guidance for PostgreSQL-backed connected deployments and the operated Rustume Cloud service.'
category: operations
order: 20
---

Browser-local resumes should be exported by the user. Connected deployments add server-backed
storage, history, and synchronization; whoever operates that deployment is responsible for backup
protection and recovery.

## Self-hosted connected deployment

For the local compose PostgreSQL service, a basic logical export is:

```bash
docker compose --profile cloud exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

Store backups off-site, encrypt them appropriately, protect any encryption keys, and test
restoration. Resume content can include sensitive personal data.

## Hosted Rustume Cloud

The hosted service manages database recovery, backup storage, retention policy, and restoration
operations for its operated deployment. Users should still export portable JSON copies before
closing hosted access or when they require an independent archive.

Backups are an operational distinction between hosted and self-hosted use; they are not a product
feature entitlement. See [Cloud Storage](/docs/cloud/storage/) and
[Encryption](/docs/cloud/encryption/).
