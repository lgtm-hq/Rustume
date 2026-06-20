---
title: "Hosting Economics"
description: "How Rustume Cloud billing relates to service operation, capacity controls, and open-source parity."
category: pricing
order: 15
---

Rustume Cloud billing pays for **operated hosting** — not exclusive product features. The open-source
connected application can provide the same resume workflows when you deploy and operate it yourself.

This page summarizes the public economic model. Detailed production unit costs, margin targets, and
infrastructure runbooks live in restricted operator documentation (not published on this site).

## What a hosted subscription funds

| Cost category | Included in hosted access | Self-hosted operator |
| --- | --- | --- |
| Application hosting & upgrades | Rustume operates | You deploy and patch |
| Managed PostgreSQL & backups | Rustume operates | You provision (optional) |
| Authentication (WorkOS) | Rustume configures | You configure WorkOS |
| Observability & on-call | Rustume operates | You monitor |
| Transactional email | Rustume operates (Resend) | You configure (optional) |
| Billing & tax handling (Paddle) | Rustume operates | Not applicable |

A subscription keeps the **ready-to-use deployment** (`app.rustume.com`) available. It does not unlock
builder, export, sync, sharing, history, or API capabilities that self-hosted operators cannot also
enable.

## Capacity controls (not a feature paywall)

Hosted service limits protect operational capacity and cost — they are **acceptable-use guardrails**,
not a tiered feature matrix:

| Control | Purpose |
| --- | --- |
| [Rate limits](/docs/deployment/rate-limits/) | Prevent abuse of CPU-heavy render paths and keep APIs responsive |
| Bulk export cap (50 resumes) | Bound per-request PDF generation and archive size |
| JSON complexity limits | Reject oversized or deeply nested resume payloads (server-wide) |

Generous defaults are chosen so typical editing, preview, and occasional PDF export never hit limits.
Power users who self-host can raise or remove limits via environment variables.

## Cost drivers operators should know

Even without publishing internal unit economics, these factors dominate hosted operating cost:

1. **PDF and preview rendering** — CPU time per Typst compile; rate limits target this path first.
2. **Database storage & I/O** — resume JSON, version history, and audit events grow with active users.
3. **Egress** — PDF downloads and bulk export ZIP responses.
4. **Third-party services** — WorkOS auth, Resend email, Paddle billing, observability vendors.

Self-hosted deployments incur the same technical cost drivers when they enable connected mode; the
difference is who pays the invoices and staffs on-call.

## Billing state vs. product features

Subscription status on Rustume Cloud controls **access to the operated deployment** (active, grace
period after cancellation, or expired). It does not change what the application can do in a
self-hosted connected deployment.

During a grace period, users can still read, export, and delete data; write operations may be
restricted until the period ends. See [Subscription Management](/docs/pricing/management/).

## Public documentation boundary

Rustume's public documentation covers architecture, user workflows, and operator-facing
configuration. It intentionally omits restricted operations detail such as:

- Exact production cost per user or resume
- Internal alert thresholds and SLO numbers
- Recovery time objectives and restore runbooks
- Live infrastructure identifiers

Operators running private forks should maintain their own economics and incident documentation.

## Read next

- [Hosting Options](/docs/pricing/plans/) — capability comparison
- [Rate Limits](/docs/deployment/rate-limits/) — defaults and env configuration
- [Cloud Overview](/docs/cloud/overview/) — hosted vs self-hosted connected mode
