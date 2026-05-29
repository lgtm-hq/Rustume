---
title: "API Overview"
description: 'REST API for parsing, rendering, validation, templates, and connected Cloud workflows; inspect it at <code>/swagger-ui/</code>.'
category: api
order: 10
---

Rustume exposes an Axum REST API from the server that also serves the web UI. OpenAPI documentation
is available at `/api-docs/openapi.json`; Swagger UI is available at `/swagger-ui/`.

## Deployment contexts

| Deployment | API access |
| --- | --- |
| Browser-local or basic self-hosting | Core parsing, rendering, validation, and templates |
| Self-hosted connected deployment | Core endpoints plus account-backed Cloud workflows |
| Rustume Cloud | The same connected API on an operated hosted deployment |

## Endpoint groups

| Group | Authentication | Availability |
| --- | --- | --- |
| Parse, render, validate, templates, health | None | Every deployment |
| Prometheus metrics | Bearer `METRICS_TOKEN` | Configured server deployments |
| Authentication and resume storage | Session cookie | Connected deployments |
| Sync, public sharing, history, API keys | Session or scoped key as appropriate | Connected deployments |
| Hosted billing management | Hosted account session | Rustume-operated service only |

Billing manages access to hosted operations; it does not change which product capabilities are
available when running the open-source connected application.

## Cloud authentication

WorkOS login establishes an `HttpOnly` session cookie for browser workflows. Scoped [API
keys](/docs/api/api-keys/) support programmatic connected workflows without reusing browser
credentials.

## Configuration and limits

JSON requests use `application/json`; PDF and preview routes return binary PDF/PNG output. Set
`CORS_ORIGIN` explicitly when browser credentials cross origins.

`GET /metrics` requires `Authorization: Bearer <METRICS_TOKEN>`. Optional Sentry integration is
activated with `SENTRY_DSN`; database-aware health probing is enabled when connected Cloud state is
configured.
