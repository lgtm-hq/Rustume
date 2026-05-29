---
title: "Monitoring"
description: 'Server health, bearer-protected <code>/metrics</code>, and optional <a href="https://sentry.io/">Sentry</a> integration.'
category: operations
order: 10
---

The server exposes a health endpoint, installs a Prometheus recorder, and can initialize Sentry.
Metrics and Sentry configuration are available independently of connected Cloud state;
database-aware health probing is enabled when connected persistence is configured. Hosted Rustume
Cloud operates its observability stack; self-hosted operators configure their own destinations.

## Health

`GET /health` returns `ok` in normal mode. When connected state is active, it also probes PostgreSQL
and reports failure if the database cannot be reached.

## Metrics

`GET /metrics` requires a configured token and an authorization header:

```bash
curl -H "Authorization: Bearer ${METRICS_TOKEN}" http://localhost:3000/metrics
```

Credentials are not accepted through a query parameter. Which metrics are retained and alerted on
depends on deployment operations.

## Sentry

Set `SENTRY_DSN` to enable optional Sentry Tower integration:

```bash
SENTRY_DSN=https://...@sentry.io/...
```

Operators are responsible for data-scrubbing and retention settings before sending production events
to a third-party telemetry provider.
