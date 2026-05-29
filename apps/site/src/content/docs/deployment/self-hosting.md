---
title: "Self-Hosting"
description: 'Expose Rustume on the internet with a <a href="https://developer.mozilla.org/en-US/docs/Glossary/Reverse_proxy">reverse proxy</a>, <a href="https://developer.mozilla.org/en-US/docs/Glossary/TLS">TLS</a>, and <code>GET /health</code> probes.'
category: deployment
order: 20
---

[Rustume](/) is designed for local or single-user deployments. Exposing it on the internet requires
a [reverse proxy](https://developer.mozilla.org/en-US/docs/Glossary/Reverse_proxy) for
[TLS](https://developer.mozilla.org/en-US/docs/Glossary/TLS) and optional access control.

## Architecture

The self-hosted deployment is
**[stateless](https://developer.mozilla.org/en-US/docs/Glossary/Statelessness)**:

- The [Axum](https://github.com/tokio-rs/axum) server handles parse, render, validate, and template
  APIs
- Resume data lives in the browser
  ([IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via
  [WASM](/docs/architecture/overview/)) — not on the server
- No database is required unless you enable [Rustume Cloud mode](/docs/cloud/overview/)
  (`RUSTUME_CLOUD=true`)

This keeps operations simple: one container, no backups of user data on the server.

## Reverse proxy

Place [Rustume](/) behind any [reverse
proxy](https://developer.mozilla.org/en-US/docs/Glossary/Reverse_proxy) that terminates
[TLS](https://developer.mozilla.org/en-US/docs/Glossary/TLS).

### Caddy example

> [Caddy](https://caddyserver.com/) automatically provisions
> [TLS](https://developer.mozilla.org/en-US/docs/Glossary/TLS) certificates and forwards traffic
> to the [Rustume](/) container.

```text
rustume.example.com {
  reverse_proxy rustume:3000
}

```

### nginx example

> Use [nginx](https://nginx.org/) as a
> [reverse proxy](https://developer.mozilla.org/en-US/docs/Glossary/Reverse_proxy). Configure
> TLS certificates separately, for example with [Certbot](https://certbot.eff.org/).

```nginx
server {
  listen 443 ssl;
  server_name rustume.example.com;
  # Obtain certificates via Certbot/Let's Encrypt, then set:
  # ssl_certificate     /etc/letsencrypt/live/rustume.example.com/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/rustume.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}

```

Set `CORS_ORIGIN` to your public origin when the frontend is served from a different domain:

```bash
docker run -p 3000:3000 \
  -e CORS_ORIGIN=https://rustume.example.com \
  ghcr.io/lgtm-hq/rustume:latest

```

## Persistence

### Self-hosted (default)

The server stores nothing. Users should export resumes regularly:

- **JSON export** — portable backup of full resume data
- **PDF export** — rendered output for applications

Clearing browser data removes local resumes unless exported first.

### Cloud mode (optional)

When `RUSTUME_CLOUD=true` and `DATABASE_URL` is set, resumes persist in
[PostgreSQL](https://www.postgresql.org/). Use a managed provider ([Neon](https://neon.tech/)) or
self-host [PostgreSQL](https://www.postgresql.org/) with a [Docker
volume](https://docs.docker.com/storage/volumes/):

```yaml
# docker-compose.yml cloud profile
volumes:
  rustume_pgdata:

```

See [Cloud storage](/docs/cloud/storage/) for [CRUD](/docs/api/cloud-endpoints/) behavior and
[Backups](/docs/operations/backups/) for [PostgreSQL](/docs/architecture/data-model/) backup
strategy.

## Health checks

[Docker Compose](https://docs.docker.com/compose/) and orchestrators should probe `GET /health` or
use the built-in healthcheck:

```yaml
healthcheck:
  test: ["CMD", "/app/rustume-server", "--health"]
  interval: 30s
  timeout: 3s
  retries: 3

```

The `--health` flag performs an in-process HTTP probe — no curl required in distroless images.

## Resource requirements

Typical single-user usage:

| Resource | Minimum | Recommended |
| --- | --- | --- |
| CPU | 1 core | 2 cores |
| RAM | 512 MB | 1 GB |
| Disk | 200 MB (image) | 1 GB (logs + temp) |

PDF rendering is CPU-bound. Concurrent renders on a small VPS may queue, so self-hosted operators
should size and monitor the deployment for their workload.

## Security headers

The server sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
strict-origin-when-cross-origin`, and `X-XSS-Protection: 0` on all responses.
