---
title: "Terraform Infrastructure"
description: 'Infrastructure-as-code responsibilities for the operated Rustume Cloud production stack.'
category: operations
order: 30
---

The hosted service uses infrastructure automation to manage compute, PostgreSQL, object storage,
DNS, secrets, and observability consistently across environments.

## Hosted scope

Terraform configuration for the operated deployment covers:

- Managed application hosting and networking
- PostgreSQL and object-storage resources
- Monitoring integrations and operational secrets
- Environment separation and controlled deployment changes
- Recovery-oriented infrastructure configuration
- CI-built container image references (GHCR) for application deploys instead of on-platform compiles

Application images are published by GitHub Actions (`docker-build-publish.yml`). Staging
environments track the `main` branch artifact; production environments track release tags or
digest-pinned builds from the same pipeline.

## Self-hosted choice

Terraform is not required to access Rustume capabilities. Open-source operators may use Terraform,
another provisioning tool, or direct deployment configuration while still providing connected
storage, synchronization, history, publishing, and API access.

Start with [Environment Variables](/docs/deployment/env-reference/), then configure
[Monitoring](/docs/operations/monitoring/) and [Backups](/docs/operations/backups/) for the
infrastructure you operate.
