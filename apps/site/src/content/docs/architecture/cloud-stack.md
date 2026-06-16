---
title: "Cloud Stack"
description: 'Hosted Rustume Cloud architecture for managed compute, PostgreSQL, identity, billing, object storage, and observability services.'
category: architecture
order: 20
---

Rustume Cloud operates the connected Rustume application as a managed service. The hosted stack
packages infrastructure responsibilities that self-hosted operators would otherwise configure and
maintain themselves.

## Hosted production architecture

![Rustume Cloud production stack with hosting, database, auth, billing, object storage, and observability](/assets/images/cloud-architecture.png)

| Layer | Hosted service | Purpose |
| --- | --- | --- |
| Hosting | Railway | Run pre-built GHCR images (CI publish, not source compiles) |
| Database | Neon PostgreSQL | Account-backed resumes, history, and service data |
| Authentication | WorkOS AuthKit | Sign-in and account sessions |
| Object storage | Cloudflare R2 | Exports, public assets, and backup artifacts |
| Billing | Paddle Merchant of Record | Access to the operated hosted service |
| Metrics/errors | Grafana Cloud and Sentry | Observability and operational response |
| Infrastructure | Terraform | Repeatable hosted deployment configuration |

## Self-hosted equivalent

Open-source operators can run the same connected product capabilities with infrastructure they
select and control. They provide identity configuration, persistence, storage protection, backups,
monitoring, and upgrades; they do not need a hosted subscription or hosted billing entitlement.

Read [Environment Variables](/docs/deployment/env-reference/),
[Monitoring](/docs/operations/monitoring/), and [Backups](/docs/operations/backups/) for operator
guidance.
