# Deployment

Rustume ships as a single container that serves both the SolidJS resume builder
and the Rust API.

## Docker

```bash
docker run -p 3000:3000 ghcr.io/lgtm-hq/rustume:latest
```

Open <http://localhost:3000>. The same process also exposes:

- `GET /health` for container health checks
- `/swagger-ui/` for API documentation
- `/api-docs/openapi.json` for the OpenAPI document

## Docker Compose

From the repository root:

```bash
docker compose up
```

The root `docker-compose.yml` uses the published GHCR image. To test a local
image instead:

```bash
docker build -t rustume -f docker/Dockerfile .
docker run -p 3000:3000 rustume
```

## Image Tags

Use `latest` for the most recent published release. Release events also publish
semantic tags such as `0.14.1`, `0.14`, and `0`.

For unreleased changes from the default branch, use `main`.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port inside the container. |
| `RUST_LOG` | `info` | Rust tracing filter. Use `debug` for more server logs. |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins for API requests. |
| `RUSTUME_STATIC_DIR` | `/app/web` | Directory containing the built web app. |

## Reverse Proxy

Rustume is designed for local or single-user deployments. If you expose it on
the internet, place it behind a reverse proxy that provides TLS and any required
access control.

Example Caddy configuration:

```caddyfile
rustume.example.com {
  reverse_proxy rustume:3000
}
```

## Persistence

The server is stateless. Resume data is stored in the browser by the web app and
sent to the API only when parsing, previewing, or exporting. Back up browser data
by exporting resumes from the UI.
