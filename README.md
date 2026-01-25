# Rustume

A privacy-first, offline-first resume builder powered by Rust.

## Overview

Rustume is a cross-platform resume builder that prioritizes:

- **Privacy**: Your data stays on your device by default
- **Offline-first**: Works 100% without internet
- **Native performance**: Rust core with native UI shells
- **Modern PDF generation**: Typst-based, no browser dependencies

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Rust Core (rustume-*)                     │
│  ┌────────┐  ┌────────┐  ┌────────┐                         │
│  │  WASM  │  │  CLI   │  │ Server │                         │
│  └────────┘  └────────┘  └────────┘                         │
│                                                              │
│  Crates: schema | parser | render | storage | utils          │
└─────────────────────────────────────────────────────────────┘
```

## Crates

| Crate             | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `rustume-schema`  | Resume data types and validation                           |
| `rustume-parser`  | Import formats (JSON Resume, LinkedIn, Reactive Resume V3) |
| `rustume-render`  | Typst-based PDF and PNG generation                         |
| `rustume-storage` | Platform storage abstraction                               |
| `rustume-utils`   | Shared utilities (ID generation, string, date, color)      |
| `rustume-cli`     | Command-line interface                                     |
| `rustume-server`  | REST API server with OpenAPI docs                          |
| `rustume-wasm`    | WebAssembly bindings for parser                            |

## Building

```bash
# Build all crates
cargo build --workspace --all-features

# Run tests
cargo test --workspace

# Build CLI
cargo build -p rustume-cli --release

# Build WASM bindings
cd bindings/wasm && wasm-pack build
```

## CLI Usage

```bash
# Parse a JSON Resume file
rustume parse resume.json -o rustume.json

# Render to PDF
rustume render rustume.json -o resume.pdf

# Generate PNG preview
rustume preview rustume.json -o preview.png

# List available templates
rustume templates

# Create a new resume
rustume init my-resume.json
```

## Features

- 4 professionally designed templates (rhyhorn, azurill, pikachu, nosepass)
- Import from JSON Resume, LinkedIn export, and Reactive Resume V3
- Theme customization (colors, fonts, spacing)
- PDF and PNG export
- REST API with OpenAPI/Swagger documentation

## Server Deployment

### Environment Variables

| Variable   | Description           | Default                 |
| ---------- | --------------------- | ----------------------- |
| `PORT`     | Server listening port | `3000`                  |
| `RUST_LOG` | Log level filter      | `info,tower_http=debug` |

### Docker

Build and run the server container:

```bash
# Build
docker build -t rustume-server -f docker/Dockerfile.server .

# Run
docker run -p 3000:3000 rustume-server
```

### Health Check

The server exposes a health endpoint for load balancer integration:

```bash
curl http://localhost:3000/health
# Returns: "ok"
```

### Reverse Proxy (nginx)

Example nginx configuration with rate limiting:

```nginx
upstream rustume {
    server 127.0.0.1:3000;
}

limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 80;
    server_name api.example.com;

    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://rustume;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeout for PDF rendering
        proxy_read_timeout 60s;
    }

    # Health check bypass rate limiting
    location /health {
        proxy_pass http://rustume;
    }
}
```

### Reverse Proxy (Caddy)

Example Caddyfile using the [caddy-ratelimit](https://github.com/mholt/caddy-ratelimit) module:

> **Note**: The `rate_limit` directive requires the third-party module
> [github.com/mholt/caddy-ratelimit](https://github.com/mholt/caddy-ratelimit).
> Build Caddy with this module using xcaddy:
> ```bash
> xcaddy build --with github.com/mholt/caddy-ratelimit
> ```

```caddyfile
api.example.com {
    reverse_proxy localhost:3000

    @api path /api/*
    rate_limit @api {
        zone api {
            key {remote_host}
            events 10
            window 1s
        }
    }
}
```

### API Documentation

Swagger UI is available at `/swagger-ui/` and OpenAPI spec at `/api-docs/openapi.json`.

## License

MIT
