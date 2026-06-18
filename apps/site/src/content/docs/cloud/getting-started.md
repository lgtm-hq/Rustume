---
title: "Cloud Getting Started"
description: 'Sign in to hosted Rustume Cloud for managed synchronization, or enable the same Cloud features on a self-hosted deployment.'
category: cloud
order: 20
---

Rustume Cloud is the ready-to-use hosted deployment. It provides account-backed synchronization
without asking users to provision infrastructure. The same connected features remain available to
open-source operators who configure Cloud mode on their own deployment.

## Start with hosted Cloud

1. Open the hosted [Rustume Cloud application](https://app.rustume.com).
2. Sign in through [WorkOS AuthKit](/docs/cloud/auth/).
3. Create a resume or import existing browser-local resumes.
4. Continue editing on another signed-in device through [sync](/docs/cloud/sync/).

Hosting access covers operation of the service. It does not unlock product features that are
withheld from self-hosted deployments.

## Run connected mode yourself

Start PostgreSQL with the Cloud compose profile and set the variables consumed by the server:

```bash
docker compose --profile cloud up -d postgres
export RUSTUME_CLOUD=true
export DATABASE_URL=postgres://user:password@localhost:5432/rustume
export WORKOS_CLIENT_ID=client_...
export WORKOS_API_KEY=sk_...
export WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
export SESSION_SECRET="$(openssl rand -hex 32)"
export CORS_ORIGIN=http://localhost:5173
export METRICS_TOKEN="$(openssl rand -hex 32)"
```

Register the matching callback URL in WorkOS before signing in. See [Environment
Variables](/docs/deployment/env-reference/) for deployment details.

```bash
cargo run -p rustume-server
cd apps/web && bun run dev
```

## Import existing local resumes

When a signed-in user already has locally stored resumes, the web app offers an import. Imported
records retain their IDs when possible and local copies remain on the device. The transfer moves the
resume into account-backed storage so it can participate in synchronization and history.

Read [Cloud Storage](/docs/cloud/storage/) for persistence behavior and [Version
History](/docs/cloud/version-history/) for recovery workflows.
